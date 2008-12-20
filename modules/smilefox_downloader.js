
var Cc = Components.classes;
var Ci = Components.interfaces;
var EXPORTED_SYMBOLS = ['smileFoxDownloader'];

var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.nicofox.");

var bundle_service = Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService);
var strings = 
{
  bundle: null, 
  init: function() {
   this.bundle = bundle_service.createBundle('chrome://nicofox/locale/nicofox.properties');
  }, 
  getString: function(str) {
    if (this.bundle === null) this.init();
    return this.bundle.GetStringFromName(str);
  }

}
Components.utils.import('resource://nicofox/common.js');

var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
              .getService(Ci.nsIPromptService);
/* Multiple downloads helper, for simultaneously handle multiple persist without progress checking 
   XXX: file checks
*/
function multipleDownloadsHelper() { }
multipleDownloadsHelper.prototype = {
  persists: [],
  files: [],
  adding: true,
  download_count: 0,
  doneCallback: function() {},
  /* Add a download. NOTE: file should be a nsIFile, not a string!! */
  addDownload: function(dl_url, referrer, post_string, file, bypass_cache, single_callback) {
    this.download_count++;
    if (referrer) {
      var ref_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
                    .newURI(referrer, null, null);
    } else {
      var ref_uri = null;
    }
    var dl_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(dl_url, null, null);

    /* POST header processing */
    if (post_string) { 
      var post_stream = Cc["@mozilla.org/io/string-input-stream;1"]
                       .createInstance(Ci.nsIStringInputStream);
      post_stream.setData(post_string, post_string.length); // NicoFox 0.3+ support Gecko/XULRunner 1.9+ only

      var post_data = Cc["@mozilla.org/network/mime-input-stream;1"]
                     .createInstance(Ci.nsIMIMEInputStream);
  
      post_data.addHeader("Content-Type", "application/x-www-form-urlencoded");
      post_data.addContentLength = true;
      post_data.setData(post_stream);
    } else {
      post_data = null;
    }
    var persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
    var flags =  Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    if (bypass_cache) {
      flags = flags | Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE;
    }  
    persist.persistFlags = flags; 

    if (!single_callback || typeof single_callback != 'function') {
      single_callback = function() {};
    } 
    var _this = this;
    persist.progressListener = {
      callback: single_callback,
      onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
        if (aStateFlags & 16) /* STATE_STOP = 16 */ {
	  this.callback();
	  hitchFunction(_this, 'completeDownload')();
        }
      },
      onProgressChange: function (aWebProgress, aRequest,
                                  aCurSelfProgress, aMaxSelfProgress,
                                  aCurTotalProgress, aMaxTotalProgress) {},
      onLocationChange: function (aWebProgress, aRequest, aLocation) {},
      onStatusChange  : function (aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange: function (aWebProgress, aRequest, aState) {},
    };

    persist.saveURI(dl_uri, null, ref_uri, post_data, null, file);
    this.persists.push(persist);
  },
  goAhead: function() {
    this.adding = false;
    if (this.download_count == 0) {
      this.finalize();
    }
  },
  completeDownload: function() {
    this.download_count--;
    if (this.download_count == 0 && !this.adding) {
      this.finalize();
    }
  },
  finalize: function() {
    this.doneCallback();
  },
  cancelAll: function() {
   this.persists.forEach(function (element, index, array) {
     if (element) {
       array[index].cancelSave(); 
     }
   });
  }
}

function smileFoxDownloader() { }
smileFoxDownloader.prototype = {
  download_comment: prefs.getBoolPref('download_comment'),
  canceled: false,
  ms_lock: false,
  login_trial: false,
  uploader_comment: false,
  download_helper: null,
  init: function(comment_id) {
    /* Save it to the object */
    this.comment_id = comment_id;

    /* Operator friendly? 403 Workaround? */
    goAjax('http://www.nicovideo.jp/watch/'+comment_id, 'GET', hitchFunction(this, 'goParse') , hitchFunction(this, 'failParse'));
  },
 
  goParse: function(req) {
    /* Don't waste time */
    if (this.canceled) { return; }

    html = req.responseText;
    reg_array = html.match(/<script type\=\"text\/javascript\">\s+<!--\s+var Video = \{([\s\S]*)\}\;\s+-->\s+<\/script>/);
    if(!reg_array)
    {
      /* Try autologin */
      if (!this.login_trial && prefs.getComplexValue('autologin_username', Ci.nsISupportsString).data) {
        nicoLogin(hitchFunction(this, 'retry'), hitchFunction(this, 'failParse'));
	this.login_trial = true;
        return;
      }
      prompts.alert(null, strings.getString('errorTitle'), strings.getString('errorParseFailed'));
      this.callback('fail',{});
      return;
    }
    /* Is there any uploader's comment? */
    this.uploder_comment = false;	
    if (html.match(/<script type=\"text\/javascript\"><!--[^<]*so\.addVariable\(\"has_owner_thread\"\, \"1\"\)\;[^<]*<\/script>*/)) {
      this.uploader_comment = true;
    }

    goAjax('http://www.nicovideo.jp/api/getflv?v='+this.comment_id, 'GET', hitchFunction(this, 'parseDownload') , hitchFunction(this, 'failParse'));
  },

  retry: function(req) {
    /* Retry after autologin */
    goAjax('http://www.nicovideo.jp/watch/'+this.comment_id, 'GET', hitchFunction(this, 'goParse') , hitchFunction(this, 'failParse'));
  },
  parseDownload: function(req) {
    /* Don't waste time */
    if (this.canceled) { return; }

    /* take out the result query string */
    api_out = req.responseText;
    api_params = api_out.split('&');

    params = new Object();
    for (i=0; i < api_params.length; i++) {
      array = api_params[i].split('=');
      key = array[0];
      value = decodeURIComponent(array[1]);
      params[key] = value;
    }
 //   var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
//             .getService(Ci.nsIPromptService);
//    prompts.alert(null, 'NF', params.ng_up);
    /* Distinguish Economy mode */
    if (params.url.match(/low$/))
    { this.economy = true; }
    else
    { this.economy = false; }
    
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
      this.ms_file = prefs.getComplexValue("save_path", Ci.nsILocalFile);
      this.ms_file.append(this.file_title + '.xml');
      
      if(this.ms_file.exists()) {
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

      /* Prepare target file */
      if (this.uploader_comment) {
        this.ms_file2 = prefs.getComplexValue("save_path", Ci.nsILocalFile);
        this.ms_file2.append(this.file_title + '[Owner].xml');
      
        if(this.ms_file2.exists()) {
          /* FIXME: there should have some other way to fix the conflict */
          var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                       .getService(Ci.nsIPromptService);
          prompts.alert(null, strings.getString('errorTitle'), 'The XML comment file exists.');
          this.callback('fail',{});
          return;
        }	
        else
        {
          this.ms_file2.create(0x00,0644);
        }
      }
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
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE;
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
    listener.stopCallback = hitchFunction(this, 'getComments', params);
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

    var post_header = '<packet>'+
    '<thread click_revision="0" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.thread_id+'"/>'+
    '</packet>';

    var owner_post_header = 
    '<thread click_revision="0" fork="1" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.thread_id+'"/>';
    this.download_helper = new multipleDownloadsHelper();
    this.download_helper.doneCallback = hitchFunction(this, 'callback', 'completed', {});
    this.download_helper.addDownload(params.ms, null , post_header, this.ms_file, true, hitchFunction(this, 'addBoonComment'));
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

  /* Add <!--BoonSutazioData=Video.v --> to file, make BOON Player have ability to update */
  addBoonComment: function()
  {
    if (this.cancelled) { return; }
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
      if(first_line) {
        /* We will only replace the first line */
        line.value = line.value.replace(/^(<\?xml version=\"1.0\" encoding=\"UTF-8\"\?>)/, "$1"+'<!-- BoonSutazioData='+this.comment_id+' -->');
        first_line = false;
      }
      lines.push(line.value);
    } while (no_eof)
    	
    is.close();
    fistream.close();

    /* Write back to XML file */
    var fostream = Cc["@mozilla.org/network/file-output-stream;1"]
                   .createInstance(Components.interfaces.nsIFileOutputStream);

    fostream.init(this.ms_file, 0x02 | 0x08 | 0x20, 0666, 0); 

    var os = Cc["@mozilla.org/intl/converter-output-stream;1"]
             .createInstance(Ci.nsIConverterOutputStream);

    os.init(fostream, charset, 0, 0x0000);
    
    for(i = 0; i < lines.length; i++)
    {
      os.writeString(lines[i]+"\n");
    }
    os.close();
    fostream.close();
    this.ms_lock = false;
  },
};
