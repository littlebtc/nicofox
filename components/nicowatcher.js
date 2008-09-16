
const nsISupports = Components.interfaces.nsISupports;

const CLASS_ID = Components.ID("62ca6b17-975f-4c70-b497-33146a16c797");
const CLASS_NAME = "";
const CONTRACT_ID = "@littlebtc.twbbs.org/nicowatcher;1";


var Nicowatcher = {

    /* By following is the code stolen and modified from IE Tab and Greasemonkey (Expat License) */

  // nsIContentPolicy interface implementation
  shouldLoad: function(contentType, contentLocation, requestOrigin, requestingNode, mimeTypeGuess, extra)
	{
		if (contentType == Components.interfaces.nsIContentPolicy.TYPE_DOCUMENT)
		{
			url = contentLocation.spec;
			if (url.match(/^http:\/\/(www|tw|de|es).nicovideo.jp\/(watch|mylist)\/[0-9a-zA-Z]+\?smilefox\=get$/))
			{
			
			var winWat = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
		    .getService(Components.interfaces.nsIWindowWatcher);

		if (winWat.activeWindow && winWat.activeWindow.nicofox) {
	    winWat.activeWindow.nicofox.goDownload(url);
		}
			
				return Components.interfaces.nsIContentPolicy.REJECT_REQUEST;
			}
		}

   return Components.interfaces.nsIContentPolicy.ACCEPT;
	},
  // this is now for urls that directly load media, and meta-refreshes (before activation)
  shouldProcess: function(contentType, contentLocation, requestOrigin, requestingNode, mimeType, extra) {
    return (Components.interfaces.nsIContentPolicy.ACCEPT);
  },

}

//=================================================
// Note: You probably don't want to edit anything
// below this unless you know what you're doing.
//
// Factory
var NicowatcherFactory = {
  createInstance: function (aOuter, aIID)
  {
    if (aOuter != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    return Nicowatcher;
  }
};

// Module
var NicowatcherModule = {
  registerSelf: function(aCompMgr, aFileSpec, aLocation, aType)
  {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.registerFactoryLocation(CLASS_ID, CLASS_NAME, CONTRACT_ID, aFileSpec, aLocation, aType);

    var catMgr = Components.classes["@mozilla.org/categorymanager;1"].getService(Components.interfaces.nsICategoryManager);
    catMgr.addCategoryEntry("content-policy", CONTRACT_ID, CONTRACT_ID, true, true);
  },

  unregisterSelf: function(aCompMgr, aLocation, aType)
  {
    aCompMgr = aCompMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
    aCompMgr.unregisterFactoryLocation(CLASS_ID, aLocation);        

    var catMgr = Components.classes["@mozilla.org/categorymanager;1"].getService(Components.interfaces.nsICategoryManager);
    catMgr.deleteCategoryEntry("content-policy", CONTRACT_ID, true);
  },
  
  getClassObject: function(aCompMgr, aCID, aIID)
  {
    if (!aIID.equals(Components.interfaces.nsIFactory))
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

    if (aCID.equals(CLASS_ID))
      return NicowatcherFactory;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function(aCompMgr) { return true; }
};

//module initialization
function NSGetModule(aCompMgr, aFileSpec) { return NicowatcherModule; }

