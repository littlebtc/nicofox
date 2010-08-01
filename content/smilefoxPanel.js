/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 et filetype=javascript
 */
Components.utils.import("resource://nicofox/Services.jsm", nicofox);
nicofox.panel = {};

/* Cached active download's DOM instance */
nicofox.panel.activeDownloadInstances = {

};

/* The panel should be loaded only when the first time of popupshowing event. This boolean will record this. */
nicofox.panel.loaded = false;

/* Storage for array */
nicofox.panel.resultArray = [];

/* On popup showing, check whether the panel is loaded */
nicofox.panel.onPopupShowing = function() {
  if (this.loaded) {
    return;
  }
  this.load();
};

/* Load Panel */
nicofox.panel.load = function() {
  this.loaded = true;
  Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofox);
  /* Test if the download manager database is working. If not, wait */
  if (!nicofox.DownloadManager.working) {
    window.setTimeout(function() { nicofox.panel.waitForDb(12) } , 10);
    return;
  }
  this.init();
};

/* Wait DB for 60 sec timeout, check the status per 5 seconds */
nicofox.panel.waitForDb = function(waitCount) {
  /* XXX: How about UI? */
  if (nicofox.DownloadManager.working) {
    Components.utils.reportError("!");
    this.init();
    return;
  }
  waitCount--;
  if (waitCount == 0) {
    alert("Download Manager Broken!");
  } else {
    window.setTimeout(function() { nicofox.panel.waitForDb(waitCount) } , 5000);
  }
};
/* Initialize after we know the manager is working. */
nicofox.panel.init = function() {
  /* Listen to download events. */
  nicofox.DownloadManager.addListener(this.listener);
  
  /* Get all download items. */
  nicofox.DownloadManager.getDownloads(this, "displayDownloads", "dbFail");
  
  /* Check whether to prompt user to download thumbnail */ 
  if (!nicofox.Core.prefs.getBoolPref("thumbnail_check") && nicofox.Core.prefs.getBoolPref("download_thumbnail")) {
    nicofox.DownloadManager.checkThumbnail(this, "responseThumbnailCheck", "dbFail");
  }
};
/* If there is not thumbnail file data stored in database, prompt user to download for all old records. */
nicofox.panel.responseThumbnailCheck = function(resultArray) {
  if (resultArray[0].count == 0) {
    document.getElementById("smilefoxThumbNotice").hidden = false;
  } else {
  }
};

/* Do when user agreed to use the thumbnail download function... */
nicofox.panel.enableThumbnail = function() {
  //nicofox.Core.prefs.setBoolPref("thumbnail_check", true);
  document.getElementById("smilefoxThumbNotice").hidden = true;
  document.getElementById("smilefoxThumbProgress").hidden = false;
  /* Ask download manager to fetch thumbnails */
  nicofox.DownloadManager.fetchThumbnails();
};

/* Display all downloaded item after the asynchorous request. */
nicofox.panel.displayDownloads = function(resultArray) {
  var list = document.getElementById("smilefoxList");
  /* XXX: Don't do it at once */
  for (var i = 0; i < resultArray.length; i++) {
    var result = resultArray[i];
    var listItem = document.createElement("richlistitem");
    nicofox.panel.updateDownloadItem(listItem, result);
    list.appendChild(listItem);
  }
};

/* Update the <listitem> when new download were added or the status had changed. */
nicofox.panel.updateDownloadItem = function(listItem, result) {
  listItem.setAttribute("type", "smilefox");
  if (result.thumbnail_file) {
    var thumbFile = nicofox.panel.getFileInstance(result.thumbnail_file);
    var thumbUrl = nicofox.Services.io.newFileURI(thumbFile).spec;
    listItem.setAttribute("thumbnail", thumbUrl);
  }
  if (result.id) {
    listItem.setAttribute("sfid", result.id);
    listItem.setAttribute("id", "smileFoxListItem" + result.id);
  }
  if (result.url) {
    listItem.setAttribute("sfurl", result.url);
  }
  if (result.video_title) {
    listItem.setAttribute("sfvideotitle", result.video_title);
  }
  if (result.video_economy == 1) {
    listItem.setAttribute("sfeconomy", result.video_economy);
    listItem.setAttribute("sftextstatus", "Low Quality");
  }
  if (result.video_file) {
    listItem.setAttribute("sfvideofile", result.video_file);
  }
  if (result.comment_file) {
    listItem.setAttribute("sfcommentfile", result.comment_file);
  }
  if (result.uploader_comment_file) {
    listItem.setAttribute("sfuploadercommentfile", result.uploader_commment_file);
  }
  /* Avoid 0 to be considered as false */
  if (typeof result.status == "number") {
    listItem.setAttribute("sfstatus", result.status);
  }
};

nicofox.panel.dbFail = function() {
  alert("dbFail!");
};
/* When popup menu is showing, check the selected item and generate correct menu items 
 * Like /toolkit/mozapps/downloads/content/downloads.js on mozilla-central
 */
nicofox.panel.displayContextMenuItems = [
[ "Go", "Copy", "Separator2", "SelectAll", "Remove"], /* 0 Waiting */
[ "Open", "OpenExternal", "OpenFolder", "MoveFolder", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ], /* 1 Completed */ 
[ "Retry", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ], /* 2 Canceled */ 
[ "Retry", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ], /* 3 Failed */ 
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ], /* 4 Scheduled */ 
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ], /* 5 Downloading */ 
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ], /* 6 Downloading */ 
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ], /* 7 Downloading */ 
[ "Missing", "Retry", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ] /* File Missing, since we don't make status = 8, it is a hack.  */ 
];

nicofox.panel.generateContextMenu = function(aEvent) {
  /* Check for context menu showing */
  if (aEvent.target.id != "smilefoxPopup") {
    return false;
  }
  var selectedItem = document.getElementById("smilefoxList").selectedItem;
  if (!selectedItem) { return false; }
  
  /* Create context menu, depending on the video status */
  var popup = document.getElementById("smilefoxPopup");
  var sfStatus = parseInt(selectedItem.getAttribute("sfstatus"), 10);
   
  var menuitems = popup.childNodes;
  for (var i = 0; i < menuitems.length; i++) {
    menuitems[i].hidden = true;
  } 
  
  /* Check for file missing case */
  var file = nicofox.panel.getFileInstance(selectedItem.getAttribute("sfvideofile"));
  if (!file.exists()) {
    sfStatus = 8;
  }
  
  var displayItems = nicofox.panel.displayContextMenuItems[sfStatus];
  for (var i = 0; i < displayItems.length; i++) {
    document.getElementById("smilefoxPopup" + displayItems[i]).hidden = false;
  }
  return true;
}

/* Handle Commands */
nicofox.panel.commands = {
  open: function(selectedItem) {
    var videoFile = nicofox.panel.getFileInstance(selectedItem.getAttribute("sfvideofile"));
    var videoUrl = nicofox.Services.io.newFileURI(videoFile).spec;
    
    /* Check if comment XML file exists */
    var commentUrl = "";
    
    if (selectedItem.hasAttribute("sfcommentfile")) {
      var commentFile = nicofox.panel.getFileInstance(selectedItem.getAttribute("sfcommentfile"));
      if (commentFile.exists()) {
        commentUrl = nicofox.Services.io.newFileURI(commentFile).spec;
      }
    }
      
    window.openDialog('chrome://nicofox/content/nicofox_player.xul', 'nicofox_swf', 'width=512,height=424, dialog=no, resizable=yes', {video: videoUrl, comment: commentUrl, title: selectedItem.getAttribute("sfvideotitle")});
  }
};

/* Open "NicoFox Option" */
/* Modified from: toolkit/mozapps/extensions/content/extensions.js */
nicofox.panel.openOptionsWindow = function() {
  var optionsURL = "chrome://nicofox/content/options.xul"
  var windows = nicofox.Services.wm.getEnumerator(null);
  while (windows.hasMoreElements()) {
    var win = windows.getNext();
    if (win.document.documentURI == optionsURL) {
      win.focus();
      return;
    }
  }
  var features = "chrome,titlebar,toolbar,centerscreen";
  try {
    var instantApply = nicofox.Services.prefs.getBoolPref("browser.preferences.instantApply");
    features += instantApply ? ",dialog=no" : ",modal";
  } catch (e) {
    features += ",modal";
  }
  window.openDialog(optionsURL, "", features);
  /* In some OS (linux for example), the panel will not be autohide :( */
  document.getElementById("nicofox-library").hidden = true;
};

/* A download listener to DownloadManager */
nicofox.panel.listener = {

};
nicofox.panel.listener.thumbnailFetcherCount = function(id, content) {
  document.getElementById("smilefoxThumbProgressMeter").setAttribute("max", content);
  document.getElementById("smilefoxThumbProgressMeter").setAttribute("value", 0);
};
nicofox.panel.listener.thumbnailFetcherProgress = function(id, content) {
  document.getElementById("smilefoxThumbProgressMeter").setAttribute("value", content);

};
nicofox.panel.listener.thumbnailAvailable = function(id, content) {
  var image = document.getElementById("smileFoxListItem" + id).querySelector("image");
  image.setAttribute("src", content);
};

nicofox.panel.listener.downloadAdded = function(id, content) {
  Components.utils.reportError("Panel: download added!" + id + JSON.stringify(content));
  var list = document.getElementById("smilefoxList");
  var listItem = document.createElement("richlistitem");
  nicofox.panel.updateDownloadItem(listItem, content);
  listItem.setAttribute("progresstype", "undetermined");
  list.insertBefore(listItem, list.firstChild);
};
nicofox.panel.listener.downloadUpdated = function(id, content) {
  Components.utils.reportError("Panel: download updated!" + id + JSON.stringify(content));
  var listItem = document.getElementById("smileFoxListItem"+ id);
  nicofox.panel.updateDownloadItem(listItem, content);
  /* If the status is "downloading", update the progress type */
  if (content.status == 7) {
    listItem.setAttribute("progresstype", "undetermined");
  }
};
nicofox.panel.listener.downloadProgressUpdated = function(id, content) {
  var listItem = document.getElementById("smileFoxListItem"+ id);
  if (!listItem) { return; }
  listItem.setAttribute("progresstype", "determined");
  listItem.setAttribute("currentbytes", content.currentBytes);
  listItem.setAttribute("maxbytes", content.maxBytes);
};
nicofox.panel.listener.downloadVideoCompleted = function(id, content) {
  var listItem = document.getElementById("smileFoxListItem"+ id);
  if (!listItem) { return; }
  listItem.setAttribute("progresstype", "undetermined");
};
nicofox.panel.listener.downloadRemoved = function(id) {
  var list = document.getElementById("smilefoxList");
  var listItem = document.getElementById("smileFoxListItem"+ id);
  if (!listItem) { return; }
  list.removeChild(listItem);
};

/* Helper: Get a nsILocalFile instance from a path */
nicofox.panel.getFileInstance = function(path) {
  var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  file.initWithPath(path);
  return file;
}
nicofox.panel.unload = function() {
  nicofox.DownloadManager.removeListener(nicofox.panel.listener);
}
window.addEventListener("unload", function() { nicofox.panel.unload(); })
