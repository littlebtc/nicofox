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
  toolbarSwitch();
  nicomonkeySwitch();
}

