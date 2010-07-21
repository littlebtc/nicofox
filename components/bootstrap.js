/* vim: sw=2 ts=2 sts=2 et filetype=javascript 
 *
 * Bootstrap program to load the download manager after profile was fully loaded
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const CONTRACT_ID = "@littleb.tc/nicofox-bootstrap;1";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function NicoFoxBootstrap() {
}

NicoFoxBootstrap.prototype = {
  classDescription: "Startup Loader for NicoFox",
  classID: Components.ID("74361378-6c72-4bad-baa7-07abba57f9a2"),
  contractID: CONTRACT_ID,
  _xpcom_categories: [
    { category: "profile-after-change" },
  ],
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIContentPolicy, Ci.nsIObserver, Ci.nsIWeakReference]),
  /* Implements nsIObserver */
  observe: function(subject, topic, data) {
    /* XXX: Observe the impact on the startup */
    if (topic == "profile-after-change") {
      Components.utils.import("resource://nicofox/DownloadManager.jsm");
      DownloadManager.startup();
    }
  }
}

if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([NicoFoxBootstrap]);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule([NicoFoxBootstrap]);
}

