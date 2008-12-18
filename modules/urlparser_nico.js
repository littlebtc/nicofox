var EXPORTED_SYMBOLS = ['nicoFoxUrlParser'];
Components.utils.import('resource://nicofox/common.js');

function nicoFoxUrlParser()
{

}

nicoFoxUrlParser.prototype = {

  /* Received the AJAX request from the video page */
  parseVideoPage: function(req)
  {	
    html = req.responseText;
    /* fetch v and id parameter in javascript array 'Video'. The regex is dirty but can be easily understood! */
    reg_array = html.match(/<script type\=\"text\/javascript\">\s+<!--\s+var Video = \{([\s\S]*)\}\;\s+-->\s+<\/script>/);
    if(!reg_array) {
       this.return_to(false); return;
    }

    /* Use sandbox for security */
    var s = Components.utils.Sandbox("about:blank");                         
    Components.utils.evalInSandbox('var Video = {'+reg_array[1]+'}', s);
    if (typeof s.Video != "object") {
      this.return_to(false); return;
    }
    this.Video = s.Video;

    /* Test if this is a community video */
    var community_test = html.match(/<a class=\"community\" href=\"http\:\/\/ch\.nicovideo\.jp\/(community|channel)\/([a-z]{0,2}[0-9]+)\">[^<]*<\/a>/i);
    if (community_test) {
      this.Video.comment_type = community_test[1];
    }
    /* If not, Distinguish what type of comment we will download */
    else if (this.Video.isMymemory) {
      this.Video.comment_type = 'mymemory' + this.comment;
    } else if (!this.site_comment) {
      this.Video.comment_type = 'comment' + this.comment;
    } else {
      this.Video.comment_type = this.comment;
    }


    /* Is there any uploader's comment? */
    this.Video.uploder_comment = false;	
    if (html.match(/<script type=\"text\/javascript\"><!--[^<]*so\.addVariable\(\"has_owner_thread\"\, \"1\"\)\;[^<]*<\/script>*/)) {
      this.Video.uploader_comment = true;
    }
    /* Call the func */
    this.return_to(this.Video);
  },

	goParse: function(url) 
	{
		this.status = 0;
		if (!url.match(/^http:\/\/(www|tw|es|de)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+$/))
		{
			return false;
		}

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
		goAjax(url, 'GET', hitchFunction(this, 'parseVideoPage'), hitchFunction(this, 'failDownload'));

		return true;
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


