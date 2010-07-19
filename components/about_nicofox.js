/* Add about:nicofox to Firefox
 Original from https://developer.mozilla.org/En/Custom_about:_URLs */

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function AboutNicoFox() { }
AboutNicoFox.prototype = {
  classDescription: "about:nicofox",
  contractID: "@mozilla.org/network/protocol/about;1?what=nicofox",
  classID: Components.ID("{af1db570-70a8-11de-8a39-0800200c9a66}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),
  
  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },
  
  newChannel: function(aURI) {
    let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    let channel = ios.newChannel("chrome://nicofox/content/inpage/index.xhtml",
                                 null, null);
    channel.originalURI = aURI;
    return channel;
  }
};

function NSGetModule(compMgr, fileSpec)
  XPCOMUtils.generateModule([AboutNicoFox]);

