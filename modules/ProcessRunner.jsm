/* vim: sw=2 ts=2 sts=2 et filetype=javascript  
 *
 * A simple implementation to open an application with specific file.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "processRunner" ];

let processRunner = {};
/**
 * Open a file with specific process, in platform-dependent ways
 *
 * @param process
 *        An nsILocalFile instance to the process to open the file
 * @param file
 *        An nsILocalFile instance to the file to be opened
 */

processRunner.openFileWithProcess = function(process, file, safeString) {
  Components.utils.import("resource://gre/modules/Services.jsm"); 
  var os_string = Services.appinfo.OS;
 
  /* OSX code. Use launchWithDoc from nsILocalFileMac */
  if (os_string == 'Darwin') {
        process.QueryInterface(Ci.nsILocalFileMac);
        process.launchWithDoc(file, false);
  
  /* For others, use runw() from nsIProcess */
  } else {
    var processRunner = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    processRunner.init(process);
    processRunner.runw(false, [file.path], 1);
  }
};
