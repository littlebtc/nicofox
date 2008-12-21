
Components.utils.import("resource://nicofox/download_manager.js");
Components.utils.import("resource://nicofox/common.js");
Components.utils.import("resource://nicofox/urlparser_nico.js");

/* Download count refresh listener */
var listener = 
{
  add: function(id, content) {
    refreshIcon();
  },
  remove: function(id) {
  },
  update: function(id, content) {
    refreshIcon();
  },
  stop: function() {
    refreshIcon();
  },
  rebuild: function() {
  }
}

nicofox_download_listener.addListener(listener);

var nicofox = {
  bar_opened: false,

  nicofox_page_listener:
  {
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
       nicofox.openBar(true);
     } else {
       document.getElementById('smilefox-toolbar-download').setAttribute('disabled', true);
       if (aURI && aURI.spec.match(/^http:\/\/(www|tw|es|de)\.nicovideo\.jp\//)) {
         nicofox.openBar(true);
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
    this.initialized = true;
    this.strings = document.getElementById("nicofox-strings");
    this.monkeyStrings = document.getElementById("nicomonkey-strings");
    this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefService);
    this.prefs = this.prefs.getBranch("extensions.nicofox.");


    /* Prepapre prompt service */
    this.prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Ci.nsIPromptService);

    /* Now first run has nothing to do? */
    if (this.prefs.getBoolPref('first_run')) {
//      this.prefs.setBoolPref('first_run', false);
    }

    gBrowser.addProgressListener(this.nicofox_page_listener,
    Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);

   nicofox_download_manager.go();
  },
  onUnload: function() {
    gBrowser.removeProgressListener(this.nicofox_page_listener,
    Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
  },
  
  onMenuItemCommand: function(e) {
	nicofox.openBar(false);
  },
  onPageLoad: function(aEvent) {

  },
    openBar: function(auto_triggered)
    {
      /* Auto triggered and not dismissed */
      if (auto_triggered
      && this.prefs.getBoolPref("bar_autoopen")
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
    goDownload: function(url, dont_confirm) 
	{
		/* Though for nsILocalFile, it is not a right way to access the preference, but it DID work! */
		var value = this.prefs.getComplexValue("save_path",
		Components.interfaces.nsISupportsString).data;
		if (!value)
		{
			var file_picker = Cc["@mozilla.org/filepicker;1"]
			                  .createInstance(Ci.nsIFilePicker);
			file_picker.init(window, this.strings.getString('errorPathNotDefined'), Ci.nsIFilePicker.modeGetFolder);
			if (file_picker.show() == Ci.nsIFilePicker.returnOK) {
			  this.prefs.setComplexValue('save_path', Ci.nsILocalFile, file_picker.file);
			} else {
			  return;
			}
		}

		/* Get the nicovideo page URL */
		url = url.split("?")[0];		

		var nicofox_icon = document.getElementById('nicofox-icon');
		nicofox_icon.label = this.strings.getString('processing');

		urlparser = new nicoFoxUrlParser();
		urlparser.return_to = hitchFunction(nicofox, 'confirmDownload', url, dont_confirm);
		urlparser.goParse(url);
	},

	goDownloadFromVideoPage: function(Video, url)
	{
		/* Though for nsILocalFile, it is not a right way to access the preference, but it DID work! */
		var value = this.prefs.getComplexValue("save_path",
		Components.interfaces.nsISupportsString).data;
		if (!value)
		{
			var file_picker = Cc["@mozilla.org/filepicker;1"]
			                  .createInstance(Ci.nsIFilePicker);
			file_picker.init(window, this.strings.getString('errorPathNotDefined'), Ci.nsIFilePicker.modeGetFolder);
			if (file_picker.show() == Ci.nsIFilePicker.returnOK) {
			  this.prefs.setComplexValue('save_path', Ci.nsILocalFile, file_picker.file);
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
	confirmDownload: function(Video, url, dont_confirm)
		{

		refreshIcon();
		/* Download failed */
		if(Video == false)
		{
			this.prompts.alert(null, this.strings.getString('errorTitle'), this.strings.getString('errorParseFailed'));
			return;
		}

		if (Video.isDeleted)
		{
			this.prompts.alert(null, this.strings.getString('errorTitle'), this.strings.getString('errorDeleted'));
			return;
		}

		if(this.prefs.getBoolPref('confirm_before_download') && !dont_confirm)
		{
			/* Call the download confirm dialog */
			var params = {url: url, Video: Video, out: null};       

			/* Easter Egg is here! */
			if (this.prefs.getBoolPref('tsundere'))
			{
				window.openDialog("chrome://nicofox/content/tsundere_confirm.xul", "",
				    "centerscreen,modal", params).focus();
			}
			/* Without Easter Egg... */
			else
			{
				window.openDialog("chrome://nicofox/content/download_confirm.xul", "",
				    "centerscreen,modal", params).focus();
			}
			 if (!params.out) { return; }
		}

		/* Send the add request to download manager */
/*		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
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
		nicofox_download_manager.add(Video, url);
		nicofox.openBar(false);
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

};
function refreshIcon() {
  var nicofox_icon = document.getElementById('nicofox-icon');
  var download_count = nicofox_download_manager.getDownloadCount();
  var waiting_count = nicofox_download_manager.getWaitingCount();
  if (download_count > 0) {
    nicofox_icon.setAttribute ('label', download_count + '/' + (download_count + waiting_count));
  } else {
    nicofox_icon.setAttribute ('label', '');
  }
}
window.addEventListener("load", function(e) { nicofox.onLoad(e); }, false);
window.addEventListener("unload", function(e) { nicofox.onUnload(e); }, false);
