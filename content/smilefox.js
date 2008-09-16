var Cc = Components.classes;
var Ci = Components.interfaces;

var rows = new Array(); // Something to store the all rows

/* Prevent wrong update during add/remove */
var rows_lock = false;

/* When unloading, don't clean query after canceling */
var unloading = false;

/* Strings will be loaded in load() */
var strings = null;

var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefService);
	prefs = prefs.getBranch("extensions.nicofox.");

var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
	              .getService(Ci.nsIPromptService);

var smilefox_sqlite = 
{
	load: function()
	{

		var file = Cc["@mozilla.org/file/directory_service;1"]
		           .getService(Ci.nsIProperties)
		           .get("ProfD", Ci.nsIFile);
		file.append("smilefox.sqlite");

		var storageService = Components.classes["@mozilla.org/storage/service;1"]
	                        .getService(Components.interfaces.mozIStorageService);
		this.db_connect = storageService.openDatabase(file);

	},

	select: function()
	{
		old_rows_length = rows.length;
		rows_lock = true;
		var statement = this.db_connect.createStatement("SELECT * FROM smilefox ORDER BY id DESC");
		statement.execute();
		i = 0;
		rows = new Array();

		while (statement.executeStep())
		{
			rows[i] = new Object();
			for (j = 0; j < statement.columnCount; j++)
			{
				name = statement.getColumnName(j);
				switch(statement.getTypeOfIndex(j))
				{
					case 0: // VALUE_TYPE_NULL
					value = null;
					break;
					case 1: // VALUE_TYPE_INTEGER 
					if (name == 'start_time')
					{
						/* getInt64 implementation has a bug */
						value = statement.getUTF8String(j).valueOf();
					}
					else
					{
						value = statement.getInt32(j);
					}
					break;
					case 2: // VALUE_TYPE_FLOAT
					value = statement.getDouble(j);
					break;
					case 3: // VALUE_TYPE_TEXT
					value = statement.getUTF8String(j);
					break;
					case 4: // VALUE_TYPE_BLOB
					statement.getBlob(j, size, data);
				}
				rows[i][name] = value;
			}
			/* Update query */
			for (k = 0; k < download_runner.query.length; k++)
			{
				if (rows[i].id == download_runner.query[k].id)
				{
					download_runner.query[k].rows_num = i;
				}
			}
			i++;
		}
		rows_lock = false;

		boxobject = document.getElementById('smilefox-tree').boxObject;
		boxobject.QueryInterface(Ci.nsITreeBoxObject);
		boxobject.rowCountChanged(0, -old_rows_length);
		boxobject.rowCountChanged(0, rows.length);
	},
	add: function (Video, url)
	{
		try
		{
			var statement = this.db_connect.createStatement("INSERT INTO smilefox (url, video_id, comment_id, comment_type, video_title, download_items, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)");
			statement.bindUTF8StringParameter(0, url);
			statement.bindUTF8StringParameter(1, Video.id);
			statement.bindUTF8StringParameter(2, Video.v);
			statement.bindUTF8StringParameter(3, Video.comment_type);
			statement.bindUTF8StringParameter(4, Video.title);
			statement.bindInt32Parameter(5, 2);
			statement.bindInt32Parameter(6, 0);

			statement.execute();
			statement.reset();
		}
		catch(e)
		{
		}
	},
	updateStatus: function (row, stat)
	{
		try
		{
			var row_id = rows[row].id;
			if(!row_id || isNaN(row_id)) { return false; }
			var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1 WHERE `id` = ?2");
			stmt.bindInt32Parameter(0, stat);
			stmt.bindInt32Parameter(1, row_id);
			stmt.execute();
			stmt.reset();
			rows[row].status = stat;
		}
		catch(e)
		{
		}
	},
	updateInfo: function(row)
	{
		/* Update info and set status = 7 (downloading)*/
		var row_id = rows[row].id;
		if(!row_id || isNaN(row_id)) { return false; }
		var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1 , `video_type` = ?2 , `video_economy` = ?3 , `video_file` = ?4 , `comment_file` = ?5, `start_time` = ?6 WHERE `id` = ?7");
		stmt.bindInt32Parameter(0, 7);
		stmt.bindUTF8StringParameter(1, rows[row].video_type);
		if (rows[row].video_economy)
		{ stmt.bindInt32Parameter(2, 1); }
		else
		{ stmt.bindInt32Parameter(2, 0); }
		stmt.bindUTF8StringParameter(3, rows[row].video_file);
		stmt.bindUTF8StringParameter(4, rows[row].comment_file);
		stmt.bindInt64Parameter(5, rows[row].start_time);
		stmt.bindInt32Parameter(6, row_id);
		stmt.execute();
		stmt.reset();
		rows[row].status = 7;
	},
	updateComplete: function(row)
	{
		/* Update info and set status = 1 (completed)*/
		var row_id = rows[row].id;
		if(!row_id || isNaN(row_id)) { return false; }
		var stmt = this.db_connect.createStatement("UPDATE `smilefox` SET `status` = ?1, `end_time` = ?2 , `current_bytes` = ?3, `max_bytes` = ?4 WHERE `id` = ?5");
		stmt.bindInt32Parameter(0, 1);
		now_date = new Date();
		rows[row].end_time = now_date.getTime();
		stmt.bindInt64Parameter(1, rows[row].end_time);
		stmt.bindUTF8StringParameter(2, rows[row].current_bytes);
		stmt.bindUTF8StringParameter(3, rows[row].max_bytes);
		stmt.bindInt32Parameter(4, row_id);
		stmt.execute();
		stmt.reset();
		rows[row].status = 1;
	},
	remove: function (row)
	{
		try
		{
			var row_id = rows[row].id;
			if(!row_id || isNaN(row_id)) { return false; }

			var stmt = this.db_connect.createStatement("DELETE FROM `smilefox` WHERE `id` = ?1");
			stmt.bindInt32Parameter(0, row_id);
			stmt.execute();
			stmt.reset();
			/* we will re-select all soon so we don't remove rows */
		}
		catch(e)
		{
		}
	},
}

var download_count = 0;
var download_max = 1;
var download_runner =
{
	ready: false,
	query: new Array(),
	initialize: function()
	{
		
		if (this.ready)
		{ return false; }
		/* If there is something remained, we will let it fail */
		for (i=0; i<rows.length; i++)
		{
			if (rows[i].status > 4)
			{ smilefox_sqlite.updateStatus(i, 3); }
		}
		this.ready = true;
	},
	getRowNumById: function(id)
	{
		for (i = 0; i< rows.length; i++)
		{
			if (rows[i].id == id)
			{
				return i;
			}
		}
	},
	prepare: function() 
	{
		if (!this.ready)
		{ this.initialize(); }

		i = rows.length - 1;
		while (i >= 0 && download_count < download_max)
		{
			if (rows[i].status == 0)
			{
				download_count++;
				smilefox_sqlite.updateStatus(i, 5);
				new_query = {id: rows[i].id, rows_num: i};
				var k = this.query.push(new_query) - 1;
				
				this.query[k].processCallback = function(type, content, id)
				{
					if (rows_lock == true)
					{ window.setTimeout(hitchFunction(this, 'processCallback', type, content, id), 50); return; }
					
					/* To prevent "stop" to be called when canceled */
					if(this.downloader.canceled == true && type != 'cancel' && type != 'fail')
					{ return; }

					rows_num = this.rows_num;
					switch(type)
					{
						/* Parsing is done, and file is ready to write */
						case 'file_ready':
						smilefox_sqlite.updateStatus(rows_num, 6);
						rows[rows_num].video_type = content.video_type;
						rows[rows_num].video_economy = content.video_economy;
						rows[rows_num].video_file = content.video_file;
						rows[rows_num].comment_file = content.comment_file;
						updateTreeRow(rows_num);
						break;

						/* Video download is started */
						case 'start':
						rows[rows_num].current_bytes = 0;
						rows[rows_num].speed = 0;
						now = new Date();
						rows[rows_num].start_time = now.getTime();
						smilefox_sqlite.updateInfo(rows_num);
						updateTreeRow(rows_num);
						break;

						case 'progress_change':
						rows[rows_num].current_bytes = content.current;
						rows[rows_num].max_bytes = content.max;
						updateRowSpeed(rows_num);
						updateTreeRow(rows_num);
						break;

						case 'stop':
						/* It is "protected" by the below part so will be executed only for download completed */

						/* Finialize download */
						this.downloader.movie_prepare_file.remove(false);
						this.downloader.movie_file.moveTo(null, this.downloader.file_title+'.'+this.downloader.type);

						smilefox_sqlite.updateComplete(rows_num);
						updateTreeRow(rows_num);
						var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
						download_count--;
						download_runner.prepare();
						break;

						case 'fail':
						smilefox_sqlite.updateStatus(rows_num, 3);
						updateTreeRow(rows_num);
						var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
						download_count--;
						download_runner.prepare();
						break;

						case 'cancel':
						smilefox_sqlite.updateStatus(rows_num, 2);
						updateTreeRow(rows_num);
						/* For unloading, we should not remove it from query (We require to clean all query) */
						if (!unloading)
						{
							var removed_query = download_runner.query.splice(download_runner.query.indexOf(this), 1);
							download_count--;
							download_runner.prepare();
						}
						break;
					}
				}

				this.query[k].downloader = new smileFoxDownloader();
				this.query[k].downloader.callback = hitchFunction(this.query[k], 'processCallback', rows[i].id); // query.length will be next query id
				this.query[k].downloader.file_title = fixReservedCharacters(rows[i].video_title);
				this.query[k].downloader.comment_type = rows[i].comment_type;
				this.query[k].downloader.init(rows[i].comment_id);
			}

			i--;
		}
		/* When all done, display it */
		if (download_count == 0)
		{ allDone(); }
	},
	cancel: function(row)
	{
		for (i = 0; i < this.query.length; i++)
		{
			if (this.query[i].rows_num == row && this.query[i].downloader)
			{
				this.query[i].downloader.cancel();
			}
		}
	},
	cancelAll: function()
	{
		for (i = 0; i < this.query.length; i++)
		{
			if (this.query[i].downloader)
			{
				this.query[i].downloader.cancel();
				this.query[i].processCallback = function() {} /* Prevent errors */
			}
		}
		/* Dirty way :) */
		this.query = [];
		download_count = 0;
	},
	retry: function(row)
	{
		/* Reset, then retry query */
		if (rows[row].status == 2 || rows[row].status == 3)
		{
			smilefox_sqlite.updateStatus(row, 0);
			updateTreeRow(row);
			start();
		}
	},
};

var popup_command = 
{
	recent_row: -1,
	multiple_select: true, 
	cancel: function()
	{
		if (recent_row < 0) { return; }	
		download_runner.cancel(recent_row);
	},
	retry: function()
	{
		if (recent_row < 0) { return; }	
		download_runner.retry(recent_row);
	},
	open: function() {}, /* TODO */
	openExternal: function()
	{
		if (recent_row < 0) { return; }
		if (!rows[recent_row].video_file) { return; }
		
		var file = Cc["@mozilla.org/file/local;1"]
		           .createInstance(Ci.nsILocalFile);
		file.initWithPath(rows[recent_row].video_file);
		if (!file.exists()) { return false; }
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
		document.getElementById('smilefox-tree').view.selection.rangedSelect(0, rows.length, true)
	},
	remove: function()
	{
		tree = document.getElementById('smilefox-tree'); 
		var start = new Object();
		var end = new Object();
		var count = 0;
		for (i = 0; i < tree.view.selection.getRangeCount(); i++)
		{
			tree.view.selection.getRangeAt(i, start, end);
			for (var j = start.value; j <= end.value; j++)
			{
				/* when it is failed, completed, canceled or waiting, we can remove it */
				if(rows[j].status <= 4)
				{
					smilefox_sqlite.remove(j);
					count--;
				}
			}
		}
		smilefox_sqlite.select();
	
	}
	
}

function assignTreeView()
{
/* Initialize tree view */
var tree_view = {
    treeBox: null,
    selection: null,
    rowCount : rows.length,
    getCellText : function(row,column){
	/* Display something ... */
      switch(column.id)
	{
	case 'progress':
	return;

	case 'tree-title':
	return rows[row].video_title;

	case 'tree-comment':
	return rows[row].comment_type;

	case 'tree-economy':
	/* We didn't know it until donwloading XML */
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
		/* 4 is reserved */
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
	if (rows[row].status == 7) return rows[row].speed+'KB/s';
	else return;
	break;
	
	default:
	return;
	}
    },
    getCellValue : function(row,column){
      if (column.id == "tree-progress" &&( rows[row].status == 5 || rows[row].status == 6)) return 20; /* 1: determined, 2: undetermined, 3: none*/
      else if (column.id == "tree-progress"){progress = Math.floor(rows[row].current_bytes / rows[row].max_bytes * 100); return progress; }
      else return;
    },
    getProgressMode : function(row,column){
      if (column.id == "tree-progress" &&( rows[row].status == 5 || rows[row].status == 6)) return 2; /* 1: determined, 2: undetermined, 3: none*/
      else if (column.id == "tree-progress") return 1; /* 1: determined, 2: undetermined, 3: none*/
      else return;
    },
    setTree: function(treeBox){ this.treeBox = treeBox; },
    isContainer: function(row){ return false; },
    isSeparator: function(row){ return false; },
    isSorted: function(){ return false; },
    getLevel: function(row){ return 0; },
    getImageSrc: function(row,col){ return null; },
    getRowProperties: function(row,props){},
    getCellProperties: function(row,col,props){},
    getColumnProperties: function(colid,col,props){}
};

	/* So we can load the treeview, here we go! */
    	document.getElementById('smilefox-tree').view = tree_view;

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

function updateTreeRow(num)
{
	boxobject = document.getElementById('smilefox-tree').boxObject;
	boxobject.QueryInterface(Ci.nsITreeBoxObject);
	boxobject.invalidate();
}

function load()
{
	/* Load strings */
	strings = document.getElementById('nicofox-strings');

	/* Load treeview */
	assignTreeView();

	/* Load the database */
	smilefox_sqlite.load();

	/* Then, load the SQLite database */
	smilefox_sqlite.select();

	/* Find the download request */
	if(window.arguments && window.arguments[0])
	{
		addDownload(window.arguments[0].Video, window.arguments[0].url)
	}

	download_runner.prepare();
	document.getElementById('smilefox-tree').oncontextmenu = function(e) { popup(e); };

}

function close()
{
	if(download_count == 0 ) {return true;}

	/* If downloading, confirm */
	if (!prompts.confirm(null, strings.getString('closeSmileFoxTitle'), strings.getString('closeSmileFoxMsg')))
	{return false;}

	unloading = true;
	download_runner.cancelAll();
}

function start()
{
	/* Start will also be called after video is added, so ... */
	download_runner.prepare();
	if (download_count == 0)
	{ allDone(); }
	document.getElementById('start').disabled = true;
	document.getElementById('stop').disabled = false;
}
function stop()
{
	
	/* If downloading, confirm */
	if (!prompts.confirm(null, strings.getString('stopDownloadTitle'), strings.getString('stopDownloadMsg')))
	{ return; }

	download_runner.cancelAll();
	download_runner.prepare();

	if (download_count == 0)
	{ allDone(); return; }

	document.getElementById('start').disabled = false;
	document.getElementById('stop').disabled = true;
}
function allDone()
{
	document.getElementById('start').disabled = true;
	document.getElementById('stop').disabled = true;
}

function unload()
{
}
/* This is trigged from nicofox.confirmDownload */
function addDownload(Video, url)
{
	/* The filename is almost free in NicoNico douga... :P */
	//filename = fixReservedCharacters(Video.title);
	smilefox_sqlite.add(Video, url);
	smilefox_sqlite.select();

	/* Update the download runner relation */
	start();
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
			document.getElementById('popup').style.display='none';
			return;
		}
	}
	else
	{
		/* We won't manully select for multiple selection */
		if (tree.view.selection.getRangeCount() < 1)
		{
			tree.view.selection.select(recent_row);
			popup_command.multiple_select = true;
		}
	}
	document.getElementById('popup').style.display='-moz-popup';
	selected_row = rows[recent_row];
	popup_command.recent_row = recent_row;

	/* Waiting */
	if(rows[recent_row].status == 0)
	{
		document.getElementById('popup-retry').style.display = 'none';
		document.getElementById('popup-cancel').style.display = 'none';
		document.getElementById('popup-open').style.display = 'none';
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
		document.getElementById('popup-open-external').style.display = 'none';
		document.getElementById('popup-open-folder').style.display = 'none';
		document.getElementById('popup-remove').style.display = 'block';
	}
}


/* Fix common reserved characters in filesystems by converting to full-width */
function fixReservedCharacters(title)
{
	title = title.replace(/\//, '／');
	title = title.replace(/\\/, '＼');
	title = title.replace(/\?/, '？');
	title = title.replace(/\%/, '％');
	title = title.replace(/\*/, '＊');
	title = title.replace(/\:/, '：');
	title = title.replace(/\|/, '｜');
	title = title.replace(/\"/, '”');
	title = title.replace(/\</, '＜');
	title = title.replace(/\>/, '＞');
	title = title.replace(/\+/, '＋');
	/* Windows FAT specified... */
	title = title.replace(/\[/, '〔');
	title = title.replace(/\]/, '〕');
	return title;
}

function myDump(aMessage) {
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                 .getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("Smilefox: " + aMessage);
}

