const Cc = Components.classes;
const Ci = Components.interfaces;

var aboutNicoFox = {

  /* URI Helper */
  makeURI: function(aURL, aOriginCharset, aBaseURI) {
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    return ioService.newURI(aURL, aOriginCharset, aBaseURI);
  },
  /* Prepare for nsINavHistoryService */
  historySvc: null,
  /* Prepare for nsINavBookmarksService */
  bookmarkSvc: null,
  /* Prepare for nsITaggingService */
  taggingSvc: null,

  /* Determine what type (directory) to show */
  type: 'recently-bookmarked',
  /* Select terms to find */
  terms: '',
  /* Choose an tag to show */
  tagName: '',

  /* When loaded, load bookmark items and tags */
  load: function() {
    /* Load services first */
    aboutNicoFox.historySvc = Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService);
    aboutNicoFox.bookmarkSvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
    aboutNicoFox.taggingSvc = Cc["@mozilla.org/browser/tagging-service;1"].getService(Ci.nsITaggingService);

    document.getElementById('keyword').addEventListener('command', function(e) {
      aboutNicoFox.terms = this.value;
      aboutNicoFox.loadBookmarks();
      e.stopPropagation();
      e.preventDefault();

    }, false);

    aboutNicoFox.testUserscript();
    aboutNicoFox.loadBookmarks();
    aboutNicoFox.loadTags();
  },
  /* Load bookmarks from places database, using some specific parameters */
  loadBookmarks: function() {
    var itemBlock = document.getElementById('item-list');
    /* Clean old result */
    while (itemBlock.firstChild) 
    {
      itemBlock.removeChild(itemBlock.firstChild);
    };
    

    // Access to the private DB Connection: BEWARE!
    var db = aboutNicoFox.historySvc.QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;

    /* Set options 
       XXX: Need parameters to set how to sort */
    var options = aboutNicoFox.historySvc.getNewQueryOptions();
    options.queryType = Ci.nsINavHistoryQueryOptions.QUERY_TYPE_BOOKMARKS;
    if (aboutNicoFox.tagName) {
      //options.resultType = Ci.nsINavHistoryQueryOptions.RESULTS_AS_TAG_CONTENTS;
    }
    
    /* Set queries to http://www.nicovideo.jp/watch/
       XXX: How to set multiple websites? */
    var query = aboutNicoFox.historySvc.getNewQuery();
    query.uri = aboutNicoFox.makeURI('http://www.nicovideo.jp/watch/');
    query.searchTerms = aboutNicoFox.terms;
    query.uriIsPrefix = true;
    if (aboutNicoFox.tagName) {
      query.tags = [aboutNicoFox.tagName];
    }
/*    if (aboutNicoFox.tagId >= 0) {
      query.setFolders([aboutNicoFox.tagId], 1);
    }*/

    /* Execute the query */
    var result = this.historySvc.executeQuery(query, options);
    var container = result.root;
    var count = 0;
    /* Read results */
    container.containerOpen = true;
    for (var i = 0; i < container.childCount; i ++) {
      /* Get an nsINavHistoryResultNode */
      var node = container.getChild(i);
      
      /* Create a block, set its style and ID correspoding to its item ID */
      var block = document.createElement('div');
      block.id = 'item-' + node.itemId;
      block.className = 'item';
      
      /* Thumbnail */
      var thumb = document.createElement('img');
      thumb.src = 'chrome://nicofox/content/about_nicofox/black.png';
      thumb.style.width = '96px';
      thumb.style.height = '72px';
      thumb.className = 'thumb';
      
      /* Choose site-specific thumbnail */
      /* XXX: We need a better API to handle this; even store thumbnail in Places database */
      /* Match most part of nicovideo thumbnail */
      var url_match_nicovideo = node.uri.match(/^http:\/\/(www|tw|es|de)\.nicovideo\.jp\/watch\/[a-z]{2}([0-9]+)$/)
      if (url_match_nicovideo) {
        thumb.src = 'http://tn-skr.smilevideo.jp/smile?i=' + url_match_nicovideo[2];
      }
      
      /* Inner block: contains favicon, title, tags */
      var innerBlock = document.createElement('div');
      innerBlock.className = 'video-inner-block';
      var favicon = document.createElement('img');
      favicon.src = node.icon.spec;
      var link = document.createElement('a');
      link.href = node.uri;
      link.textContent = node.title;
      link.className = 'video-link';

      var tags = aboutNicoFox.taggingSvc.getTagsForURI(aboutNicoFox.makeURI(node.uri), {});
      var tagBlock = document.createElement('div');
      tagBlock.textContent += tags;
      
      /* Append all */
      innerBlock.appendChild(favicon);
      innerBlock.appendChild(link);
      innerBlock.appendChild(tagBlock);
      block.appendChild(thumb);
      block.appendChild(innerBlock);

      itemBlock.appendChild(block);
      count++;	
    }
    /* Done, Close container */
    container.containerOpen = false;
    /* No result message */
    if (count == 0) {
      var noResult = document.createElement('p');
      noResult.textContent = '找不到結果。';
      noResult.className = 'no-result';
      itemBlock.appendChild(noResult);
    }
  },
  loadTags: function() {
    /* Make a "Clear Tag Result" event */
    document.getElementById('tag-all').addEventListener('click', function(e) {
      aboutNicoFox.selectTag(-1);
      e.stopPropagation();
      e.preventDefault();
    } , false);

    /* Access to the private DB Connection: BEWARE! */
    var db = aboutNicoFox.historySvc.QueryInterface(Ci.nsPIPlacesDatabase).DBConnection;
    
    /*
    SELECT t.title, COUNT(*)
    FROM moz_bookmarks t  LEFT OUTER JOIN moz_bookmarks b  ON b.parent = t.id LEFT OUTER JOIN moz_places p ON b.fk = p.id
    WHERE p.url LIKE 'http://www.nicovideo.jp/watch/%' AND t.type= 2 AND t.parent = 4 GROUP BY t.title
    
    => Nicovideo-related Places => LEFT OUTER JOIN => Bookmarks => LEFT OUTER JOIN => Tags
    XXX: What about other websites?
    */
   var statement = db.createStatement('SELECT t.id AS i, t.title AS n, COUNT(*) AS c FROM moz_bookmarks t  LEFT OUTER JOIN moz_bookmarks b  ON b.parent = t.id LEFT OUTER JOIN moz_places p ON b.fk = p.id WHERE p.url LIKE \'http://www.nicovideo.jp/watch/%\' AND t.type= 2 AND t.parent = ?1 GROUP BY t.title ORDER BY c DESC'); 
    statement.bindInt32Parameter(0, aboutNicoFox.bookmarkSvc.tagsFolder);
    statement.executeAsync({
      handleResult: function(aResultSet) {
        var tagIds = new Array();
        var tagNames = new Array();
        var tagCounts = new Array();
        var tagLength = 0;
        var tagList = document.getElementById('tag-list');
        for (var row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
        
          var valueId = row.getResultByName("i");
          tagIds.push(valueId);
          var valueName = row.getResultByName("n");
          tagNames.push(valueName);
          var valueCount = row.getResultByName("c");
          tagCounts.push(valueCount);
          tagLength++;
        }
        for (var i = 0; i < tagLength; i++) {
          var tagItem = document.createElement('li');
          tagItem.id = 'tag-' + tagIds[i] ;
          tagItem.className = 'tag-normal';
          tagItem.textContent = tagNames[i] + ' (' + tagCounts[i] + ')';
          
          tagItem.addEventListener('click', (function(id, name) {
            return function(e) {
              aboutNicoFox.selectTag(id, name);
              e.stopPropagation();
              e.preventDefault();
            }
          })(tagIds[i], tagNames[i]) , false);
          tagList.appendChild(tagItem);
        }
      },

      handleError: function(aError) {
        print("Error: " + aError.message);
      },

      handleCompletion: function(aReason) {
        if (aReason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED)
          print("Query canceled or aborted!");
      }
    });


  },
  /* Fire when using select an tag in interface */
  selectTag: function(id, name) {
    aboutNicoFox.tagName = name;
    aboutNicoFox.loadBookmarks();
    /* Clean and refresh the interface */
    var actives = document.getElementsByClassName('tag-active');
    for (var i = 0; i < actives.length; i++) {
      actives[i].className = 'tag-normal';
    }
    if (id == -1) {
      document.getElementById('tag-all').className = 'tag-active';
    } else {
      document.getElementById('tag-'+parseInt(id, 10)).className = 'tag-active';
    }
  },
  /* Test if user is using additional mylist userscript: (under NYSL)
     http://castor.s26.xrea.com/products/greasemonkey/nicovideo_additional_mylist.html
     And let user to import the list into Firefox bookmark */
  testUserscript: function() {
    var prefName = 'greasemonkey.scriptvals.http://castor.s26.xrea.com//NicoVideo Additional MyList.additional_mylist';
    var prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
    if (prefs.prefHasUserValue(prefName)) {
      /* Try to parse its toSource() value in evalInSandbox()
         JSON.parse() can't work on toSource()-type string and there is no easy way to convert... */
      var prefValue = prefs.getCharPref(prefName);
      var s = Components.utils.Sandbox("about:blank");                         
      var prefArray = Components.utils.evalInSandbox('('+ prefValue +')', s);
       
      /* Test if the result is an array, prevent a lot of hack */
      if ((typeof toString.call(prefArray)) === "[object Array]") {
        return;
      }
      /* Some filtering, we will re-eval and test all parameters when importing it */
      if (typeof prefArray.length != "number") {
        return;
      }
      var importBlock = document.getElementById('import');
      importBlock.innerHTML = '我們發現您有使用過額外 Mylist 這個 Userscript，且有 ' + prefArray.length + ' 筆紀錄於其中。 <input type="button" value="引入到書籤（施工中）" disabled="disabled" />';
    }
  }
};
window.addEventListener('load', aboutNicoFox.load, false);
