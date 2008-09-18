var nicofox = {
  onLoad: function() {
    /* initialization code */
    this.initialized = true;
    this.strings = document.getElementById("nicofox-strings");
    this.monkeyStrings = document.getElementById("nicomonkey-strings");
    this.prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefService);
    this.prefs = this.prefs.getBranch("extensions.nicofox.");


    /* Prepapre prompt service */
    this.prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Ci.nsIPromptService);

    /* Add the smilefox table if it is not established */
    if (this.prefs.getBoolPref('first_run'))
    {
		var file = Cc["@mozilla.org/file/directory_service;1"]
		           .getService(Ci.nsIProperties)
		           .get("ProfD", Ci.nsIFile);
		file.append("smilefox.sqlite");

		var storageService = Components.classes["@mozilla.org/storage/service;1"]
	                        .getService(Components.interfaces.mozIStorageService);
		var db_connect = storageService.openDatabase(file);

		var sql = 'CREATE TABLE IF NOT EXISTS "smilefox" ("id" INTEGER PRIMARY KEY  NOT NULL  , "url" VARCHAR , "video_id" VARCHAR , "comment_id" VARCHAR , "comment_type" VARCHAR , "video_title" VARCHAR , "video_type" VARCHAR , "video_economy" VARCHAR , "video_file" VARCHAR , "comment_file" VARCHAR , "current_bytes" INTEGER , "max_bytes" INTEGER , "start_time" INTEGER , "end_time" INTEGER , "add_time" INTEGER , "download_items" INTEGER , "status" INTEGER )' ;
		var statement = db_connect.createStatement(sql);
		statement.execute();
		this.prefs.setBoolPref('first_run', false);
    }

  },
  onMenuItemCommand: function(e) {

	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
	var dlmanager = wm.getMostRecentWindow("smilefox:dlmanager");

	if(dlmanager)
	{
		dlmanager.focus();
	}
	else
	{
		window.open("chrome://nicofox/content/smilefox.xul",
                  "smilefox", "chrome,centerscreen,resizable=yes,width=800,height=450");
	}

  },
  onPageLoad: function(aEvent) {

  },
    goDownload: function(url) 
	{
		/* Though for nsILocalFile, it is not a right way to access the preference, but it DID work! */
		var value = this.prefs.getComplexValue("save_path",
		Components.interfaces.nsISupportsString).data;
		if (!value)
		{
			this.prompts.alert(null, this.strings.getString('errorTitle'), this.strings.getString('errorPathNotDefined'));
			pref_window = window.openDialog('chrome://nicofox/content/options.xul', '', 'chrome,titlebar,toolbar,centerscreen,modal');
			pref_window.focus();
			return;
		}

		/* Get the nicovideo page URL */
		url = url.split("?")[0];		

		var nicofox_status = document.getElementById('nicofox-status');
		nicofox_status.style.display='block';
		nicofox_status.label = this.strings.getString('processing');

		urlparser = new nicoFoxUrlParser();
		urlparser.return_to = hitchFunction(nicofox, 'confirmDownload', url);
		urlparser.goParse(url);
	},

	confirmDownload: function(Video, url)
		{

		var nicofox_status = document.getElementById('nicofox-status');
		nicofox_status.style.display='none';


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

		if(this.prefs.getBoolPref('confirm_before_download'))
		{
			/* Call the download confirm dialog */
			var params = {url: url, Video: Video, out: null};       

			window.openDialog("chrome://nicofox/content/download_confirm.xul", "",
		    "centerscreen,modal", params).focus();

			 if (!params.out) { return; }
		}

		/* Send the add request to download manager */
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
 			                   .getService(Components.interfaces.nsIWindowMediator);
		var dlmanager = wm.getMostRecentWindow("smilefox:dlmanager");

		if(!dlmanager)
		{
			var dlmanager = window.openDialog("chrome://nicofox/content/smilefox.xul",
	                  "smilefox", "dialog=no,chrome,centerscreen,resizable=yes,width=770,height=450", {Video: Video, url: url});
		}
		else
		{
			dlmanager.addDownload(Video, url);
		}
		dlmanager.focus();

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
window.addEventListener("load", function(e) { nicofox.onLoad(e); }, false);
