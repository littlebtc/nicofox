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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://nicofox/Core.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(DownloadManagerPrivate, "dts", "@mozilla.org/intl/scriptabledateformat;1", "nsIScriptableDateFormat");

/* Load the "DownloadUtils" from the toolkit to the toolkit.DownloadUtils.
   Note that is is NOT the DownloadUtils in NicoFox! */
let gre = {};
Components.utils.import("resource://gre/modules/DownloadUtils.jsm", gre);

/* Is the download manager (database and other components) currently up? */
var working = false;

/* Is the download progress paused? */
var paused = false;

/* Is the Nico Nico Douga currently in the economy (low quality) mode? */
var atEconomyMode = false;
/* Is there any video downloads economy mode, so that we can prompt it to the user? */
var hitEconomy = false;
/* A timer instance to check the status of the economy mode. */
var economyModeCheckTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

/* Is there any download started after queue runner is executed? */
var downloadTriggered = false;

/* Number of videos downloading */
var activeDownloadCount = 0;
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
 * @param resultCallback   Name of callback function in thisObj, called when the (part of) result from the statement is available.
                           If not assigned, results will be combined into one array and sent to successCallback.
 * If there is more parameter present, they will be appended into successCallback.
 */
function generateStatementCallback(callerName, thisObj, successCallback, failCallback, selectFields, resultCallback) {
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
        if (resultCallback) {
          thisObj[resultCallback].apply(thisObj, [this.resultArray]);
          this.resultArray = [];
        }
      };
    }
  }
  callback.handleError =  function(aError) {
    thisObj[failCallback].call(thisObj);
  };
  callback.handleCompletion = function(aReason) {
    /* Check for completion reason */
    if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
      thisObj[failCallback].call(thisObj);
      return;
    }
    /* Append extra parameters */
    var argsArray = [];
    if (this.resultArray) {
      argsArray.push(this.resultArray);
    }
    if (functionArguments.length > 6) {
      for (var i = 6; i < functionArguments.length; i++) {
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
  this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  this.processItem();
};
/* Proccess a specific number of items at a time. (XXX: more to decrease the number of SQLite I/O fetches?)
 * Use DownloadUtils.persistWorker and assign a callback to write the record back to SQLite.
 */
thumbnailFetcher.processItem = function() {
  if (this.undoneItems.length == 0) { return; }
  this.runningItem = this.undoneItems.shift();
  Components.utils.import("resource://nicofox/DownloadUtils.jsm");
  /* Check if the video files exists */
  var videoFilePath = this.runningItem.video_file;
  var videoFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  videoFile.initWithPath(videoFilePath);
  if(!videoFile.exists()) {
    this.writeEmptyToDb();
    return;
  }
  var thumbFilePath = videoFilePath.replace(/\.[0-9a-z]{3}$/i, "[ThumbImg].jpeg"); // XXX: NicoPlayer compatibility? FileBundle?
  var thumbFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  thumbFile.initWithPath(thumbFilePath);
  /* XXX: is there exception? */
  var videoIdNum = parseInt(this.runningItem.video_id.substring(2), 10);
  var serverChooser = Math.ceil(Math.random() * 4);
  this.runningItem.thumbnail_file = thumbFilePath;
  this.runningItem.thumbnail_url = Services.io.newFileURI(thumbFile).spec;
  var downloadWorker = new DownloadUtils.persistWorker({
    "url": "http://tn-skr" + serverChooser +".smilevideo.jp/smile?i=" + videoIdNum,
    "file": thumbFile
  });
  downloadWorker.then(this.onThumbnailFetched.bind(this), this.onThumbnailFailed.bind(this));
};
/* When thumbnail download is finished, write data into database, or append the item to retry when failed */
thumbnailFetcher.onThumbnailFetched = function() {
  triggerDownloadListeners('thumbnailAvailable', this.runningItem.id, this.runningItem.thumbnail_url);
  var statement = this.statementModel.clone();
  statement.params.thumbnail_file = this.runningItem.thumbnail_file;
  statement.params.id = this.runningItem.id;
  var callback = generateStatementCallback("thumbnailFetcher.writeDb", this, "finishWrite", "dbFail")
  statement.executeAsync(callback);
};
/* When thumbnail download is failed, append the item to retry*/
thumbnailFetcher.onThumbnailFailed = function() {
  /* Only retry for one time */
  if (!this.runningItem.retriedThumb) {
    this.runningItem.retriedThumb = true;
    this.itemCount++;
    this.undoneItems.push(this.runningItem);
    triggerDownloadListeners('thumbnailFetcherCount', null, this.itemCount);
  }
  this.finishWrite();
};

/* For items that video file is missing, fill empty string into the thumbnail field.  */
thumbnailFetcher.writeEmptyToDb = function() {
  triggerDownloadListeners('thumbnailAvailable', this.runningItem.id, this.runningItem.thumbnail_url);
  var statement = this.statementModel.clone();
  statement.params.thumbnail_file = '';
  statement.params.id = this.runningItem.id;
  var callback = generateStatementCallback("thumbnailFetcher.writeDb", this, "finishWrite", "dbFail")
  statement.executeAsync(callback);
};

/* After database written, update progress, schedule for next process */
thumbnailFetcher.finishWrite = function() {
  triggerDownloadListeners('thumbnailFetcherProgress', null, this.itemCount - this.undoneItems.length);
  if (this.undoneItems.length == 0) {
    this.running = false;
    triggerDownloadListeners('thumbnailFetcherDone', null, null);
  } else {
    this._timer.cancel();
    this._timer.initWithCallback(this, 1000, Ci.nsITimer.TYPE_ONE_SHOT);
  }
}

/* Used by timer */
thumbnailFetcher.notify = function() {
  thumbnailFetcher.processItem();
};

/* Respond for DownloadManager.fetchThumbnail error */
thumbnailFetcher.dbFail = function() {
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
    DownloadManagerPrivate.finishStartup();
    return;
  }
  /* Backup DB (may be failed!) */
  var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  file.append("smilefox.sqlite");
  try {
    file.copyTo(null, "smilefox-upgrade0.6-backup" + Date.parse(new Date()) + ".sqlite");
  } catch (e) {
    /* Do not block upgrade */
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


/* After receiving record for the download that needs to retry, call downloadQueueRunner to run it. */
DownloadManagerPrivate.afterRetryDownloadRead = function(resultArray) {
  var item = resultArray[0];
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

/* Process the simple video info result from DownloadManager.addDownload(). */
DownloadManagerPrivate.failAddingDownloadInfo = function(reason) {
  if (reason == "unavailable") {
    /* Pause all new downloads when connection is not available. */
    if (!paused) {
      paused = true;
      triggerDownloadListeners('downloadPaused');
    }
  } else if (reason == "deleted") {
    showUtilsAlert(Core.strings.getString("errorTitle"), Core.strings.getString("errorDeleted"));
  } else {
    showUtilsAlert('Download failed', 'Cannot render the XML Video info :(');
  }
}

/* Actaully add download item and put it into the queue after the simple info is read.  */
DownloadManagerPrivate.initializeDownload = function(info) {
  var url = info.url;
  /* Use stored statment if exists, or create a new one. */
  if (!storedStatements.addDownload) {
    storedStatements.addDownload = DownloadManagerPrivate.dbConnection.createStatement("INSERT INTO `smilefox` (`url`, `video_title`, `add_time`, `status`, `in_private`) VALUES (:url, :video_title, :add_time, :status, :in_private)");
  }
  /* Beware: reset(); won't clear any params. Make sure to reset all params! */
  var params = {};
  params.url = url;
  params.video_title = info.nicoData.title;
  params.add_time = new Date().getTime();
  params.status = 0;
  params.in_private = (inPrivateBrowsing)?1:0;
  for (var key in params) {
    storedStatements.addDownload.params[key] = params[key];
  }
  /* lastInsertRowID is not reliable in asynchronous execution, so do it synchronously */
  storedStatements.addDownload.execute();
  storedStatements.addDownload.reset();
  var lastInsertRowID = DownloadManagerPrivate.dbConnection.lastInsertRowID;
  /* Trigger download listeners and push it to the download queue. 
   * Remember the info if it is not a simple one. */
  params.id = lastInsertRowID;
  if (!info.simple) {
    params.info = info;
  }
  triggerDownloadListeners("downloadAdded", lastInsertRowID, params);
  downloadQueue.push(params);
  downloadQueueRunner.process();
};

/* Update download item with given parameters
 * XXX: will it better to split it out to several cases and cache statements, like what we do in 0.3.x?
 */ 
DownloadManagerPrivate.updateDownload = function(id, params) {
  if (!working) { return; }
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
  
  /* Private Browsing checking XXX: 1.9.1b2- compatibility */
  if (Ci.nsIPrivateBrowsingService) {
    var privateSvc = Cc["@mozilla.org/privatebrowsing;1"].getService(Ci.nsIPrivateBrowsingService);
    inPrivateBrowsing = privateSvc.privateBrowsingEnabled;
  } else {
    inPrivateBrowsing = false;
  }
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

/* Execute when private browsing is toggled
 * @param data New status for private browsing mode. Might be 'enter' or 'exit'. */
DownloadManager.togglePrivateBrowsing = function(data) {
  inPrivateBrowsing = (data != 'exit');
  /* Pause all downloads. */
  DownloadManager.pauseAllDownloads();
  /* When exiting the private browsing mode, clear all items with in_private = 1 */
  if (data == 'exit') {
    var statement = DownloadManagerPrivate.dbConnection.createStatement("DELETE FROM `smilefox` WHERE `in_private` = 1");
    /* Execute synchrounsly to ensure consistency */
    statement.execute();
    statement.reset();
    triggerDownloadListeners('rebuild', null, null);
  }
};

/* If there is any active downloads, confirm whether to quit.
 * @param subject Subject from quit-application-requested topic */
DownloadManager.confirmQuit = function(subject) {
  if (activeDownloadCount > 0) {
    if (!Services.prompt.confirm(null, Core.strings.getString('closeSmileFoxTitle'), Core.strings.getString('closeSmileFoxMsg'))){
      subject.QueryInterface(Ci.nsISupportsPRBool);
      subject.data = true;
    }
  }
};

/* Cleanup things during browser quit. */
DownloadManager.shutdown = function() {
  DownloadManager.pauseAllDownloads();
  prefObserver.unregister();
  thumbnailFetcher._timer.cancel();
  economyModeCheckTimer.cancel();
};

/* Check if user upgraded from a old version that don't support thumbnail download,
 * by checking if the thumbnail_file in database is filled.
 * Callback will return how many records had thumbnail file.
 */
DownloadManager.checkThumbnail = function(thisObj, successCallback, failCallback) {
  /* This won't need to store; we expect to use this at once only. */
  var statement = DownloadManagerPrivate.dbConnection.createStatement("SELECT COUNT(id) AS count FROM `smilefox` WHERE `thumbnail_file` IS NULL AND `status` = 1");
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
DownloadManager.getDownloads = function(thisObj, resultCallback, successCallback, failCallback) {
  if (!working) {
    thisObj[failCallback].call(thisObj);
    return;
  }
  /* Use stored statment if exists, or createa a new one.
   * executeAsync will reset the statement, so no need to reset. */
  if (!storedStatements.getDownloads) {
    storedStatements.getDownloads = DownloadManagerPrivate.dbConnection.createStatement("SELECT * FROM `smilefox` ORDER BY `id` DESC");
  }
  var callback = generateStatementCallback("getDownloads", thisObj, successCallback, failCallback, dbFields, resultCallback);
  storedStatements.getDownloads.executeAsync(callback);
};
/* Get single download. XXX: Why return array instead of object? */
DownloadManager.getDownload = function(id, thisObj, successCallback, failCallback) {
  if (!working) {
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
DownloadManager.addDownload = function(url, cachedInfo) {
  /* XXX: URL Checker should not be here. */
  if (!/^http:\/\/www\.nicovideo\.jp\/watch\/(?:[a-z]{0,2}[0-9]+)$/.test(url)) { return; }
  /* Use cached info if exists. */
  if (cachedInfo) {
    Components.utils.import("resource://nicofox/When.jsm");
    var promise = When(cachedInfo);
  } else {
    Components.utils.import("resource://nicofox/VideoInfoReader.jsm");
    var promise = VideoInfoReader.readByUrl(url, true);
  }
  promise.then(DownloadManagerPrivate.initializeDownload.bind(DownloadManagerPrivate) , DownloadManagerPrivate.failAddingDownloadInfo.bind(DownloadManagerPrivate));
};

/* If the download is running, cancel the download. */
DownloadManager.cancelDownload = function(id) {
  if (activeDownloads[id] && activeDownloads[id].downloader) {
    activeDownloads[id].downloader.cancel();
  }
};
/* Pause all downloads. */
DownloadManager.pauseAllDownloads = function() {
  for (var id in activeDownloads) {
    if (activeDownloads[id].downloader) {
      activeDownloads[id].downloader.pause();
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
    thisObj[failCallback].call(thisObj);
    return;
  }
  /* If the item is in the queue, remove it. */
  downloadQueue = downloadQueue.filter(function(item) {
    return (item.id != id);
  });
  /* Use stored statment if exists, or create a new one.
   * executeAsync will reset the statement, so no need to reset. */
  if (!storedStatements.removeDownload) {
    /* To be sure we will not remove item in progress. */
    storedStatements.removeDownload = DownloadManagerPrivate.dbConnection.createStatement("DELETE FROM `smilefox` WHERE `id` = :id AND `status` NOT IN (5,6,7)");
  }
  storedStatements.removeDownload.params.id = id;
  var callback = generateStatementCallback("removeDownload", DownloadManagerPrivate, "notifyRemovedDownload", "dbFail", null, null, id);
  storedStatements.removeDownload.executeAsync(callback);
};

/* Resume downloads after paused. */
DownloadManager.resumeDownloads = function() {
  downloadQueue = [];
  paused = false;
  triggerDownloadListeners('downloadResumed');
  downloadQueueRunner.startup();
}

/* Add listener */
DownloadManager.addListener = function(listener) {
 downloadListeners.push(listener);
};
/* Remove the listener in the list */
DownloadManager.removeListener = function(listener) {
  var listenerPos = downloadListeners.indexOf(listener);
  if (listenerPos < 0) { return; }
  downloadListeners.splice(listenerPos, 1);
};

/* Readonly */
DownloadManager.__defineGetter__("working", function() {
  return working;
}
);
DownloadManager.__defineGetter__("paused", function() {
  return paused;
}
);
DownloadManager.__defineGetter__("thumbFetching", function() {
  return thumbnailFetcher.running;
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

/* Cache some highly-used strings in the UI. */
DownloadManager.cachedStrings = {};

XPCOMUtils.defineLazyGetter(DownloadManager.cachedStrings, "doneSize", function() {
  return Core.mozDownloadStrings.getString("doneSize");
}
);
XPCOMUtils.defineLazyGetter(DownloadManager.cachedStrings, "monthDate", function() {
  try {
    return Core.mozDownloadStrings.getString("monthDate");
  } catch (e) {
    return null;
  }
}
);
XPCOMUtils.defineLazyGetter(DownloadManager.cachedStrings, "yesterday", function() {
  return Core.mozDownloadStrings.getString("yesterday");
}
);
XPCOMUtils.defineLazyGetter(DownloadManager.cachedStrings, "progressLoading", function() {
  return Core.strings.getString("progressLoading");
}
);
XPCOMUtils.defineLazyGetter(DownloadManager.cachedStrings, "progressRelatedDownloading", function() {
  return Core.strings.getString("progressRelatedDownloading");
}
);

/* Convert Date object to a formatted string, used by the UI.
 * Modified from updateTime() on mozapps/downloads/content/downloads.js
 * XXX: Dash and the info text should be able to localized */
DownloadManager.getInfoString = function(maxBytes, commentType, endTime) {
  /* Read the file size. */
  let [size, unit] = gre.DownloadUtils.convertByteUnits(maxBytes);
  let sizeText = DownloadManager.cachedStrings.doneSize;
  sizeText = sizeText.replace("#1", size);
  sizeText = sizeText.replace("#2", unit);

  let infoText = sizeText;

  /* Read the comment type. */
  if (commentType != 'www') {
    infoText += " \u2014 " + commentType;
  }

  /* Figure out when today begins */
  let now = new Date();
  let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  /* Figure out if the end time is from today, yesterday, this week, etc. */
  let dateTime;
  if (endTime >= today) {
    /* Download finished after today started, show the time */
    dateTime = DownloadManagerPrivate.dts.FormatTime("", DownloadManagerPrivate.dts.timeFormatNoSeconds,
                                                     endTime.getHours(), endTime.getMinutes(), 0);
  } else if (today - endTime < (24 * 60 * 60 * 1000)) {
    /* Download finished after yesterday started, show yesterday */
    dateTime = DownloadManager.cachedStrings.yesterday;
  } else if (today - endTime < (6 * 24 * 60 * 60 * 1000)) {
    /* Download finished after last week started, show day of week */
    dateTime = endTime.toLocaleFormat("%A");
  } else {
    /* Download must have been from some time ago.. show month/day */
    let month = endTime.toLocaleFormat("%B");
    /* Remove leading 0 by converting the date string to a number */
    let date = Number(endTime.toLocaleFormat("%d"));
    /* Use monthDate before Bug 397424; monthDate2 after it */
    if (DownloadManager.cachedStrings.monthDate) {
      dateTime = DownloadManager.cachedStrings.monthDate;
      dateTime = dateTime.replace("#1", month);
      dateTime = dateTime.replace("#2", date);
    } else {
      dateTime = Core.mozDownloadStrings.getFormattedString('monthDate2', [month, date]);
    }
  }
  infoText += " \u2014 " + dateTime;
  return infoText;
};

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
  downloadQueueRunner.process();
};

/* When economy timer off, add status = 4 (hi-quality pending) items */
downloadQueueRunner.rescheduleEconomyItem = function() {
  if (!working) {
    thisObj[failCallback].call(thisObj);
    return;
  }
  /* Stop the economy mode blocker, and stop the waiting timer */
  if (!atEconomyMode) {
    return;
  }
  atEconomyMode = false;
  if (economyModeCheckTimer.callback) {
    economyModeCheckTimer.cancel();
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
  if (paused) { return; }
  while(downloadQueue.length > 0 && activeDownloadCount < downloadMax) {
    var item = downloadQueue.shift();
    /* If we are sure that economy mode is enabled (e.g. first hi-quality pending video falls into economy mode) , don't process it. */
    if (item.status == 4 && atEconomyMode) {
      continue;
    }
    downloadTriggered = true;
    /* Initialize object */
    activeDownloads[item.id] = { url: item.url };
    activeDownloadCount++;
    /* Start the download */
    downloadQueueRunner.initDownloader(item.id, item.video_economy, item.info);
  }
  /* Call the listeners that queue had changed */
  triggerDownloadListeners("queueChanged", null, {});
  
  if (downloadTriggered && downloadQueue.length == 0 && activeDownloadCount == 0 && !paused) {
    downloadTriggered = false;
    allDone();
  }
};

/* Initialize downloader(DownloadUtils.nico) to really start download */
downloadQueueRunner.initDownloader = function(id, videoEconomy, info) {
  Components.utils.import("resource://nicofox/DownloadUtils.jsm");
  activeDownloads[id].downloader = new DownloadUtils.nico();
  /* Assign callback and database id (for callback) */
  activeDownloads[id].downloader.callback = handleDownloaderEvent;
  activeDownloads[id].downloader.dbId = id;
  activeDownloads[id].downloader.previousAtEconomy = (videoEconomy == 1);
  if (info) {
    activeDownloads[id].downloader._cachedInfo = info;
  }
  /* Change the status to "downloading" in the database unless early failure */
  if (activeDownloads[id].downloader.init(activeDownloads[id].url)) {
    DownloadManagerPrivate.updateDownload(id, {"status": 7, "start_time": new Date().getTime()});
  }
};

/* Respond for downloadQueueRunner-related SQL error */
downloadQueueRunner.dbFail = function() {
};

/* Handle downloader (DownloadUtils.nico) events. In the function, this will be the downloader instance. */
function handleDownloaderEvent(type, content) {
  /* To prevent "stop" to be called when canceled */
  if(this._canceled && type != "cancel" && type != "fail" && type != "pause") { return; }
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
	  if (!economyModeCheckTimer.callback) {
      economyModeCheckTimer.initWithCallback( economyTimerCallback, 600000, Ci.nsITimer.TYPE_REPEATING_SLACK);
	  }
    /* Update Download Manager Record */
    DownloadManagerPrivate.updateDownload(id, {"status": 4, "video_title": content.video_title, "video_economy": 1});
 	  downloadQueueRunner.removeEconomyItems();
 	  downloadQueueRunner.process();
    break;

    /* Previously in economy mode, but the high quality video is available */
    case "economy_off":
    downloadQueueRunner.rescheduleEconomyItem();
	  break;

    case "progress_change":
    /* Modified from toolkit/mozapps/downloads/content/downloads.js */
    /* Get the download status from gre.DownloadUtils */
    var downloadStatus = "";
    var newLast = Infinity;
    [downloadStatus, newLast] = gre.DownloadUtils.getDownloadStatus(content.currentBytes, content.maxBytes, this.speed, this.lastSec);

    content.downloadStatus = downloadStatus;
    triggerDownloadListeners("downloadProgressUpdated", id, content);
    this.lastSec = newLast;
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

    /* Pause all downloads after some item is paused, used for antiflood or autologin or quit application cases. */
    case "pause":
    delete(activeDownloads[id]);
    activeDownloadCount--;
    DownloadManagerPrivate.updateDownload(id, {"status": 0});
    if (!paused) {
      paused = true;
      triggerDownloadListeners('downloadPaused');
    }
    break;
  }
}

/* Economy mode timer */
var economyTimerCallback = {
  notify: function(timer) {
    var now = new Date();

    /* Economy mode is fired when 19-2 in Japan time (UTC+9) => 10-17 in UTC time */
    if (now.getUTCHours() >= 17 || now.getUTCHours() < 10) {
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
  if (hitEconomy) {
    showUtilsAlert(Core.strings.getString('economyNoticeTitle'), Core.strings.getString('economyNoticeMessage'));
    hitEconomy = false;
  } else {
    showUtilsAlert(Core.strings.getString('alertCompleteTitle'), Core.strings.getString('alertCompleteText'));
  }
}
/* A simple wrapper to nsIAlertsService */
function showUtilsAlert(title, msg) {
  var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
  alertsService.showAlertNotification("chrome://nicofox/skin/logo.png",
                                      title, msg,
                                      false, "", null);
};
