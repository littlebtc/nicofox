/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Handle download process for video elements (vidoe, comments, thumbnails, ... etc)
 * This script is currently site-specific. Replace download_helper.js and download_helper_nico.js in previous versions.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "DownloadUtils" ];
let DownloadUtils = {};

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://nicofox/Core.jsm");
Components.utils.import("resource://nicofox/Network.jsm");
Components.utils.import("resource://nicofox/FileBundle.jsm");
Components.utils.import("resource://nicofox/When.jsm");

/* A when.js promise wrapper to the nsIWebBrowserPersist
 * @param options  Options for the persist, includes:
 *                 url             - The URL to be persisted.
 *                 referrer        - The referrer to be sent.
 *                 postQueryString - The query string for POST request in string
 *                                   If not present, download will be a GET request.
 *                 file            - The nsIFile instance for the destination of the file.
 *                 bypassCache     -    Whether to bypass the cached content
 * */
var persistWorker = function(options) {
  /* Generate nsIURIs */
  var refURI = null;
  if (options.referrer) {
    refURI = Services.io.newURI(options.referrer, null, null);
  }
  var URI = Services.io.newURI(options.url, null, null);

  this._persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);

  /* Force allow 3rd party cookies, to make NicoFox work when 3rd party cookies are disabled. (Bug 437174) */
  var flags =  this._persist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
               this._persist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
               this._persist.PERSIST_FLAGS_FORCE_ALLOW_COOKIES |
               this._persist.PERSIST_FLAGS_CLEANUP_ON_FAILURE;
  if (options.bypassCache) {
    flags = flags | this._persist.PERSIST_FLAGS_BYPASS_CACHE;
  }
  this._persist.persistFlags = flags;
  /* POST header processing */
  var postData = null;
  if (options.postQueryString) {
    var postStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);
    postStream.setData(options.postQueryString, options.postQueryString.length); // Brokes 1.8.*- compatibility

    postData = Cc["@mozilla.org/network/mime-input-stream;1"].createInstance(Ci.nsIMIMEInputStream);

    postData.addHeader("Content-Type", "application/x-www-form-urlencoded");
    postData.addContentLength = true;
    postData.setData(postStream);
  }
  /* Create a cancelable deferred */
  this._deferred = When.cancelable(When.defer(), this.onDeferredCanceled.bind(this));
  if (options.trackProgress) {
    this._trackProgress = true;
  }
  /* Export then and cancel */
  this.then = this._deferred.promise.then;
  this.cancel = this._deferred.cancel;
  /* Do the job; An extra null due to bug 794602
   * XXX: Private browsing aware */
  this._persist.progressListener = this;
  try {
    this._persist.saveURI(URI, null, refURI, postData, null, options.file, null);
  } catch(e) {
    // Workaround for Firefox 36.
    // Though there may be a lot of reason that saveURI throws,
    // but it should work well in both older and newer version.
    this._persist.saveURI(URI, null, refURI, null, postData, null, options.file, null);
  }
};

/* Implements nsIWebProgressListener */
persistWorker.prototype.onStateChange = function (aWebProgress, aRequest, aStateFlags, aStatus) {
  if (aStateFlags & 1) {
    /* Check and process HTTP Errors
	   * nsIChannel will throw NS_ERROR_NOT_AVAILABLE when there is no connection
     * (even for requestSucceeded), so use the try-catch way  */
    var channel = aRequest.QueryInterface(Ci.nsIHttpChannel);
    try {
      if (channel.responseStatus != 200) {
        this._deferred.resolver.reject("httpError");
        return;
     }
    } catch(e) {
      this._unsuccessfulStart = true;
      this._deferred.resolver.reject("connectionError");
      return;
    }
  } else if (aStateFlags & 16) {
    if (this._unsuccessfulStart) { return; }
    /* Download failed. In this case, PERSIST_FLAGS_CLEANUP_ON_FAILURE will done the cleanup */
	  if (aStatus != 0 /* NS_OK */) {
      this._deferred.resolver.reject("fail");
      return;
    }
    /* Donwnload incompleted or connection error or initial response is 403. Will not clean up file, we should do it manually. */
    if (this._currentBytes != this._maxBytes) {
      this._deferred.resolver.reject("incomplete");
      return;
    }
    this._deferred.resolver.resolve(this._maxBytes);
  }
};
persistWorker.prototype.onProgressChange = function (aWebProgress, aRequest,
                                                     aCurSelfProgress, aMaxSelfProgress,
                                                     aCurTotalProgress, aMaxTotalProgress) {
  if (!this._trackProgress) { return; }
  this._currentBytes = aCurSelfProgress;
  this._maxBytes = aMaxSelfProgress;
  this._deferred.resolver.progress({currentBytes: this._currentBytes, maxBytes: this._maxBytes});
};

persistWorker.prototype.onLocationChange = function() {};
persistWorker.prototype.onStatusChange = function() {};
persistWorker.prototype.onSecurityChange = function() {};

/* Call cancelSave on persist when deferred is canceled. */
persistWorker.prototype.onDeferredCanceled = function() {
  this._persist.cancelSave();
};

/* Export persistWorker (thumbnailFetcher at DownloadManager.jsm will need this) */
DownloadUtils.persistWorker = persistWorker;

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
  _getCommentZhTw: false,
  _getCommentEnUs: false,
  _getUploaderComment: false,
  _getThumbnail: false,
  /* Store video download progress */
  _progressUpdatedAt: 0,
  _videoDownloadWorker: null,
  _videoProgressUpdatedBytes: 0,
  _videoBytes: 0,

  /* Promises for extra items */
  _extraItemPromises: [],
  /* Listener bind() storage */
  _xhrBoundedListeners: {},

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
    this._getComment = Core.prefs.getBoolPref("download_comment");
    this._getCommentZhTw = Core.prefs.getBoolPref("download_comment_zh-tw");
    this._getCommentEnUs = Core.prefs.getBoolPref("download_comment_en-us");
    this._getThumbnail = Core.prefs.getBoolPref("download_thumbnail");
    
    /* Save the URL to the instance */
    this.url = url;
    /* Read video info again if cache is not expired */
    if (this._cachedInfo && new Date().getTime() - this._cachedInfo.loadTime < 60000) {
      return this.goParse(this._cachedInfo);
    } else {
      Components.utils.import("resource://nicofox/VideoInfoReader.jsm");
      VideoInfoReader.readByUrl(this.url, false).then(this.goParse.bind(this), this.failReadInfo.bind(this));
      return true;
    }
  },
  /* After reading the video info, call getflv API to get necessary info like video URL and comment thread id.  */
  goParse: function(info) {
    var url = info.url;
    /* Don't do anything if user had canceled */
    if (this._canceled) { return false; }
    /* Record the thumbnail URL */
    this._info = info;

    /* Initialze the "File Bundle". If any files exists in the file bundle, give up download process. */
    Components.utils.import("resource://nicofox/FileBundle.jsm");
    this._fileBundle = new FileBundle.nico(info);
    if (this._fileBundle.occupied()) {
      showUtilsAlert(Core.strings.getString("errorTitle"), Core.strings.getString("errorFileExisted"));
      this.callback("fail", {});
      return false;
    }
    /* Is there any uploader's comment? */
    this.uploder_comment = false;	
    if (info.hasOwnerThread && Core.prefs.getBoolPref("uploader_comment")) {
      this._getUploaderComment = true;
    }
    this.commentId = info.nicoData.v;
    this.videoId = info.nicoData.id;

    /* My memory has no comment variants. So download comment if comment from any language is selected.
     * XXX: Did we need to distingush the comment variant? */
    if (info.nicoData.isMymemory) {
      var getComment = this._getComment || this._getCommentZhTw || this._getCommentEnUs;
      this._getComment = getComment;
      this._getCommentZhTw = false;
      this._getCommentEnUs = false;
    }

    var requestUrl = "http://flapi.nicovideo.jp/api/getflv";
    var postQueryString = "ts=" + new Date().getTime() + "&v=" + this.videoId;
    /* When encountering SWF vidoes, request &as3=1 on Japan site:
     * &as3=1 may hack the AVM1 SWF so that it can be loaded on new AS3-based player on Japan site. */
    if (this.videoId.indexOf("nm") == 0) {
      postQueryString += "&as3=1";
    }
    /* Send request */
    Network.fetchUrlAsync(requestUrl, postQueryString).then(this.parseGetFlv.bind(this), this.failParse.bind(this));
    return true;
  },

  /* Response for getflv request */
  parseGetFlv: function(result) {
    /* Don't do anything if user had canceled */
    if (this._canceled) { return; }

    var content = result.data;

    /* Due to the VideoInfoReader cache, we may find out we are not logged in here. */
    if (content.indexOf("closed=1") == 0) {
      if (!this._loginTried) {
        this._loginTried = true;
        Components.utils.import("resource://nicofox/NicoLogin.jsm");
        NicoLogin.perform().then(this.retryAfterLogin.bind(this), this.failAutoLogin.bind(this));
      } else {
        this.pause();
      }
      return;
    }

    /* Store getflv parameters for future use. */
    this._getFlvParams = decodeQueryString(content);
    /* :( for channel videos, we need to get the thread key */
    if (this._getFlvParams.needs_key) {
      Network.fetchUrlAsync("http://flapi.nicovideo.jp/api/getthreadkey?thread="+ this._getFlvParams.thread_id, null).then(this.parseThreadKey.bind(this), this.failParse.bind(this));
    } else {
      this.prepareDownload();
    }
  },
  /* Store the thread key after request. */
  parseThreadKey: function(result) {
    /* Don't do anything if user had canceled */
    if (this._canceled) { return; }
    this._getThreadKeyParams = decodeQueryString(result.data);
    this.prepareDownload();
  },
  /* After API parsing is fine, read info from API, prepare files, then start the download. */
  prepareDownload: function() {
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
    var commentVariants = [];
    if(this._getComment) {
      params.comment_file = this._fileBundle.files.comment.path;
      commentVariants.push("ja");
    }
    // Older version compatibility: when only comments from other language were downloaded,
    // use it in the comment_file field.
    // Need to handle other cases like re-downloading comments if is is implemented.
    if(this._getCommentZhTw) {
      if (!this._getComment) {
        params.comment_file = this._fileBundle.files.commentZhTw.path;
      }
      commentVariants.push("zh-tw");
    }
    if(this._getCommentEnUs) {
      // Older version compatibility: when only zh-TW comments were downloaded, use it in the comment_file field.
      // Need to handle other cases like re-downloading comments if is is implemented.
      if (!this._getComment && !params.comment_file) {
        params.comment_file = this._fileBundle.files.commentEnUs.path;
      }
      commentVariants.push("en-us");
    }
    if(this._getUploaderComment) {
      params.uploader_comment_file = this._fileBundle.files.uploaderComment.path;
    }
    if(this._getThumbnail) {
      params.thumbnail_file = this._fileBundle.files.thumbnail.path;
    }
    // Write all comment variants into the info field.
    params.info = JSON.stringify({ "comment_variants": commentVariants });
    this._filesCreated = true;
    /* Run the callback */
    this.callback("file_ready", params);

    /* Store a timestamp for used in speed reporting */
    this._progressUpdatedAt = new Date().getTime();
    /* Create a runner to do video downloads */
    this._videoDownloadWorker = new persistWorker({ url: this._getFlvParams.url, file: this._fileBundle.files.videoTemp,
                                                  bypassCache: Core.prefs.getBoolPref("video_bypass_cache"), trackProgress: true });
    this._videoDownloadWorker.then(this.onVideoDownloadCompleted.bind(this), this.onVideoDownloadFailed.bind(this), this.onVideoDownloadProgress.bind(this));
  },
  onVideoDownloadCompleted: function(videoBytes) {
    /* Record video size for future uses */
    this._videoBytes = videoBytes;
    /* Move finished file */
    this._fileBundle.files.videoTemp.moveTo(null, this._fileBundle.files.video.leafName);
    /* Proceed to get extra items */
    this.callback("video_done", {});
    this.getExtraItems();
  },
  /* Call when video downloads failed */
  onVideoDownloadFailed: function() {
    /* If it is because the download had been canceled, do nothing */
    if (this._canceled) {
      return;
    }
    this._canceled = true;
    if (this._fileBundle.files.videoTemp.exists()) {
      this._fileBundle.files.videoTemp.remove(false);
    }
    this.callback("video_fail", {});
  },
  onVideoDownloadProgress: function(progress) {
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
      var newSpeed = (progress.currentBytes - this._videoProgressUpdatedBytes) / delta * 1000;
      if (this._videoProgressUpdatedBytes == 0) {
        this.speed = newSpeed;
      } else {
        this.speed = this.speed * 0.9 + newSpeed * 0.1;
      }
    }
    /* Update the bytes when "Progres updated", then send the callback. */
    this._videoProgressUpdatedBytes = progress.currentBytes;
    this.callback("progress_change", progress);
  },
  /* Get extra items (e.g. comments, uploader comments, thumbnail) */
  getExtraItems: function() {
    if (this._canceled) {
      return;
    }
    /* Fill the query string per thread key needed or not needed case */
    if (this._getFlvParams.needs_key) {
      var commentQueryString = 
      '<packet><thread thread="'+ this._getFlvParams.thread_id +'" version="20090904" user_id="'+this._getFlvParams.user_id+'" threadkey="'+this._getThreadKeyParams.threadkey+'" force_184="'+this._getThreadKeyParams.force_184+'"/><thread_leaves thread="'+ this._getFlvParams.thread_id +'" user_id="'+this._getFlvParams.user_id+'"  threadkey="'+this._getThreadKeyParams.threadkey+'" force_184="'+this._getThreadKeyParams.force_184+'">0-'+ Math.ceil(this._info.nicoData.length / 60) +':100</thread_leaves></packet>';
      var commentZhTwQueryString =
      '<packet><thread thread="'+ this._getFlvParams.thread_id +'" version="20061206" res_from="-250" user_id="'+this._getFlvParams.user_id+'" threadkey="'+this._getThreadKeyParams.threadkey+'" force_184="'+this._getThreadKeyParams.force_184+'" language="2"/></packet>';
      var commentEnUsQueryString =
      '<packet><thread thread="'+ this._getFlvParams.thread_id +'" version="20061206" res_from="-250" user_id="'+this._getFlvParams.user_id+'" threadkey="'+this._getThreadKeyParams.threadkey+'" force_184="'+this._getThreadKeyParams.force_184+'" language="1"/></packet>';
      var uploaderCommentQueryString =
      '<thread click_revision="0" fork="1" user_id="'+this._getFlvParams.user_id+'" res_from="-1000" version="20061206" thread="'+this._getFlvParams.thread_id+'"/>';
    } else {
      var commentQueryString = '<packet>'+
      '<thread click_revision="0" user_id="'+this._getFlvParams.user_id+'" res_from="-1000" version="20061206" thread="'+this._getFlvParams.thread_id+'"/>'+
      '</packet>';
      var commentZhTwQueryString = '<packet>'+
      '<thread click_revision="0" user_id="'+this._getFlvParams.user_id+'" res_from="-1000" version="20061206" thread="'+this._getFlvParams.thread_id+'" language="2"/>'+
      '</packet>';
      var commentEnUsQueryString = '<packet>'+
      '<thread click_revision="0" user_id="'+this._getFlvParams.user_id+'" res_from="-1000" version="20061206" thread="'+this._getFlvParams.thread_id+'" language="1"/>'+
      '</packet>';
      var uploaderCommentQueryString = 
      '<thread click_revision="0" fork="1" user_id="'+this._getFlvParams.user_id+'" res_from="-1000" version="20061206" thread="'+this._getFlvParams.thread_id+'"/>';
    }
    /* Get all extra items */
    this._extraItemPromises = [];
    /* Because we may need to modify the content in the comment XML file, use nsIXMLHttpRequest to get contents and process it. */
    /* TODO: Don't parse to XML if none of the contents need to be overwritten for performance */
    if(this._getComment) {
      var xhrDeferred = Network.fetchXml(this._getFlvParams.ms, commentQueryString);
      this._extraItemPromises.push(xhrDeferred.then(this.processNicoComment.bind(this, "ja")));
    }
    if(this._getCommentZhTw) {
      var xhrDeferredZhTw = Network.fetchXml(this._getFlvParams.ms, commentZhTwQueryString);
      this._extraItemPromises.push(xhrDeferredZhTw.then(this.processNicoComment.bind(this, "zh-tw")));
    }
    if(this._getCommentEnUs) {
      var xhrDeferredEnUs = Network.fetchXml(this._getFlvParams.ms, commentEnUsQueryString);
      this._extraItemPromises.push(xhrDeferredEnUs.then(this.processNicoComment.bind(this, "en-us")));
    }
    if(this._getUploaderComment) {
      this._extraItemPromises.push(new persistWorker({ url: this._getFlvParams.ms, file: this._fileBundle.files.uploaderComment, postQueryString: uploaderCommentQueryString }));
    }
    if(this._getThumbnail && this._info.nicoData.thumbnail) {
      this._extraItemPromises.push(new persistWorker({ url: this._info.nicoData.thumbnail, file: this._fileBundle.files.thumbnail }));
    }
    When.all(this._extraItemPromises).then(this.onExtraItemsCompleted.bind(this), this.onExtraItemsFailed.bind(this));
  },
  /* Tell the callback that we had done everything. */
  onExtraItemsCompleted: function() {
    if (this._getThumbnail) {
      this.callback("thumbnail_done", Services.io.newFileURI(this._fileBundle.files.thumbnail).spec);
    }
    this.callback("completed", {"videoBytes":  this._videoBytes});
  },
  /* XXX: Handle this better */
  onExtraItemsFailed: function() {
    /* If it is because the download had been canceled, do nothing */
    if (this._canceled) {
      return;
    }
    this.cancelAllWorkers();
    this.removeFiles();
    showUtilsAlert('Download failed', 'Cannot get extra items');
    this.callback("fail", {});
  },
  failReadInfo: function(reason) {
    /* VideoInfoReader will report a reason. */
    if (reason == "notloggedin" && !this._loginTried) {
      this._loginTried = true;
      Components.utils.import("resource://nicofox/NicoLogin.jsm");
      NicoLogin.perform().then(this.retryAfterLogin.bind(this), this.failAutoLogin.bind(this));
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
    VideoInfoReader.readByUrl(this.url, false).then(this.goParse.bind(this), this.failReadInfo.bind(this));
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
    this.cancelAllWorkers();
    this.removeFiles();
    this.callback("pause", {});
  },
  /* Cancel by download manager action */
  cancel: function() {
    this._canceled = true;
    this.cancelAllWorkers();
    this.removeFiles();
    this.callback("cancel", {});
  },
  /* Cancel all promise workers and deferreds. */
  cancelAllWorkers: function() {
    /* If extra items are working, just cancel them */
    if (this._extraItemPromises.length > 0) {
      for (var i = 0; i < this._extraItemPromises.length; i++) {
        var item = this._extraItemPromises[i];
        if (item.cancel) {
          /* When.js will throw error for completed promises, ignore them */
          try {
            item.cancel();
          } catch(e) {
          }
        }
      }
    } else if(this._videoDownloadWorker) {
      /* If not extra items are not touched, try to cancel the video download */
      this._videoDownloadWorker.cancel();
    }
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
    if(this._getCommentZhTw && this._fileBundle.files.commentZhTw.exists()) {
        this._fileBundle.files.commentZhTw.remove(false);
    }
    if(this._getCommentEnUs && this._fileBundle.files.commentEnUs.exists()) {
        this._fileBundle.files.commentEnUs.remove(false);
    }
    if(this._getUploaderComment && this._fileBundle.files.uploaderComment.exists()) { 
        this._fileBundle.files.uploaderComment.remove(false);
    }
    if(this._getThumbnail && this._fileBundle.files.thumbnail.exists()) { 
        this._fileBundle.files.thumbnail.remove(false);
    }
  },
  /* Add <!--BoonSutazioData=Video.v --> to file, make BOON Player have ability to update; filter replace support */
  processNicoComment: function(variant, result) {
    if (this._canceled) { return; }
    var commentsDoc = result.xml;
    var boonComment = Core.prefs.getBoolPref('boon_comment');
    var replaceFilters = Core.prefs.getBoolPref('replace_filters');

    /* Parse the filter contents. */
    if (replaceFilters && this._getFlvParams.ng_up) {
      var ngUps = this._getFlvParams.ng_up.split('&');
      var filterFinds = [];
      var filterReplaceWiths = [];
      for (var i = 0; i < ngUps.length; i++) {
        var filterPair = ngUps[i].split('=');
	      filterFinds.push(decodeURIComponent(filterPair[0]));
        filterReplaceWiths.push(decodeURIComponent(filterPair[1]));
      }
      /* Transversal DOM tree and find string to be replaced. */
      var chatNodes = commentsDoc.getElementsByTagName("chat");
      for (var i = 0; i < chatNodes.length; i++) {
        var chatNode = chatNodes[i];
        var chatContent = chatNode.textContent;
        for (var j = 0; j < filterFinds.length; j++) {
          if (chatContent.indexOf(filterFinds[j]) != -1) {
            chatContent = chatContent.replace(filterFinds[j], filterReplaceWiths[j], "g");
          }
          chatNode.textContent = chatContent;
        }
      }
    }
    /* Prepand XML declaration, add BoonSutazioData comments if boon_comment is enabled */
    if (boonComment) {
      var boonCommentNode = commentsDoc.createComment(" BoonSutazioData="+this.commentId+" ");
      commentsDoc.insertBefore(boonCommentNode, commentsDoc.firstChild);
    }
    var xmlSerializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);
    var content = xmlSerializer.serializeToString(commentsDoc);
    /* Prepare the input/output stream to write back to file */
    var commentFile = this._fileBundle.files.comment;
    if (variant == "zh-tw") {
      commentFile = this._fileBundle.files.commentZhTw;
    } else if (variant == "en-us") {
      commentFile = this._fileBundle.files.commentEnUs;
    }
    var outputStream = FileUtils.openSafeFileOutputStream(commentFile);
    var os = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
    var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    converter.charset = "utf-8";
    var inputStream = converter.convertToInputStream(content);

    /* Write file asynchronously, then return the deferred object */
    var deferred = When.defer();
    NetUtil.asyncCopy(inputStream, outputStream, function(aResult) {
      if (!Components.isSuccessCode(aResult)) {
        deferred.resolver.reject('comment_write_error');
        return;
      }
      deferred.resolver.resolve();
    });
    return deferred.promise;
  },
};

/* A simple wrapper to nsIAlertsService */
function showUtilsAlert(title, msg) {
  var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alertsService.showAlertNotification("chrome://nicofox/skin/logo.png",
                                      title, msg,
                                      false, "", null);
};
