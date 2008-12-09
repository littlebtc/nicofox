var Cc = Components.classes;
var Ci = Components.interfaces;

var EXPORTED_SYMBOLS = ['nicofox_download_listener', 'nicofox_download_manager', 'nicofox_download_observer'];
Components.utils.import('resource://nicofox/smilefox_downloader.js');

var bundle_service = Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService);
var strings = 
{
  bundle: null, 
  init: function() {
   this.bundle = bundle_service.createBundle('chrome://nicofox/locale/nicofox.properties');
  }, 
  getString: function(str) {
    if (this.bundle === null) this.init();
    return this.bundle.GetStringFromName(str);
  }

}
var had_done = false;
var unloading = false;
/* Make a observer to check the private mode (for Fx 3.1b2+) and the quitting of the browser */
var nicofox_download_observer = {
  quit_confirmed: false,
  observe: function(subject, topic, data) {

    if (topic == 'quit-application-requested')
    {
      var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Ci.nsIPromptService);
      if (download_count > 0)
      {
        if (!prompts.confirm(null, strings.getString('closeSmileFoxTitle'), strings.getString('closeSmileFoxMsg'))){
            subject.QueryInterface(Ci.nsISupportsPRBool);
            subject.data = true;
            return;
        }
       this.unregisterReq();
      }   
    } else if (topic == 'quit-application')
    {
       unloading = true;
       download_runner.cancelAll();
       this.unregisterGra();
    }

  },
  register: function() {
    var observer_service = Cc["@mozilla.org/observer-service;1"]
                          .getService(Ci.nsIObserverService);
    observer_service.addObserver(this, "quit-application-requested", false);
    observer_service.addObserver(this, "quit-application", false);
  },
  unregisterReq: function() {
    var observer_service = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
    observer_service.removeObserver(this, "quit-application-requested");
  },
  unregisterGra: function() {
    var observer_service = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
    observer_service.removeObserver(this, "quit-application");
  }
}
nicofox_download_observer.register();

var download_listeners = [];

/* A download listener for all application that need to know the download status */
var nicofox_download_listener = 
{
  addListener: function(listener) {
    download_listeners.push(listener);
  },
  removeListener: function(listener) {
    download_listeners.splice(download_listeners.indexOf(listener), 1);
  },
}

var dummy = {};
/* A function to call all of the listeners */
function triggerDownloadListeners(listener_event, id, content)
{
var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
	              .getService(Ci.nsIPromptService);
  var i;
  if ((typeof listener_event) != 'string') {return false;}
  for (i = 0; i < download_listeners.length; i++)
  { 
    if ((typeof download_listeners[i][listener_event]) == 'function')
    { download_listeners[i][listener_event].call(dummy, id, content); }
  }
}
var smilefox_sqlite = 
{
	load: function() {

		var file = Cc["@mozilla.org/file/directory_service;1"]
		           .getService(Ci.nsIProperties)
		           .get("ProfD", Ci.nsIFile);
		file.append("smilefox.sqlite");

		var storageService = Components.classes["@mozilla.org/storage/service;1"]
	                        .getService(Components.interfaces.mozIStorageService);
		this.db_connect = storageService.openDatabase(file);

	},
	fetchArray: function(statement) {
		// FIXME: typeof check
		var i = 0;
		var rows = new Array();

		while (statement.executeStep())
		{
			rows[i] = new Object();
			for (j = 0; j < statement.columnCount; j++)
			{
				name = statement.getColumnName(j);
				switch(statement.getTypeOfIndex(j))
				{
					case 0: // VALUE_TYPE_NULL
					value = null;
					break;
					case 1: // VALUE_TYPE_INTEGER 
					if (name == 'start_time')
					{
						/* getInt64 implementation has a bug */
						value = statement.getUTF8String(j).valueOf();
					}
					else
					{
						value = statement.getInt32(j);
					}
					break;
					case 2: // VALUE_TYPE_FLOAT
					value = statement.getDouble(j);
					break;
					case 3: // VALUE_TYPE_TEXT
					value = statement.getUTF8String(j);
					break;
					case 4: // VALUE_TYPE_BLOB
					statement.getBlob(j, size, data);
				}
				rows[i][name] = value;
			}
			i++;
		} 
		return rows;
	},
	/* Select data from Database */
	select: function() {
		if (!this.db_connect) {this.load();}
                var statement = this.db_connect.createStatement("SELECT * FROM smilefox ORDER BY id DESC");
		statement.execute();
		var rows = this.fetchArray(statement);
		statement.reset();
		return rows;
	},
	selectId: function (id) {
		if (!this.db_connect) {this.load();}
		if (!id) {return {};}
		var statement = this.db_connect.createStatement("SELECT * FROM smilefox WHERE id = "+id);
		//statement.bindInt64Parameter(0, id);
		statement.execute();
		var rows = this.fetchArray(statement);
		statement.reset();
		return rows[0];
	},
	add: function (Video, url) {
		try
		{
			var statement = this.db_connect.createStatement("INSERT INTO smilefox (url, video_id, comment_id, comment_type, video_title, download_items, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");
			statement.bindUTF8StringParameter(0, url);
			statement.bindUTF8StringParameter(1, Video.id);
			statement.bindUTF8StringParameter(2, Video.v);
			statement.bindUTF8StringParameter(3, Video.comment_type);
			statement.bindUTF8StringParameter(4, Video.title);
			statement.bindInt32Parameter(5, 2);
			statement.bindInt32Parameter(6, 0);

			statement.execute();
			statement.reset();

			var content = {
			id: this.db_connect.lastInsertRowID,
			url: url, video_id: Video.id, comment_id: Video.v, comment_type: Video.comment_type, video_title: Video.title, 
			download_items: 2, status: 0
			};
			return content;
		}
		catch(e)
		{
		}
	},
	updateStatus: function (id, stat) {
		try
		{
			if(!id || isNaN(id)) { return false; }
			var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1 WHERE `id` = ?2");
			stmt.bindInt32Parameter(0, stat);
			stmt.bindInt32Parameter(1, id);
			stmt.execute();
			stmt.reset();
		}
		catch(e)
		{
		}
	},
	updateInfo: function(id, info) {
		/* Update info and set status = 7 (downloading)*/
		if(!id || isNaN(id)) { return false; }
		var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1 , `video_type` = ?2 , `video_economy` = ?3 , `video_file` = ?4 , `comment_file` = ?5, `start_time` = ?6 WHERE `id` = ?7");
		stmt.bindInt32Parameter(0, 7);
		stmt.bindUTF8StringParameter(1, info.video_type);
		if (info.video_economy)
		{ stmt.bindInt32Parameter(2, 1); }
		else
		{ stmt.bindInt32Parameter(2, 0); }
		stmt.bindUTF8StringParameter(3, info.video_file);
		stmt.bindUTF8StringParameter(4, info.comment_file);
		now_date = new Date();
		info.start_time = now_date.getTime();
		stmt.bindInt64Parameter(5, info.start_time);
		stmt.bindInt32Parameter(6, id);
		stmt.execute();
		stmt.reset();
		
		info.status = 6;
		info.video_economy = (info.video_economy)?1:0;
		return info;
	},
	updateProgress: function(id, info) {
		if(!id || isNaN(id)) { return false; }
		var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `current_bytes` = ?1, `max_bytes` = ?2 WHERE `id` = ?3");
		stmt.bindUTF8StringParameter(0, info.current);
		stmt.bindUTF8StringParameter(1, info.max);
		stmt.bindInt32Parameter(2, id);
		stmt.execute();
		stmt.reset();
		
		var content = {current_bytes: info.current, max_bytes: info.max};
		return content;
	},
	updateComplete: function(id, stat) {
		/* Update info and set status = 1 (completed) / 2 (canceled) / 3 (failed) */
		if(!id) { return false; }

		var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1, `end_time` = ?2 WHERE `id` = ?3");
		stmt.bindInt32Parameter(0, stat);
		now_date = new Date();
		var end_time = now_date.getTime();
		stmt.bindInt64Parameter(1, end_time);
		stmt.bindInt32Parameter(2, id);
		stmt.execute();
		stmt.reset();

		var content = {status: stat, end_time: end_time};
		return content;
	},
	remove: function (id) {
		try
		{
			var stmt = this.db_connect.createStatement("DELETE FROM `smilefox` WHERE `id` = ?1");
			stmt.bindInt32Parameter(0, id);
			stmt.execute();
			stmt.reset();
			return true;	
		}
		catch(e)
		{
		}
	},
}

/* Export Symbol: nicofox_download_manager
   Providing communication between download manager interface and core
*/
var nicofox_download_manager = 
{
   getDownloads: function() {
	rows = smilefox_sqlite.select();
	return rows;
   },

   searchDownloads: function(keywords) {
   	if (typeof keywords != 'Array') return new Array();
	rows = smilefox_sqlite.search(keywords);
	return rows;
   },

   getDownloadCount: function() {
     return download_count;

   },
   getWaitingCount: function() {
     return (waiting_count - download_count);

   },
   add: function(Video, url) {
     var content = smilefox_sqlite.add(Video, url);
     triggerDownloadListeners('add', content.id, content);
     download_runner.prepare();
   },

   remove: function(id, dont_callback)
   {
	if (smilefox_sqlite.remove(id) && !dont_callback) {
  	  triggerDownloadListeners('remove', id, {});
	}  
   },
   cancel: function(id)
   {
     download_runner.cancel(id);
   },
   cancelAll: function()
   {
     download_runner.cancelAll();
   },
   retry: function(id)
   {
     download_runner.retry(id);
   },
   go: function()
   {
	download_runner.prepare();
   }
}

var download_count = 0;
var waiting_count = 0;
var download_max = 2;
var download_runner =
{
	ready: false,
	query: new Array(),
	initialize: function()
	{
		
		if (this.ready)
		{ return false; }
		downloads = smilefox_sqlite.select();
		/* If there is something remained unexpected status, we will let it fail */
		for (i=0; i< downloads.length; i++)
		{
			if (downloads[i].status > 4)
			{
			  smilefox_sqlite.updateStatus(downloads[i].id, 3); 
  			  triggerDownloadListeners('update', downloads[i].id, {status: 3});
			  
			}
		}
		this.ready = true;
	},
	prepare: function() 
	{
		if (!this.ready)
		{ this.initialize(); }
		if (unloading)
		{ return; }

		/* Re-select so we can purge our content */
		downloads = smilefox_sqlite.select();
		i = downloads.length - 1;
		waiting_count = 0;
		while (i >= 0)
		{
			if (downloads[i].status == 0)
			{
				waiting_count++;
				if (download_count >= download_max) {
				  i--; continue;
				}
				had_done = false;
				download_count++;
				smilefox_sqlite.updateStatus(downloads[i].id, 5);
  			  	triggerDownloadListeners('update', downloads[i].id, {status: 5});
				new_query = {id: downloads[i].id};
				var k = this.query.push(new_query) - 1;
				
				this.query[k].progress_change_count = 0;	
				this.query[k].processCallback = function(type, content, id)
				{
					
					/* To prevent "stop" to be called when canceled */
					if(this.downloader.canceled == true && type != 'cancel' && type != 'fail')
					{ return; }

					switch(type)
					{
						/* Parsing is done, and file is ready to write */
						case 'file_ready':
						var info = smilefox_sqlite.updateInfo(id, content);
  			  			triggerDownloadListeners('update', id, info);
						
						break;

						/* Video download is started */
						case 'start':
						var info = smilefox_sqlite.updateStatus(id, 7);
  			  			triggerDownloadListeners('update', id, {status: 7});
						break;

						case 'progress_change':
						var info = smilefox_sqlite.updateProgress(id, content);
  			  			triggerDownloadListeners('update', id, info);
						break;

						case 'stop':
						/* It is "protected" by the below part so will be executed only for download completed */
						var row = smilefox_sqlite.selectId(id);	
						/* If the download is incomplete, we will consider it as failed */
						if (row.current_bytes != row.max_bytes)
						{
							this.downloader.removeFiles();
							this.processCallback('fail', {}, id);
    							var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
						                      .getService(Ci.nsIPromptService);
							prompts.alert(null, strings.getString('errorTitle'), strings.getString('errorIncomplete'));
							return;
						}

						/* Finialize download */
						this.downloader.movie_prepare_file.remove(false);
						this.downloader.movie_file.moveTo(null, this.downloader.file_title+'.'+this.downloader.type);

						var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
						download_count--;

						var info = smilefox_sqlite.updateComplete(id, 1);
  			  			triggerDownloadListeners('update', id, info);
						had_done = true;
						download_runner.prepare();
						break;

						case 'fail':
						var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
						download_count--;

						var info = smilefox_sqlite.updateComplete(id, 3);
  			  			triggerDownloadListeners('update', id, info);
						download_runner.prepare();
						break;

						case 'cancel':
						var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
						download_count--;

						var info = smilefox_sqlite.updateComplete(id, 2);
  			  			triggerDownloadListeners('update', id, info);
						download_runner.prepare();
						break;
					}
				}


				this.query[k].downloader = new smileFoxDownloader();
				this.query[k].downloader.callback = hitchFunction(this.query[k], 'processCallback', downloads[i].id); // query.length will be next query id
				this.query[k].downloader.file_title = fixReservedCharacters(downloads[i].video_title);
				this.query[k].downloader.comment_type = downloads[i].comment_type;
				this.query[k].downloader.init(downloads[i].comment_id);
			}

			i--;
		}
		/* When all done, display it */
		if (download_count == 0 && had_done)
		{ allDone(); }
		else if (download_count == 0)
  		{ triggerDownloadListeners('stop', null, null); }
	},
	cancel: function(id)
	{
		for (i = 0; i < this.query.length; i++)
		{
			if (this.query[i].id == id && this.query[i].downloader)
			{
				this.query[i].downloader.cancel();
			}
		}
	},
	cancelAll: function()
	{
		for (i = 0; i < this.query.length; i++)
		{
			if (this.query[i].downloader)
			{
				this.query[i].downloader.cancel();
			}
		}
	},
	retry: function(id)
	{
		var row = smilefox_sqlite.selectId(id);	
		/* Reset, then retry query */
		if (row.status == 2 || row.status == 3)
		{
			smilefox_sqlite.updateStatus(id, 0);
 			triggerDownloadListeners('update', id, {status: 0});

			download_runner.prepare();
		}
	},
};
/* All done message */
function allDone() {
  var alerts_service = Components.classes["@mozilla.org/alerts-service;1"]
                       .getService(Components.interfaces.nsIAlertsService);
  alerts_service.showAlertNotification("chrome://nicofox/skin/nicofox_content.png", 
                                    "NicoFox download completed", "NicoFox has done video downloads.", 
                                    false, "", null);

}

/* Fix common reserved characters in filesystems by converting to full-width */
function fixReservedCharacters(title)
{
	title = title.replace(/\//g, '／');
	title = title.replace(/\\/g, '＼');
	title = title.replace(/\?/g, '？');
	title = title.replace(/\%/g, '％');
	title = title.replace(/\*/g, '＊');
	title = title.replace(/\:/g, '：');
	title = title.replace(/\|/g, '｜');
	title = title.replace(/\"/g, '”');
	title = title.replace(/\</g, '＜');
	title = title.replace(/\>/g, '＞');
	title = title.replace(/\+/g, '＋');
	/* Windows FAT specified... */
	title = title.replace(/\[/g, '〔');
	title = title.replace(/\]/g, '〕');
	return title;
}

