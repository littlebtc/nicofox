var EXPORTED_SYMBOLS = ['hitchFunction', 'goAjax', 'openInTab', 'displayNicofoxMsg'];

var Cc = Components.classes;
var Ci = Components.interfaces;

function goAjax(url, type, funcok, funcerr, post_data)
{
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
}

/* AJAX work will require some dirty way to call function
   The idea is from GM_hitch @ Greasemoneky and it is almost the same ||| */
function hitchFunction(object, name) {
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
}
/* Open a link in the new tab */
function openInNewTab(url)
{
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                 .getService(Ci.nsIWindowMediator);
        var mainWindow = wm.getMostRecentWindow("navigator:browser");

        /* If we cannot found browser, create one */
        if (!mainWindow)
        {
                window.open();
                mainWindow = wm.getMostRecentWindow("navigator:browser");
                mainWindow.getBrowser().selectedBrowser.contentDocument.location.href=url;
        }
        else
        {
                mainWindow.getBrowser().addTab(url);
        }

}

function displayNicofoxMsg() {

}
