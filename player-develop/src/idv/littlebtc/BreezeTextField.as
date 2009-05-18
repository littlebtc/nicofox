package idv.littlebtc
{
	import flash.filters.*;
	import flash.text.*;
	import flash.utils.*;

	public class BreezeTextField extends TextField
	{
		public var comment_type:String;
		public var comment_for:int;
		public var interval_id:uint;
		public var vpos:Number;
		private var nico_bevel:BevelFilter;
		private var nico_bevel_black:BevelFilter;			
				
		public function BreezeTextField(new_type:String)
		{
			super();
			if (new_type != 'shita' && new_type != 'ue' && new_type != 'naka') {
				throw new Error('BreezeCommentSprite: Unreconized Type.');
				return false;				
			}
			var format:TextFormat = new TextFormat();								
			format.size = 24;		
			format.bold = true;					
			format.color = 0xFFFFFF;
			format.font = 'Arial';
			format.leading = 0;
			this.defaultTextFormat = format;
			
			nico_bevel = new BevelFilter();
			nico_bevel.distance = 1;
			nico_bevel.highlightColor = 0x000000;
			nico_bevel.blurX = 2.0;
			nico_bevel.blurY = 2.0;
			nico_bevel.type = 'outer';
			
			nico_bevel_black = new BevelFilter();
			nico_bevel_black.distance = 1;
			nico_bevel_black.highlightColor = 0xFFFFFF;
			nico_bevel_black.blurX = 2.0;
			nico_bevel_black.blurY = 2.0;
			nico_bevel_black.type = 'outer';	
					
			this.filters = [nico_bevel];
			this.comment_for = -1;
			this.autoSize = 'left';
			this.type = 'dynamic';
			this.selectable = false;
			
		}
		public function resetFormat():void {
			//this.setTextFormat(this.defaultTextFormat);
			//this.filters = [nico_bevel];
			this.text = '';
			this.comment_for = -1;
	
		}
		public function formatSelect(size:String, color:String):void
		{
			var size_int:int = 24;
			var color_num:Number = 0xFFFFFF;
			/*if (is_kavideo)
			{
				switch(size)
				{				
					case '0': size_int = 20; break;
					case '1': size_int = 24; break;
					case '2': size_int = 28; break;
				}
			}
			else
			{*/
				switch(size)
				{
					case 'small': size_int = 15; break;
					case 'medium': size_int = 24; break;
					case 'big': size_int = 39; break;
				}				
			/*}*/
			
		
			/*if (is_kavideo)
			{
				switch(color)
				{
					case '0': return 0xFFFFFF; break;
					case '1': return 0x999999; break;
					case '2': return 0xFF0000; break;
					case '3': return 0x00FF00; break;
					case '4': return 0x0000FF; break;
					case '5': return 0xFFFF00; break;
					case '6': return 0xFF00FF; break;
					case '7': return 0x336699; break;
					case '8': return 0x333333; break;
					case '9': return 0x7200FF; break;
					case '10': return 0xFF6000; break;
					case '11': return 0x7200FF; break;
					case '12': return 0x7E2F00; break;
				
				}
			} else	{*/
				switch (color)
				{
					case 'red':	   color_num = 0xFF0000; break;
					case 'pink':   color_num = 0xFF8080; break;
					case 'orange': color_num = 0xFFCC00; break;
					case 'yellow': color_num = 0xFFFF00; break;
					case 'green': color_num = 0x00FF00; break;
					case 'cyan': color_num = 0x00FFFF; break;
					case 'blue': color_num = 0x0000FF; break;
					case 'purple': color_num = 0xC000FF; break;
	
					case 'niconicowhite': color_num = 0xCCCC99; break;
					case 'white2': color_num = 0xCCCC99; break;
					case 'truered': color_num = 0xCC0033; break;
					case 'red2': color_num = 0xCC0033; break;
					case 'passionorange': color_num = 0xFF6600; break;
					case 'orange2': color_num = 0xFF6600; break;
					case 'madyellow': color_num = 0x999900; break;
					case 'yellow2': color_num = 0x999900; break;
					case 'elementalgreen': color_num = 0x00CC66; break;
					case 'green2': color_num = 0x00CC66; break;
					case 'marineblue': color_num = 0x33FFFC; break;
					case 'blue2': color_num = 0x33FFFC; break;
					case 'nobleviolet': color_num = 0x6633CC; break;
					case 'purple2': color_num = 0x6633CC; break;
					
					case 'black': color_num = 0x000000; break;
				}
			/*}*/
			var format:TextFormat = defaultTextFormat;
			if (color_num == 0x000000) {
				this.filters = [nico_bevel_black];
			} else {
				this.filters = [nico_bevel];
			}
			format.size = size_int;							
			format.color = color_num;
			this.setTextFormat(format);			
			
		}
	}
}