var Cc = Components.classes;
var Ci = Components.interfaces;

var prefPaneDownload = {
  /* When sync save_path from preference, fill the path to the filefield */
  displaySavePath: function() {
    var savePathPref = document.getElementById("pref-save_path");
    var savePath = document.getElementById("save_path");
    if (savePathPref.value) {
      savePath.file = savePathPref.value;
      savePath.label = savePathPref.value.leafName;
    } else {
      savePath.file = null;
    }
    return undefined;
  },
  /* Show the file picker to choose the save path. */
  chooseSavePath: function() {
    var savePathPref = document.getElementById("pref-save_path");
    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    filePicker.init(window, document.getElementById('nicofox-strings').getString('chooseFolder'), Ci.nsIFilePicker.modeGetFolder);
    if (savePathPref.value) {
      filePicker.displayDirectory = savePathPref.value;
    }
    if (filePicker.show() == Ci.nsIFilePicker.returnOK) {
      savePathPref.value = filePicker.file;
      /* Real update on UI will happend in displaySavePath */
    }
  },
  /* When sync autologin_username from preference,
   * check if the <menulist> is "Locked", then append the username. */
  displayAutologinUsername: function() {
    var autologinUsernamePref = document.getElementById("pref-autologin_username");
    var autologinUsername = document.getElementById('autologin_username');
    if (autologinUsername.disabled) {
      /* If it is "Locked", just append a new disabled item on the menulist. */
      autologinUsername.removeAllItems();
      if (autologinUsernamePref.value) {
        autologinUsername.appendItem(autologinUsernamePref.value, autologinUsernamePref.value, null);
      } else {
        autologinUsername.appendItem(document.getElementById('nicofox-strings').getString('noAutoLogin'), '', null);
      }
      autologinUsername.selectedIndex = 0;
    } else {
      /* If it is not "Locked", check whether the item is in the list */
      autologinUsername.selectedIndex = 0;
      for (var i = 0; i < autologinUsername.itemCount; i++) {
        var item = autologinUsername.getItemAtIndex(i);
        if (autologinUsernamePref.value == item.value) {
          autologinUsername.selectedIndex = i;
        }
      }
    }
    return (autologinUsernamePref.value)? autologinUsernamePref.value : '';
  },
  /* "Unlock" the autologin username option. */
  unlockAutologin: function() {
    var autologinUsernamePref = document.getElementById("pref-autologin_username");
    var autologinUsername = document.getElementById('autologin_username');
   /* Get account infos from the password manager (may require master password),
      exception may be happened if master password is not presented. */
    try {
      var loginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
      var logins = loginManager.findLogins({}, 'https://secure.nicovideo.jp', 'https://secure.nicovideo.jp', null);
    } catch(ex) {
      alert(ex);
      return;
    }
    /* Construct the <menulist> */
    autologinUsername.removeAllItems();
    autologinUsername.appendItem(document.getElementById('nicofox-strings').getString('noAutoLogin'), '', null);
    if (!autologinUsernamePref.value) autologinUsername.selectedIndex = 0;
    for (var i = 0; i < logins.length; i++) {
      autologinUsername.appendItem(logins[i].username, logins[i].username, null);
      if (autologinUsernamePref.value == logins[i].username) {
        autologinUsername.selectedIndex = i + 1;
      }
    }
    /* Enable the <menulist> and hide unlock and remove button. */
    autologinUsername.disabled = false;
    document.getElementById('autologin_select').hidden = true;
    document.getElementById('autologin_remove').hidden = true;
    document.getElementById('autologin_username').focus();
  },
  /* Remove the autologin username setting, regardless of password manager security */
  removeAutologin: function() {
    document.getElementById('pref-autologin_username').value = '';
    document.getElementById('autologin_remove').hidden = true;
  }
};
