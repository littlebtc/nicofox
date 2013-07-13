/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Read and parse video info from Nico Nico Douga.
 * What are the problems?
 * (1) There are two ways to get video info from the site: via video page or /getthumbinfo/ API.
 *     While the video page is rate limited, it seems that /getthumbinfo/ API is not
 *     But /getthumbinfo/ doesn't have all of the information needed for NicoFox. :(
 * (2) Nico Nico Douga had a limitation for video stream access, which seems to be bundle with the loading of the video page.
 * (3) We want to make download manager be fast to display simple video infos.
 * 
 * What is NicoFox's approach to solve the problems? 
 * - If user loads a video page, in the DOMContentLoaded event, DOM tree will be sent to here.
 *   Video info will be parsed here then be cached in xul:browser for a short time.
 * - When user want to download a video, if the info is cached, use the cached info, 
 *   Otherwise, call /getthumbinfo/ to get "simple" info which will not be cached.
 * - When we actully start downloading, VideoInfoReader will be called again, to make sure video stream access won't be blocked:
 *   If the cached info is not expired, then it should be ok; if not, the video page will be reloaded and should be OK again.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "VideoInfoReader" ];

let VideoInfoReader = {};

/* The interval for video page reading, in milliseconds */
const PAGE_READ_INTERVAL = 10000; /* 10 secs */

/* Parse the video info from DOM, info fetcher or simple info fetcher.
 * @param target           The URL of the video or the DOM of the video page, depending on where the info from.
 * @param nicoData         The Video variable on Nico Nico Douga page.
 * @param otherData        Other video information read from infoFetcher/simpleInfoFetcher or readFromPageDOM.
 * == Type Definitions for the video URL ==
 * In Nico Nico Douga, a video may have different URL, correspoding to different version of comments on video. 
 * It will be written in the "comment" field in VideoInfoReader as a string:
 *
 * (a) Japan site URL containing video ID
 *    e.g. http://www.nicovideo.jp/watch/sm9
 *
 *    - "www": Normal comments.
 *
 * (b) Global site URL containing video ID
 *    e.g. http://tw.nicovideo.jp/watch/sm9
 *     Note: As the closure of Taiwan site in 2012, there is currently no global sites.
 *     This is still remained for compatibility with old contents.
 *
 *    - "tw": Taiwan version comments.
 *    - "de": German version comments.
 *    - "es": Spanish version comments.
 * 
 * (c) Global Sites URL containing comment ID
 *    e.g. http://www.nicovideo.jp/watch/1262869398:
 *
 *   "ch1234" or "co1234": Community / Channel comment.
 *   "mymemory": My-memory comments.
 *   "comment123456789012": Others which is hard to distinguish.
 */
function parseVideoInfo(result) {
  var url = "";
  var target = result.target;
  var nicoData = result.nicoData;
  /* Parse the URL. */
  if (target instanceof Ci.nsIDOMHTMLDocument) {
    url = target.location.href;
  } else if (typeof target == "string") {
    url = target;
  }
  url = url.replace(/\?.*$/, '');

  /* Put otherData into a info object */
  var info = result.otherData;
  info.nicoData = nicoData;

  /* Idendity (a),(b) type URLs */
  var videoIdUrlMatch = /^http:\/\/www\.nicovideo\.jp\/watch\/([a-z]{2}[0-9]+)$/.exec(url);
  var commentIdUrlMatch = /^http:\/\/www\.nicovideo\.jp\/watch\/([0-9]+)$/.exec(url);
  if (videoIdUrlMatch && !nicoData.channelId) {
    info.commentType = "www";
  } else if (videoIdUrlMatch) {
    /* XXX: soxxxxx will redirect to comment id URL, but can we dectect it?*/ 
    info.commentType = "ch" + nicoData.channelId;
  } else if (commentIdUrlMatch) {
    info.commentId = commentIdUrlMatch[1];
    /* Carefully distinguish (c) type URLs */
    if (nicoData.isMymemory) {
      info.commentType = "mymemory" + info.commentId;
    } else if (nicoData.mainCommunityId && nicoData.channelId) {
      info.commentType = "ch" + nicoData.channelId;
    } else if (nicoData.communityId) {
      info.commentType = "co" + nicoData.communityId;
    } else {
      info.commentType = "comment" + info.commentId;
    }
  } else {
    throw "notvalidurl";
  }
  /* Add the timestamp and target into info */
  info.loadTime = new Date().getTime();
  info.target = target;
  info.url = url;

  return info;
}

/* Inner reader to make asynchronous request to the video page, and response after read.
 * To control the total rate limit for video page reading from Nico Nico Douga,
 * A timer and a queue is created to do so.
 */
var infoFetcher = {};
infoFetcher.timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
infoFetcher.queue = [];
infoFetcher.lastPageReadTime = new Date().getTime(); /* Make sure interval won't broken after timer stopped . XXX: Should we initialize this later? */

/* Enqueue a info reading request. */
infoFetcher.enqueue = function(url) {
  /* Add a deferred object */
  Components.utils.import("resource://nicofox/When.jsm");
  var deferred = When.defer();
  /* Assign jobs to do when it is dequeued and prepare to return the promise. */
  Components.utils.import("resource://nicofox/Network.jsm");
  var returnedPromise = deferred.promise.then(function() { return Network.fetchUrlAsync(url, ''); }).then(this.readVideoPage.bind(this)).then(parseVideoInfo);

  /* Push it into queue */
  this.queue.push(deferred.resolver);

  /* If the timer is not running, make it run in a specific delay */
  if (!this.timer.callback) {
    var delay = 50;
    this.timer.initWithCallback(this, delay, Ci.nsITimer.TYPE_REPEATING_SLACK);
  }
  return returnedPromise;
};

/* Called when timer is fired. Dequeue and execute a video reading request.  */
infoFetcher.notify = function(timer) {
  /* Resolve the oldest item */
  var item = this.queue.shift();
  item.resolve();

  /* Check if there are remaining jobs to run */
  if (this.queue.length == 0) {
    timer.cancel();
    this.lastPageReadTime = new Date().getTime();
  } else {
    timer.delay = PAGE_READ_INTERVAL;
  }
};
/* The responser to the video page. */
infoFetcher.readVideoPage = function(result) {
  var url = result.url;
  var content = result.data;
  /* For Zero edition: Find watchAPIDataContainer */
  var regexMatchZero = content.match(/<div id\=\"watchAPIDataContainer\" style=\"display:none\">([^<]+)<\/div>/);
  /* For Harajuku & Taiwan edition: Find the Video parameter on the page */
  var regexMatch = content.match(/<script type\=\"text\/javascript\">\s?(<!--)?\s+var Video = \{([\s\S]*?)\}\;\s+(-->)??\s?<\/script>/);
  if (!regexMatchZero && !regexMatch) {
    /* Two cases if Video is not present: (1) had User variable: error, anti-flood (2) has no User variable: not logged in */
    var reason = "";
    if (/var User = \{ id\: [0-9]+/.test(content)) {
      if (/<h1>(?:\u77ed|\u8acb|Bitte|Solicitamos)/.test(content)) {
        reason = "antiflood";
      } else {
        reason = "novideo";
      }
    } else {
      /* XXX: Autologin */
      reason = "notloggedin";
    }
    throw reason;
  }
  if (regexMatchZero) {
    /* For zero edition, unescape HTML then use JSON.parse */
    /* Dependency: nsIScriptableUnescapeHTML deprecated on Firefox 14 */
    var scriptableUnescapeHTML = Cc["@mozilla.org/feed-unescapehtml;1"].getService(Ci.nsIScriptableUnescapeHTML);
    try {
      var videoString = scriptableUnescapeHTML.unescape(regexMatchZero[1]);
      var nicoData = {};
      nicoData = JSON.parse(videoString).videoDetail;
    } catch(e) {
      throw "jsonfail";
    }
    var otherData = {};
    otherData.hasOwnerThread = Boolean(nicoData.has_owner_thread);
  } else {
    /* For Harajuku & Taiwan edition */
    /* Convert it from toSource() type to JSON, and safely using it by JSON.parse */
    var videoString = regexMatch[2];
    videoString = videoString.replace(/^\s+([0-9a-z\_]+)\:\s+/img, "\'$1\':").replace(/\'/g, '"');
    var nicoData = {};
    try {
      nicoData = JSON.parse('{'+videoString+'}');
    } catch(e) {
      throw "jsonfail";
    }
    var otherData = {};
    /* Check whether the uploader comments (thread) exists on this video */
    otherData.hasOwnerThread = (content.search(/<script type=\"text\/javascript\"><!--[^<]*so\.addVariable\(\"has_owner_thread\"\, \"1\"\)\;[^<]*<\/script>*/) != -1);
  }
  return { target: url, nicoData: nicoData, otherData: otherData };
};

/* Inner reader to make asynchronous request to the /getthumbinfo/ XML, and response after read "simple info"*/
var simpleInfoFetcher = {};

/* Enqueue a info reading request. */
simpleInfoFetcher.enqueue = function(url) {
  /* Replace /getthumbinfo/ URL, change www.nicovideo.jp to ext.nicovideo.jp to avoid redirect. */
  var apiUrl = url.replace(/^http:\/\/www\./, "http://ext.").replace(/\/watch\//, "/api/getthumbinfo/");
  Components.utils.import("resource://nicofox/Network.jsm");
  return Network.fetchXml(apiUrl, "").then(this.readVideoXML.bind(this, url));
}
/* The responser to /getthumbinfo/ XML. (Using E4X) */
simpleInfoFetcher.readVideoXML = function(originalUrl, result) {
  var infoDoc = result.xml;
  var url = originalUrl;
  var info = {};
  if (infoDoc.documentElement.getAttribute("status") != "ok") {
    var reason = "";
    var errorCodeNode = infoDoc.querySelector("error code");
    var errorCode = (errorCodeNode)? errorCodeNode.textContent : "";
    Components.utils.reportError(errorCode);
    /* Read the error message */
    if (errorCode == "COMMUNITY") {
      reason = "community";
    } else if (errorCode == "NOT_FOUND") {
      reason = "notfound";
    } else if (errorCode == "DELETED") {
      reason = "deleted";
    } else {
      reason = "xmlerr";
    }
    /* Community thread cannot be read from getthumbinfo, which should not be considered as an error. */
    if (reason != "community") {
      throw reason;
    } else {
      /* Use the thread ID as title */
      info.nicoData = {
        title: url.slice(url.lastIndexOf("/") + 1) 
      };
    }
  } else {
    /* Try to match the info type similar as infoFetcher. */
    info.nicoData = {
      title: infoDoc.getElementsByTagName("title")[0].textContent,
      thumbnail: infoDoc.getElementsByTagName("thumbnail_url")[0].textContent
    };
  }
  /* Note extra information including it is a simple one; then return */
  info.target = originalUrl;
  info.url = originalUrl;
  info.simple = true;
  return info;
};

/* Lazy sanitizer: Stringify unsafe object using JSON then re-parse it. Just return empty object when failed. 
 * Used by VideoInfoReader.readFromPageDOM
 */
function lazySanitize(unsafeObject) {
  if ((typeof unsafeObject) != "object") { return {}; }
  var parsedJSON = "";
  var safeObject = {};
  try {
    parsedJSON = JSON.stringify(unsafeObject);
    safeObject = JSON.parse(parsedJSON);
  } catch(e) {
    safeObject = {};
  }
  return safeObject;
}

/* Public Methods. */

/* Read video info from window/document DOM object in the video page. Called from browser overlays.
 * @param unsafeWindow Unsafe wrappedJSObject from window DOM object on the page.
 * @param contentDoc Safe document DOM object on the page.
 */
VideoInfoReader.readFromPageDOM = function(unsafeWindow, contentDoc) {
  Components.utils.import("resource://nicofox/When.jsm");
  /* URL should be filtered in overlay.js */
  var url = contentDoc.location.href;

  try {
    /* Consider as failed if cannot find #watchAPIDataContainer or #WATCHHEADER and wrappedJSObject.so on the page */
    if(!contentDoc.getElementById("watchAPIDataContainer") && (!contentDoc.getElementById("WATCHHEADER") || !unsafeWindow.so)) {
      throw "noplayer";
    }

    var otherData = {};
    otherData.hasOwnerThread = false;
    var zeroDataContainer = contentDoc.getElementById("watchAPIDataContainer");
    if (zeroDataContainer) {
      /* For Zero edition: Read data from DOM-stored JSON string on #watchAPIDataContainer. */
      try {
        var nicoData = JSON.parse(zeroDataContainer.textContent).videoDetail;
      } catch(e) {
        throw "novideoobject";
      }
      otherData.hasOwnerThread = Boolean(nicoData.has_owner_thread);
    } else {
      /* For Harajuku and Taiwan edition: read data from window object.
         Use lazy sanitizer to parse Video and so.variables object from UNSAFE wrappedJSObject window in the video page.
         Check if we can fetch the data correctly; don't do autologin or antiflood check here */
      var nicoData = lazySanitize(unsafeWindow.Video);
      var swfVariables = lazySanitize(unsafeWindow.so.variables);
      if (!nicoData.v || !swfVariables.v) {
        throw "novideoobject";
      }
      /* Check whether the uploader comments (thread) exists on this video */
      if (swfVariables["has_owner_thread"]) {
        otherData.hasOwnerThread = true;
      }
    }
  } catch(e) {
    /* Send a rejected promise when failed */
    return When.reject(e.toString());
  }
  /* Parse the data and store the video info, wrapped with a promise */
  return When(parseVideoInfo({target: contentDoc, url: url, nicoData: nicoData, otherData: otherData}));
};

/* Since Zero uses History API for page transition, and no detailed info is exposed to DOM during that,
 * Read basic information after the transition. */
VideoInfoReader.readBasicZeroInfo = function(contentDoc) {
  var info = { nicoData: {} };
  var url = contentDoc.location.href;
  /* Try to find the v and id from URL and DOM */
  var vMatch = url.match(/\/watch\/([a-z]{0,2}[0-9]+)$/);
  var cmsWatchLink = contentDoc.querySelector(".cmsWatchLink");
  if (!vMatch || !cmsWatchLink) { return; }
  var idMatch = cmsWatchLink.getAttribute("href").match(/\/([a-z]{2}[0-9]+)$/);
  if (!idMatch) { return; }
  /* Check if the page is completedly loaded by checking whether the id can be matched */
  var threadId = contentDoc.querySelector("#videoShareLinks .nicoru-button").getAttribute("data-thread");
  if (threadId != vMatch[1] && idMatch[1] != vMatch[1]) { return; }
  info.nicoData.v = vMatch[1];
  info.nicoData.id = idMatch[1];
  info.nicoData.thumbnail = contentDoc.getElementById("videoThumbnailImage").getAttribute("src");
  info.nicoData.title = contentDoc.getElementById("videoTitle").textContent;
  info.url = url;
  info.target = url;
  info.simple = true;
  return info;
};
/* Read the video URL and parse the video info from the resulting HTML source. Called from download manager.
 * @param url               The video URL.
 * @param simpleInfoAllowed Whether simple info, which can be retrived from /getthumbinfo/ XML with less restriction, is allowed.
 * @return the promise of the fetcher.
 */
VideoInfoReader.readByUrl = function(url, simpleInfoAllowed) {
  if (simpleInfoAllowed) {
    return simpleInfoFetcher.enqueue(url);
  } else {
    return infoFetcher.enqueue(url);
  }
};
