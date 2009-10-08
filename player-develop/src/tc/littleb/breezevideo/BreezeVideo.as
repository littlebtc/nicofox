package tc.littleb.breezevideo
{			
	import flash.display.Loader;
	import flash.display.LoaderInfo;
	import flash.display.MovieClip;
	import flash.display.Sprite;
	import flash.events.AsyncErrorEvent;
	import flash.events.Event;	
	import flash.events.NetStatusEvent;
	import flash.events.SecurityErrorEvent;
	import flash.events.TimerEvent;
	import flash.media.SoundTransform;
	import flash.media.Video;
	import flash.net.NetConnection;
	import flash.net.NetStream;
	import flash.net.URLRequest;
	import flash.utils.Timer;
	import mx.core.UIComponent;
	import org.libspark.utils.ForcibleLoader;
	
	/**
	 * ...
	 * @author Littlebtc
	 */
	public class BreezeVideo extends UIComponent
	{
		[Event(name = "timeUpdate")]
		[Event(name = "seeked")]
		[Event(name = "ended")]
		
		private var _src:String;
		private var _width:Number;
		private var _height:Number;
		private var _loaded:Boolean = false;
		
		private var _isSwf:Boolean = false;
		private var _swfFps:Number;
		private var _swfLoader:Loader;
		private var _swfMask:Sprite;
		private var _swfMovieClip:MovieClip;
		
		private var _connection:NetConnection;
		private var _stream:NetStream;
		private var _video:Video;		
		private var _streamWidth:Number;
		private var _streamHeight:Number;
		
		private var _intervalTimer:Timer;
		private var _seekTimer:Timer;
		private var _ended:Boolean = false;
		
		private var _autoPlay:Boolean = false;
		private var _previousTime:Number;
		private var _duration:Number = 0;			
		private var _keyframeTimes:Array = [];
		private var _loop:Boolean = false;
		private var _playing:Boolean = false;
		private var _updateInterval:Number = 30;
		private var _volume:Number = 0.75;					
		
		public function BreezeVideo()
		{
			addEventListener(Event.RESIZE, resize);
		}
		private function loadVideo(url:String):void {
			/* If it is SWF */
			if (url.match(/\.swf$/)) {
				/* Initialize Loader */
				var loaderTemp:Loader = new Loader();
				_swfLoader = Loader(this.addChild(loaderTemp));				
				_swfLoader.contentLoaderInfo.addEventListener(Event.COMPLETE, swfComplete);
				
				/* Set up the mask */
				_swfMask = new Sprite();
				_swfMask.graphics.beginFill(0xFF0000);
				_swfMask.graphics.drawRect(0, 0, super.width, super.height);				
				_swfMask.graphics.endFill();
				_swfMask = Sprite(this.addChild(_swfMask));
				_swfLoader.mask = _swfMask;
				
				/* Use ForcibleLoader to load AVM1 SWF */
				var fLoader:ForcibleLoader = new ForcibleLoader(_swfLoader);
				fLoader.load(new URLRequest(url));			
			} else {
				_video = new Video();
				_video.smoothing = true;
				
				_connection = new NetConnection();
	            _connection.addEventListener(NetStatusEvent.NET_STATUS, netStatus);
				_connection.addEventListener(SecurityErrorEvent.SECURITY_ERROR, securityError);
				_connection.connect(null);

			}
			
		}
	
		
		private function swfComplete(event:Event):void {
			/* Set necessary variables */
			_loaded = true;
			_isSwf = true;
			_swfMovieClip = event.currentTarget.content as MovieClip;
			_swfMovieClip.scaleX = 1;
			_swfMovieClip.scaleY = 1;
			_swfFps = event.target.frameRate;
			_duration = new Number(_swfMovieClip.totalFrames) / _swfFps;
			/* Set Defaut Volume */
		 	var transform:SoundTransform = new SoundTransform();
			transform.volume = this._volume;
			_swfMovieClip.soundTransform = transform;
			/* Proceess comlete event */
			_swfMovieClip.addEventListener(Event.ENTER_FRAME, swfEnterFrame);
			/* Resize */
			dispatchEvent(new Event('resize'));
			
			/* Initialize Timer */
			_intervalTimer = new Timer(_updateInterval, 0);
			_intervalTimer.addEventListener(TimerEvent.TIMER, intervalUpdate);

			/* Play or pause depending on autoplay */
			_swfMovieClip.gotoAndStop(1);
			if (this._autoPlay) {
				play();
			}
		}
		private function connectStream():void {
				_stream = new NetStream(_connection);
				_stream.addEventListener(NetStatusEvent.NET_STATUS, netStatus);
				_stream.addEventListener(AsyncErrorEvent.ASYNC_ERROR, asyncError);
				_video.attachNetStream(_stream);
				var client:Object = new Object();
				client.onMetaData = this.onMetaData;
				_stream.client = client;
				_video = Video(addChild(_video));			
				
				/* Set Defaut Volume */
				var transform:SoundTransform = new SoundTransform();
				transform.volume = this._volume;
				_stream.soundTransform = transform;
				
				/* Initialize Timer */
				_intervalTimer = new Timer(_updateInterval, 0);
				_intervalTimer.addEventListener(TimerEvent.TIMER, intervalUpdate);
				
				/* To fix time asynchrously update for seeking */
				_seekTimer = new Timer(1, 0);
				_seekTimer.addEventListener(TimerEvent.TIMER, seekTest);
				
				/* Play or pause depending on autoplay */
				_stream.play(_src);
				_stream.pause();
				
				if (this._autoPlay) {
					play();
				}			
		}
		
		private function netStatus(event:NetStatusEvent):void {
            switch (event.info.code) {
                case "NetConnection.Connect.Success":
                    connectStream();
                    break;
                case "NetStream.Play.StreamNotFound":
                    throw new Error("Cannot found stream");
                    break;
				case "NetStream.Play.Stop":
					/* Test loop or not */
					if (_loop) {
						_previousTime = _stream.time;
						_stream.seek(0);						
						_ended = false;
						_stream.resume();
					} else {
						pause();
						dispatchEvent(new Event('ended'));
						_ended = true;
					}
					break;
					
				case "NetStream.Seek.Notify":
					_seekTimer.start();
					
					break;
            }			
		}
		private function asyncError(error:AsyncErrorEvent):void {
		    
		}
		private function securityError(event:SecurityErrorEvent):void {
			
		}
		/* Implementatation of Client object for NetStream */
		public function onMetaData(info:Object):void {

			_duration = info.duration;
			_streamWidth = info.width;
			_streamHeight = info.height;
			
			/* Read Keyframes */
			if (info.keyframes) {
				/* For FLV */
				if (info.keyframes.times is Array) {
					_keyframeTimes = info.keyframes.times;
				}
			} else if ((info.seekpoints) && (info.seekpoints is Array)) {
				var i:int;
				for (i = 0; i < info.seekpoints.length; i++) {
					if (info.seekpoints[i].time) {
						_keyframeTimes.push(info.seekpoints[i].time);
					}
				}
			}
			
			dispatchEvent(new Event('loadedmetadata'));
			dispatchEvent(new Event('resize'));
		}
		
		private function intervalUpdate(e:TimerEvent):void {
			dispatchEvent(new Event('timeUpdate'));
		}
		
		private function seekTest(e:TimerEvent):void {
			if (_previousTime != _stream.time) {				
				dispatchEvent(new Event('seeked'));
				dispatchEvent(new Event('timeUpdate'));
				_seekTimer.reset();
			}
		}
		private function swfEnterFrame(e:Event):void {
			/* Processing last frame, loop or not */
			if (_swfMovieClip.currentFrame >= _swfMovieClip.totalFrames - 1 && _playing) {
				if (_loop) {
					_swfMovieClip.gotoAndPlay(1);
					_ended = false;
					dispatchEvent(new Event('seeked'));
				} else {
					pause();
					dispatchEvent(new Event('ended'));
					_ended = true;
				}
			}
		}
		private function resize(e:Event):void {
			var scale:Number;
			if (_isSwf && _swfMovieClip) {
				scale = Math.min(super.width / 512, super.height / 384);
				_swfLoader.scaleX = scale;
				_swfLoader.scaleY = scale;
				
				/* Set up the mask */
				_swfMask.graphics.clear();
				_swfMask.graphics.beginFill(0xFF0000);
				_swfMask.graphics.drawRect(0, 0, super.width, super.height);				
				_swfMask.graphics.endFill();
				//_swfLoader.mask = _swfMask;				
			
			} else if (_video) {
				scale = Math.min(super.width / _streamWidth, super.height / _streamHeight);
				_video.width = _streamWidth * scale;
				_video.height = _streamHeight * scale;
				_video.x = (super.width - _video.width) / 2;
				_video.y = (super.height - _video.height) / 2;
			}
		}
		
		public function get playing():Boolean {
			return _playing;
		}
		
		public function play():void {
			if (!_playing) {
				if (_isSwf && _swfMovieClip){
					/* Rewind Manually if at the last frame */
					if (_ended) {
						_swfMovieClip.gotoAndPlay(1);
						_ended = false;
						dispatchEvent(new Event('seeked'));
						dispatchEvent(new Event('timeUpdate'));
					} else {
						_swfMovieClip.play();				
					} 
				} else if (_stream) {
					if (_ended) {
						_previousTime = _stream.time;
						_stream.seek(0);
						_ended = false;
						_stream.resume();
						dispatchEvent(new Event('timeUpdate'));
					} else {
						_stream.resume();
					}
				}
				_intervalTimer.start();
				_playing = true;
				
			}
		}
		public function pause():void {
			if (_playing) {
				if (_isSwf && _swfMovieClip) {
					_swfMovieClip.stop();				
				} else if (_stream) {
					_stream.pause();
				}
				_intervalTimer.stop();
				_playing = false;
				
			}		
		}
		[Bindable]
		public function get volume():Number {
			return this._volume;
		}
		public function set volume(value:Number):void {
			if (value < 0) { value = 0; }
			if (value > 1) { value = 1; }
		 	var transform:SoundTransform = new SoundTransform();
			transform.volume = value;
			if (_isSwf && _swfMovieClip) {
				_swfMovieClip.soundTransform = transform;			
			} else if (_stream) {
				_stream.soundTransform = transform;
			}
			_volume = value;

		}
		
		[Bindable("timeUpdate")]
		public function get currentTime():Number {			
			if (_isSwf && _swfMovieClip) {
				return (new Number(_swfMovieClip.currentFrame) / _swfFps);
			} else if (_stream && _stream.time) {
				return _stream.time;
			}
			return 0;
		}		
		public function set currentTime(value:Number):void {
			_ended = false;
			if (_isSwf && _swfMovieClip) {
				if (_playing) {
					_swfMovieClip.gotoAndPlay(new int(value * _swfFps));
				} else {
					_swfMovieClip.gotoAndStop(new int(value * _swfFps));
				}
				_ended = false;
				dispatchEvent(new Event('seeked'));
				dispatchEvent(new Event('timeUpdate'));
			} else if (_stream) {
				_previousTime = _stream.time;
				_stream.seek(value);
			}
			
		}
		[Bindable("readonly",event="timeUpdate")]
		public function get duration():Number {						
			if (_stream) {
				/* Sometimes, duration cannot be renedered at instant... */
				return Math.max(_stream.time, _duration);		
			}
			return (_duration);
		}
		
		public function get autoPlay():Boolean {
			return _autoPlay;
		}
		public function set autoPlay(value:Boolean):void {
			_autoPlay = value;
		}
		public function get loop():Boolean {
			return _loop;
		}
		public function set loop(value:Boolean):void {
			_loop = value;
		}
		
		
		[Bindable]
		public function get src():String {
			return _src;
		}
		public function set src(value:String):void {
			if (_src) { throw new Error('Changing src is currently unsupported.'); }
			if (!value.match(/\.(flv|mp4|swf)$/)) {
				throw new Error('Unsupported File Type');
				return;
			}
			_src = value;
			this.loadVideo(value);			
		}
		
		[Bindable("readonly")]
		public function get keyframeTimes():Array {						
			if (_stream) {
				return _keyframeTimes;
			}
			return [];
		}

		/*
		 	var transform:SoundTransform = new SoundTransform();
			transform.volume = this._volume;
			this.swfMovieClip.soundTransform = transform;
		 */
	}
	
}