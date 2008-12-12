var Cc = Components.classes;
var Ci = Components.interfaces;

function nicomonkeySwitch() {
  checked = document.getElementById('pref-nicomonkey.enable').value;
  var groupbox = document.getElementById('nicomonkey-groupbox');
  if (!checked) { checked = false; }
  else { checked = true; }

  var checkboxes = groupbox.getElementsByTagName('checkbox');
  for (i = 0; i < checkboxes.length; i++) {
    checkboxes[i].setAttribute('disabled', checked);
  }

  var menulists = groupbox.getElementsByTagName('menulist');
  for (i = 0; i < menulists.length; i++) {
    menulists[i].setAttribute('disabled', checked);
  }
}
function updatePanel1() {

  checked = document.getElementById('pref-nicomonkey.enable').value;
  var groupbox = document.getElementById('nicomonkey-groupbox');
  if (checked) { var disabled = false; }
  else { var disabled = true; }

  var checkboxes = groupbox.getElementsByTagName('checkbox');
  for (i = 0; i < checkboxes.length; i++) {
    checkboxes[i].setAttribute('disabled', disabled);
  }

  var menulists = groupbox.getElementsByTagName('menulist');
  for (i = 0; i < menulists.length; i++) {
    menulists[i].setAttribute('disabled', disabled);
  }

}

