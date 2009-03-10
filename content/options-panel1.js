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
   if (!Ci.nsINavBookmarksService) {
    document.getElementById('pref-nicomonkey.supertag').value = false; 
    document.getElementById('pref-nicomonkey.superlist').value = false; 
    document.getElementById('nicomonkey.supertag').style.display = 'none';
    document.getElementById('nicomonkey.superlist').style.display = 'none'; 
  }
  toolbarSwitch();
  nicomonkeySwitch();
}


