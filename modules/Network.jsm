/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 * Network related helpers
 */
var EXPORTED_SYMBOLS = [ "Network" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

const PR_UINT32_MAX = 0xffffffff;

let Network = {};

/* Import when.js */
Components.utils.import("resource://nicofox/When.jsm");

/* Asynchrously fetch content of one URL */
Network.fetchUrlAsync = function(url, postQueryString) {
  Components.utils.import("resource://nicofox/Services.jsm");
  Components.utils.import("resource://gre/modules/NetUtil.jsm");

  /* Add deferred */
  var deferred = When.defer();

  var channel = Services.io.newChannel(url, null, null).QueryInterface(Ci.nsIHttpChannel);
  /* Set POST Request if query string available */
  /* https://developer.mozilla.org/en/Creating_Sandboxed_HTTP_Connections#Creating_HTTP_POSTs */
  if (postQueryString) {
    var inputStream = Cc["@mozilla.org/io/string-input-stream;1"].createInstance(Ci.nsIStringInputStream);  
    inputStream.setData(postQueryString, postQueryString.length); 
    if (channel instanceof Ci.nsIUploadChannel) {
      channel.setUploadStream(inputStream, "application/x-www-form-urlencoded", -1);
    }
    /* setUploadStream resets to PUT, modify it */
    channel.requestMethod = "POST";
  }
  /* Force allow 3rd party cookies, to make NicoFox work when 3rd party cookies are disabled. (Bug 437174) */
  if (channel instanceof Ci.nsIHttpChannelInternal) {
    channel.forceAllowThirdPartyCookie = true;
  }

  /* Assign the callback */
  var callback = function(aInputStream, aResult, aRequest) {
    if (!Components.isSuccessCode(aResult)) {
      deferred.resolver.reject('NetworkError');
      return;
    }
    /* Convert utf-8 input stream. From https://developer.mozilla.org/en/Code_snippets/File_I%2f%2fO */
    var converterInputStream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);
    converterInputStream.init(aInputStream, "UTF-8", 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
    var data = "";
    let (str = {}) {
      let read = 0;
      do { 
        read = converterInputStream.readString(4096, str);
        data += str.value;
      } while (read != 0);
    }
    converterInputStream.close();
    aInputStream.close();
    deferred.resolver.resolve({url: url, data: data, request: aRequest});
  };

  /* Fetch the content and return the promise */
  NetUtil.asyncFetch(channel, callback);
  return deferred.promise;
}

