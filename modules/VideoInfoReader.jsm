/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Read, parse and cache video info from Nico Nico Douga.
 * What are the problems?
 * (1) There are two ways to get video info from the site: via video page or /getthumbinfo/ API.
 *     While the video page is rate limited, it seems that /getthumbinfo/ API is not (it is much easier to get it cached, i gueess)
 *     But /getthumbinfo/ doesn't have all of the information needed for NicoFox. :(
 * (2) Nico Nico Douga had a limitation for video stream access, which seems to be bundle with the loading of the video page.
 * (3) We want to make download manager be fast to display simple video infos.
 * 
 * What is NicoFox's approach to solve the problems? 
 * - If user loads a video page, in the DOMContentLoaded event, DOM tree will be sent to here.
 *   Video info will be parsed here then be cached for a short time.
 * - When user want to download a video, if the info is cached, use the cached info, 
 *   Otherwise, call /getthumbinfo/ to get "simple" info which will not be cached.
 * - When we actully start downloading, VideoInfoReader will be called again, to make sure video stream access won't be blocked:
 *   If the cached info is not expired, then it should be ok; if not, the video page will be reloaded and should be OK again.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "VideoInfoReader" ];

let VideoInfoReader = {};

/* Store info in a cache queue with expiration after reading,
 * to decrease the total number of request to the Nico Nico Douga website. 
 * This is private and should not be read from out of the module.
 * - cachedVideoInfos is an object that stores URL-info mapping in hash.
 * - cachedQueue is a queue, used for expiring the cache.
 */
var cachedInfo = {};
var cachedQueue = [];

/* Use a timer for cache expiration */
var expirationTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
var expirationTimerCallback = {};
expirationTimerCallback.notify = function(timer) {
  /* Expire the oldest item */
  var url = cachedQueue[0].url;
  delete(cachedInfo[url]);
  cachedQueue.shift();
  if (cachedQueue.length == 0) {
    timer.cancel();
  } else {
    timer.delay = Math.max(100, EXPIRATION_DELAY + cachedQueue[0].time - new Date().getTime());
  }
  Components.utils.reportError(JSON.stringify(cachedInfo));
  Components.utils.reportError(JSON.stringify(cachedQueue));
};

/* Expiraiton time for every info, in milliseconds */
const EXPIRATION_DELAY = 60000; /* 60 sec */

/* Wrtie info into cache */
function writeCache(url, info) {
  /* Find the old item and remove it from the queue */
  if (cachedInfo[url]) {
    cachedQueue = cachedQueue.filter(function(element, index, array) {
      return (element.url != this.url);
    }, {url: url});
  }
  cachedInfo[url] = info;
  cachedQueue.push({
    time: new Date().getTime(),
    url: url
  });
  /* If the timer is not running, make it run with a specific delay */
  if (!expirationTimer.callback) {
    var delay = Math.max(100, EXPIRATION_DELAY + cachedQueue[0].time - new Date().getTime());
    expirationTimer.initWithCallback(expirationTimerCallback, delay, Ci.nsITimer.TYPE_REPEATING_SLACK);
  }
  Components.utils.reportError(JSON.stringify(cachedInfo));
  Components.utils.reportError(JSON.stringify(cachedQueue));
}

/* To control the total rate limit for video page reading from Nico Nico Douga,
 * A timer and a queue is created to do so.
 */
const PAGE_READ_INTERVAL = 10000; /* The interval for video page reading, in milliseconds */
var pageReadTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
var pageReadTimerCallback = {};
var pageReadQueue = [];
var lastPageReadTime = new Date().getTime(); /* Make sure interval won't broken after timer stopped . XXX: Should we initialize this later? */

pageReadTimerCallback.notify = function(timer) {
  /* Process the oldest item */
  var item = pageReadQueue.shift();
  var innerFetcherInstance = new innerFetcher(item.url, item.thisObj, item.successCallback, item.failCallback);
  
  if (pageReadQueue.length == 0) {
    timer.cancel();
    lastPageReadTime = new Date().getTime();
  } else {
    timer.delay = PAGE_READ_INTERVAL;
  }
};

/* Parse the video info, and write it into cache. 
 * @param target           The URL of the video or the DOM of the video page, depending on where the info from.
 * @param nicoData         The Video variable on Nico Nico Douga page.
 * @param otherData        Other video information read from readByUrl/innerFetcher or readFromPageDOM.
 * @param writeToCache     Whether to write the read video info to the cache.
 * @param thisObj          this object for the callback
 * @param successCallback  Name of callback function in thisObj, called if the info is read successfully.
 * @param failCallback     Name of callback function in thisObj, called if the info cannot be read.
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
function parseVideoInfo(target, nicoData, otherData, writeToCache, thisObj, successCallback, failCallback) {
  var url = "";
  /* Parse the URL. */
  if (target instanceof Ci.nsIDOMHTMLDocument) {
    url = target.location.href;
    if (url.indexOf("?") >= 0) {
      url = url.substring(0, url.indexOf("?"));
    }
  } else if (typeof target == "string") {
    url = target;
  }

  /* Put otherData into a info object */
  var info = otherData;
  info.nicoData = nicoData;
  /* Add the timestamp */
  info.loadTime = new Date().getTime();
  
  /* Idendity (a),(b) type URLs */
  var videoIdUrlMatch = /^http:\/\/(www|tw)\.nicovideo\.jp\/watch\/([a-z]{2}[0-9]+)$/.exec(url);
  var commentIdUrlMatch = /^http:\/\/(www|tw)\.nicovideo\.jp\/watch\/([0-9]+)$/.exec(url);
  if (videoIdUrlMatch && !nicoData.channelId) {
    info.commentType = videoIdUrlMatch[1];
    Components.utils.reportError("Match Video ID!");
  } else if (videoIdUrlMatch) {
    /* XXX: soxxxxx will redirect to comment id URL, but can we dectect it?*/ 
    info.commentType = "ch" + nicoData.channelId;
  } else if (commentIdUrlMatch) {
    info.commentId = commentIdUrlMatch[2];
    Components.utils.reportError("Match Comment ID!");
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
    Components.utils.reportError("NicoFox VideoInfoReader Error: Not a valid Nico Nico Douga URL");
    thisObj[failCallback].call(thisObj, "notvalidurl");
    return;
  }
  /* Write the data into cache, if needed */
  if (writeToCache) {
    writeCache(url, info);
  }
  /* Execute the callback */
  thisObj[successCallback].call(thisObj, target, info);
}

/* Inner reader to make asynchronous request to the video page, and response after read */
function innerFetcher(url, thisObj, successCallback, failCallback) {
  this.callbackThisObj = thisObj;
  this.successCallback = successCallback;
  this.failCallback = failCallback;
  Components.utils.import("resource://nicofox/Network.jsm");
  Network.fetchUrlAsync(url, "", this, "readVideoPage", "fetchError");
}
/* The responser to the video page. */
innerFetcher.prototype.readVideoPage = function(url, content) {
  /* Find the Video parameter on the page */
  var regexMatch = content.match(/<script type\=\"text\/javascript\">\s?(<!--)?\s+var Video = \{([\s\S]*)\}\;\s+(-->)?\s?<\/script>/);
  if (!regexMatch) {
    /* Two cases if Video is not present: (1) had User variable: error, anti-flood (2) has no User variable: not logged in */
    var reason = "";
    if (/var User = \{ id\: [0-9]+/.test(content)) {
      if (/<h1>(?:\u77ed|\u8acb|Bitte|Solicitamos)/.test(content)) {
        Components.utils.reportError("NicoFox VideoReader down: antiflood is on.");
        reason = "antiflood";
      } else {
        Components.utils.reportError("NicoFox VideoReader down: Cannot fetch Video parameter.");
        reason = "error";
      }
    } else {
      /* XXX: Autologin */
      Components.utils.reportError("NicoFox VideoReader down: User is not logged in.");
      reason = "notloggedin";
    }
    this.callbackThisObj[this.failCallback].call(this.callbackThisObj, reason);
    return;
  }
  
  /* Convert it from toSource() type to JSON, and safely using it by JSON.parse */
  var videoString = regexMatch[2];
  videoString = videoString.replace(/^\s+([0-9a-z]+)\:\s+/img, "\'$1\':").replace(/\'/g, '"');
  var nicoData = {};
  try {
    nicoData = JSON.parse('{'+videoString+'}');
  } catch(e) {
    Components.utils.reportError("NicoFox VideoReader down: Cannot convert Video parameter into JSON");
    this.callbackThisObj[this.failCallback].call(this.callbackThisObj, "jsonfail");
    return;
  }
  var otherData = {};
  /* Check whether the uploader comments (thread) exists on this video */
  otherData.hasOwnerThread = (content.search(/<script type=\"text\/javascript\"><!--[^<]*so\.addVariable\(\"has_owner_thread\"\, \"1\"\)\;[^<]*<\/script>*/) != -1);
  
  /* Parse the data and store the video info */
  parseVideoInfo(url, nicoData, otherData, true, this.callbackThisObj, this.successCallback, this.failCallback);
};
/* When fetchUrlAsync cannot read the page, throw an error. */
innerFetcher.prototype.fetchError = function() {
  Components.utils.reportError("NicoFox VideoReader down: Cannot read video page on Nico Nico Douga.");
  this.callbackThisObj[this.failCallback].call(this.callbackThisObj, "unavailable");
};

/* Inner reader to make asynchronous request to the /getthumbinfo/ XML, and response after read "simple info"*/
function innerSimpleFetcher(url, thisObj, successCallback, failCallback) {
  this.callbackThisObj = thisObj;
  this.successCallback = successCallback;
  this.failCallback = failCallback;
  this.originalUrl = url;
  /* Replace /getthumbinfo/ URL, change www.nicovideo.jp to ext.nicovideo.jp to avoid redirect. */
  url = url.replace(/^http:\/\/www\./, "http://ext.");
  url = url.replace(/\/watch\//, "/api/getthumbinfo/");
  Components.utils.import("resource://nicofox/Network.jsm");
  Network.fetchUrlAsync(url, "", this, "readVideoXML", "fetchError");
}
/* The responser to /getthumbinfo/ XML. (Using E4X) */
innerSimpleFetcher.prototype.readVideoXML = function(url, content) {
  content = content.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/, ""); // bug 336551
  var infoXML = new XML(content);
  var info = {};
  if (infoXML.@status != "ok") {
    var reason = "";
    /* Read the error message */
    if (infoXML.error.code.toString() == "COMMUNITY") {
      reason = "community";
    } else if (infoXML.error.code.toString() == "NOT_FOUND") {
      reason = "notfound";
    } else if (infoXML.error.code.toString() == "DELETED") {
      reason = "deleted";
    } else {
      reason = "xmlerr";
    }
    /* Community thread cannot be read from getthumbinfo, which should not be considered as an error. */
    if (reason != "community") {
      this.callbackThisObj[this.failCallback].call(this.callbackThisObj, reason);
      return;
    } else {
      /* Use the thread ID as title */
      info.nicoData = {
        title: url.slice(url.lastIndexOf("/") + 1) 
      };
    }
  } else {
    /* Try to match the info type similar as innerFetcher. */
    info.nicoData = {
      title: infoXML.thumb.title.toString(),
      thumbnail: infoXML.thumb.thumbnail_url.toString()
    };
  }
  /* If there is callback, call the callback */
  if (this.callbackThisObj && this.successCallback) {
    this.callbackThisObj[this.successCallback].call(this.callbackThisObj, this.originalUrl, info);
  }
};
/* When fetchUrlAsync cannot read the page, throw an error. */
innerSimpleFetcher.prototype.fetchError = function() {
  Components.utils.reportError("NicoFox VideoReader down: Cannot read video XML on Nico Nico Douga.");
  this.callbackThisObj[this.failCallback].call(this.callbackThisObj, "unavailable");
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
 * @param contentWin Safe window DOM object for the page.
 * @param contentDoc Safe document DOM object for the page.
 * @param firstRead  Whether the info is read for the first time.
 *                   If not (e.g. after dragging the tab and re-read), don't write the info into cache.
 * @param thisObj          this object for the callback
 * @param successCallback  Name of callback function in thisObj, called if the info is read successfully.
 * @param failCallback     Name of callback function in thisObj, called if the info cannot be read.
 */
VideoInfoReader.readFromPageDOM = function(contentWin, contentDoc, firstRead, thisObj, successCallback, failCallback) {
  /* URL should be filtered in overlay.js */
  var url = contentWin.location.href;

  /* Consider as failed if cannot find #WATCHHEADER and wrappedJSObject.so on the page */
  if(!contentDoc.getElementById("WATCHHEADER") || !contentWin.wrappedJSObject.so) {
    thisObj[failCallback].call(thisObj, contentDoc, "noplayer");
    contentWin = null;
    return;
  }

  /* Use lazy sanitizer to parse Video and so.variables object from UNSAFE wrappedJSObject window in the video page.
     Check if we can fetch the data correctly; don't do autologin or antiflood check here */
  var nicoData = lazySanitize(contentWin.wrappedJSObject.Video);
  var swfVariables = lazySanitize(contentWin.wrappedJSObject.so.variables);
  if (!nicoData.v || !swfVariables.v) {
    thisObj[failCallback].call(thisObj, contentDoc, "novideoobject");
    contentWin = null;
    return;
  }
  var otherData = {};
  otherData.hasOwnerThread = false;
  /* Check whether the uploader comments (thread) exists on this video */
  if (swfVariables["has_owner_thread"]) {
    otherData.hasOwnerThread = true;
  }
  // Prevent leak
  contentWin = null;
  /* Parse the data and store the video info; only cached for first read */
  parseVideoInfo(contentDoc, nicoData, otherData, Boolean(firstRead), thisObj, successCallback, failCallback);
};

/* Read the video URL and parse the video info from the resulting HTML source. Called from download manager.
 * @param url               The video URL.
 * @param simpleInfoAllowed Whether simple info, which can be retrived from /getthumbinfo/ XML with less restriction, is allowed.
 * @param thisObj           this object for the callback
 * @param successCallback   Name of callback function in thisObj, called if the info is read successfully.
 * @param failCallback      Name of callback function in thisObj, called if the info cannot be read.
 */
VideoInfoReader.readByUrl = function(url, simpleInfoAllowed, thisObj, successCallback, failCallback) {
  if (!thisObj || typeof thisObj[successCallback] != "function" || typeof thisObj[failCallback] != "function") {
    throw new Error('Wrong parameter in readByUrl');
    return;
  }
  if (cachedInfo[url]) {
    /* If there is cache, use the cache */
    thisObj[successCallback].call(thisObj, url, cachedInfo[url]);
  } else {
    /* For simple info: get it from /getthumbinfo/ XML, and don't use cache and queue */
    if (simpleInfoAllowed) {
      var innerSimpleFetcherInstance = new innerSimpleFetcher(url, thisObj, successCallback, failCallback);
    } else {
      /* Push it into queue */
      pageReadQueue.push({
        url: url,
        thisObj: thisObj,
        successCallback: successCallback,
        failCallback: failCallback,
      });
      /* If the timer is not running, make it run in a specific delay */
      if (!pageReadTimer.callback) {
        var delay = 50;
        pageReadTimer.initWithCallback(pageReadTimerCallback, delay, Ci.nsITimer.TYPE_REPEATING_SLACK);
      }
    }
  }
};
