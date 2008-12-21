var Cc = Components.classes;
var Ci = Components.interfaces;

function nicomonkeySwitch() {
  var checked = document.getElementById('pref-nicomonkey.enable').value;
  var groupbox = document.getElementById('nicomonkey-groupbox');
  if (!checked) { checked = false; }
  else { checked = true; }

  var checkboxes = groupbox.getElementsByTagName('checkbox');
  for (i = 0; i < checkboxes.length; i++) {
    checkboxes[i].setAttribute('disabled', checked);
  }

  var checked = (checked || ((document.getElementById('pref-nicomonkey.toolbar').value)?false:true));
  var menulists = groupbox.getElementsByTagName('menulist');
  for (i = 0; i < menulists.length; i++) {
    menulists[i].setAttribute('disabled', checked);
  }
}
function toolbarSwitch() {
  var checked = document.getElementById('pref-nicomonkey.toolbar').value;
  var groupbox = document.getElementById('nicomonkey-groupbox');
  if (!checked) { checked = false; }
  else { checked = true; }

  var menulists = groupbox.getElementsByTagName('menulist');
  for (i = 0; i < menulists.length; i++) {
    menulists[i].setAttribute('disabled', checked);
  }
}
function updatePanel1() {

  var checked = document.getElementById('pref-nicomonkey.enable').value;
  var groupbox = document.getElementById('nicomonkey-groupbox');
  if (checked) { var disabled = false; }
  else { var disabled = true; }

  var checkboxes = groupbox.getElementsByTagName('checkbox');
  for (i = 0; i < checkboxes.length; i++) {
    checkboxes[i].setAttribute('disabled', disabled);
  }
  var disabled = ! (checked & ((document.getElementById('pref-nicomonkey.toolbar').value)?true:false));
  var menulists = groupbox.getElementsByTagName('menulist');
  for (i = 0; i < menulists.length; i++) {
    menulists[i].setAttribute('disabled', disabled);
  }

}

