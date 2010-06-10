/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 * Append download icon on every video link, if user logged in */

/* Icon in base64 data URL */
var dl_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAMUlEQVQoz2NgwAT/0TBe8B8dENI0lDXAQwWHBgyN/wkBbDaRpJhsT6NoIkYxeiBgAAC7ec0ziwfsxAAAAABJRU5ErkJggg==";

/* Add CSS Style */
GM_addStyle(".fox-dl-link { text-decoration: none !important; display: inline-block; width: 12px; background: url(" + dl_uri + ") center center no-repeat;}");

/* XXX: mylist & account manager page in nicovideo contains a lot of AJAX, skip it for the recent */
if (document.location.pathname.indexOf("/my") != 0) {
  window.setTimeout(function() { addDownloadIcons(document) }, 10);
}

/* Nicovideo Homepage had "tab" ajax update, so we should watch the DOM change to inject new links */
if (document.location.host == "www.nicovideo.jp" && document.location.pathname =="/") {
  document.addEventListener("DOMNodeInserted", function(event) {
    /* Category_recent contians updated video list, so inject it */
    if(event.target.id == "category_recent") { 
      window.setTimeout(function() { addDownloadIcons(event.target) }, 10);
    }
  }
  , false);
}

/* Main Function, add download icon under specific DOM node
 * @param rootDoc the root DOM node to add download icon
 */
function addDownloadIcons(rootDoc) {
  /* First, fetch all of the possible nodes that we want to apend links */
  var videoLinks = rootDoc.querySelectorAll("a[href*='watch/']");
  
  /* Then check every nodes and add download icon */
  for (var i = 0; i < videoLinks.length; i++) {
    var videoLink = videoLinks[i];
    var host = videoLink.host;
    var href = videoLink.href;
    var pathname = videoLink.pathname;
    
    /* 1st check: whether it is the link to video page */ 
    if (!host.match(/^(www|tw|de|es)\.nicovideo\.jp$/) || !pathname.match(/^\/watch\/[0-9a-z]+/)) {
      continue;
    }
    /* 2nd check: the child of this node should not contains <img> (prevents thumbnail injection) */
    if (videoLink.getElementsByTagName("img").length > 0) {
      continue;
    }
    
    var downloadLink = document.createElement("a");
    downloadLink.className = "fox-dl-link";
    downloadLink.href = href+"?smilefox=get";
    downloadLink.innerHTML = "&nbsp;";

    videoLink.parentNode.insertBefore(downloadLink, videoLink.nextSibling);
  }
  var endTime = new Date().getTime();
}
