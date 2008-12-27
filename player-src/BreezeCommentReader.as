package
{
	import de.polygonal.core.ObjectPool;
	
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
		private var ue_sprite:Sprite;
		private var shita_sprite:Sprite;
		private var naka_sprite:Sprite;
		private var comment_num:int;
		private var textfield_pool:ObjectPool;
		private var textformat_pool:ObjectPool;
		public function BreezeCommentReader(app:Object)
		{	
			myapp = app;
			
			/* Define BevelFilter to prepare building a shadow */
			nico_bevel = new flash.filters.BevelFilter();
			nico_bevel.distance = 1;
			nico_bevel.highlightColor = 0x000000;
			nico_bevel.blurX = 2.0;
			nico_bevel.blurY = 2.0;
			nico_bevel.type = 'outer';
			
			shita_sprite = new Sprite();
			ue_sprite = new Sprite();
						
			naka_sprite = new Sprite();
			var uic:UIComponent = new UIComponent();
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
			
            textfield_pool = new ObjectPool(true);
			textfield_pool.allocate(200, TextField);
            textformat_pool = new ObjectPool(true);
			textformat_pool.allocate(200, TextFormat);

			
		}
		public function loadComment(url:String, number:int = 0):void
		{		    	
			comment_num = number;
            var request:URLRequest = new URLRequest(url);
            var loader:URLLoader = new URLLoader();
            loader.addEventListener(Event.COMPLETE, goParse);
            try {
                loader.load(request);

            } catch (error:Error) {
                trace("Unable to load requested document.");
            }
		}
		
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
								
				var color_pattern:RegExp = 
				/(white|red|pink|orange|yellow|green|cyan|blue|purple|niconicowhite|white2|truered|red2|passionorange|orange2|madyellow|yellow2|elementalgreen|green2|marineblue|blue2|nobleviolet|purple2|black)/;
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
			
			
			
			/* Sort the comment list and splice */
			if (comment_num!=0)
			{
				comment_list.sortOn(['no'], [Array.NUMERIC | Array.DESCENDING]);
				comment_list = comment_list.slice(0, Math.min((comment_num-1), (comment_list.length - 1)));
				comment_list.sortOn(['no'], [Array.NUMERIC]);
			}
			/* Sort the comment list. Why not we: 
			comment_list.sortOn(['vpos'], [Array.NUMERIC])
			Because sortOn is NOT STABLE, so I have done a simple merge sort:
			*/
			comment_list = merge_sort(comment_list);
			//myapp.textArea.text = 'Video ID:' + video_id;
	
			//myapp.textArea.text = myapp.textArea.text + "\n"+'Comment ID:' + comment_id;
			//myapp.textArea.text = myapp.textArea.text+ "\n"+ comment_list[0].vpos;
			check_head = -1;	
			check_tail = -1;
			

		}
		
		public function prepareComment(time:Number):void
		{
			//myapp.textArea.text = '+'+textfield_pool.usageCount+'+';
			if (time % 1000 < 10)
			{
				textfield_pool.purge();
			}
			if (myapp.comment_container.visible==false)
			{return;}
			var i: int = 0, k:int=0;
			var comment:Object, format:TextFormat;
			//myapp.textArea.text='';
			var lineMetrics:TextLineMetrics ;
			var scale:Number;
			var matrix:Matrix;
			for each(comment in comment_list)
			{	
				
				
				if (comment.pos == 'shita'  && comment.vpos <= time && comment.vpos+300 >= time )
				{							
					var shita_objects:Array = new Array();
					
					for (k = 0; k < shita_sprite.numChildren; k++)
					{
						shita_objects.push(shita_sprite.getChildAt(k));
					}
					shita_objects.sortOn('y', Array.NUMERIC|Array.DESCENDING);
					var shita_object:Object;												
					//myapp.textArea.text = myapp.textArea.text+ "\n"+ comment.text + '['+comment.pos+']'+comment.vpos;
					if(!comment.object)
					{
						comment.object = textfield_pool.object;
						comment.object.text = comment.text;		
						
						format = textformat_pool.object;								
						format.size = sizeSelect(comment.size);		
						format.bold = true;					
						format.color = colorSelect(comment.color);
						format.font = 'Arial';
						format.leading = 0;
						comment.object.setTextFormat(format);
						comment.object.filters = [nico_bevel];
						//comment.object.border = true;
						//comment.object.borderColor = 0xffff00;
						textformat_pool.object = format;
						
						comment.object.x = 512;
						comment.object.y = 384;

						comment.object.autoSize = 'left';
						comment.object.type = 'dynamic';
						comment.object.selectable = false;

						comment.object = shita_sprite.addChild(comment.object);
						scale = 1.0;
						
						if (comment.object.height *3 > 384)
						{
							//comment.object.autoSize = 'none';
							comment.object.scaleY = 0.5;														
							comment.object.scaleX = 0.5;
																				
						}
						
						if (comment.object.width > 512)
						{
							

							scale =  512.00 / comment.object.width;
							comment.object.scaleY = scale;
							comment.object.scaleX = scale;
							
							
						}
						comment.object.x = (512-comment.object.width)/2.00;
						comment.object.y = 384-comment.object.height;
						
							
						//var my_object:Object = comment.object;
						//var ui_format:UITextFormat = comment.object.determineTextFormatFromStyles();
						
						/* Take hitTest */
						for each(shita_object in shita_objects)
						{																										
							//myapp.textArea.text = myapp.textArea.text+ " [" +naka_object.height +"] \n";
									
							if (yHitTest(shita_object.y, shita_object.height, comment.object.y, comment.object.height))
							{							
								comment.object.y = shita_object.y-comment.object.height;
								if (comment.object.y + comment.object.height > 384 || comment.object.y < 0)
								{
									comment.object.y  = Math.random() * (Math.max(0, (384-comment.object.height)));
									break;
								}
							}						
						}

					}
														
				}
				else if(comment.pos == 'ue'  && comment.vpos <= time && comment.vpos+300 >= time )
				{
					var ue_objects:Array = new Array();
					
					for (k = 0; k < ue_sprite.numChildren; k++)
					{
						ue_objects.push(ue_sprite.getChildAt(k));
					}
					ue_objects.sortOn('y', Array.NUMERIC);
					var ue_object:Object;												
					
					if(!comment.object)
					{
						comment.object = textfield_pool.object;
						comment.object.text = comment.text;		
						
						format = textformat_pool.object;								
						format.size = sizeSelect(comment.size);		
						format.bold = true;					
						format.color = colorSelect(comment.color);
						format.font = 'Arial';
						format.leading = 0;
						comment.object.setTextFormat(format);
						textformat_pool.object = format;
						comment.object.filters = [nico_bevel];
						//comment.object.border = true;
						//comment.object.borderColor = 0x00FF00;
						comment.object.x = 512;
						comment.object.y = 0;

						comment.object.autoSize = 'left';
						comment.object.type = 'dynamic';
						comment.object.selectable = false;

						comment.object = ue_sprite.addChild(comment.object);
						comment.object.x = (512-comment.object.width)/2.00;
						comment.object.y = 0;	
						scale = 1.0;
						
						if (comment.object.height *3 > 384)
						{
						
							comment.object.scaleY = 0.5;						
							comment.object.scaleX = 0.5;
																				
						}

						if (comment.object.width >512)
						{

							scale =  512.00 / comment.object.width;
							comment.object.scaleY = scale;
							comment.object.scaleX = scale;
									
							
						}
						comment.object.x = (512-comment.object.width)/2.00;
						
						comment.object.y = 0;
						
							
						/* Take hitTest */
						for each(ue_object in ue_objects)
						{																										
							//myapp.textArea.text = myapp.textArea.text+ " [" +naka_object.height +"] \n";
									
							if (yHitTest(ue_object.y, ue_object.height, comment.object.y, comment.object.height))
							{							
								comment.object.y = ue_object.y+ue_object.height;
								if (comment.object.y + comment.object.height > 384 || comment.object.y < 0)
								{
									comment.object.y  = Math.random() * (Math.max(0, (384-comment.object.height)));
									break;
								}
							}						
						}

						
					}

				}
				
				else if (comment.pos == 'naka' && comment.vpos -100 <= (time) && comment.vpos +300 >= (time) )
				{
					
					var naka_objects:Array = new Array();

					for (k = 0; k < naka_sprite.numChildren; k++)
					{
						naka_objects.push(naka_sprite.getChildAt(k));
					}
					naka_objects.sortOn('y', Array.NUMERIC);
					var naka_object:Object;						
									
					//myapp.textArea.text = myapp.textArea.text+ "\n"+ comment.text + '[naka]'+comment.vpos;					
					if(!comment.object)
					{
						//myapp.textArea.text += "Try to Create "+comment.no+"\n";
						
						//myapp.textArea.text = myapp.textArea.text+ "]]]" + comment.mail	+" ["+comment.color+"]=======\n";
						comment.object = textfield_pool.object;
						comment.object.text = comment.text;		
						
						format = textformat_pool.object;								
						format.size = sizeSelect(comment.size);		
						format.bold = true;					
						format.color = colorSelect(comment.color);
						format.font = 'Arial';
						textformat_pool.object = format;
						//format.leading = 0;
						comment.object.setTextFormat(format);
						comment.object.filters = [nico_bevel];
						
						comment.object.x = 512;
						comment.object.y = 0;

						comment.object.autoSize = 'left';
						comment.object.type = 'dynamic';
						comment.object.selectable = false;
												
						/* To overcome the problem of width/height delay calculation, we will calculate it */
						naka_sprite.addChild(comment.object);
						/*lineMetrics = format.measureText(comment.text);*/
						comment.object.x = 512+(512+comment.object.width)*(comment.vpos-100-time) / 400;

						if (comment.object.height *3 > 384)
						{
							comment.object.autoSize = 'none';
							comment.object.scaleY = 0.5;						
							comment.object.scaleX = 0.5;
																					
						}
						
						/* Take hitTest */
						for each(naka_object in naka_objects)
						{
																				
							var future_x:Number = naka_object.x+(512+naka_object.width)*(time-comment.vpos-300) / 400 + naka_object.width;
							//myapp.textArea.text = myapp.textArea.text+ " [" +naka_object.height +"] \n";
									
							if (yHitTest(naka_object.y, naka_object.height, comment.object.y, comment.object.height) && (naka_object.x + naka_object.width > comment.object.x || future_x > -comment.object.width))
							{							
								comment.object.y = naka_object.y+naka_object.height;
								if (comment.object.y +comment.object.height > 384)
								{
									comment.object.y  = Math.random() * (Math.max(0, (384-comment.object.height)));
									break;
								}
							}						
						}
						naka_objects.push(comment.object);
						naka_objects.sortOn('y', Array.NUMERIC);
					}
					else if (comment.object)
					{
						comment.object.x = 512+(512+comment.object.width)*(comment.vpos-100-time) / 400;	
					
					}
				}
				else if (comment.object)
				{
					if (comment.pos == 'naka') naka_sprite.removeChild(comment.object);
					else if (comment.pos == 'shita') shita_sprite.removeChild(comment.object);
					else if (comment.pos == 'ue') ue_sprite.removeChild(comment.object);
					textfield_pool.object = comment.object;
					delete comment.object;
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
					if (comment.pos == 'naka') naka_sprite.removeChild(comment.object);
					else if (comment.pos == 'shita') shita_sprite.removeChild(comment.object);
					else if (comment.pos == 'ue') ue_sprite.removeChild(comment.object);
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
		private function sizeSelect(size:String):Number
		{
			switch(size)
			{
				case 'small': return 15;
				case 'medium': return 24;
				case 'big': return 39;
				default: return 24;
			}
		}
		private function colorSelect(color:String):Number
		{
			switch (color)
			{
				case 'red':	return 0xFF0000; break;
				case 'pink': return 0xFF8080; break;
				case 'orange': return 0xFFCC00; break;
				case 'yellow': return 0xFFFF00; break;
				case 'green': return 0x00FF00; break;
				case 'cyan': return 0x00FFFF; break;
				case 'blue': return 0x0000FF; break;
				case 'purple': return 0xC000FF; break;

				case 'niconicowhite': return 0xCCCC99; break;
				case 'white2': return 0xCCCC99; break;
				case 'truered': return 0xCC0033; break;
				case 'red2': return 0xCC0033; break;
				case 'passionorange': return 0xFF6600; break;
				case 'orange2': return 0xFF6600; break;
				case 'madyellow': return 0x999900; break;
				case 'yellow2': return 0x999900; break;
				case 'elementalgreen': return 0x00CC66; break;
				case 'green2': return 0x00CC66; break;
				case 'marineblue': return 0x33FFFC; break;
				case 'blue2': return 0x33FFFC; break;
				case 'nobleviolet': return 0x6633CC; break;
				case 'purple2': return 0x6633CC; break;
				
				case 'black': return 0x000000; break;
				default:
				return 0xFFFFFF;				
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