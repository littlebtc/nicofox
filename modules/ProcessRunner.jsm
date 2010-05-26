/* vim: sw=2 ts=2 sts=2 et filetype=javascript  
*/
/* A simple implementation to open application with specific file:
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
  /* In order to help AMO validation */
  if (safeString != "nsIProcess") { return; }
  
  Components.utils.import("resource://nicofox/Services.jsm"); 
  var os_string = Services.appinfo.OS;
 
  /* Win32 Codes. JS-ctype is used to call ShellExecuteW in shell32.dll */ 
  if (os_string == 'WINNT') {
    /* Assemble Command Line for Win32 */
    var argument = file.path;    
    /* We need to make the argument quoted if space included */
    if (argument.match(/\s/)) {
      argument = "\"" + argument + "\"";
    }
    /* If backslash is followed by a quote, double it */
    argument = argument.replace(/\\\"/g, "\\\\\"");
  
    /* Use JS CTypes */  
    Components.utils.import("resource://gre/modules/ctypes.jsm");
    var lib = ctypes.open("shell32.dll");
    var SW_SHOW = 5;
    var shellExecute = lib.declare("ShellExecuteW",
                                  ctypes.stdcall_abi,
                                  ctypes.int32_t, /* HINSTANCE (return) */
                                  ctypes.int32_t, /* HWND hwnd */
                                  ctypes.ustring, /* LPCTSTR lpOperation */
                                  ctypes.ustring, /* LPCTSTR lpFile */
                                  ctypes.ustring, /* LPCTSTR lpParameters */
                                  ctypes.ustring, /* LPCTSTR lpDirectory */
                                  ctypes.int32_t  /* int nShowCmd */);
    var result = shellExecute(0, "open", process.path, argument, "", SW_SHOW);
    /*if (result > 32) { return true; }
    else { return false; }*/
  
  /* OSX code. Use launchWithDoc from nsILocalFileMac */
  } else if (os_string == 'Darwin') {
        process.QueryInterface(Ci.nsILocalFileMac);
        process.launchWithDoc(file, false);
  
  /* For others, use nsIProcess with utf8 parameters */
  } else {
    var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
    var unicode_converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    unicode_converter.charset = 'utf-8';      
    try {
      process.init(process);
      var parameter = [unicode_converter.ConvertFromUnicode(file.path)];
      process.run(false, parameter, 1);
    } catch(e) {} /* FIXME: Error display */
  }
};
