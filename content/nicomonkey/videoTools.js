/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 * Video Toolbar & Comment Helper */

var tag_add_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAB9klEQVQ4T4WSSY8SURSF60/0VuO/IKn4e3pjWmN0q3Y0Rk20nXbOccdQJdXMFm0RIEwpAhTIEEJIAQIh0ShapBlyfPclVWmExsXZ3HfPd8997wm1Wg3VahWVSgXlchmlUgnFYhG6rqNQKOwBEHZJMAwDq9VqQ/1+n0Oy2exOiECTyWCaJp/c7XYdCNVYCqRSqXMhAkWmZppGhXw+r0+nUywWC14nYCaTgaZpWyECTbUbmfmURTZnsxnGP3pIGDI/63Q6SCaTiMfjGxCBJtuRl8slyDz5+Q1Pj6/hobQPzZD4WbvdphSIRqNrEIHtaE0mE940n88x+t7D0fFVvPp8C+9O7uIZA9mQVqtFKRAMBh2IkMvlLrMdrfF4zJu+mnk8kvfxRr2Dj9oDvD+5twZpNpuUAn6/n0M4JZ1Oi2xHazQa8aZGr4gn/gO8VQ8dyJFygHjZzc/r9TqlgCRJe84uiURCZDtaw+FwA/Lhy328DN3AC+UmFss5TxEOh+H1ei+u3SjbT1RV1RoMBg7k8acreB64jtexQ/z+8+us+ZKzwlnFYjExEolY9BN5XFNn5tuYnVqO2ePxcPNWACkUComBQMCin2g/MZlZfc18LoCkKIqL3bRFH6zRaGw17wSQZFl2+Xw+i8xut3vD/F8AiU11MfOFf+u2/gL5GCirQDsa6AAAAABJRU5ErkJggg==';

var jp_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAABAklEQVQoz3WRMW4CMRBFx6utttgG0VBwDEoOQENBS4GUXAwlHeICFDSba1AgiESzSEhskbE1L4W9ZlPky7JnPH/0/9iu6zoZwMziPgwyglkpIlVViQgQeyBm/THA7XYrexKv4Hik+cIrsxmLRWY75ywq/GHv92y3hIB6mobvK2/vsSE6LLJ7QNqW3Q7vUU3r45PLJYuEEIo4XPbI45GoXlHl+eR8ppcws9LM+hwZjykKvKIeVbxHhMkkzQDJUuYzGrFc8qOJrcpqxXSaX0xEymwpdW42VBWHA6rM56zXeWIRCSG4tm3rus63KYg+nYNXRUROp1NpZvf7vf/IYMH+QxT5BSaTbJ+etTAQAAAAAElFTkSuQmCC';

var tw_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAABEUlEQVQoz22RsU0DURBE585nOUUCCRw4JiGiBWqwKAMKgIwuoApTAhRgUYB1BIYEgUC2bP7Mzif4YHyC1WiSnbcaaSsc3mIzMmQkY63Ht9MDwH/UALi6PAJwvDvo1fX9fBFGROxMz3ta1mSW8o8vJpOmnN5b+mS83+9X7fXi7mUlWbPW/MiJmSmnlMlqNDLQwLDNFEAmvVqJYcnfUaacWACQBhpIEZiueXEzk/30/qkwbW/d3gAAGiTZDsXzqyQzckRIHnDxmy6AZKCJ+RgPZ7ltMxOoTG7X2PaqVDJQkTklSJ1QNw0pSypATyoVtwt0MBEKRKAANYXhMJNQQARZkZBQXEJEkYFq2X0k/vvuZgXgC0lTZuDhPtkPAAAAAElFTkSuQmCC';

var de_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAABNUlEQVQoz3WQMaoUARBEa2ZnwUgUEwN/aqjgNzJUzD5o6D1+4C28iLCXMNHUowgy3V3dVQazaOQLiqbgVdDL3d07zA4Jp61axbYICP9hI/f7+88AJEma6Zkj+wrZ090kebl83dZ1BfD9x88mj7qqKisr/xIRGfHh41sA2w3wSLohu7urmmQmM6uKEZWRmdwjK582AWyfmLczt6SrfGSmMxWpDGcqwnuq4szegM0sz6DKRWe4SlchnKlM7fvhm2VgM4Dpf8NVjlDEVdt3V06kqzwcYOMb4Ll9kkeixDkOt0W5MbQbov16iW/Y/AJ+Jj8eaaSxRtOWpD7erLElCX6y6D02FNzE+dWKWjRWLWqY1li02h677Ub1+hvL5cvLBwMVfELuEOCHWAMa1AlT0OC8QgGc8KvwBzggh2G9tgbIAAAAAElFTkSuQmCC';

var es_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAABH0lEQVQoz32RrU5cURSFv3PntghCJQkCBUgQ9RieAVmN6CtMJsFjeBZsVVUtg2dUK5owyYTOlLln/yzEvRM6CenOypcl9l5i7SLeJrf9uyoCxmNAmWQSIQ/C5Y67zPQPl3d3LQDSz19EECGznoOqyapqlVk5PExoCVQEAfF3kS8L7e3X0Y5LJlWpDiaNYvlMkwABvlx53MJNu3q6WHd1s70RVRjQABCSje6/+G8vXycfHo+6edmKH248kwaQXPL27OTPSXI9GZ1+bvVR6qS6YZUqskyaTPqYH48Pu+d1fdl9n35bf1ptsgeCS+5O6WB0dZWzGUMtQycDe+OGRzk+nk+nbUJjzsGBzPDADbNihjs93fvGiUgoq+1H/ufH/bwCdrRKrziyqwAAAAAASUVORK5CYII=';

var hatena_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAS0lEQVQ4y2NgoAZQZKj/Tw5GMcDekzSM1QBjhmP/PRj+48UgNQQNwAbIMgDEB2FkQ0g2AKYJWWykGUBRIJIdjWQnJIqSMkWZiRIAAHPXwSikhnilAAAAAElFTkSuQmCC';

var music_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAETSURBVBgZfcExS0JRGIDh996OFIQEgSRhTS1Bg0trw937B9UPCAT3hnJ1kYbGhrv0BxoaXSsMhBCsyUEcoiTKUM/3HU8Fce4Q+DyRZz5DcOkdiqIIiiAo7xiCMXs4HI4ZisPhOMcQOJQbOoxxKHm22UUxBBbHM1cRfw58GUtMIAieTIwgxAQWRclMEZSYwCIIGYsixASCYsl4pgiGwDFF+HWUaDopbfCGHRp+nCWSTktFXvFDOKyuNNYp4LhFriPPaXW5UWAV5Y6HNH+/dbHJIjN6NHlJzMnxWqNIDqFHh8/U7hiEJbp0+ar0m2a4MGFEjie6jCrtJs1y57FuI21R6w8g8uwnH/VJJK1ZrT3gn8gz3zcVUYEwGmDcvQAAAABJRU5ErkJggg==';

var chart_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABr0lEQVQ4y6WTu2pWURBG14knaiSQymCTQpDwV2Ktdqax8AXs0gqWonZ2PoK2gmDtA6S0U0HEdxBS5fKfveducYJESCSQKQdmzfoGZqgqLlPjWc1Xn/YrMlGHiEQ9EU8+PNsaLgQQTR4ubuCZZIFH8fnr4cUNmiUayf6BY1FsrF3huOXFAcvmqCfdEo9CxhWOmp8NqNcv5itmUuaUOdPtl4gW3Qrz5PpqcNjjPwaPdiCTIYIhgqMfiXjRJLCAtdXi8LwIZc7gDt+/gRvcvcdxU7olk84R+tUBb3YOQHQGSAdzMOdACrGkSWJRrF9Lcpk839stU0fVsG6IGGN2YcUduoAZqHK8TLoWTRON+RbZksdbT/EIIhxL4+OXd4zZTjaLgCq4481mg7+ApJpjbvz8/Qs1YfvmHdqyM+bU58HWZgMzcpl0/ReQLTBXmk6ICWJCX3bGmhqcjuBOtqSdMlArSkBcaNIQE9SVNgljTieb7z+ACHCnmqNe3NpYxRPEihJFXVlsbuNhmCvShOHNzttKc0qcsqAseL/+hApAkwqnHCqKzcUebkl4EJ5kJMNl3/kPtIqkPQKeuE8AAAAASUVORK5CYII=';

var comments_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAG/SURBVDjLjZK9T8JQFMVZTUyc3IyJg4mDi87+GyYu6qB/gcZdFxkkJM66qJMGSNRBxDzigJMRQ1jQ4EcQ+SgVKB+FtuL13EdJxNDq8Ev7Xu85797T51nwhqeAH5w6cAxWwDgReX7jwYfdaCIraroptB7NLlVQrOoiGEsL1G06GZyxuILicsMUH3VTlOqGKNUMUdTacj+j1Nng0NGAT2WxYosK1bbIVVoiW27J9V8G57WWKVSczMV5iK+Tudv1vVh5yXdlLQN+os4AFZss2Ob82CCgQmhYHSnmkzf2b6rIhTAaaT2aXZALIRdCLgRtkA1WfYG4iKcVYX52JIs7EYvFmJ8wGiEXQi6EXAhdyn2MxQaPcg68zIETTvzyLsPzWnwqixVbhFwI3RFykes+A9vkIBKX4jCoIxdCLrI4/0OcUXXK4/1dbbDBS088xGGCCzAJCsiF2lanT8xdKNhHXvRarLFBqmcwCrbAhL32+kP3lHguETKRsNlbqUFPeY2OoikW62DNM+jf2ibzQNN0g5ALC75AGiT59oIReQ+cDGyTB+TC4jaYGXiRXMTD3AFogVmnOjeDMRAC025duo7wH74BwZ8JlHrTPLcAAAAASUVORK5CYII=';

/* Check if we've logged in */
var loggedIn = false;
if (unsafeWindow.User) {
  if (unsafeWindow.User.id) {
    if (typeof unsafeWindow.User.id == 'number') { loggedIn = true; }
  }
}

/* Inject CSS */
GM_addStyle('#regenerate_player { background: #BBBBBB; border: 1px solid #CCCCCC; color: white; display: block; width: 100%; height: 540px; text-align: center; line-height: 540px; font-size: 200%; text-decoration: none; } #regenerate_player:hover {background: #999999;}'
    );
GM_addStyle('.fox-tag-link { text-decoration: none !important; display: inline-block; width: 16px; background: url(' + tag_add_uri + ') center center no-repeat;}');
GM_addStyle('#video_utilities {list-style-type: none; margin:0; padding: 0; margin-left: 2px;} #video_utilities li {display: inline; font-size: 12px; font-weight: bold; padding: 0px 2px; }');    
GM_addStyle('#video_utilities a { text-decoration: none !important; display: inline-block; width: 16px; background-position: center center; background-repeat: no-repeat;');

var Video = {};

/* Player-related hack, need the 'watch' address and the flv player */
if(/^http:\/\/(?:www|tw|de|es)\.nicovideo\.jp\/watch\//.test(document.location.href) /* URL is right */
    && document.getElementById("flvplayer_container") /* Logged in */
  ) {
  
  /* Lazy sanitizer: Stringify unsafeWindow.Video using JSON then re-parse it. */
  if ((typeof unsafeWindow.Video) != "object") { return; }
  var VideoJSON = "";
  try {
    VideoJSON = JSON.stringify(unsafeWindow.Video);
    Video = JSON.parse(VideoJSON);
  } catch(e) {
    throw new Error("Cannot convert Video parameter into JSON!");
    return;
  }
  /* Write necessary information into VideoInfoReader */
  window.setTimeout(function() {
    var otherInfo = {};
    otherInfo.hasOwnerThread = false;
    /* Check whether the uploader comments (thread) exists on this video */
    var flashvars = document.getElementById("flvplayer").getAttribute("flashvars");
    if (flashvars) {
      otherInfo.hasOwnerThread = (/\&has_owner_thread=1\&/.test(flashvars));
    }
    NM_writeVideoInfo(document.location.href, VideoJSON, JSON.stringify(otherInfo));
  }, 10);
  
  /* Tag helper, aka "Supertag" */
  if (GM_getValue('supertag')) {
    var tags = document.getElementById("video_tags").querySelectorAll("a[rel=tag]");
    var nobrRegex = /nobr/i;
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i];
      
      var tagHelper = document.createElement("a");
      tagHelper.className = "fox-tag-link";
      tagHelper.title = NM_getString("addTag");
      tagHelper.id = "tag_helper_" + i;
      tagHelper.innerHTML = "&nbsp;"
      tagHelper.href = "#";

      tagHelper.addEventListener("click", function(e) {
        if (!e.target) {return;}
        NM_addTag(document.location.href, document.title, e.target.parentNode.getElementsByTagName('a')[0].textContent);
        e.stopPropagation();
        e.preventDefault();
      }, true);
      if (nobrRegex.test(tag.parentNode.tagName)) {
        /* Japan version, use <nobr> in website */
        tag.parentNode.appendChild(tagHelper);
      } else { 
        /* Non-japan version, append <nobr> */ 
        var nobr = document.createElement("nobr");
        var tagList = tag.parentNode;
        tagList.insertBefore(nobr, tag.nextSibling);
        tagList.removeChild(tag);
        nobr.appendChild(tag);
        nobr.appendChild(tagHelper);
      }
    }  
  }

  /* If logged in, add download link and toolbar if needed */
  if (loggedIn) {
    var videoTitle = null;
    /* Fetching Nico Nico's video title */
    if(/^http:\/\/www/.test(window.location.href)) {
      /* Japan website: in video_title (since Oct. 14 update) */
      videoTitle = document.querySelector(".video_title");
    } else {
      /* tw/de/es websites: in second <h1> */
      videoTitle = document.getElementsByTagName("h1")[1];
    }
    /* inject the video download link */
    if (videoTitle && videoTitle.hasChildNodes()) {
      var downloadLink = document.createElement("a");
      downloadLink.className = "fox-dl-link";
      downloadLink.id = "fox-dl-this";
      downloadLink.title = NM_getString("download");
      downloadLink.href = document.location.href.replace(/\?[^?]+/, "") + "?smilefox=get";
      downloadLink.innerHTML = '&nbsp;';
      videoTitle.appendChild(downloadLink);
    }

    if(GM_getValue("toolbar")) {
      window.setTimeout(addToolbar, 10);
    }
  }
}

/* Add Toolbar in the content area of Nico Nico Douga */
function addToolbar() {
  /* Set sound website URL */
  var soundWebsiteHref = GM_getValue('sound_converter');
  soundWebsiteHref = soundWebsiteHref.replace('%1', Video.id);

  /* Inject Video Utilities */
  var videoUtilities = document.createElement('ul');
  videoUtilities.id = 'video_utilities';
  var fragment = document.createDocumentFragment();
  addToolbarItem(fragment, "toolbarTitle");
  addToolbarItem(fragment, "relatedHatena", "http://d.hatena.ne.jp/video/niconico/" + Video.v, hatena_uri);
  addToolbarItem(fragment, "relatedNicoWww", "http://www.nicovideo.jp/watch/" + Video.id, jp_uri);
  addToolbarItem(fragment, "relatedNicoTw", "http://tw.nicovideo.jp/watch/" + Video.id, tw_uri);
  addToolbarItem(fragment, "relatedNicoEs", "http://es.nicovideo.jp/watch/" + Video.id, es_uri);
  addToolbarItem(fragment, "relatedNicoDe", "http://de.nicovideo.jp/watch/" + Video.id, de_uri);
  addToolbarItem(fragment, "tools");
  addToolbarItem(fragment, "toolsSoundConverter", soundWebsiteHref, music_uri);
  addToolbarItem(fragment, "toolsNicoChart", "http://www.nicochart.jp/watch/" + Video.id, chart_uri);
  /* NicoNico Farm only supports original Japanese site thread, we need to check it */
  if (/^[A-Za-z]/.test(Video.v)) {
    addToolbarItem(fragment, "toolsNicoNicoFarm", "http://nico.xii.jp/comment/?url=" + Video.id, comments_uri);
  }
  videoUtilities.appendChild(fragment);
  document.getElementById('WATCHHEADER').appendChild(videoUtilities);
}

/* Create an item in toolbar. */
function addToolbarItem(list, stringEntry, href, imageSrc) {
  var item = document.createElement("li");
  if (!href) {
    item.textContent = NM_getString(stringEntry);
  } else {
    var link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.style.backgroundImage = "url("+ imageSrc +")";
    link.title = NM_getString(stringEntry);
    link.innerHTML = "&nbsp;";
    item.appendChild(link);
  }
  list.appendChild(item);
}
