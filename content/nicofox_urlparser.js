
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
		if(!reg_array)
		{
			this.return_to(false); return;
		}
                /* Use sandbox for security */
                var native_json = Components.classes["@mozilla.org/dom/json;1"]
                                 .createInstance(Components.interfaces.nsIJSON);
                var s = Components.utils.Sandbox("about:blank");                         
                Components.utils.evalInSandbox('var Video = {'+reg_array[1]+'}', s);
                if (typeof s.Video != "object")
                {
                        this.return_to(false); return;
                }
                this.Video = s.Video;

		/* Distinguish what type of comment we will download */
		if (this.Video.isMymemory)
		{
			this.Video.comment_type = 'mymemory' + this.comment;
		}
		else if (!this.site_comment)
		{
			this.Video.comment_type = 'comment' + this.comment;
		}
		else
		{
			this.Video.comment_type = this.comment;
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

		test1 = nicofox.matchWatchCommentUrl(url);
		test2 = nicofox.matchWatchUrl(url);
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

};


