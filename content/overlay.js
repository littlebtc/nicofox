/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 et filetype=javascript
 */

if (!nicofox) {var nicofox = {};}
Components.utils.import("resource://nicofox/Core.jsm", nicofox);
Components.utils.import("resource://gre/modules/Services.jsm", nicofox);

nicofox.overlay = {
  /* On browser window loading */
  onLoad: function() {
    window.removeEventListener("load", nicofox.overlay.onLoad, false);
    /* initialization code */
    nicofox.overlay.initialized = true;

    /* For Firefox 4, append the toolbar button for the first time.
     * Modified from https://developer.mozilla.org/en/Code_snippets/Toolbar
     */
    if (!nicofox.Core.prefs.getBoolPref("toolbar_check") && !document.getElementById("nicofox-panel-container")) {
      var toolbarId = "nicofox-toolbar-button";
      var navBar = document.getElementById("nav-bar");
      var curSet = navBar.currentSet.split(",");
      if (curSet.indexOf(toolbarId) == -1) {
        /* Just append to the end. */
        curSet.push(toolbarId);
        navBar.setAttribute("currentset", curSet.join(","));
        navBar.currentSet = curSet.join(",");
        document.persist(navBar.id, "currentset");
        try {
           BrowserToolboxCustomizeDone(true);
        } catch (e) {}
      }
      nicofox.Core.prefs.setBoolPref("toolbar_check", true);
    }
    /* Register panel initializer */
    document.getElementById("nicofox-library").addEventListener("popupshown", nicofox.panel.onPopupShown, false);
    document.getElementById("nicofox-library").addEventListener("popuphidden", nicofox.panel.onPopupHidden, false);

    /* Register context menu showing listener */
    var contextMenu = document.getElementById("contentAreaContextMenu");
    if (contextMenu) {
      contextMenu.addEventListener("popupshowing", nicofox.overlay.onContextMenuShowing, false);
    }

    Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofox);
    /* Update download manager statusbar, then register for changes */
    nicofox.refreshIcon();
    nicofox.DownloadManager.addListener(nicofox.listener);
    
    /* Watch DOMContentLoaded event to initialize DOM video info reading */
    var appcontent = window.document.getElementById("appcontent");
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", nicofox.overlay.onDOMContentLoaded, false);
    }
    gBrowser.addProgressListener(nicofox.progressListener);

    var container = gBrowser.tabContainer;
    container.addEventListener("TabClose", nicofox.overlay.tabRemoved, false);
  },
  /* On browser window unloading */
  onUnload: function() {
    window.removeEventListener("unload", nicofox.overlay.onUnload, false);
    nicofox.panel.unload();

    document.getElementById("nicofox-library").removeEventListener("popupshown", nicofox.panel.onPopupShown, false);
    document.getElementById("nicofox-library").removeEventListener("popuphidden", nicofox.panel.onPopupHidden, false);

    nicofox.DownloadManager.removeListener(nicofox.listener);
    var contextMenu = document.getElementById("contentAreaContextMenu");
    if (contextMenu) {
      contextMenu.removeEventListener("popupshowing", nicofox.overlay.onContextMenuShowing, false);
    }
    var appcontent = window.document.getElementById("appcontent");
    if (appcontent) {
      appcontent.removeEventListener("DOMContentLoaded", nicofox.overlay.onDOMContentLoaded, false);
    }
    gBrowser.removeProgressListener(nicofox.progressListener);
    var container = gBrowser.tabContainer;
    container.removeEventListener("TabClose", nicofox.overlay.tabRemoved, false);
  },
  /* On View -> NicoFox */
  onMenuItemCommand: function(aEvent) {
    var toolbarButton = document.getElementById("nicofox-toolbar-button");
    if (toolbarButton) {
      var addonBar = document.getElementById("addon-bar");
      if (toolbarButton.parentNode == addonBar && addonBar.collapsed) {
        toggleAddonBar();
      }
      document.getElementById("nicofox-library").openPopup(document.getElementById("nicofox-toolbar-button"), 'after_end', 0, 0, false, false);
    } else {
      document.getElementById("nicofox-library").openPopup(document.getElementById("nicofoxStatusbarContainer"), 'before_end', 0, 0, false, false);
    }
  },
  /* On context menu showing, check the link URL, provide download menuitem if necessary */
  onContextMenuShowing: function(aEvent) {
    var hidden = true;
    if (gContextMenu.onLink) {
      var url = gContextMenu.linkURL;
      if (url && /^http:\/\/(?:www|tw)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+/.test(url)) {
        hidden = false;
      }
    }
    document.getElementById("nicofox-context-seprator").hidden = hidden;
    document.getElementById("nicofox-context-download").hidden = hidden;
  },
  /* When the context menu item is clicked. */
  downloadLink: function() {
    var url = gContextMenu.linkURL;
    if (url && /^http:\/\/(?:www|tw)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+/.test(url)) {
      if (url.indexOf("?") >= 0) {
        url = url.substring(0, url.indexOf("?"))
      }
      Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofox);
      nicofox.DownloadManager.addDownload(url);
      /* Display the panel UI. */
      var toolbarButton = document.getElementById("nicofox-toolbar-button");
      if (toolbarButton) {
        var addonBar = document.getElementById("addon-bar");
        if (toolbarButton.parentNode == addonBar && addonBar.collapsed) {
          toggleAddonBar();
        }
        document.getElementById("nicofox-library").openPopup(document.getElementById("nicofox-toolbar-button"), 'after_end', 0, 0, false, false);
      } else {
        document.getElementById("nicofox-library").openPopup(document.getElementById("nicofoxStatusbarContainer"), 'before_end', 0, 0, false, false);
      }
    }
  },
  /* When DOM Loaded, read video info if necessary. */
  onDOMContentLoaded: function(aEvent) {
    /* Don't cope with <iframe> and non-webpage loading. */
    var contentDoc = aEvent.originalTarget;
    if (!contentDoc instanceof HTMLDocument) { return; }
    var contentWin = contentDoc.defaultView;
    var browser = gBrowser.getBrowserForDocument(contentDoc);
    if (contentWin.frameElement || !browser) { return; }

    /* Check if we are at nicovideo.jp */
    if (contentWin.location.protocol != "http:" || !(/nicovideo\.jp$/.test(contentWin.location.host))) {
      return;
    }
    /* For video page, read the video info, */
    if (/^http:\/\/(?:www|tw)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+/.test(contentWin.location.href)) {
      if (browser == gBrowser.selectedBrowser) {
        var info = { 'reading': true }
        browser.nicofoxVideoInfo = info;
        nicofox.panel.updateVideoInfo(info);
      }
      Components.utils.import("resource://nicofox/VideoInfoReader.jsm", nicofox);
      Components.utils.import("resource://nicofox/When.jsm", nicofox);
      nicofox.VideoInfoReader.readFromPageDOM(contentWin.wrappedJSObject, contentDoc)
                             .then(nicofox.overlay.videoInfoRetrived.bind(nicofox.overlay), nicofox.overlay.videoInfoFailed.bind(nicofox.overlay, contentDoc));
    }
  },
  /* After video info is read, write data to specific browser, update the panel if necessary */
  videoInfoRetrived: function(info) {
    var contentDoc = info.target;
    if(!contentDoc) { return; }
    var browser =  gBrowser.getBrowserForDocument(contentDoc);
    if (!browser) { return; }
    browser.nicofoxVideoInfo = info;
    if (browser == gBrowser.selectedBrowser) {
      nicofox.panel.updateVideoInfo(info);
    }
    contentDoc = null;
  },
  videoInfoFailed: function(contentDoc, reason) {
    var info = { 'error': reason };
    if(!contentDoc) { return; }
    var browser =  gBrowser.getBrowserForDocument(contentDoc);
    if (!browser) { return; }
    browser.nicofoxVideoInfo = info;
    if (browser == gBrowser.selectedBrowser) {
      nicofox.panel.updateVideoInfo(info);
    }
    contentDoc = null;
  },
  /* Clean up for the nicoVideoInfo to prevent memory leak */
  tabRemoved: function(event) {
    var browser = gBrowser.getBrowserForTab(event.target);
    browser.nicofoxVideoInfo = null;
  }
};
/* Refresh statusbar download notification */
nicofox.refreshIcon = function() {
  var nicofoxLabel = document.getElementById("nicofoxStatusbarLabel");
  if (!nicofoxLabel) { return; }
  var downloadCount = nicofox.DownloadManager.activeDownloadCount;
  var waitingCount = nicofox.DownloadManager.queuedDownloadCount;
  if (downloadCount > 0) {
    nicofoxLabel.setAttribute("value", downloadCount + "/" + (downloadCount + waitingCount));
    nicofoxLabel.hidden = false;
  } else {
    nicofoxLabel.setAttribute("value", "");
    nicofoxLabel.hidden = true;
  }
};
/* XXX: to display status in statusbar */
nicofox.listener = {

};
nicofox.listener.queueChanged = function(id, content) {
  nicofox.refreshIcon();
};

nicofox.progressListener = {
  QueryInterface: function(aIID) {
   if (aIID.equals(Ci.nsIWebProgressListener) ||
       aIID.equals(Ci.nsISupportsWeakReference) ||
       aIID.equals(Ci.nsISupports))
     return this;
   throw Components.results.NS_NOINTERFACE;
  },

  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
    /* When start loading, remove current rendering result from <browser> */
    /* From: browser/base/content/browser.js, XULBrowserWindow.onStateChange() */
    if(aStateFlags & Ci.nsIWebProgressListener.STATE_START &&
       aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK &&
       aRequest && aWebProgress.DOMWindow == content) {
      gBrowser.selectedBrowser.nicofoxVideoInfo = null;
      nicofox.panel.updateVideoInfo(gBrowser.selectedBrowser.nicofoxVideoInfo);
    }
  },
  /* Change panel info when location is changed (e.g. tab swithing) */
  onLocationChange: function(aProgress, aRequest, aURI) {
    nicofox.panel.updateVideoInfo(gBrowser.selectedBrowser.nicofoxVideoInfo);
  },

  // For definitions of the remaining functions see related documentation
  onProgressChange: function(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) { },
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) { },
  onSecurityChange: function(aWebProgress, aRequest, aState) { }

};
window.addEventListener("load", nicofox.overlay.onLoad, false);
window.addEventListener("unload", nicofox.overlay.onUnload, false);
