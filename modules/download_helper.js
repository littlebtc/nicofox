
var Cc = Components.classes;
var Ci = Components.interfaces;
var EXPORTED_SYMBOLS = ['DownloadUtils'];

Components.utils.import('resource://nicofox/common.js');

/* Multiple downloads helper, for simultaneously handle multiple persist without progress checking 
   XXX: file checks
*/

if (!nicofox) { var nicofox = {}; }
if (!nicofox.download) { nicofox.download = {}; }

DownloadUtils = {};

DownloadUtils.multiple = function() { }
DownloadUtils.multiple.prototype = {
  persists: [],
  files: [],
  adding: true,
  download_count: 0,
  doneCallback: function() {},
  /* Add a download. NOTE: file should be a nsIFile, not a string!! */
  addDownload: function(dl_url, referrer, post_string, file, bypass_cache, single_callback) {
    this.download_count++;
    if (referrer) {
      var ref_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
                    .newURI(referrer, null, null);
    } else {
      var ref_uri = null;
    }
    var dl_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(dl_url, null, null);

    /* POST header processing */
    if (post_string) { 
      var post_stream = Cc["@mozilla.org/io/string-input-stream;1"]
                       .createInstance(Ci.nsIStringInputStream);
      post_stream.setData(post_string, post_string.length); // NicoFox 0.3+ support Gecko/XULRunner 1.9+ only

      var post_data = Cc["@mozilla.org/network/mime-input-stream;1"]
                     .createInstance(Ci.nsIMIMEInputStream);
  
      post_data.addHeader("Content-Type", "application/x-www-form-urlencoded");
      post_data.addContentLength = true;
      post_data.setData(post_stream);
    } else {
      post_data = null;
    }
    var persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
    var flags =  Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    if (bypass_cache) {
      flags = flags | Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE;
    }  
    persist.persistFlags = flags; 

    if (!single_callback || typeof single_callback != 'function') {
      single_callback = function() {};
    } 
    var _this = this;
    persist.progressListener = {
      callback: single_callback,
      onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
        if (aStateFlags & 16) /* STATE_STOP = 16 */ {
	  this.callback();
	  nicofox.hitch(_this, 'completeDownload')();
        }
      },
      onProgressChange: function (aWebProgress, aRequest,
                                  aCurSelfProgress, aMaxSelfProgress,
                                  aCurTotalProgress, aMaxTotalProgress) {},
      onLocationChange: function (aWebProgress, aRequest, aLocation) {},
      onStatusChange  : function (aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange: function (aWebProgress, aRequest, aState) {},
    };

    persist.saveURI(dl_uri, null, ref_uri, post_data, null, file);
    this.persists.push(persist);
  },
  goAhead: function() {
    this.adding = false;
    if (this.download_count == 0) {
      this.finalize();
    }
  },
  completeDownload: function() {
    this.download_count--;
    if (this.download_count == 0 && !this.adding) {
      this.finalize();
    }
  },
  finalize: function() {
    this.doneCallback();
  },
  cancelAll: function() {
   this.persists.forEach(function (element, index, array) {
     if (element) {
       array[index].cancelSave(); 
     }
   });
  }
}
/* Finally import modules that we need */
Components.utils.import('resource://nicofox/download_helper_nico.js', DownloadUtils);
//Components.utils.import('resource://nicofox/download_helper_parasite.js');
//Components.utils.import('resource://nicofox/download_helper_keytalks.js');
