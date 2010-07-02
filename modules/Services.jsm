/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 et filetype=javascript
 */
/* From mozilla-central code toolkit/content/Services.jsm by Gavin Sharp
 * Originally GPL/LGPL/MPL tri-licensed
 * Modified by littlebtc, GPLv2 only */

let EXPORTED_SYMBOLS = ["Services"];

const Ci = Components.interfaces;
const Cc = Components.classes;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

let Services = {};

/* Caching the most-used services
 * Dependency notice: defineLazyGetter was introduced in Gecko 1.9.2 / Fx 3.6
 */

XPCOMUtils.defineLazyGetter(Services, "prefs", function () {
  return Cc["@mozilla.org/preferences-service;1"]
           .getService(Ci.nsIPrefService)
});

XPCOMUtils.defineLazyGetter(Services, "appinfo", function () {
  return Cc["@mozilla.org/xre/app-info;1"]
           .getService(Ci.nsIXULAppInfo)
           .QueryInterface(Ci.nsIXULRuntime);
});

XPCOMUtils.defineLazyGetter(Services, "dirsvc", function () {
  return Cc["@mozilla.org/file/directory_service;1"]
           .getService(Ci.nsIDirectoryService)
           .QueryInterface(Ci.nsIProperties);
});

XPCOMUtils.defineLazyServiceGetter(Services, "wm",
                                   "@mozilla.org/appshell/window-mediator;1",
                                   "nsIWindowMediator");

XPCOMUtils.defineLazyServiceGetter(Services, "obs",
                                   "@mozilla.org/observer-service;1",
                                   "nsIObserverService");

XPCOMUtils.defineLazyServiceGetter(Services, "perms",
                                   "@mozilla.org/permissionmanager;1",
                                   "nsIPermissionManager");

XPCOMUtils.defineLazyServiceGetter(Services, "io",
                                   "@mozilla.org/network/io-service;1",
                                   "nsIIOService2");

XPCOMUtils.defineLazyServiceGetter(Services, "prompt",
                                   "@mozilla.org/embedcomp/prompt-service;1",
                                   "nsIPromptService");

XPCOMUtils.defineLazyServiceGetter(Services, "search",
                                   "@mozilla.org/browser/search-service;1",
                                   "nsIBrowserSearchService");

XPCOMUtils.defineLazyServiceGetter(Services, "storage",
                                   "@mozilla.org/storage/service;1",
                                   "mozIStorageService");

XPCOMUtils.defineLazyServiceGetter(Services, "vc",
                                   "@mozilla.org/xpcom/version-comparator;1",
                                   "nsIVersionComparator");

XPCOMUtils.defineLazyServiceGetter(Services, "locale",
                                   "@mozilla.org/intl/nslocaleservice;1",
                                   "nsILocaleService");

XPCOMUtils.defineLazyServiceGetter(Services, "scriptloader",
                                   "@mozilla.org/moz/jssubscript-loader;1",
                                   "mozIJSSubScriptLoader");

XPCOMUtils.defineLazyServiceGetter(Services, "ww",
                                   "@mozilla.org/embedcomp/window-watcher;1",
                                   "nsIWindowWatcher");

XPCOMUtils.defineLazyServiceGetter(Services, "tm",
                                   "@mozilla.org/thread-manager;1",
                                   "nsIThreadManager");

XPCOMUtils.defineLazyServiceGetter(Services, "droppedLinkHandler",
                                   "@mozilla.org/content/dropped-link-handler;1",
                                   "nsIDroppedLinkHandler");

XPCOMUtils.defineLazyServiceGetter(Services, "console",
                                   "@mozilla.org/consoleservice;1",
                                   "nsIConsoleService");

XPCOMUtils.defineLazyServiceGetter(Services, "strings",
                                   "@mozilla.org/intl/stringbundle;1",
                                   "nsIStringBundleService");

