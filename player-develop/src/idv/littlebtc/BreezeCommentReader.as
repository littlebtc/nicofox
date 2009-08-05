package idv.littlebtc
{
	//import com.adobe.serialization.json.*;
	
	import flash.display.*;
	import flash.events.*;
	import flash.filters.*;
	import flash.geom.*;
	import flash.net.*;
	import flash.text.*;
	
	import mx.core.*;
				
	public class BreezeCommentReader
	{
		private var myapp:Object;
		private var comment_xml:XML;		
		private var nico_bevel:BevelFilter;
		private var comment_list:Array;
		private var check_head:Number;
		private var check_tail:Number;
		private var check_head_vpos:Number;
		private var check_tail_vpos:Number;
		private var ue_sprite:BreezeCommentSprite;
		private var shita_sprite:BreezeCommentSprite;
		private var naka_sprite:BreezeCommentSprite;
		private var comment_num:int;

		// private var is_kavideo:Boolean;
		
		public function BreezeCommentReader(app:Object)
		{	
			myapp = app;

			naka_sprite = new BreezeCommentSprite('naka');
			shita_sprite = new BreezeCommentSprite('shita');
			ue_sprite = new BreezeCommentSprite('ue');
						
			var uic:UIComponent = new UIComponent();
			//var square1:Sprite = new Sprite();
			var square1:Sprite = new Sprite();
			square1.graphics.beginFill(0xFF0000);
			square1.graphics.drawRect(0, 0, 512, 384);
			var square2:Sprite = new Sprite();
			square2.graphics.beginFill(0xFF0000);
			square2.graphics.drawRect(0, 0, 512, 384);
			var square3:Sprite = new Sprite();
			square3.graphics.beginFill(0xFF0000);
			square3.graphics.drawRect(0, 0, 512, 384);			
			
			uic.addChild(square1);
			uic.addChild(square2);
			uic.addChild(square3);

			ue_sprite.mask = square1;
			shita_sprite.mask = square2;
			naka_sprite.mask = square3;
			
			uic.addChild(ue_sprite);
			uic.addChild(shita_sprite);
			uic.addChild(naka_sprite);
			//naka_sprite.visible = false;
			myapp.comment_container.addChild(uic);
			
		}
		public function loadComment(url:String, number:int = 0):void
		{		    	
			comment_num = number;
            var request:URLRequest = new URLRequest(url);
            var loader:URLLoader = new URLLoader();
            
            // Check if we have no comment
            if (!url) {
            	comment_list = [];
            	
            	// XXX: do it on mxml   				
				myapp.comment_img = myapp.comment_img_no;
				myapp.comment_switch.label = "";
				myapp.comment_switch.enabled = false;
            	return;
            }
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
            try {
                loader.load(request);

            } catch (error:Error) {
                trace("Unable to load requested document.");
            }
		}
		/*private function goParseJSON(e:Event):void
		{
			*//* We can extract only limited infomation from JSON *//*
			var loader2:URLLoader = URLLoader(e.target);
			var comment_json:Object;
			//throw new Error(loader2.data);
			comment_json = JSON.decode(loader2.data);
			comment_list = new Array();
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
				comment_list.push(comment);
			}
			
		}*/
		private function goParse(e:Event):void
		{
			comment_xml = new XML();
			var loader2:URLLoader = URLLoader(e.target);
			comment_xml = XML(loader2.data);	 
			var video_id:String = comment_xml.view_counter.@id;
			var comment_id:String = comment_xml.thread.@thread;
			comment_list = new Array();
			var item:XML;
			var count:Number;
			
			for each (item in comment_xml.child('chat'))
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
				comment_list.push(comment);					
			}
			
			var cresults:XMLList = myapp.comment_numbers.(@value == -1);
			var citem:XML;
            for each(citem in cresults) {
                citem.@value = comment_list.length;
            }
			

			//
			/* Sort the comment list and splice */
			if (comment_num!=0)
			{
				comment_list.sortOn(['no'], [Array.NUMERIC | Array.DESCENDING]);
				comment_list = comment_list.slice(0, Math.min((comment_num-1), (comment_list.length - 1)));
				comment_list.sortOn(['no'], [Array.NUMERIC]);
			}
			/* Sort the comment list. This CANNOT be done by: 
			comment_list.sortOn(['vpos'], [Array.NUMERIC])
			Because sortOn is NOT STABLE, so I have done a simple merge sort:
			*/
			comment_list = merge_sort(comment_list);
			check_head = -1;	
			check_tail = -1;
			

		}
		
		public function hasComment():Boolean {
			if (comment_list && comment_list.length > 0) {
				return true;
			} 
			return false;
		}
		private var skipCount:int = 0;
		public function prepareComment(time:Number):void
		{
			naka_sprite.updateTime(time);
			//myapp.textArea.text = '+'+textfield_pool.usageCount+'+';
			//if (time % 1000 < 10)
			//{
				//textfield_pool.purge();
			//}
			if (myapp.comment_container.visible==false)
			{return; }
			
			if (skipCount < 3) {		
				skipCount++;
				return;
			}
			
			skipCount = 0;				
			
			var i: int = 0, k:int=0;
			var comment:Object, format:TextFormat;
			//myapp.textArea.text='';
			var lineMetrics:TextLineMetrics ;
			var scale:Number;
			var matrix:Matrix;
			var num:int = 0;
			for each(comment in comment_list)
			{	
				//if (num > 3) return;
				if (comment.pos == 'shita'  && comment.vpos <= time && comment.vpos+300 >= time )
				{
					if(!comment.object)
					{
									
						comment.object = shita_sprite.addComment(comment);
						num++;						
					}														
				}
				else if(comment.pos == 'ue'  && comment.vpos <= time && comment.vpos+300 >= time )
				{
					if(!comment.object)
					{												
						comment.object = ue_sprite.addComment(comment);
						num++;						
					}

				}
				
				else if (comment.pos == 'naka' && comment.vpos -100 <= (time) && comment.vpos +300 >= (time) )
				{
					if(!comment.object)
					{												
						comment.object = naka_sprite.addComment(comment);
						num++;						
					}
					else
                    {
                          //comment.object.x = 512+(512+comment.object.width)*(comment.vpos-100-time) / 400;
    					          
                    }

				}
				else if (comment.object)
				{
					/* Avoid clearing processing data */
				   if ((comment.object as BreezeTextField).comment_for != comment.no) {
				   		comment.object = null;
					
				   } else {
				   					
					if (comment.pos == 'naka') naka_sprite.recycleField(comment.object);//naka_sprite.removeChild(comment.object);
					else if (comment.pos == 'shita') shita_sprite.recycleField(comment.object);
					else if (comment.pos == 'ue') ue_sprite.recycleField(comment.object);
					//textfield_pool.object = comment.object;
					comment.object = null;
				   }
				}
			}
			//myapp.textArea.text = '?'+check_head+'/'+check_tail + "\n"+ myapp.textArea.text;
		}
		
		public function cleanComment():void
		{
			var comment:Object;
			for each(comment in comment_list)
			{			
				if (comment.object)
				{
					if (comment.pos == 'naka') naka_sprite.recycleField(comment.object);
					else if (comment.pos == 'shita') shita_sprite.recycleField(comment.object);
					else if (comment.pos == 'ue') ue_sprite.recycleField(comment.object);
					delete comment.object;
				}
			}		
			comment_list = new Array();
			
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
