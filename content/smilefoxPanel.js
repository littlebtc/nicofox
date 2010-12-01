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
nicofox.panel.onPopupShown = function() {
  document.getElementById("smilefoxList").focus();
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
  document.getElementById("smilefoxThumbNotice").hidden = true;
  document.getElementById("smilefoxThumbProgress").hidden = false;
  /* Ask download manager to fetch thumbnails */
  nicofox.DownloadManager.fetchThumbnails();
};
/* When user don't want to download thumbnail... */
nicofox.panel.disableThumbnail = function() {
  nicofox.Core.prefs.setBoolPref("thumbnail_check", true);
  nicofox.Core.prefs.setBoolPref("download_thumbnail", false);
  document.getElementById("smilefoxThumbNotice").hidden = true;
};

/* Display all downloaded item after the asynchorous request. */
nicofox.panel.displayDownloads = function(resultArray) {
  /* Check whether to prompt user to download thumbnail */ 
  if (resultArray.length > 0 && !nicofox.Core.prefs.getBoolPref("thumbnail_check") && nicofox.Core.prefs.getBoolPref("download_thumbnail")) {
    nicofox.DownloadManager.checkThumbnail(this, "responseThumbnailCheck", "dbFail");
  } else if (resultArray.length == 0 && !nicofox.Core.prefs.getBoolPref("thumbnail_check")) {
    nicofox.Core.prefs.setBoolPref("thumbnail_check", true);
  }

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
    var thumbFile = new nicofox.panel._fileInstance(result.thumbnail_file);
    if (thumbFile.exists()) {
      var thumbUrl = nicofox.Services.io.newFileURI(thumbFile).spec;
      listItem.setAttribute("thumbnail", thumbUrl);
    }
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
  if (result.video_type) {
    listItem.setAttribute("sfvideotype", result.video_type);
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

/* A very simple "Search" feature implemented by hidding elements. */
nicofox.panel.search = function(value) {
  var list = document.getElementById("smilefoxList");
  var items = list.children;
  /* Split search terms. From chrome/toolkit/content/mozapps/downloads/downloads.js on mozilla-central. */
  var terms = value.replace(/^\s+|\s+$/g, "").toLowerCase().split(/\s+/);

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var lowerCaseTitle = item.getAttribute("sfvideotitle").toLowerCase();
    /* Check whether all keywords matched */
    let match = true;
    for (var j = 0; j < terms.length; j++) {
      if (lowerCaseTitle.indexOf(terms[j]) == -1) {
        match = false;
      }
    }
    item.hidden = !match;
  }
};

/* When popup menu is showing, check the selected item and generate correct menu items 
 * Like /toolkit/mozapps/downloads/content/downloads.js on mozilla-central
 */
nicofox.panel.displayContextMenuItems = [
[ "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove"], /* 0 Waiting */
[ "Open", "OpenExternal", "OpenFolder", /*"MoveFolder",*/ "Separator1", "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove" ], /* 1 Completed */ 
[ "Retry", "Separator1", "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove" ], /* 2 Canceled */ 
[ "Retry", "Separator1", "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove" ], /* 3 Failed */ 
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove" ], /* 4 Scheduled */ 
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove" ], /* 5 Downloading */ 
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove" ], /* 6 Downloading */ 
[ "Cancel", "Separator1", "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove" ], /* 7 Downloading */ 
[], /*Reserved */
[ "Missing", "Retry", "Separator1", "Go", "Copy", "Separator2", /*"SelectAll",*/ "Remove" ], /* 9 File Missing (hack) */ 
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
  if (selectedItem.hasAttribute("sfvideofile")) {
    var file = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
    if (sfStatus == 1 && !file.exists()) {
      sfStatus = 9;
    }
  }
  var displayItems = nicofox.panel.displayContextMenuItems[sfStatus];
  for (var i = 0; i < displayItems.length; i++) {
    document.getElementById("smilefoxPopup" + displayItems[i]).hidden = false;
  }
  return true;
}

/* Handle Commands */
nicofox.panel.commands = {
  /* "Play with NicoFox Player" */
  open: function(selectedItem) {
    /* Open if the status is completed and file exists */
    var sfStatus = parseInt(selectedItem.getAttribute("sfstatus"), 10);
    var videoFile = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
    if (sfStatus != 1 || !videoFile.exists()) { return; }
    
    var videoUrl = nicofox.Services.io.newFileURI(videoFile).spec;
    
    /* Check if comment XML file exists */
    var commentUrl = "";
    
    if (selectedItem.hasAttribute("sfcommentfile")) {
      var commentFile = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfcommentfile"));
      if (commentFile.exists()) {
        commentUrl = nicofox.Services.io.newFileURI(commentFile).spec;
      }
    }
    window.openDialog('chrome://nicofox/content/nicofox_player.xul', 'nicofox_swf', 'width=512,height=424, dialog=no, resizable=yes', {video: videoUrl, comment: commentUrl, title: selectedItem.getAttribute("sfvideotitle")});
  },
  /* Cancel */
  cancel: function(selectedItem) {
    var id = parseInt(selectedItem.getAttribute("sfid"), 10);
    nicofox.DownloadManager.cancelDownload(id);
  },
  /* Retry */
  retry: function(selectedItem) {
    var id = parseInt(selectedItem.getAttribute("sfid"), 10);
    var sfStatus = parseInt(selectedItem.getAttribute("sfstatus"), 10);
    if (sfStatus == 2 || sfStatus == 3) { /* Canceled or Failed */
      nicofox.DownloadManager.retryDownload(id);
    }
  },
  /* Open with External Player */
  openExternal: function(selectedItem) {
    /* Open if the status is completed and file exists */
    var sfStatus = parseInt(selectedItem.getAttribute("sfstatus"), 10);
    var videoFile = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
    if (sfStatus != 1 || !videoFile.exists()) { return; }
    
    /* Select the external player if desired */
    var sfVideoType = selectedItem.getAttribute("sfvideotype");
    var externalApplication = null;
    Components.utils.import("resource://nicofox/Core.jsm", nicofox);
    if (sfVideoType == "swf" && nicofox.Core.prefs.getBoolPref("external_swf_player")) {
      externalApplication = nicofox.Core.prefs.getComplexValue("external_swf_player_path", Ci.nsILocalFile);
    } else if (nicofox.Core.prefs.getBoolPref("external_video_player")) {
      externalApplication = nicofox.Core.prefs.getComplexValue("external_video_player_path", Ci.nsILocalFile);
    }
    if (externalApplication) {
      /* Use ProcessRunner to run the external application */
      Components.utils.import("resource://nicofox/ProcessRunner.jsm");
      processRunner.openFileWithProcess(externalApplication, videoFile, "nsIProcess");
    } else {
      /* Try to do the default action */
      try {
        videoFile.launch();
      } catch(e) {
        /* For *nix, launch() didn't work, so...  */
        /* See also: http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/downloads/content/downloads.js */
        var videoUri = nicofox.Services.io.newFileURI(videoFile);
        var protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
        protocolService.loadUrl(videoUri);
      }
    }
  },
  /* Open in Folder (or "Reveal") */
  openFolder: function(selectedItem) {
    /* Open if the status is completed and file exists */
    var sfStatus = parseInt(selectedItem.getAttribute("sfstatus"), 10);
    var videoFile = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
    if (sfStatus != 1 || !videoFile.exists()) { return; }
    try {
      videoFile.reveal();
    } catch(e) {
      /* For *nix, reveal() didn't work, so...  */
      /* See also: http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/downloads/content/downloads.js */
      var videoPathUri = nicofox.Services.io.newFileURI(videoFile.parent);
      var protocolService = Cc["@mozilla.org/uriloader/external-protocol-service;1"].getService(Ci.nsIExternalProtocolService);
      protocolService.loadUrl(videoPathUri);
    }
  },
  /* Open video page in new tab. XXX: This assume we can find gBrowser */
  goVideoPage: function(selectedItem) {
    var sfUrl = selectedItem.getAttribute("sfurl");
    gBrowser.addTab(sfUrl);
  },
  /* Copy the video URL */
  copyVideoUrl: function(selectedItem) {
    var sfUrl = selectedItem.getAttribute("sfurl");
    var clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);  
    clipboardHelper.copyString(sfUrl);  
  },
  /* Remove selected item */
  remove: function(selectedItem) {
    var id = parseInt(selectedItem.getAttribute("sfid"), 10);
    var sfStatus = parseInt(selectedItem.getAttribute("sfstatus"), 10);
    if (sfStatus < 5 || sfStatus > 7) { /* Canceled or Failed */
      nicofox.DownloadManager.removeDownload(id);
    }
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
  var listItem = document.getElementById("smileFoxListItem" + id);
  listItem.setAttribute("thumbnail", content);
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
nicofox.panel._fileInstance = Components.Constructor("@mozilla.org/file/local;1", "nsILocalFile", "initWithPath");
/* XXX: Remove listener used only */
nicofox.panel.unload = function() {
  Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofox);
  nicofox.DownloadManager.removeListener(nicofox.panel.listener);
}
window.addEventListener("unload", function() { nicofox.panel.unload(); }, false);
