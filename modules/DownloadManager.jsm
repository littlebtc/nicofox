/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Manages video downloads, including scheduler for higher-qualiy videos and (some) amount control
 *
 * The status for downloads:
 * -1: Wait for user prompt
 *  0: Queued
 *  1: Completed
 *  2: Canceled
 *  3: Failed
 *  4: Hi-quality pending
 *  5: Video info reading 
 *  6: New video downloading
 *  7: Updated item for video is downloading (was: downloading comments)
 *  8: Stopped
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "DownloadManager" ];

let DownloadManager = {};
/* Store private objects of the download manager */
let DownloadManagerPrivate = {};

if (!nicofox) { var nicofox = {}; }
Components.utils.import("resource://nicofox/Services.jsm");
Components.utils.import("resource://nicofox/Core.jsm");

/* Is the download manager (database and other components) currently up? */
var working = false;

/* Is the download progress stopped? */
var stopped = false;

/* Is the Nico Nico Douga currently in the economy (low quality) mode? */
var atEconomyMode = false;
/* Is there any video downloads economy mode, so that we can prompt it to the user? */
var hitEconomy = false;
/* A timer instance to check the status of the economy mode. */
var economyModeCheckTimer;


/* Number of videos downloading */
var activeDownloadCount = 0;
var waiting_count = 0;
var downloadMax = 0;

/* Are we in private browsing mode? */
var inPrivateBrowsing = false;

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
      DownloadManager.cancelAllDownloads();
      this.unregisterGra();
      prefObserver.unregister();
      break;
      
      case "private-browsing":
      if (data == 'enter') {
        inPrivateBrowsing = true;
      } else if (data == 'exit') {
        DownloadManager.cancelAllDownloads();
        inPrivateBrowsing = false;
      	DownloadManagerPrivate.exitPrivateBrowsing();
        triggerDownloadListeners('rebuild', null, null); 
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
  var functionArguments = Array.prototype.slice.call(arguments);
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
    Components.utils.reportError("NicoFox DownloadManager Down: Error during SQLite Queries on " + callerName + ":" + aError.message);
    thisObj[failCallback].call(thisObj);
  };
  callback.handleCompletion = function(aReason) {
    /* Check for completion reason */
    if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
      Components.utils.reportError("NicoFox DownloadManager Down: Error during SQLite Queries on " + callerName + ", Reason:" + aReason);
      return;
    }
    /* Append extra parameters */
    var argsArray = [];
    if (this.resultArray) {
      argsArray.push(this.resultArray);
    }
    if (functionArguments.length > 5) {
      for (var i = 5; i < functionArguments.length; i++) {
      argsArray.push(functionArguments[i]);
      }
    }
    /* Call the callback */
    thisObj[successCallback].apply(thisObj, argsArray);
  };
  return callback;  
}

/* A instance to run thumbnail fetching. */
var thumbnailFetcher = {};
/* Is fetcher running? */
thumbnailFetcher.running = false;
/* Cached undone and running items */
thumbnailFetcher.undoneItems = [];
thumbnailFetcher.runningItems = [];
thumbnailFetcher.itemCount = 0;

/* Record all items, start fetcher. Called from DownloadManager.fetchThumbnail(). */
thumbnailFetcher.start = function(resultArray) {
  /* Avoid conflict */
  if (this.running) { return false; }
  this.running = true;
  /* Load necessary queue and cached the total count. */
  this.undoneItems = resultArray;
  this.itemCount = resultArray.length;
  /* Prepare SQLite statement model to clone */
  this.statementModel = DownloadManagerPrivate.dbConnection.createStatement("UPDATE `smilefox` SET `thumbnail_file` = :thumbnail_file WHERE `id` = :id");
  triggerDownloadListeners('thumbnailFetcherCount', null, this.itemCount);
  this.processItem();
};
/* Proccess a specific number of items at a time. (XXX: more to decrease the number of SQLite I/O fetches?)
 * Use DownloadUtils.multipleHelper and assign a callback to write the record back to SQLite.
 */
thumbnailFetcher.processItem = function() {
  if (this.undoneItems.length == 0) { return; }
  this.runningItem = this.undoneItems.shift();
  Components.utils.import("resource://nicofox/DownloadUtils.jsm");
  Components.utils.reportError("Process " + this.runningItem.id);
  /* Check if the video files exists */
  var videoFilePath = this.runningItem.video_file;
  var videoFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  videoFile.initWithPath(videoFilePath);
  if(!videoFile.exists()) {
    Components.utils.reportError("notexist!");
    this.finishWrite();
    return;
  }
  var thumbFilePath = videoFilePath.replace(/\.[0-9a-z]{3}$/i, "[ThumbImg].jpeg"); // XXX: NicoPlayer compatibility? FileBundle?
  var thumbFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  thumbFile.initWithPath(thumbFilePath);
  /* XXX: is there exception? */
  var videoIdNum = parseInt(this.runningItem.video_id.substring(2), 10);
  var serverChooser = Math.ceil(Math.random() * 4);
  var dlHelper = new DownloadUtils.multipleHelper(this, "writeDb");
  dlHelper.addDownload("http://tn-skr" + serverChooser +".smilevideo.jp/smile?i=" + videoIdNum, "", null, thumbFile, false);
  this.runningItem.thumbnail_file = thumbFilePath;
  this.runningItem.thumbnail_url = Services.io.newFileURI(thumbFile).spec;
  dlHelper.doneAdding(); 
};
/* Write data into database */
thumbnailFetcher.writeDb = function() {
  Components.utils.reportError("Running " + this.runningItem.id);
  triggerDownloadListeners('thumbnailAvailable', this.runningItem.id, this.runningItem.thumbnail_url);
  var statement = this.statementModel.clone();
  statement.params.thumbnail_file = this.runningItem.thumbnail_file;
  statement.params.id = this.runningItem.id;
  var callback = generateStatementCallback("thumbnailFetcher.writeDb", this, "finishWrite", "dbFail")
  statement.executeAsync(callback);
};

/* After database written, update progress, schedule for next process */
thumbnailFetcher.finishWrite = function() {
  Components.utils.reportError("Done " + this.runningItem.id);
  triggerDownloadListeners('thumbnailFetcherProgress', null, this.itemCount - this.undoneItems.length);
  if (this.undoneItems.length == 0) {
    Core.prefs.setBoolPref("thumbnail_check", true);
    allDone(); // XXX
  }
  else { 
    var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback( { notify: function() { thumbnailFetcher.processItem(); } }, 500, Ci.nsITimer.TYPE_ONE_SHOT);
  }
}

/* Respond for DownloadManager.fetchThumbnail error */
thumbnailFetcher.dbFail = function() {
  Components.utils.reportError("dbError");
};


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
  var callback = generateStatementCallback("checkUpgrade", this, "executeUpgrade", "failStartup", ["name"])
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
    Components.utils.reportError("Unable to backup database from NicoFox 0.1.");
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
  statements.push(this.dbConnection.createStatement("ALTER TABLE smilefox ADD COLUMN `in_private` INTEGER DEFAULT 0")); // HACK
  /* Step 2: remove one column */
  statements.push(this.dbConnection.createStatement(
  "CREATE TEMPORARY TABLE smilefox_upgrade" + dbSchemaString + ";\n" +
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
  /* Startup the Download Queue Runner. XXX: this will hit dirty profile performance! */
  downloadQueueRunner.startup();
};

/* When exiting the private browsing mode, clear all items with in_private = 1 */
DownloadManagerPrivate.exitPrivateBrowsing = function() {
  var statement = this.dbConnection.createStatement("DELETE FROM `smilefox` WHERE `in_private` = 1");
  /* XXX: Except for avoiding conflict, why still makes this statement run in the main thread??? */
  statement.execute();
  statement.reset();
};

/* After receiving record for the download that needs to retry, call downloadQueueRunner to run it. */
DownloadManagerPrivate.afterRetryDownloadRead = function(resultArray) {
  var item = resultArray[0];
  /* Only allow retrying to failed or canceled item. */
  if (item.status != 2 && item.status != 3) { return; }
  /* Reset the status. */
  DownloadManagerPrivate.updateDownload(item.id, {status: 0});

  downloadQueue.push(item);
  downloadQueueRunner.process();
};

/* Handle failed startup */
DownloadManagerPrivate.failStartup = function() {
  
};
/* Handle failed statement operation */
DownloadManagerPrivate.dbFail = function() {
};

/* Process the result from DownloadManager.addDownload(). */
DownloadManagerPrivate.failAddingDownloadInfo = function(url, reason) {
  Components.utils.reportError(reason);
}

/* Actaully add download item and put it into the queue after the simple info is read.  */
DownloadManagerPrivate.initializeDownload = function(url, info) {
  /* Use stored statment if exists, or create a new one. */
  if (!storedStatements.addDownload) {
    storedStatements.addDownload = DownloadManagerPrivate.dbConnection.createStatement("INSERT INTO `smilefox` (`url`, `video_title`, `add_time`, `status`, `in_private`) VALUES (:url, :video_title, :add_time, :status, :in_private)");
  }
  /* Beware: reset(); won't clear any params. Make sure to reset all params! */
  var params = {};
  params.url = url;
  params.video_title = info.nicoData.title;
  params.add_time = new Date().getTime();
  /* XXX: !!! If no preload is required, set the status to -1 (info pending).
     Otherwise, set it to 0 (queued). */
  //if (Core.prefs.getBoolPref("preload_info_before_download")) {
    //params.status = -1;
  //} else {
    params.status = 0;
  //}
  params.in_private = (inPrivateBrowsing)?1:0;
  for (var key in params) {
    storedStatements.addDownload.params[key] = params[key];
  }
  /* lastInsertRowID is not reliable in asynchronous execution, so do it synchronously */
  storedStatements.addDownload.execute();
  storedStatements.addDownload.reset();
  var lastInsertRowID = DownloadManagerPrivate.dbConnection.lastInsertRowID;
  /* Trigger download listeners and push it to the download queue.
   * Beware: params are just referenced not cloned! Don't try to modify anything on it. */
  params.id = lastInsertRowID;
  triggerDownloadListeners("downloadAdded", lastInsertRowID, params);
  downloadQueue.push(params);
  downloadQueueRunner.process();
};

/* Update download item with given parameters
 * XXX: will it better to split it out to several cases and cache statements, like what we do in 0.3.x?
 */ 
DownloadManagerPrivate.updateDownload = function(id, params) {
  if (!working) {
    Components.utils.reportError("DownloadManager is not working. This should not be happened.");
    return;
  }
  var sqlString = "UPDATE `smilefox` SET ";
  for (var key in params) {
    /* Prevent injection */
    if(key.search(/[^[0-9a-z\_]/) != -1) { return; }
    sqlString += "`" + key + "` = :" + key + ",";
  }
  sqlString = sqlString.slice(0, -1) + " WHERE `id` = :id";
  var statement = this.dbConnection.createStatement(sqlString);
  /* Assume params have right params... */
  for (var key in params) {
    statement.params[key] = params[key];
  }
  statement.params.id = id;
  statement.execute();
  triggerDownloadListeners('downloadUpdated', id, params);
};

/* Notify deleted downloads */
DownloadManagerPrivate.notifyRemovedDownload = function(id) {
  triggerDownloadListeners('downloadRemoved', id);

};

/* Public */

/* Startup script (this should be loaded on profile-after-changed event?) */
DownloadManager.startup = function() {
  /* Load the observer */
  prefObserver.register();
  downloadObserver.register();
  
  /* Private Browsing checking XXX: 1.9.1b2- compatibility */
  var privateSvc = Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService);
  inPrivateBrowsing = privateSvc.privateBrowsingEnabled;  
    
  /* Read the preference */
  downloadMax = Core.prefs.getIntPref("download_max");

  /* Set default download path */  
  if (!Core.prefs.getComplexValue("save_path", Ci.nsISupportsString).data) {
    Components.utils.import("resource://nicofox/FileBundle.jsm");
    FileBundle.setDefaultPath();
  }

  var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  file.append("smilefox.sqlite");

  if (!file.exists()) {
    DownloadManagerPrivate.dbConnection = Services.storage.openDatabase(file);
    /* Add the smilefox database/ table if it is not established */
    DownloadManagerPrivate.createTable();

    Core.prefs.setBoolPref("first_run", false);
    Core.prefs.setBoolPref("first_run_0.3", false);
  } else {
    DownloadManagerPrivate.dbConnection = Services.storage.openDatabase(file);
    /* Check and update the database as needed */
    if (Core.prefs.getBoolPref("first_run") || Core.prefs.getBoolPref("first_run_0.3")) {
      DownloadManagerPrivate.checkUpgrade();
    } else {
      DownloadManagerPrivate.cleanUp();
    }
  }
}

/* Check if user upgraded from a old version that don't support thumbnail download,
 * by checking if the thumbnail_file in database is filled.
 * Callback will return how many records had thumbnail file.
 */
DownloadManager.checkThumbnail = function(thisObj, successCallback, failCallback) {
  /* This won't need to store; we expect to use this at once only. */
  var statement = DownloadManagerPrivate.dbConnection.createStatement("SELECT COUNT(`thumbnail_file`) AS count FROM `smilefox` WHERE `thumbnail_file` IS NOT NULL");
  var callback = generateStatementCallback("checkThumbnail", thisObj, successCallback, failCallback, ["count"]);
  statement.executeAsync(callback);
};

/* Thumbnail fetching, step 1: get all records without thumbnail file.
 * Result will be exposed via download observer, so no need to make callback.
 */
DownloadManager.fetchThumbnails = function() {
  var statement = DownloadManagerPrivate.dbConnection.createStatement("SELECT * FROM `smilefox` WHERE `thumbnail_file` IS NULL AND `status` = 1 ORDER BY `id` DESC");
  var callback = generateStatementCallback("fetchThumbnails", thumbnailFetcher, "start", "dbFail", dbFields);
  statement.executeAsync(callback);
};

/* Asynchronously get all items in the download manager */
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
/* Get single download. XXX: Why return array instead of object? */
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

/* Add a download entry, check it, then be proceed by download manager.
 * Note that video info will be read AFTER the entry was added.
 */
DownloadManager.addDownload = function(url, info) {
  /* XXX: URL Checker should not be here. */
  if (!/^http:\/\/(?:www|tw|de|es)\.nicovideo\.jp\/watch\/(?:[a-z]{0,2}[0-9]+)$/.test(url)) { return; }
  /* Ask the "Simple info" of the video. FIXME: Does this require an extra query? */
  Components.utils.import("resource://nicofox/VideoInfoReader.jsm");
  VideoInfoReader.readByUrl(url, true, DownloadManagerPrivate, "initializeDownload", "failAddingDownloadInfo");
};

/* If the download is running, cancel the download. */
DownloadManager.cancelDownload = function(id) {
  if (activeDownloads[id] && activeDownloads[id].downloader) {
    activeDownloads[id].downloader.cancel();
  }
};
/* Cancel all downloads. */
DownloadManager.cancelAllDownloads = function() {
  for (var id in activeDownloads) {
    if (activeDownloads[id].downloader) {
      activeDownloads[id].downloader.cancel();
    }
  }
};
/* Retry download: Read video download first, then call DownloadManagerPrivate. */
DownloadManager.retryDownload = function(id) {
  DownloadManager.getDownload(id, DownloadManagerPrivate, "afterRetryDownloadRead", "dbFail");
};

/* Remove download item for given ID. 
 * Result should be handled by listener. XXX: but how about error handling?
 */
DownloadManager.removeDownload = function(id) {
  if (!working) {
    Components.utils.reportError("DownloadManager is not working. This should not be happened.");
    thisObj[failCallback].call(thisObj);
    return;
  }
  /* Use stored statment if exists, or create a new one.
   * executeAsync will reset the statement, so no need to reset. */
  if (!storedStatements.removeDownload) {
    /* To be sure we will not remove item in progress. */
    storedStatements.removeDownload = DownloadManagerPrivate.dbConnection.createStatement("DELETE FROM `smilefox` WHERE `id` = :id AND `status` NOT IN (5,6,7)");
  }
  storedStatements.removeDownload.params.id = id;
  var callback = generateStatementCallback("removeDownload", DownloadManagerPrivate, "notifyRemovedDownload", "dbFail", null, id);
  storedStatements.removeDownload.executeAsync(callback);
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
DownloadManager.__defineGetter__("queuedDownloadCount", function() {
  return downloadQueue.length;
}
);
DownloadManager.__defineGetter__("DBConnection", function() {
  return DownloadManagerPrivate.dbConnection;
}
);

/* Download Queue to store the waiting downloads */
var downloadQueue = [];

/* Store active downloads in id-based hash */
var activeDownloads = {};
var activeDownloadCount = 0;

/* A internal download queue runner */
var downloadQueueRunner = {};

/* During the startup (or re-startup when economy mode is off), fetch the queued items only */
downloadQueueRunner.startup = function() {
  if (!working) {
    Components.utils.reportError("DownloadManager is not working. This should not be happened.");
    thisObj[failCallback].call(thisObj);
    return;
  }
  /* Find item with "queued" status, or "high-quality pending" status when economy mode is off. */
  var extraQuery = "";
  var statement = DownloadManagerPrivate.dbConnection.createStatement("SELECT * FROM `smilefox` WHERE `status` = 0 OR `status` = 4" + extraQuery + " ORDER BY `id` ASC");
  var callback = generateStatementCallback("downloadQueueRunner.startup", this, "prepareQueue", "dbFail", dbFields);
  statement.executeAsync(callback);
};

/* Write the initial items of the queue. */
downloadQueueRunner.prepareQueue = function(resultArray) {
  /* Directly points the result to the downloadQueue */
  downloadQueue = resultArray;
};

/* When economy timer off, add status = 4 (hi-quality pending) items */
downloadQueueRunner.rescheduleEconomyItem = function() {
  if (!working) {
    Components.utils.reportError("DownloadManager is not working. This should not be happened.");
    thisObj[failCallback].call(thisObj);
    return;
  }
  var statement = DownloadManagerPrivate.dbConnection.createStatement("SELECT * FROM `smilefox` WHERE `status` = 4 ORDER BY `id` ASC");
  var callback = generateStatementCallback("downloadQueueRunner.rescheduleEconomyItem", this, "prepareEconomyQueue", "dbFail", dbFields);
  statement.executeAsync(callback);
};

/* Write "High-quality penging" item in the queue. */
downloadQueueRunner.prepareEconomyQueue = function(resultArray) {
  /* Directly points the result to the downloadQueue */
  downloadQueue = downloadQueue.concat(resultArray);
  /* XXX: This will hit only if download is running and something is out of economy, or the timer calls that the economy mode is all.
     In both cases we need to check the queue. But can we split it out? */
  downloadQueueRunner.process();
};

/* Remove economy items when we hit economy mode to make queue contains no high quality pending videos (will be added after economy timer hit) */
downloadQueueRunner.removeEconomyItems = function() {
  downloadQueue = downloadQueue.filter(function(element, index, array) {
    return (element.status != 4);
  });
};
/* Check and (re-)process some items enter/exit the queue. */
downloadQueueRunner.process = function() {
  if (stopped) { return; }
  Components.utils.reportError(JSON.stringify(downloadQueue));
  while(downloadQueue.length > 0 && activeDownloadCount < downloadMax) {
    var item = downloadQueue.shift();
    /* If we are sure that economy mode is enabled (e.g. first hi-quality pending video falls into economy mode) , don't process it. */
    if (item.status == 4 && atEconomyMode) {
      continue;
    }
    /* Initialize object */
    activeDownloads[item.id] = { url: item.url };
    activeDownloadCount++;
    /* Start the download */
    downloadQueueRunner.initDownloader(item.id, item.video_economy);

    /* Change the status to "downloading" in the database */
    DownloadManagerPrivate.updateDownload(item.id, {"status": 7, "start_time": new Date().getTime()});
  }
  /* Call the listeners that queue had changed */
  triggerDownloadListeners("queueChanged", null, {});
  
  if (downloadQueue.length == 0 && activeDownloadCount == 0) {
    allDone();
  }
};

/* Initialize downloader(DownloadUtils.nico) to really start download */
downloadQueueRunner.initDownloader = function(id, videoEconomy) {
  Components.utils.import("resource://nicofox/DownloadUtils.jsm");
  activeDownloads[id].downloader = new DownloadUtils.nico();
  /* Assign callback and database id (for callback) */
  activeDownloads[id].downloader.callback = handleDownloaderEvent;
  activeDownloads[id].downloader.dbId = id;
  activeDownloads[id].downloader.previousAtEconomy = (videoEconomy == 1);
  activeDownloads[id].downloader.init(activeDownloads[id].url);
};

/* Respond for downloadQueueRunner-related SQL error */
downloadQueueRunner.dbFail = function() {
  Components.utils.reportError("dbError");
};

/* Handle downloader (DownloadUtils.nico) events. In the function, this will be the downloader instance. */
function handleDownloaderEvent(type, content) {
  /* To prevent "stop" to be called when canceled */
  if(this.canceled == true && type != "cancel" && type != "fail") { return; }
  var id = this.dbId;
  
  switch(type) {
    /* Parsing is done, and file is ready to write */
    case "file_ready":
    DownloadManagerPrivate.updateDownload(id, content);
    break;
    
    /* Economy mode is on, and user don't want to download low-quality one */
    case "economy_break":
    delete(activeDownloads[id]);
    activeDownloadCount--;
     
    /* Notify we are hitting the economy mode */
	  atEconomyMode = true;
	  hitEconomy = true;

    /* Run the economy timer */
	  if (!economyModeCheckTimer) {
      economyModeCheckTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      economyModeCheckTimer.initWithCallback( economyTimerCallback, 600000, Ci.nsITimer.TYPE_REPEATING_SLACK);
	  }
    /* Update Download Manager Record */
    DownloadManagerPrivate.updateDownload(id, {"status": 4, "video_title": content.video_title, "video_economy": 1});
 	  downloadQueueRunner.removeEconomyItems();
 	  downloadQueueRunner.process();
    break;

    /* Downloader found the economy mode is off for any "High-quality" video */
    case "economy_off":
    /* Do nothing recently. :P */
	  break;

    /* Video download is started */
    case "start":
    break;

    case "progress_change":
    /* Do not update the progress, performance will be bad */
    triggerDownloadListeners("downloadProgressUpdated", id, content);
    break;

    case "video_done":
    triggerDownloadListeners("downloadVideoCompleted", id, content);
    break;
    
    case "video_fail":
    /* If the download observer says we fail */
    delete(activeDownloads[id]);
    activeDownloadCount--;
    
    Services.prompt.alert(null, Core.strings.getString("errorTitle"), Core.strings.getString("errorIncomplete"));
    DownloadManagerPrivate.updateDownload(id, {"status": 3, "end_time": new Date().getTime()});
 	  downloadQueueRunner.process(); 
    break;
    
    case "thumbnail_done":
    Components.utils.reportError("!");
    triggerDownloadListeners("thumbnailAvailable", id, content);
    break;

    case "completed":
    /* Finialize download */
    delete(activeDownloads[id]);
    activeDownloadCount--;
    
    DownloadManagerPrivate.updateDownload(id, 
    {"status": 1, "end_time": new Date().getTime(), "current_bytes": content.videoBytes, "max_bytes": content.videoBytes});
 	  downloadQueueRunner.process(); 
    break;

    case "fail":
    delete(activeDownloads[id]);
    activeDownloadCount--;

    DownloadManagerPrivate.updateDownload(id, {"status": 3, "end_time": new Date().getTime()});
 	  downloadQueueRunner.process(); 
    break;

    case "cancel":
    delete(activeDownloads[id]);
    activeDownloadCount--;
    DownloadManagerPrivate.updateDownload(id, {"status": 2, "end_time": new Date().getTime()});
 	  downloadQueueRunner.process(); 
    break;
  }
}

/* Economy mode timer */
var economyTimerCallback = {
  notify: function(timer) {
    var now = new Date();

    /* Economy mode is fired when 19-2 in Japan time (UTC+9) => 10-17 in UTC time */
    if (now.getUTCHours() >= 17 || now.getUTCHours() < 10) {
      atEconomyMode = false;
      timer.cancel();
      downloadQueueRunner.rescheduleEconomyItem();
    } 
    else
    {
      atEconomyMode = true;
    }
  }
};


/* All done message */
function allDone() {
  var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  /* XXX: WIP */
  if (hitEconomy) {
    alertsService.showAlertNotification("chrome://nicofox/skin/logo.png", 
                                    Core.strings.getString('alertCompleteTitle'), "...But some video is in low quality and will be downloaded later.", 
                                    false, "", null);
    hitEconomy = false;
  } else {
    alertsService.showAlertNotification("chrome://nicofox/skin/logo.png", 
                                    Core.strings.getString('alertCompleteTitle'), Core.strings.getString('alertCompleteText'), 
                                    false, "", null);
  }
}
