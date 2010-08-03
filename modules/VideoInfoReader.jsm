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
 * - If user loaded a video page, the info (from NicoMonkey) will be automatically cached for a short time.
 * - When user want to download a video, if the info is cached, use the cached info, otherwise, call /getthumbinfo/ to get "simple" info.
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
 * @param url The URL of the video.
 * @param nicoData the Video variable on Nico Nico Douga page.
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
function parseVideoInfo(url, nicoData, otherData, thisObj, callbackFuncName) {
  /* Put otherData into a info object */
  var info = otherData;
  info.nicoData = nicoData;
  /* Add the timestamp */
  info.loadTime = new Date().getTime();
  
  /* Idendity (a),(b) type URLs */
  var videoIdUrlMatch = /^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([a-z]{2}[0-9]+)$/.exec(url);
  var commentIdUrlMatch = /^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([0-9]+)$/.exec(url);
  if (videoIdUrlMatch && !nicoData.channelId) {
    info.commentType = videoIdUrlMatch[1];
    Components.utils.reportError("Match Video ID!");
  } else if (videoIdUrlMatch) {
    /* XXX: soxxxxx will redirect to comment id URL, but can we dectect it?*/ 
    info.commentType = "ch" + nicoData.channelId;
  } else if (commentIdUrlMatch) {
    info.commentId = commentIdUrlMatch[1];
    Components.utils.reportError("Match Comment ID!");
    /* Carefully distinguish (c) type URLs */
    if (nicoData.isMymemory) {
      info.commentType = "mymemory" + info.commentId;
    } else if (nicoData.mainCommunityId && nicoData.channelId) {
      info.commentType = "ch" + nicoData.channelId;
    } else if (nicoData.mainCommunityId) {
      info.commentType = "co" + nicoData.communityId;
    } else {
      info.commentType = "comment" + info.commentId;
    }
  } else {
    Components.utils.reportError("NicoFox VideoInfoReader Error: Not a valid Nico Nico Douga URL");
    return;
  }
  /* Write the data into cache */
  writeCache(url, info);
  
  /* If there is callback, call the callback */
  if (thisObj && callbackFuncName) {
    thisObj[callbackFuncName].call(thisObj, url, info);
  }
}

/* Inner reader to make asynchorous request to the video page, and response after read */
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
    var userMatch = content.match(/var User = \{ id\: [0-9]+/);
    var reason = "";
    if (userMatch) {
      Components.utils.reportError("NicoFox VideoReader down: Cannot fetch Video parameter. Antiflood is on, or the video had been deleted.");
      reason = "error";
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
    this.callbackThisObj[this.failCallback].call(this.callbackThisObj);
    return;
  }
  var otherData = {};
  /* Check whether the uploader comments (thread) exists on this video */
  otherData.hasOwnerThread = (content.search(/<script type=\"text\/javascript\"><!--[^<]*so\.addVariable\(\"has_owner_thread\"\, \"1\"\)\;[^<]*<\/script>*/) != -1);
  
  /* Parse the data and store the video info */
  parseVideoInfo(url, nicoData, otherData, this.callbackThisObj, this.successCallback);
};
/* When fetchUrlAsync cannot read the page, throw an error. */
innerFetcher.prototype.fetchError = function() {
  Components.utils.reportError("NicoFox VideoReader down: Cannot read video page on Nico Nico Douga.");
  this.callbackThisObj.failCallback.call(this.callbackThisObj);
};

/* Public Methods. */

/* Called when NicoMonkey had read the data on a loaded web page and sent it as JSON string */
VideoInfoReader.readFromNicoMonkey = function(url, nicoDataJSON, otherDataJSON) {
  var nicoData = {};
  var otherData = {};
  try {
    nicoData = JSON.parse(nicoDataJSON);
    otherData = JSON.parse(otherDataJSON);
  } catch(e) {
    Components.utils.reportError("NicoFox VideoReader down: Cannot read video data from video page via NicoMonkey");
    return;
  }
  /* Parse the data and store the video info */
  parseVideoInfo(url, nicoData, otherData);
};

/* Called by Download Manager, to request video info for a specific URL */
VideoInfoReader.readByUrl = function(url, simpleInfoAllowed, thisObj, successCallback, failCallback) {
  if (!thisObj || typeof thisObj[successCallback] != "function" || typeof thisObj[failCallback] != "function") {
    throw new Error('Wrong parameter in readByUrl');
    return;
  }
  if (cachedInfo[url]) {
    /* If there is cache, use the cache */
    thisObj[successCallback].call(thisObj, url, cachedInfo[url]);
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
};
