
if (!nicofox_ui) {var nicofox_ui = {};}
if (!nicofox_ui.monkey) { nicofox_ui.monkey = {};}

nicofox_ui.monkey.compiler = {

// getUrlContents adapted from Greasemonkey Compiler
// http://www.letitblog.com/code/python/greasemonkey.py.txt
// used under GPL permission
//
// most everything else below based heavily off of Greasemonkey
// http://greasemonkey.mozdev.org/
// used under GPL permission
isGreasemonkeyable: function(url) {
  var scheme=Components.classes["@mozilla.org/network/io-service;1"]
    .getService(Components.interfaces.nsIIOService)
    .extractScheme(url);
  // XX: add nicovideo.jp easy test
  return (
    (scheme == "http" || scheme == "https" || scheme == "file") &&
    !/hiddenWindow\.html$/.test(url) && /nicovideo\.jp\//.test(url)
  );
},
/* From greasemonkey */
contentLoad: function(e) {
  var safeWin;
  var unsafeWin;
  var href;
  var commander;

//  if (!GM_getEnabled()) {
 //   return;
  //}

  safeWin = e.target.defaultView;
  unsafeWin = safeWin.wrappedJSObject;
  href = safeWin.location.href;

  if (nicofox_ui.monkey.compiler.isGreasemonkeyable(href)) {
    Components.utils.import("resource://nicofox/Core.jsm")
    if (Core.prefs.getBoolPref("nicomonkey.enable")){ 
      Components.utils.import("resource://nicofox/NicoMonkey.jsm", nicofox)
      nicofox.NicoMonkey.domContentLoaded({ wrappedJSObject: unsafeWin }, window);
    }
    //GM_listen(unsafeWin, "pagehide", GM_hitch(this, "contentUnload"));
  }
},
onLoad: function() {
  var appcontent=window.document.getElementById("appcontent");
  if (appcontent && !appcontent.greased_nicomonkey_gmCompiler) {
    appcontent.greased_nicomonkey_gmCompiler=true;
    appcontent.addEventListener("DOMContentLoaded", nicofox_ui.monkey.compiler.contentLoad, false);
  }
},

onUnLoad: function() {
  //remove now unnecessary listeners
  window.removeEventListener('load', nicofox_ui.monkey.compiler.onLoad, false);
  window.removeEventListener('unload', nicofox_ui.monkey.compiler.onUnLoad, false);
  window.document.getElementById("appcontent")
    .removeEventListener("DOMContentLoaded", nicofox_ui.monkey.compiler.contentLoad, false);
},

}; //object nicofox_ui.monkey.compiler



window.addEventListener('load', nicofox_ui.monkey.compiler.onLoad, false);
window.addEventListener('unload', nicofox_ui.monkey.compiler.onUnLoad, false);
