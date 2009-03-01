var EXPORTED_SYMBOLS = ['nicofox'];

var Cc = Components.classes;
var Ci = Components.interfaces;

if (!nicofox) { var nicofox = {}; }

/* Load prefs */
nicofox.prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService);
nicofox.prefs = nicofox.prefs.getBranch("extensions.nicofox.");

nicofox.goAjax = function(url, type, funcok, funcerr, post_data) {
  var http_request;

  http_request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
               .createInstance(Components.interfaces.nsIXMLHttpRequest);

  var key;
  var data = '';
  if (type == 'POST') {
    /* Set POST parameters */
    for (key in post_data) {
      data += escape(key)+'='+escape(post_data[key])+'&';
    }
  }
  else {
    type = 'GET';
  }

  http_request.onreadystatechange = function() {
    if (http_request.readyState == 4) {
      if (http_request.status == 200) {
       funcok(http_request);
      } else {
        funcerr(http_request);
      }
    }
  };

  http_request.open(type, url, true);
  if (type == 'POST') {
    http_request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  }  
  http_request.send(data);
  /* For safety? */
  data = '';
  post_data = {};
};

/* AJAX work will require some dirty way to call function
   The idea is from GM_hitch @ Greasemoneky and it is almost the same ||| */
nicofox.hitch = function(object, name) {
  if(!object || !object[name]) { return function(){}; }
  var args = Array.prototype.slice.call(arguments, 2);

  /* What a dirty way! */
  dirty_function =  function() {
    /* Combine the argument */
    var args_inner = Array.prototype.slice.call(arguments);
    args_inner = args_inner.concat(args);

    /* Then hit the function */
    object[name].apply(object, args_inner);
  }
  return dirty_function;
};

/* Open a link in the new tab */
nicofox.openInTab = function(url) {
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
          .getService(Ci.nsIWindowMediator);
  var mainWindow = wm.getMostRecentWindow("navigator:browser");
  
  /* If we cannot found browser, create one */
 if (!mainWindow) {
   window.open();
   mainWindow = wm.getMostRecentWindow("navigator:browser");
   mainWindow.getBrowser().selectedBrowser.contentDocument.location.href=url;
 } else {
   mainWindow.getBrowser().addTab(url);
 }
};

nicofox.msg = function(msg) {
  var console_service = Components.classes["@mozilla.org/consoleservice;1"]
                                  .getService(Components.interfaces.nsIConsoleService);
  console_service.logStringMessage(msg);

};

/* Autologin, asking info from Password Manager 
   FIXME: Why not build a standalone password system? */
nicofox.nicoLogin = function(funcok, funcerr) {
  var username = nicofox.prefs.getComplexValue('autologin_username', Ci.nsISupportsString).data;
  var password = '';

  var login_manager = Cc["@mozilla.org/login-manager;1"]
                       .getService(Ci.nsILoginManager);

  /* Nico uses secure.nicovideo.jp for login */
  var logins = login_manager.findLogins({}, 'http://www.nicovideo.jp', 'https://secure.nicovideo.jp', null);
  var login = null;

  /* Access password manager */
  for (var i = 0; i < logins.length; i++)
  {
    if (username == logins[i].username)
    { login = logins[i]; }
  }
  if (!login) {
    funcerr();
    return;
  }

  /* Prepare data, go autologin! */
  var post_data = {};
  post_data[login.usernameField] = login.username;
  post_data[login.passwordField] = login.password;

  /* We don't need a XMLHttpRequest to be resent to init, so ... */
  nicofox.goAjax('https://secure.nicovideo.jp/secure/login?site=niconico', 'POST', funcok, funcerr, post_data) ;

  /* Recycle instantly for security */
  login = {};
  logins = {};
  post_data = {};
};

/* Strings using JavaScript+XPCOM way, more stable? */
nicofox.strings = {
  bundle: null, 
  init: function() {
   var bundle_service = Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService);
   this.bundle = bundle_service.createBundle('chrome://nicofox/locale/nicofox.properties');
  }, 
  getString: function(str) {
    if (this.bundle === null) this.init();
    return this.bundle.GetStringFromName(str);
  },
  getFormattedString: function (key, arr) {
    if (typeof (arr) != 'array') {return '';}
    if (this.bundle === null) this.init();
    return this.bundle.formatStringFromName(key, arr, arr.length);
  }
};

nicofox.monkey_strings = {
  bundle: null, 
  init: function() {
   var bundle_service = Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService);
   this.bundle = bundle_service.createBundle('chrome://nicofox/locale/nicomonkey.properties');
  }, 
  getString: function(str) {
    if (this.bundle === null) this.init();
    return this.bundle.GetStringFromName(str);
  },
  getFormattedString: function (key, arr) {
    if (typeof (arr) != 'array') {return '';}
    if (this.bundle === null) this.init();
    return this.bundle.formatStringFromName(key, arr, arr.length);
  }
};
/* Fix common reserved characters in filesystems by converting to full-width */
nicofox.fixReservedCharacters = function(title) {
  title = title.replace(/\//g, "\uFF0F");
  title = title.replace(/\\/g, "\uFF3C");
  title = title.replace(/\?/g, "\uFF1F");
  title = title.replace(/\%/g, "\uFF05");
  title = title.replace(/\*/g, "\uFF0A");
  title = title.replace(/\:/g, "\uFF1A");
  title = title.replace(/\|/g, "\uFF5C");
  title = title.replace(/\"/g, "\uFF02");
  title = title.replace(/\</g, "\uFF1C");
  title = title.replace(/\>/g, "\uFF1E");
  title = title.replace(/\+/g, "\uFF0B");
  /* Windows FAT specified... */
  //title = title.replace(/\[/g, '〔');
  //title = title.replace(/\]/g, '〕');
  return title;
}
