// ==UserScript==
// @name           Nicomonkey
// @namespace      http://www.nicovideo.jp/fox
// @include        http://www.nicovideo.jp/*
// @include        http://tw.nicovideo.jp/*
// @include        http://de.nicovideo.jp/*
// @include        http://es.nicovideo.jp/*
// @include        http://ch.nicovideo.jp/*
// ==/UserScript==

/* Greasemonkey compatibility */
/*
	var NM_getString = function(str) { return str; };
*/

var comment_naka_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAIlJREFUOE+9lF0OwCAIg9nNPBo3d0PDpviTEbqZEHn6UtLCQUT5KvgTKLrgwDL5UmVKKTNzKekdE62hAtMnfRgaAM7HDwJHKADYQ0HAByrutqao629/k47qfqvypjsak44K/USpVevMpc1wH36QWeNGAcDzNQ2Cf9x9TQT8Sjmu0t79AKgF4y//CV9HbAYNfLwgAAAAAElFTkSuQmCC';
var comment_ue_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAERJREFUOE9jZGBg+A/EVAf/Gf4rUg9DHUk9A0GOG4KGQpxMTUxVw5DClLquBCdRanp71KWQbD8aplQPAqobOBpRNEinAC1++Owoo4AmAAAAAElFTkSuQmCC';
var comment_shita_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAEBJREFUOE9jZGBg+A/EVAcgQ6mNqW4g2OfUduWooaNhSoNkNZpOqZ+saBWm/xX/M1ALQ8tn6hkIctgQNJTKsQ8AQAj47EvrtdgAAAAASUVORK5CYII=';
var transparent_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAABtJREFUOE9jYBgFoyEwGgKjITAaAqMhMIJCAAAG+QABfCL3XAAAAABJRU5ErkJggg==';

var comment_big_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAQhJREFUOE/dlGENg0AMhW8yMIABDKAABTjAARawgAZM4AIzt3136dLdKL1k/FqTZkvWe33vtd0jhBBfeXsAepnbtsV932PXdW6tkHQLAST+GLTv+yTvLEX+OI5mTWFNHtJxHMm3X0IBZ1AmPM/zaUrDZVnMmnVdY9u2MvTrddIqkO+tX9VKNU3ztgY2t4DCjsAC8hZQvCamaUqg+F4BbHsq0oUhDfiuBmI1sEE1S9hJE/bWYXsOKl6WAMgnHOBvUD2cM6lsgQAbVnyCygMeDcNgypTTxWOGWNiRQZEll8Mn/wXelDUBmqg3IU1TAClkIB6g/C6rhjJ1HJkpwDXsrGbFCfu3X8ta6p68hKWr5mJCJAAAAABJRU5ErkJggg==';
var comment_medium_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAK5JREFUOE/VlN0NgCAMhPGdbViAQdiADViBXViCLVimciYY/CEWg1FJ7gFSP9qrZRJCUNbwBehoDQculbOyVEqRlJIVy4amlMg59zGotZZijBshU6g+DyG0Mj96ijIBgI9FgHnv170xZolp9KQNrT8AtPYUl30DSnnV/p15eitTlFsEABpT9vC3C3r2k+89vRga3kT9B/rImKJBWuuxs899zcqjz729J47X/dcznQEV5Sf2x+oA8AAAAABJRU5ErkJggg==';
var comment_small_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAVCAYAAACpF6WWAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAlwSFlzAAAOwwAADsMBx2+oZAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAALZJREFUOE/lk9ENwyAMROkyzMEgbMAGrMAKzMASbMEytIfkCBKoXYkqH4nED8SPu7N5KaXqZ23/AN29tgOb890qb4Z672tKSepKZh/QnPP/oMYYDv5daSmlAUip1rpijwGvoc65I8fePvaZKNZQFFprB6U0gjjDRYuRnENDCIOac6Ngn6KZgK9QqEMB8qOCWffJhQiKn3pg3yjhC+TnFFaRYYyRGyU656GAIWOhypvf/g8qn670DZtl7reHU6OQAAAAAElFTkSuQmCC';

var tag_add_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAH3SURBVDjLhZNJjxJhEIb7T8xVw78g6fh75mJGY/SqTjRGTXTcbu7xxtItPew2YxMgbGkCNMgSQkgDAiHRKNpkWPL61ZfQGcLioS5V9T711tfVQrVaRaVSQblcRqlUQrFYRKFQgK7ryOfzBwCEfSEYhoHlcrkRvV6PQzKZzF6IQJNJYJomn9zpdGwI5ZgLJJPJnRCBLFMzTaNELpfTJ5MJ5vM5zxMwnU5D07StEIGmrhqZ+JxZNqfTKUY/u4gbMq+1220kEgnEYrENiECTV5YXiwVIPP71Hc9Or+ORdAjNkHit1WqRC0QikTWIwHa0xuMxb5rNZhj+6OLk9Bpef7mN92f38JyBVpBms0kuEAgEbIiQzWavsB2t0WjEm76ZOTyWD/FWvYtP2kN8OLu/Bmk0GuQCPp+PQzgllUqJbEdrOBzypnq3gKe+I7xTj23IiXKEWMnF67VajVxAkqQDe5d4PC6yHa3BYLAB+fj1AV4Fb+KlcgvzxYy7CIVC8Hg8l9delO0nqqpq9ft9G/Lk81W88N/Am+gx/vz9fVHssFe4GNFoVAyHwxZdIrdr6kx8B9Nzyxa73W6H/YjbjiMYDIp+v9+iS1x9YhKz/Jp4J4BCURQne2mLDqxer28V7wVQyLLs9Hq9FoldLpdj6yn/73dlU51MfGlX/R/5GCirExPTUwAAAABJRU5ErkJggg==';

var dl_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwAAADsABataJCQAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAERJREFUKFNjZMAE/9GEGLGogQv9RwdAGXQDUPQPZQ0gj4ExDk/D5HGHDjGhhWE6TABf0JIcrCA3wjURijTkGMTwJEwSADYjyjg7tSRjAAAAAElFTkSuQmCC';

var jp_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAE2SURBVHjaYvz69SsDEvj37x+ERGbAwZ9//wACiAUoysXFBST///8P0QOm//+HU0jgxYsXAAHEAlP0H8HYt+//4SP/f//6b2b238sLrpqRkRFoCUAAsaCrXrv2/8KF///8+f/r9//Dh/8/ffI/OQWiAeJCgABigrseJPT27f/Vq////v3/1y8oWrzk/+PHcEv+/PkDEEBMEM/B3fj/40eo0t9g8suX/w8f/odZAVQMEEAsQAzj/2cQFf3PxARWCrYEaBXQLCkpqB/+/wcqBgggJrjxQPX/hYX/+/v///kLqhpIBgf/l5ODhxiQBAggFriToDoTEv5zcf3ftQuk2s7uf0wM3MdAAPQDQAAxvn37lo+PDy4KZUDcycj4/z9CBojv3r0LEEAgG969eweLSBDEBSCWAAQYACaTbJ/kuok9AAAAAElFTkSuQmCC';

var tw_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAFjSURBVHjaYmRQ38wAB3/+gdCvfww//jx8Hy7BwPAPAwEEEAtQWUutDpA0EmZnZmI68vTL338Mf//+FbhQwPznK9Pv3////PkPI79s2gQQQCwQo0W+/nMOFWdlZXww+8vhN9///Pn3596Df78//f/1+//vX/9//QKqZpSVBdoAEEAsQGv+/fv3+9dfBgag4L/v3//8/vsPqAGqFKT6N0QDA1CagQEggFgY/vz5+5fhwo/fNXPu/fn379nHn3/+/vsNNAPJbLgGoFsAAoiF4RdQ2b+/f/4+f/cHaPDvv/+BHgAy2H9/QaiGaACKMjAABBDL36ehDJfy/z94ADSP4TfYf0jOQCYZwU4CCCAWIGYECwENQFGEqhokC3QBAwNAAIE0MIODjAGuCFPbH6CGv8DABvoBIIBAGph+/2GQlAQb85fhD0gnI9hIBggJRH//QhBQMUAAMX5FjUgGbLELlwICgAADAElTZuDmjaewAAAAAElFTkSuQmCC';

var de_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAGzSURBVHjaYvTxcWb4+53h3z8GZpZff/79+v3n/7/fDAz/GHAAgABi+f37e3FxOZD1Dwz+/v3z9y+E/AMFv3//+Qumfv9et241QACxMDExAVWfOHkJJAEW/gUEP0EQDn78+AHE/gFOQJUAAcQiy8Ag8O+fLFj1n1+/QDp+/gQioK7fP378+vkDqOH39x9A/RJ/gE5lAAhAYhzcAACCQBDkgRXRjP034R0IaDTZTFZn0DItot37S94KLOINerEcI7aKHAHE8v/3r/9//zIA1f36/R+o4tevf1ANYNVA9P07RD9IJQMDQACxADHD3z8Ig4GMHz+AqqHagKp//fwLVA0U//v7LwMDQACx/LZiYFD7/5/53/+///79BqK/EMZ/UPACSYa/v/8DyX9A0oTxx2EGgABi+a/H8F/m339BoCoQ+g8kgRaCQvgPJJiBYmAuw39hxn+uDAABxMLwi+E/0PusRkwMvxhBGoDkH4b/v/+D2EDyz///QB1/QLb8+sP0lQEggFh+vGXYM2/SP6A2Zoaf30Ex/J+PgekHwz9gQDAz/P0FYrAyMfz7wcDAzPDtFwNAgAEAd3SIyRitX1gAAAAASUVORK5CYII=';

var es_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAALCAIAAAD5gJpuAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAFnSURBVHjaYvzPgAD/UNlYEUAAmuTYAAAQhAEYqF/zFbe50RZ1cMmS9TLi0pJLRjZohAMTGFUN9HdnHgEE1sDw//+Tp0ClINW/f0NIKPoFJH/9//ULyGaUlQXaABBALAx/Gf4zAt31F4i+ffj3/cN/XrFfzOx//v///f//LzACM/79ZmD8/e8TA0AAMYHdDVT958vXP38nMDB0s3x94/Tj5y+YahhiAKLfQKUAAcQEdtJfoDHMF2L+vPzDmFXLelf551tGFOOhev4A/QgQQExgHwAd8IdFT/Wz6j+GhlpmXSOW/2z///8Eq/sJ18Dw/zdQA0AAMQExxJjjdy9x2/76EfLz4MXdP/i+wsyGkkA3Aw3984cBIIAYfzIwMKel/bt3jwEaLNAwgZIQxp/fDH/+MqqovL14ESCAWICeZvr9h0FSEhSgwBgAygFDEMT+wwAhgQgc4kAEVAwQQIxfUSMSTxxDAECAAQAJWke8v4u1tAAAAABJRU5ErkJggg==';

var hatena_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjM2qefiJQAAAF5JREFUOE9jYKAGUGSo/08OhtsN0mzvSRoG6cEwwJjh2H8Phv94MUgNyDK8BvzHAmAGk2QASDEIwwDIEJINgGmCGTISDaAoEJFjk6RoxJeY8MYCKckZIyVSlJkoydEAc9fBKNfsZfgAAAAASUVORK5CYII=';

var music_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAETSURBVBgZfcExS0JRGIDh996OFIQEgSRhTS1Bg0trw937B9UPCAT3hnJ1kYbGhrv0BxoaXSsMhBCsyUEcoiTKUM/3HU8Fce4Q+DyRZz5DcOkdiqIIiiAo7xiCMXs4HI4ZisPhOMcQOJQbOoxxKHm22UUxBBbHM1cRfw58GUtMIAieTIwgxAQWRclMEZSYwCIIGYsixASCYsl4pgiGwDFF+HWUaDopbfCGHRp+nCWSTktFXvFDOKyuNNYp4LhFriPPaXW5UWAV5Y6HNH+/dbHJIjN6NHlJzMnxWqNIDqFHh8/U7hiEJbp0+ar0m2a4MGFEjie6jCrtJs1y57FuI21R6w8g8uwnH/VJJK1ZrT3gn8gz3zcVUYEwGmDcvQAAAABJRU5ErkJggg==';

var chart_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAGvSURBVDjLpZO7alZREEbXiSdqJJDKYJNCkPBXYq12prHwBezSCpaidnY+graCYO0DpLRTQcR3EFLl8p+9525xgkRIJJApB2bN+gZmqCouU+NZzVef9isyUYeIRD0RTz482xouBBBNHi5u4JlkgUfx+evhxQ2aJRrJ/oFjUWysXeG45cUBy+aoJ90Sj0LGFY6anw2o1y/mK2ZS5pQ50+2XiBbdCvPk+mpw2OM/Bo92IJMhgiGCox+JeNEksIC11eLwvAhlzuAO37+BG9y9x3FTuiWTzhH61QFvdg5AdAZIB3Mw50AKsaRJYlGsX0tymTzf2y1TR9WwbogYY3ZhxR26gBmocrxMuhZNE435FtmSx1tP8QgiHEvj45d3jNlONouAKrjjzWaDv4CkmmNu/Pz9CzVh++Yd2rIz5tTnwdZmAzNymXT9F5AtMFeaTogJYkJfdsaaGpyO4E62pJ0yUCtKQFxo0hAT1JU2CWNOJ5vvP4AIcKeao17c2ljFE8SKEkVdWWxu42GYK9KE4c3O20pzSpyyoCx4v/6ECkCTCqccKorNxR5uSXgQnmQkw2Xf+Q+0iqQ9Ap64TwAAAABJRU5ErkJggg==';

var comments_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAG/SURBVDjLjZK9T8JQFMVZTUyc3IyJg4mDi87+GyYu6qB/gcZdFxkkJM66qJMGSNRBxDzigJMRQ1jQ4EcQ+SgVKB+FtuL13EdJxNDq8Ev7Xu85797T51nwhqeAH5w6cAxWwDgReX7jwYfdaCIraroptB7NLlVQrOoiGEsL1G06GZyxuILicsMUH3VTlOqGKNUMUdTacj+j1Nng0NGAT2WxYosK1bbIVVoiW27J9V8G57WWKVSczMV5iK+Tudv1vVh5yXdlLQN+os4AFZss2Ob82CCgQmhYHSnmkzf2b6rIhTAaaT2aXZALIRdCLgRtkA1WfYG4iKcVYX52JIs7EYvFmJ8wGiEXQi6EXAhdyn2MxQaPcg68zIETTvzyLsPzWnwqixVbhFwI3RFykes+A9vkIBKX4jCoIxdCLrI4/0OcUXXK4/1dbbDBS088xGGCCzAJCsiF2lanT8xdKNhHXvRarLFBqmcwCrbAhL32+kP3lHguETKRsNlbqUFPeY2OoikW62DNM+jf2ibzQNN0g5ALC75AGiT59oIReQ+cDGyTB+TC4jaYGXiRXMTD3AFogVmnOjeDMRAC025duo7wH74BwZ8JlHrTPLcAAAAASUVORK5CYII=';
/* To let it be a light script, we won't use something like jQuery */
function $$(xpath,root) { 
  var got=document.evaluate(xpath,root||document,null,null,null), result=[];
  while(next=got.iterateNext()) result.push(next);
  return result;
}

function start()
{
	if (document.getElementById('flvplayer_container') && document.getElementById('deleted_message_default') && GM_getValue('player_killer')) /* Video is deleted for copyright issue */
	{
		killPlayer();
	}

	/* Inject CSS */
		GM_addStyle('#regenerate_player { background: #BBBBBB; border: 1px solid #CCCCCC; color: white; display: block; width: 100%; height: 540px; text-align: center; line-height: 540px; font-size: 200%; text-decoration: none; } #regenerate_player:hover {background: #999999;}'
		);
		GM_addStyle('.fox-tag-link {vertical-align: middle; padding-right: 0.1em; cursor: pointer;}');
		GM_addStyle('#video_utilities ul {list-style-type: none; margin:0; padding: 0; margin-left: 3px;} #video_utilities ul li {display: inline; font-size: 12px; font-weight: bold;}');		
		GM_addStyle('#video_utilities img {vertical-align: middle;}');
		GM_addStyle('#comment_helper p {line-height: 30px; } #comment_helper img {border: 1px solid #999999; margin: 1px; vertical-align: middle;} #comment_helper_premium { margin-left: 5px; } #comment_helper textarea {font-family: sans-serif; font-size: 9pt; width: 245px; overflow: hidden; height: 25px; margin:0; padding: 0; vertical-align: middle;} #comment_helper .fox-ch-selected {border: 3px solid #33FF99;}');
	window.setTimeout(pushLinks, 10);
	if (document.getElementById('category_recent'))
	{
		window.setTimeout(listenMainPage, 10);
	}

	/* Player-related hack, need the 'watch' address and the flv player */
	if(window.location.href.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\//) /* URL is right */
	  && document.getElementById('flvplayer_container') /* Logged in */
	  )
	{
		/* Add comment helper */
		if(GM_getValue('comment_helper'))
		{
			window.setTimeout(addCommentHelper, 10);
		}

		/* Bookmark helper, aka "Superlist" */
		if (document.getElementById('mylist_add_submit') && GM_getValue('superlist'))
		{ document.getElementById('mylist_add_submit').addEventListener('click', function(e){NM_bookmark();}, true); }

		/* Tag helper, aka "Supertag" */
		if (GM_getValue('supertag'))
		{
		  tags = $$('.//a [@rel="tag"]', document.getElementById('video_tags'))
		  for (i=0; i < tags.length; i++) {
		    var tag = tags[i];

		    var tag_helper = document.createElement('img');
		    tag_helper.className = 'fox-tag-link';
		    tag_helper.src=tag_add_uri;
		    tag_helper.title = NM_getString('addTag');
		    tag_helper.alt = '';
		    tag_helper.id = "tag_helper_"+i;

		    tag_helper.addEventListener('click', function(e) {
		      if (!e.target) {return;}
		      NM_tag(e.target.parentNode.getElementsByTagName('a')[0].textContent);
		      e.stopPropagation();
		      e.preventDefault();
		    }
		    , true);
		    if (tag.parentNode.tagName.match(/nobr/i)) {
		      /* Japan version, use <nobr> */
  		      tag.parentNode.appendChild(tag_helper);
		    } else { 
		      /* Non-japan version, append <nobr> */ 
		      var nobr = document.createElement('nobr');
		      var tag_list = tag.parentNode;
		      tag_list.insertBefore(nobr, tag.nextSibling);
		      tag_list.removeChild(tag);
		      nobr.appendChild(tag);
		      nobr.appendChild(tag_helper);
		    }
		  }	
		}

		/* Use img to reduce the DOM use */
		var download_link = document.createElement('a');
		download_link.className = 'fox-dl-link';
		download_link.id = 'fox-dl-this1';
		download_link.title = NM_getString('download');
		download_link.innerHTML = '<img src="'+dl_uri+'" />';

		/* Fetching Nico Nico's video title */
		var h1 = document.getElementsByTagName('h1')[0];
		/* inject the video download link */
		if (h1.hasChildNodes())
		{
			h1.appendChild(download_link);
		}

		/* Use img to reduce the DOM use */
		var download_link = document.createElement('a');
		download_link.className = 'fox-dl-link';
		download_link.id = 'fox-dl-this2';
		download_link.title = NM_getString('download');
		download_link.innerHTML = '<img src="'+dl_uri+'" />';

		/* Find for non-expanded mode */
		var des1 = document.getElementById('des_1');
		if (des1 && des1.hasChildNodes())
		{
			var headera = des1.getElementsByTagName('a')[1];
			if (headera)
			{
				headera.parentNode.insertBefore(download_link, headera.nextSibling);
			}
		}

		if(GM_getValue('toolbar'))
		{
			/* Use Div to do something wrong */
			var niconicofox_inject = document.createElement('div'); niconicofox_inject.id = 'niconicofox_inject';
			niconicofox_inject.style.display = 'none';

			/* innerHTML is truly dirty but useful! */
			niconicofox_inject.innerHTML = '<input id="inject_video_v" /><input id="inject_video_id" /><input id="inject_video_isDeleted" /><input id="inject_video_isMymemory" />';

			/* Put the container of injection */
			var watchfooter= document.getElementById('WATCHFOOTER');
			watchfooter.appendChild(niconicofox_inject);

			/* Use location hack to get the Video object, which contains what we want! */
			var inject_js_str  = 
			'document.getElementById("inject_video_v").value = Video.v;'+
			'document.getElementById("inject_video_id").value = Video.id;'+
			'document.getElementById("inject_video_isDeleted").value = Video.isDeleted;'+
			'document.getElementById("inject_video_isMymemory").value = Video.isMymemory;';

			location.href='javascript: void(eval(\''+inject_js_str.replace(/\'/g,'\\\'')+'\'));';

			prepare_inject(0);
		}
	}
}

function prepare_inject(timer)
{
	if (!document.getElementById('inject_video_v').value)
	{
		if (timer==10)
		{
			alert('Inject time out! The script may be broken.');
			return;
		}
		timer = timer + 1;
		window.setTimeout(prepare_inject, 1, timer);
	}
	else
	{
		start_inject();
	}

}

function start_inject()
{

	var Video = 
	{
		title: document.getElementsByTagName('h1')[0].getElementsByTagName('a')[0].textContent.replace(/\&\#039\;/g, '\''),	    
		v: document.getElementById('inject_video_v').value,
		id: document.getElementById('inject_video_id').value,
		isDeleted: false,
		isMymemory: false,
	}
	
	/* XXX it should not be here, but it is used to reduce the render times */
	var community_nodes = $$('.//a[@class="community"]');

	if (community_nodes.length > 0) {
		/* XXX: Why Community name? */
		var community_test = community_nodes[0].href.match(/^http\:\/\/ch\.nicovideo\.jp\/(community|channel)\/([a-z]{0,2}[0-9]+)$/i);	
		Video.comment_type = community_test[2];
		Video.community_name = community_nodes[0].textContent;
	}
	else if (Video.isMymemory)
	{
		Video.comment_type = 'mymemory' + Video.v;
	}
	else if (window.location.href.match(/http:\/\/(www|tw|es|de)\.nicovideo\.jp\/watch\/[0-9]+/))
	{
		Video.comment_type = 'comment' + Video.v;
	}
	else
	{
		Video.comment_type = window.location.href.match(/http:\/\/(www|tw|es|de)\.nicovideo\.jp\/watch\/[a-z]{2}[0-9]+/)[1] ;
	}


	if (document.getElementById('inject_video_isDeleted').value=='true') { Video.isDeleted = true; }
	if (document.getElementById('inject_video_isMymemory').value=='true') { Video.isMymemory = true; }

	if (Video.isDeleted)
	{
		if (GM_getValue('player_killer'))
		{
			window.setTimeout(killPlayer, 20);
		}	
		return;
	}

	var niconicofarm = "\r\n";
	/* check if Video.v is a pure integer... (mymemory / community / other countries ver.), (for hatena::diary and niconicofarm) */

	if (Video.v.match(/[A-Za-z]/))
	{
		niconicofarm = '<li><a href="http://nico.xii.jp/comment/?url='+Video.id+'" target="_blank" title="'+NM_getString('toolsNicoNicoFarm')+'"<img src="'+comments_uri+'">'+"\r\n"; // Use Nico Nico Farm (supported pages only)
	}

	document.getElementById('fox-dl-this1').addEventListener('click', function(e)
	{
		NM_goDownload(Video, window.location.href);
		e.stopPropagation();
		e.preventDefault();

	}
	, true);
	if (document.getElementById('fox-dl-this2')) 
 	document.getElementById('fox-dl-this2').addEventListener('click', function(e)
	{
		NM_goDownload(Video, window.location.href);
		e.stopPropagation();
		e.preventDefault();

	}
	, true);
	/* Add sound website */
	var sound_website = GM_getValue('sound_converter');
	sound_website = sound_website.replace('%1', Video.id);

	/* Inject Video Utilities */
	video_utilities = document.createElement('div');
	video_utilities.id = 'video_utilities';
	html =  '<ul id="video_utilities_list">'+"\r\n"+
		'<li>'+NM_getString('toolbarTitle')+'</li>'+"\r\n"+
                '<li><a href="http://d.hatena.ne.jp/video/niconico/'+Video.v+'" target="_blank" title="'+NM_getString('relatedHatena')+'"><img src='+hatena_uri+' /></a></li>'+"\r\n"+
                '<li><a href="http://www.nicovideo.jp/watch/'+Video.id+'" target="_blank" title="'+NM_getString('relatedNicoWww')+'"><img src="'+jp_uri+'" /></a></li>'+"\r\n"+
                '<li><a href="http://tw.nicovideo.jp/watch/'+Video.id+'" target="_blank" title="'+NM_getString('relatedNicoTw')+'"><img src="'+tw_uri+'" /></a></li>'+"\r\n"+
                '<li><a href="http://es.nicovideo.jp/watch/'+Video.id+'" target="_blank" title="'+NM_getString('relatedNicoEs')+'"><img src="'+es_uri+'" /></a></li>'+"\r\n"+
                '<li><a href="http://de.nicovideo.jp/watch/'+Video.id+'" target="_blank" title="'+NM_getString('relatedNicoDe')+'"><img src="'+de_uri+'" /></a></li>'+"\r\n"+
                '<li><a href="'+sound_website+'" target="_blank" title="'+NM_getString('toolsSoundConverter')+'"><img src="'+music_uri+'" /></a></li>'+"\r\n"+
               '<li><a href="http://www.nicochart.jp/watch/'+Video.id+'" target="_blank" title="'+NM_getString('toolsNicoChart')+'"><img src="'+chart_uri+'" /></a></li>'+"\r\n";

        html = html + niconicofarm; /* Niconico farm is general comment only */
        html = html + '</ul></li>'+"\r\n"+
                '</ul>';

        video_utilities.innerHTML = html;
        WATCHHEADER = document.getElementById('WATCHHEADER');
        WATCHHEADER.appendChild(video_utilities);


}

function videoUtilitiesTab(e)
{
	tab_num = (e.target.id.match(/sw([0-9])$/)[1]);
	if (!tab_num || isNaN(tab_num)) { return; }
	for (i = 1; i <= 3; i++)
	{
		document.getElementById('video_utilities_tab'+i).style.display = 'none';
		document.getElementById('video_utilities_sw'+i).className = 'fox-sw-link';
	}
	document.getElementById('video_utilities_tab'+tab_num).style.display = 'block';
	document.getElementById('video_utilities_sw'+tab_num).className = 'fox-sw-link-selected';
	return false;
}

function addCommentHelper()
{
	/* The comment helper */
	comment_helper = document.createElement('div');
	comment_helper.id = 'comment_helper';
	
	comment_helper_form = document.createElement('form');
	comment_helper_form.name = 'comment_helper_form';

	comment_helper_content = document.createElement('p');
	comment_helper_content.id = 'comment_helper_content';

	comment_helper_content.innerHTML = 
	'<a href="#" class="ch_link" id="comment_helper_naka"><img src="'+comment_naka_uri+'" class="fox-ch-selected" /></a>'+
	'<a href="#" class="ch_link" id="comment_helper_ue"><img src="'+comment_ue_uri+'" /></a>'+
	'<a href="#" class="ch_link" id="comment_helper_shita"><img src="'+comment_shita_uri+'" /></a>'+
	'<a href="#" class="ch_link" id="comment_helper_big"><img src="'+comment_big_uri+'" /></a>'+
	'<a href="#" class="ch_link" id="comment_helper_medium"><img src="'+comment_medium_uri+'"  class="fox-ch-selected"/></a>'+
	'<a href="#" class="ch_link" id="comment_helper_small"><img src="'+comment_small_uri+'" /></a>'+
	'<a href="#" class="ch_link" id="comment_helper_white"><img src="'+transparent_uri+'"  class="fox-ch-selected" style="background: #FFFFFF;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_red"><img src="'+transparent_uri+'" style="background: #FF0000;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_pink"><img src="'+transparent_uri+'" style="background: #FF8080;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_orange"><img src="'+transparent_uri+'" style="background: #FFCC00;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_yellow"><img src="'+transparent_uri+'" style="background: #FFFF00;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_green"><img src="'+transparent_uri+'" style="background: #00FF00;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_cyan"><img src="'+transparent_uri+'" style="background: #00FFFF;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_blue"><img src="'+transparent_uri+'" style="background: #0000FF;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_purple"><img src="'+transparent_uri+'" style="background: #C000FF;"></a>'+
	'<span id="comment_helper_premium" style="display: none;">'+
	'<a href="#" class="ch_link" id="comment_helper_white2"><img src="'+transparent_uri+'" style="background: #CCCC99;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_red2"><img src="'+transparent_uri+'" style="background: #CC0033;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_orange2"><img src="'+transparent_uri+'" style="background: #FF6600;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_yellow2"><img src="'+transparent_uri+'" style="background: #999900;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_green2"><img src="'+transparent_uri+'" style="background: #00CC66;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_blue2"><img src="'+transparent_uri+'" style="background: #33FFFC;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_purple2"><img src="'+transparent_uri+'" style="background: #6633CC;"></a>'+
	'<a href="#" class="ch_link" id="comment_helper_black"><img src="'+transparent_uri+'" style="background: #000000;"></a>'+
	'</span>'+
	'<textarea rows="1" value="" onchange="$(\'flvplayer\').SetVariable(\'inputArea.ChatInput1.text\', this.value);" onkeyup="this.onchange();"></textarea>';

	comment_helper_form.appendChild(comment_helper_content);
	comment_helper.appendChild(comment_helper_form);
	watch_footer = document.getElementById('WATCHFOOTER');
	watch_footer.insertBefore(comment_helper, watch_footer.firstChild);

	helper_links = comment_helper_content.getElementsByTagName('a')
	for (i = 0; i < helper_links.length; i++)	
	{
		helper_links[i].addEventListener('click', commentHelperSelect, false);
	}

	js = 'if (User.isPremium) {$(\'comment_helper_premium\').show() }'; 
	location.href='javascript: void(eval(\''+js.replace(/\'/g,'\\\'')+'\'));';
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
	id = e.target.id;
	/* When click on img, the id will be empty */
	if (!id) { id = e.target.parentNode.id; }
	if (!id) { return; }
	
	sel = id.match(/comment\_helper\_(.*)$/);
	if(!sel) { return; }
	sel = sel[1];
	if (ch_positions.indexOf(sel) != -1)
	{	
		document.getElementById('comment_helper_'+ch_position).getElementsByTagName('img')[0].className = '';
		document.getElementById('comment_helper_'+sel).getElementsByTagName('img')[0].className = 'fox-ch-selected';
		
		ch_position = sel;
	}
	if (ch_sizes.indexOf(sel) != -1)
	{
		document.getElementById('comment_helper_'+ch_size).getElementsByTagName('img')[0].className = '';
		document.getElementById('comment_helper_'+sel).getElementsByTagName('img')[0].className = 'fox-ch-selected';

		ch_size = sel;
	}
	if (ch_colors.indexOf(sel) != -1)
	{
		document.getElementById('comment_helper_'+ch_color).getElementsByTagName('img')[0].className = '';
		document.getElementById('comment_helper_'+sel).getElementsByTagName('img')[0].className = 'fox-ch-selected';

		ch_color = sel;
	}

	mail_inputs = [];
	if (ch_positions.indexOf(ch_position) != 0) mail_inputs.push(ch_position);
	if (ch_sizes.indexOf(ch_size) != 0) mail_inputs.push(ch_size);
	if (ch_colors.indexOf(ch_color) != 0) mail_inputs.push(ch_color);

	mail_input = mail_inputs.join(' ');
	js = '$(\'flvplayer\').SetVariable(\'inputArea.MailInput.text\',\''+mail_input+'\');'; 
	location.href='javascript: void(eval(\''+js.replace(/\'/g,'\\\'')+'\'));';
	e.stopPropagation();
	e.preventDefault();
}

function listenMainPage()
{
document.addEventListener('DOMAttrModified', function(event)
	{
		if(event.target.id == 'tag_modeA' || event.target.id == 'tag_modeB') { pushLinks(true); }
	}
, false);
}
function pushLinks(mainpage)
{
	/* Fetching the video links */
	if (mainpage == true)
	{
		videos = $$('.//a [@class="video" or substring(@class,string-length(@class)-string-length(" video")+1)=" video" or starts-with(@class,"video ") or contains(@class," video ")]', document.getElementById('category_recent'));
	}
	else
	{
		videos = $$('.//a [@class="video" or substring(@class,string-length(@class)-string-length(" video")+1)=" video" or starts-with(@class,"video ") or contains(@class," video ")] | .//a [@class="g-video-link" and not (*)]');
	}
	/* Run every link to check what we like */
	for (i = 0; i < videos.length; i++)
	{
		video = videos[i];
		href = video.href;

		/* Is it truly a "watch" or "mylist" links? */
		if (href.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+$/)/* || href.match(/^http:\/\/(tw|www)\.nicovideo\.jp\/mylist\/[0-9]+$/)*/)
		{
			/* If it is, we will add a "download" link, to help Smilefox work :) */
			download_link = document.createElement('a');
			download_link.className = 'fox-dl-link';
			download_link.href = href+'?smilefox=get';
			download_link.innerHTML = '<img src="'+dl_uri+'" style="vertical-align: middle;">';

			video.parentNode.insertBefore(download_link, video.nextSibling);
		}
	}
}
//category_recent
function killPlayer()
{
		var flvplayer = document.getElementById('flvplayer');
		flvplayer.parentNode.removeChild(flvplayer);
		var flvplayer_container = document.getElementById('flvplayer_container')

		player_deleted = document.createElement('div');
		player_deleted.innerHTML = '<a href="'+window.location.href+'" id="regenerate_player">'+NM_getString('playerKillerMsg')+'</a>';
		flvplayer_container.appendChild(player_deleted);

		document.getElementById('regenerate_player').addEventListener('click', function(e)
		{
			document.getElementById('flvplayer_container').removeChild(player_deleted);
			document.getElementById('flvplayer_container').appendChild(flvplayer);
			e.stopPropagation();
			e.preventDefault();
			return false;
		}
		, true
		);
}

if (GM_getValue('enable'))
{ start(); }
