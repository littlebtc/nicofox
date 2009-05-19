var Cc = Components.classes;
var Ci = Components.interfaces;


/* Get the URI of the player (due to Flash security) */
var em = Components.classes["@mozilla.org/extensions/manager;1"].
         getService(Components.interfaces.nsIExtensionManager);
var file = em.getInstallLocation('nicofox@littlebtc').getItemFile('nicofox@littlebtc', "player/nicofox_player.htm");

var uri = Cc["@mozilla.org/network/io-service;1"]
.getService(Ci.nsIIOService).newFileURI(file);

var player_src = uri.spec;
function load()
{
	/* Find the path */
	if(!window.arguments || !window.arguments[0])
	{
		return;
	}
  document.title = window.arguments[0].title + ' - NicoFox Player';
  var browser = document.createElement("browser");
  browser.setAttribute("id", "nicofox-player-browser");
  browser.setAttribute("name", "nicofox-player-browser");
  browser.setAttribute("type", "content-primary");
  browser.setAttribute("flex", "1");
  document.getElementById("player-box").appendChild(browser);
  // set restrictions as needed
  browser.webNavigation.allowAuth = false;
  browser.webNavigation.allowImages = false;
  browser.webNavigation.allowJavascript = true;
  browser.webNavigation.allowMetaRedirects = false;
  browser.webNavigation.allowPlugins = true;
  browser.webNavigation.allowSubframes = false;

// load a page
browser.contentDocument.location.href = player_src;
document.addEventListener("NicoFoxEvent", function(e) {
var obj = e.target;
obj.setAttribute('video_file', window.arguments[0].video);
obj.setAttribute('comment_file', window.arguments[0].comment);
}, false, true);

}

