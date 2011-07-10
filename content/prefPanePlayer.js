var Cc = Components.classes;
var Ci = Components.interfaces;

var prefPanePlayer = {
  /* When sync external_video_player_path or external_swf_player_path from preference, fill the path to the filefield
   * @param  type  Type of the preference to read: 'video' or 'swf'. */
  displayPlayer: function(type) {
    if (type !== "video" && type !== "swf") { return; }
    var playerPref = document.getElementById("pref-external_" + type + "_player");
    var playerPathPref = document.getElementById("pref-external_" + type + "_player_path");
    var playerPath = document.getElementById("external_" + type + "_player_path");
    if (playerPref.value) {
      if (playerPathPref.value) {
        playerPath.file = playerPathPref.value;
      }
    } else {
      /* If the player is not enabled, do not should the label. */
      playerPath.file = null;
      playerPath.label = '';
    }
    return undefined;
  },
  /* Show the file picker to choose external_video_player_path or external_swf_player_path.
   * @param  type  Type of the preference to read: 'video' or 'swf'. */
  choosePlayer: function(type) {
    if (type !== "video" && type !== "swf") { return; }
    var playerPref = document.getElementById("pref-external_" + type + "_player");
    var playerPathPref = document.getElementById("pref-external_" + type + "_player_path");
    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    filePicker.init(window, document.getElementById('nicofox-strings').getString('chooseExecutable'), null);
    filePicker.appendFilters(Ci.nsIFilePicker.filterApps);
    if (playerPathPref.value) {
      filePicker.displayDirectory = playerPathPref.value.parent;
    }
    if (filePicker.show() == Ci.nsIFilePicker.returnOK) {
      playerPathPref.value = filePicker.file;
      /* Enable external player if does not */
      if (!playerPref.value) {
        playerPref.value = true;
      }
      /* Real update on UI will happend in displayPlayer */
    }
  }
};
