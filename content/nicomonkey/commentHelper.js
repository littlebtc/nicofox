/* vim: sw=2 ts=2 sts=2 et filetype=javascript
 *
 * Add "Comment Helper" on video watching page, where user can choose how comment will be displayed.
 * e.g. http://bit.ly/cdHg62
 *
 * Technically,
 * It will injected text content into Nicovideo's old AS2-based player, which is still used in non-Japan site.
 * Won't work on new AS3 player.
 */

/* Icons in base64 data URL */
var comment_big_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAA40lEQVQ4y92UbQ3DIBCGsYGBGsAACqoABzjAAhbQgAlcYIblbXPbhdEBK/uzSy4lFJ775IQQovxA+4dijCWlVJRS66AAQv4YqrU+LrWUoMaYyzOVwXORcy53hYFfFXbONZUMeu8vz4QQyrZt4zklKMJfUigp5RMKb5ZA4R0EYOgSKHINsdYeUOTvFpRCJw9hAGtWkHko95IbQd9+BaVc1gCE39rvQnlxWqGiCwh8kYr2Bci+7915AMOUnjcofzn4Yhb0qswdgBF2Rxwh8AZHQUanPLVa9TjOnwCPePepsFPzdFYfEae5llk9KVoAAAAASUVORK5CYII=";
var comment_medium_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAiklEQVQ4y2NgYGD4TwM83Aw1Njb+z8PDQ11Db9269b+qqmqQGZqdnf3/8OHDKBhkKAgji61bt454Q0EuAhkACkcYBhnS3d0N58fExIDVkGwoshjIUGTvgwweHIaCAKEwJculIBqGQXxQxMD4oPAlyVBsiRzd+1RJp0PHUJpkU5CBDg4OI7U8HXBDAWr5O+HKLrg+AAAAAElFTkSuQmCC";
var comment_small_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAjElEQVQ4y2NgYGD4TwM8auhAGVpVVfV/3bp11Df08OHDtDPUwcGBMkNv3bqFYqiamhpYjIDBuA3Mzs6GhyOyS0HiBIICt6EgjTExMVjDFMQGiZFkaHd3N4oh6IaCvA8LGqIMBbkOpAEUfvhiH+YLol2KbCBNkhTIqyAD58yZQz1DQYaBwni0lBpmhgIA8HkCsQ3tVm8AAAAASUVORK5CYII=";

var comment_naka_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAYElEQVQ4y93UMQ4AIQhEUY42R/s3Z6vNRt1GYRpJaF9AgYiINOQNqKQEEkhJPSiQbwB1tAD+o0VwRRvAEW0CP1TSAO7mNB1rlScxdWas1PKmtt+3zalto2y7b7tS91/+B7Rbf/EANcTnAAAAAElFTkSuQmCC";
var comment_ue_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAKklEQVQ4y2NkYGD4z0BlwAg29L8iFU28P2oozSJq1NBRQ0cNHTV0RBkKAFORHQFBmg22AAAAAElFTkSuQmCC";
var comment_shita_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAKElEQVQ4y2NkYGD4z0BlwDhq6Kiho4aOGjpSDf2vSEUT748aSoOIAgB5OR0BKh6O2gAAAABJRU5ErkJggg==";

var transparent_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAABtJREFUOE9jYBgFoyEwGgKjITAaAqMhMIJCAAAG+QABfCL3XAAAAABJRU5ErkJggg==";
/* Add comment helper, if the flvplayer_container exists (video playing works) and player is old player 
 * XXX: Remove GM_getValue
 */
if(document.getElementById('flvplayer_container') && GM_getValue("comment_helper")) {
  if (document.getElementById('flvplayer')) {
    var playerVerMatch = document.getElementById('flvplayer').src.match(/([0-9]+)$/);
    if (playerVerMatch && parseInt(playerVerMatch[0], 10) < 1262084704) {
      window.setTimeout(addCommentHelper, 10);
    }
  }
}

function addCommentHelper() {
  /* Add CSS */
  GM_addStyle("#comment_helper_premium { margin-left: 5px; } #comment_helper textarea {font-family: sans-serif; font-size: 9pt; width: 245px; overflow: hidden; height: 25px; margin:0; padding: 0; vertical-align: middle;} #comment_helper .fox-ch-selected {border: 3px solid #33FF99;} #comment_helper a { display: inline-block; width: 21px; height: 21px; margin: 1px; border: 1px solid #999999; text-decoration: none; }");

  /* The comment helper */
  var comment_helper = document.createElement("div");
  comment_helper.id = "comment_helper";

  comment_helper.innerHTML = 
  '<a href="#" id="comment_helper_naka" style="background:url('+comment_naka_uri+')" class="fox-ch-selected">&nbsp;</a>'+
  '<a href="#" id="comment_helper_ue" style="background:url('+comment_ue_uri+')">&nbsp;</a>'+
  '<a href="#" id="comment_helper_shita" style="background:url('+comment_shita_uri+')">&nbsp;</a>'+
  '<a href="#" id="comment_helper_big" style="background:url('+comment_big_uri+')">&nbsp;</a>'+
  '<a href="#" id="comment_helper_medium" style="background:url('+comment_medium_uri+')" class="fox-ch-selected">&nbsp;</a>'+
  '<a href="#" id="comment_helper_small" style="background:url('+comment_small_uri+')">&nbsp;</a>'+
  '<a href="#" id="comment_helper_white" class="fox-ch-selected" style="background: #FFFFFF;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_red" style="background: #FF0000;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_pink" style="background: #FF8080;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_orange" style="background: #FFCC00;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_yellow" style="background: #FFFF00;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_green" style="background: #00FF00;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_cyan" style="background: #00FFFF;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_blue" style="background: #0000FF;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_purple" style="background: #C000FF;">&nbsp;</a>'+
  '<span id="comment_helper_premium" style="display: none;">'+
  '<a href="#" id="comment_helper_white2" style="background: #CCCC99;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_red2" style="background: #CC0033;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_orange2" style="background: #FF6600;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_yellow2" style="background: #999900;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_green2" style="background: #00CC66;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_blue2" style="background: #33FFFC;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_purple2" style="background: #6633CC;">&nbsp;</a>'+
  '<a href="#" id="comment_helper_black" style="background: #000000;">&nbsp;</a>'+
  '</span>'+
  '<textarea rows="1" value="" onchange="$(\'flvplayer\').SetVariable(\'inputArea.ChatInput1.text\', this.value);" onkeyup="this.onchange();"></textarea>';

  /* Insert the helper under the player */
  var flvplayer_container = document.getElementById('flvplayer_container')
  flvplayer_container.parentNode.insertBefore(comment_helper ,flvplayer_container.nextSibling);

  var helper_links = comment_helper.getElementsByTagName('a')
  for (var i = 0; i < helper_links.length; i++)  
  {
    helper_links[i].addEventListener('click', commentHelperSelect, false);
  }
  /* Lazy sanitizer: Stringify unsafeWindow.User using JSON then re-parse it */
  if ((typeof unsafeWindow.User) != "object") { return; }
  var nicoUserJSON = "";
  var nicoUser = {};
  try {
    nicoUserJSON = JSON.stringify(unsafeWindow.User);
    nicoUser = JSON.parse(nicoUserJSON);
  } catch(e) {
    throw new Error("Cannot convert User parameter into JSON!");
    return;
  }
  /* If user is in premium, it can use extra scripts */
  if (nicoUser.isPremium) {
    document.getElementById("comment_helper_premium").style.display = "inline";
  }
}

var ch_position = 'naka';
var ch_positions = ['naka', 'shita', 'ue']
var ch_size = 'medium';
var ch_sizes = ['medium', 'big', 'small']
var ch_color = 'white';
var ch_colors = ['white', 'red', 'pink', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple',
                 'white2', 'red2', 'orange2', 'yellow2', 'green2', 'blue2', 'purple2', 'black'];

function commentHelperSelect(e)
{
  var id = e.target.id;
  /* When click on img, the id will be empty */
  if (!id) { id = e.target.parentNode.id; }
  if (!id) { return; }
  
  var sel = id.match(/comment\_helper\_(.*)$/);
  if(!sel) { return; }
  sel = sel[1];
  if (ch_positions.indexOf(sel) != -1)
  {  
    document.getElementById('comment_helper_'+ch_position).className = '';
    document.getElementById('comment_helper_'+sel).className = 'fox-ch-selected';
    
    ch_position = sel;
  }
  if (ch_sizes.indexOf(sel) != -1)
  {
    document.getElementById('comment_helper_'+ch_size).className = '';
    document.getElementById('comment_helper_'+sel).className = 'fox-ch-selected';

    ch_size = sel;
  }
  if (ch_colors.indexOf(sel) != -1)
  {
    document.getElementById('comment_helper_'+ch_color).className = '';
    document.getElementById('comment_helper_'+sel).className = 'fox-ch-selected';

    ch_color = sel;
  }

  var mail_inputs = [];
  if (ch_positions.indexOf(ch_position) != 0) mail_inputs.push(ch_position);
  if (ch_sizes.indexOf(ch_size) != 0) mail_inputs.push(ch_size);
  if (ch_colors.indexOf(ch_color) != 0) mail_inputs.push(ch_color);

  var mail_input = mail_inputs.join(' ');
  var js = "$('flvplayer').SetVariable('inputArea.MailInput.text','" + mail_input + "');"; 
  document.location.href='javascript: void(eval(\''+js.replace(/\'/g,'\\\'')+'\'));';
  e.stopPropagation();
  e.preventDefault();
}

