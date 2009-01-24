
Components.utils.import("resource://nicofox/download_manager.js");
Components.utils.import("resource://nicofox/common.js");
Components.utils.import("resource://nicofox/urlparser_nico.js");

if (!nicofox_ui) {var nicofox_ui = {};}
/* Download count refresh listener */
nicofox_ui.overlay = {
  icon_listener: { 
    add: function(id, content) {
      nicofox_ui.overlay.refreshIcon();
    },
    remove: function(id) {
      nicofox_ui.overlay.refreshIcon();
    },
    update: function(id, content) {
      nicofox_ui.overlay.refreshIcon();
    },
    stop: function() {
      nicofox_ui.overlay.refreshIcon();
    },
    rebuild: function() {
    }
  },
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
     /* FIXME: Dirty */
     if (aURI && aURI.spec.match(/^http:\/\/(www|tw|es|de)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+$/)) {
       document.getElementById('smilefox-toolbar-download').setAttribute('disabled', false);
       nicofox_ui.overlay.openBar(true);
     } else {
       document.getElementById('smilefox-toolbar-download').setAttribute('disabled', true);
       if (aURI && aURI.spec.match(/^http:\/\/(www|tw|es|de)\.nicovideo\.jp\//)) {
         nicofox_ui.overlay.openBar(true);
       }
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
//   this.nico_dl_observer = new nicofox_download_observer();
   /* initialization code */
   nicofox_ui.overlay.initialized = true;

   /* Prepapre prompt service */
   nicofox_ui.overlay.prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                       .getService(Ci.nsIPromptService);

   gBrowser.addProgressListener(nicofox_ui.overlay.page_listener,
   Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);

   nicofox.download_listener.addListener(nicofox_ui.overlay.icon_listener);
   nicofox.download_manager.go();
  },
  onUnload: function() {
    window.removeEventListener("load", nicofox_ui.overlay.onLoad, false);
    window.removeEventListener("unload", nicofox_ui.overlay.onUnload, false);
    gBrowser.removeProgressListener(nicofox_ui.overlay.page_listener,
    Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
    nicofox.download_listener.removeListener(nicofox_ui.overlay.icon_listener);
  },
  onMenuItemCommand: function(e) {
  nicofox_ui.overlay.openBar(false);
  },
  openBar: function(auto_triggered) {
    /* Auto triggered and not dismissed */
    if (auto_triggered
    && nicofox.prefs.getBoolPref("bar_autoopen")
    && ! this.bar_opened)
    {
      document.getElementById('nicofox-splitter').collapsed = false;
      document.getElementById('smilefox-space').collapsed = false;
      this.bar_opened = true;
    } else if (!auto_triggered) {
      document.getElementById('nicofox-splitter').collapsed = false;
      document.getElementById('smilefox-space').collapsed = false;
      this.bar_opened = true;
    }
  },
  goDownload: function(url, dont_confirm) {
    /* Though for nsILocalFile, it is not a right way to access the preference, but it DID work! */
    var value = nicofox.prefs.getComplexValue("save_path", Ci.nsISupportsString).data;
    if (!value)
    {
      var file_picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      file_picker.init(window, nicofox.strings.getString('errorPathNotDefined'), Ci.nsIFilePicker.modeGetFolder);
      if (file_picker.show() == Ci.nsIFilePicker.returnOK) {
        nicofox.prefs.setComplexValue('save_path', Ci.nsILocalFile, file_picker.file);
      } else {
        return;
      }
    }

    /* Get the nicovideo page URL */
    url = url.split("?")[0];    

    var nicofox_icon = document.getElementById('nicofox-icon');
    nicofox_icon.label = nicofox.strings.getString('processing');

    urlparser = new nicofox.parser.nico();
    urlparser.return_to = nicofox.hitch(nicofox_ui.overlay, 'confirmDownload', url, dont_confirm);
    urlparser.goParse(url);
  },
  goDownloadFromVideoPage: function(Video, url) {
    /* Though for nsILocalFile, it is not a right way to access the preference, but it DID work! */
    var value = nicofox.prefs.getComplexValue("save_path",Ci.nsISupportsString).data;
    if (!value) {
      var file_picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      file_picker.init(window, nicofox.strings.getString('errorPathNotDefined'), Ci.nsIFilePicker.modeGetFolder);
      if (file_picker.show() == Ci.nsIFilePicker.returnOK) {
        nicofox.prefs.setComplexValue('save_path', Ci.nsILocalFile, file_picker.file);
      } else {
        return;
      }
    }
    this.confirmDownload(Video, url, true);
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
    nicofox_ui.overlay.refreshIcon();
    /* Download failed */
    if(Video == false) {
      this.prompts.alert(null, nicofox.strings.getString('errorTitle'), nicofox.strings.getString('errorParseFailed'));
      return;
    }
    if (Video.isDeleted) {
      this.prompts.alert(null, nicofox.strings.getString('errorTitle'), nicofox.strings.getString('errorDeleted'));
      return;
    }

    if(nicofox.prefs.getBoolPref('confirm_before_download') && !dont_confirm) {
      /* Call the download confirm dialog */
      var params = {url: url, Video: Video, out: null};       

      /* Easter Egg is here! */
      if (nicofox.prefs.getBoolPref('tsundere')) {
        window.openDialog("chrome://nicofox/content/tsundere_confirm.xul", "",
            "centerscreen,modal", params).focus();
      } else {
        window.openDialog("chrome://nicofox/content/download_confirm.xul", "",
            "centerscreen,modal", params).focus();
      }
       if (!params.out) { return; }
    }

    /* Send the add request to download manager */
/*    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                          .getService(Components.interfaces.nsIWindowMediator);
    var dlmanager = wm.getMostRecentWindow("smilefox:dlmanager");

    if(!dlmanager)
    {
      var dlmanager = window.openDialog("chrome://nicofox/content/smilefox.xul",
                    "smilefox", "dialog=no,chrome,centerscreen,resizable=yes,width=770,height=450", {Video: Video, url: url});
    }
    else
    {
    }*/
    nicofox.download_manager.add(Video, url);
    nicofox_ui.overlay.openBar(false);
    /*dlmanager.focus();*/

  },
  collapseBar: function()
  {
    document.getElementById('nicofox-splitter').collapsed = !document.getElementById('nicofox-splitter').collapsed;
    document.getElementById('smilefox-space').collapsed = !document.getElementById('smilefox-space').collapsed;
  },
  matchWatchUrl: function(url)
  {
    return url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([a-z]{0,2}[0-9]+)$/);
  },

  matchWatchCommentUrl: function(url)
  {
    return url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([0-9]+)$/);
  },

  matchWatchVideoUrl: function(url)
  {
    return url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([a-z]{2}[0-9]+)$/);
  },

  refreshIcon: function() {
    var nicofox_icon = document.getElementById('nicofox-icon');
    var download_count = nicofox.download_manager.getDownloadCount();
    var waiting_count = nicofox.download_manager.getWaitingCount();
    if (download_count > 0) {
      nicofox_icon.setAttribute ('label', download_count + '/' + (download_count + waiting_count));
    } else {
      nicofox_icon.setAttribute ('label', '');
    }
  },
};
window.addEventListener("load", nicofox_ui.overlay.onLoad, false);
window.addEventListener("unload", nicofox_ui.overlay.onUnload, false);
