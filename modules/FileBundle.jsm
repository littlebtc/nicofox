/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * When we download a video package from Nico Nico Douga, we should download a lot of files actually:
 * Video file, Comment XML file, Uploader's Comment XML file, Thumbnails, ...
 * This bundle is an approach to manager these files effieiently.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = [ "FileBundle" ];

let FileBundle = {};

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://nicofox/Core.jsm");

/* Fix common reserved characters in filesystems by converting to full-width */
function fixReservedCharacters(title) {
  title = title.replace(/\//g, "\uFF0F");
  title = title.replace(/\\/g, "\uFF3C");
  title = title.replace(/\?/g, "\uFF1F");
  title = title.replace(/\%/g, "\uFF05");
  title = title.replace(/\*/g, "\uFF0A");
  title = title.replace(/\:/g, "\uFF1A");
  title = title.replace(/\|/g, "\uFF5C");
  title = title.replace(/\"/g, "\uFF02");
  title = title.replace(/\</g, "\uFF1C");
  title = title.replace(/\>/g, "\uFF1E");
  title = title.replace(/\+/g, "\uFF0B");
  return title;
}
/* Create a file instance for a specific file name under a nsILocalFile path */
function createFileInstanceWithPath(path, fileName) {
  var file = path.clone();
  file.append(fileName);
  return file;
}
/* Constructor: A file bundle for Nico Nico Douga Videos
   Will check if all the files in the bundle can be successfully created
 * @param info  the video info read by VideoInfoReader
 */
FileBundle.nico = function(info) {
  /* File storage */
  this.videoFormat = "";
  this.files = {};
  this.fileTitle = Core.prefs.getComplexValue('filename_scheme', Ci.nsISupportsString).data;
    
  this.fileTitle = this.fileTitle.replace(/\%TITLE\%/, fixReservedCharacters(info.nicoData.title))
                                 .replace(/\%ID\%/, fixReservedCharacters(info.nicoData.id));
   
  /* Add comment type in filename */
  if (info.commentType != 'www' && info.commentType) {
    this.fileTitle = this.fileTitle.replace(/\%COMMENT\%/, fixReservedCharacters('['+info.commentType+']'));
  } else {
    this.fileTitle = this.fileTitle.replace(/\%COMMENT\%/, '');
  }
  /* Initialized nsILocalFile instances */
  /* Files contained in bundles (if fileName is fileTitle):
   * CONSTANT (won't change at any tine)
   * 1. Video (fileTitle.flv or fileTitle.mp4 or fileTitle.swf)
   *    When original quality video is downloading, [HQ] postfix will be added to the leaf name.
   * 2. Thumbnail (fileTitle.jpg)
   * VARIANT (will change with time)
   * 3. Comment (fileTitle.xml)
   * 4. Uploader's Comment (fileTitle[Owner].xml; may be absent)
   */
  var savePath = Core.prefs.getComplexValue("save_path", Ci.nsILocalFile);
  
  /* We are unsure with file format this time, so just give it a try */
  this.files.videoFlv = createFileInstanceWithPath(savePath, this.fileTitle + ".flv");
  this.files.videoMp4 = createFileInstanceWithPath(savePath, this.fileTitle + ".mp4");
  this.files.videoFlvHQ = createFileInstanceWithPath(savePath, this.fileTitle + "[HQ].flv");
  this.files.videoMp4HQ = createFileInstanceWithPath(savePath, this.fileTitle + "[HQ].mp4");
  this.files.videoSwf = createFileInstanceWithPath(savePath, this.fileTitle + ".swf");
  this.files.thumbnail = createFileInstanceWithPath(savePath, this.fileTitle + "[ThumbImg].jpeg");
  
  this.files.comment = createFileInstanceWithPath(savePath, this.fileTitle + ".xml");
  this.files.uploaderComment = createFileInstanceWithPath(savePath, this.fileTitle + "[Owner].xml");
}

/* Check if any of file in bundle exists (so the bundle is occupied).  */
FileBundle.nico.prototype.occupied = function() {
  var savePath = Core.prefs.getComplexValue("save_path", Ci.nsILocalFile);
  var constExists = false;
  /* XXX: Why check every format? */
  if (this.files.videoFlv.exists() || this.files.videoMp4.exists() || this.files.videoSwf.exists() ||
      this.files.videoFlvHQ.exists() || this.files.videoMp4HQ.exists() ||
     this.files.thumbnail.exists()) {
    constExists = true;
  }
  var variantExists = false;
  this.files.comment = createFileInstanceWithPath(savePath, this.fileTitle + ".xml");
  this.files.uploaderComment = createFileInstanceWithPath(savePath, this.fileTitle + "[Owner].xml");
  if (this.files.comment.exists() || this.files.uploaderComment.exists()) {
    variantExists = true;
  } 
 
  if (constExists || variantExists) {
    return true;
  }
  return false;

};
/* Set video type; point this.files.video to the right file */
FileBundle.nico.prototype.setVideoType = function(format) {
  switch(format) {
    case "swf":
    this.files.video = this.files.videoSwf;
    break;
    case "mp4":
    this.files.video = this.files.videoMp4;
    break;
    case "flv":
    default:
    this.files.video = this.files.videoFlv;
    format = "flv";
  }
  this.videoFormat = format;
};
/* Create temp file for video download */
FileBundle.nico.prototype.createVideoTemp = function() {
  var savePath = Core.prefs.getComplexValue("save_path", Ci.nsILocalFile);
  this.files.videoTemp = createFileInstanceWithPath(savePath, this.fileTitle + "." + this.videoFormat + ".part");
  /* XXX: Video temp checks is separated from occupied() to reduce possible API access on DownloadUtils. Is this right? */
  try {
    /* If exists, try to delete it */
    if (this.files.videoTemp.exists()) {
      this.files.videoTemp.remove(false);
    }
  } catch(e) {
    return false;
  }
  return true;
};

/* Create and set the default download folder. Return true for success, false for failure. */
FileBundle.setDefaultPath = function() {
  /* MacOS X:         Movies/NicoFox
     Windows Vista/7: Videos/NicoFox 
     Windows XP/2k  : My Documents/NicoFox (Since it's hard to get where Video is)
     Linux XDG:       Videos/NicoFox
     Fallback:        ~/NicoFox */

  /* Step 1: Find the root folder for NicoFox on each OS */
  var downloadDir = null;
  var os = Services.appinfo.OS;
  if (os == "WINNT") {
    /* Are we in Windows Vista/7 and Gecko 2.0 (js-ctypes don't support pointer until bug 513788 landed)? */
    var oscpu = Cc["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).oscpu;
    Components.utils.import("resource://gre/modules/ctypes.jsm");
    if (oscpu.search(/Windows NT 6\./)!= -1 && ctypes.jschar) {
      /* Use js-ctypes to fetch where Videos folder is since nsIDirectoryService doesn't know it.
         Since CSIDL is somehow deprecated, is there a good way to do parse GUID to js-ctypes? */
      var lib = ctypes.open("shell32.dll");
      var CSIDL_MYVIDEO = 0x000E;
      var MAX_PATH = 1024;
      var pathArray = new (ctypes.jschar.array(MAX_PATH));
      /* Try to find the working ABI
         http://forums.mozillazine.org/viewtopic.php?f=23&t=2059667
         Before Bug 585175 landed: use ctypes.stdcall_abi
         After Bug 585175 landed: ctypes.default_abi for 64-bit, ctypes.winapi_abi for 32-bit
       */
      var winAbi = ctypes.stdcall_abi;
      if (ctypes.winapi_abi) {
        if (ctypes.size_t.size == 8) {
          winAbi = ctypes.default_abi;
        } else {
          winAbi = ctypes.winapi_abi;
        }
      }
      var SHGetSpecialFolderPath = lib.declare("SHGetSpecialFolderPathW",
                                               winAbi,
                                               ctypes.bool, /* bool(return) */
                                               ctypes.int32_t, /* HWND hwnd */
                                               ctypes.jschar.ptr, /* LPTSTR lpszPath */
                                               ctypes.int32_t, /* int csidl */
                                               ctypes.bool /* BOOL fCreate */);
      var result = SHGetSpecialFolderPath(0, pathArray, CSIDL_MYVIDEO, true);
      /* Read path and parse it into nsILocalFile for successful execution. */
      if (result) {
        downloadDir = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
        downloadDir.initWithPath(pathArray.readString());
      }
    }
    /* Fallback to My Documents if we cannot find Videos folder. */
    if (!downloadDir) {
      downloadDir = Services.dirsvc.get("Pers", Ci.nsILocalFile);
    }
  } else if (os == "Darwin") {
    /* Fro OSX, try NS_OSX_MOVIE_DOCUMENTS_DIR */
    downloadDir = Services.dirsvc.get("Mov", Ci.nsILocalFile);
  } else {
    /* Others */
    try {
      downloadDir = Services.dirsvc.get("XDGVids", Ci.nsILocalFile);
    } catch(e) {
      downloadDir = Services.dirsvc.get("Home", Ci.nsILocalFile);
    }
  }
  /* Step 2: Append NicoFox and do some check; create if not exists. */
  downloadDir.append("NicoFox");
  if (downloadDir.exists()) {
    if (!downloadDir.isWritable() || !downloadDir.isDirectory()) {
      return false;
    }
  } else {
    try {
      downloadDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0755);
    } catch(e) {
      return false;
    }
  }
  Core.prefs.setComplexValue("save_path", Ci.nsILocalFile, downloadDir);

};

/* Check if the user had installed NNDD for video downloading */
FileBundle.isNNDDFolder = function() {
  var logFile = Core.prefs.getComplexValue("save_path", Ci.nsILocalFile);
  logFile.append("nndd.log");
  return logFile.exists();
};
