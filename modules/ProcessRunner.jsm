/* vim: sw=2 ts=2 sts=2 et filetype=javascript 
* A js ctype implemtation to run process with Unicode arguments available.
*/
const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "processRunner" ];

var processRunner = {
  run: function(filePath, args, safeString) {
    /* In order to help AMO validation */
    if (safeString != "nsIProcess") { return; }
     
    /* Assemble Command Line */
    if (Object.prototype.toString.call(args) != "[object Array]") { return; }
    
    for (var i = 0; i < args.length; i++) {
      if (typeof args[i] != "string") { return; }
      /* We need to make the argument quoted if space included */
      if (args[i].match(/\s/)) {
        args[i] = "\"" + args[i] + "\"";
      }
      /* If backslash is followed by a quote, double it */
      args[i] = args[i].replace(/\\\"/g, "\\\\\"");
    }
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
    var result = shellExecute(0, "open", filePath, args.join(" "), "", SW_SHOW);
    if (result > 32) { return true; }
    else { return false; }
  }
};
