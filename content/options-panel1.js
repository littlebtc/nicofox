var Cc = Components.classes;
var Ci = Components.interfaces;

function nicomonkeySwitch() {
  var checked = document.getElementById('pref-nicomonkey.enable').value;
  var groupbox = document.getElementById('nicomonkey-groupbox');
  if (checked) { var disabled = false; }
  else { var disabled = true; }

  var checkboxes = groupbox.getElementsByTagName('checkbox');
  for (i = 0; i < checkboxes.length; i++) {
    checkboxes[i].setAttribute('disabled', disabled);
  }

  var disabled = (disabled || (!(document.getElementById('pref-nicomonkey.toolbar').value)?true:false));
  var menulists = groupbox.getElementsByTagName('menulist');
  for (i = 0; i < menulists.length; i++) {
    menulists[i].setAttribute('disabled', disabled);
  }
}
function toolbarSwitch() {
  var checked = document.getElementById('pref-nicomonkey.toolbar').value;
  var groupbox = document.getElementById('nicomonkey-groupbox');
  if (checked) { var disabled = false; }
  else { var disabled = true; }

  var menulists = groupbox.getElementsByTagName('menulist');
  for (i = 0; i < menulists.length; i++) {
    menulists[i].setAttribute('disabled', disabled);
  }
}
function updatePanel1() {
  /* Disable function for non-firefox */
  var xulapp_info = Cc["@mozilla.org/xre/app-info;1"]
                    .getService(Ci.nsIXULAppInfo);  
  if (xulapp_info.ID != '{ec8030f7-c20a-464f-9b0e-13a3a9e97384}') {
    document.getElementById('pref-nicomonkey.supertag').value = false; 
    document.getElementById('pref-nicomonkey.superlist').value = false; 
    document.getElementById('nicomonkey.supertag').style.display = 'none';
    document.getElementById('nicomonkey.superlist').style.display = 'none'; 
  }
  toolbarSwitch();
  nicomonkeySwitch();
}


