
var Cc = Components.classes;
var Ci = Components.interfaces;
var EXPORTED_SYMBOLS = ['smileFoxDownloader', 'hitchFunction', 'goAjax'];

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

var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
              .getService(Ci.nsIPromptService);

function goAjax(url, type, funcok, funcerr, post_data)
{
  var http_request;

  http_request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
               .createInstance(Components.interfaces.nsIXMLHttpRequest);

  var key;
  var data = '';
  if (type == 'POST') {
    /* Set POST parameters */
    for (key in post_data) {
      data += escape(key)+'='+escape(post_data[key])+'&';
    }
  }
  else {
    type = 'GET';
  }

  http_request.onreadystatechange = function() {
    if (http_request.readyState == 4) {
      if (http_request.status == 200) {
       funcok(http_request);
      } else {
        funcerr(http_request);
      }
    }
  };

  http_request.open(type, url, true);
  if (type == 'POST') {
    http_request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
  }  
  http_request.send(data);
  /* For safety? */
  data = '';
  post_data = {};
}

/* AJAX work will require some dirty way to call function
   The idea is from GM_hitch @ Greasemoneky and it is almost the same ||| */
function hitchFunction(object, name) {
  if(!object || !object[name]) { return function(){}; }
  var args = Array.prototype.slice.call(arguments, 2);

  /* What a dirty way! */
  dirty_function =  function() {
    /* Combine the argument */
    var args_inner = Array.prototype.slice.call(arguments);
    args_inner = args_inner.concat(args);

    /* Then hit the function */
    object[name].apply(object, args_inner);
  }
  return dirty_function;
}


function smileFoxDownloader()
{

}

smileFoxDownloader.prototype = {
  download_comment: prefs.getBoolPref('download_comment'),
  canceled: false,
  ms_lock: false,
  login_trial: false,
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
        hitchFunction(this, 'nicoLogin')();
        return;
      }
      prompts.alert(null, strings.getString('errorTitle'), strings.getString('errorParseFailed'));
      this.callback('fail',{});
      return;
    }
    goAjax('http://www.nicovideo.jp/api/getflv?v='+this.comment_id, 'GET', hitchFunction(this, 'parseDownload') , hitchFunction(this, 'failParse'));
  },

  /* Autologin, asking info from Password Manager 
     FIXME: Why not build a standalone password system? */
  nicoLogin: function() {
    var username = prefs.getComplexValue('autologin_username', Ci.nsISupportsString).data;
    var password = '';

    var login_manager = Cc["@mozilla.org/login-manager;1"]
                         .getService(Ci.nsILoginManager);

    /* Nico uses secure.nicovideo.jp for login */
    var logins = login_manager.findLogins({}, 'http://www.nicovideo.jp', 'https://secure.nicovideo.jp', null);
    var login = null;

    /* Access password manager */
    for (var i = 0; i < logins.length; i++)
    {
      if (username == logins[i].username)
      { login = logins[i]; }
    }
    if (!login) {
      prompts.alert(null, strings.getString('errorTitle'), 'Can\'t find password found in Password Manager. Failed.');
    }

    /* Prepare data, go autologin! */
    var post_data = {};
    post_data[login.usernameField] = login.username;
    post_data[login.passwordField] = login.password;

    this.login_trial = true;
    /* We don't need a XMLHttpRequest to be resent to init, so ... */
    goAjax('https://secure.nicovideo.jp/secure/login?site=niconico', 'POST', hitchFunction(this, 'retry') , hitchFunction(this, 'failParse'), post_data) ;

    /* Recycle instantly for security */
    login = {};
    logins = {};
    post_data = {};
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
    if (!this.download_comment)
    {
      this.callback('completed', {});
      return;
    }

    var ref_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService)
                  .newURI('http://www.nicovideo.jp/flvplayer.swf?ts='+params.thread_id, null, null);


    /* Getting the comment will need to send some POST header */
    var ms_uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(params.ms, null, null);

    post_header = '<packet>'+
    '<thread click_revision="0" user_id="'+params.user_id+'" res_from="-1000" version="20061206" thread="'+params.thread_id+'"/>'+
    '</packet>';

    var post_stream = Cc["@mozilla.org/io/string-input-stream;1"]
                     .createInstance(Ci.nsIStringInputStream);
    if ("data" in post_stream) // Gecko 1.9 or newer
    { post_stream.data = post_header; }
    else // 1.8 or older
    { post_stream.setData(post_header, post_header.length); }

    var post_data = Cc["@mozilla.org/network/mime-input-stream;1"]
                   .createInstance(Ci.nsIMIMEInputStream);
  
    post_data.addHeader("Content-Type", "application/x-www-form-urlencoded");
    post_data.addContentLength = true;
    post_data.setData(post_stream);

    this.persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);
    var flags =  Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES |
                 Ci.nsIWebBrowserPersist.PERSIST_FLAGS_BYPASS_CACHE;
    this.persist.persistFlags = flags; 

    var boon_comment_set = prefs.getBoolPref('boon_comment'); 
    var _this = this;
    this.persist.progressListener = {
      downloaderCallback: this.callback,
      boon_comment_set: boon_comment_set,
      addBoonComment: hitchFunction(_this, 'addBoonComment'),
      onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
        if (aStateFlags & 16) /* STATE_STOP = 16 */ {
          if (this.boon_comment_set) this.addBoonComment();
          this.downloaderCallback('completed', {});
        }
      },
      onProgressChange: function (aWebProgress, aRequest,
                                  aCurSelfProgress, aMaxSelfProgress,
                                  aCurTotalProgress, aMaxTotalProgress) {},
      onLocationChange: function (aWebProgress, aRequest, aLocation) {},
      onStatusChange  : function (aWebProgress, aRequest, aStatus, aMessage) {},
      onSecurityChange: function (aWebProgress, aRequest, aState) {},
    };
    /* Don't waste time */
    if (this.canceled) { return; }

    this.persist.saveURI(ms_uri, null, ref_uri, post_data, null, this.ms_file);
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
  },

  /* Cancel by download manager action */
  cancel: function() {
    this.canceled = true;
    this.callback('cancel',{});

    if(this.persist != undefined) {
      this.persist.cancelSave();
    }
    this.removeFiles();

  },

  /* Remove all downloaded files */
  removeFiles: function() {
    /* Remove files */
    if (this.ms_file != undefined)	this.ms_file.remove(false);
    if (this.movie_file != undefined) this.movie_file.remove(false);
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
