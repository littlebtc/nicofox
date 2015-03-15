/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 et filetype=javascript
 */

Components.utils.import("resource://gre/modules/Services.jsm", nicofox);

nicofox.panel = {};

/* Cached active download's DOM instance */
nicofox.panel.activeDownloadInstances = {

};

/* Timer, used to loading the items */
nicofox.panel.loadTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);

/* Cache the video items that is not loaded yet */
nicofox.panel.itemsToLoad = [];

/* The panel should be loaded only when the first time of popupshown event. This boolean will record this. */
nicofox.panel.loaded = false;
/* Whether the panel is hidden */
nicofox.panel.hidden = true;

/* Storage for array */
nicofox.panel.resultArray = [];

/* Search terms */
nicofox.panel._searchTerms = [];

/* When popup shown, check whether the panel is loaded */
nicofox.panel.onPopupShown = function(event) {
  /* Ignore bubbling from children, like context menu */
  if (!event.target.hasAttribute("id") || event.target.id != "nicofox-library") {
    return;
  }
  nicofox.panel.hidden = false;
  /* Set the thumbnail display type. */
  var thumbnailDisplayType = document.getElementById("nicofox-thumbnail-display").value;
  document.getElementById('nicofox-download-list').setAttribute('sfthumbdisplay', thumbnailDisplayType);

  /* Disable the following features on private window for now, since NicoFox is not privacy-aware now. */
  if (nicofox.isInPrivateWindow) {
    document.getElementById("nicofox-private-window-unsupported").hidden = false;
    document.getElementById("nicofox-thumbnail-display-block").hidden = true;
    document.getElementById("nicofox-download-list").hidden = true;
    document.getElementById("nicofox-download-search").hidden = true;
    document.getElementById("nicofox-download-bottom-actions").hidden = true;
    document.getElementById("nicofox-library").firstChild.style.height = "auto";
    /* Change the toolbutton state. */
    var nicofoxToolbarButton = document.getElementById("nicofox-toolbar-button");
    if (nicofoxToolbarButton) {
      nicofoxToolbarButton.setAttribute("open", true);
    }
    return;
  }

  /* Sometimes video info will be lost (e.g. after drop the tab to the new window), read again. */
  var browser = gBrowser.selectedBrowser;
  if (browser && browser.contentWindow) {
    if (/^http:\/\/www\.nicovideo\.jp\/watch\/(?:[a-z]{0,2}[0-9]+)$/.test(browser.contentWindow.location.href) && !browser.nicofoxVideoInfo) {
      var contentWin = browser.contentWindow;
      var contentDoc = browser.contentDocument;
      /* Do nothing if the page load is not completed */
      if (!contentDoc || contentDoc.readyState != "complete") { return; }
      nicofox.overlay.readVideoInfo(browser, contentWin, contentDoc);
    }
  }
  nicofox.panel.updateVideoInfo();
  /* Change the toolbutton state. */
  var nicofoxToolbarButton = document.getElementById("nicofox-toolbar-button");
  if (nicofoxToolbarButton) {
    nicofoxToolbarButton.setAttribute("open", true);
  }

  /* Load download items from database for the first time. */
  if (nicofox.panel.loaded) {
    return;
  }
  nicofox.panel.load();
  document.getElementById("nicofox-download-list").focus();
  
};
nicofox.panel.onPopupHidden = function(event) {
  /* Ignore bubbling from children, like context menu */
  if (!event.target.hasAttribute("id") || event.target.id != "nicofox-library") {
    return;
  }
  nicofox.panel.hidden = true;
  /* Change the toolbutton state. */
  var nicofoxToolbarButton = document.getElementById("nicofox-toolbar-button");
  if (nicofoxToolbarButton) {
    nicofoxToolbarButton.removeAttribute("open");
  }
  /* Hidden video info box. */
  document.getElementById("nicofox-not-watching").hidden = true;
  document.getElementById("nicofox-watching-loading").hidden = true;
  document.getElementById("nicofox-watching-failed").hidden = true;
  document.getElementById("nicofox-watching").hidden = true;
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
  /* Check whether DownloadManager is paused. */
  if (nicofox.DownloadManager.paused) {
    document.getElementById("nicofox-download-paused").hidden = false;
  }
  /* Listen to download events. */
  nicofox.DownloadManager.addListener(this.listener);
  
  /* Get all download items. */
  nicofox.DownloadManager.getDownloads(this, "fetchDownloads", "doneGetDownloads", "dbFail");
};

/* Update video info on the panel. */
nicofox.panel.updateVideoInfo = function() {
  /* Do nothing if the panel is hidden. */
  if (this.hidden) { return; }
  var info = gBrowser.selectedBrowser.nicofoxVideoInfo;

  /* Hidden all box first. */
  document.getElementById("nicofox-not-watching").hidden = true;
  document.getElementById("nicofox-watching-loading").hidden = true;
  document.getElementById("nicofox-watching-failed").hidden = true;
  document.getElementById("nicofox-watching").hidden = true;

  if (info) {
    /* If info presented, change the box for specific state. */
    if (info.reading) {
      document.getElementById("nicofox-watching-loading").hidden = false;
    } else if (info.error) {
      document.getElementById("nicofox-watching-failed").hidden = false;
    } else {
      if (info.nicoData) {
        /* Hack for Zero: if the URL had been changed, re-read infos */
        var currentUrl = gBrowser.selectedBrowser.currentURI.spec;
        if (currentUrl.indexOf(info.url) != 0) {
          Components.utils.import("resource://nicofox/VideoInfoReader.jsm", nicofox);
          info = nicofox.VideoInfoReader.readBasicZeroInfo(gBrowser.selectedBrowser.contentDocument);
          if (!info) { return; }
          gBrowser.selectedBrowser.nicofoxVideoInfo = info;
        }
        document.getElementById("nicofox-watching").hidden = false;
        document.getElementById("nicofox-watching-download").disabled = false;
        document.getElementById("nicofox-watching-title").value = info.nicoData.title;
        if (/http\:\/\//.test(info.nicoData.thumbnail)) {
          document.getElementById("nicofox-watching-thumb").src = info.nicoData.thumbnail;
        }
        document.getElementById("nicofox-watching-thread").value = info.nicoData.id;
        /* NicoNico Farm only supports original Japanese site thread, we need to check it */
        document.getElementById("nicofox-watching-comment-tool").visible = /^[a-z]/.test(info.nicoData.v);
      }
    }
  } else {
    /* No info presented. */
    document.getElementById("nicofox-not-watching").hidden = false;
  }
}

/* Video Tools on the panel. */
nicofox.panel.videoTools = {};

/* Call the DownloadManager to add the video to the download query.
   To avoid multiple times of adding, disable the button after queued. */
nicofox.panel.videoTools.download = function() {
  var browser = gBrowser.selectedBrowser;
  var info = browser.nicofoxVideoInfo;
  if (!browser || !info) { return; }
  
  var url = browser.contentWindow.location.href;
  if (url.indexOf("?") >= 0) {
    url = url.substring(0, url.indexOf("?"));
  }
  Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofox);
  /* For info cache, check whether the page is dynamicaly changed */
  if (url == info.url) {
    nicofox.DownloadManager.addDownload(url, info);
  } else {
    nicofox.DownloadManager.addDownload(url);
  }
  document.getElementById("nicofox-watching-download").disabled = true;
};
/* Go to the Nico Nico Nico website in different region. */
nicofox.panel.videoTools.goSite = function(event, region) {
  /* checkMiddleClick() will not check the left click,
     but oncommand will not be fired on left click for <image>.
     So ignore right click at onclick as an alternate. */
  if (event.button == 2) { return; }
  var url = "";
  var browser = gBrowser.selectedBrowser;
  if (!browser || !browser.nicofoxVideoInfo) {
    /* Go to homepage if no video is opened */
    url = "http://" + region + ".nicovideo.jp/";
  } else {
    /* Go to the video page in different region */
    url = "http://" + region + ".nicovideo.jp/watch/" + browser.nicofoxVideoInfo.nicoData.id;
  }
  openUILink(url, event, false, true);
}
/* Go to third-party tool sites */
nicofox.panel.videoTools.goThridPartyToolSite = function(event, tool) {
  /* checkMiddleClick() will not check the left click,
     but oncommand will not be fired on left click for <image>.
     So ignore right click at onclick as an alternate. */
  if (event.button == 2) { return; }
  var url = "";
  var browser = gBrowser.selectedBrowser;
  if (!browser || !browser.nicofoxVideoInfo) {
    return;
  }
  var info = browser.nicofoxVideoInfo;
  /* Fill the URL address for each type of tool. */
  switch(tool) {
    case "sound":
    url = nicofox.Core.prefs.getComplexValue("nicomonkey.sound_converter", Ci.nsISupportsString).data;
    url = url.replace("%1", info.nicoData.id);
    break;
    case "chart":
    url = "http://www.nicochart.jp/watch/" + info.nicoData.id;
    break;
    case "comment":
    /* NicoNico Farm only supports original Japanese site thread, we need to check it */
    if (/!^[a-z]/.test(info.nicoData.v)) { return; }
    url = "http://nico.xii.jp/comment/?url=" + info.nicoData.id;
    break;
  }

  openUILink(url, event, false, true);
}

/* If there is not thumbnail file data stored in database, prompt user to download for all old records. */
nicofox.panel.responseThumbnailCheck = function(resultArray) {
  if (resultArray[0].count > 0) {
    document.getElementById("nicofox-thumb-notice").hidden = false;
  } else {
  }
};

/* Do when user agreed to use the thumbnail download function... */
nicofox.panel.enableThumbnail = function() {
  document.getElementById("nicofox-thumb-notice").hidden = true;
  document.getElementById("nicofox-thumb-progress").hidden = false;
  /* Ask download manager to fetch thumbnails */
  nicofox.DownloadManager.fetchThumbnails();
};

/* Fetch downloaded items when available, append them to the "to load" list. */
nicofox.panel.fetchDownloads = function(resultArray) {
  this.itemsToLoad = this.itemsToLoad.concat(resultArray);
  /* Run the timer to initiate loading, if the timer is stopped. */
  if (!this.loadTimer.callback) {
    this.loadTimer.initWithCallback(this.timerEvent, 5, Ci.nsITimer.TYPE_REPEATING_SLACK);
  }
};

/* Called when all download items are retrived.
 * Append a "end mark" to tell the timer event where the items ends. */
nicofox.panel.doneGetDownloads = function() {
  this.itemsToLoad.push({'end': true});
  /* Check whether to prompt user to download thumbnail */
  if (nicofox.DownloadManager.thumbFetching) {
    document.getElementById("nicofox-thumb-notice").hidden = true;
    document.getElementById("nicofox-thumb-progress").hidden = false;
  } else if (nicofox.Core.prefs.getBoolPref("download_thumbnail")) {
    nicofox.DownloadManager.checkThumbnail(this, "responseThumbnailCheck", "dbFail");
  }
};

/* Update the <listitem> when new download were added or the status had changed. */
nicofox.panel.updateDownloadItem = function(listItem, result) {
  listItem.setAttribute("type", "nicofox-download");
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
    listItem.setAttribute("sfhidelowquality", false);
  } else if (result.video_economy == 0) {
    listItem.setAttribute("sfhidelowquality", true);
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
  if (result.comment_type) {
    listItem.setAttribute("sfcommenttype", result.comment_type);
  }
  /* Avoid 0 to be considered as false */
  if (typeof result.status == "number") {
    listItem.setAttribute("dlstatus", result.status);
  }
  if (result.info) {
    listItem.setAttribute("sfvariantinfo", result.info);
  }
  /* For completed items, show more info. */
  if (result.max_bytes > 0 && result.status == 1) {
    var endTime = new Date(result.end_time);
    var commentType = (result.comment_type)? result.comment_type: listItem.getAttribute("sfcommenttype");
    listItem.setAttribute("sfvideoinfo", nicofox.DownloadManager.getInfoString(result.max_bytes, commentType, endTime));
  }
  /* If the status is "downloading", update the progress type */
  if (result.status == 7) {
    listItem.setAttribute("progresstype", "undetermined");
    listItem.setAttribute("sfdownloadstatus", nicofox.DownloadManager.cachedStrings.progressLoading);
  }
};

nicofox.panel.dbFail = function() {
  alert("dbFail!");
};

/* Timer event: used to load the UI. */
nicofox.panel.timerEvent = {};
nicofox.panel.timerEvent.loadIndex = 0;
nicofox.panel.timerEvent.notify = function(timer) {
  /* Avoid possible leaking */
  if(!document) {
    timer.cancel();
    return;
  }
  /* Load 5 items once and use document fragment to speed up */
  var fragment = document.createDocumentFragment();
  var list = document.getElementById("nicofox-download-list");
  for (var j = 1; j <= 5; j++) {
    var result = nicofox.panel.itemsToLoad[nicofox.panel.timerEvent.loadIndex];
    /* When there is no new items available, break. */
    if (!result) {
      break;
    }
    /* When end of the list is reached, stop the timer. */
    if (result.end) {
      timer.cancel();
      break;
    }
    var listItem = document.createElement("richlistitem");
    nicofox.panel.updateDownloadItem(listItem, result);
    if (nicofox.panel._searchTerms.length > 0) {
      /* Search workaround: check the search terms when adding the items */
      var lowerCaseTitle = listItem.getAttribute("sfvideotitle").toLowerCase();
      /* Check whether all keywords matched */
      let match = true;
      for (var j = 0; j < nicofox.panel._searchTerms.length; j++) {
        if (lowerCaseTitle.indexOf(nicofox.panel._searchTerms[j]) == -1) {
          match = false;
        }
      }
      listItem.hidden = !match;
    }
    fragment.appendChild(listItem);
    nicofox.panel.timerEvent.loadIndex += 1;
  }
  list.appendChild(fragment);
};

/* Set the thumbnail display type and set the value to the preference. */
nicofox.panel.setThumbnailDisplay = function(value) {
  document.getElementById('nicofox-download-list').setAttribute('sfthumbdisplay', value);
}

/* A very simple "Search" feature implemented by hidding elements. */
nicofox.panel.search = function(value) {
  var list = document.getElementById("nicofox-download-list");
  var items = list.children;
  /* Split search terms. From chrome/toolkit/content/mozapps/downloads/downloads.js on mozilla-central. */
  this._searchTerms = value.replace(/^\s+|\s+$/g, "").toLowerCase().split(/\s+/);

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var lowerCaseTitle = item.getAttribute("sfvideotitle").toLowerCase();
    /* Check whether all keywords matched */
    let match = true;
    for (var j = 0; j < this._searchTerms.length; j++) {
      if (lowerCaseTitle.indexOf(this._searchTerms[j]) == -1) {
        match = false;
      }
    }
    item.hidden = !match;
  }
};

/* Resume download */
nicofox.panel.resume = function() {
  nicofox.DownloadManager.resumeDownloads();
}

/* When popup menu is showing, check the selected item and generate correct menu items 
 * Like /toolkit/mozapps/downloads/content/downloads.js on mozilla-central
 */
nicofox.panel.displayContextMenuItems = [
[ "go", "copy", "separator2", /*"select-all",*/ "remove"], /* 0 Waiting */
[ "open", "open-external", "open-folder", /*"move-folder",*/ "separator1", "go", "copy", "separator2", /*"select-all",*/ "remove" ], /* 1 Completed */
[ "retry", "separator1", "go", "copy", "separator2", /*"select-all",*/ "remove" ], /* 2 Canceled */
[ "retry", "separator1", "go", "copy", "separator2", /*"select-all",*/ "remove" ], /* 3 Failed */
[ "retry", "separator1", "go", "copy", "separator2", /*"select-all",*/ "remove" ], /* 4 Scheduled */
[ "cancel", "separator1", "go", "copy", "separator2", /*"select-all",*/ "remove" ], /* 5 Downloading */
[ "cancel", "separator1", "go", "copy", "separator2", /*"select-all",*/ "remove" ], /* 6 Downloading */
[ "cancel", "separator1", "go", "copy", "separator2", /*"select-all",*/ "remove" ], /* 7 Downloading */
[], /*Reserved */
[ "missing", "retry", "separator1", "go", "copy", "separator2", /*"select-all",*/ "remove" ], /* 9 File Missing (hack) */
];

nicofox.panel.generateContextMenu = function(aEvent) {
  /* Check for context menu showing */
  if (aEvent.target.id != "nicofox-download-item-popup") {
    return false;
  }
  var selectedItem = document.getElementById("nicofox-download-list").selectedItem;
  if (!selectedItem) { return false; }
  
  /* Create context menu, depending on the video status */
  var popup = document.getElementById("nicofox-download-item-popup");
  var dlStatus = parseInt(selectedItem.getAttribute("dlstatus"), 10);
   
  var menuitems = popup.childNodes;
  for (var i = 0; i < menuitems.length; i++) {
    menuitems[i].hidden = true;
  } 
  
  /* Check for file missing case */
  if (selectedItem.hasAttribute("sfvideofile")) {
    var file = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
    if (dlStatus == 1 && !file.exists()) {
      dlStatus = 9;
    }
  }
  var displayItems = nicofox.panel.displayContextMenuItems[dlStatus];
  for (var i = 0; i < displayItems.length; i++) {
    document.getElementById("nicofox-download-item-popup-" + displayItems[i]).hidden = false;
  }
  return true;
}

/* Handle Commands */
nicofox.panel.commands = {
  /* "Play with NicoFox Player" */
  open: function(selectedItem) {
    /* Open if the status is completed and file exists */
    var dlStatus = parseInt(selectedItem.getAttribute("dlstatus"), 10);
    var videoFile = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
    if (dlStatus != 1 || !videoFile.exists()) { return; }
    
    var videoUrl = nicofox.Services.io.newFileURI(videoFile).spec;
    
    /* Check if comment XML file exists */
    var commentUrl = "";
    var commentVariants = "";

    if (selectedItem.hasAttribute("sfvariantinfo")) {
      var variants = JSON.parse(selectedItem.getAttribute("sfvariantinfo")).comment_variants;
      commentVariants = variants.join(",");
    } else if (selectedItem.hasAttribute("sfcommentfile")) {
      var commentFile = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfcommentfile"));
      if (commentFile.exists()) {
        commentUrl = nicofox.Services.io.newFileURI(commentFile).spec;
      }
    }
    window.openDialog('chrome://nicofox/content/nicofoxPlayer.xul', 'nicofox_swf', 'width=672, height=424, dialog=no, resizable=yes, centerscreen', {video: videoUrl, comment: commentUrl, commentVariants: commentVariants, title: selectedItem.getAttribute("sfvideotitle")});
  },
  /* Cancel */
  cancel: function(selectedItem) {
    var id = parseInt(selectedItem.getAttribute("sfid"), 10);
    nicofox.DownloadManager.cancelDownload(id);
  },
  /* Retry */
  retry: function(selectedItem) {
    var id = parseInt(selectedItem.getAttribute("sfid"), 10);
    var dlStatus = parseInt(selectedItem.getAttribute("dlstatus"), 10);
    if (dlStatus == 2 || dlStatus == 3 || dlStatus == 4) {
      /* Retry when canceled, failed or scheduled */
      nicofox.DownloadManager.retryDownload(id);
    } else {
      /* Retry when video file does not exist. */
      if (selectedItem.hasAttribute("sfvideofile")) {
        var file = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
        if (dlStatus == 1 && !file.exists()) {
          nicofox.DownloadManager.retryDownload(id);
        }
      }
    }
  },
  /* Open with External Player */
  openExternal: function(selectedItem) {
    /* Open if the status is completed and file exists */
    var dlStatus = parseInt(selectedItem.getAttribute("dlstatus"), 10);
    var videoFile = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
    if (dlStatus != 1 || !videoFile.exists()) { return; }
    
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
      Components.utils.import("resource://nicofox/ProcessRunner.jsm", nicofox);
      nicofox.processRunner.openFileWithProcess(externalApplication, videoFile, "nsIProcess");
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
    var dlStatus = parseInt(selectedItem.getAttribute("dlstatus"), 10);
    var videoFile = new nicofox.panel._fileInstance(selectedItem.getAttribute("sfvideofile"));
    if (dlStatus != 1 || !videoFile.exists()) { return; }
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
    var dlStatus = parseInt(selectedItem.getAttribute("dlstatus"), 10);
    if (dlStatus < 5 || dlStatus > 7) { /* Canceled or Failed */
      nicofox.DownloadManager.removeDownload(id);
    }
  }
};


/* Open "NicoFox Option" */
/* Modified from: toolkit/mozapps/extensions/content/extensions.js */
nicofox.panel.openOptionsWindow = function() {
  var optionsURL = "chrome://nicofox/content/preferences.xul"
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
  document.getElementById("nicofox-library").hidePopup();
};

/* Use NicoFox Player to play a video stored in the disk */
nicofox.panel.openFileInPlayer = function() {
  var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  filePicker.init(window, nicofox.Core.strings.getString("chooseVideoFile"), null);
  if (nicofox.Core.prefs.getComplexValue("save_path", Ci.nsISupportsString).data) {
    filePicker.displayDirectory = nicofox.Core.prefs.getComplexValue("save_path", Ci.nsILocalFile);
  }
  filePicker.appendFilter(nicofox.Core.strings.getString("supportedType"), "*.flv; *.mp4; *.swf");
  /* Try to find XML files then play them all */
  if (filePicker.show() == Ci.nsIFilePicker.returnOK) {
      /* XXX: Find a better way to make a function */
      var file = filePicker.file;
      var videoUriSpec = nicofox.Services.io.newFileURI(file).spec;
      var commentUriSpec = "";

      var commentFile = new nicofox.panel._fileInstance(file.path.replace(/(flv|mp4|swf)$/, "xml"));
      if (commentFile.exists()) {
        commentUriSpec = nicofox.Services.io.newFileURI(commentFile).spec; 
      }    
    window.openDialog("chrome://nicofox/content/nicofoxPlayer.xul", "nicofox_swf", "width=672, height=424, dialog=no, resizable=yes, centerscreen", {video: videoUriSpec, comment: commentUriSpec, title: file.leafName});
    }
};
/* A download listener to DownloadManager */
nicofox.panel.listener = {

};
nicofox.panel.listener.thumbnailFetcherCount = function(id, content) {
  document.getElementById("nicofox-thumb-progress-meter").setAttribute("max", content);
  document.getElementById("nicofox-thumb-progress-meter").setAttribute("value", 0);
};
nicofox.panel.listener.thumbnailFetcherProgress = function(id, content) {
  document.getElementById("nicofox-thumb-progress-meter").setAttribute("value", content);
};
nicofox.panel.listener.thumbnailFetcherDone = function(id, content) {
  document.getElementById("nicofox-thumb-notice").hidden = true;
  document.getElementById("nicofox-thumb-progress").hidden = true;
};
nicofox.panel.listener.thumbnailAvailable = function(id, content) {
  var listItem = document.getElementById("smileFoxListItem" + id);
  listItem.setAttribute("thumbnail", content);
};

nicofox.panel.listener.downloadAdded = function(id, content) {
  var list = document.getElementById("nicofox-download-list");
  var listItem = document.createElement("richlistitem");
  /* Workaround: not to display the quality status at the first time */
  content.video_economy = 0;
  nicofox.panel.updateDownloadItem(listItem, content);
  listItem.setAttribute("progresstype", "undetermined");
  list.insertBefore(listItem, list.firstChild);
};
nicofox.panel.listener.downloadUpdated = function(id, content) {
  var listItem = document.getElementById("smileFoxListItem"+ id);
  nicofox.panel.updateDownloadItem(listItem, content);
};
nicofox.panel.listener.downloadProgressUpdated = function(id, content) {
  var listItem = document.getElementById("smileFoxListItem"+ id);
  if (!listItem) { return; }
  listItem.setAttribute("progresstype", "determined");
  listItem.setAttribute("sfdownloadstatus", content.downloadStatus);
  listItem.setAttribute("currentbytes", content.currentBytes);
  listItem.setAttribute("maxbytes", content.maxBytes);
};
nicofox.panel.listener.downloadVideoCompleted = function(id, content) {
  var listItem = document.getElementById("smileFoxListItem"+ id);
  if (!listItem) { return; }
  listItem.setAttribute("progresstype", "undetermined");
  listItem.setAttribute("sfdownloadstatus", nicofox.DownloadManager.cachedStrings.progressRelatedDownloading);
};
nicofox.panel.listener.downloadRemoved = function(id) {
  var list = document.getElementById("nicofox-download-list");
  var listItem = document.getElementById("smileFoxListItem"+ id);
  if (!listItem) { return; }
  list.removeChild(listItem);
};
nicofox.panel.listener.downloadPaused = function(id) {
  document.getElementById("nicofox-download-paused").hidden = false;
};
nicofox.panel.listener.downloadResumed = function(id) {
  document.getElementById("nicofox-download-paused").hidden = true;
};
/* Helper: Get a nsILocalFile instance from a path */
nicofox.panel._fileInstance = Components.Constructor("@mozilla.org/file/local;1", "nsILocalFile", "initWithPath");
/* XXX: Remove listener used only */
nicofox.panel.unload = function() {
  if (nicofox.isInPrivateWindow) {
    return;
  }
  if (nicofox.panel.timerEvent.callback) {
    nicofox.panel.timerEvent.cancel();
  }
  Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofox);
  nicofox.DownloadManager.removeListener(nicofox.panel.listener);
}
