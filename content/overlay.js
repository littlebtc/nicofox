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
  /* Update download manager statusbar, then register for changes */
  nicofox.refreshIcon();
  nicofox.DownloadManager.addListener(nicofox.listener);
  },
  onUnload: function() {
    window.removeEventListener("unload", nicofox_ui.overlay.onUnload, false);
    nicofox.DownloadManager.removeListener(nicofox.listener);
  },
  onMenuItemCommand: function(e) {
    document.getElementById('nicofox-library').hidden = false;
    document.getElementById('nicofox-library').openPopup(document.getElementById("nicofoxStatusbarContainer"), 'before_end', 0, 0, false, false);
  },
};
/* Refresh statusbar download notification */
nicofox.refreshIcon = function() {
  var nicofoxLabel = document.getElementById("nicofoxStatusbarLabel");
  var downloadCount = nicofox.DownloadManager.activeDownloadCount;
  var waitingCount = nicofox.DownloadManager.queuedDownloadCount;
  if (downloadCount > 0) {
    nicofoxLabel.setAttribute("value", downloadCount + "/" + (downloadCount + waitingCount));
    nicofoxLabel.hidden = false;
  } else {
    nicofoxLabel.setAttribute("value", "");
    nicofoxLabel.hidden = true;
  }
};
/* XXX: to display status in statusbar */
nicofox.listener = {

};
nicofox.listener.queueChanged = function(id, content) {
  nicofox.refreshIcon();
};
window.addEventListener("load", nicofox_ui.overlay.onLoad, false);
window.addEventListener("unload", nicofox_ui.overlay.onUnload, false);
