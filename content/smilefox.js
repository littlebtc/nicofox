var Cc = Components.classes;
var Ci = Components.interfaces;

/* Import Download manager Javascript code modules */
Components.utils.import('resource://nicofox/common.js');
Components.utils.import('resource://nicofox/download_manager.js');

if (!nicofox_ui) {var nicofox_ui = {};}
nicofox_ui.manager = {
  prefs: null,
  prompts: null,
  rows: [],
  treeview_assigned: false,
  load: function() {
    nicofox_ui.manager.prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                      .getService(Ci.nsIPromptService);
    
    nicofox_ui.manager.rows = nicofox.download_manager.getDownloads();
    nicofox_ui.manager.assignTreeView();

    /* For XULRunner 1.9.1+, use type="search" */
    var xulapp_info = Cc["@mozilla.org/xre/app-info;1"]  
                     .getService(Ci.nsIXULAppInfo);  
    if (xulapp_info.platformVersion.indexOf('1.9.0') != 0)
    { document.getElementById('smilefox-search').type = 'search'; }

    nicofox.download_manager.go();
    if (nicofox.download_manager.getDownloadCount() == 0) {
      document.getElementById('smilefox-toolbar-start').disabled = true;
      document.getElementById('smilefox-toolbar-stop').disabled = true;
    }
    document.getElementById('smilefox-tree').addEventListener('contextmenu', nicofox.hitch(nicofox_ui.manager.popup_command, 'activate'), false);
    document.getElementById('smilefox-tree').focus();

    /* Drag & Drop */
    document.getElementById('smilefox-tree').addEventListener('dragover', nicofox_ui.manager.dragOver, true);
    document.getElementById('smilefox-tree').addEventListener('dragdrop', nicofox_ui.manager.dragDrop, true);

    /* Download listener */
    nicofox_ui.manager.listener = 
    {
       add: function(id, content) {
         if ((typeof content) != 'object') return false;
         
         content.id = id;
         nicofox_ui.manager.rows.unshift(content);
         nicofox_ui.manager.updateTreeCount(0, 1);
         var keyword = document.getElementById('smilefox-search').value;
         if (keyword) {
           this,manager.doSearch();
         } else {
           document.getElementById('smilefox-tree').boxObject.scrollToRow(0);
         }
       },
       remove: function(id) {
         nicofox_ui.manager.rows = nicofox_ui.manager.rows.filter(function(element, index, array) {
           if (element.id == id) {
             nicofox_ui.manager.updateTreeCount(index, -1);
           } else {
             return true;
           }
         });
       },
       update: function(id, content) {
         nicofox_ui.manager.rows.forEach(function(element, index, array) {
           if (element.id == id) {
             for (key in content) {
               array[index][key] = content[key];
             }
             nicofox_ui.manager.updateTreeRow(index);
             nicofox_ui.manager.updateRowSpeed(index);
           }
         });
         nicofox_ui.manager.updateToolbar();
       },
       stop: function() {
         nicofox_ui.manager.updateToolbar();
       },
       rebuild: function() {
         document.getElementById('smilefox-search').value = '';
         nicofox_ui.manager.doSearch();
       }
     };
    nicofox.download_listener.addListener(nicofox_ui.manager.listener);
  },
  assignTreeView: function() {
    var tree_view = {
      treeBox: null,
      selection: null,
      get rowCount()  {return nicofox_ui.manager.rows.length;},
      getCellText : function(row,column){

      switch(column.id)
      {
        case 'progress':
        return;

        case 'tree-title':
        return nicofox_ui.manager.rows[row].video_title;

        case 'tree-comment':
        return nicofox_ui.manager.rows[row].comment_type;

        case 'tree-economy':
        if (nicofox_ui.manager.rows[row].status == 1 || nicofox_ui.manager.rows[row].status >= 6) {
          if (nicofox_ui.manager.rows[row].video_economy == 1) return  nicofox.strings.getString('economyYes');
          else return nicofox.strings.getString('economyNo');
        }
        return;  

        case 'tree-status':
        switch (nicofox_ui.manager.rows[row].status)
        {
          case 0:
          return nicofox.strings.getString('progressWaiting');
          case 1:
          return nicofox.strings.getString('progressCompleted');
          case 2:
          return nicofox.strings.getString('progressCanceled');
          case 3:
          return nicofox.strings.getString('progressFailed');
          case 4:
          return nicofox.strings.getString('progressScheduled');
           
          case 5:
          return nicofox.strings.getString('progressLoading');
          case 6:
          return nicofox.strings.getString('progressCommentDownloading');
          case 7:
          return nicofox.strings.getString('progressVideoDownloading');
          default:
          return 'Buggy!';
        }
        break;
        case 'tree-size':
        if (nicofox_ui.manager.rows[row].status == 1) {
          return (Math.floor(nicofox_ui.manager.rows[row].max_bytes / 1024 / 1024 * 10) / 10)+'MB';
        } else if(nicofox_ui.manager.rows[row].status == 7) {
          return (Math.floor(nicofox_ui.manager.rows[row].current_bytes / 1024 / 1024 * 10) / 10) + 'MB/'+(Math.floor(nicofox_ui.manager.rows[row].max_bytes / 1024 / 1024 * 10) / 10)+'MB';
        }
        return;  

        case 'tree-speed':
        if (nicofox_ui.manager.rows[row].status == 7 && nicofox_ui.manager.rows[row].speed) return nicofox_ui.manager.rows[row].speed+'KB/s';
        else return;
        break;
  
        default:
        return;
        }
      },
      getCellValue : function(row,column){
        if (column.id == "tree-progress" &&( nicofox_ui.manager.rows[row].status == 5 || nicofox_ui.manager.rows[row].status == 6)) return 20;
        else if (column.id == "tree-progress"){progress = Math.floor(nicofox_ui.manager.rows[row].current_bytes / nicofox_ui.manager.rows[row].max_bytes * 100); return progress; }
        else return;
      },
      getProgressMode : function(row,column){
        if (column.id == "tree-progress" &&( nicofox_ui.manager.rows[row].status == 5 || nicofox_ui.manager.rows[row].status == 6)) return 2; 
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
    this.treeview_assigned = true;
  },
  dragOver: function () {
    var drag_service = Cc["@mozilla.org/widget/dragservice;1"]
                      .getService(Ci.nsIDragService);
    var drag_session = drag_service.getCurrentSession();
    var supported = drag_session.isDataFlavorSupported("text/x-moz-url");

    if (supported && gBrowser) {
      drag_session.canDrop = true;
    }
  
  },
  dragDrop: function () {
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
        } catch(ex) {
          alert(ex);
        }
        if (str) {
          url = str.data.split("\n")[0];
        }
      }
      if (url) {
      /* Replace some common redirect */
        url = url.replace(/^http:\/\/ime\.nu\/(.*)$/, 'http://$1');
        url = url.replace(/^http:\/\/www\.flog\.jp\/w\.php\/(.*)$/, '$1');
        urls.push(url);
      }  
    }
    /* XXX: Dirty way (why check URLs here)? */
    if (urls[0].match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/([a-z]{0,2}[0-9]+)$/) && gBrowser) {
      nicofox_ui.overlay.goDownload(urls[0]);
    }
  },


  updateRowSpeed: function(num) {
    /* Initialize */
    if (this.rows[num].current_bytes == 0 || this.rows[num].max_bytes == 0) {
      this.rows[num].speed = 0;
      return;
    }
    /* Update */
    now = new Date();
    now_time = now.getTime();
    var speed = Math.round((this.rows[num].current_bytes) / (now_time - this.rows[num].start_time) / 0.1024) / 10;
    this.rows[num].speed = speed;
  },

  updateTreeRow: function(index) {
    var boxobject = document.getElementById('smilefox-tree').boxObject;
    boxobject.invalidateRow(index);
    this.updateToolbar();
  },

  updateTree: function() {
    var boxobject = document.getElementById('smilefox-tree').boxObject;
    boxobject.invalidate();
    this.updateToolbar();
  },
  updateTreeCount: function(index, num) {
    var boxobject = document.getElementById('smilefox-tree').boxObject;
    boxobject.rowCountChanged(index, num);
    this.updateToolbar();
  },
  updateToolbar: function() {
    if (nicofox.download_manager.getDownloadCount() > 0) {
      document.getElementById('smilefox-toolbar-start').disabled = true;
      document.getElementById('smilefox-toolbar-stop').disabled = false;
    }
    else if ((nicofox.download_manager.getDownloadCount() + nicofox.download_manager.getWaitingCount()) == 0) {
      document.getElementById('smilefox-toolbar-start').disabled = true;
      document.getElementById('smilefox-toolbar-stop').disabled = true;
    } else {
      document.getElementById('smilefox-toolbar-start').disabled = false;
      document.getElementById('smilefox-toolbar-stop').disabled = true;
    }
  },
  toolbarClose: function()
  {
    if(gBrowser)
    {
      document.getElementById('nicofox-splitter').collapsed = !document.getElementById('nicofox-splitter').collapsed;
      document.getElementById('smilefox-space').collapsed = !document.getElementById('smilefox-space').collapsed;
    }
    else {
      window.close();
    }
  },
  close: function() {
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
  
    return true;
  },

  start: function()
  {
    /* Start will also be called after video is added, so ... */
    download_runner.prepare();
    document.getElementById('smilefox-toolbar-start').disabled = true;
    document.getElementById('smilefox-toolbar-stop').disabled = false;
  },
  stop: function()
  {
    /* If downloading, confirm */
    if (!this.prompts.confirm(null, nicofox.strings.getString('stopDownloadTitle'), nicofox.strings.getString('stopDownloadMsg')))
    { return; }
    nicofox.download_manager.cancelAll();
  },

  optionsWindow: function() {
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
  },

  allDone: function() {
    document.getElementById('start').disabled = true;
    document.getElementById('stop').disabled = true;
  },

  unload: function() {
    nicofox.download_listener.removeListener(nicofox_ui.manager.listener);
    window.removeEventListener("load", nicofox_ui.manager.load, false);
    window.removeEventListener("unload", nicofox_ui.manager.unload, false);
    document.getElementById('smilefox-tree').removeEventListener('contextmenu', nicofox_ui.manager.popup_command.activate, false);
    document.getElementById('smilefox-tree').removeEventListener('dragover', nicofox_ui.manager.dragOver, true);
    document.getElementById('smilefox-tree').removeEventListener('dragdrop', nicofox_ui.manager.dragDrop, true);
  },

  doSearch: function() {
    var keyword = document.getElementById('smilefox-search').value;
    
    this.updateTreeCount(0, -nicofox_ui.manager.rows.length);
    this.rows = nicofox.download_manager.getDownloads();
    this.updateTreeCount(0, nicofox_ui.manager.rows.length);

    if (keyword) {
      keyword = keyword.replace(/[\\\^\$\*\+\?\.\(\)\:\?\=\!\|\{\}\,\[\]]/g, '\\$1');
      var keywords = keyword.replace(/\s(.*)\s/, '$1').split(/\s/);
      for (var i = 0; i < keywords.length; i++) {
        keywords[i] = new RegExp(keywords[i], 'ig');
      }
      /* Trim and split keywords */
      this.rows = this.rows.filter(function(element, index, array) {
      var result = true;
      for (var i = 0; i < keywords.length; i++) {
        result = result & Boolean(element.video_title.match(keywords[i]));
      }  
      if (result) {
        return true;
      } else {
        nicofox_ui.manager.updateTreeCount(index, -1);
      }
    });
    }
    this.updateTree();
  },
  openFileToPlayer: function() {
    var file_picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    file_picker.init(window, 'Choose Video File to Play', null);
    file_picker.appendFilter('Supported Type', '*.flv; *.mp4');
    if (file_picker.show() == Ci.nsIFilePicker.returnOK)
    {
      /* XXX: Find a better way to make a function */
      var file = file_picker.file;
      var video_uri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService).newFileURI(file);
      var video_uri_spec = video_uri.spec;
      var comment_uri_spec = '';

      var comment_file_path = file.path.replace(/(flv|mp4)$/, 'xml');
      var comment_file = Cc["@mozilla.org/file/local;1"]
                        .createInstance(Ci.nsILocalFile);
      comment_file.initWithPath(comment_file_path);
      if (comment_file.exists()) {
        var comment_uri = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService).newFileURI(comment_file);
        comment_uri_spec = comment_uri.spec; 
      }    
    window.openDialog('chrome://nicofox/content/nicofox_player.xul', 'nicofox_swf', 'width=512,height=424, dialog=no, resizable=yes', {video: video_uri_spec, comment: comment_uri_spec, title: file.leafName});  
    }
  }	
};


nicofox_ui.manager.popup_command = 
{
  recent_row: -1,
  multiple_select: true, 
    cancel: function() {
      if (this.recent_row < 0) { return; }  
      nicofox.download_manager.cancel(nicofox_ui.manager.rows[this.recent_row].id);
    },
    retry: function() {
      if (this.recent_row < 0) { return; }  
      nicofox.download_manager.retry(nicofox_ui.manager.rows[this.recent_row].id);
    },
    open: function() {
      if (this.recent_row < 0) { return; }
      if (!nicofox_ui.manager.rows[this.recent_row].video_file) { return; }
      if (!nicofox_ui.manager.rows[this.recent_row].video_file.match(/\.(flv|mp4)$/)) { return; }
  
      var file = Cc["@mozilla.org/file/local;1"]
                 .createInstance(Ci.nsILocalFile);
      file.initWithPath(nicofox_ui.manager.rows[this.recent_row].video_file);
      if (!file.exists()) { return false; }
      var video_uri = Cc["@mozilla.org/network/io-service;1"]
                     .getService(Ci.nsIIOService).newFileURI(file);
      var video_uri_spec = video_uri.spec;
      var comment_uri_spec = '';
    
      if (nicofox_ui.manager.rows[this.recent_row].comment_file) {
      var file = Cc["@mozilla.org/file/local;1"]
                 .createInstance(Ci.nsILocalFile);
      file.initWithPath(nicofox_ui.manager.rows[this.recent_row].comment_file);
      if (!file.exists()) { return false; }
      var comment_uri = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService).newFileURI(file);
      comment_uri_spec = comment_uri.spec; 
    }
      
    window.openDialog('chrome://nicofox/content/nicofox_player.xul', 'nicofox_swf', 'width=512,height=424, dialog=no, resizable=yes', {video: video_uri_spec, comment: comment_uri_spec, title: nicofox_ui.manager.rows[this.recent_row].video_title});  
  }, 
  openExternal: function() {
    if (this.recent_row < 0) { return; }
    if (!nicofox_ui.manager.rows[this.recent_row].video_file) { return; }
        
    var file = Cc["@mozilla.org/file/local;1"]
                 .createInstance(Ci.nsILocalFile);
    file.initWithPath(nicofox_ui.manager.rows[this.recent_row].video_file);
    if (!file.exists()) { return false; }
        
    var external_process = false;
    /*  flv/mp4/swf detection and custom player */
    if (nicofox.prefs.getBoolPref("external_video_player") && nicofox_ui.manager.rows[this.recent_row].video_file.match(/(flv|mp4)$/)) {
      external_process = true;
      var external_path = nicofox.prefs.getComplexValue("external_video_player_path", Components.interfaces.nsILocalFile);
    }
    else if (nicofox.prefs.getBoolPref("external_swf_player") && nicofox_ui.manager.rows[this.recent_row].video_file.match(/(swf)$/)) {
      external_process = true;
      var external_path = nicofox.prefs.getComplexValue("external_swf_player_path", Components.interfaces.nsILocalFile);
    }
    if (external_process) {
      var os_string = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;  
      var process;
      var file_path;
      if (os_string == 'WINNT') {
        /* Using IWinProcess by dafi to fix the poor Unicode support of nsIProcss 
           See: http://dafizilla.wordpress.com/2008/10/08/nsiprocess-windows-and-unicode/ */
        process = Cc["@dafizilla.sourceforge.net/winprocess;1"]
                  .createInstance().QueryInterface(Ci.IWinProcess);
        file_path = file.path;
      } else {
        process = Components.classes["@mozilla.org/process/util;1"]
        .createInstance(Components.interfaces.nsIProcess);
        var unicode_converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                                .createInstance(Ci.nsIScriptableUnicodeConverter);
        unicode_converter.charset = 'utf-8';      
        file_path = unicode_converter.ConvertFromUnicode(file.path);
      }
      try {
        process.init(external_path);
        var parameter = [file_path];
        process.run(false, parameter, 1);
      } catch(e) {} /* FIXME: Error display */
    } else {
      /* Normal approach */
      try {
        file.launch();
      } catch(e) {
        /* For *nix, launch() didn't work, so...  */
        /* See also: http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/downloads/content/downloads.js */
        var uri = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService).newFileURI(file);
        var protocol_service = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                              .getService(Ci.nsIExternalProtocolService);
        protocol_service.loadUrl(uri);
      }
    }
  },
  openFolder: function() {
    if (this.recent_row < 0) { return; }
    if (!nicofox_ui.manager.rows[this.recent_row].video_file) { return; }
    var file = Cc["@mozilla.org/file/local;1"]
               .createInstance(Ci.nsILocalFile);
    file.initWithPath(nicofox_ui.manager.rows[this.recent_row].video_file);
    if (!file.exists()) { return false; }
    try {
      file.reveal();
    } catch(e) {
      /* For *nix, reveal() didn't work, so...  */
      /* See also: http://mxr.mozilla.org/seamonkey/source/toolkit/mozapps/downloads/content/downloads.js */
      file = file.parent;
      var uri = Cc["@mozilla.org/network/io-service;1"]
               .getService(Ci.nsIIOService).newFileURI(file);
      var protocol_service = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                            .getService(Ci.nsIExternalProtocolService);
      protocol_service.loadUrl(uri);
    }
  },
  go: function() {
    if (this.recent_row < 0) { return; }
    if (!nicofox_ui.manager.rows[this.recent_row].url) { return; }
    nicofox.openInTab(nicofox_ui.manager.rows[this.recent_row].url);
  },
  copy: function() {
    if (this.recent_row < 0) { return; }
    if (!nicofox_ui.manager.rows[this.recent_row].url) { return; }  
    var clipboard_helper = Cc["@mozilla.org/widget/clipboardhelper;1"]  
                          .getService(Ci.nsIClipboardHelper);  
    clipboard_helper.copyString(nicofox_ui.manager.rows[this.recent_row].url);  
  },
  selectAll: function() {
    document.getElementById('smilefox-tree').view.selection.rangedSelect(0, nicofox_ui.manager.rows.length, true);
    document.getElementById('smilefox-tree').focus();
  },
  remove: function() {
    var tree = document.getElementById('smilefox-tree'); 
    var start = new Object();
    var end = new Object();
    var count = 0;
    var removing_ids = [];
    for (i = 0; i < tree.view.selection.getRangeCount(); i++) {
      tree.view.selection.getRangeAt(i, start, end);
      for (var j = start.value; j <= end.value; j++) {
        /* when it is failed, completed, canceled or waiting, we can remove it */
        if(nicofox_ui.manager.rows[j].status <= 4) {
          removing_ids.push(nicofox_ui.manager.rows[j].id);
        }
      }
    }
    for(i = 0; i < removing_ids.length; i++) {
      nicofox.download_manager.remove(removing_ids[i]);  
    }
  },
  activate: function(e) {
    var tree = document.getElementById("smilefox-tree");
    
    /* Get where we are (somethimes right click do not select the proper item, we will manully select it */
    var row = { }, col = { }, child = { };
    tree.treeBoxObject.getCellAt(e.clientX, e.clientY, row, col, child);
    this.recent_row = row.value;

    if(this.recent_row == -1) {
      /* Out of the range, but something is still selected */
      this.recent_row = tree.currentIndex;
      if (this.recent_row == -1) {
        /* Nothing selected */
        document.getElementById('smilefox-popup').style.display='none';
        return;
     }
    } else {
      /* We won't manully select for multiple selection */
      if (tree.view.selection.getRangeCount() < 1) {
        tree.view.selection.select(this.recent_row);
        this.multiple_select = false;
      }
    }
    document.getElementById('smilefox-popup').style.display='-moz-popup';
    selected_row = nicofox_ui.manager.rows[this.recent_row];
    
    if(nicofox_ui.manager.rows[this.recent_row].status == 0) {
      /* Waiting */
      document.getElementById('popup-missing').style.display = 'none';
      document.getElementById('popup-retry').style.display = 'none';
      document.getElementById('popup-cancel').style.display = 'none';
      document.getElementById('popup-open').style.display = 'none';
      document.getElementById('popup-open-external').style.display = 'none';
      document.getElementById('popup-open-folder').style.display = 'none';
      document.getElementById('popup-remove').style.display = 'block';
    } else if(nicofox_ui.manager.rows[this.recent_row].status == 1) {
      /* Completed */
      document.getElementById('popup-missing').style.display = 'none';
      document.getElementById('popup-retry').style.display = 'none';
      document.getElementById('popup-cancel').style.display = 'none';
      
      var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
      file.initWithPath(nicofox_ui.manager.rows[this.recent_row].video_file);

      if (file.exists()) {
        /* If we cannot find the file, do not show the following things */
        document.getElementById('popup-open').style.display = 'block';
        /* NicoFox player do not support SWF currently */
        if (nicofox_ui.manager.rows[this.recent_row].video_file.match(/\.swf$/)) { document.getElementById('popup-open').style.display ='none';
          //document.getElementById('popup-open-swf-player').style.display ='block';
        } else {
          document.getElementById('popup-open').style.display ='block';
          //document.getElementById('popup-open-swf-player').style.display ='none';
        }
        document.getElementById('popup-open-external').style.display = 'block';
        document.getElementById('popup-open-folder').style.display = 'block';
      } else {
        document.getElementById('popup-missing').style.display = 'block';
        document.getElementById('popup-retry').style.display = 'block';
        /* Give some way to retry download! */
        document.getElementById('popup-open').style.display = 'none';
        //document.getElementById('popup-open-swf-player').style.display ='none';
        document.getElementById('popup-open-external').style.display = 'none';
        document.getElementById('popup-open-folder').style.display = 'none';
      }
      document.getElementById('popup-remove').style.display = 'block';
    } else if(nicofox_ui.manager.rows[this.recent_row].status > 4) {
      /* When downloading */
      document.getElementById('popup-missing').style.display = 'none';
      document.getElementById('popup-retry').style.display = 'none';
      document.getElementById('popup-cancel').style.display = 'block';
      document.getElementById('popup-open').style.display = 'none';
      //document.getElementById('popup-open-swf-player').style.display ='none';
      document.getElementById('popup-open-external').style.display = 'none';
      document.getElementById('popup-open-folder').style.display = 'none';
      document.getElementById('popup-remove').style.display = 'none';
    } else {
      /* Failed/canceled */ 
      document.getElementById('popup-missing').style.display = 'none';
      document.getElementById('popup-retry').style.display = 'block';
      document.getElementById('popup-cancel').style.display = 'none';
      document.getElementById('popup-open').style.display = 'none';
      //document.getElementById('popup-open-swf-player').style.display ='none';
      document.getElementById('popup-open-external').style.display = 'none';
      document.getElementById('popup-open-folder').style.display = 'none';
      document.getElementById('popup-remove').style.display = 'block';
    }
  }
};

window.addEventListener("load", nicofox_ui.manager.load, false);
window.addEventListener("unload", nicofox_ui.manager.unload, false);

