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

Components.utils.import("resource://nicofox/Services.jsm");
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
   * 2. Thumbnail (fileTitle.jpg)
   * VARIANT (will change with time)
   * 3. Comment (fileTitle.xml)
   * 4. Uploader's Comment (fileTitle[Owner].xml; may be absent)
   */
  var savePath = Core.prefs.getComplexValue("save_path", Ci.nsILocalFile);
  
  /* We are unsure with file format this time, so just give it a try */
  this.files.videoFlv = createFileInstanceWithPath(savePath, this.fileTitle + ".flv");
  this.files.videoMp4 = createFileInstanceWithPath(savePath, this.fileTitle + ".mp4");
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

/* Check if the user had installed NNDD for video downloading */
FileBundle.isNNDDFolder = function() {
  var logFile = Core.prefs.getComplexValue("save_path", Ci.nsILocalFile);
  logFile.append("nndd.log");
  return logFile.exists();
};
