/* Using the sample codes from MDC under MIT License
https://developer.mozilla.org/en/Chrome/Command_Line
https://developer.mozilla.org/En/Working_with_windows_in_chrome_code
*/

const Cc                    = Components.classes;
const Ci                    = Components.interfaces;
const nsIAppShellService    = Components.interfaces.nsIAppShellService;
const nsISupports           = Components.interfaces.nsISupports;
const nsICategoryManager    = Components.interfaces.nsICategoryManager;
const nsIComponentRegistrar = Components.interfaces.nsIComponentRegistrar;
const nsICommandLine        = Components.interfaces.nsICommandLine;
const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;
const nsIFactory            = Components.interfaces.nsIFactory;
const nsIModule             = Components.interfaces.nsIModule;
const nsIWindowWatcher      = Components.interfaces.nsIWindowWatcher;

const CHROME_URI = "chrome://nicofox/content/";

// CHANGEME: change the contract id, CID, and category to be unique
// to your application.
const clh_contractID = "@mozilla.org/commandlinehandler/general-startup;1?type=nicofox-command-line";

// use uuidgen to generate a unique ID
const clh_CID = Components.ID("{a56c0f10-f22f-11dd-ba2f-0800200c9a66}");

// category names are sorted alphabetically. Typical command-line handlers use a
// category that begins with the letter "m".
const clh_category = "m-nicofox-command-line";

/**
 * Utility functions
 */

/**
 * Open NicoFox Player.
 * @param aFile The file to open. 
 */

function openPlayer(aFile) {
  var video_uri = Cc["@mozilla.org/network/io-service;1"]
                 .getService(Ci.nsIIOService).newFileURI(aFile);
  var video_uri_spec = video_uri.spec;
  Components.utils.reportError(aFile.leafName);
  var comment_uri_spec = '';

  var comment_file_path = aFile.path.replace(/(flv|mp4)$/, 'xml');
  var comment_file = Cc["@mozilla.org/file/local;1"]
                    .createInstance(Ci.nsILocalFile);
  comment_file.initWithPath(comment_file_path);
  if (comment_file.exists()) {
    var comment_uri = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService).newFileURI(comment_file);
     comment_uri_spec = comment_uri.spec; 
  }    
  
  openDialog(null, 'chrome://nicofox/content/nicofox_player.xul', 'nicofox_swf', 'width=512,height=424, resizable=yes', {video: video_uri_spec, comment: comment_uri_spec, title: aFile.leafName});  
}	 
 
function openDialog(parentWindow, url, windowName, features)
{
    var array = Components.classes["@mozilla.org/array;1"]
                          .createInstance(Components.interfaces.nsIMutableArray);
    for (var i=4; i<arguments.length; i++)
    {
        var variant = Components.classes["@mozilla.org/variant;1"]
                                .createInstance(Components.interfaces.nsIWritableVariant);
        variant.setFromVariant(arguments[i]);
        array.appendElement(variant, false);
    }

    var watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                            .getService(Components.interfaces.nsIWindowWatcher);
    return watcher.openWindow(parentWindow, url, windowName, features, array);
}


/**
 * The XPCOM component that implements nsICommandLineHandler.
 * It also implements nsIFactory to serve as its own singleton factory.
 */
const nicofoxHandler = {
  /* nsISupports */
  QueryInterface : function clh_QI(iid)
  {
    if (iid.equals(nsICommandLineHandler) ||
        iid.equals(nsIFactory) ||
        iid.equals(nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsICommandLineHandler */

  handle : function clh_handle(cmdLine)
  {
    try {
      // CHANGEME: change "nicofox-player" to your command line flag that takes an argument
      var uristr = cmdLine.handleFlagWithParam("nicofox-player", false);
      if (uristr) {
        // convert uristr to an nsIURI
        var file = cmdLine.resolveFile(uristr);
        openPlayer(file);
        cmdLine.preventDefault = true;
      }
    }
    catch (e) {
      Components.utils.reportError(e);
      //Components.utils.reportError("incorrect parameter passed to -nicofox-player on the command line.");
    }

  },

  // CHANGEME: change the help info as appropriate, but
  // follow the guidelines in nsICommandLineHandler.idl
  // specifically, flag descriptions should start at
  // character 24, and lines should be wrapped at
  // 72 characters with embedded newlines,
  // and finally, the string should end with a newline
  helpInfo : 
             "  -nicofox-player <uri>       Launch NicoFox Player for Local Files.\n", 

  /* nsIFactory */

  createInstance : function clh_CI(outer, iid)
  {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  lockFactory : function clh_lock(lock)
  {
    /* no-op */
  }
};

/**
 * The XPCOM glue that implements nsIModule
 */
const nicofoxHandlerModule = {
  /* nsISupports */
  QueryInterface : function mod_QI(iid)
  {
    if (iid.equals(nsIModule) ||
        iid.equals(nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsIModule */
  getClassObject : function mod_gch(compMgr, cid, iid)
  {
    if (cid.equals(clh_CID))
      return nicofoxHandler.QueryInterface(iid);

    throw Components.results.NS_ERROR_NOT_REGISTERED;
  },

  registerSelf : function mod_regself(compMgr, fileSpec, location, type)
  {
    compMgr.QueryInterface(nsIComponentRegistrar);

    compMgr.registerFactoryLocation(clh_CID,
                                    "nicofoxHandler",
                                    clh_contractID,
                                    fileSpec,
                                    location,
                                    type);

    var catMan = Components.classes["@mozilla.org/categorymanager;1"].
      getService(nsICategoryManager);
    catMan.addCategoryEntry("command-line-handler",
                            clh_category,
                            clh_contractID, true, true);
  },

  unregisterSelf : function mod_unreg(compMgr, location, type)
  {
    compMgr.QueryInterface(nsIComponentRegistrar);
    compMgr.unregisterFactoryLocation(clh_CID, location);

    var catMan = Components.classes["@mozilla.org/categorymanager;1"].
      getService(nsICategoryManager);
    catMan.deleteCategoryEntry("command-line-handler", clh_category);
  },

  canUnload : function (compMgr)
  {
    return true;
  }
};

/* The NSGetModule function is the magic entry point that XPCOM uses to find what XPCOM objects
 * this component provides
 */
function NSGetModule(comMgr, fileSpec)
{
  return nicofoxHandlerModule;
}

