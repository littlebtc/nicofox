var nicofox = {};
var nicofoxOld = {};
Components.utils.import("resource://nicofox/common.js", nicofoxOld);
Components.utils.import("resource://nicofox/Core.jsm", nicofox);

if (!nicofox_ui) {var nicofox_ui = {};}

nicofox_ui.overlay = {
  /* Prepare for nsIPromptService */
  bar_opened: false,
  page_listener: {
    QueryInterface: function(aIID)
    {
     if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
         aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
         aIID.equals(Components.interfaces.nsISupports))
       return this;
     throw Components.results.NS_NOINTERFACE;
    },
    onLocationChange: function(aProgress, aRequest, aURI)
    {
     /* XXX: Why parser? */
     Components.utils.import("resource://nicofox/urlparser.js", nicofoxOld);
     /* Test if we are in supported website and change the "Download" button */
     if (aURI && nicofoxOld.nicofox.parser.prototype.supported_sites.nico.test(aURI.spec)) {
       //document.getElementById('smilefox-toolbar-download').setAttribute('disabled', false);
     } else {
       //document.getElementById('smilefox-toolbar-download').setAttribute('disabled', true);
     }
     return 0;
    },
    onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {return 0;},
    onProgressChange: function() {return 0;},
    onStatusChange: function() {return 0;},
    onSecurityChange: function() {return 0;},
    onLinkIconAvailable: function() {return 0;}
  },
  onLoad: function() {
   /* initialization code */
   nicofox_ui.overlay.initialized = true;

   /* Listen pages */
   gBrowser.addProgressListener(nicofox_ui.overlay.page_listener,
   Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
   
   /* Register panel initializer */
   document.getElementById("nicofox-library").addEventListener("popupshowing", function() { nicofox.panel.onPopupShowing(); }, false);
  },
  onUnload: function() {
    window.removeEventListener("load", nicofox_ui.overlay.onLoad, false);
    window.removeEventListener("unload", nicofox_ui.overlay.onUnload, false);
    gBrowser.removeProgressListener(nicofox_ui.overlay.page_listener,
    Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
  },
  onMenuItemCommand: function(e) {
  //  nicofox_ui.overlay.collapseBar();
 document.getElementById('nicofox-library').hidden = false; document.getElementById('nicofox-library').openPopup(document.getElementById("nicofox-icon"), 'before_end', 0, 0, false, false);
  },
  openBar: function(auto_triggered) {
    // nicofox.Core.prefs.getBoolPref("bar_autoopen")
  },
  goDownload: function(url, dont_confirm) {
    /* Though for nsILocalFile, it is not a right way to access the preference, but it DID work! */
    var value = nicofox.Core.prefs.getComplexValue("save_path", Ci.nsISupportsString).data;
    if (!value)
    {
      var file_picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      file_picker.init(window, nicofox.Core.strings.getString('errorPathNotDefined'), Ci.nsIFilePicker.modeGetFolder);
      if (file_picker.show() == Ci.nsIFilePicker.returnOK) {
        nicofox.Core.prefs.setComplexValue('save_path', Ci.nsILocalFile, file_picker.file);
      } else {
        return;
      }
    }

    /* Get the URLs we really want */
    url = url.replace(/[\?\&]smilefox\=get$/, '');  

    var nicofox_icon = document.getElementById('nicofox-icon');
    nicofox_icon.setAttribute('label', nicofox.Core.strings.getString('processing'));
    nicofox_icon.className = 'statusbarpanel-iconic-text';

    Components.utils.import("resource://nicofox/urlparser.js", nicofoxOld);
    var urlparser = new nicofoxOld.nicofox.parser();
    urlparser.return_to = nicofoxOld.nicofox.hitch(nicofox_ui.overlay, 'confirmDownload', url, dont_confirm);
    urlparser.goParse(url);
  },
  openOptions: function() {
      /* instantApply needs dialog = no */
      /* Copied from chrome://mozapps/content/extensions/extensions.js in Firefox */
      var features;
      var instant_apply = true;
      try {
        var root_prefs = Components.classes["@mozilla.org/preferences-service;1"]
                                   .getService(Components.interfaces.nsIPrefBranch);
        instant_apply = root_prefs.getBoolPref("browser.preferences.instantApply");
        features = "chrome,titlebar,toolbar,centerscreen" + (instant_apply ? ",dialog=no" : ",modal");
      } catch (e) {
        features = "chrome,titlebar,toolbar,centerscreen,modal";
      }
      pref_window = window.openDialog('chrome://nicofox/content/options.xul', '', features);
      pref_window.focus();
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

  },
  collapseBar: function()
  {
    /**/
  },
  checkFile: function(path, filename) {
    if (
    this.isFileExists(path, filename + '.flv')
    || this.isFileExists(path, filename + '.mp4')
    || this.isFileExists(path, filename + '.xml')
    || this.isFileExists(path, filename + '[Owner].xml')
    ) {
      return false;
    }
    return true;
  },
  isFileExists: function(path, filename) {
    var file = path.clone();
    file.append(filename);
    var exists = file.exists();
    return exists;
  },
};
window.addEventListener("load", nicofox_ui.overlay.onLoad, false);
window.addEventListener("unload", nicofox_ui.overlay.onUnload, false);
