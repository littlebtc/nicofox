/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 et filetype=javascript
 */

if (!nicofox) {var nicofox = {};}
Components.utils.import("resource://nicofox/Core.jsm", nicofox);
Components.utils.import("resource://nicofox/Services.jsm", nicofox);

nicofox.overlay = {
  /* On browser window loading */
  onLoad: function() {
    window.removeEventListener("load", nicofox.overlay.onLoad, false);
    /* initialization code */
    nicofox.overlay.initialized = true;

    /* Apply in-content UI whitelist to about:collection on Firefox 4. http://bugzil.la/571970 */
    if (XULBrowserWindow.inContentWhitelist) {
      XULBrowserWindow.inContentWhitelist.push("about:nicofox");
    }

    /* Register panel initializer */
    document.getElementById("nicofox-library").addEventListener("popupshowing", nicofox.panel.onPopupShowing, false);
    document.getElementById("nicofox-library").addEventListener("popupshown", nicofox.panel.onPopupShown, false);

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
    gBrowser.addProgressListener(nicofox.progressListener, Ci.nsIWebProgress.NOTIFY_LOCATION);
  },
  /* On browser window unloading */
  onUnload: function() {
    window.removeEventListener("unload", nicofox.overlay.onUnload, false);

    document.getElementById("nicofox-library").removeEventListener("popupshowing", nicofox.panel.onPopupShowing, false);
    document.getElementById("nicofox-library").removeEventListener("popupshown", nicofox.panel.onPopupShown, false);

    nicofox.DownloadManager.removeListener(nicofox.listener);
    var contextMenu = document.getElementById("contentAreaContextMenu");
    if (contextMenu) {
      contextMenu.removeEventListener("popupshowing", nicofox.overlay.onContextMenuShowing, false);
    }
    var appcontent = window.document.getElementById("appcontent");
    if (appcontent) {
      appcontent.removeEventListener("DOMContentLoaded", nicofox.overlay.onDOMContentLoaded, false);
    }
    gBrowser.removeProgressListener(this.progressListener);
  },
  /* On View -> NicoFox */
  onMenuItemCommand: function(aEvent) {
    /* Temp workaround for Firefox 4: expand addon bar so that the panel can be shown */
    var addonBar = document.getElementById("addon-bar");
    if (addonBar) {
      addonBar.collapsed = false;
    }
    document.getElementById("nicofox-library").hidden = false;
    if (document.getElementById("nicofoxToolbarButton")) {
      document.getElementById("nicofox-library").openPopup(document.getElementById("nicofoxToolbarButton"), 'after_end', 0, 0, false, false);
    } else {
      document.getElementById("nicofox-library").openPopup(document.getElementById("nicofoxStatusbarContainer"), 'before_end', 0, 0, false, false);
    }
  },
  /* On context menu showing, check the link URL, provide download menuitem if necessary */
  onContextMenuShowing: function(aEvent) {
    var hidden = true;
    if (gContextMenu.onLink) {
      var url = gContextMenu.linkURL;
      if (url && /^http:\/\/(?:www|tw|de|es)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+/.test(url)) {
        hidden = false;
      }
    }
    document.getElementById("nicofox-context-seprator").hidden = hidden;
    document.getElementById("nicofox-context-download").hidden = hidden;
  },
  /* When the context menu item is clicked. */
  downloadLink: function() {
    var url = gContextMenu.linkURL;
    if (url && /^http:\/\/(?:www|tw|de|es)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+/.test(url)) {
      if (url.indexOf("?") >= 0) {
        url = url.substring(0, url.indexOf("?"))
      }
      Components.utils.import("resource://nicofox/DownloadManager.jsm", nicofox);
      nicofox.DownloadManager.addDownload(url);
    }
  },
  /* Based on Greasemonkey. Is the URL nicomonkeyable? */
  isNicomonkeyable: function(url) {
    var scheme = nicofox.Services.io.extractScheme(url);
    return (
      (scheme == "http") && /nicovideo\.jp\//.test(url)
    );
  },
  /* When DOM Loaded, read video info if necessary. */
  onDOMContentLoaded: function(aEvent) {
    /* Don't cope with <iframe> and non-webpage loading. */
    var contentDoc = aEvent.originalTarget;
    if (!contentDoc instanceof HTMLDocument) { return; }
    var contentWin = contentDoc.defaultView;
    var browser =  gBrowser.getBrowserForDocument(contentDoc);
    if (contentWin.frameElement || !browser) { return; }

    /* Check if we are at nicovideo.jp */
    if (contentWin.location.protocol != "http:" || !(/nicovideo\.jp$/.test(contentWin.location.host))) {
      return;
    }
    /* For video page, read the video info, */
    if (/^http:\/\/(?:www|tw|de|es)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+/.test(contentWin.location.href)) {
      if (browser == gBrowser.selectedBrowser) {
        var info = { 'reading': true }
        browser.nicofoxVideoInfo = info;
        nicofox.panel.updateVideoInfo(info);
      }
      Components.utils.import("resource://nicofox/VideoInfoReader.jsm");
      VideoInfoReader.readFromPageDOM(contentWin, contentDoc, true, nicofox.overlay, 'videoInfoRetrived', 'videoInfoFailed');
    }
  },
  /* After video info is read, write data to specific browser, update the panel if necessary */
  videoInfoRetrived: function(contentDoc, info) {
    if(!contentDoc) { return; }
    var browser =  gBrowser.getBrowserForDocument(contentDoc);
    if (!browser) { return; }
    browser.nicofoxVideoInfo = info;
    if (browser == gBrowser.selectedBrowser) {
      nicofox.panel.updateVideoInfo(info);
    }
  },
  videoInfoFailed: function(reason) {
    var info = { 'error': reason };
    if(!contentDoc) { return; }
    var browser =  gBrowser.getBrowserForDocument(contentDoc);
    if (!browser) { return; }
    if (browser == gBrowser.selectedBrowser) {
      nicofox.panel.updateVideoInfo(info);
    }
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
