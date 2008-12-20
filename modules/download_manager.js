var Cc = Components.classes;
var Ci = Components.interfaces;

var EXPORTED_SYMBOLS = ['nicofox_download_listener', 'nicofox_download_manager', 'nicofox_download_observer'];
Components.utils.import('resource://nicofox/smilefox_downloader.js');
Components.utils.import('resource://nicofox/common.js');

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
var unloading = false;

var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService);
prefs = prefs.getBranch("extensions.nicofox.");

/* Watch download max modification */
prefs.QueryInterface(Ci.nsIPrefBranch2);

var prefs_observer = 
{
  observe: function(subject, topic, data) {
    if (topic == 'nsPref:changed' && data == 'download_max') {
      download_max = prefs.getIntPref('download_max');
    }
  },
  register: function() {
    prefs.addObserver('', this, false);
  },
  unregister: function() {
    prefs.removeObserver('', this, false);
  },
};

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
       prefs_observer.unregister();
    } else if (topic == 'private-browsing') {
      if (data == 'enter') {
        smilefox_sqlite.in_private = true;
      } else if (data == 'exit') {
        unloading = true;
        download_runner.cancelAll();
        smilefox_sqlite.in_private = false;
	smilefox_sqlite.cleanPrivate();
        triggerDownloadListeners('rebuild', null, null); 
      }
    }
  },
  register: function() {
    var observer_service = Cc["@mozilla.org/observer-service;1"]
                          .getService(Ci.nsIObserverService);
    observer_service.addObserver(this, "quit-application-requested", false);
    observer_service.addObserver(this, "quit-application", false);
    observer_service.addObserver(this, "private-browsing", false);
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
    observer_service.removeObserver(this, "private-browsing", false);
  }
}
prefs_observer.register();
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
    { download_listeners[i][listener_event].call(null, id, content); }
  }
}


var smilefox_sqlite = {
  in_private: false,
  load: function() {
    /* Private Browsing checking */
    try {  
      var private_service = Components.classes["@mozilla.org/privatebrowsing;1"]  
                                      .getService(Components.interfaces.nsIPrivateBrowsingService);  
      this.in_private = private_service.privateBrowsingEnabled;  
    } catch(ex) {
      /* Exception called from Fx 3.1b2- should be ignored */
    }  
    
    var file = Cc["@mozilla.org/file/directory_service;1"]
              .getService(Ci.nsIProperties)
              .get("ProfD", Ci.nsIFile);
    file.append("smilefox.sqlite");

    if (!file.exists()) {
      /* Add the smilefox database/ table if it is not established */
      var storage_service = Components.classes["@mozilla.org/storage/service;1"]
                                      .getService(Components.interfaces.mozIStorageService);
      this.db_connect = storage_service.openDatabase(file);
      this.createTable();
    } else {
      /* Otherwise we will open the database */
      var storageService = Components.classes["@mozilla.org/storage/service;1"]
                          .getService(Components.interfaces.mozIStorageService);
      this.db_connect = storageService.openDatabase(file);

      /* Check and update the database as needed */
      if (prefs.getBoolPref('first_run') || prefs.getBoolPref('first_run_0.3')) {
        this.checkUpgrade();
      }

      /* Privacy */
      this.cleanPrivate();
    }

  },
  /* Table creation */
  createTable: function() {
    if (!this.db_connect) {return;}
    var sql = 'CREATE TABLE IF NOT EXISTS "smilefox" ("id" INTEGER PRIMARY KEY  NOT NULL  , "url" VARCHAR , "video_id" VARCHAR , "comment_id" VARCHAR , "comment_type" VARCHAR , "video_title" VARCHAR , "description" TEXT, "tags" VARCHAR, "video_type" VARCHAR , "video_economy" VARCHAR , "video_file" VARCHAR , "comment_file" VARCHAR , "uploader_comment_file" VARCHAR, "thumbnail_file" VARCHAR, "current_bytes" INTEGER , "max_bytes" INTEGER , "start_time" INTEGER , "end_time" INTEGER , "add_time" INTEGER , "info" TEXT, "status" INTEGER, "in_private" INTEGER )' ;
    var statement = this.db_connect.createStatement(sql);
    statement.execute();
    
  },
  /* 0.1 Database Upgrade check */
  checkUpgrade: function() {
    Components.utils.reportError('CheckUpgrade!');
    if (!this.db_connect) {return;}
    /* Read fields infos */
    var statement = this.db_connect.createStatement("PRAGMA table_info (smilefox)");
    statement.execute();
    var rows = this.fetchArray(statement);
    statement.reset();
    var columns = [];
    for (i = 0; i < rows.length; i++) {
      columns.push(rows[i].name);
    }
    /* If the upgrade is needed ... */
    if (columns.indexOf('uploader_comment_file') == -1) {
      Components.utils.reportError('DB Upgrade!');

      /* Get everything we want */
      var rows = this.select();

      /* Backup DB (may be failed!) */
      var file = Cc["@mozilla.org/file/directory_service;1"]
                .getService(Ci.nsIProperties)
                .get("ProfD", Ci.nsIFile);
      file.append("smilefox.sqlite");
      try {
        file.copyTo(null, 'smilefox-upgrade0.3-backup'+Date.parse(new Date())+'.sqlite');
      } catch (e) {
        var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                      .getService(Ci.nsIPromptService);
        prompts.alert(null, strings.getString('errorTitle'), 'Cannot backup the old database!' );
	return;
      }
      /* BOOM! */
      var statement = this.db_connect.createStatement("DROP TABLE smilefox");
      statement.execute();
      statement.reset();

      /* Re-create the table */
      this.createTable();

      /* Now rewrite... */
      for (var i = 0; i < rows.length; i++) {
        /* Mark-as-failed check */
        if (rows[i].status > 4) {
	  rows[i].status = 2;
	}
	/* SQL String >"< */
        var sql = 'INSERT INTO smilefox (`url`, `video_id`, `comment_id`, `comment_type`, `video_title`, '
	+'`video_type`, `video_economy`, `video_file`, `comment_file`, `current_bytes`, '
	+'`max_bytes`, `start_time`, `end_time`, `add_time`, `status`, `in_private`)'
	+'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)';
	var statement = this.db_connect.createStatement(sql);
	statement.bindUTF8StringParameter(0, rows[i].url);
        statement.bindUTF8StringParameter(1, rows[i].video_id);
        statement.bindUTF8StringParameter(2, rows[i].comment_id);
        statement.bindUTF8StringParameter(3, rows[i].comment_type);
        statement.bindUTF8StringParameter(4, rows[i].video_title);
        statement.bindUTF8StringParameter(5, rows[i].video_type);
        statement.bindUTF8StringParameter(6, rows[i].video_economy);
        statement.bindUTF8StringParameter(7, rows[i].video_file);
        statement.bindUTF8StringParameter(8, rows[i].comment_file);
        statement.bindUTF8StringParameter(9, rows[i].current_bytes);
        statement.bindUTF8StringParameter(10, rows[i].max_bytes);
        statement.bindUTF8StringParameter(11, rows[i].start_time);
        statement.bindUTF8StringParameter(12, rows[i].end_time);
        statement.bindUTF8StringParameter(13, rows[i].add_time);
        statement.bindInt32Parameter(14, rows[i].status);
	/* Inprivate must be 0 */
        statement.bindInt32Parameter(15, 0);

	statement.execute();
	statement.reset();
      }
    }
    prefs.setBoolPref('first_run', false);
    prefs.setBoolPref('first_run_0.3', false);
  },
  /* Table creation */
  cleanPrivate: function() {
    if (!this.db_connect) {return;}
    var sql = 'DELETE FROM smilefox WHERE in_private = 1';
    var statement = this.db_connect.createStatement(sql);
    statement.execute();
    
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
    var statement = this.db_connect.createStatement("INSERT INTO smilefox (url, video_id, comment_id, comment_type, video_title, add_time, status, in_private) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)");
    statement.bindUTF8StringParameter(0, url);
    statement.bindUTF8StringParameter(1, Video.id);
    statement.bindUTF8StringParameter(2, Video.v);
    statement.bindUTF8StringParameter(3, Video.comment_type);
    statement.bindUTF8StringParameter(4, Video.title);
//    statement.bindUTF8StringParameter(5, Video.description);
    /* XXX: Space-separated for all websites? */
//    statement.bindUTF8StringParameter(6, Video.tags.join(' '));
    var now_date = new Date();
    var add_time = now_date.getTime();
    statement.bindInt32Parameter(5, add_time);
    statement.bindInt32Parameter(6, 0);
    statement.bindInt32Parameter(7, (this.in_private)?1:0);

    statement.execute();
    statement.reset();

    var content = {
    id: this.db_connect.lastInsertRowID,
    url: url, video_id: Video.id, comment_id: Video.v, comment_type: Video.comment_type, video_title: Video.title, add_time: add_time,
    status: 0
    };
    return content;
    
  },
  updateStatus: function (id, stat) {
    try
    {
      if(!id || isNaN(id)) { return false; }
      var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1, `in_private` = ?2 WHERE `id` = ?3");
      stmt.bindInt32Parameter(0, stat);
      stmt.bindInt32Parameter(1, (this.in_private)?1:0);
      stmt.bindInt32Parameter(2, id);
      stmt.execute();
      stmt.reset();
    }
    catch(e)
    {
    }
  },
  updateInfo: function(id, info) {
    if(!id || isNaN(id)) { return false; }
    var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1 , `video_type` = ?2 , `video_economy` = ?3 , `video_file` = ?4 , `comment_file` = ?5, `start_time` = ?6 WHERE `id` = ?7");
    stmt.bindInt32Parameter(0, 5);
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
    
    info.status = 5;
    info.video_economy = (info.video_economy)?1:0;
    return info;
  },

  updateBytes: function(id, info) {
    if(!id || isNaN(id)) { return false; }
    var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `current_bytes` = ?1, `max_bytes` = ?2 WHERE `id` = ?3");
    stmt.bindUTF8StringParameter(0, info.current_bytes);
    stmt.bindUTF8StringParameter(1, info.max_bytes);
    stmt.bindInt32Parameter(2, id);
    stmt.execute();
    stmt.reset();
    
    var content = {current_bytes: info.current_bytes, max_bytes: info.max_bytes};
    return content;
  },
  updateComplete: function(id) {
    /* Update info and set status = 1 (completed) */
    if(!id) { return false; }
      
    var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1, `end_time` = ?2 WHERE `id` = ?3");
    stmt.bindInt32Parameter(0, 1);
    now_date = new Date();
    var end_time = now_date.getTime();
    stmt.bindInt64Parameter(1, end_time);
    stmt.bindInt32Parameter(2, id);
    stmt.execute();
    stmt.reset();
    
    var content = {status: 1, end_time: end_time};
    return content;
  },

  updateStopped: function(id, stat) {
    /* Update info and set status = 1 (completed) / 2 (canceled) / 3 (failed) */
    if(!id) { return false; }
      
    var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1, `end_time` = ?2, `current_bytes` = ?3, `max_bytes` = ?4 WHERE `id` = ?5");
    stmt.bindInt32Parameter(0, stat);
    now_date = new Date();
    var end_time = now_date.getTime();
    stmt.bindInt64Parameter(1, end_time);
    stmt.bindInt32Parameter(2, 0);
    stmt.bindInt32Parameter(3, 0);
    stmt.bindInt32Parameter(4, id);
    stmt.execute();
    stmt.reset();
    
    var content = {status: stat, end_time: end_time, current_bytes: 0, max_bytes: 0};
    return content;
  },
  updateScheduled: function(id, info) {
    if(!id || isNaN(id)) { return false; }
    var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1 , `video_economy` = ?2 WHERE `id` = ?3");
    stmt.bindInt32Parameter(0, 4);
    stmt.bindUTF8StringParameter(1, 1);
    stmt.bindInt32Parameter(2, id);
    stmt.execute();
    stmt.reset();
    
    var info = new Object();
    info.status = 4;
    info.video_economy = 1;
    return info;
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
     download_runner.start();
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
  download_runner.start();
  download_runner.prepare();
   }
}

var download_count = 0;
var waiting_count = 0;
var download_max = prefs.getIntPref('download_max');
var download_runner =
{
  ready: false,
  is_stopped: true,
  download_triggered: 0,
  download_canceled: 0,
  timer: null,
  economy_switch: false,
  query: new Array(),
  initialize: function()
  {
    
  if (this.ready)
  { return false; }
  downloads = smilefox_sqlite.select();
  /* If there is something remained unexpected status, we will let it fail */
  for (i=0; i< downloads.length; i++) {
  if (downloads[i].status > 4)
      {
        smilefox_sqlite.updateStatus(downloads[i].id, 3); 
          triggerDownloadListeners('update', downloads[i].id, {status: 3});
        
      }
    }
    this.ready = true;
  },
  start: function() {
    this.is_stopped = false;
  },
  prepare: function() {
    if (!this.ready)
    { this.initialize(); }
    if (unloading || this.is_stopped)
    { return; }
    var economy_test = false;
    /* Re-select so we can purge our content */
    downloads = smilefox_sqlite.select();
    i = downloads.length - 1;
    waiting_count = 0;
    while (i >= 0)
    {
      if (downloads[i].status == 0 || (downloads[i].status == 4 && !this.economy_switch))
      {
        waiting_count++;
        if (download_count >= download_max) {
          i--;
          continue;
        }
        /* Now download begins */
	this.download_triggered++;
        download_count++;
        smilefox_sqlite.updateStatus(downloads[i].id, 5);
        triggerDownloadListeners('update', downloads[i].id, {status: 5});
        new_query = {id: downloads[i].id};
        var k = this.query.push(new_query) - 1;
        
        this.query[k].progress_change_count = 0;  
        this.query[k].processCallback = function(type, content, id) {

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

            /* Economy mode is on and user do not like it */
            case 'economy_break':
            var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
            download_count--;
            this.downloader.removeFiles();

            var info = smilefox_sqlite.updateScheduled(id);
            triggerDownloadListeners('update', id, info);
	    download_runner.download_canceled++;  
	    download_runner.economy_switch = true;

            /* Run the economy timer */
	    if (!download_runner.timer) {
              download_runner.timer = Cc["@mozilla.org/timer;1"]
                                      .createInstance(Ci.nsITimer);
              download_runner.timer.initWithCallback( nicofox_timer, 60000, Ci.nsITimer.TYPE_REPEATING_SLACK);
	    }
            download_runner.prepare();
            break;

            /* Economy mode is off */
            case 'economy_off':
	    download_runner.economy_switch = false;
	    if (download_runner.timer) {
              download_runner.timer.cancel();
	      download_runner.timer = null;
	    }
	    download_runner.prepare();
	    break;

            /* Video download is started */
            case 'start':
            var info = smilefox_sqlite.updateStatus(id, 7);
              triggerDownloadListeners('update', id, {status: 7});
            break;

            case 'progress_change':
            /* Do not update the progress, performance will be bad */
            this.downloader.current_bytes = content.current_bytes;
            this.downloader.max_bytes = content.max_bytes;
            triggerDownloadListeners('update', id, content);
            break;

            case 'video_done':
            /* It is "protected" by the below part so will be executed only for download completed */
            /* If the download is incomplete, we will consider it as failed */
            if (this.downloader.current_bytes != this.downloader.max_bytes) {
              this.downloader.removeFiles();
              this.downloader.fail();
                  var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                           .getService(Ci.nsIPromptService);
              prompts.alert(null, strings.getString('errorTitle'), strings.getString('errorIncomplete'));
              return;
            }
            smilefox_sqlite.updateBytes(id, {current_bytes: this.downloader.current_bytes, max_bytes: this.downloader.max_bytes});
            var info = smilefox_sqlite.updateStatus(id, 6);
            triggerDownloadListeners('update', id, {status: 6});
            break;

            case 'completed':
            /* Finialize download */
            this.downloader.movie_prepare_file.remove(false);
            this.downloader.movie_file.moveTo(null, this.downloader.file_title+'.'+this.downloader.type);

            var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
            download_count--;

            var info = smilefox_sqlite.updateComplete(id);
            triggerDownloadListeners('update', id, info);
	    download_runner.download_canceled++;  
            download_runner.prepare();
            break;

            case 'fail':
            var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
            download_count--;
            this.downloader.removeFiles();

            var info = smilefox_sqlite.updateStopped(id, 3);
            triggerDownloadListeners('update', id, info);
	    download_runner.download_canceled++;  
            download_runner.prepare();
            break;

            case 'cancel':
            var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
            download_count--;

            var info = smilefox_sqlite.updateStopped(id, 2);
            triggerDownloadListeners('update', id, info);
	    download_runner.download_canceled++;  
            download_runner.prepare();
            break;
          }
        }
        this.query[k].downloader = new smileFoxDownloader();
        this.query[k].downloader.callback = hitchFunction(this.query[k], 'processCallback', downloads[i].id); // query.length will be next query id
        /* FIXME: Check the filename scheme! */
        var file_title = prefs.getComplexValue('filename_scheme', Ci.nsISupportsString).data;
        file_title = file_title.replace(/\%TITLE\%/, fixReservedCharacters(downloads[i].video_title));
        file_title = file_title.replace(/\%ID\%/, fixReservedCharacters(downloads[i].video_id));
                    /* Add comment filename */
        if (downloads[i].comment_type != 'www')
        {
          file_title = file_title.replace(/\%COMMENT\%/, fixReservedCharacters('['+downloads[i].comment_type+']'));
        }
        else
        {
          file_title = file_title.replace(/\%COMMENT\%/, '');
        }

	if (downloads[i].video_economy) {
	  this.query[k].downloader.has_economy = true;
	} else {
	  this.query[k].downloader.has_economy = false;
	}
        this.query[k].downloader.file_title = file_title;
        this.query[k].downloader.comment_type = downloads[i].comment_type;
        this.query[k].downloader.init(downloads[i].comment_id);
      }
      i--;
    }
    /* When all done, display it */
    if (download_count == 0) {
      if (!this.is_stopped && (this.download_triggered - this.download_canceled) > 0) {
        allDone();
      }
      this.download_triggered = 0;
      this.download_canceled = 0;
      this.is_stopped = true;
      triggerDownloadListeners('stop', null, null); 
    }
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
    if (row.status >= 2 || row.status <= 4)
    {
      smilefox_sqlite.updateStatus(id, 0);
      triggerDownloadListeners('update', id, {status: 0});
      
      download_runner.start();
      download_runner.prepare();
    }
  },
};

/* Economy mode timer */
var nicofox_timer = {
  notify: function(timer) {
    var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Ci.nsIPromptService);
    var now = new Date();

    /* Economy mode is fired when 19-2 in Japan time (UTC+9) => 10-17 in UTC time */
    if (now.getUTCHours() >= 17 || now.getUTCHours() < 10) {
      displayNicoFoxMsg('NicoFox Timer: Economy mode seems to be off by your system time!');
      download_runner.economy_switch = false;
      download_runner.timer.cancel();
      download_runner.timer = null;
      nicofox_download_manager.go();
    } 
    else
    {
      download_runner.economy_switch = true;
    }
  }
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
function fixReservedCharacters(title) {
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
  //title = title.replace(/\[/g, '〔');
  //title = title.replace(/\]/g, '〕');
  return title;
}

