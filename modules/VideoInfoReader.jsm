/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Read, parse and cache video info from Nico Nico Douga from two ways:
 * (1) Manually read it via AJAX request during the download process
 * (2) Automatically read it when page finishing loading (which still contains some security concern)
 *
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "VideoInfoReader" ];

let VideoInfoReader = {};

/* Store info in a simple cache queue after reading,
 * to decrease the total number of request to the Nico Nico Douga website. 
 * This is private and cannot be read from out of the module.
 */
var cachedInfos = [];
const maxCacheNum = 10;

/* Wrtie info into cache */
function writeCache(info) {
  if (cachedInfos.length > maxCacheNum) {
    cachedInfos.shift();
  }
  cachedInfo.push(info);
}

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
function parseVideoInfo(url, nicoData, otherData) {
  /* Put otherData into a info object */
  var info = otherData;
  /* Add the timestamp */
  info.loadTime = new Date().getTime();
  
  /* Idendity (a),(b) type URLs */
  var videoIdUrlMatch = /^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([a-z]{0,2}[0-9]+)$/.test(url);
  var commentIdUrlMatch = /^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([0-9]+)$/.test(url);
  if (videoIdURLMatch) {
    info.commentType = VideoIdUrlMatch[1];
  } else if (commentIdUrlMatch)
    info.commentId = commentIdUrlMatch[1];
    /* Carefully distinguish (c) type URLs */
    if (nicoData.Video.isMymemory) {
      info.commentType = "mymemory";
    } else if (nicoData.Video.communityId) {
      info.commentType = "co" + nicoData.Video.communityId;
    } else if (nicoData.Video.channelId) {
      info.commentType = "ch" + nicoData.Video.channelId;
    } else {
      info.commentType = "unknown";
    }
  } else {
    Components.utils.reportError("NicoFox VideoInfoReader Error: Not a valid Nico Nico Douga URL");
  }
}

/* Inner reader to make asynchorous request to the video page, and response after read */
function innerFetcher(url) {
  Components.utils.import("resource://nicofox/Network.jsm");
  Network.fetchUrlAsync(url, this, 'readVideoPage', 'fetchError');
}
/* The responser to the video page. */
innerFetcher.prototype.readVideoPage = function(url, content) {
  /* Find the Video parameter on the page */
  var regexMatch = content.match(/<script type\=\"text\/javascript\">\s?(<!--)?\s+var Video = \{([\s\S]*)\}\;\s+(-->)?\s?<\/script>/);
  if (!regexMatch) {
    /* XXX: Autologin removed, anti-flood. Display a message. */
    Components.utils.reportError("NicoFox VideoReader down: Cannot fetch Video parameter. Maybe you are not logged in or the antiflood process is on.");
    return;
  }
  
  /* Convert it from toSource() type to JSON, and safely using it by JSON.parse */
  var videoString = regexMatch[2];
  videoString = videoString.replace(/^\s+([0-9a-z]+)\:\s+/img, "\'$1\':").replace(/\'/g, '"');
  var nicoData = {};
  try {
    nicoData = JSON.parse('{'+videoString+'}');
  } catch(e) {
    /* XXX: Error handling */
    Components.utils.reportError("NicoFox VideoReader down: Cannot convert Video parameter into JSON");
    return;
  }
  var otherData = {};
  parseVideoInfo(url, nicoData, otherData);
};
/* When fetchUrlAsync cannot read the page, throw an error. */
innerFetcher.prototype.fetchError = function() {
  throw new Error("NicoFox VideoReader down: Cannot read video page on Nico Nico Douga.");
};

/* Public Methods. */

/* Parse JSON into object and read the video info */
VideoInfoReader.readViaNicoMonkey = function(url, nicoDataJSON, otherDataJSON) {
  var nicoData = {};
  var otherData = {};
  try {
    nicoData = JSON.parse(nicoDataJSON);
    otherData = JSON.parse(otherDataJSON);
  } catch(e) {
    Components.utils.reportError("NicoFox VideoReader down: Cannot read video data from video page via NicoMonkey");
    return;
  }
  parseVideoInfo(url, nicoData, otherData);
};

VideoInfoReader.readByUrl = function(url) {
  var innerFetcherInstance = new innerFetcher(url);
};
