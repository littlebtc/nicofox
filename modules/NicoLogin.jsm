/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Provide function for signing in to the Nico Nico Douga,
 * using the account settings stored in the password manager.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "NicoLogin" ];
let NicoLogin = {};

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://nicofox/Core.jsm");
Components.utils.import("resource://nicofox/Network.jsm");
Components.utils.import("resource://nicofox/When.jsm");

/* Check the login result. */
function checkResult(result) {
  /* If the user is logged in successfully, a 302 redirect to http://www.nicovideo.jp/ will be sent.
   * So, check the original request for result */
  var channel = result.request.QueryInterface(Ci.nsIHttpChannel);
  if (channel.URI.spec.indexOf("https://secure.nicovideo.jp/") == 0) {
    throw("loginfail");
  }
  /* When logged in successfully, the chained promises will work and continue to do other chanined works :) */
};

/* Perform a login request to the Nico Nico Douga website, using the account info from password manager.
 * @param thisObj          this object for the callback
 * @param successCallback  Name of callback function in thisObj, called if the user logged in succesfully.
 * @param failCallback     Name of callback function in thisObj, called if the user cannot be logged in.
 */
NicoLogin.perform = function() {
  /* Check the preference. */
  var username = Core.prefs.getComplexValue('autologin_username', Ci.nsISupportsString).data;
  if (!username) {
    return When.reject("nologindata");
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
    return When.reject("nologindata");
  }
  /* Perform the login, then return the deferred promise. */
  return Network.fetchUrlAsync("https://secure.nicovideo.jp/secure/login?site=niconico", postQueryString).then(checkResult);
};
