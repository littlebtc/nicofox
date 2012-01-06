/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Provide function for signing in to the Nico Nico Douga,
 * using the account settings stored in the password manager.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "NicoLogin" ];
let NicoLogin = {};

Components.utils.import("resource://nicofox/Services.jsm");
Components.utils.import("resource://nicofox/Core.jsm");
Components.utils.import("resource://nicofox/Network.jsm");

/* Inner reader to make asynchronous request to the login page, and response after read */
function loginRunner(postQueryString, thisObj, successCallback, failCallback) {
  this.callbackThisObj = thisObj;
  this.successCallback = successCallback;
  this.failCallback = failCallback;
  Components.utils.import("resource://nicofox/Network.jsm");
  Network.fetchUrlAsync("https://secure.nicovideo.jp/secure/login?site=niconico", postQueryString, this, "checkResult", "fetchError");
  postData = {};
}
/* Check the login result. */
loginRunner.prototype.checkResult = function(url, content, request) {
  /* If the user is logged in successfully, a 302 redirect to http://www|tw.nicovideo.jp/ will be sent.
   * So, check the original request for result */
  var channel = request.QueryInterface(Ci.nsIHttpChannel);
  if (channel.URI.spec.indexOf("https://secure.nicovideo.jp/") == 0) {
    Components.utils.reportError("NicoFox NicoLogin: Login failed.");
    this.callbackThisObj[this.failCallback].call(this.callbackThisObj, "loginfail");
    return;
  }
  Components.utils.reportError("NicoFox NicoLogin: Logged in to Nico Nico Douga.");
  this.callbackThisObj[this.successCallback].call(this.callbackThisObj);
};
/* When fetchUrlAsync cannot read the page, throw an error. */
loginRunner.prototype.fetchError = function() {
  Components.utils.reportError("NicoFox NicoLogin down: Cannot log in to Nico Nico Douga.");
  this.callbackThisObj[this.failCallback].call(this.callbackThisObj);
};

/* Perform a login request to the Nico Nico Douga website, using the account info from password manager.
 * @param thisObj          this object for the callback
 * @param successCallback  Name of callback function in thisObj, called if the user logged in succesfully.
 * @param failCallback     Name of callback function in thisObj, called if the user cannot be logged in.
 */
NicoLogin.perform = function(thisObj, successCallback, failCallback) {
  /* Check the preference. */
  var username = Core.prefs.getComplexValue('autologin_username', Ci.nsISupportsString).data;
  if (!username) {
    thisObj[failCallback].call(thisObj, "nologindata");
    return;
  }
  var postQueryString = "";
  /* Read the account info from login manager. */
  var logins = Services.logins.findLogins({}, 'https://secure.nicovideo.jp', 'https://secure.nicovideo.jp', null);
  for (var i = 0; i < logins.length; i++) {
    let login = logins[i];
    if (username == login.username) {
      postQueryString = encodeURIComponent(login.usernameField) + "=" + encodeURIComponent(login.username) + "&" +
                        encodeURIComponent(login.passwordField) + "=" + encodeURIComponent(login.password);
    }
  }
  if (!postQueryString) {
    thisObj[failCallback].call(thisObj, "nologindata");
    return;
  }
  /* Init loginRunner to perform the login. */
  var runner = new loginRunner(postQueryString, thisObj, successCallback, failCallback);
};
