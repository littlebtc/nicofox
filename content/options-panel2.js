var Cc = Components.classes;
var Ci = Components.interfaces;


function updatePanel2()
{
	var save_path = document.getElementById("pref-save_path").value;
	if (save_path)
	{
		var save_path_element = document.getElementById("save_path");
		save_path_element.file = save_path;
		save_path_element.label = save_path.leafName;
	}

	/* Update the username for menulist */
	if (document.getElementById('pref-autologin_username').value)
	{
		document.getElementById('autologin_username').appendItem(document.getElementById('pref-autologin_username').value, document.getElementById('pref-autologin_username').value, null);
		document.getElementById('autologin_username').selectedIndex = 0 ;
	}
	else
	{
		document.getElementById('autologin_username').appendItem(document.getElementById('nicofox-strings').getString('noAutoLogin'), '', null);
		document.getElementById('autologin_username').selectedIndex = 0 ;
                document.getElementById('autologin_remove').hidden = true;
	}

}
function selectDir(title)
{
	var file_picker = Cc["@mozilla.org/filepicker;1"]
	                  .createInstance(Ci.nsIFilePicker);
	file_picker.init(window, document.getElementById('nicofox-strings').getString('chooseFolder'), Ci.nsIFilePicker.modeGetFolder);
	if (file_picker.show() == Ci.nsIFilePicker.returnOK)
	{
		document.getElementById("pref-save_path").value = file_picker.file;
	updatePanel2();
	}
}


function readUsernames()
{ 
   try {
     /* Remove the default setting */
     document.getElementById('autologin_username'). removeAllItems();

     var login_manager = Cc["@mozilla.org/login-manager;1"]
                         .getService(Ci.nsILoginManager);
     /* Nico uses secure.nicovideo.jp for login */
     var logins = login_manager.findLogins({}, 'http://www.nicovideo.jp', 'https://secure.nicovideo.jp', null);
     document.getElementById('autologin_username').appendItem(document.getElementById('nicofox-strings').getString('noAutoLogin'), '', null);
     document.getElementById('autologin_username').selectedIndex = 0;
     for (var i = 0; i < logins.length; i++)
     {
	document.getElementById('autologin_username').appendItem(logins[i].username, logins[i].username, null);
        /* Select the username in preferences */
        if (document.getElementById('pref-autologin_username').value == logins[i].username)
          document.getElementById('autologin_username').selectedIndex = i+1;
     }
     /* Let's begin! */
     document.getElementById('autologin_username').disabled = false;
     document.getElementById('autologin_select').hidden = true;
     document.getElementById('autologin_remove').hidden = true;
     document.getElementById('autologin_username').focus();

   }
   catch(ex) {
     alert(ex);
     
   }

}

/* Remove the username setting, regardless of password manager security */
function removeUsername()
{
     document.getElementById('autologin_username'). removeAllItems();
     document.getElementById('autologin_username').appendItem(document.getElementById('nicofox-strings').getString('noAutoLogin'), '', null);
     document.getElementById('autologin_username').selectedIndex = 0;

     /* Value will not auto updated :( */
     document.getElementById('pref-autologin_username').value = '';
     document.getElementById('autologin_remove').hidden = true;
}
