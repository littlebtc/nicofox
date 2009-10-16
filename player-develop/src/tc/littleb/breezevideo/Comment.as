package tc.littleb.breezevideo
{
	//import com.adobe.serialization.json.*;
	
	import flash.display.*;
	import flash.events.*;
	import flash.filters.*;
	import flash.geom.*;
	import flash.net.*;
	import flash.text.*;
	import flash.utils.*;
	
	import mx.core.*;
				
	public class Comment extends UIComponent
	{
		[Event(name = "commentReady")]

		private var _commentFile:String;
		private var _commentDisplayNum:int = -1;
		private var _commentNum:int = 0;
		
		private var _commentRequest:URLRequest;
		private var _commentList:Array;
		private var _commentDisplayList:Array;
		private var _commentXML:XML;
		
		private var _firstCommentIndex:int = -1;
		private var _lastCommentIndex:int = -1;
		private var _lastNakaCommentIndex:int = -1;

		private var _ueSprite:CommentSprite;
		private var _shitaSprite:CommentSprite;
		private var _nakaSprite:CommentSprite;

		private var _uic:UIComponent;

		private var _fileReadCompleted: Boolean = false;
		/* Indicate whether we should stop updating comments */
		public var _freezed:Boolean;
		
		// private var is_kavideo:Boolean;
		
		public function Comment()
		{	
			_freezed = false;
			//myapp = app;

			_nakaSprite = new CommentSprite('naka');
			_shitaSprite = new CommentSprite('shita');
			_ueSprite = new CommentSprite('ue');
			
			_uic = new UIComponent();
			_ueSprite.mask = generateMask();
			_shitaSprite.mask = generateMask();
			_nakaSprite.mask = generateMask();
			
			_uic.addChild(_ueSprite);
			_uic.addChild(_shitaSprite);
			_uic.addChild(_nakaSprite);
			//_nakaSprite.visible = false;
			this.addChild(_uic);
			//myapp.comment_container.addChild(uic);
			
		}
		/* Generate a mask for sprite */
		private function generateMask():Sprite {
			var square:Sprite = new Sprite();
			square.graphics.beginFill(0xFF0000);
			square.graphics.drawRect(0, 0, 512, 384);
			square = Sprite(_uic.addChild(square));
			return square;
		}
		private function _loadComment(url:String):void
		{
			_fileReadCompleted = false;
            // Check if we have no comment
            if (!url) {
            	_commentList = [];
				_commentDisplayList = [];
            	dispatchEvent(new Event('commentReady'));
				return;
            }
			
			var request:URLRequest = new URLRequest(url);
			var loader:URLLoader = new URLLoader(); 
			// If it is KeyTalks JSON, try to parse it as JSON
			//* TODO: KeyTalks support is temporary removed
			/*var is_json:RegExp = /\.json$/;
			if (url.match(is_json)) {
				is_kavideo = true;
				loader.addEventListener(Event.COMPLETE, goParseJSON);           	
			} else {
				is_kavideo = false;
				loader.addEventListener(Event.COMPLETE, goParse);
			}*/
			loader.addEventListener(Event.COMPLETE, goParse);
			loader.addEventListener(IOErrorEvent.IO_ERROR, _failRead);
			try {				
                loader.load(request);

            } catch (error:Error) {
                trace("Unable to load requested document.");
				_failRead();
            }
		}
		private function _failRead():void {
			_commentList = [];
			_commentDisplayList = [];
			dispatchEvent(new Event('commentReady'));
		}
		/*private function goParseJSON(e:Event):void
		{
			*//* We can extract only limited infomation from JSON *//*
			var loader2:URLLoader = URLLoader(e.target);
			var comment_json:Object;
			//throw new Error(loader2.data);
			comment_json = JSON.decode(loader2.data);
			_commentList = new Array();
			var item:Object;
			for each (item in comment_json) {		
				*//* Process the comment list *//*				
				var comment:Object =
				{
					anonymity: '',
					date: '',					
					mail: '',
					no: 0,
					thread:'',
					user_id:'',
					vpos:Number(item[1])*100,
					text:item[7],
					pos:(item[0]=='0')?'naka':'shita', color: item[3], size:item[4]
				};								
				_commentList.push(comment);
			}
			
		}*/
		private function goParse(e:Event):void
		{
			_commentXML = new XML();
			var loader2:URLLoader = URLLoader(e.target);
			_commentXML = XML(loader2.data);	 
			var video_id:String = _commentXML.view_counter.@id;
			var comment_id:String = _commentXML.thread.@thread;
			_commentList = new Array();
			var item:XML;
			var count:Number;
			//_commentNum = _commentXML.child('chat').length();
			for each (item in _commentXML.child('chat'))
			{
				/* Filter out deleted commment */
				if (item.@deleted == 1) {
					continue;
				}
				
				/* Process the comment list */
				var comment:Object =
				{
					anonymity: item.@anonymity,
					date: item.@date,					
					mail: item.@mail,
					no: item.@no,
					thread:item.@thread,
					user_id:item.@user_id,
					vpos:int(item.@vpos),
					text:item.toString(),
					pos:'', color: '', size:''
				};
				var mail:String=comment.mail;
				var pos_pattern:RegExp = 
				/(shita|ue|naka)/;
				var pos_match:Array = mail.match(pos_pattern);
				if (pos_match)
				{
					comment.pos= pos_match[1];
				}		
				else
				{
					comment.pos = 'naka';					
				}
						
				// Color match 1: color name; Color match 2: HTML hex code
				var color_pattern:RegExp = 
				/(white|red|pink|orange|yellow|green|cyan|blue|purple|niconicowhite|white2|truered|red2|passionorange|orange2|madyellow|yellow2|elementalgreen|green2|marineblue|blue2|nobleviolet|purple2|black|\#[0-9a-f]{6})/;
				var color_match:Array = mail.match(color_pattern);
				if (color_match)
				{
					comment.color = color_match[1];
				}		
				else
				{
					comment.color = 'white';					
				}
		

				var size_pattern:RegExp = 
				/(big|medium|small)/;
				var size_match:Array = mail.match(size_pattern);
				if (size_match)
				{
					comment.size = size_match[1];
				}		
				else
				{
					comment.size = 'meduim';					
				}
				_commentList.push(comment);					
			}
			_commentList.sortOn(['no'], [Array.NUMERIC | Array.DESCENDING]);
			_commentNum = _commentList.length;
			_changeDisplayNum();
			_fileReadCompleted = true;
			dispatchEvent(new Event('commentReady'));
		}
		private function _changeDisplayNum():void {
			if (!_commentList || _commentList.length == 0) { return; }
			_freezed = true;
			if (_commentDisplayNum == 0) {
				_commentDisplayNum = _commentList.length;
			}
			
			_commentDisplayList = _commentList.concat();
			/* Sort the comment list and splice */
			if (_commentDisplayNum > 0)
			{				
				_commentDisplayList = _commentDisplayList.slice(0, Math.min((_commentDisplayNum), (_commentDisplayList.length)));
				_commentDisplayList.sortOn(['no'], [Array.NUMERIC]);
				/* Sort the comment list. This CANNOT be done by: 
				_commentList.sortOn(['vpos'], [Array.NUMERIC])
				Because sortOn is NOT STABLE, so I have done a simple merge sort:
				*/			
				_commentDisplayList = merge_sort(_commentDisplayList);
			}
			
			_commentDisplayNum = _commentDisplayList.length;			
			_freezed = false;
		}

		/* After seeking, clear the old comment reading line */
		public function purgeIndex():void
		{
			_freezed = true;
			_firstCommentIndex = -1;
			_lastCommentIndex = -1;
			_lastNakaCommentIndex = -1;
			var comment:Object;
			for each(comment in _commentDisplayList)
			{			
				if (comment.object)
				{
					if (comment.pos == 'naka') _nakaSprite.recycleField(comment.object);
					else if (comment.pos == 'shita') _shitaSprite.recycleField(comment.object);
					else if (comment.pos == 'ue') _ueSprite.recycleField(comment.object);
					delete comment.object;
				}
			}		
			_freezed = false;
		}
		/* After timeupdate event by Video, update comments in a fixed interval */
		public function prepareComment(time:Number):void
		{
			var startTime:int = getTimer();
			var nowTime:int;
			
			
			//myapp.textArea.text = '+'+textfield_pool.usageCount+'+';
			//if (time % 1000 < 10)
			//{
				//textfield_pool.purge();
			//}
			if (this.visible==false)
			{return; }
			
			/* Check if freezed */
			if (_freezed) {
				return;
			}
			_nakaSprite.updateTime(time);
			var i: int = 0, k:int=0;
			var comment:Object, format:TextFormat;
			//myapp.textArea.text='';
			var lineMetrics:TextLineMetrics ;
			var scale:Number;
			var matrix:Matrix;
			var num:int = 0;
			var commentArea:Number = 0;
			if (!_commentDisplayList || _commentDisplayList.length == 0) { return; }
			
			commentArea = 0;
			/* Test if there is new comments to load */
			while (_lastCommentIndex + 1 < _commentDisplayList.length) {
				nowTime = getTimer();
				if (commentArea > 512 * 384 || nowTime - startTime > 15) { break; }
				
				comment = _commentDisplayList[_lastCommentIndex + 1];
				/* We reach the front */
				if (comment.vpos > time) { break; }
				/* When we find elements that needs to load... */
				if (comment.vpos + 300 >= time)  {
					if (comment.pos == 'shita' && !comment.object) {
						comment.object = _shitaSprite.addComment(comment);
						commentArea += comment.object.width * comment.object.height;
					}
					if (comment.pos == 'ue' && !comment.object) {
						comment.object = _ueSprite.addComment(comment);
						commentArea += comment.object.width * comment.object.height;
					}				
				}
				_lastCommentIndex++;
			}
			
			commentArea = 0;

			/* Test if there is new naka comments to load */
			while (_lastNakaCommentIndex + 1 < _commentDisplayList.length)
			{
				nowTime = getTimer();
				if (commentArea > 512 * 384 / 3 || nowTime - startTime > 20) { break; }

				comment = _commentDisplayList[_lastNakaCommentIndex + 1];
				/* We reach the front */
				if (comment.vpos - 100 > time) { break; }
				/* When we find elements that needs to load... */
				if (comment.vpos + 300 >= time ) {
					if (comment.pos == 'naka' && !comment.object) {
						comment.object = _nakaSprite.addComment(comment);
						commentArea += comment.object.width * comment.object.height;
					}
				}
				_lastNakaCommentIndex++;
			}
			/* Test if there old comments to hide */
			while (_firstCommentIndex < _commentDisplayList.length) {
				/* When there is no element, skip */
				if (_firstCommentIndex < 0) {
					if (_lastCommentIndex < 0) { break; }
					else { _firstCommentIndex = 0; }
				}
				
				comment = _commentDisplayList[_firstCommentIndex];
				
				/* We reach the front */
				if (comment.vpos + 300 >= time)
				{
					break;
				}
				
				/* Test if the element is going to be removed */
				if (comment.object)
				{
					/* Avoid clearing processing data */
				   if ((comment.object as CommentTextField).comment_for != comment.no) {
				   		comment.object = null;
					
				   } else {
				   					
					if (comment.pos == 'naka') _nakaSprite.recycleField(comment.object);
					else if (comment.pos == 'shita') _shitaSprite.recycleField(comment.object);
					else if (comment.pos == 'ue') _ueSprite.recycleField(comment.object);
					comment.object = null;
				   }
				
				}
				_firstCommentIndex++;
			}
			
		}
		
		private function _clearComment():void
		{
			this.purgeIndex();
			_commentDisplayList = new Array();
			
		}
		
		public function get commentFile():String {
			return _commentFile;
		}
		public function set commentFile(url:String):void {
			this._clearComment();
			this._loadComment(url);
			_commentFile = url;
		}

		public function get commentDisplayNum():int {
			return _commentDisplayNum;
		}
		public function set commentDisplayNum(number:int):void {			
			this._clearComment();			
			if (_fileReadCompleted) {
				_commentDisplayNum = number;
				_changeDisplayNum();
				dispatchEvent(new Event('commentReady'));
			} else {
				_commentDisplayNum = number;
				
			}
		}		

		public function get commentNum():int {
			return _commentNum;
		}
		private function yHitTest(y1:Number, height1:Number, y2:Number, height2:Number):Boolean
		{
			if (y1 <= y2)
			{ 
			return (y1 + height1 > y2);
			}			
			else
			{
			return (y2 + height2 > y1);
			}
		}

		private function merge_sort(A:Array):Array
		{			
			return merge_sort_inner(A, 0, A.length-1);	
		}
		private function merge_sort_inner(A:Array, p:int, r:int):Array
		{
			if (p < r)
			{
				var q:int = Math.floor((p+r) / 2);
				A = merge_sort_inner(A, p, q);
				A = merge_sort_inner(A, q+1, r);
				

				var left:Array = A.slice(p, q+1);
				var right:Array = A.slice(q+1, r+1);


				var i:int=0,j:int=0,k:int=p;
				while (left.length > 0 && right.length > 0)
				{ 
					if (left[i].vpos<=right[j].vpos)
					{												
						A[k] = left.shift();k++;
					}					
					else
					{
						A[k] = right.shift();k++;
					}
					
				}
				while (left.length > 0)
				{
					A[k] = left.shift(); k++;
				}
				while (right.length > 0)
				{
					A[k] = right.shift(); k++;
				}
				
			}
			return A;
		}

	}
}
