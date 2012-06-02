/* vim: sw=2 ts=2 sts=2 et filetype=javascript 
 *
 * Save the preferences and strings and other core elements of NicoFox
 */
var EXPORTED_SYMBOLS = ['Core'];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/Services.jsm");

var Core = {}

/* Generator for strings bundle helper */
var stringsHelperGenerator = function(url){
  this._bundle = Services.strings.createBundle(url);
}
stringsHelperGenerator.prototype = {
  getString: function(str) {
    if (this._bundle === null) return '';
    return this._bundle.GetStringFromName(str);
  },
  getFormattedString: function (key, arr) {
    if (toString.call(arr) === "[object Array]") {return '';} // Technology from jQuery
    return this._bundle.formatStringFromName(key, arr, arr.length);
  }
};

/* Load prefs, query it to nsIPrefBranch2 to allow observers */
Core.prefs = Services.prefs.getBranch("extensions.nicofox.")
                     .QueryInterface(Ci.nsIPrefBranch2);

/* Use the generator to create strings helper */
Core.strings = new stringsHelperGenerator("chrome://nicofox/locale/nicofox.properties");
Core.mozDownloadStrings = new stringsHelperGenerator("chrome://mozapps/locale/downloads/downloads.properties");
