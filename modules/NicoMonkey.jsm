/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 * A modified and simplified version of Greasemonkey, which is originally in MIT license
 */
var EXPORTED_SYMBOLS = ['NicoMonkey'];

const Cc = Components.classes;
const Ci = Components.interfaces;

let NicoMonkey = {}

const appSvc = Cc["@mozilla.org/appshell/appShellService;1"]
                 .getService(Ci.nsIAppShellService);

const gmSvcFilename = Components.stack.filename;

/* XXX: NicoFox support Fx 3.6+ only, remove JS version check */
const maxJSVersion = "1.8";

/* Asynchrously fetch content of one URL */
function fetchUrlContentsAsync(url, callback) {
  if (typeof callback != 'function') { return; }
  /* 1.9.2 Dependency: NetUtil.jsm  */
  Components.utils.import("resource://nicofox/Services.jsm"); 
  Components.utils.import("resource://gre/modules/NetUtil.jsm");

  var channel = Services.io.newChannel(url, null, null);
  NetUtil.asyncFetch(channel, (function(callback, url) {
    return function(aInputStream, aResult) {
      if (!Components.isSuccessCode(aResult)) {
        GM_logError("Cannot load NicoMonkey script: "+ url);
        return;
      }
      var scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
      scriptableInputStream.init(aInputStream);
      var str = scriptableInputStream.read(aInputStream.available());
      scriptableInputStream.close();
      aInputStream.close();
      callback(str);
    }
  })(callback, url));

}

/* XXX: Temp from Greasemonkey compiler */
function getUrlContents(aUrl){
  var  ioService=Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService);
  var  scriptableStream=Components
    .classes["@mozilla.org/scriptableinputstream;1"]
    .getService(Components.interfaces.nsIScriptableInputStream);

  var  channel=ioService.newChannel(aUrl, null, null);
  var  input=channel.open();
  scriptableStream.init(input);
  var  str=scriptableStream.read(input.available());
  scriptableStream.close();
  input.close();

  return str;
}

///////////////////////////////////////////////////////////// from prefmanager.js
GM_PrefManager.MIN_INT_32 = -0x80000000;
GM_PrefManager.MAX_INT_32 = 0x7FFFFFFF;

/**
 * Simple API on top of preferences for greasemonkey.
 * Construct an instance by passing the startPoint of a preferences subtree.
 * "greasemonkey." prefix is assumed.
 */
function GM_PrefManager() {
  
  /* XXX: startPoint hacked */
  var startPoint = "extensions.nicofox.nicomonkey.";

  Components.utils.import("resource://nicofox/Services.jsm"); 
  var pref = Services.prefs.getBranch(startPoint);

  var observers = {};
  const nsISupportsString = Components.interfaces.nsISupportsString;

  /**
   * whether a preference exists
   */
  this.exists = function(prefName) {
    return pref.getPrefType(prefName) != 0;
  };

  /**
   * enumerate preferences
   */
  this.listValues = function() {
    return pref.getChildList("", {});
  }

  /**
   * returns the named preference, or defaultValue if it does not exist
   */
  this.getValue = function(prefName, defaultValue) {
    var prefType = pref.getPrefType(prefName);

    // underlying preferences object throws an exception if pref doesn't exist
    if (prefType == pref.PREF_INVALID) {
      return defaultValue;
    }

    try {
      switch (prefType) {
        case pref.PREF_STRING:
          return pref.getComplexValue(prefName, nsISupportsString).data;
        case pref.PREF_BOOL:
          return pref.getBoolPref(prefName);
        case pref.PREF_INT:
          return pref.getIntPref(prefName);
      }
    } catch(ex) {
      return defaultValue != undefined ? defaultValue : null;
    }
    return null;
  };

  /**
   * sets the named preference to the specified value. values must be strings,
   * booleans, or integers.
   */
  this.setValue = function(prefName, value) {
    var prefType = typeof(value);
    var goodType = false;

    switch (prefType) {
      case "string":
      case "boolean":
        goodType = true;
        break;
      case "number":
        if (value % 1 == 0 &&
            value >= GM_PrefManager.MIN_INT_32 &&
            value <= GM_PrefManager.MAX_INT_32) {
          goodType = true;
        }
        break;
    }

    if (!goodType) {
      throw new Error("Unsupported type for GM_setValue. Supported types " +
                      "are: string, bool, and 32 bit integers.");
    }

    // underlying preferences object throws an exception if new pref has a
    // different type than old one. i think we should not do this, so delete
    // old pref first if this is the case.
    if (this.exists(prefName) && prefType != typeof(this.getValue(prefName))) {
      this.remove(prefName);
    }

    // set new value using correct method
    switch (prefType) {
      case "string":
        var str = Components.classes["@mozilla.org/supports-string;1"]
                            .createInstance(nsISupportsString);
        str.data = value;
        pref.setComplexValue(prefName, nsISupportsString, str);
        break;
      case "boolean":
        pref.setBoolPref(prefName, value);
        break;
      case "number":
        pref.setIntPref(prefName, Math.floor(value));
        break;
    }
  };

  /**
   * deletes the named preference or subtree
   */
  this.remove = function(prefName) {
    pref.deleteBranch(prefName);
  };

  /**
   * call a function whenever the named preference subtree changes
   */
  this.watch = function(prefName, watcher) {
    // construct an observer
    var observer = {
      observe:function(subject, topic, prefName) {
        watcher(prefName);
      }
    };

    // store the observer in case we need to remove it later
    observers[watcher] = observer;

    pref.QueryInterface(Components.interfaces.nsIPrefBranchInternal).
      addObserver(prefName, observer, false);
  };

  /**
   * stop watching
   */
  this.unwatch = function(prefName, watcher) {
    if (observers[watcher]) {
      pref.QueryInterface(Components.interfaces.nsIPrefBranchInternal).
        removeObserver(prefName, observers[watcher]);
    }
  };
}

///////////////////////////////////////////////////////////// end of prefmanager.js

///////////////////////////////////////////////////////////// from utils.js
function GM_hitch(obj, meth) {
  if (!obj[meth]) {
    throw "method '" + meth + "' does not exist on object '" + obj + "'";
  }

  var staticArgs = Array.prototype.splice.call(arguments, 2, arguments.length);

  return function() {
    // make a copy of staticArgs (don't modify it because it gets reused for
    // every invocation).
    var args = Array.prototype.slice.call(staticArgs);

    // add all the new arguments
    Array.prototype.push.apply(args, arguments);

    // invoke the original function with the correct this obj and the combined
    // list of static and dynamic arguments.
    return obj[meth].apply(obj, args);
  };
}

/**
 * Utility to create an error message in the log without throwing an error.
 */
function GM_logError(e, opt_warn, fileName, lineNumber) {
  Components.utils.import("resource://nicofox/Services.jsm"); 
  var consoleService = Services.console;

  var consoleError = Components.classes["@mozilla.org/scripterror;1"]
    .createInstance(Components.interfaces.nsIScriptError);

  var flags = opt_warn ? 1 : 0;

  // third parameter "sourceLine" is supposed to be the line, of the source,
  // on which the error happened.  we don't know it. (directly...)
  consoleError.init(e.message, fileName, null, lineNumber,
                    e.columnNumber, flags, null);

  consoleService.logMessage(consoleError);
}

function GM_log(message, force) {
  if (force) {
    Components.utils.import("resource://nicofox/Services.jsm"); 
    var consoleService = Services.console;
    consoleService.logStringMessage(message);
  }
}

///////////////////////////////////////////////////////////// end of utils.js

///////////////////////////////////////////////////////////// from miscapis.js

function GM_ScriptStorage(script) {
  /* XXX: Pref location heack */
  this.prefMan = new GM_PrefManager();
}

GM_ScriptStorage.prototype.setValue = function(name, val) {
  if (2 !== arguments.length) {
    throw new Error("Second argument not specified: Value");
  }

  if (!GM_apiLeakCheck("GM_setValue")) {
    return;
  }

  this.prefMan.setValue(name, val);
};

GM_ScriptStorage.prototype.getValue = function(name, defVal) {
  if (!GM_apiLeakCheck("GM_getValue")) {
    return undefined;
  }

  return this.prefMan.getValue(name, defVal);
};

/* GM_Resources is not used in NicoMonkey */
// function GM_Resources(script){}

function GM_ScriptLogger(script) {
  var namespace = script.namespace;

  if (namespace.substring(namespace.length - 1) != "/") {
    namespace += "/";
  }

  this.prefix = [namespace, script.name, ": "].join("");
}

GM_ScriptLogger.prototype.log = function(message) {
  GM_log(this.prefix + message, true);
};

GM_ScriptStorage.prototype.deleteValue = function(name) {
  if (!GM_apiLeakCheck("GM_deleteValue")) {
    return undefined;
  }

  return this.prefMan.remove(name);
};

GM_ScriptStorage.prototype.listValues = function() {
  if (!GM_apiLeakCheck("GM_listValues")) {
    return undefined;
  }

  return this.prefMan.listValues();
};

function GM_addStyle(doc, css) {
  var head = doc.getElementsByTagName("head")[0];
  if (head) {
    var style = doc.createElement("style");
    style.textContent = css;
    style.type = "text/css";
    head.appendChild(style);
  }
  return style;
}
function GM_console(script) {
  // based on http://www.getfirebug.com/firebug/firebugx.js
  var names = [
    "debug", "warn", "error", "info", "assert", "dir", "dirxml",
    "group", "groupEnd", "time", "timeEnd", "count", "trace", "profile",
    "profileEnd"
  ];

  for (var i=0, name; name=names[i]; i++) {
    this[name] = function() {};
  }

  // Important to use this private variable so that user scripts can't make
  // this call something else by redefining <this> or <logger>.
  var logger = new GM_ScriptLogger(script);
  this.log = function() {
    logger.log(
      Array.prototype.slice.apply(arguments).join("\n")
    );
  };
}

GM_console.prototype.log = function() {
};

///////////////////////////////////////////////////////////// end of miscapis.js

///////////////////////////////////////////////////////////// NicoMonkey specific
// goDownload() !?

var nicoMonkeyAdditions = {};

nicoMonkeyAdditions.getString = function(str) {
  Components.utils.import("resource://nicofox/Core.jsm");
  return Core.monkeyStrings.getString(str);
}

/* Add bookmark (Firefox 3+ only) */
nicoMonkeyAdditions.bookmark = function(url, title) {
  var bookmarkService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);

  /* Check if it was in bookmark */
  var checkArray = bookmarkService.getBookmarkIdsForURI(uri, {});
  if (checkArray.length < 1)
  {
    var bookmarkId = bookmarkService.insertBookmark(bookmarkService.unfiledBookmarksFolder, uri, -1, "");
    bookmarkService.setItemTitle(bookmarkId, title);
  }
}
/* Add tag to places */
nicoMonkeyAdditions.addTag = function(url, title, str) {
  if (typeof str != 'string') { return; }
  var bookmarkServ = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                      .getService(Ci.nsINavBookmarksService);
  var taggingServ = Components.classes["@mozilla.org/browser/tagging-service;1"]
                             .getService(Components.interfaces.nsITaggingService);
  var uri =  Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(url, null, null)
  /* Check if it was in bookmark */
  var checkArray = bookmarkServ.getBookmarkIdsForURI(uri, {});
  if (checkArray.length >= 1)
  {
    taggingServ.tagURI(uri, [str], 1); //First argument = URI
  }  
  else
  {
    var bookmarkId = bookmarkServ.insertBookmark(bookmarkServ.unfiledBookmarksFolder, uri, -1, "");
    bookmarkServ.setItemTitle(bookmarkId, title);
    taggingServ.tagURI(uri, [str], 1); //First argument = URI
  }

}
///////////////////////////////////////////////////////////// End of NicoMonkey specific

// Examines the stack to determine if an API should be callable.
function GM_apiLeakCheck(apiName) {
  var stack = Components.stack;
  do {
    // Valid stack frames for GM api calls are: native and js when coming from
    // chrome:// URLs and the greasemonkey.js component's file:// URL.
    if (2 == stack.language) {
      // NOTE: In FF 2.0.0.0, I saw that stack.filename can be null for JS/XPCOM
      // services. This didn't happen in FF 2.0.0.11; I'm not sure when it
      // changed.
      if (stack.filename != null &&
          stack.filename != gmSvcFilename &&
          stack.filename.substr(0, 6) != "chrome") {
        GM_logError(new Error("Greasemonkey access violation: unsafeWindow " +
                    "cannot call " + apiName + "."));
        return false;
      }
    }
    stack = stack.caller;
  } while (stack);

  return true;
}

var NicoMonkey = {
  _config: null,
  get config() {
    if (!this._config)
      this._config = new Config();
    return this._config;
  },

  domContentLoaded: function(wrappedContentWin, chromeWin) {
    var unsafeWin = wrappedContentWin.wrappedJSObject;
    var unsafeLoc = new XPCNativeWrapper(unsafeWin, "location").location;
    var href = new XPCNativeWrapper(unsafeLoc, "href").href;
    
    var scripts = this.initScripts(href);
    if (scripts.length > 0) {
      this.injectScripts(scripts, href, unsafeWin, chromeWin);
    }
  },
  
  /* Modified initScripts to allow script to be read asynchrously */
  initScripts: function(href) {
    /* XXX: Hack */
    var scripts = [];
    if ( /^http:\/\/(www|tw|de|es|ch)\.nicovideo\.jp\/.*/.test(href) ) {
      scripts.push({
        name: "NicoMonkey",
        namespace: "http://littleb.tc/nicofox/nicomonkey/legacy",
        unwrap: false,
        _url: "chrome://nicofox/content/nicomonkey/nicomonkey.js"
      });
    }
    if (/^http:\/\/[a-z]+\.nicovideo\.jp\//.test(href)) {
      scripts.push({
        name: "NicoMonkey Download Link Adder",
        namespace: "http://littleb.tc/nicofox/nicomonkey/icon_adder",
        unwrap: false,
        _url: "chrome://nicofox/content/nicomonkey/downloadIconAdder.js"
      });
    }
    return scripts;
  },
  injectScripts: function(scripts, url, unsafeContentWin, chromeWin) {
    var sandbox;
    var script;
    var logger;
    var console;
    var storage;
    var xmlhttpRequester;
    // var resources;
    var safeWin = new XPCNativeWrapper(unsafeContentWin);
    var safeDoc = safeWin.document;

    // detect and grab reference to firebug console and context, if it exists
    var firebugConsole = this.getFirebugConsole(unsafeContentWin, chromeWin);

     for (var i = 0; script = scripts[i]; i++) {
      sandbox = new Components.utils.Sandbox(safeWin);

      logger = new GM_ScriptLogger(script);

      console = firebugConsole ? firebugConsole : new GM_console(script);

      storage = new GM_ScriptStorage(script);
      /*xmlhttpRequester = new GM_xmlhttpRequester(unsafeContentWin,
                                                 appSvc.hiddenDOMWindow,
                                                 url);*/
      // resources = new GM_Resources(script);

      sandbox.window = safeWin;
      sandbox.document = sandbox.window.document;
      sandbox.unsafeWindow = unsafeContentWin;

      // hack XPathResult since that is so commonly used
      sandbox.XPathResult = Ci.nsIDOMXPathResult;

      // add our own APIs
      // XXX: Some API is not in used in NicoMonkey
      sandbox.GM_addStyle = function(css) { GM_addStyle(safeDoc, css) };
      sandbox.GM_log = GM_hitch(logger, "log");
      sandbox.console = console;
      sandbox.GM_setValue = GM_hitch(storage, "setValue");
      sandbox.GM_getValue = GM_hitch(storage, "getValue");
      sandbox.GM_deleteValue = GM_hitch(storage, "deleteValue");
      sandbox.GM_listValues = GM_hitch(storage, "listValues");
      // sandbox.GM_getResourceURL = GM_hitch(resources, "getResourceURL");
      // sandbox.GM_getResourceText = GM_hitch(resources, "getResourceText");
      sandbox.GM_openInTab = GM_hitch(this, "openInTab", safeWin, chromeWin);
      /* sandbox.GM_xmlhttpRequest = GM_hitch(xmlhttpRequester,
                                           "contentStartRequest");
      sandbox.GM_registerMenuCommand = GM_hitch(this,
                                                "registerMenuCommand",
                                                unsafeContentWin);
      */
      
      /* NicoMonkey-specific */
      sandbox.NM_getString = GM_hitch(nicoMonkeyAdditions, 'getString');
      //sandbox.NM_goDownload = GM_hitch(nicoMonkeyAdditions, 'goDownload');
      sandbox.NM_bookmark = GM_hitch(nicoMonkeyAdditions, 'bookmark');
      sandbox.NM_addTag = GM_hitch(nicoMonkeyAdditions, 'addTag');
      
      sandbox.__proto__ = safeWin;
      
      /* No require script support, so no offset too */
      script.offsets = 0;
      
      fetchUrlContentsAsync(script._url, (function(nicoMonkey, script, url, sandbox) {
        return function(str) {
          var contents = str;
          
          var scriptSrc = "\n" + // error line-number calculations depend on these
                          //requires.join("\n") +
                          "\n" +
                          contents +
                          "\n";
        if (!script.unwrap)
          scriptSrc = "(function(){"+ scriptSrc +"})()";
        if (!nicoMonkey.evalInSandbox(scriptSrc, url, sandbox, script) && script.unwrap)
          nicoMonkey.evalInSandbox("(function(){"+ scriptSrc +"})()",
                             url, sandbox, script); // wrap anyway on early return
        }
      })(this, script, url, sandbox));

    }
  },

  /* XXX: Not used by NicoMonkey */
  /*registerMenuCommand: function(unsafeContentWin, commandName, commandFunc,
                                accelKey, accelModifiers, accessKey) {

  },*/

  openInTab: function(safeContentWin, chromeWin, url) {
    if (!GM_apiLeakCheck("GM_openInTab")) {
      return undefined;
    }
    /* XXX: Version check removed */
    // Post FF 3.0 wants the document as the second argument.
    var newTab = chromeWin.openNewTabWith(url, safeContentWin.document, null, null, null, null);

    // Source:
    // http://mxr.mozilla.org/mozilla-central/source/browser/base/content/browser.js#4448
    var newWindow = chromeWin.gBrowser
      .getBrowserForTab(newTab)
      .docShell
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindow);
    return newWindow;
  },

  evalInSandbox: function(code, codebase, sandbox, script) {
    if (!(Components.utils && Components.utils.Sandbox)) {
      var e = new Error("Could not create sandbox.");
      GM_logError(e, 0, e.fileName, e.lineNumber);
      return true;
    }
    try {
      // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=307984
      var lineFinder = new Error();
      Components.utils.evalInSandbox(code, sandbox, maxJSVersion);
    } catch (e) { // catches errors while running the script code
      try {
        if (e && "return not in function" == e.message)
          return false; // means this script depends on the function enclosure

        // try to find the line of the actual error line
        var line = e && e.lineNumber;
        if (4294967295 == line) {
          // Line number is reported as max int in edge cases.  Sometimes
          // the right one is in the "location", instead.  Look there.
          if (e.location && e.location.lineNumber) {
            line = e.location.lineNumber;
          } else {
            // Reporting maxint is useless, if we couldn't find it in location
            // either, forget it.  A value of 0 isn't shown in the console.
            line = 0;
          }
        }

        if (line) {
          var err = this.findError(script, line - lineFinder.lineNumber - 1);
          GM_logError(
            e, // error obj
            0, // 0 = error (1 = warning)
            err.uri,
            err.lineNumber
          );
        } else {
          GM_logError(
            e, // error obj
            0, // 0 = error (1 = warning)
            script.fileURL,
            0
          );
        }
      } catch (e) { // catches errors we cause trying to inform the user
        // Do nothing. More importantly: don't stop script incovation sequence.
      }
    }
    return true; // did not need a (function() {...})() enclosure.
  },

  findError: function(script, lineNumber){
    var start = 0;
    var end = 1;

    for (var i = 0; i < script.offsets.length; i++) {
      end = script.offsets[i];
      if (lineNumber < end) {
        return {
          uri: script.requires[i].fileURL,
          lineNumber: (lineNumber - start)
        };
      }
      start = end;
    }

    return {
      uri: script.fileURL,
      lineNumber: (lineNumber - end)
    };
  },

  getFirebugConsole: function(unsafeContentWin, chromeWin) {
    // If we can't find this object, there's no chance the rest of this
    // function will work.
    if ('undefined'==typeof chromeWin.Firebug) return null;

    try {
      chromeWin = chromeWin.top;
      var fbVersion = parseFloat(chromeWin.Firebug.version, 10);
      var fbConsole = chromeWin.Firebug.Console;
      var fbContext = chromeWin.TabWatcher &&
        chromeWin.TabWatcher.getContextByWindow(unsafeContentWin);

      // Firebug 1.4 will give no context, when disabled for the current site.
      // We can't run that way.
      if ('undefined'==typeof fbContext) {
        return null;
      }

      function findActiveContext() {
        for (var i=0; i<fbContext.activeConsoleHandlers.length; i++) {
          if (fbContext.activeConsoleHandlers[i].window == unsafeContentWin) {
            return fbContext.activeConsoleHandlers[i];
          }
        }
        return null;
      }

      try {
        if (!fbConsole.isEnabled(fbContext)) return null;
      } catch (e) {
        // FB 1.1 can't be enabled/disabled.  Function to check doesn't exist.
        // Silently ignore.
      }

      if (fbVersion < 1.2) {
        return new chromeWin.FirebugConsole(fbContext, unsafeContentWin);
      } else if (1.2 == fbVersion) {
        var safeWin = new XPCNativeWrapper(unsafeContentWin);

        if (fbContext.consoleHandler) {
          for (var i = 0; i < fbContext.consoleHandler.length; i++) {
            if (fbContext.consoleHandler[i].window == safeWin) {
              return fbContext.consoleHandler[i].handler;
            }
          }
        }

        var dummyElm = safeWin.document.createElement("div");
        dummyElm.setAttribute("id", "_firebugConsole");
        safeWin.document.documentElement.appendChild(dummyElm);
        chromeWin.Firebug.Console.injector.addConsoleListener(fbContext, safeWin);
        dummyElm.parentNode.removeChild(dummyElm);

        return fbContext.consoleHandler.pop().handler;
      } else if (fbVersion >= 1.3) {
        fbConsole.injector.attachIfNeeded(fbContext, unsafeContentWin);
        return findActiveContext();
      }
    } catch (e) {
      dump('Greasemonkey getFirebugConsole() error:\n'+uneval(e)+'\n');
    }

	  return null;
  }
};



