var Cc = Components.classes;
var Ci = Components.interfaces;


function updatePanel3()
{
  updateVideoPlayer();
  updateSwfPlayer();
}
function updateVideoPlayer() {

  var external_video_player = document.getElementById("pref-external_video_player").value;
  var external_video_player_path_element = document.getElementById("external_video_player_path");
  if (external_video_player) {
    var external_video_player_path = document.getElementById("pref-external_video_player_path").value;
    if (external_video_player_path) {
      external_video_player_path_element.file = external_video_player_path;
      external_video_player_path_element.label = external_video_player_path.leafName;
    }
  } else {
    external_video_player_path_element.file = '';
    external_video_player_path_element.label = '';
  }
}
function updateSwfPlayer() {
  var external_swf_player = document.getElementById("pref-external_swf_player").value;
  var external_swf_player_path_element = document.getElementById("external_swf_player_path");
  if (external_swf_player) {
    var external_swf_player_path = document.getElementById("pref-external_swf_player_path").value;
    if (external_swf_player_path) {
      external_swf_player_path_element.file = external_swf_player_path;
      external_swf_player_path_element.label = external_swf_player_path.leafName;
    }
  } else {
    external_swf_player_path_element.file = '';
    external_swf_player_path_element.label = '';
  }
}
function selectVideoPlayer() {
  var file_picker = Cc["@mozilla.org/filepicker;1"]
                    .createInstance(Ci.nsIFilePicker);
  file_picker.init(window, document.getElementById('nicofox-strings').getString('chooseExecutable'), null);
  file_picker.appendFilters(Ci.nsIFilePicker.filterApps);
  if (file_picker.show() == Ci.nsIFilePicker.returnOK) {
    document.getElementById("pref-external_video_player_path").value = file_picker.file;
    document.getElementById("pref-external_video_player").value = true;
    updatePanel3();
  }
}

function selectSwfPlayer() {
  var file_picker = Cc["@mozilla.org/filepicker;1"]
                    .createInstance(Ci.nsIFilePicker);
  file_picker.init(window, document.getElementById('nicofox-strings').getString('chooseExecutable'), null);
  file_picker.appendFilters(Ci.nsIFilePicker.filterApps);
  if (file_picker.show() == Ci.nsIFilePicker.returnOK) {
    document.getElementById("pref-external_swf_player_path").value = file_picker.file;
    document.getElementById("pref-external_swf_player").value = true;
    updatePanel3();
  }
}
