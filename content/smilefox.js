var Cc = Components.classes;
var Ci = Components.interfaces;

/* Import Download manager Javascript code modules */
Components.utils.import('resource://nicofox/common.js');
Components.utils.import('resource://nicofox/download_manager.js');

var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
	              .getService(Ci.nsIPromptService);
var rows = new Array();

var listener = 
{
  add: function(id, content) {
    if ((typeof content) != 'object') return false;

    content.id = id;
    rows.unshift(content);
    updateTreeCount(0, 1);
    var keyword = document.getElementById('smilefox-search').value;
    if (keyword) {
      doSearch();
    } else {
      document.getElementById('smilefox-tree').boxObject.scrollToRow(0);
    }
  },
  remove: function(id) {
    rows = rows.filter(function(element, index, array) {
      if (element.id == id)
      {
        updateTreeCount(index, -1);
      }
      else
      {
        return true;
      }
    });
    
  },
  update: function(id, content) {
    rows.forEach(function(element, index, array) {
      if (element.id == id)
      {
        for (key in content) {
	  array[index][key] = content[key];
	}
        updateTreeRow(index);
	updateRowSpeed(index);
      }
    });
  },
  stop: function() {
    updateToolbar();
  },
  rebuild: function() {
    document.getElementById('smilefox-search').value = '';
    doSearch();
  }
}

nicofox_download_listener.addListener(listener);

/* When unloading, don't clean query after canceling */
var unloading = false;

/* Strings will be loaded in load() */
var strings = null;

var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.nicofox.");

var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
	              .getService(Ci.nsIPromptService);
var recent_row = -1;
var popup_command = 
{
	recent_row: -1,
	multiple_select: true, 
	cancel: function()
	{
		if (recent_row < 0) { return; }	
		nicofox_download_manager.cancel(rows[recent_row].id);
	},
	retry: function()
	{
		if (recent_row < 0) { return; }	
		nicofox_download_manager.retry(rows[recent_row].id);
	},
	open: function() {
		if (recent_row < 0) { return; }
		if (!rows[recent_row].video_file) { return; }
		if (!rows[recent_row].video_file.match(/\.(flv|mp4)$/)) { return; }

		var file = Cc["@mozilla.org/file/local;1"]
		           .createInstance(Ci.nsILocalFile);
		file.initWithPath(rows[recent_row].video_file);
		if (!file.exists()) { return false; }
		var video_uri = Cc["@mozilla.org/network/io-service;1"]
	          .getService(Ci.nsIIOService).newFileURI(file);
		var video_uri_spec = video_uri.spec;
		var comment_uri_spec = '';

		if (rows[recent_row].comment_file) {
		  var file = Cc["@mozilla.org/file/local;1"]
		             .createInstance(Ci.nsILocalFile);
		  file.initWithPath(rows[recent_row].comment_file);
		  if (!file.exists()) { return false; }
		  var comment_uri = Cc["@mozilla.org/network/io-service;1"]
	            .getService(Ci.nsIIOService).newFileURI(file);
		  comment_uri_spec = comment_uri.spec; 
		}
		
		window.openDialog('chrome://nicofox/content/nicofox_player.xul', 'nicofox_swf', 'width=520,height=470, resizable=yes', {video: video_uri_spec, comment: comment_uri_spec, title: rows[recent_row].video_title});	
	
	
	}, 
	openExternal: function()
	{
		if (recent_row < 0) { return; }
		if (!rows[recent_row].video_file) { return; }

		var file = Cc["@mozilla.org/file/local;1"]
		           .createInstance(Ci.nsILocalFile);
		file.initWithPath(rows[recent_row].video_file);
		if (!file.exists()) { return false; }

		/*  flv/mp4/swf detection and custom player */
		if (prefs.getBoolPref("external_video_player") && rows[recent_row].video_file.match(/(flv|mp4)$/))
		{

			var external_video_player_path = prefs.getComplexValue("external_video_player_path", Components.interfaces.nsILocalFile);

			var os_string = Cc["@mozilla.org/xre/app-info;1"]  
			.getService(Ci.nsIXULRuntime).OS;  
			var process;
			var file_path;
			if (os_string == 'WINNT')
			{
				/* Using IWinProcess by dafi to fix the poor Unicode support of nsIProcss 
				   See: http://dafizilla.wordpress.com/2008/10/08/nsiprocess-windows-and-unicode/ */
				process = Cc["@dafizilla.sourceforge.net/winprocess;1"]
				.createInstance()
				.QueryInterface(Ci.IWinProcess);
				file_path = file.path;
			} 
			else
			{
				process = Components.classes["@mozilla.org/process/util;1"]
				.createInstance(Components.interfaces.nsIProcess);
				var unicode_converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
				                        .createInstance(Ci.nsIScriptableUnicodeConverter);
				unicode_converter.charset = 'utf-8';			
				file_path = unicode_converter.ConvertFromUnicode(file.path);
			}
			process.init(external_video_player_path);
			var parameter = [file_path];
			process.run(false, parameter, 1);
			return;
		}
		if (prefs.getBoolPref("external_swf_player") && rows[recent_row].video_file.match(/(swf)$/))
		{
			var external_swf_player_path = prefs.getComplexValue("external_swf_player_path", Components.interfaces.nsILocalFile);

			var os_string = Cc["@mozilla.org/xre/app-info;1"]  
			.getService(Ci.nsIXULRuntime).OS;  
			var process;
			if (os_string == 'WINNT')
			{
				/* Using IWinProcess by dafi to fix the poor Unicode support of nsIProcss 
				   See: http://dafizilla.wordpress.com/2008/10/08/nsiprocess-windows-and-unicode/ */
				process = Cc["@dafizilla.sourceforge.net/winprocess;1"]
				.createInstance()
				.QueryInterface(Ci.IWinProcess);
				
			}
			else
			{
				process = Components.classes["@mozilla.org/process/util;1"]
				.createInstance(Components.interfaces.nsIProcess);
			}
			process.init(external_swf_player_path);
			var parameter = [file.path];
			process.run(false, parameter, 1);
			return;
		}
		/* Normal approach */
		try
		{
			file.launch();
		}
		catch(e)
		/* For *nix, launch() didn't work, so...  */
		/* See also: http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/downloads/content/downloads.js */
		{
			var uri = Cc["@mozilla.org/network/io-service;1"]
			          .getService(Ci.nsIIOService).newFileURI(file);
			var protocol_service = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
			                       .getService(Ci.nsIExternalProtocolService);
			protocol_service.loadUrl(uri);

		}

	},
	openSwfPlayer: function()
	{

		if (recent_row < 0) { return; }
		if (!rows[recent_row].video_file) { return; }
		if (!rows[recent_row].video_file.match(/\.swf$/)) { return; }

		var file = Cc["@mozilla.org/file/local;1"]
		           .createInstance(Ci.nsILocalFile);
		file.initWithPath(rows[recent_row].video_file);
		if (!file.exists()) { return false; }
		var video_uri = Cc["@mozilla.org/network/io-service;1"]
	          .getService(Ci.nsIIOService).newFileURI(file);

		var file = Cc["@mozilla.org/file/local;1"]
		           .createInstance(Ci.nsILocalFile);
		file.initWithPath(rows[recent_row].comment_file);
		if (!file.exists()) { return false; }
		var comment_uri = Cc["@mozilla.org/network/io-service;1"]
	          .getService(Ci.nsIIOService).newFileURI(file);
		
		window.open(video_uri.spec, 'nicofox_swf', 'width=512,height=384, resizable=yes');
	},
	openFolder: function()
	{
		if (recent_row < 0) { return; }
		if (!rows[recent_row].video_file) { return; }
		
		var file = Cc["@mozilla.org/file/local;1"]
		           .createInstance(Ci.nsILocalFile);
		file.initWithPath(rows[recent_row].video_file);
		if (!file.exists()) { return false; }
		//file = file.parent;
		try
		{
			file.reveal();
		}
		catch(e)
		/* For *nix, launch() didn't work, so...  */
		/* See also: http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/downloads/content/downloads.js */
		{
			file = file.parent;
			var uri = Cc["@mozilla.org/network/io-service;1"]
			          .getService(Ci.nsIIOService).newFileURI(file);
			var protocol_service = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
			                       .getService(Ci.nsIExternalProtocolService);
			protocol_service.loadUrl(uri);

		}
	},
	go: function()
	{
		if (recent_row < 0) { return; }
		if (!rows[recent_row].url) { return; }
		openInNewTab(rows[recent_row].url);
	},
	copy: function()
	{
		if (recent_row < 0) { return; }
		if (!rows[recent_row].url) { return; }	
		var clipboard_helper = Cc["@mozilla.org/widget/clipboardhelper;1"]  
		                       .getService(Ci.nsIClipboardHelper);  
		clipboard_helper.copyString(rows[recent_row].url);  
	},
	selectAll: function()
	{
		document.getElementById('smilefox-tree').view.selection.rangedSelect(0, rows.length, true);
		document.getElementById('smilefox-tree').focus();
	},
	remove: function()
	{
		tree = document.getElementById('smilefox-tree'); 
		var start = new Object();
		var end = new Object();
		var count = 0;
		var removing_ids = [];
		for (i = 0; i < tree.view.selection.getRangeCount(); i++)
		{
			tree.view.selection.getRangeAt(i, start, end);
			for (var j = start.value; j <= end.value; j++)
			{
				/* when it is failed, completed, canceled or waiting, we can remove it */
				if(rows[j].status <= 4)
				{
					removing_ids.push(rows[j].id);
				}
			}
		}
		for(i = 0; i < removing_ids.length; i++) {
		  nicofox_download_manager.remove(removing_ids[i]);	
		}
	}
	
}
function assignTreeView()
{

var tree_view = {
    treeBox: null,
    selection: null,
    get rowCount()  {return rows.length;},
    getCellText : function(row,column){

      switch(column.id)
	{
	case 'progress':
	return;

	case 'tree-title':
	return rows[row].video_title;

	case 'tree-comment':
	return rows[row].comment_type;

	case 'tree-economy':

	if (rows[row].status == 1 || rows[row].status >= 6)
	{
		if (rows[row].video_economy == 1) return  strings.getString('economyYes');
		else return strings.getString('economyNo');
	}
	return;	

	case 'tree-status':
	switch (rows[row].status)
	{
		case 0:
		return strings.getString('progressWaiting');
		case 1:
		return strings.getString('progressCompleted');
		case 2:
		return strings.getString('progressCanceled');
		case 3:
		return strings.getString('progressFailed');
		case 4:
		return 'Scheduled';

		case 5:
		return strings.getString('progressLoading');
		case 6:
		return strings.getString('progressCommentDownloading');
		case 7:
		return strings.getString('progressVideoDownloading');
		default:
		return 'Buggy!';
	}
	break;
	case 'tree-size':
	if (rows[row].status == 1)
	{
		return (Math.floor(rows[row].max_bytes / 1024 / 1024 * 10) / 10)+'MB';
	}
	else if(rows[row].status == 7)
	{
		return (Math.floor(rows[row].current_bytes / 1024 / 1024 * 10) / 10) + 'MB/'+(Math.floor(rows[row].max_bytes / 1024 / 1024 * 10) / 10)+'MB';
	}
	return;	

	case 'tree-speed':
	if (rows[row].status == 7 && rows[row].speed) return rows[row].speed+'KB/s';
	else return;
	break;
	
	default:
	return;
	}
    },
    getCellValue : function(row,column){
      if (column.id == "tree-progress" &&( rows[row].status == 5 || rows[row].status == 6)) return 20;
      else if (column.id == "tree-progress"){progress = Math.floor(rows[row].current_bytes / rows[row].max_bytes * 100); return progress; }
      else return;
    },
    getProgressMode : function(row,column){
      if (column.id == "tree-progress" &&( rows[row].status == 5 || rows[row].status == 6)) return 2; 
      else if (column.id == "tree-progress") return 1; 
      else return;
    },
    setTree: function(treeBox){ this.treeBox = treeBox; },
    isContainer: function(row){ return false; },
    isSeparator: function(row){ return false; },
    isSorted: function(){ return false; },
    canDrop: function(index, orientation) {
      var drag_service = Cc["@mozilla.org/widget/dragservice;1"]
                        .getService(Ci.nsIDragService);
      var drag_session = drag_service.getCurrentSession();

      var supported = drag_session.isDataFlavorSupported("text/x-moz-url");

      if (supported && gBrowser) {
        return true;
      }
    },
    drop: function(index, orientation) {
      var drag_service = Cc["@mozilla.org/widget/dragservice;1"]
                         .getService(Ci.nsIDragService);
      var drag_session = drag_service.getCurrentSession();

      /* Drag & drop is OK only in browser */
      if (drag_session.sourceNode == null) {
        return;
      }
      /* Transfer data */
      var trans = Cc["@mozilla.org/widget/transferable;1"]
                 .createInstance(Ci.nsITransferable);
      trans.addDataFlavor("text/x-moz-url");

      var urls = [];
      for (var i = 0; i < drag_session.numDropItems; i++) {
        var url = null;

        drag_session.getData(trans, i);
        var flavor = {}, data = {}, length = {};
        trans.getAnyTransferData(flavor, data, length);
        if (data) {
          try {
            var str = data.value.QueryInterface(Ci.nsISupportsString);
          }
          catch(ex) {
	    alert(ex);
          }

          if (str) {
            url = str.data.split("\n")[0];
          }
  
        }

        if (url) {
          /* Replace some common redirect */
	  url = url.replace(/^http:\/\/ime\.nu\/(.*)$/, '$1');
	  url = url.replace(/^http:\/\/www\.flog\.jp\/w\.php\/(.*)$/, '$1');
          urls.push(url);
        }	
      }

      /* XXX: Dirty way (why check URLs here)? */
      if (urls[0].match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([a-z]{0,2}[0-9]+)$/) && gBrowser) {
        nicofox.goDownload(urls[0]);
      }
      return;
    },
    getParentIndex: function(index){ return -1; },
    getLevel: function(row){ return 0; },
    getImageSrc: function(row,col){ return null; },
    getRowProperties: function(row,props){},
    getCellProperties: function(row,col,props){},
    getColumnProperties: function(colid,col,props){},
};


    	document.getElementById('smilefox-tree').view = tree_view;

}

function createTree(rows)
{
}

function updateRowSpeed(num)
{
	/* Initialize */
	if (rows[num].current_bytes == 0 || rows[num].max_bytes == 0)
	{
		rows[num].speed = 0;
		return;
	}
	/* Update */
	now = new Date();
	now_time = now.getTime();
	var speed = Math.round((rows[num].current_bytes) / (now_time - rows[num].start_time) / 0.1024) / 10;
	rows[num].speed = speed;
}

function updateTreeRow(index)
{
	boxobject = document.getElementById('smilefox-tree').boxObject;
//	boxobject.QueryInterface(Ci.nsITreeBoxObject);
	boxobject.invalidateRow(index);
	updateToolbar();
}

function updateTree()
{
	boxobject = document.getElementById('smilefox-tree').boxObject;
//	boxobject.QueryInterface(Ci.nsITreeBoxObject);
	boxobject.invalidate();
	updateToolbar();
}

function updateTreeCount(index, num)
{
	boxobject = document.getElementById('smilefox-tree').boxObject;
//	boxobject.QueryInterface(Ci.nsITreeBoxObject);
	boxobject.rowCountChanged(index, num);
	updateToolbar();
}
var dog = 0;
function updateToolbar() {
  if (nicofox_download_manager.getDownloadCount() > 0) {
    document.getElementById('smilefox-toolbar-start').disabled = true;
    document.getElementById('smilefox-toolbar-stop').disabled = false;
  }
  else if (nicofox_download_manager.getWaitingCount() == 0) {
    document.getElementById('smilefox-toolbar-start').disabled = true;
    document.getElementById('smilefox-toolbar-stop').disabled = true;
  } else {
    document.getElementById('smilefox-toolbar-start').disabled = false;
    document.getElementById('smilefox-toolbar-stop').disabled = true;
  }
}
function smilefox_load()
{
	/* Load strings */
	strings = document.getElementById('nicofox-strings');
	rows = nicofox_download_manager.getDownloads();
	assignTreeView();

	/* For XULRunner 1.9.1+, use type="search" */
	var xulapp_info = Cc["@mozilla.org/xre/app-info;1"]  
	           .getService(Ci.nsIXULAppInfo);  
	if (xulapp_info.platformVersion.indexOf('1.9.0') != 0)
	{ document.getElementById('smilefox-search').type = 'search'; }

	nicofox_download_manager.go();
	if (nicofox_download_manager.getDownloadCount() == 0) {
	  document.getElementById('smilefox-toolbar-start').disabled = true;
	  document.getElementById('smilefox-toolbar-stop').disabled = true;
	}
//	download_runner.prepare();
	document.getElementById('smilefox-tree').oncontextmenu = function(e) { popup(e); };
	document.getElementById('smilefox-tree').focus();

	/* Drag & Drop */

}
function toolbarClose()
{
	if(document.getElementsByTagName('window')[0].getAttribute('windowtype') == 'navigator:browser')
	{
		document.getElementById('nicofox-splitter').collapsed = !document.getElementById('nicofox-splitter').collapsed;
		document.getElementById('smilefox-space').collapsed = !document.getElementById('smilefox-space').collapsed;
	}
	else
	{
		window.close();
	}
}
function close()
{
	/* Check if we can close without notifying, modified from globalOverlay.js */
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	                   .getService(Components.interfaces.nsIWindowMediator);
	var count_window = 0;		   
	var enumerator = wm.getEnumerator(null);
	while(enumerator.hasMoreElements()) {
 	  var win = enumerator.getNext();
	  count_window++;
	  if (count_window == 2) break;
	}
	if (count_window == 1) {
		var observer_service = Cc["@mozilla.org/observer-service;1"]
               .getService(Ci.nsIObserverService);
		var cancel_quit = Components.classes["@mozilla.org/supports-PRBool;1"]
		                .createInstance(Components.interfaces.nsISupportsPRBool);
	       
	       observer_service.notifyObservers(cancel_quit, 'quit-application-requested', null);
	       if( cancel_quit.data == true)
	       { return false; }
	}

	unloading = true;
	return true;
}

function start()
{
	/* Start will also be called after video is added, so ... */
	download_runner.prepare();
	document.getElementById('smilefox-toolbar-start').disabled = true;
	document.getElementById('smilefox-toolbar-stop').disabled = false;
}
function stop()
{
	/* If downloading, confirm */
	if (!prompts.confirm(null, strings.getString('stopDownloadTitle'), strings.getString('stopDownloadMsg')))
	{ return; }
	nicofox_download_manager.cancelAll();
}

function optionsWindow() {
      /* instantApply needs dialog = no */
      /* Copied from chrome://mozapps/content/extensions/extensions.js in Firefox */
      var features;
      var instant_apply;
      try {
        var root_prefs = Components.classes["@mozilla.org/preferences-service;1"]
                                   .getService(Components.interfaces.nsIPrefBranch);
        instant_apply = root_prefs.getBoolPref("browser.preferences.instantApply");
        features = "chrome,titlebar,toolbar,centerscreen" + (instant_apply ? ",dialog=no" : ",modal");
      } catch (e) {
        features = "chrome,titlebar,toolbar,centerscreen,modal";
      }
      			
      pref_window = window.openDialog('chrome://nicofox/content/options.xul', '', features);
      pref_window.focus();
}

function allDone() {
  document.getElementById('start').disabled = true;
  document.getElementById('stop').disabled = true;
}

function smilefox_unload()
{
	nicofox_download_listener.removeListener(listener);
}

function popup(e)
{
	var tree = document.getElementById("smilefox-tree");

	/* Get where we are (somethimes right click do not select the proper item, we will manully select it */
	var row = { }, col = { }, child = { };
	tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, child);
	recent_row = row.value;

	if(recent_row == -1)
	{
		/* Out of the range, but something is still selected */
		recent_row = tree.currentIndex;
		if (recent_row == -1)
		{
			/* Nothing selected */
			document.getElementById('smilefox-popup').style.display='none';
			return;
		}
	}
	else
	{
		/* We won't manully select for multiple selection */
		if (tree.view.selection.getRangeCount() < 1)
		{
			tree.view.selection.select(recent_row);
			popup_command.multiple_select = false;
		}
	}
	document.getElementById('smilefox-popup').style.display='-moz-popup';
	selected_row = rows[recent_row];
	popup_command.recent_row = recent_row;

	/* Waiting */
	if(rows[recent_row].status == 0)
	{
		document.getElementById('popup-retry').style.display = 'none';
		document.getElementById('popup-cancel').style.display = 'none';
		document.getElementById('popup-open').style.display = 'none';
		document.getElementById('popup-open-swf-player').style.display ='none';
		document.getElementById('popup-open-external').style.display = 'none';
		document.getElementById('popup-open-folder').style.display = 'none';
		document.getElementById('popup-remove').style.display = 'block';
	}
	/* Completed */
	else if(rows[recent_row].status == 1)
	{
		document.getElementById('popup-retry').style.display = 'none';
		document.getElementById('popup-cancel').style.display = 'none';
		document.getElementById('popup-open').style.display = 'block';
		/* NicoFox player do not support SWF currently */
		if (rows[recent_row].video_file.match(/\.swf$/)) {
		  document.getElementById('popup-open').style.display ='none';
		  document.getElementById('popup-open-swf-player').style.display ='block';
		} else {
		  document.getElementById('popup-open').style.display ='block';
		  document.getElementById('popup-open-swf-player').style.display ='none';
		}
		document.getElementById('popup-open-external').style.display = 'block';
		document.getElementById('popup-open-folder').style.display = 'block';
		document.getElementById('popup-remove').style.display = 'block';
	}
	/* When it is downloading */
	else if(rows[recent_row].status > 4)
	{
		document.getElementById('popup-retry').style.display = 'none';
		document.getElementById('popup-cancel').style.display = 'block';
		document.getElementById('popup-open').style.display = 'none';
		document.getElementById('popup-open-swf-player').style.display ='none';
		document.getElementById('popup-open-external').style.display = 'none';
		document.getElementById('popup-open-folder').style.display = 'none';
		document.getElementById('popup-remove').style.display = 'none';
	}
	/* Failed/canceled */
	else
	{
		document.getElementById('popup-retry').style.display = 'block';
		document.getElementById('popup-cancel').style.display = 'none';
		document.getElementById('popup-open').style.display = 'none';
		document.getElementById('popup-open-swf-player').style.display ='none';
		document.getElementById('popup-open-external').style.display = 'none';
		document.getElementById('popup-open-folder').style.display = 'none';
		document.getElementById('popup-remove').style.display = 'block';
	}
}


function doSearch()
{
	var keyword = document.getElementById('smilefox-search').value;
	
	updateTreeCount(0, -rows.length);
	rows = nicofox_download_manager.getDownloads();
	updateTreeCount(0, rows.length);
	
	if (keyword) {
          keyword = keyword.replace(/[\\\^\$\*\+\?\.\(\)\:\?\=\!\|\{\}\,\[\]]/g, '\\$1');
	  var keywords = keyword.replace(/\s(.*)\s/, '$1').split(/\s/);
	  for (var i = 0; i < keywords.length; i++) {
  	    keywords[i] = new RegExp(keywords[i], 'ig');
	  }
	  /* Trim and split keywords */
          rows = rows.filter(function(element, index, array) {
	var result = true;
	for (var i = 0; i < keywords.length; i++) {
	  result = result & Boolean(element.video_title.match(keywords[i]));
	}  
        if (result)
	{
	  return true;
	}
	else
	{
          updateTreeCount(index, -1);
	}
        }); }
	updateTree();
}
function myDump(aMessage) {
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("Smilefox: " + aMessage);
}

window.addEventListener("load", function(e) { smilefox_load(); }, false);
window.addEventListener("unload", function(e) { smilefox_unload(); }, false);

