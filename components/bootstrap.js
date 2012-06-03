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
    switch(topic) {
      /* Add observers and initialize download manager */
      /* XXX: Observe the impact on the startup */
      case "profile-after-change":
      Components.utils.import("resource://gre/modules/Services.jsm");
      Components.utils.import("resource://nicofox/DownloadManager.jsm");
      DownloadManager.startup();
      Services.obs.addObserver(this, "quit-application-requested", false);
      Services.obs.addObserver(this, "quit-application", false);
      Services.obs.addObserver(this, "private-browsing", false);
      break;
      /* Tell the Download Manager when enter/exit private browsing mode. */
      case "private-browsing":
      DownloadManager.togglePrivateBrowsing(data);
      break;
      /* Confirm whether to cancel all downloads before quit */
      case "quit-application-requested":
      DownloadManager.confirmQuit(subject);
      break;
      /* Cleanup on shutdown */
      case "quit-application":
      DownloadManager.shutdown();
      Services.obs.removeObserver(this, "quit-application-requested", false);
      Services.obs.removeObserver(this, "quit-application", false);
      Services.obs.removeObserver(this, "private-browsing", false);
      break;
    }
  }
}

if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([NicoFoxBootstrap]);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule([NicoFoxBootstrap]);
}

