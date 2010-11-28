/* vim: sw=2 ts=2 sts=2 et filetype=javascript 
 *
 * Use Content Policy to watch the download manager URL (?smilefox=get) or Nicowa (Used for Nicowa blocker)
 * Code originally referenced from IE tab & Greasemonkey
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const CONTRACT_ID = "@littleb.tc/nicowatcher;1";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function NicoWatcher() {
  this.wrappedJSObject = this;
}

NicoWatcher.prototype = {
  classDescription: "URL Loading Watcher for NicoFox",
  classID: Components.ID("62ca6b17-975f-4c70-b497-33146a16c797"),
  contractID: CONTRACT_ID,
  _xpcom_categories: [
    { category: "content-policy" },
  ],
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPolicy, Ci.nsIObserver, Ci.nsIWeakReference]),
  _nicowaBlocker: null,
  /* Implements nsIContentPolicy */
  shouldLoad: function(contentType, contentLocation, requestOrigin, requestingNode, mimeTypeGuess, extra) {
    if (this._nicowaBlocker === null) { this._initPref(); }
    /* Sometimes there will be a ?smilefox=get request from the <iframe> of thumbnail */
    if (contentType == Ci.nsIContentPolicy.TYPE_DOCUMENT ||
        contentType == Ci.nsIContentPolicy.TYPE_SUBDOCUMENT) {
      var url = contentLocation.spec;
      /* Simplify the filter code to make it faster (don't check Nicovideo URL here) */
      if (/\?smilefox\=get$/.test(url)) {
        /* We have no setTimeout(), so... */
        var timerEvent = {
          notify: function () {
            Components.utils.import("resource://nicofox/DownloadManager.jsm");
            DownloadManager.addDownload(url.substring(0, url.indexOf("?")));
          } 
        }
        var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        timer.initWithCallback(timerEvent, 10, Ci.nsITimer.TYPE_ONE_SHOT);
        
        return Ci.nsIContentPolicy.REJECT_REQUEST;
      }
    /* Block NicoWa if needed */
    } else if (this._nicowaBlocker && contentType == Ci.nsIContentPolicy.TYPE_OBJECT_SUBREQUEST) {
      var url = contentLocation.spec;
      if(url.indexOf('http://flapi.nicovideo.jp/api/getmarqueev3') == 0 ) {
        return Ci.nsIContentPolicy.REJECT_REQUEST;
      }
    }
   return Ci.nsIContentPolicy.ACCEPT;
  },
  // this is now for urls that directly load media, and meta-refreshes (before activation)
  shouldProcess: function(contentType, contentLocation, requestOrigin, requestingNode, mimeType, extra) {
    return Ci.nsIContentPolicy.ACCEPT;
  },
  /* Implements nsIObserver */
  observe: function(subject, topic, data) {
    /* In Startup or pref changed, cache the value of nicowa_blocker (avoid pref access in shouldLoad) */
    Components.utils.import("resource://nicofox/Core.jsm");
    switch(topic) {
      case "nsPref:changed":
      this._nicowaBlocker = Core.prefs.getBoolPref("nicowa_blocker");
      break;
      
      case "quit-application":
      Components.utils.import("resource://nicofox/Services.jsm");
      Services.obs.removeObserver(this, "quit-application")
      Core.prefs.removeObserver("nicowa_blocker", this);
      break;
    }
  },
  _initPref: function() {
    Components.utils.import("resource://nicofox/Core.jsm");
    Components.utils.import("resource://nicofox/Services.jsm");
    Services.obs.addObserver(this, "quit-application", false);
    Core.prefs.addObserver("nicowa_blocker", this, false);
    this._nicowaBlocker = Core.prefs.getBoolPref("nicowa_blocker");
  }
}

if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([NicoWatcher]);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule([NicoWatcher]);
}
