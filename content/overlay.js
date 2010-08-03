var nicofox = {};
Components.utils.import("resource://nicofox/Core.jsm", nicofox);

if (!nicofox_ui) {var nicofox_ui = {};}

nicofox_ui.overlay = {
  onLoad: function() {
   window.removeEventListener("load", nicofox_ui.overlay.onLoad, false);
   /* initialization code */
   nicofox_ui.overlay.initialized = true;

   /* Register panel initializer */
   document.getElementById("nicofox-library").addEventListener("popupshowing", function() { nicofox.panel.onPopupShowing(); }, false);

  Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofox);
  nicofox.DownloadManager.addListener(nicofox.listener);
  },
  onUnload: function() {
    window.removeEventListener("unload", nicofox_ui.overlay.onUnload, false);
    nicofox.DownloadManager.removeListener(nicofox.listener);
  },
  onMenuItemCommand: function(e) {
    document.getElementById('nicofox-library').hidden = false;
    document.getElementById('nicofox-library').openPopup(document.getElementById("nicofox-icon"), 'before_end', 0, 0, false, false);
  },
};
/* Refresh statusbar download notification */
nicofox.refreshIcon = function() {
  var nicofoxIcon = document.getElementById("nicofox-icon");
  var downloadCount = nicofox.DownloadManager.activeDownloadCount;
  var waitingCount = nicofox.DownloadManager.queuedDownloadCount;
  if (downloadCount > 0) {
    nicofoxIcon.setAttribute ("label", downloadCount + "/" + (downloadCount + waitingCount));
    nicofoxIcon.className = "statusbarpanel-iconic-text";
  } else {
    nicofoxIcon.setAttribute ("label", "");
    nicofoxIcon.className = "statusbarpanel-iconic";
  }
};
/* XXX: to display status in statusbar */
nicofox.listener = {

};
nicofox.listener.downloadAdded = function(id, content) {
  nicofox.refreshIcon();
};
nicofox.listener.downloadUpdated = function(id, content) {
  nicofox.refreshIcon();
};
nicofox.listener.downloadVideoCompleted = function(id, content) {
  nicofox.refreshIcon();
};
window.addEventListener("load", nicofox_ui.overlay.onLoad, false);
window.addEventListener("unload", nicofox_ui.overlay.onUnload, false);
