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
/* Use XMLHttpRequest to get XML data. Will return a deferred promise. */
Network.fetchXml = function(url, postQueryString) {
  /* XHR in modules is a complex problem.
   * Using nsIXMLHttpRequest instance is buggy for older Gecko,
   * so the hiddenDOMWindow workaround is used. However,
   * for newer Gecko, the Xray wrapper will block the XHR object,
   * so first use hiddenDOMWindow, if XHR is not appeared, initialize an instance.
   * https://bugzilla.mozilla.org/show_bug.cgi?id=756277 */
  Components.utils.import("resource://gre/modules/Services.jsm");
  const { XMLHttpRequest } = Services.appShell.hiddenDOMWindow;
  if (typeof XMLHttpRequest === "function") {
    var xhr = XMLHttpRequest();
  } else {
    var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
  }
  var deferred = When.defer();
  /* Prepare the callback and deferred resolver in it */
  var successCallback = function(aEvent) {
    var result = aEvent.target;
    result.removeEventListener("load", successCallback);
    result.removeEventListener("error", failCallback);
    if (result.status != 200) {
      deferred.resolver.reject("httperror");
      return;
    }
    deferred.resolver.resolve({url: url, xml: result.responseXML});
  };
  var failCallback = function(aEvent) {
    var result = aEvent.target;
    result.removeEventListener("load", successCallback);
    result.removeEventListener("error", failCallback);
    deferred.resolver.reject("xhrError");
  };
  /* Build xhr request, send then return the deferred object */
  var method = (postQueryString)? "POST" : "GET";
  xhr.open(method, url, true);
  xhr.addEventListener("load", successCallback);
  xhr.addEventListener("error", failCallback);
  xhr.responseType = "document";
  if (postQueryString) {
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  }
  xhr.send(postQueryString);
  return deferred.promise;
}
