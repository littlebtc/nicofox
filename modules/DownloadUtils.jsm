/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Handle download process for video elements (vidoe, comments, thumbnails, ... etc)
 * This script is currently site-specific. Replace download_helper.js and download_helper_nico.js in previous versions.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "DownloadUtils" ];
let DownloadUtils = {};

Components.utils.import("resource://nicofox/Services.jsm");
Components.utils.import("resource://nicofox/Core.jsm");
Components.utils.import("resource://nicofox/Network.jsm");
Components.utils.import("resource://nicofox/FileBundle.jsm");

/* Helper to handle multiple nsIWebBrowserPersist requests at the same time
 * @param thisObj         The this object for the callback function.
 * @param callback        The callback function name to be call when all files downloaded in thisObj.
 */
DownloadUtils.multipleHelper = function(thisObj, callback) {
  this.doneCallback = function() {
    thisObj[callback].call(thisObj);
  };
}
DownloadUtils.multipleHelper.prototype = {
  /* nsIWebBrowserPersist and nsIFile storage */
  persists: [],
  files: [],
  /* Are we still allowed to adding files? */
  adding: true,
  /* How many downloads are we handling? */
  downloadCount: 0,
  /* Add a nsIWebBrowserPersist download request to the helper.
   * @param url             URL to download, in string.
   * @param referrer        The referrer to be sent, in string.
   * @param postQueryString The query string for POST request in string, if not present, download will be a GET request.
   * @param file            The nsIFile instance for the destination of the file.
   * @param bypassCache     Whether to bypass the cached content
   * @param thisObj         The this object for the callback function.
   * @param callback        The callback function name to be call when this file downloaded in thisObj.
   */
  addDownload: function(url, referrer, postQueryString, file, bypassCache, thisObj, callback) {
    this.downloadCount++;
    /* URL process */
    var refUri = null;
    if (referrer) {
      refUri = Services.io.newURI(referrer, null, null);
    }
    var uri = Services.io.newURI(url, null, null);

    /* POST header processing */
    var postData = null;
    if (postQueryString) { 
      var postStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
      postStream.setData(postQueryString, postQueryString.length); // Brokes 1.8.*- compatibility 

      postData = Cc["@mozilla.org/network/mime-input-stream;1"].createInstance(Ci.nsIMIMEInputStream);
  
      postData.addHeader("Content-Type", "application/x-www-form-urlencoded");
      postData.addContentLength = true;
      postData.setData(postStream);
    }
    /* Create nsIWebBrowserPersist and set flags */
    /* Force allow 3rd party cookies, to make NicoFox work when 3rd party cookies are disabled. (Bug 437174) */
    var persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
    var flags =  Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_FORCE_ALLOW_COOKIES |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_CLEANUP_ON_FAILURE;
    if (bypassCache) {
      flags = flags | Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE;
    }  
    persist.persistFlags = flags;
    var _innerCallback = null;
    if (thisObj && callback) {
      _innerCallback = function(result) { thisObj[callback].call(thisObj, result); }
    }
    /* Prepare progressListener and its callback */ 
    persist.progressListener = {
      _parentInstance: this,
      _unsuccessfulStart: false,
      callback: _innerCallback,
      onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
        if (aStateFlags & 1) {
         /* Process HTTP Errors
	        * nsIChannel will throw NS_ERROR_NOT_AVAILABLE when there is no connection
          * (even for requestSucceeded), so use the try-catch way  */
          var channel = aRequest.QueryInterface(Ci.nsIHttpChannel);
          try {
            if (channel.responseStatus != 200) {
              throw new Error();
            }
          } catch(e) {
            this._unsuccessfulStart = true;
          }
        }
        if (aStateFlags & 16) { /* STATE_STOP = 16 */
      	  if (this.callback) {
            this.callback(this._unsuccessfulStart);
          }
      	  this._parentInstance.completeDownload.call(this._parentInstance);
        }
      },
      onProgressChange: function() {},
      onLocationChange: function() {},
      onStatusChange: function() {},
      onSecurityChange: function() {},
    };
    /* Proceed download and store the instance */
    persist.saveURI(uri, null, refUri, postData, null, file);
    this.persists.push(persist);
  },
  /* Called when all needed download are added. */
  doneAdding: function() {
    this.adding = false;
    if (this.downloadCount == 0) {
      this.finalize();
    }
  },
  /* Cancel all of the downloads at once */
  cancelAll: function() {
    this.persists.forEach(function (element, index, array) {
      if (element) {
        array[index].cancelSave(); 
      }
    });
    delete(this.persists);
  },
  /* PRIVATE USE: */
  /* When one download completed, check if all of the downloads are completed */
  completeDownload: function() {
    this.downloadCount--;
    if (this.downloadCount == 0 && !this.adding) {
      this.finalize();
    }
  },
  /* After all downloads done.. */
  finalize: function() {
    delete(this.persists);
    this.doneCallback();
  },
};

/* Decode query string */
function decodeQueryString(queryString) {
  var undecodedParams = queryString.split("&");
  var params = {};
  /* Parse every part of the parameter */
  for (var i = 0; i < undecodedParams.length; i++) {
    let paramPair = undecodedParams[i].split("=");
    let key = decodeURIComponent(paramPair[0]);
    let value = decodeURIComponent(paramPair[1]);
    params[key] = value;
  }
  return params;
};

/* NicoDownloader is the downloader for Nico Nico Douga */
DownloadUtils.nico = function() { };
DownloadUtils.nico.prototype = {
  ms_lock: false,
  _loginTried: false,
  /* Is the download canceled? */
  _canceled: false,
  
  /* "File Bundle" for the download. */
  _fileBundle: null,
  /* Are all of the files to download created? */
  _filesCreated: false,
  /* Whether to download comment, uploader comment or thumbnail? */
  _getComment: false,
  _getUploaderComment: false,
  _getThumbnail: false,
  /* Store video download progress */
  _progressUpdatedAt: 0,
  _videoProgressUpdatedBytes: 0,
  _videoCurrentBytes: 0,
  _videoMaxBytes: 0,
  _extraItemsDownloader: null,
  
  /* Store /getflv/ result. */
  _getFlvParams: null,
  /* Store /getthreadkey/ result, this is a secret code used in channel/community videos (to prevent comment access?). */
  _getThreadKeyParams: null,
  /* Store the VideoInfoReader result */
  _info: null,
  
  /* Download item ID in database. Should be assigned from the outside */
  dbId: null,
  /* Is the video previous in the economy mode? Should be assigned from the outside. */
  previousAtEconomy: null,
  /* The download speed. */
  speed: 0,
  /* Last time remaining, calculated from DownloadManger */
  lastSec: Infinity,

  /* Initialize download for specific URL. */
  init: function(url) {
    Components.utils.reportError("Downloader Init!");
    this._getComment = Core.prefs.getBoolPref("download_comment");
    this._getThumbnail= Core.prefs.getBoolPref("download_thumbnail");
    
    /* Save the URL to the instance */
    this.url = url;
    /* Read video info again: The expiration of VideoInfoReader may match the expiration of video access on the site */
    Components.utils.import("resource://nicofox/VideoInfoReader.jsm");
    VideoInfoReader.readByUrl(this.url, false, this, "goParse", "failReadInfo");
  },
  /* After reading the video info, call getflv API to get necessary info like video URL and comment thread id.  */
  goParse: function(url, info) {
    /* Don't do anything if user had canceled */
    if (this._canceled) { return; }
    /* Record the thumbnail URL */
    this._info = info;

    /* Initialze the "File Bundle". If any files exists in the file bundle, give up download process. */
    Components.utils.import("resource://nicofox/FileBundle.jsm");
    this._fileBundle = new FileBundle.nico(info);
    if (this._fileBundle.occupied()) {
      showUtilsAlert(Core.strings.getString("errorTitle"), Core.strings.getString("errorFileExisted"));
      this.callback("fail", {});
      return;
    }
    /* Is there any uploader's comment? */
    this.uploder_comment = false;	
    if (info.hasOwnerThread && Core.prefs.getBoolPref("uploader_comment")) {
      this._getUploaderComment = true;
    }
    this.commentId = info.nicoData.v;
    this.videoId = info.nicoData.id;
    /* Prepare request URL. Use flapi for Japan site, per-site API for tw/de/es */
    var nonJapanMatch = /^http:\/\/(tw|de|es)/.exec(url);
    var requestUrl = "http://flapi.nicovideo.jp/api/getflv";
    if (nonJapanMatch) {
      requestUrl = "http://" + nonJapanMatch[1] + ".nicovideo.jp/api/getflv";
    }
    var postQueryString = "ts=" + new Date().getTime() + "&v=" + this.commentId;
    /* When encountering SWF vidoes, request &as3=1 on Japan site:
     * Maybe &as3=1 will hack the AVM1 SWF so that it can be loaded on new AS3-based player on Japan site.
     * Requesting &as3=1 on non-Japan sites (which are using AS2-based player) will trigger a 403 error. :( */
    if (this.videoId.indexOf("nm") == 0 && !nonJapanMatch) {
      postQueryString += "&as3=1";
    }
    /* Send request */
    Network.fetchUrlAsync(requestUrl, postQueryString, this, "parseGetFlv", "failParse");
  },

  /* Response for getflv request */
  parseGetFlv: function(url, responseText) {
    Components.utils.reportError("Downloader /getflv done!");
    /* Don't do anything if user had canceled */
    if (this._canceled) { return; }

    /* Due to the VideoInfoReader cache, we may find out we are not logged in here. */
    if (responseText.indexOf("closed=1") == 0) {
      if (!this._loginTried) {
        this._loginTried = true;
        Components.utils.import("resource://nicofox/NicoLogin.jsm");
        NicoLogin.perform(this, "retryAfterLogin", "failAutoLogin");
      } else {
        this.pause();
      }
      return;
    }

    /* Store getflv parameters for future use. */
    this._getFlvParams = decodeQueryString(responseText);
    /* :( for channel videos, we need to get the thread key */
    if (this._getFlvParams.needs_key) {
      Network.fetchUrlAsync("http://flapi.nicovideo.jp/api/getthreadkey?thread="+ this._getFlvParams.thread_id, null, this, "parseThreadKey", "failParse");
    } else {
      this.prepareDownload();
    }
  },
  /* Store the thread key after request. */
  parseThreadKey: function(url, responseText) {
    /* Don't do anything if user had canceled */
    if (this._canceled) { return; }
    this._getThreadKeyParams = decodeQueryString(responseText);
    this.prepareDownload();
  },
  /* After API parsing is fine, read info from API, prepare files, then start the download. */
  prepareDownload: function() {
    Components.utils.reportError(JSON.stringify(this._getFlvParams));
    /* Don't do anything if user had canceled */
    if (this._canceled) { return; }
    
    /* Distinguish Economy mode; if user don't want it, cancel the download */
    if (this._getFlvParams.url.search(/low$/) != -1) {
      if (Core.prefs.getIntPref("economy") == 1) {
        this.callback("economy_break", {video_title: this._info.nicoData.title});
        return;
      }	
      this._economy = true; 
    } else {
      this._economy = false;
      /* It has been a economy but now it's not! */
      if (this.previousAtEconomy) {
        this.callback("economy_off", {});
      }
    }
    
    /* Distinguish Video type from video URL. */
    if (this._getFlvParams.url.search(/smile\?s\=/) != -1) {
      this.videoType = "swf";
    } else if (this._getFlvParams.url.search(/smile\?m\=/) != -1) {
      this.videoType = "mp4";
    } else { this.videoType = "flv"; }
    this._fileBundle.setVideoType(this.videoType); 
    if (!this._fileBundle.createVideoTemp()) {
      showUtilsAlert(Core.strings.getString('errorTitle'), 'Cannot create the temp video file');
      this.callback('fail',{});
      return;
    }
    
    /* Prepare contents that need to be returned to the callback */
    var params = {};
    params.video_id = this._info.nicoData.id;
    params.comment_id = this._info.nicoData.v;
    params.comment_type = this._info.commentType;
    params.video_title = this._info.nicoData.title;
    params.video_file = this._fileBundle.files.video.path;
    params.video_economy = (this._economy)?1:0;
    params.video_type = this.videoType;
    if(this._getComment) { 
      params.comment_file = this._fileBundle.files.comment.path;
    }
    if(this._getUploaderComment) {
      params.uploader_comment_file = this._fileBundle.files.uploaderComment.path;
    }
    if(this._getThumbnail) {
      params.thumbnail_file = this._fileBundle.files.thumbnail.path;
    }
    this._filesCreated = true;
    /* Run the callback */
    this.callback("file_ready", params);
    /* Do video download first */
    this.getVideo();
  },
  /* Run Video Downloads. */
  getVideo: function() {
    /* Don't waste time */
    if (this._canceled) { return; }
    
    /* Make URI and cache key */
    var videoUri = Services.io.newURI(this._getFlvParams.url, null, null);

    this._persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].
                    createInstance(Ci.nsIWebBrowserPersist);

    /* Force allow 3rd party cookies, to make NicoFox work when 3rd party cookies are disabled. (Bug 437174) */
    var flags =  this._persist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                 this._persist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                 this._persist.PERSIST_FLAGS_FORCE_ALLOW_COOKIES |
                 this._persist.PERSIST_FLAGS_CLEANUP_ON_FAILURE;
    if (Core.prefs.getBoolPref("video_bypass_cache")) {
      flags = flags | this._persist.PERSIST_FLAGS_BYPASS_CACHE; 
    }
    this._persist.persistFlags = flags; 

    /* We need a listener to watch the download progress */
    var listener = {
      _parentInstance: this,
      _unsuccessfulStart: false,
      onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
        if (this._parentInstance._canceled) { return; }
        if (aStateFlags & 1) {
         /* Process HTTP Errors
	        * nsIChannel will throw NS_ERROR_NOT_AVAILABLE when there is no connection
          * (even for requestSucceeded), so use the try-catch way  */
          var channel = aRequest.QueryInterface(Ci.nsIHttpChannel);
          try {
            if (channel.responseStatus != 200) {
              Components.utils.reportError("Hit 403!");
              throw new Error();
            }
            this._parentInstance.callback("start", {});
          } catch(e) {
            this._unsuccessfulStart = true;
          }
        }
        else if (aStateFlags & 16) {
          /* Download failed. In this case, PERSIST_FLAGS_CLEANUP_ON_FAILURE will done the cleanup */
	        if (aStatus != 0 /* NS_OK */) {
            this._parentInstance.failVideoDownload();
            return;
          }
          /* Donwnload incompleted or connection error or initial response is 403. Will not clean up file, we should do it manually. */
          if (this._unsuccessfulStart || this._parentInstance._videoCurrentBytes != this._parentInstance._videoMaxBytes) {
            Components.utils.reportError("incomplete!");
            this._parentInstance.failVideoDownload();
            return;
          }
          /* Move finished file */
          this._parentInstance._fileBundle.files.videoTemp.moveTo(null, this._parentInstance._fileBundle.files.video.leafName);
          /* Proceed to get extra items */
          this._parentInstance.callback("video_done", {});
          this._parentInstance.getExtraItems();
        }
      },
      onProgressChange: function (aWebProgress, aRequest,
                                 aCurSelfProgress, aMaxSelfProgress,
                                 aCurTotalProgress, aMaxTotalProgress) {
        this._parentInstance._videoCurrentBytes = aCurSelfProgress;
        this._parentInstance._videoMaxBytes = aMaxSelfProgress;

        /* The following is modified from toolkit/components/downloads/nsDownloadManager.cpp: */
        /* Don't send the notification too frequently */
        var now = new Date().getTime();
        var delta = now - this._progressUpdatedAt;
        if (delta < 400) {
          return;
        }
        this._progressUpdatedAt = now;
        /* Calculate "smoothed average" speed. */
        if (delta > 0) {
          var newSpeed = (aCurSelfProgress - this._parentInstance._videoProgressUpdatedBytes) / delta * 1000;
          if (this._parentInstance._videoProgressUpdatedBytes == 0) {
            this._parentInstance.speed = newSpeed;
          } else {
            this._parentInstance.speed = this._parentInstance.speed * 0.9 + newSpeed * 0.1;
          }
        }
        /* Update the bytes when "Progres updated", then send the callback. */
        this._parentInstance._videoProgressUpdatedBytes = aCurSelfProgress;
        this._parentInstance.callback('progress_change', {currentBytes: aCurSelfProgress, maxBytes: aMaxSelfProgress});
      },
      onLocationChange: function (aWebProgress, aRequest, aLocation) {},
      onStatusChange  : function (aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange: function (aWebProgress, aRequest, aState) {},
    };
    this._progressUpdatedAt = new Date().getTime();
    this._persist.progressListener = listener;
    this._persist.saveURI(videoUri, null, null, null, null, this._fileBundle.files.videoTemp);

  },
  /* Call when video downloads failed */
  failVideoDownload: function() {
    this._canceled = true;
    if (this._fileBundle.files.videoTemp.exists()) {
      this._fileBundle.files.videoTemp.remove(false);
    }
    this.callback("video_fail", {});
  },
  /* Get extra items (e.g. comments, uploader comments, thumbnail) */
  getExtraItems: function() {
    if (this._canceled) {
      return;
    }
    if (!this._getComment && !this._getUploaderComment && !this._getThumbnail) {
      this.completeAll();
      return;
    }
    /* Fill the query string per thread key needed or not needed case */
    if (this._getFlvParams.needs_key) {
      var commentQueryString = 
      '<packet><thread thread="'+ this._getFlvParams.thread_id +'" version="20090904" user_id="'+this._getFlvParams.user_id+'" threadkey="'+this._getThreadKeyParams.threadkey+'" force_184="'+this._getThreadKeyParams.force_184+'"/><thread_leaves thread="'+ this._getFlvParams.thread_id +'" user_id="'+this._getFlvParams.user_id+'"  threadkey="'+this._getThreadKeyParams.threadkey+'" force_184="'+this._getThreadKeyParams.force_184+'">0-'+ Math.ceil(this._info.nicoData.length / 60) +':100</thread_leaves></packet>';
      var uploaderCommentQueryString =
      '<thread click_revision="0" fork="1" user_id="'+this._getFlvParams.user_id+'" res_from="-1000" version="20061206" thread="'+this._getFlvParams.thread_id+'"/>';
    } else {
      var commentQueryString = '<packet>'+
      '<thread click_revision="0" user_id="'+this._getFlvParams.user_id+'" res_from="-1000" version="20061206" thread="'+this._getFlvParams.thread_id+'"/>'+
      '</packet>';
      var uploaderCommentQueryString = 
      '<thread click_revision="0" fork="1" user_id="'+this._getFlvParams.user_id+'" res_from="-1000" version="20061206" thread="'+this._getFlvParams.thread_id+'"/>';
    }
    /* Get all extra items */
    this._extraItemsDownloader = new DownloadUtils.multipleHelper(this, "completeAll");
    if(this._getComment) {
      this._extraItemsDownloader.addDownload(this._getFlvParams.ms, null , commentQueryString, this._fileBundle.files.comment, true, this, "processNicoComment");
    }
    if(this._getUploaderComment) {
      this._extraItemsDownloader.addDownload(this._getFlvParams.ms, null , uploaderCommentQueryString, this._fileBundle.files.uploaderComment, true);
    }
    if(this._getThumbnail && this._info.nicoData.thumbnail) {
      this._extraItemsDownloader.addDownload(this._info.nicoData.thumbnail, null , null, this._fileBundle.files.thumbnail, true, this, "notifyThumbnailDone");
    }
    this._extraItemsDownloader.doneAdding();
  },

  completeAll: function() {
    this.callback("completed", {"videoBytes":  this._videoMaxBytes});
  },
  failReadInfo: function(reason) {
    /* VideoInfoReader will report a reason. */
    if (reason == "notloggedin" && !this._loginTried) {
      this._loginTried = true;
      Components.utils.import("resource://nicofox/NicoLogin.jsm");
      NicoLogin.perform(this, "retryAfterLogin", "failAutoLogin");
    } else if (reason == "notloggedin") {
      showUtilsAlert(Core.strings.getString("errorTitle"), Core.strings.getString("errorParseFailed"));
      this.pause();
    } else if (reason == "antiflood") {
      showUtilsAlert(Core.strings.getString("errorTitle"), Core.strings.getString("errorAntiFlood"));
      this.pause();
    } else if (reason == "unavailable") {
      this.pause();
    } else {
      showUtilsAlert('Download failed', 'Cannot render the API/page to get the download location.');
      this.callback("fail", {});
    }
  },
  /* XXX: autologin */
  retryAfterLogin: function() {
    /* Retry after autologin */
    VideoInfoReader.readByUrl(this.url, false, this, "goParse", "failReadInfo");
  },
  failAutoLogin: function() {
    showUtilsAlert(Core.strings.getString("errorTitle"), Core.strings.getString("errorParseFailed"));
    this.pause();
  },
  failParse: function(reason) {
    showUtilsAlert('Download failed', 'Cannot render the API/page to get the download location.');
    this.callback("fail", {});
  },
  /* Cancel this download, then notify the callback to pause all downloads due to site connection problem */
  pause: function() {
    this._canceled = true;

    if(this._persist != undefined) {
      this._persist.cancelSave();
    }
    if (this._extraItemsDownloader) {
      this._extraItemsDownloader.cancelAll();
      this.removeFiles();
    }

    this.callback("pause",{});
  },
  /* Cancel by download manager action */
  cancel: function() {
    this._canceled = true;

    if(this._persist != undefined) {
      this._persist.cancelSave();
    }
    if (this._extraItemsDownloader) {
      this._extraItemsDownloader.cancelAll();
      this.removeFiles();
    }
    this.callback("cancel",{});
  },

  /* Remove all downloaded files */
  removeFiles: function() {
    if (!this._filesCreated || !this._fileBundle) { return; }
    /* Remove files */
    if (this._fileBundle.files.video.exists()) this._fileBundle.files.video.remove(false);
    if (this._fileBundle.files.videoTemp.exists()) this._fileBundle.files.videoTemp.remove(false);
    if(this._getComment && this._fileBundle.files.comment.exists()) { 
        this._fileBundle.files.comment.remove(false);
    }
    if(this._getUploaderComment && this._fileBundle.files.uploaderComment.exists()) { 
        this._fileBundle.files.uploaderComment.remove(false);
    }
    if(this._getThumbnail && this._fileBundle.files.thumbnail.exists()) { 
        this._fileBundle.files.thumbnail.remove(false);
    }
  },
  /* When thumbnail file is done downloading, notify it (so the manager UI can display the thumbnail) */
  notifyThumbnailDone: function() {
    if (this._fileBundle.files.thumbnail) {
      this.callback("thumbnail_done", Services.io.newFileURI(this._fileBundle.files.thumbnail).spec);
    }
  },
  /* Add <!--BoonSutazioData=Video.v --> to file, make BOON Player have ability to update; filter replace support */
  processNicoComment: function() {
    if (this.cancelled) { return; }
    var boon_comment = Core.prefs.getBoolPref('boon_comment');
    var replace_filters = Core.prefs.getBoolPref('replace_filters'); 
    if (!boon_comment && !replace_filters) { return; }

    if (replace_filters && this._getFlvParams.ng_up) {
      var ng_ups = this._getFlvParams.ng_up.split('&');

      var filter_matches = [];
      var filter_strings = [];
      var filter_replaces = [];
      for (var i = 0; i < ng_ups.length; i++) {
        var array = ng_ups[i].split('=');
	var target = decodeURIComponent(array[0]).replace(/([\\\^\$\*\+\?\.\(\)\:\?\=\!\|\{\}\,\[\]])/g, '\\$1');
	var match = new RegExp(target, 'g'); // Case-sensitive
	filter_strings.push(decodeURIComponent(array[0]));
        filter_matches.push(match);
        filter_replaces.push(decodeURIComponent(array[1]));
      }
    }

    this.ms_lock = true;
    var xml_contents = "";
    var charset = 'UTF-8';
    var fistream = Cc["@mozilla.org/network/file-input-stream;1"]
                  .createInstance(Ci.nsIFileInputStream);
    fistream.init(this._fileBundle.files.comment, -1, 0, 0);
    var is = Cc["@mozilla.org/intl/converter-input-stream;1"]
             .createInstance(Ci.nsIConverterInputStream);
    is.init(fistream, charset, 1024, 0xFFFD);

    /* FIXME: Should we have a process of error prevent? */
    if (!(is instanceof Components.interfaces.nsIUnicharLineInputStream)) { return; }

    var line = {};
    var xml_string = '';
    var first_line = true;
    var no_eof;
    do {
      no_eof = is.readLine(line);
      if(first_line) {
        /* For E4X Parsing, we will need partial of the first line */
        first_line = false;
	line.value = line.value.replace(/^(<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>)/, '');
      }

      xml_string = xml_string + line.value + "\n";
    } while (no_eof)
    	
    is.close();
    fistream.close();

    if (replace_filters && this._getFlvParams.ng_up) {

      /* Go E4X and filter */
      var xml_e4x = new XML(xml_string);
      if (xml_e4x.chat) {
        for (var i = 0; i < xml_e4x.chat.length(); i++) {
          for (var j = 0; j < filter_strings.length; j++) {
	    if (xml_e4x.chat[i].toString().indexOf(filter_strings[j]) != -1) {
              xml_e4x.chat[i] = xml_e4x.chat[i].toString().replace(filter_matches[j], filter_replaces[j]);
	    }  
          }  
        }
      }
      xml_string = xml_e4x.toXMLString();
    }  
    /* Write back to XML file */
    var fostream = Cc["@mozilla.org/network/file-output-stream;1"]
                   .createInstance(Components.interfaces.nsIFileOutputStream);
    fostream.init(this._fileBundle.files.comment, 0x02 | 0x08 | 0x20, 0666, 0); 


    var os = Cc["@mozilla.org/intl/converter-output-stream;1"]
             .createInstance(Ci.nsIConverterOutputStream);

    os.init(fostream, charset, 0, 0x0000);
    if (boon_comment) {
      os.writeString('<?xml version="1.0" encoding="UTF-8"?><!-- BoonSutazioData='+this.commentId+' -->'+"\n");
    } else {
      os.writeString('<?xml version="1.0" encoding="UTF-8"?>'+"\n");
    }
    os.writeString(xml_string);
    os.close();
    fostream.close();
    this.ms_lock = false;
  },

};

/* A simple wrapper to nsIAlertsService */
function showUtilsAlert(title, msg) {
  var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alertsService.showAlertNotification("chrome://nicofox/skin/logo.png",
                                      title, msg,
                                      false, "", null);
};
