// ==UserScript==
// @name           Nicomonkey
// @namespace      http://www.nicovideo.jp/fox
// @include        http://www.nicovideo.jp/*
// @include        http://tw.nicovideo.jp/*
// @include        http://de.nicovideo.jp/*
// @include        http://es.nicovideo.jp/*
// ==/UserScript==

/* Greasemonkey compatibility */
/*
	var NM_getString = function(str) { return str; };
*/

var comment_naka_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAwBQTFRFAAAACAgIEBAQGBgYICAgMDAwODg4UFBQWFhYcHBwgICAj4+Pn5+fpKSkqKiot7e3z8/P39/f5+fn9/f3////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0X0j4wAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAFdJREFUKFPN0UkOgDAMA8AUWpayU///rUQcwVavzXUUxXLMWpleBRnKzCneQGbUncAVmRxASQwWABOD3eE379UsZZMSPADPbDUaaQm+tYrigqitlYd/cjy1CQeHsvXe4AAAAABJRU5ErkJggg==';
var comment_ue_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAwBQTFRFAAAATP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZmfEcAAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAABpJREFUKFNjYMANGLEDoAZ6yeBx3KjUMAsBAP2nAHQbf+isAAAAAElFTkSuQmCC';
var comment_shita_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAAABGdBTUEAALGPC/xhBQAAAwBQTFRFAAAATP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZmfEcAAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAABlJREFUKFNjYBgFIykEGLEDYBDQSwZXaAMAK2sAdCS8+YYAAAAASUVORK5CYII=';
var transparent_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAwBQTFRFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAszD0iAAAAQB0Uk5T////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////AFP3ByUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAFBhaW50Lk5FVCB2My4zNqnn4iUAAAAWSURBVChTY/iPCzCMyvwfDYP/dAsDAIxfbq50JWrWAAAAAElFTkSuQmCC';

var comment_big_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAwBQTFRFAAAADAwMGRkZJiYmMzMzQEBATk5OXFxca2trenp6i4uLnJycrq6uw8PD2tra////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXPSJjgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAI9JREFUKFO1UssSwiAMTBHBStj9/7812NBOEQ+O05xCln2EQeS/AuIXAfBaBF5k73oU+ORAepTokcD7ljoMGSO5zvfJZJ0jyl1uuAAm6Iy0mpYyfUILmCXMHrWwKRlxGViFuLWRxTgvU9gdKvE4WLnSTLys1zddJFkPf5d2Nj7KBimeJ9dUd68wLuFqP3+rF1cIBqcTr1DKAAAAAElFTkSuQmCC';
var comment_medium_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAwBQTFRFAAAAGRkZJiYmMzMzenp6i4uLnJycrq6uw8PD2tra////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqdvPiAAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAF5JREFUKFPNktsKgEAIRG3XVsf//+DEIDD0JQqah0E54gUk+pMEs1lnx9YQRgEQsnBJHMLMAjeGZsKent3eIFBVmJtamjOsIzTHtUGEN5WXRs0TsqwYEd2WduTLXzkAiLICs4gIfn8AAAAASUVORK5CYII=';
var comment_small_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAMAAADzN3VRAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAwBQTFRFAAAAJiYmQEBAXFxca2trenp6i4uLnJycrq6uw8PD2traAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtz0ECwAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAE5JREFUKFPV0UEOACEIA8AKopb/P3gx3gjuXY5MaCAAr5et2wXGH5HKHMbmBfUVgl4EUreAlvNGdLeIJ1FvR6B5JuBIVcJ5kTlef2Ls/wFimQEWbWcdnAAAAABJRU5ErkJggg==';
/* To let it be a light script, we won't use something like jQuery */
function $$(xpath,root) { 
//  xpath=xpath.replace(/((^|\|)\s*)([^/|\s]+)/g,'$2.//$3').
//             replace(/\.([\w-]+)(?!([^\]]*]))/g,'[@class="$1" or @class$=" $1" or @class^="$1 " or @class~=" $1 "]').
//              replace(/#([\w-]+)/g,'[@id="$1"]').
//              replace(/\/\[/g,'/*[');/**/
//  str='(@\\w+|"[^"]*"|\'[^\']*\')'
//  xpath=xpath.replace(new RegExp(str+'\\s*~=\\s*'+str,'g'),'contains($1,$2)').
//              replace(new RegExp(str+'\\s*\\^=\\s*'+str,'g'),'starts-with($1,$2)').
//              replace(new RegExp(str+'\\s*\\$=\\s*'+str,'g'),'substring($1,string-length($1)-string-length($2)+1)=$2');
//	      alert(xpath);
	  var got=document.evaluate(xpath,root||document,null,null,null), result=[];
	  while(next=got.iterateNext()) result.push(next);
  return result;
}

function injectCSS(text)
{
	css = document.createElement('style');
	css.type = 'text/css';
	css.textContent = text;
	return css;
}

function start()
{
	if (document.getElementById('flvplayer_container') && document.getElementById('deleted_message_default') && GM_getValue('player_killer')) /* Video is deleted for copyright issue */
	{
		killPlayer();
	}

	/* Inject CSS */
		GM_addStyle('.fox-dl-link:link, .fox-dl-link:visited, .fox-dl-link:hover {color: #FFFFFF; background: #BBBBFF; margin-left: 0.2em;}'+"\r\n"+
		   '#regenerate_player { background: #BBBBBB; border: 1px solid #CCCCCC; color: white; display: block; width: 100%; height: 540px; text-align: center; line-height: 540px; font-size: 200%; text-decoration: none; } #regenerate_player:hover {background: #999999;}'
		);
		GM_addStyle('#video_utilities_tabswitch {border-bottom: 1px solid #CCCCCC;} a.fox-sw-link, a.fox-sw-link-selected { margin: 0.5em; text-decoration: none; } a.fox-sw-link {background: transparent; color: #AAAAAA; border: 1px solid #AAAAAA; border-bottom: 0; } a.fox-sw-link-selected {background: white; color: black; border: 2px solid #333333; border-bottom: 2px solid white;  } ');
		GM_addStyle('#comment_helper p {line-height: 30px; } #comment_helper img {border: 1px solid #999999; margin: 1px; vertical-align: middle;} #comment_helper_premium { margin-left: 5px; } #comment_helper textarea {font-family: sans-serif; font-size: 9pt; width: 245px; overflow: hidden; height: 25px; margin:0; padding: 0; vertical-align: middle;} #comment_helper .fox-ch-selected {border: 3px solid #33FF99;}');
	window.setTimeout(pushLinks, 10);
	if (document.getElementById('category_recent'))
	{
		window.setTimeout(listenMainPage, 10);
	}

	/* Player-related hack, need the 'watch' address and the flv player */
	if(window.location.href.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\//) /* URL is right */
	  && document.getElementById('flvplayer_container') /* Logged in */
	  )
	{
		/* Add comment helper */
		window.setTimeout(addCommentHelper, 10);
		if(GM_getValue('toolbar'))
		{
			/* Use Div to do something wrong */
			var niconicofox_inject = document.createElement('div'); niconicofox_inject.id = 'niconicofox_inject';
			niconicofox_inject.style.display = 'none';

			/* innerHTML is truly dirty but useful! */
			niconicofox_inject.innerHTML = '<input id="inject_video_v" /><input id="inject_video_id" /><input id="inject_video_isDeleted" /><input id="inject_video_isMymemory" />';

			/* Put the container of injection */
			var watchfooter= document.getElementById('WATCHFOOTER');
			watchfooter.appendChild(niconicofox_inject);

			/* Use location hack to get the Video object, which contains what we want! */
			var inject_js_str  = 
			'document.getElementById("inject_video_v").value = Video.v;'+
			'document.getElementById("inject_video_id").value = Video.id;'+
			'document.getElementById("inject_video_isDeleted").value = Video.isDeleted;'+
			'document.getElementById("inject_video_isMymemory").value = Video.isMymemory;';

			location.href='javascript: void(eval(\''+inject_js_str.replace(/\'/g,'\\\'')+'\'));';

			prepare_inject(0);
		}
	}
}

function prepare_inject(timer)
{
	if (!document.getElementById('inject_video_v').value)
	{
		if (timer==10)
		{
			alert('Inject time out! The script may be broken.');
			return;
		}
		timer = timer + 1;
		window.setTimeout(prepare_inject, 1, timer);
	}
	else
	{
		start_inject();
	}

}

function start_inject()
{

	var Video = 
	{
		v: document.getElementById('inject_video_v').value,
		id: document.getElementById('inject_video_id').value,
		isDeleted: false,
		isMymemory: false,
	}
	if (document.getElementById('inject_video_isDeleted').value=='true') { Video.isDeleted = true; }
	if (document.getElementById('inject_video_isMymemory').value=='true') { Video.isMymemory = true; }

	if (Video.isDeleted)
	{
		killPlayer();
		return;
	}
	
	var niconicofarm = "\r\n";
	/* check if Video.v is a pure integer... (mymemory / community / other countries ver.), (for hatena::diary and niconicofarm) */

	if (Video.v.match(/[A-Za-z]/))
	{
		niconicofarm = '<li><a href="http://nico.xii.jp/comment/?url='+Video.id+'" target="_blank">'+NM_getString('toolsNicoNicoFarm')+"\r\n"; // Use Nico Nico Farm (support)
	}

	/* Fetching Nico Nico's video title */
	h1 = document.getElementsByTagName('h1')[0];

	/* inject the video download link */
	if (h1.hasChildNodes())
	{
			download_link = document.createElement('a');
			download_link.className = 'fox-dl-link';

				href = window.location.href;
				/* There will be some problem if the premium user uses the normal user network (?lo=1), dirty fix */
				href = href.split("?")[0];

			download_link.href = href + '?smilefox=get';
			download_link.textContent = 'DL';

			h1.appendChild(download_link);
	}

	/* Inject Video Utilities */
	video_utilities = document.createElement('div');
	video_utilities.id = 'video_utilities';


	html = 	'<div id="video_utilities_tabswitch" style="font-size: 14px;"><a href="#" id="video_utilities_sw1" class="fox-sw-link-selected" onclick="return false;">General</a><a href="#" id="video_utilities_sw2" class="fox-sw-link" onclick="return false;">'+NM_getString('related')+'</a><a href="#" id="video_utilities_sw3" class="fox-sw-link" onclick="return false;">'+NM_getString('tools')+'</a></div>'+
		'<ul id="video_utilities_tab2" style="display: none;">'+"\r\n"+
		'<li>'+NM_getString('relatedHatena')+'<br /><input type="text" value="http://d.hatena.ne.jp/video/niconico/'+Video.v+'" readonly="true" onclick="this.focus(); this.select();" /></li>'+"\r\n"+
		'<li><a href="http://www.nicovideo.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('relatedNicoWww')+'</a></li>'+"\r\n"+
		'<li><a href="http://tw.nicovideo.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('relatedNicoTw')+'</a></li>'+"\r\n"+
		'<li><a href="http://es.nicovideo.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('relatedNicoEs')+'</a></li>'+"\r\n"+
		'<li><a href="http://de.nicovideo.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('relatedNicoDe')+'</a></li>'+"\r\n"+
		'</ul>'+"\r\n"+
		'<ul id="video_utilities_tab3" style="display: none;">'+"\r\n"+
		'<li><a href="http://nicosound.dip.jp/sound/'+Video.id+'" target="_blank">'+NM_getString('toolsNicoSound')+'</a></li>'+"\r\n"+
		'<li><a href="http://www.nicochart.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('toolsNicoChart')+'</a></li>'+"\r\n";
	html = html + niconicofarm; /* Niconico farm is general comment only */
	html = html + '</ul></li>'+"\r\n"
	;
	video_utilities.innerHTML = html;
	right_tools = $$('.//*[@id="WATCHHEADER"]/table/tbody/tr/td')[1];
	right_tools.getElementsByTagName('table')[0].id = 'video_utilities_tab1';
	right_tools.insertBefore(video_utilities, right_tools.firstChild);

	document.getElementById('video_utilities_sw1').addEventListener('click', videoUtilitiesTab, false);
	document.getElementById('video_utilities_sw2').addEventListener('click', videoUtilitiesTab, false);
	document.getElementById('video_utilities_sw3').addEventListener('click', videoUtilitiesTab, false);
	/*WATCHHEADER = document.getElementById('WATCHHEADER');
	WATCHHEADER.parentNode.insertBefore(video_utilities, WATCHHEADER);*/

}

function videoUtilitiesTab(e)
{
	tab_num = (e.target.id.match(/sw([0-9])$/)[1]);
	if (!tab_num || isNaN(tab_num)) { return; }
	for (i = 1; i <= 3; i++)
	{
		document.getElementById('video_utilities_tab'+i).style.display = 'none';
		document.getElementById('video_utilities_sw'+i).className = 'fox-sw-link';
	}
	document.getElementById('video_utilities_tab'+tab_num).style.display = 'block';
	document.getElementById('video_utilities_sw'+tab_num).className = 'fox-sw-link-selected';
	return false;
}

function addCommentHelper()
{
	/* The comment helper */
	comment_helper = document.createElement('div');
	comment_helper.id = 'comment_helper';
	
	comment_helper_form = document.createElement('form');
	comment_helper_form.name = 'comment_helper_form';

	comment_helper_content = document.createElement('p');
	comment_helper_content.id = 'comment_helper_content';

	comment_helper_content.innerHTML = 
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_naka"><img src="'+comment_naka_uri+'" class="fox-ch-selected" /></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_ue"><img src="'+comment_ue_uri+'" /></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_shita"><img src="'+comment_shita_uri+'" /></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_big"><img src="'+comment_big_uri+'" /></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_medium"><img src="'+comment_medium_uri+'"  class="fox-ch-selected"/></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_small"><img src="'+comment_small_uri+'" /></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_white"><img src="'+transparent_uri+'"  class="fox-ch-selected" style="background: #FFFFFF;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_red"><img src="'+transparent_uri+'" style="background: #FF0000;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_pink"><img src="'+transparent_uri+'" style="background: #FF8080;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_orange"><img src="'+transparent_uri+'" style="background: #FFCC00;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_yellow"><img src="'+transparent_uri+'" style="background: #FFFF00;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_green"><img src="'+transparent_uri+'" style="background: #00FF00;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_cyan"><img src="'+transparent_uri+'" style="background: #00FFFF;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_blue"><img src="'+transparent_uri+'" style="background: #0000FF;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_purple"><img src="'+transparent_uri+'" style="background: #C000FF;"></a>'+
	'<span id="comment_helper_premium" style="display: none;">'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_white2"><img src="'+transparent_uri+'" style="background: #CCCC99;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_red2"><img src="'+transparent_uri+'" style="background: #CC0033;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_orange2"><img src="'+transparent_uri+'" style="background: #FF6600;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_yellow2"><img src="'+transparent_uri+'" style="background: #999900;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_green2"><img src="'+transparent_uri+'" style="background: #00CC66;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_blue2"><img src="'+transparent_uri+'" style="background: #33FFFC;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_purple2"><img src="'+transparent_uri+'" style="background: #6633CC;"></a>'+
	'<a href="#" class="ch_link" onclick="return false;" id="comment_helper_black"><img src="'+transparent_uri+'" style="background: #000000;"></a>'+
	'</span>'+
	'<textarea rows="1" value="" onchange="$(\'flvplayer\').SetVariable(\'inputArea.ChatInput1.text\', this.value);" onkeyup="this.onchange();"></textarea>';

	comment_helper_form.appendChild(comment_helper_content);
	comment_helper.appendChild(comment_helper_form);
	watch_footer = document.getElementById('WATCHFOOTER');
	watch_footer.insertBefore(comment_helper, watch_footer.firstChild);

	helper_links = comment_helper_content.getElementsByTagName('a')
	for (i = 0; i < helper_links.length; i++)	
	{
		helper_links[i].addEventListener('click', commentHelperSelect, false);
	}

	js = 'if (User.isPremium) {$(\'comment_helper_premium\').show() }'; 
	location.href='javascript: void(eval(\''+js.replace(/\'/g,'\\\'')+'\'));';
}

var ch_position = 'naka';
var ch_positions = ['naka', 'shita', 'ue']
var ch_size = 'medium';
var ch_sizes = ['medium', 'big', 'small']
var ch_color = 'white';
var ch_colors = ['white', 'red', 'pink', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple',
                 'white2', 'red2', 'orange2', 'yellow2', 'green2', 'blue2', 'purple2', 'black'];

function commentHelperSelect(e)
{
	id = e.target.id;
	/* When click on img, the id will be empty */
	if (!id) { id = e.target.parentNode.id; }
	if (!id) { return; }
	
	sel = id.match(/comment\_helper\_(.*)$/);
	if(!sel) { return; }
	sel = sel[1];
	if (ch_positions.indexOf(sel) != -1)
	{	
		document.getElementById('comment_helper_'+ch_position).getElementsByTagName('img')[0].className = '';
		document.getElementById('comment_helper_'+sel).getElementsByTagName('img')[0].className = 'fox-ch-selected';
		
		ch_position = sel;
	}
	if (ch_sizes.indexOf(sel) != -1)
	{
		document.getElementById('comment_helper_'+ch_size).getElementsByTagName('img')[0].className = '';
		document.getElementById('comment_helper_'+sel).getElementsByTagName('img')[0].className = 'fox-ch-selected';

		ch_size = sel;
	}
	if (ch_colors.indexOf(sel) != -1)
	{
		document.getElementById('comment_helper_'+ch_color).getElementsByTagName('img')[0].className = '';
		document.getElementById('comment_helper_'+sel).getElementsByTagName('img')[0].className = 'fox-ch-selected';

		ch_color = sel;
	}

	mail_inputs = [];
	if (ch_positions.indexOf(ch_position) != 0) mail_inputs.push(ch_position);
	if (ch_sizes.indexOf(ch_size) != 0) mail_inputs.push(ch_size);
	if (ch_colors.indexOf(ch_color) != 0) mail_inputs.push(ch_color);

	mail_input = mail_inputs.join(' ');
	js = '$(\'flvplayer\').SetVariable(\'inputArea.MailInput.text\',\''+mail_input+'\');'; 
	location.href='javascript: void(eval(\''+js.replace(/\'/g,'\\\'')+'\'));';
}

function listenMainPage()
{
document.addEventListener('DOMAttrModified', function(event)
	{
		if(event.target.id == 'tag_modeA' || event.target.id == 'tag_modeB') { pushLinks(true); }
	}
, false);
}
function pushLinks(mainpage)
{
	/* Fetching the video links */
	if (mainpage == true)
	{
		videos = $$('.//a [@class="video" or substring(@class,string-length(@class)-string-length(" video")+1)=" video" or starts-with(@class,"video ") or contains(@class," video ")]', document.getElementById('category_recent'));
	}
	else
	{
		videos = $$('.//a [@class="video" or substring(@class,string-length(@class)-string-length(" video")+1)=" video" or starts-with(@class,"video ") or contains(@class," video ")]');
	}
	/* Run every link to check what we like */
	for (i = 0; i < videos.length; i++)
	{
		video = videos[i];
		href = video.href;

		/* Is it truly a "watch" or "mylist" links? */
		if (href.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+$/)/* || href.match(/^http:\/\/(tw|www)\.nicovideo\.jp\/mylist\/[0-9]+$/)*/)
		{
			/* If it is, we will add a "download" link, to help Smilefox work :) */
			download_link = document.createElement('a');
			download_link.className = 'fox-dl-link';
			download_link.href = href+'?smilefox=get';
			download_link.textContent = 'DL';

			video.parentNode.insertBefore(download_link, video.nextSibling);
		}
	}
}
//category_recent
function killPlayer()
{
		var flvplayer = document.getElementById('flvplayer');
		flvplayer.parentNode.removeChild(flvplayer);
		var flvplayer_container = document.getElementById('flvplayer_container')

		player_deleted = document.createElement('div');
		player_deleted.innerHTML = '<a href="'+window.location.href+'" id="regenerate_player" onclick="return false;">'+NM_getString('playerKillerMsg')+'</a>';
		flvplayer_container.appendChild(player_deleted);

		document.getElementById('regenerate_player').addEventListener('click', function(event)
		{
			document.getElementById('flvplayer_container').removeChild(player_deleted);
			document.getElementById('flvplayer_container').appendChild(flvplayer);
			return false;
		}
		, true
		);
}

if (GM_getValue('enable'))
{ start(); }
