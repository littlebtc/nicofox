var Cc = Components.classes;
var Ci = Components.interfaces;

function goAjax(url, type, funcok, funcerr, goxml)
{
	var httpRequest;
	type = 'GET'; // TODO: DIRTY

	httpRequest = new XMLHttpRequest();

	httpRequest.onreadystatechange = function() {
		if (httpRequest.readyState == 4)
		{
			if (httpRequest.status == 200)
			{
				funcok(httpRequest);
			}
			else
			{
				funcerr(httpRequest);
			}
	        }
	};
	if (goxml)
	  httpRequest.overrideMimeType('text/xml');
	httpRequest.open(type, url, true);
	httpRequest.send('');
}

/* AJAX work will require some dirty way to call function
   The idea is from GM_hitch @ Greasemoneky and it is almost the same ||| */
function hitchFunction(object, name)
	{
		if(!object || !object[name]) {alert('OUCH!');}
		var args = Array.prototype.slice.call(arguments, 2);

		/* What a dirty way! */
		dirty_function =  function()
		{
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
