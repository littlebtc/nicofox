/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 * Network related helpers
 */
var EXPORTED_SYMBOLS = [ "Network" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

let Network = {};

/* Asynchrously fetch content of one URL */
Network.fetchUrlAsync = function(url, postQueryString, thisObj, successCallback, failCallback) {
  /* 1.9.2 Dependency: NetUtil.jsm  */
  Components.utils.import("resource://nicofox/Services.jsm");
  Components.utils.import("resource://gre/modules/NetUtil.jsm");
  
  if (!thisObj || typeof thisObj[successCallback] != "function" || typeof thisObj[failCallback] != "function") {
    throw new Error('Wrong parameter in fetchUrlAsync');
    return;
  }

  var channel = Services.io.newChannel(url, null, null).QueryInterface(Ci.nsIHttpChannel);
  /* Set POST Request if query string available */
  /* https://developer.mozilla.org/en/Creating_Sandboxed_HTTP_Connections#Creating_HTTP_POSTs */
  if (postQueryString) {
    var inputStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);  
    inputStream.setData(postQueryString, postQueryString.length); 
    var uploadChannel = channel.QueryInterface(Ci.nsIUploadChannel);  
    uploadChannel.setUploadStream(inputStream, "application/x-www-form-urlencoded", -1);
    /* setUploadStream resets to PUT, modify it */
    channel.requestMethod = "POST";
  }
  NetUtil.asyncFetch(channel, function(aInputStream, aResult) {
    if (!Components.isSuccessCode(aResult)) {
      thisObj[failCallback].call(thisObj, url, str);
      return;
    }
    /* Convert utf-8 input stream. From https://developer.mozilla.org/en/Code_snippets/File_I%2f%2fO */
    var converterInputStream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
    converterInputStream.init(aInputStream, "UTF-8", 0, 0);
    var data = "";
    let (str = {}) {
      let read = 0;
      do { 
        read = converterInputStream.readString(0xffffffff, str);
        data += str.value;
      } while (read != 0);
    }
    converterInputStream.close();
    aInputStream.close();
    thisObj[successCallback].call(thisObj, url, data);
  });

}

