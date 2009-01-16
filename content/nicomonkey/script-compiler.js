var nicomonkey_gmCompiler={

// getUrlContents adapted from Greasemonkey Compiler
// http://www.letitblog.com/code/python/greasemonkey.py.txt
// used under GPL permission
//
// most everything else below based heavily off of Greasemonkey
// http://greasemonkey.mozdev.org/
// used under GPL permission

getUrlContents: function(aUrl){
	var	ioService=Components.classes["@mozilla.org/network/io-service;1"]
		.getService(Components.interfaces.nsIIOService);
	var	scriptableStream=Components
		.classes["@mozilla.org/scriptableinputstream;1"]
		.getService(Components.interfaces.nsIScriptableInputStream);

	var	channel=ioService.newChannel(aUrl, null, null);
	var	input=channel.open();
	scriptableStream.init(input);
	var	str=scriptableStream.read(input.available());
	scriptableStream.close();
	input.close();

	return str;
},

isGreasemonkeyable: function(url) {
	var scheme=Components.classes["@mozilla.org/network/io-service;1"]
		.getService(Components.interfaces.nsIIOService)
		.extractScheme(url);
	return (
		(scheme == "http" || scheme == "https" || scheme == "file") &&
		!/hiddenWindow\.html$/.test(url)
	);
},

contentLoad: function(e) {
	var unsafeWin=e.target.defaultView;
	if (unsafeWin.wrappedJSObject) unsafeWin=unsafeWin.wrappedJSObject;

	var unsafeLoc=new XPCNativeWrapper(unsafeWin, "location").location;
	var href=new XPCNativeWrapper(unsafeLoc, "href").href;

	if (
		nicomonkey_gmCompiler.isGreasemonkeyable(href)
		&& ( /http:\/\/www\.nicovideo\.jp\/.*/.test(href) || /http:\/\/tw\.nicovideo\.jp\/.*/.test(href) || /http:\/\/de\.nicovideo\.jp\/.*/.test(href) || /http:\/\/es\.nicovideo\.jp\/.*/.test(href) || /http:\/\/ch\.nicovideo\.jp\/.*/.test(href) )
		&& true
	) {
		var script=nicomonkey_gmCompiler.getUrlContents(
			'chrome://nicofox/content/nicomonkey/nicomonkey.js'
		);
		nicomonkey_gmCompiler.injectScript(script, href, unsafeWin);
	}
},

injectScript: function(script, url, unsafeContentWin) {
	var sandbox, script, logger, storage, xmlhttpRequester;
	var safeWin=new XPCNativeWrapper(unsafeContentWin);

	sandbox=new Components.utils.Sandbox(safeWin);

	var storage=new nicomonkey_ScriptStorage();
	xmlhttpRequester=new nicomonkey_xmlhttpRequester(
		unsafeContentWin, window//appSvc.hiddenDOMWindow
	);

	sandbox.window=safeWin;
	sandbox.document=sandbox.window.document;
	sandbox.unsafeWindow=unsafeContentWin;

	// patch missing properties on xpcnw
	sandbox.XPathResult=Components.interfaces.nsIDOMXPathResult;

	// add our own APIs
	sandbox.GM_addStyle=function(css) { nicomonkey_gmCompiler.addStyle(sandbox.document, css) };
	sandbox.GM_setValue=nicomonkey_gmCompiler.hitch(storage, "setValue");
	sandbox.GM_getValue=nicomonkey_gmCompiler.hitch(storage, "getValue");
	sandbox.GM_openInTab=nicomonkey_gmCompiler.hitch(this, "openInTab", unsafeContentWin);
	sandbox.GM_xmlhttpRequest=nicomonkey_gmCompiler.hitch(
		xmlhttpRequester, "contentStartRequest"
	);
	//unsupported
	sandbox.GM_registerMenuCommand=function(){};
	sandbox.GM_log=function(str){Components.utils.reportError(str)};
	sandbox.GM_getResourceURL=function(){};
	sandbox.GM_getResourceText=function(){};
	
	// Nicomonkey dirty hacks
	sandbox.NM_getString = nicomonkey_gmCompiler.hitch(this, 'getString');
	sandbox.NM_goDownload = nicomonkey_gmCompiler.hitch(nicofox.ui, 'goDownloadFromVideoPage');
	sandbox.NM_bookmark = nicomonkey_gmCompiler.hitch(this, 'bookmark');
	sandbox.NM_tag = nicomonkey_gmCompiler.hitch(this, 'tag');

	sandbox.__proto__=sandbox.window;

	try {
		this.evalInSandbox(
			"(function(){"+script+"})()",
			url,
			sandbox);
	} catch (e) {
		var e2=new Error(typeof e=="string" ? e : e.message);
		e2.fileName=script.filename;
		e2.lineNumber=0;
		//GM_logError(e2);
		alert(e2);
	}
},

evalInSandbox: function(code, codebase, sandbox) {
	if (Components.utils && Components.utils.Sandbox) {
		// DP beta+
		Components.utils.evalInSandbox(code, sandbox);
	} else if (Components.utils && Components.utils.evalInSandbox) {
		// DP alphas
		Components.utils.evalInSandbox(code, codebase, sandbox);
	} else if (Sandbox) {
		// 1.0.x
		evalInSandbox(code, sandbox, codebase);
	} else {
		throw new Error("Could not create sandbox.");
	}
},

openInTab: function(unsafeContentWin, url) {
	var tabBrowser = getBrowser(), browser, isMyWindow = false;
	for (var i = 0; browser = tabBrowser.browsers[i]; i++)
		if (browser.contentWindow == unsafeContentWin) {
			isMyWindow = true;
			break;
		}
	if (!isMyWindow) return;
 
	var loadInBackground, sendReferrer, referrer = null;
	loadInBackground = tabBrowser.mPrefs.getBoolPref("browser.tabs.loadInBackground");
	sendReferrer = tabBrowser.mPrefs.getIntPref("network.http.sendRefererHeader");
	if (sendReferrer) {
		var ios = Components.classes["@mozilla.org/network/io-service;1"]
							.getService(Components.interfaces.nsIIOService);
		referrer = ios.newURI(content.document.location.href, null, null);
	 }
	 tabBrowser.loadOneTab(url, referrer, null, null, loadInBackground);
 },
 
 hitch: function(obj, meth) {
	var unsafeTop = new XPCNativeWrapper(unsafeContentWin, "top").top;

	for (var i = 0; i < this.browserWindows.length; i++) {
		this.browserWindows[i].openInTab(unsafeTop, url);
	}
},

apiLeakCheck: function(allowedCaller) {
	var stack=Components.stack;

	var leaked=false;
	do {
		if (2==stack.language) {
			if ('chrome'!=stack.filename.substr(0, 6) &&
				allowedCaller!=stack.filename 
			) {
				leaked=true;
				break;
			}
		}

		stack=stack.caller;
	} while (stack);

	return leaked;
},

hitch: function(obj, meth) {
	if (!obj[meth]) {
		throw "method '" + meth + "' does not exist on object '" + obj + "'";
	}

	var hitchCaller=Components.stack.caller.filename;
	var staticArgs = Array.prototype.splice.call(arguments, 2, arguments.length);

	return function() {
		if (nicomonkey_gmCompiler.apiLeakCheck(hitchCaller)) {
			return;
		}
		
		// make a copy of staticArgs (don't modify it because it gets reused for
		// every invocation).
		var args = staticArgs.concat();

		// add all the new arguments
		for (var i = 0; i < arguments.length; i++) {
			args.push(arguments[i]);
		}

		// invoke the original function with the correct this obj and the combined
		// list of static and dynamic arguments.
		return obj[meth].apply(obj, args);
	};
},

addStyle:function(doc, css) {
	var head, style;
	head = doc.getElementsByTagName('head')[0];
	if (!head) { return; }
	style = doc.createElement('style');
	style.type = 'text/css';
	style.innerHTML = css;
	head.appendChild(style);
},

onLoad: function() {
	var	appcontent=window.document.getElementById("appcontent");
	if (appcontent && !appcontent.greased_nicomonkey_gmCompiler) {
		appcontent.greased_nicomonkey_gmCompiler=true;
		appcontent.addEventListener("DOMContentLoaded", nicomonkey_gmCompiler.contentLoad, false);
	}
},

onUnLoad: function() {
	//remove now unnecessary listeners
	window.removeEventListener('load', nicomonkey_gmCompiler.onLoad, false);
	window.removeEventListener('unload', nicomonkey_gmCompiler.onUnLoad, false);
	window.document.getElementById("appcontent")
		.removeEventListener("DOMContentLoaded", nicomonkey_gmCompiler.contentLoad, false);
},

/* Dirty Hack for NicoFox */
getString: function(str) {
	return nicofox.ui.monkeyStrings.getString(str);
},

/* Add bookmark (Firefox 3+ only) */
bookmark: function()
{
	var bookmark_serv = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
	                    .getService(Components.interfaces.nsINavBookmarksService);

	var uri =  Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(content.document.location.href, null, null)

	/* Check if it was in bookmark */
	var check_array = bookmark_serv.getBookmarkIdsForURI(uri, {});
	if (check_array.length < 1)
	{
		var bookmark_id = bookmark_serv.insertBookmark(bookmark_serv.unfiledBookmarksFolder, uri, -1, "");
		bookmark_serv.setItemTitle(bookmark_id, content.document.title);
	}
},
/* Add tag to places */
tag: function(str)
{
	if (typeof str != 'string') { return; }
	var bookmark_serv = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
	                    .getService(Components.interfaces.nsINavBookmarksService);
	var tagging_serv = Components.classes["@mozilla.org/browser/tagging-service;1"]
	                           .getService(Components.interfaces.nsITaggingService);
	var uri =  Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(content.document.location.href, null, null)
	/* Check if it was in bookmark */
	var check_array = bookmark_serv.getBookmarkIdsForURI(uri, {});
	if (check_array.length >= 1)
	{
		tagging_serv.tagURI(uri, [str], 1); //First argument = URI
	}	
	else
	{
		var bookmark_id = bookmark_serv.insertBookmark(bookmark_serv.unfiledBookmarksFolder, uri, -1, "");
		bookmark_serv.setItemTitle(bookmark_id, content.document.title);
		tagging_serv.tagURI(uri, [str], 1); //First argument = URI
	}

},
}; //object nicomonkey_gmCompiler


function nicomonkey_ScriptStorage() {
	this.prefMan=new nicomonkey_PrefManager();
}
nicomonkey_ScriptStorage.prototype.setValue = function(name, val) {
	this.prefMan.setValue(name, val);
}
nicomonkey_ScriptStorage.prototype.getValue = function(name, defVal) {
	return this.prefMan.getValue(name, defVal);
}

window.addEventListener('load', nicomonkey_gmCompiler.onLoad, false);
window.addEventListener('unload', nicomonkey_gmCompiler.onUnLoad, false);
