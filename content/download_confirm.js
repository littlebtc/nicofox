function onLoad()
{	
	url = window.arguments[0].url;
	Video = window.arguments[0].Video;
	notice = document.getElementById('notice');
	strings = document.getElementById('nicofox-strings');

	if (Video.isMymemory)
	{
		notice.style.display = 'block';
		notice.textContent = strings.getString('confirmMymemory');
	}
	/* TODO: DIRTY */
	if (this.Video.comment_type == 'tw')
	{
		notice.style.display = 'block';
		notice.textContent = strings.getString('confirmTw');
	}
	else if (this.Video.comment_type == 'de')
	{
		notice.style.display = 'block';
		notice.textContent = strings.getString('confirmDe');
	}
	else if (this.Video.comment_type == 'es')
	{
		notice.style.display = 'block';
		notice.textContent = strings.getString('confirmEs');
	}
	else if (this.Video.comment_type.match(/^(co)/))
	{
		notice.style.display = 'block';
		notice.textContent =  strings.getFormattedString('fromCommunity', [this.Video.community_name] );
	}
	else if (this.Video.comment_type.match(/^(ch)/))
	{
		notice.style.display = 'block';
		notice.textContent =  strings.getFormattedString('fromChannel', [this.Video.community_name] );
	}

	/* Check the URL and find the thumb */
	if (url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+$/))
	{
		thumb_url = 'http://ext.nicovideo.jp/thumb/'+Video.v;
	}
	else if (url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/mylist\/[0-9]+$/))
	{
		thumb_url = url.replace(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/mylist\//, 'http://ext.nicovideo.jp/thumb_mylist/');	
	}

	/* Show the thumb! */
	video_thumb = document.getElementById('video_thumb')
	video_thumb.webNavigation.loadURI(thumb_url, Components.interfaces.nsIWebNavigation,null,null,null);


}

function doCancel()
{
	window.close();
}

function doDownload()
{
	window.arguments[0].out = true;
	/* Do not display it again? */
	if (document.getElementById('dontask').checked)
	{
		prefs = Components.classes["@mozilla.org/preferences-service;1"].
                         getService(Components.interfaces.nsIPrefService);
		prefs.setBoolPref("extensions.nicofox.confirm_before_download", false);
	}
	return true;
}
