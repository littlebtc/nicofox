var Cc = Components.classes;
var Ci = Components.interfaces;

function nicomonkeySwitch()
{
	checked = document.getElementById('nicomonkey.enable').checked;
	if (!checked)
	{
		document.getElementById('nicomonkey.toolbar').disabled = false;
		document.getElementById('nicomonkey.comment_helper').disabled = false;
		document.getElementById('nicomonkey.player_killer').disabled = false;
	}
	else
	{
		document.getElementById('nicomonkey.toolbar').disabled = true;
		document.getElementById('nicomonkey.comment_helper').disabled = true;
		document.getElementById('nicomonkey.player_killer').disabled = true;
	}
}
function updatePanel1()
{
	checked = document.getElementById('nicomonkey.enable').checked;
	if (checked)
	{
		document.getElementById('nicomonkey.toolbar').disabled = false;
		document.getElementById('nicomonkey.player_killer').disabled = false;
	}
	else
	{
		document.getElementById('nicomonkey.toolbar').disabled = true;
		document.getElementById('nicomonkey.player_killer').disabled = true;
	}
}

