/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 * Network related helpers
 */
var EXPORTED_SYMBOLS = [ "Network" ];

const Cc = Components.classes;
const Ci = Components.interfaces;

let Network = {};

/* Import when.js */
Components.utils.import("resource://nicofox/When.jsm");

/* Asynchrously fetch content of one URL */
Network.fetchUrlAsync = function(url, postQueryString) {
  Components.utils.import("resource://gre/modules/Services.jsm");
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
    /* Convert utf-8 input stream. */
    var data = NetUtil.readInputStreamToString(aInputStream, aInputStream.available(), { "charset": "utf-8" });
    aInputStream.close();
    deferred.resolver.resolve({url: url, data: data, request: aRequest});
  };

  /* Fetch the content and return the promise */
  NetUtil.asyncFetch(channel, callback);
  return deferred.promise;
}
/* Use fetchUrlAsync to get the content and use nsIDOMParser to parse XML data.
 * Will return a deferred promise. The final content will contain the URL and the XML DOM tree.
 * Q: Why not XHR? A: Buggy since Fx19+.
 * */
Network.fetchXml = function(url, postQueryString) {
  return Network.fetchUrlAsync(url, postQueryString).then(function (result) {
    var url = result.url;
    var content = result.data;
    var parser = Cc["@mozilla.org/xmlextras/domparser;1"].createInstance(Ci.nsIDOMParser);
    var doc = parser.parseFromString(content, "application/xml");
    if (doc.documentElement.nodeName == "parsererror") {
      throw "parsererror";
    }
    return { url: url, xml: doc };
  });
}
