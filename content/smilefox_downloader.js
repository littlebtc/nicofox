
var Cc = Components.classes;
var Ci = Components.interfaces;

var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.nicofox.");

function smileFoxDownloader()
{

}

smileFoxDownloader.prototype = {
canceled: false,
ms_lock: false,
init: function(comment_id)
{
	/* Save it to the object */
	this.comment_id = comment_id;

	/* Operator friendly? 403 Workaround? */
	goAjax('http://www.nicovideo.jp/watch/'+comment_id, 'GET', hitchFunction(this, 'goParse') , hitchFunction(this, 'failDownload'));
},

goParse: function(req)
{
	/* Don't waste time */
	if (this.canceled) { return; }
	html = req.responseText;
	    reg_array = html.match(/<script type\=\"text\/javascript\">\s+<!--\s+var Video = \{([\s\S]*)\}\;\s+-->\s+<\/script>\s+<div id=\"flvplayer_container\"/);
		if(!reg_array)
		{
		/* FIXME: there should have some other way to fix the conflict */
		var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
		              .getService(Ci.nsIPromptService);
		prompts.alert(null, strings.getString('errorTitle'), strings.getString('errorParseFailed'));
	        this.callback('fail',{});
		return;
		}
	goAjax('http://www.nicovideo.jp/api/getflv?v='+this.comment_id, 'GET', hitchFunction(this, 'parseDownload') , hitchFunction(this, 'failDownload'));
},

parseDownload: function(req)
{
	/* Don't waste time */
	if (this.canceled) { return; }

	/* take out the result query string */
	api_out = req.responseText;
	api_params = api_out.split('&');

	params = new Object;
	for (i=0; i < api_params.length; i++)
	{
		array = api_params[i].split('=');
		key = array[0];
		value = decodeURIComponent(array[1]);

		eval('params.'+key+' = value');
	}


	/* Distinguish Economy mode */
	if (params.url.match(/low$/))
	{
		this.economy = true;
	}
	else
	{
		this.economy = false;
	}

	/* Add comment filename */
	if (this.comment_type != 'www')
	{
		this.file_title = this.file_title + '['+this.comment_type+']';
	}

	/* Distinguish what type of video we will download */
	if (params.url.match(/smile\?s\=/)) /* SWF from Nico Nico Movie Maker */
	{
		this.type = 'swf';
	}
	else if (params.url.match(/smile\?m\=/)) /* H.264 mp4 */
	{
		this.type = 'mp4';
	}
	else /* maybe FLV */
	{
		this.type = 'flv';
	}


	/* Don't waste time */
	if (this.canceled) { return; }

	/* Prepare target file */
	this.ms_file = prefs.getComplexValue("save_path", Ci.nsILocalFile);
	this.ms_file.append(this.file_title + '.xml');

	if(this.ms_file.exists())
	{
		/* FIXME: there should have some other way to fix the conflict */
		var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
		              .getService(Ci.nsIPromptService);
		prompts.alert(null, strings.getString('errorTitle'), 'The XML comment file exists.');
	        this.callback('fail',{});
		return;
	}
	else
	{
		this.ms_file.create(0x00,0644);
	}

	/* Make a file to prepare */
	this.movie_prepare_file = prefs.getComplexValue("save_path", Ci.nsILocalFile);
	this.movie_prepare_file.append(this.file_title+'.'+this.type);
	if(this.movie_prepare_file.exists())
	{
		/* FIXME: there should have some other way to fix the conflict */
		var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
		              .getService(Ci.nsIPromptService);
		prompts.alert(null, strings.getString('errorTitle'), 'The video file exists.');
	        this.callback('fail',{});
		return;
	}
	else
	{
		this.movie_prepare_file.create(0x00,0644);
	}

	/* Part file is what we will truly store the video download */
	this.movie_file = prefs.getComplexValue("save_path", Ci.nsILocalFile);
	this.movie_file.append(this.file_title+'.'+this.type+'.part');
	if(this.movie_file.exists())
	{
		/* FIXME: there should have some other way to fix the conflict */
		var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
		              .getService(Ci.nsIPromptService);
		prompts.alert(null, strings.getString('errorTitle'), 'The temp video file exists.');
	        this.callback('fail',{});
		return;
	}
	else
	{
		this.movie_file.create(0x00,0644);
	}
	this.callback('file_ready', {video_file: this.movie_prepare_file.path, comment_file: this.ms_file.path, video_type: this.type, video_economy: this.economy});

	/* Referrer is what will be used twice */
	var ref_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).
					newURI('http://www.nicovideo.jp/flvplayer.swf?ts='+params.thread_id, null, null);

	/********************************************* XML COMMENT GET *********************************************/

	/* Don't waste time */
	if (this.canceled) { return; }

	/* Getting the comment will need to send some POST header */

	var ms_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(params.ms, null, null);

	post_header = '<packet>'+
	'<thread click_revision="0" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.thread_id+'"/>'+
	'</packet>';

	var post_stream = Cc["@mozilla.org/io/string-input-stream;1"]
		          .createInstance(Ci.nsIStringInputStream);
	if ("data" in post_stream) // Gecko 1.9 or newer
		post_stream.data = post_header;
	else // 1.8 or older
		post_stream.setData(post_header, post_header.length);

	var post_data = Cc["@mozilla.org/network/mime-input-stream;1"]
			.createInstance(Ci.nsIMIMEInputStream);

	post_data.addHeader("Content-Type", "application/x-www-form-urlencoded");
	post_data.addContentLength = true;
	post_data.setData(post_stream);


	this.persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
	var flags =  Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_FROM_CACHE;
	this.persist.persistFlags = flags; 

	if (prefs.getBoolPref('boon_comment'))
	{
		var _this = this;
		this.persist.progressListener =
		{
		addBoonComment: hitchFunction(_this, 'addBoonComment'),
		onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus)
		{
			if (aStateFlags & 16) /* STATE_STOP = 16 */
			{
				this.addBoonComment();
			}
		},
		onProgressChange: function (aWebProgress, aRequest,
		                            aCurSelfProgress, aMaxSelfProgress,
		                            aCurTotalProgress, aMaxTotalProgress)
		{},

		onLocationChange: function (aWebProgress, aRequest, aLocation) {},
		onStatusChange  : function (aWebProgress, aRequest, aStatus, aMessage) {},
		onSecurityChange: function (aWebProgress, aRequest, aState) {},

		};
	}
	this.persist.saveURI(ms_uri, null, ref_uri, post_data, null, this.ms_file);
	/********************************************* VIDEO GET *********************************************/

	/* Don't waste time */
	if (this.canceled) { return; }

	//new obj_URI object
	var movie_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(params.url, null, null);

	this.persist2 = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].
	                createInstance(Ci.nsIWebBrowserPersist);

        var flags =  Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE;
        this.persist2.persistFlags = flags; 

	/* We need a listener to watch the download progress */
	listener = {
	/* A dirty way */
	downloaderCallback: function(){}, 
	stopCallback: function(){},

	onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus)
	{
		if (aStateFlags & 1) /* STATE_START = 1 */
		{
			this.downloaderCallback('start', {});
		}
		if (aStateFlags & 16) /* STATE_STOP = 16 */
		{
			this.downloaderCallback('stop', {});
		}
	},
	onProgressChange: function (aWebProgress, aRequest,
	                            aCurSelfProgress, aMaxSelfProgress,
	                            aCurTotalProgress, aMaxTotalProgress)
	{
		this.downloaderCallback('progress_change', {current: aCurSelfProgress, max: aMaxSelfProgress});
	},
	onLocationChange: function (aWebProgress, aRequest, aLocation) {},
	onStatusChange  : function (aWebProgress, aRequest, aStatus, aMessage) {},
	onSecurityChange: function (aWebProgress, aRequest, aState) {},
	};

	listener.downloaderCallback = this.callback;
	this.persist2.progressListener = listener;
	this.persist2.saveURI(movie_uri, null, ref_uri, null, null, this.movie_file);

},

failDownload: function(req)
{
	var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
	              .getService(Ci.nsIPromptService);
	prompts.alert(null, 'Download failed', 'Cannot render the API/page to get the download location.');
        this.callback('fail',{});
},
/* Cancel by download manager action */
cancel: function()
{
	/* Prevent comment file deleted while updating Boon comments */
	if (this.ms_lock == true) { window.setTimeout(hitchFunction(this, 'cancel')); return; } 

	if(this.persist != undefined)
	{
		this.persist.cancelSave();
	}
	if(this.persist2 != undefined)
	{
		this.persist2.cancelSave();
	}
	this.removeFiles();

	this.canceled = true;
        this.callback('cancel',{});
},
/* Remove all downloaded files */
removeFiles: function()
{
	/* Remove files */
	if (this.ms_file != undefined)	this.ms_file.remove(false);
	if (this.movie_file != undefined) this.movie_file.remove(false);
	if (this.movie_prepare_file != undefined) this.movie_prepare_file.remove(false);
},
/* Add <!--BoonSutazioData=Video.v --> to file, make BOON Player have ability to update */
addBoonComment: function()
{
	this.ms_lock = true;
	var xml_contents = "";
	var charset = 'UTF-8';
	var fistream = Cc["@mozilla.org/network/file-input-stream;1"]
	             .createInstance(Ci.nsIFileInputStream);
	fistream.init(this.ms_file, -1, 0, 0);
	var is = Cc["@mozilla.org/intl/converter-input-stream;1"]
	        .createInstance(Ci.nsIConverterInputStream);
	is.init(fistream, charset, 1024, 0xFFFD);

	/* FIXME: Should we have a process of error prevent? */
	if (!(is instanceof Components.interfaces.nsIUnicharLineInputStream)) { return; }

	var line = {};
	var lines = [];
	var first_line = true;
	var no_eof;
	do {
		no_eof = is.readLine(line);
		if(first_line)
		{
			/* We will only replace the first line */
			line.value = line.value.replace(/^(<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>)/, "$1"+'<!-- BoonSutazioData='+this.comment_id+' -->');
			first_line = false;
		}
		lines.push(line.value);
	} while (no_eof)
	
	is.close();
	fistream.close();

	/* Write back to XML file */
	var fostream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                         .createInstance(Components.interfaces.nsIFileOutputStream);

	fostream.init(this.ms_file, 0x02 | 0x08 | 0x20, 0666, 0); 

	var os = Cc["@mozilla.org/intl/converter-output-stream;1"]
	         .createInstance(Ci.nsIConverterOutputStream);

	os.init(fostream, charset, 0, 0x0000);

	for(i=0; i<lines.length; i++)
	{
		os.writeString(lines[i]+"\n");
	}
	os.close();
	fostream.close();
	this.ms_lock = false;
},
};
