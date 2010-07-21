/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Manages video downloads, including scheduler for higher-qualiy videos and (some) amount control
 *
 * The status for downloads:
 *  0: Queued
 *  1: Completed
 *  2: Canceled
 *  3: Failed
 *  
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "nicofox", "DownloadManager" ];

let DownloadManager = {};
/* Store private objects of the download manager */
let DownloadManagerPrivate = {};

if (!nicofox) { var nicofox = {}; }
Components.utils.import('resource://nicofox/download_helper.js');
Components.utils.import('resource://nicofox/common.js');
Components.utils.import("resource://nicofox/Services.jsm");
Components.utils.import("resource://nicofox/Core.jsm");

/* Is the download manager currently up? */
var working = false;

/* Number of videos downloading */
var activeDownloadCount = 0;
var waiting_count = 0;
var downloadMax = Core.prefs.getIntPref("download_max");

/* Are we in private browsing mode? */
var inPrivate = false;

/* Observe the maxium number of downloads allowed in pref, change it after changed */
var prefObserver = {
  observe: function(subject, topic, data) {
    if (topic == "nsPref:changed" && data == "download_max") {
      downloadMax = Core.prefs.getIntPref("download_max");
    }
  },
  register: function() {
    Core.prefs.addObserver("download_max", this, false);
  },
  unregister: function() {
    Core.prefs.removeObserver("download_max", this, false);
  },
};

/* Make a observer to check the private mode (for Fx 3.1b2+) and the quitting of the browser */
var downloadObserver = {
  observe: function(subject, topic, data) {
    switch(topic) {
      case "quit-application-requested":
      if (activeDownloadCount > 0) {
        if (!Services.prompt.confirm(null, 
                                     Core.strings.getString('closeSmileFoxTitle'),
                                     Core.strings.getString('closeSmileFoxMsg'))){
          subject.QueryInterface(Ci.nsISupportsPRBool);
          subject.data = true;
          return;
        }
       this.unregisterReq();
      }
      break;
      
      case "quit-application":
      working = false;
      download_runner.cancelAll();
      this.unregisterGra();
      prefObserver.unregister();
      break;
      
      case "private-browsing":
      if (data == 'enter') {
        inPrivate = true;
      } else if (data == 'exit') {
        working = false;
        download_runner.cancelAll();
        inPrivate = false;
      	smilefox_sqlite.cleanPrivate();
        triggerDownloadListeners('rebuild', null, null); 
        working = true;
      }
      break;
    }
  },
  register: function() {
    Services.obs.addObserver(this, "quit-application-requested", false);
    Services.obs.addObserver(this, "quit-application", false);
    Services.obs.addObserver(this, "private-browsing", false);
  },
  unregisterReq: function() {
    Services.obs.removeObserver(this, "quit-application-requested");
  },
  unregisterGra: function() {
    Services.obs.removeObserver(this, "quit-application");
    Services.obs.removeObserver(this, "private-browsing", false);
  }
}


/* Space to store all download listeners */
var downloadListeners = [];

/* A function to call all of the listeners */
function triggerDownloadListeners(listener_event, id, content)
{
  var i;
  if ((typeof listener_event) != 'string') {return false;}
  for (i = 0; i < downloadListeners.length; i++)
  { 
    if ((typeof downloadListeners[i][listener_event]) == 'function')
    { downloadListeners[i][listener_event].call(downloadListeners[i], id, content); }
  }
}

/* Database Schemas */
var dbSchemaString = '("id" INTEGER PRIMARY KEY  NOT NULL  , "url" VARCHAR , "video_id" VARCHAR , "comment_id" VARCHAR , "comment_type" VARCHAR , "video_title" VARCHAR , "description" TEXT, "tags" VARCHAR, "video_type" VARCHAR , "video_economy" VARCHAR , "video_file" VARCHAR , "comment_file" VARCHAR , "uploader_comment_file" VARCHAR, "thumbnail_file" VARCHAR, "current_bytes" INTEGER , "max_bytes" INTEGER , "start_time" INTEGER , "end_time" INTEGER , "add_time" INTEGER , "info" TEXT, "status" INTEGER, "in_private" INTEGER )';

var dbFieldsString = "'id', 'url', 'video_id', 'comment_id', 'comment_type', 'video_title', 'description', 'tags', 'video_type', 'video_economy', 'video_file', 'comment_file', 'uploader_comment_file', 'thumbnail_file', 'current_bytes', 'max_bytes', 'start_time', 'end_time', 'add_time', 'info', 'status', 'in_private'";

var dbFields =  ['id', 'url', 'video_id', 'comment_id', 'comment_type', 'video_title', 'description', 'tags', 'video_type', 'video_economy', 'video_file', 'comment_file', 'uploader_comment_file', 'thumbnail_file', 'current_bytes', 'max_bytes', 'start_time', 'end_time', 'add_time', 'info', 'status', 'in_private'];

/************************************************************************/
/************************************************************************/
/************************************************************************/
var smilefox_sqlite = {
  /* Cache the SQLite Result */
  rows_cache: [],
  cached: false,
  /* Is asynchronous query running? */
  asyncRunning: false,
  /* Is the database clear (first-run clean up)? */
  clearStatus: false,
  /* Are we at private browsing mode? */
  //inPrivate: false,
  /* Record field names (will be convient for Async fetch) */
  fields: ['id', 'url', 'video_id', 'comment_id', 'comment_type', 'video_title', 'description', 'tags', 'video_type', 'video_economy', 'video_file', 'comment_file', 'uploader_comment_file', 'thumbnail_file', 'current_bytes', 'max_bytes', 'start_time', 'end_time', 'add_time', 'info', 'status', 'in_private'],
  load: function() {
    /* Private Browsing checking */
    try {  
      var privateSvc = Components.classes["@mozilla.org/privatebrowsing;1"]  
                                 .getService(Components.interfaces.nsIPrivateBrowsingService);  
      inPrivate = privateSvc.privateBrowsingEnabled;  
    } catch(ex) {
      /* Exception called from Fx 3.1b2- should be ignored */
    }  
    
    var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
    file.append("smilefox.sqlite");

    if (!file.exists()) {
      /* Add the smilefox database/ table if it is not established */
      this.db_connect = Services.storage.openDatabase(file);
      this.createTable();

      Core.prefs.setBoolPref('first_run', false);
      Core.prefs.setBoolPref('first_run_0.3', false);
    } else {
      /* Otherwise we will open the database */
      this.db_connect = Services.storage.openDatabase(file);

      /* Check and update the database as needed */
      if (Core.prefs.getBoolPref('first_run') || Core.prefs.getBoolPref('first_run_0.3')) {
        this.checkUpgrade();
      }
    }

  },
  /* Table creation */
  createTable: function() {
    if (!this.db_connect) {return;}
    var sql = 'CREATE TABLE IF NOT EXISTS "smilefox" ("id" INTEGER PRIMARY KEY  NOT NULL  , "url" VARCHAR , "video_id" VARCHAR , "comment_id" VARCHAR , "comment_type" VARCHAR , "video_title" VARCHAR , "description" TEXT, "tags" VARCHAR, "video_type" VARCHAR , "video_economy" VARCHAR , "video_file" VARCHAR , "comment_file" VARCHAR , "uploader_comment_file" VARCHAR, "thumbnail_file" VARCHAR, "current_bytes" INTEGER , "max_bytes" INTEGER , "start_time" INTEGER , "end_time" INTEGER , "add_time" INTEGER , "info" TEXT, "status" INTEGER, "in_private" INTEGER )' ;
    var statement = this.db_connect.createStatement(sql);
    statement.execute();
    this.purgeCache();
    
  },
  /* Table creation */
  cleanPrivate: function() {
    if (!this.db_connect) {return;}
    var sql = 'DELETE FROM smilefox WHERE in_private = 1';
    var statement = this.db_connect.createStatement(sql);
    statement.execute();
    statement.reset();
    this.purgeCache();
    
  },
  fetchArray: function(statement) {
    // FIXME: typeof check
    var i = 0;
    var rows = new Array();

    while (statement.executeStep()) {
      rows[i] = new Object();
      for (var j = 0; j < statement.columnCount; j++) {
        var name = statement.getColumnName(j);
        var value = null;
        switch(statement.getTypeOfIndex(j))
        {
          case 0: // VALUE_TYPE_NULL
          value = null;
          break;
          case 1: // VALUE_TYPE_INTEGER 
          if (name == 'start_time') {
            /* getInt64 implementation has a bug */
            value = statement.getUTF8String(j).valueOf();
          }
          else {
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
  purgeCache: function() {
    this.rows_cache = [];
    this.cached = false;
  },
  /* Select data from Database */
  select: function() {
    if (!this.db_connect) {this.load();}
    if (this.cached) { return this.rows_cache; }
    var statement = this.db_connect.createStatement("SELECT * FROM smilefox ORDER BY id DESC");
    statement.execute();
    var rows = this.fetchArray(statement);
    this.rows_cache = rows;
    this.cached = true;
    statement.reset();
    return rows.concat();
  },
  /* Use asynchronous queries, supported in 1.9.1+ 
  */
  selectAsync: function(successCallback, failCallback) {
    if (!this.db_connect) {this.load();}
    /* Fetch from cache */
    if (this.cached) {
      successCallback(this.rows_cache.concat());
      return;
    }
    /* Prevent multiple queries at once */
    if (this.asyncRunning) {
      failCallback();
      return;
    }
    /* Callback should be a function */
    if (typeof successCallback != 'function') { return; }
    if (typeof failCallback != 'function') { return; }
    this.asyncRunning = true;

    /* Prepare cache */
    this.rows_cache = new Array();
    var statement = this.db_connect.createStatement("SELECT * FROM smilefox ORDER BY id DESC");
    var callback = {
      successCallback: function(rows) {
        /* Record rows cache */
        smilefox_sqlite.rows_cache = rows.concat();
        smilefox_sqlite.cached = true;
        successCallback(rows);
      },
      failCallback: failCallback,
    };
    this.executeAsync(statement, true, callback);
  },
  /* Execute the statement asynchrously */
  executeAsync: function(statement, isSelect, callback) {
    var statements = [];
    /* For the first time, execute some maintenance queries */
    if (!this.clearStatus) {
      statements.push(this.db_connect.createStatement("DELETE FROM `smilefox` WHERE `in_private` = 1"));
      statements.push(this.db_connect.createStatement("UPDATE `smilefox` SET `status` = 3 WHERE `status` > 4"));
      this.clearStatus = true;
    }
    /* Push the requested statement */
    statements.push(statement);
    /* Implementation of MozIStorageStatementCallback */
    if (isSelect) {
      callback.cache = [];
      /* handleResult will be used in SELECT only */
      callback.handleResult = function(aResultSet) {
        for (var row = aResultSet.getNextRow(); row ; row = aResultSet.getNextRow()) {
	  var rowObj = new Object();
          for (var i = 0; i < smilefox_sqlite.fields.length; i++) {
            rowObj[smilefox_sqlite.fields[i]] = row.getResultByName(smilefox_sqlite.fields[i]); 
          }
          this.cache.push(rowObj);
        }
      };
    }
    callback.handleError =  function(error) {
      Components.utils.error('[nicofox] Error during SQLite Queries:' + error.message);
    };
    callback.handleCompletion = function(aReason) { 
      smilefox_sqlite.asyncRunning = false;
      /* Handle error */
      if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
        this.failCallback();
        return;
      }
      /* Return callback, with/without rows data */
      if (isSelect) {
        this.successCallback(this.cache);
      } else {
        this.successCallback();
      }
    };  
    this.db_connect.executeAsync(statements, statements.length, callback);
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
/************************************************************************/
/************************************************************************/
/************************************************************************/
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
    statement.bindInt32Parameter(7, (inPrivate)?1:0);

    statement.execute();
    statement.reset();
    this.purgeCache();

    var content = {
    id: this.db_connect.lastInsertRowID,
    url: url, video_id: Video.id, comment_id: Video.v, comment_type: Video.comment_type, video_title: Video.title, add_time: add_time,
    start_time: 0, current_bytes: 0, max_bytes: 0,
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
      stmt.bindInt32Parameter(1, (inPrivate)?1:0);
      stmt.bindInt32Parameter(2, id);
      stmt.execute();
      stmt.reset();
      this.purgeCache();
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
    this.purgeCache();
    
    info.status = 5;
    info.video_economy = (info.video_economy)?1:0;
    return info;
  },
  updatePath: function(id, info) {
    if(!id || isNaN(id)) { return false; }
    var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `video_file` = ?1 , `comment_file` = ?2 WHERE `id` = ?3");
    stmt.bindUTF8StringParameter(0, info.video_file);
    stmt.bindUTF8StringParameter(1, info.comment_file);
    stmt.bindInt32Parameter(2, id);
    stmt.execute();
    stmt.reset();
    this.purgeCache();
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
    this.purgeCache();
    
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
    this.purgeCache();
    
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
    this.purgeCache();
    
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
    this.purgeCache();
    
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
      this.purgeCache();
      return true;  
    }
    catch(e)
    {
    }
  },
}
/* Statement Storage */
var storedStatements = { /* ... */ };

/* Generate a mozIStorageStatementCallback implementation.
 * @param callerName       Function name using the callback. Used in error log message.
 * @param thisObj          this object for the callback
 * @param successCallback  Name of callback function in thisObj, called if the statement finished successfully
 * @param failCallback     Name of callback function in thisObj, called if the statement failed.
 * @param selectFields     Array, if assigned, it will generate handleResult() implementation, read fields assigned in this array.
 * If there is more parameter present, they will be appended into successCallback.
 */
function generateStatementCallback(callerName, thisObj, successCallback, failCallback, selectFields) {
  /* Prepare a callback storage */
  var callback = {};
  /* Implement handleResult if needed */
  if (selectFields && Object.prototype.toString.call(selectFields) === "[object Array]") {
    if (selectFields.length > 0) {
      callback.resultArray = [];
      callback.handleResult = function(aResultSet) {
        for (var row = aResultSet.getNextRow(); row ; row = aResultSet.getNextRow()) {
	        var rowObj = new Object();
          for (var i = 0; i < selectFields.length; i++) {
            rowObj[selectFields[i]] = row.getResultByName(selectFields[i]); 
          }
          this.resultArray.push(rowObj);
        }
      };
    }
  }
  callback.handleError =  function(aError) {
    Components.utils.error("NicoFox DownloadManager Down: Error during SQLite Queries on " + callerName + ":" + aError.message);
    thisObj[failCallback].call(thisObj);
  };
  callback.handleCompletion = function(aReason) { 
    /* Check for completion reason */
    if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
      Components.utils.error("NicoFox DownloadManager Down: Error during SQLite Queries on " + callerName + ", Reason:" + aReason);
      return;
    }
    /* Append extra parameters */
    var argsArray = [this.resultArray];
    if (arguments.length > 5) {
      argsArray.push(arguments.splice(5, arguments.length - 5));
    }
    /* Call the callback */
    thisObj[successCallback].apply(thisObj, argsArray);
  };
  return callback;  
}

/* Private */

/* Store mozIStorageConnection of the download manager database */
DownloadManagerPrivate.dbConnection = null;

/* Create Download Manager Table if not exists */
DownloadManagerPrivate.createTable =  function() {
  var statement = this.dbConnection.createStatement("CREATE TABLE IF NOT EXISTS smilefox" + dbSchemaString);
  var callback = generateStatementCallback("createTable", this, "finishStartup", "failStartup")
  statement.executeAsync(callback);
}
/* Check the database schema, if the schema is the old (0.1) one, call DownloadManagerPrivate.executeUpgrde. */
DownloadManagerPrivate.checkUpgrade = function() {
  /* Read fields infos */
  var statement = this.dbConnection.createStatement("PRAGMA table_info (smilefox)");
  var callback = generateStatementCallback("checkUpgrade", this, "executeUpgrade", "failStartup", [name])
  statement.executeAsync(callback);
};

/* Run the upgrade after the schema check */
DownloadManagerPrivate.executeUpgrade = function(resultArray) {
  /* Check if we need to upgrade db */
  var needUpgrade = true;
  for (var i = 0; i < resultArray.length; i++) {
    if (resultArray[i].name == "uploader_comment_file") {
      needUpgrade = false;
    }
  }
  if (!needUpgrade) {
    Components.utils.reportError("No Upgrade Required!");
    DownloadManagerPrivate.finishStartup();
    return;
  }
  Components.utils.reportError("Need Upgrade!");
  /* Backup DB (may be failed!) */
  var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  file.append("smilefox.sqlite");
  try {
    file.copyTo(null, "smilefox-upgrade0.6-backup" + Date.parse(new Date()) + ".sqlite");
  } catch (e) {
    /* Do not block upgrade */
    Components.utils.error("Unable to backup database from NicoFox 0.1.");
  }
  /* Use the way in http://www.sqlite.org/faq.html#q11 to regenerate table.
     executeAsync() with multiple statement will create a transaction, so no need to do this manually. */
  var statements = [];
  /* Step 1: add new column and clean up */
  statements.push(this.dbConnection.createStatement("UPDATE smilefox SET `status` = 2 WHERE `status` > 4")); /* Cleanup */
  statements.push(this.dbConnection.createStatement("ALTER TABLE smilefox ADD COLUMN `description` TEXT"));
  statements.push(this.dbConnection.createStatement("ALTER TABLE smilefox ADD COLUMN `tags` VARCHAR"));
  statements.push(this.dbConnection.createStatement("ALTER TABLE smilefox ADD COLUMN `uploader_comment_file` VARCHAR"));
  statements.push(this.dbConnection.createStatement("ALTER TABLE smilefox ADD COLUMN `thumbnail_file` VARCHAR"));
  statements.push(this.dbConnection.createStatement("ALTER TABLE smilefox ADD COLUMN `info` TEXT"));
  statements.push(this.dbConnection.createStatement("ALTER TABLE smilefox ADD COLUMN `in_private` INTEGER DEFAULT 0"));
  /* Step 2: remove one column */
  statements.push(this.dbConnection.createStatement(
  'CREATE TEMPORARY TABLE smilefox_upgrade' + dbSchemaString + ";\n" +
  "INSERT INTO smilefox_upgrade SELECT " + dbFieldsString + " FROM smilefox;\n" +
  "DROP TABLE smilefox;\n" +
  "CREATE TABLE smilefox" + dbSchemaString + ";\n" +
  "INSERT INTO smilefox SELECT " + dbFieldsString + " FROM smilefox_upgrade;\n" + 
  "DROP TABLE smilefox_upgrade;"));
 
  var callback = generateStatementCallback("executeUpgrade", this, "finishStartup", "failStartup")
  this.dbConnection.executeAsync(statements, statements.length, callback);
};
/* Clean the table status: (1) Private browsing remaining items (2) Halt downloading items */
DownloadManagerPrivate.cleanUp = function() {
  var statements = [];
  statements.push(this.dbConnection.createStatement("DELETE FROM `smilefox` WHERE `in_private` = 1"));
  statements.push(this.dbConnection.createStatement("UPDATE `smilefox` SET `status` = 3 WHERE `status` > 4"));
  var callback = generateStatementCallback("executeUpgrade", this, "finishStartup", "failStartup")
  this.dbConnection.executeAsync(statements, statements.length, callback);
}
/* Run after creation/clean up/upgrade */
DownloadManagerPrivate.finishStartup = function() {
  Core.prefs.setBoolPref('first_run', false);
  Core.prefs.setBoolPref('first_run_0.3', false); 
  working = true;
};
/* Handle failed startup */
DownloadManagerPrivate.failStartup = function() {
};

/* Public */

/* Startup script (this should be loaded on profile-after-changed event?) */
DownloadManager.startup = function() {
  /* Load the observer */
  prefObserver.register();
  downloadObserver.register();
  
  /* Private Browsing checking XXX: 1.9.1b2- compatibility */
  var privateSvc = Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService);
  inPrivate = privateSvc.privateBrowsingEnabled;  
    
  var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  file.append("smilefox.sqlite");

  DownloadManagerPrivate.dbConnection = Services.storage.openDatabase(file);
  if (!file.exists()) {
    /* Add the smilefox database/ table if it is not established */
    DownloadManagerPrivate.createTable();

    Core.prefs.setBoolPref('first_run', false);
    Core.prefs.setBoolPref('first_run_0.3', false);
  } else {
    /* Check and update the database as needed */
    if (Core.prefs.getBoolPref('first_run') || Core.prefs.getBoolPref('first_run_0.3')) {
      DownloadManagerPrivate.checkUpgrade();
    } else {
      DownloadManagerPrivate.cleanUp();
    }
  }
}

/* Asynchorouslly get all items in the download manager */
DownloadManager.getDownloads = function(thisObj, successCallback, failCallback) {
  if (!working) {
    Components.utils.reportError("DownloadManager is not working. This should not be happened.");
    thisObj[failCallback].call(thisObj);
    return;
  }
  /* Use stored statment if exists, or createa a new one.
   * executeAsync will reset the statement, so no need to reset. */
  if (!storedStatements.getDownloads) {
    storedStatements.getDownloads = DownloadManagerPrivate.dbConnection.createStatement("SELECT * FROM `smilefox` ORDER BY `id` DESC");
  }
  var callback = generateStatementCallback("getDownloads", thisObj, successCallback, failCallback, dbFields);
  storedStatements.getDownloads.executeAsync(callback);
};

DownloadManager.getDownload = function(id, thisObj, successCallback, failCallback) {
  if (!working) {
    Components.utils.reportError("DownloadManager is not working. This should not be happened.");
    thisObj[failCallback].call(thisObj);
    return;
  }
  /* Use stored statment if exists, or create a new one.
   * executeAsync will reset the statement, so no need to reset. */
  if (!storedStatements.getDownload) {
    storedStatements.getDownload = DownloadManagerPrivate.dbConnection.createStatement("SELECT * FROM `smilefox` WHERE `id` = :id");
  }
  storedStatements.getDownload.params.id = id;
  var callback = generateStatementCallback("getDownload", thisObj, successCallback, failCallback, dbFields);
  storedStatements.getDownload.executeAsync(callback);

};

/* Add a download entry to be proceed by download manager.
 * Note that video info will be read AFTER the entry was added.
 */
DownloadManager.addDownload = function(url) {
  if (!working) {
    Components.utils.reportError("DownloadManager is not working. This should not be happened.");
    thisObj[failCallback].call(thisObj);
    return;
  }
  /* Use stored statment if exists, or create a new one. */
  if (!storedStatements.addDownload) {
    storedStatements.addDownload = DownloadManagerPrivate.dbConnection.createStatement("INSERT INTO `smilefox` (`url`, `video_title`, `add_time`, `status`, `in_private`) VALUES (:url, :video_title, :add_time, :status, :in_private)");
  }
  /* Beware: reset(); won't clear any params. Make sure to reset all params! */
  var params = {};
  params.url = url;
  params.video_title = url.slice(url.lastIndexOf("/") + 1);
  params.add_time = new Date().getTime();
  /* If no preload is required, set the status to -1 (info pending).
     Otherwise, set it to 0 (queued). */
  if (Core.prefs.getBoolPref("preload_info_before_download")) {
    params.status = -1;
  } else {
    params.status = 0;
  }
  params.in_private = (inPrivate)?1:0;
  for (var key in params) {
    storedStatements.addDownload.params[key] = params[key];
  }
  /* lastInsertRowID is not reliable in asynchorous execution, so do it synchrously */
  storedStatements.addDownload.execute();
  storedStatements.addDownload.reset();
  var lastInsertRowID = DownloadManagerPrivate.dbConnection.lastInsertRowID;
//  params.id = lastInsertRowId;
  triggerDownloadListeners('add', lastInsertRowID, params);
};

DownloadManager.addListener = function(listener) {
 downloadListeners.push(listener);
};
DownloadManager.removeListener = function(listener) {
  downloadListeners.splice(downloadListeners.indexOf(listener), 1);
};

/* Readonly */
DownloadManager.__defineGetter__("working", function() {
  return working;
}
);
DownloadManager.__defineGetter__("activeDownloadCount", function() {
  return activeDownloadCount;
}
);
DownloadManager.__defineGetter__("DBConnection", function() {
  return DownloadManagerPrivate.dbConnection;
}
);

/* 
   Providing communication between download manager interface and core
*/
nicofox.download_manager = 
{
   /* There may be multiple instances waiting for select result,
      put a tray and notify all instances for results when done. 
   */
   selectTray: [],
   /* Use Async query to get download lists  */
   getDownloadsAsync: function(callback) {
     /* Put callback into tray */
     if (typeof callback != 'function') { return; }
     this.selectTray.push(callback);
     /* Run selectAsync for first item only */
     if (this.selectTray.length == 1) {
       smilefox_sqlite.selectAsync(nicofox.hitch(this, 'processAsyncResults'), nicofox.hitch(this, 'processAsyncError'));
     }
   },
   /* Run all callbacks in tray */
   processAsyncResults: function(rows) {
     for (var i = 0; i < this.selectTray.length; i++) {
       this.selectTray[i].call(null, rows);
     }
     /* Empty the tray */
     this.selectTray = [];
   },
   processAsyncError: function() {
     Components.utils.reportError('[nicofox] Error occured in getDownloadsAsync SQLite queries');
   },
   getDownloadCount: function() {
     return activeDownloadCount;

   },
   getWaitingCount: function() {
     return waiting_count;

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
   moveFile: function(id, video_file, comment_file) {
     var info = smilefox_sqlite.updatePath(id, {video_file: video_file, comment_file: comment_file});
     triggerDownloadListeners('update', id, info);
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

/* A internal download scheduler */
var download_runner =
{
  stopped: true,
  download_triggered: 0,
  download_canceled: 0,
  timer: null,
  hitEconomy: false, /* For economy mode notification */
  inEconomy: false, /* For cheking current mode */
  query: new Array(),
  /* Make download manager start running */
  start: function() {
    this.stopped = false;
  },
  prepare: function() {
    if (!working || this.stopped)
    { return; }
    /* Re-select so we can purge our content */
    nicofox.download_manager.getDownloadsAsync(nicofox.hitch(download_runner, 'prepareCallback'));//smilefox_sqlite.select();
  },
  /* After download list asynchronously received */
  prepareCallback: function(downloads) {
    var i = downloads.length - 1;
    waiting_count = 0;
  
    while (i >= 0)
    {
      if (downloads[i].status == 0 || (downloads[i].status == 4 && !this.inEconomy))
      {
        waiting_count++;
        if (activeDownloadCount >= downloadMax) {
          i--;
          continue;
        }
	waiting_count--;
        /* Now download begins */
	this.download_triggered++;
        activeDownloadCount++;
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
            activeDownloadCount--;
            this.downloader.removeFiles();

            var info = smilefox_sqlite.updateScheduled(id);
            triggerDownloadListeners('update', id, info);
	    download_runner.download_canceled++;  
	    download_runner.inEconomy = true;
	    download_runner.hitEconomy = true;

            /* Run the economy timer */
	    if (!download_runner.timer) {
              download_runner.timer = Cc["@mozilla.org/timer;1"]
                                      .createInstance(Ci.nsITimer);
              download_runner.timer.initWithCallback( nicofox_timer, 600000, Ci.nsITimer.TYPE_REPEATING_SLACK);
	    }
            download_runner.prepare();
            break;

            /* Economy mode is off */
            case 'economy_off':
	    download_runner.inEconomy = false;
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
              Services.prompt.alert(null, Core.strings.getString('errorTitle'), Core.strings.getString('errorIncomplete'));
              return;
            }
            smilefox_sqlite.updateBytes(id, {current_bytes: this.downloader.current_bytes, max_bytes: this.downloader.max_bytes});
            var info = smilefox_sqlite.updateStatus(id, 6);
            triggerDownloadListeners('update', id, {status: 6});
            break;

            case 'video_fail':
            /* If the download observer says we fail */
            this.downloader.removeFiles();
            this.downloader.fail();
            Services.prompt.alert(null, Core.strings.getString('errorTitle'), Core.strings.getString('errorIncomplete'));
            break;

            case 'completed':
            /* Finialize download */
            this.downloader.movie_prepare_file.remove(false);
            this.downloader.movie_file.moveTo(null, this.downloader.file_title+'.'+this.downloader.type);

            var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
            activeDownloadCount--;

            var info = smilefox_sqlite.updateComplete(id);
            triggerDownloadListeners('update', id, info);
            download_runner.prepare();
            break;

            case 'fail':
            var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
            activeDownloadCount--;
            this.downloader.removeFiles();

            var info = smilefox_sqlite.updateStopped(id, 3);
            triggerDownloadListeners('update', id, info);
	    download_runner.download_canceled++;  
            download_runner.prepare();
            break;

            case 'fail2': /* Do not remove files */
            var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
            activeDownloadCount--;

            var info = smilefox_sqlite.updateStopped(id, 3);
            triggerDownloadListeners('update', id, info);
	    download_runner.download_canceled++;  
            download_runner.prepare();
            break;
             
            case 'cancel':
            var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
            activeDownloadCount--;

            var info = smilefox_sqlite.updateStopped(id, 2);
            triggerDownloadListeners('update', id, info);
	    download_runner.download_canceled++;  
            download_runner.prepare();
            break;
          }
        }

	if (downloads[i].url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\//)) {
          /* It is nicovideo */
          this.query[k].downloader = new DownloadUtils.Nico();
	  if (downloads[i].video_economy) {
            this.query[k].downloader.has_economy = true;
	  } else {
	    this.query[k].downloader.has_economy = false;
	  }
//        } else if (downloads[i].url.match(/^http:\/\/parasitestage\.net\//)) {
//          this.query[k].downloader = new nicofox.download.helper.parasite();
        }


        this.query[k].downloader.callback = nicofox.hitch(this.query[k], 'processCallback', downloads[i].id); // query.length will be next query id
        /* FIXME: Check the filename scheme! */
        var file_title = Core.prefs.getComplexValue('filename_scheme', Ci.nsISupportsString).data;
        file_title = file_title.replace(/\%TITLE\%/, nicofox.fixReservedCharacters(downloads[i].video_title));
        file_title = file_title.replace(/\%ID\%/, nicofox.fixReservedCharacters(downloads[i].video_id));
                    /* Add comment filename */
        if (downloads[i].comment_type != 'www' && downloads[i].comment_type)
        {
          file_title = file_title.replace(/\%COMMENT\%/, nicofox.fixReservedCharacters('['+downloads[i].comment_type+']'));
        }
        else
        {
          file_title = file_title.replace(/\%COMMENT\%/, '');
        }

        /* XXX: Workaround for NMM videos */
        this.query[k].downloader.video_id = downloads[i].video_id;

        this.query[k].downloader.file_title = file_title;
        this.query[k].downloader.comment_type = downloads[i].comment_type;
        this.query[k].downloader.init(downloads[i].comment_id);
      }
      i--;
    }
    /* When all done, display it */
    if (activeDownloadCount == 0) {
      if (!this.stopped && (this.download_triggered - this.download_canceled) > 0) {
        allDone();
      }
      if (download_runner.hitEconomy) {
        /* Economy is on, so something is not downloaded */
        if (Core.prefs.getBoolPref('economy_notice')) {
          var check = {value: false};
          Services.prompt.alertCheck(null, Core.strings.getString('economyNoticeTitle'), Core.strings.getString('economyNoticeMessage'), Core.strings.getString('economyNoticeNeverAsk') , check);
	  if (check.value) {
            Core.prefs.setBoolPref('economy_notice', false);
	  }
	}
        download_runner.hitEconomy = false;
      }
      this.download_triggered = 0;
      this.download_canceled = 0;
      this.stopped = true;
      triggerDownloadListeners('stop', null, null); 
    }
  },
  cancel: function(id)
  {
    for (var i = 0; i < this.query.length; i++)
    {
      if (this.query[i].id == id && this.query[i].downloader)
      {
        this.query[i].downloader.cancel();
      }
    }
  },
  cancelAll: function()
  {
    for (var i = 0; i < this.query.length; i++)
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
    var now = new Date();

    /* Economy mode is fired when 19-2 in Japan time (UTC+9) => 10-17 in UTC time */
    if (now.getUTCHours() >= 17 || now.getUTCHours() < 10) {
      download_runner.inEconomy = false;
      download_runner.timer.cancel();
      download_runner.timer = null;
      nicofox.download_manager.go();
    } 
    else
    {
      download_runner.inEconomy = true;
    }
  }
};


/* All done message */
function allDone() {
  var alerts_service = Components.classes["@mozilla.org/alerts-service;1"]
                       .getService(Components.interfaces.nsIAlertsService);
  alerts_service.showAlertNotification("chrome://nicofox/skin/logo.png", 
                                    Core.strings.getString('alertCompleteTitle'), Core.strings.getString('alertCompleteText'), 
                                    false, "", null);

}



