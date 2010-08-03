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
  },
  onUnload: function() {
    window.removeEventListener("unload", nicofox_ui.overlay.onUnload, false);
    gBrowser.removeProgressListener(nicofox_ui.overlay.page_listener,
    Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
  },
  onMenuItemCommand: function(e) {
    document.getElementById('nicofox-library').hidden = false;
    document.getElementById('nicofox-library').openPopup(document.getElementById("nicofox-icon"), 'before_end', 0, 0, false, false);
  },
  confirmDownload: function(Video, url, dont_confirm) {
    Components.utils.import("resource://nicofox/Services.jsm", nicofox);
    /* Download failed */
    if(Video == false) {
      nicofox.Services.prompt.alert(null, nicofox.Core.strings.getString('errorTitle'), nicofox.Core.strings.getString('errorParseFailed'));
      return;
    }
    if (Video.isDeleted) {
      nicofox.Services.prompt.alert(null, nicofox.Core.strings.getString('errorTitle'), nicofox.Core.strings.getString('errorDeleted'));
      return;
    }

    /* Test the file title */
    /* FIXME: This should not be here? */
   Components.utils.import("resource://nicofox/common.js", nicofoxOld);
    var file_title = nicofox.Core.prefs.getComplexValue('filename_scheme', Ci.nsISupportsString).data;
    
    file_title = file_title.replace(/\%TITLE\%/, nicofoxOld.nicofox.fixReservedCharacters(Video.title));
    file_title = file_title.replace(/\%ID\%/, nicofoxOld.nicofox.fixReservedCharacters(Video.id));
    /* Add comment filename */
    if (Video.comment_type != 'www' && Video.comment_type) {
      file_title = file_title.replace(/\%COMMENT\%/, nicofoxOld.nicofox.fixReservedCharacters('['+Video.comment_type+']'));
    } else {
      file_title = file_title.replace(/\%COMMENT\%/, '');
    }
    var save_path = nicofox.Core.prefs.getComplexValue('save_path', Ci.nsILocalFile);
    if (!this.checkFile(save_path, file_title)) {
      nicofox.Services.prompt.alert(null, nicofox.Core.strings.getString('errorTitle'), nicofox.Core.strings.getString('errorFileExisted'));
      return;
    }

    if(nicofox.Core.prefs.getBoolPref('confirm_before_download') && !dont_confirm) {
      /* Call the download confirm dialog */
      var params = {url: url, Video: Video, out: null};       

      /* Easter Egg is here! */
      if (nicofox.Core.prefs.getBoolPref('tsundere')) {
        window.openDialog("chrome://nicofox/content/tsundere_confirm.xul", "",
            "centerscreen,modal", params).focus();
      } else {
        window.openDialog("chrome://nicofox/content/download_confirm.xul", "",
            "centerscreen,modal", params).focus();
      }
       if (!params.out) { return; }
    }

    Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofoxOld);
    nicofoxOld.nicofox.download_manager.add(Video, url);
    nicofox_ui.overlay.openBar(false);
    /*dlmanager.focus();*/

  }
};
window.addEventListener("load", nicofox_ui.overlay.onLoad, false);
window.addEventListener("unload", nicofox_ui.overlay.onUnload, false);
