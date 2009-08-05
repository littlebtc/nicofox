package idv.littlebtc
{
	/* A VideoDisplay extension to enable smoothing 
	   See:
	    * http://www.tuftandco.com/blog/2008/12/smooth-videos-in-flex-using-videodisplay/	    
	*/
	import mx.controls.VideoDisplay;
	import mx.core.mx_internal;
	import mx.events.*;
	use namespace mx_internal;
	
	public class BreezeVideoOld extends VideoDisplay
	{		
		public var smoothing:Boolean = false;
		
		public function BreezeVideoOld()
		{
			addEventListener(FlexEvent.CREATION_COMPLETE, setSmooth);
			
			super();
		}
		
		private function setSmooth(e:FlexEvent):void {
			if (videoPlayer) {
				videoPlayer.smoothing = true;
				videoPlayer.deblocking = 0;
			}
		}		
	}
}
