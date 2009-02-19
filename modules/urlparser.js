var EXPORTED_SYMBOLS = ['nicofox'];
Components.utils.import('resource://nicofox/common.js');

var Cc = Components.classes;
var Ci = Components.interfaces;
if(!nicofox) { var nicofox = {}; }

nicofox.parser = function() {};

nicofox.parser.prototype = {
  supported_sites: {
    'nico': /^http:\/\/(www|tw|es|de)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+$/,
    //'parasite': /^http:\/\/(www\.)?parasitestage\.net\/Page\/MediaView\.aspx\?ID\=[0-9]+$/,
    //'keytalks': /^http:\/\/tw\.keytalks\.com\/watch\/?\?v\=([0-9a-zA-Z\-\_]+)(\&.*)?$/
  },
  goParse: function(url) {
    /* Security check */
    if (typeof this.return_to != 'function') { return false; }
    var inner_parser;
    /* Test sites URL */
    /* TODO: Now it is hard-coding, can it be more smart? */
    if (this.supported_sites.nico.test(url)) {
      Components.utils.import('resource://nicofox/urlparser_nico.js');
      inner_parser = new nicofox.parser.nico();
    /*} else if (this.supported_sites.parasite.test(url)) {
      Components.utils.import('resource://nicofox/urlparser_parasite.js');
      inner_parser = new nicofox.parser.parasite();*/
    /*}else if (this.supported_sites.keytalks.test(url)) {
      Components.utils.import('resource://nicofox/urlparser_keytalks.js');
      inner_parser = new nicofox.parser.keytalks();*/
    } else {
      /* Return a error */
      this.return_to(false); return false;
    }
    /* Go parse! */
    inner_parser.return_to = this.return_to;
    inner_parser.goParse(url);
    return true;
  },

};
