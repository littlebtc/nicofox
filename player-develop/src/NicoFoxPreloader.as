package
{
	import flash.display.Bitmap;
	import flash.display.Sprite;
	import flash.events.Event;
	import flash.text.TextField;
	import flash.text.TextFormat;
	import mx.core.BitmapAsset;
	import mx.events.FlexEvent;
	import mx.preloaders.DownloadProgressBar;
	
	/**
	 * ...
	 * @author Littlebtc
	 */
	public class NicoFoxPreloader extends DownloadProgressBar
	{
		[Embed(source="loading.png")]
		public var loadingImage:Class;
		public var myBitmap:BitmapAsset;
		public var myText:TextField;
		public var mySprite:Sprite;
		public function NicoFoxPreloader() 
		{
			super();
			myBitmap = new loadingImage() as BitmapAsset;
			this.addChild(myBitmap);
			addEventListener(Event.ADDED_TO_STAGE, onAdded);
			
		}
		public override function set preloader(preloader:Sprite):void {
			preloader.addEventListener(FlexEvent.INIT_COMPLETE, complete);
		}
		private function onAdded(e:Event):void {
			this.graphics.beginFill(0x000000);
			this.graphics.drawRect(0, 0, stage.stageWidth, stage.stageHeight);
			this.graphics.endFill();
			this.graphics.beginFill(0xEEEEEE);
			this.graphics.drawRect(0, stage.stageHeight - 40, stage.stageWidth, stage.stageHeight);
			//this.graphics.drawRoundRect(stage.stageWidth / 2 - 70, stage.stageHeight / 2 - 70, 140, 140, 30, 30);
			this.graphics.endFill();
			
			myBitmap.x = stage.stageWidth / 2 - 64;
			myBitmap.y = stage.stageHeight / 2 - 64;
		}
		private function complete(e:FlexEvent):void {
			dispatchEvent( new Event(Event.COMPLETE));
		}
	}
	
}