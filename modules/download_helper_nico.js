
var Cc = Components.classes;
var Ci = Components.interfaces;
var EXPORTED_SYMBOLS = ['nicofox'];

Components.utils.import('resource://nicofox/common.js');

var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
              .getService(Ci.nsIPromptService);
/* Multiple downloads helper, for simultaneously handle multiple persist without progress checking 
   XXX: file checks
*/
if (!nicofox) { var nicofox = {}; }
if (!nicofox.download) { nicofox.download = {}; }
if (!nicofox.download.helper) { nicofox.download.helper = {}; }

nicofox.download.helper.nico = function() { };
nicofox.download.helper.nico.prototype = {
  download_comment: false,
  canceled: false,
  ms_lock: false,
  login_trial: false,
  uploader_comment: false,
  download_helper: null,
  init: function(comment_id) {
    this.download_comment = nicofox.prefs.getBoolPref('download_comment');
    /* Save it to the object */
    this.comment_id = comment_id;

    /* Operator friendly? 403 Workaround? */
    nicofox.goAjax('http://www.nicovideo.jp/watch/'+comment_id, 'GET', nicofox.hitch(this, 'goParse') , nicofox.hitch(this, 'failParse'));
  },
 
  goParse: function(req) {
    /* Don't waste time */
    if (this.canceled) { return; }

    html = req.responseText;
    reg_array = html.match(/<script type\=\"text\/javascript\">\s+<!--\s+var Video = \{([\s\S]*)\}\;\s+-->\s+<\/script>/);
    if(!reg_array)
    {
      /* Try autologin */
      if (!this.login_trial && nicofox.prefs.getComplexValue('autologin_username', Ci.nsISupportsString).data) {
        nicofox.nicoLogin(nicofox.hitch(this, 'retry'), nicofox.hitch(this, 'failParse'));
	this.login_trial = true;
        return;
      }
      prompts.alert(null, nicofox.strings.getString('errorTitle'), nicofox.strings.getString('errorParseFailed'));
      this.callback('fail',{});
      return;
    }
    /* Is there any uploader's comment? */
    this.uploder_comment = false;	
    if (html.match(/<script type=\"text\/javascript\"><!--[^<]*so\.addVariable\(\"has_owner_thread\"\, \"1\"\)\;[^<]*<\/script>*/)
    && nicofox.prefs.getBoolPref('uploader_comment')) {
      this.uploader_comment = true;
    }

    nicofox.goAjax('http://www.nicovideo.jp/api/getflv?v='+this.comment_id, 'GET', nicofox.hitch(this, 'parseGetFlv') , nicofox.hitch(this, 'failParse'));
  },

  retry: function(req) {
    /* Retry after autologin */
    nicofox.goAjax('http://www.nicovideo.jp/watch/'+this.comment_id, 'GET', nicofox.hitch(this, 'goParse') , nicofox.hitch(this, 'failParse'));
  },
  parseGetFlv: function(req) {
    /* Don't waste time */
    if (this.canceled) { return; }

    /* take out the result query string */
    var api_out = req.responseText;
    var api_params = api_out.split('&');

    var params = new Object();
    for (i=0; i < api_params.length; i++) {
      var array = api_params[i].split('=');
      var key = array[0];
      var value = decodeURIComponent(array[1]);
      params[key] = value;
    }

    /* :( for channel videos */
    if (params.needs_key) {
      nicofox.goAjax('http://www.nicovideo.jp/api/getthreadkey?thread='+this.comment_id+'&ts='+new Date().getTime(),  'GET',
      nicofox.hitch(this, 'parseThreadKey', params) , nicofox.hitch(this, 'failParse')); 
    } else {
      this.goDownload(params);
    }
  },
  parseThreadKey: function(req, params) {
    /* Don't waste time */
    if (this.canceled) { return; }

    /* take out the result query string */
    var api_out = req.responseText;
    var api_params = api_out.split('&');

    for (i=0; i < api_params.length; i++) {
      var array = api_params[i].split('=');
      var key = array[0];
      var value = decodeURIComponent(array[1]);
      params[key] = value;
    }

    this.goDownload(params);
  },
  goDownload: function(params) {
    /* Distinguish Economy mode */
    if (params.url.match(/low$/)) {
      this.economy = true; 

      if (nicofox.prefs.getIntPref('economy') == 1) {
        this.callback('economy_break',{});
        return;
      }	
    } else {
      this.economy = false;
      /* It has been a economy but now it's not! */
      if (this.has_economy) {
        this.callback('economy_off',{});
      }
    }
    
    /* Distinguish what type of video we will download */
    if (params.url.match(/smile\?s\=/)) /* SWF from Nico Nico Movie Maker */
    { this.type = 'swf'; }
    else if (params.url.match(/smile\?m\=/)) /* H.264 mp4 */
    { this.type = 'mp4'; }
    else /* maybe FLV */
    { this.type = 'flv'; }
    
    /* Don't waste time */
    if (this.canceled) { return; }
   
    if (this.download_comment) {
      /* Prepare target file */
      this.ms_file = nicofox.prefs.getComplexValue("save_path", Ci.nsILocalFile);
      this.ms_file.append(this.file_title + '.xml');
      
      if(this.ms_file.exists()) {
        /* FIXME: there should have some other way to fix the conflict */
        var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                     .getService(Ci.nsIPromptService);
        prompts.alert(null, nicofox.strings.getString('errorTitle'), 'The XML comment file exists.');
        this.callback('fail2',{});
        return;
      }	
    }
    /* Prepare target file */
    if (this.uploader_comment) {
      this.ms_file2 = nicofox.prefs.getComplexValue("save_path", Ci.nsILocalFile);
      this.ms_file2.append(this.file_title + '[Owner].xml');
    
      if(this.ms_file2.exists()) {
        /* FIXME: there should have some other way to fix the conflict */
        var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                     .getService(Ci.nsIPromptService);
        prompts.alert(null, nicofox.strings.getString('errorTitle'), 'The XML comment file exists.');
        this.callback('fail2',{});
        return;
      }	
    }
    
    /* Make a file to prepare */
    this.movie_prepare_file = nicofox.prefs.getComplexValue("save_path", Ci.nsILocalFile);
    this.movie_prepare_file.append(this.file_title+'.'+this.type);
    if(this.movie_prepare_file.exists())
    {
      /* FIXME: there should have some other way to fix the conflict */
      var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Ci.nsIPromptService);
      prompts.alert(null, nicofox.strings.getString('errorTitle'), 'The video file exists.');
      this.callback('fail2',{});
      return;
    }

    /* Part file is what we will truly store the video download */
    this.movie_file = nicofox.prefs.getComplexValue("save_path", Ci.nsILocalFile);
    this.movie_file.append(this.file_title+'.'+this.type+'.part');
    if(this.movie_file.exists())
    {
      /* FIXME: there should have some other way to fix the conflict */
      var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                   .getService(Ci.nsIPromptService);
      prompts.alert(null, nicofox.strings.getString('errorTitle'), 'The temp video file exists.');
      this.callback('fail2',{});
      return;
    }
    /* Now create our file */
    this.movie_prepare_file.create(0x00,0644);
    this.movie_file.create(0x00,0644);
    if(this.download_comment) { this.ms_file.create(0x00,0644); }
    if(this.uploader_comment) { this.ms_file2.create(0x00,0644); }

    if (this.ms_file) {
      this.callback('file_ready', {video_file: this.movie_prepare_file.path, comment_file: this.ms_file.path, video_type: this.type, video_economy: this.economy}); 
    } else {
      this.callback('file_ready', {video_file: this.movie_prepare_file.path, comment_file: '', video_type: this.type, video_economy: this.economy});
    }      
    this.getVideo(params);
  },

  getVideo: function(params) {
    var ref_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
                  .newURI('http://www.nicovideo.jp/flvplayer.swf?ts='+params.thread_id, null, null);

    /* Don't waste time */
    if (this.canceled) { return; }

    /* Make URI and cache key */
    var movie_uri = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService).newURI(params.url, null, null);

    //var cache_key = Cc['@mozilla.org/supports-string;1']
    //                .createInstance(Ci.nsISupportsString);
    //cache_key.data = params.url;
    //cache_key = null;

    this.persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].
                    createInstance(Ci.nsIWebBrowserPersist);

    var flags =  Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    if (nicofox.prefs.getBoolPref('video_bypass_cache')) {
      flags = flags | Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE; 
    }
    this.persist.persistFlags = flags; 

    /* We need a listener to watch the download progress */
    var listener = {
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
	  if (aStatus != 0) { this.downloaderCallback('video_fail', {}) } /* NS_OK = 0 */
          this.downloaderCallback('video_done', {});
          this.stopCallback();
        }
      },
      onProgressChange: function (aWebProgress, aRequest,
                                 aCurSelfProgress, aMaxSelfProgress,
                                 aCurTotalProgress, aMaxTotalProgress)
      {
        this.downloaderCallback('progress_change', {current_bytes: aCurSelfProgress, max_bytes: aMaxSelfProgress});
      },
      onLocationChange: function (aWebProgress, aRequest, aLocation) {},
      onStatusChange  : function (aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange: function (aWebProgress, aRequest, aState) {},
    };

    listener.downloaderCallback = this.callback;
    listener.stopCallback = nicofox.hitch(this, 'getComments', params);
    this.persist.progressListener = listener;
    this.persist.saveURI(movie_uri, null, ref_uri, null, null, this.movie_file);

  },
  getComments: function(params) {
    if (this.canceled) {
      return;
    }
    if (!this.download_comment)
    {
      this.callback('completed', {});
      return;
    }

    if (params.needs_key) {
      var post_header = '<packet>'+
      '<thread click_revision="0" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.optional_thread_id+'"/>'+
      '<thread force_184="'+params.force_184+'" threadkey="'+params.threadkey+'" click_revision="0" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.thread_id+'"/>'+
      '</packet>';
      var owner_post_header = 
      '<thread click_revision="0" fork="1" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.optional_thread_id+'"/>';
    } else {
      var post_header = '<packet>'+
      '<thread click_revision="0" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.thread_id+'"/>'+
      '</packet>';
      var owner_post_header = 
      '<thread click_revision="0" fork="1" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.thread_id+'"/>';
    }
    this.download_helper = new nicofox.download.helper.multiple();
    this.download_helper.doneCallback = nicofox.hitch(this, 'callback', 'completed', {});
    this.download_helper.addDownload(params.ms, null , post_header, this.ms_file, true, nicofox.hitch(this, 'processNicoComment', params));
    if(this.uploader_comment) {
      this.download_helper.addDownload(params.ms, null , owner_post_header, this.ms_file2, true, function() {});
    }
    this.download_helper.goAhead();
  },


  failParse: function(req)
  {
    var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                 .getService(Ci.nsIPromptService);
    prompts.alert(null, 'Download failed', 'Cannot render the API/page to get the download location.');
    this.callback('fail',{});
  },
 
  /* Unexpectedly failed */
  fail: function() {
    this.canceled = true;
    this.callback('fail',{});
    
    if(this.persist != undefined) {
      this.persist.cancelSave();
    }
    this.removeFiles();
    if (this.download_helper) {
      this.download_helper.cancelAll();
    }
  },

  /* Cancel by download manager action */
  cancel: function() {
    this.canceled = true;
    this.callback('cancel',{});

    if(this.persist != undefined) {
      this.persist.cancelSave();
    }
    this.removeFiles();
    if (this.download_helper) {
      this.download_helper.cancelAll();
    }

  },

  /* Remove all downloaded files */
  removeFiles: function() {
    /* Remove files */
    if (this.movie_file != undefined) this.movie_file.remove(false);
    if (this.ms_file != undefined) this.ms_file.remove(false);
    if (this.ms_file2 != undefined) this.ms_file2.remove(false);
    if (this.movie_prepare_file != undefined) this.movie_prepare_file.remove(false);
  },

  /* Add <!--BoonSutazioData=Video.v --> to file, make BOON Player have ability to update; filter replace support */
  processNicoComment: function(params)
  {
    if (this.cancelled) { return; }
    var boon_comment = nicofox.prefs.getBoolPref('boon_comment');
    var replace_filters = nicofox.prefs.getBoolPref('replace_filters'); 
    if (!boon_comment && !replace_filters) { return; }

    if (replace_filters && params.ng_up) {
      var ng_ups = params.ng_up.split('&');

      var filter_matches = [];
      var filter_strings = [];
      var filter_replaces = [];
      for (var i = 0; i < ng_ups.length; i++) {
        var array = ng_ups[i].split('=');
	var target = decodeURIComponent(array[0]).replace(/([\\\^\$\*\+\?\.\(\)\:\?\=\!\|\{\}\,\[\]])/g, '\\$1');
	var match = new RegExp(target, 'g'); // Case-sensitive
	filter_strings.push(decodeURIComponent(array[0]));
        filter_matches.push(match);
        filter_replaces.push(decodeURIComponent(array[1]));
      }
    }

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
    var xml_string = '';
    var first_line = true;
    var no_eof;
    do {
      no_eof = is.readLine(line);
      if(first_line) {
        /* For E4X Parsing, we will need partial of the first line */
        first_line = false;
	line.value = line.value.replace(/^(<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>)/, '');
      }

      xml_string = xml_string + line.value + "\n";
    } while (no_eof)
    	
    is.close();
    fistream.close();

var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
              .getService(Ci.nsIPromptService);

    if (replace_filters && params.ng_up) {

      /* Go E4X and filter */
      var xml_e4x = new XML(xml_string);
      if (xml_e4x.chat) {
        for (var i = 0; i < xml_e4x.chat.length(); i++) {
          for (var j = 0; j < filter_strings.length; j++) {
	    if (xml_e4x.chat[i].toString().indexOf(filter_strings[j]) != -1) {
              xml_e4x.chat[i] = xml_e4x.chat[i].toString().replace(filter_matches[j], filter_replaces[j]);
	    }  
          }  
        }
      }
      xml_string = xml_e4x.toXMLString();
    }  
    /* Write back to XML file */
    var fostream = Cc["@mozilla.org/network/file-output-stream;1"]
                   .createInstance(Components.interfaces.nsIFileOutputStream);

    fostream.init(this.ms_file, 0x02 | 0x08 | 0x20, 0666, 0); 

    var os = Cc["@mozilla.org/intl/converter-output-stream;1"]
             .createInstance(Ci.nsIConverterOutputStream);

    os.init(fostream, charset, 0, 0x0000);
    if (boon_comment) {
      os.writeString('<?xml version="1.0" encoding="UTF-8"?><!-- BoonSutazioData='+this.comment_id+' -->'+"\n");
    } else {
      os.writeString('<?xml version="1.0" encoding="UTF-8"?>'+"\n");
    }
    os.writeString(xml_string);
    os.close();
    fostream.close();
    this.ms_lock = false;
  },

};
