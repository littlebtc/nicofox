var EXPORTED_SYMBOLS = ['nicofox'];
Components.utils.import('resource://nicofox/common.js');

var Cc = Components.classes;
var Ci = Components.interfaces;
if(!nicofox) { var nicofox = {}; }
if(!nicofox.parser) { nicofox.parser = {}; }

nicofox.parser.nico = function () { }

nicofox.parser.nico.prototype = {
  login_trial: false,
  url: '',
  video: {},
  goParse: function(url) 
  {
    this.url = url;

    test1 = this.matchWatchCommentUrl(url);
    test2 = this.matchWatchUrl(url);
    if (test1)
    {
      this.site_comment = false;
      this.comment = test1[2];
    }
    else
    {
      this.site_comment = true;
      this.comment = test2[1];
    }

    /* Download the watch page (something like my memory / Taiwan ver. should use this) */
    nicofox.goAjax(url, 'GET', nicofox.hitch(this, 'parseVideoPage'), nicofox.hitch(this, 'failDownload'));
    return true;
  },
  /* Received the AJAX request from the video page */
  parseVideoPage: function(req)
  {  
    html = req.responseText;
    /* fetch v and id parameter in javascript array 'Video'. The regex is dirty but can be easily understood! */
    reg_array = html.match(/<script type\=\"text\/javascript\">\s?(<!--)?\s+var Video = \{([\s\S]*)\}\;\s+(-->)?\s?<\/script>/);
    if(!reg_array) {
      /* Try autologin */
      if (!this.login_trial && nicofox.prefs.getComplexValue('autologin_username', Ci.nsISupportsString).data) {
        nicofox.nicoLogin(nicofox.hitch(this, 'retry'), nicofox.hitch(this, 'failLogin'));
  this.login_trial = true;
        return;
      }
      this.return_to(false); return;
    }

    /* Use sandbox for security */
    var s = Components.utils.Sandbox("about:blank");                         
    Components.utils.evalInSandbox('var Video = {'+reg_array[2]+'}', s);
    if (typeof s.Video != "object") {
      this.return_to(false); return;
    }
    this.Video = s.Video;

    /* Test if this is a community video */
    var community_test = html.match(/<img alt=\"([^\"]*)\" src=\"http\:\/\/icon\.nicovideo\.jp\/(community|channel)\/([a-z]{0,2}[0-9]+)\.jpg\?[0-9]+\" class=\"comm\_img\_S\">/i);

    if (community_test) {
      this.Video.comment_type = community_test[3];
      this.Video.community_name = community_test[1];
    }
    /* If not, Distinguish what type of comment we will download */
    else if (this.Video.isMymemory) {
      this.Video.comment_type = 'mymemory' + this.comment;
    } else if (!this.site_comment) {
      this.Video.comment_type = 'comment' + this.comment;
    } else {
      this.Video.comment_type = this.comment;
    }

    this.Video.site = 'nico';
    /* Call the func */
    this.return_to(this.Video);
  },
  retry: function(req) {
    this.goParse(this.url);
  },
  failLogin: function(req) {
    this.return_to(false);
  },
  
  failDownload: function(req)
  {
    this.return_to(false);
  },
  matchWatchUrl: function(url)
  {
    return url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([a-z]{0,2}[0-9]+)$/);
  },

  matchWatchCommentUrl: function(url)
  {
    return url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([0-9]+)$/);
  },

  matchWatchVideoUrl: function(url)
  {
    return url.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([a-z]{2}[0-9]+)$/);
  },
};


