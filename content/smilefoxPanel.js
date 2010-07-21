/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 et filetype=javascript
 */
Components.utils.import("resource://nicofox/Services.jsm", nicofox);
nicofox.panel = {};

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
  Components.utils.reportError(new Date().getTime());
  nicofox.DownloadManager.getDownloads(this, "displayDownloads", "dbFail");
};

/* Wait DB for 60 sec timeout, check the status per 5 seconds */
nicofox.panel.waitForDb = function(waitCount) {
  /* XXX: How about UI? */
  if (nicofox.DownloadManager.working) {
    Components.utils.reportError("!");
    nicofox.DownloadManager.getDownloads(this, "displayDownloads", "dbFail");
    return;
  }
  waitCount--;
  if (waitCount == 0) {
    alert("Download Manager Broken!");
  } else {
    window.setTimeout(function() { nicofox.panel.waitForDb(waitCount) } , 5000);
  }
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
  /* Build items under <listitem> for the first time */
  if (!listItem.hasChildNodes()) {
  }
  listItem.setAttribute("type", "smilefox");
  listItem.setAttribute("sfid", result.id);
  listItem.setAttribute("sfurl", result.url);
  listItem.setAttribute("sfvideotitle", result.video_title);
  if (result.video_economy == 1) {
    listItem.setAttribute("sfeconomy", result.video_economy);
  }
    listItem.setAttribute("sfvideofile", result.video_file);
  if (result.comment_file) {
    listItem.setAttribute("sfcommentfile", result.comment_file);
  }
  listItem.setAttribute("sfuploadercommentfile", result.uploader_commment_file);
  listItem.setAttribute("sfstatus", result.status);
  var imageLabel = document.createElement("image");
  imageLabel.style.backgroundColor = "black";
  imageLabel.setAttribute("width", "64");
  imageLabel.setAttribute("height", "48");
    
  var vbox1 = document.createElement("vbox");
  vbox1.setAttribute("flex", "1");
    
  var hbox1 = document.createElement("hbox");
  hbox1.setAttribute("flex", "1");
  var titleLabel = document.createElement("label");
  titleLabel.setAttribute("value", result.video_title);
  titleLabel.setAttribute("sfstatus", result.status);
  titleLabel.className = "smilefoxVideoTitle";
  hbox1.appendChild(titleLabel);
  vbox1.appendChild(hbox1);
    
  var hbox2 = document.createElement("hbox");
  hbox2.setAttribute("flex", "1");
  /* Display progress bar when video info is not retrived */
  if (result.status == 0 && !result.video_id) {
    var progress = document.createElement("progressmeter");
    progress.setAttribute("mode", "undetermined");
    progress.setAttribute("flex", "1");
    hbox2.appendChild(progress);
  }
  if (result.status > 1) {
    var statusLabel = document.createElement("label");
    var statusLabels = ["progressWaiting", "progressCompleted", "progressCanceled", "progressFailed", "progressLoading", "progressCommentDownloading", "progressVideoDownloading"];
    statusLabel.setAttribute("value", nicofox.Core.strings.getString(statusLabels[result.status]));
    statusLabel.setAttribute("sfstatus", result.status);
    statusLabel.className = "smilefoxStatus"
    hbox2.appendChild(statusLabel);
  }
  if (result.video_economy == 1) {
    var qualityLabel = document.createElement("label");
    qualityLabel.setAttribute("value", "Low Quality");
    qualityLabel.className = "smilefoxQuality";
    hbox2.appendChild(qualityLabel);
  }
  vbox1.appendChild(hbox2);
    
  listItem.appendChild(imageLabel);
  listItem.appendChild(vbox1);
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
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", "SelectAll", "Remove" ], /* 4 Downloading */ 
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
};

/* Helper: Get a nsILocalFile instance from a path */
nicofox.panel.getFileInstance = function(path) {
  var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
  file.initWithPath(path);
  return file;
}
