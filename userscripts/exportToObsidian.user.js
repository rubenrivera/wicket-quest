// ==UserScript==
// @name        Q&A web clipper
// @namespace   https://github.com/wicket-quest/wicket-quest
// @description Adds a export button to Stack Exchange questions and answers post menu. The post is exported to a local Obsidian vault and open it Obsidian so it could be privately edited and annotated.
// @author      Wicket
// @updateURL   
// @downloadURL 
// @version     2024-06-30_12:00_GMT-06
// @match       *://*.stackexchange.com/questions/*
// @match       *://*.stackoverflow.com/questions/*
// @match       *://*.superuser.com/questions/*
// @match       *://*.serverfault.com/questions/*
// @match       *://*.askubuntu.com/questions/*
// @match       *://*.stackapps.com/questions/*
// @match       *://*.mathoverflow.net/questions/*
// @exclude     *://*.stackexchange.com/questions/ask
// @exclude     *://*.stackoverflow.com/questions/ask
// @exclude     *://*.superuser.com/questions/ask
// @exclude     *://*.serverfault.com/questions/ask
// @exclude     *://*.askubuntu.com/questions/ask
// @exclude     *://*.stackapps.com/questions/ask
// @exclude     *://*.mathoverflow.net/questions/ask
// ==/UserScript==

/**
 * @file
 * Inspired by https://github.com/Glorfindel83/SE-Userscripts/blob/master/archivist/archivist.user.js, later referred as Glorfindel's Archivist. 
 * Some parts of this file were taken from obsidian-web-clipper.js -> https://gist.github.com/kepano/90c05f162c37cf730abb8ff027987ca3, later referred as Kepano's Web Clipper
 */

/**
 * Returns the site name from the site domain.
 * @returns {string} site (short) name
 */
function getSiteName(){
  let parts = location.host.split('.');
  let site = parts <= 3
  ? parts[0]
  : location.host.slice(0,location.host.indexOf('.',5));
  return site;
}

/**
 * Adapted from Kepano's web clipper
 * @param {Date} date
 */
function convertDate(date) {
  var yyyy = date.getFullYear().toString();
  var mm = (date.getMonth()+1).toString();
  var dd = date.getDate().toString();
  var mmChars = mm.split('');
  var ddChars = dd.split('');
  return yyyy + '-' + (mmChars[1]?mm:"0"+mmChars[0]) + '-' + (ddChars[1]?dd:"0"+ddChars[0]);
}

/**
 * Adapted from Kepano's web clipper
 * @param {Date} date
 * @returns {string} Date as yyyy-MM-dd HH:mm
 */
function formatter(date){
  const year = date.getFullYear();
  let month = date.getMonth() + 1; // Months are 0-based in JavaScript
  let day = date.getDate();

  // Pad month and day with leading zeros if necessary
  month = month < 10 ? '0' + month : month;
  day = day < 10 ? '0' + day : day;

  let time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

  return year + '-' + month + '-' + day + ', ' + time;
}

/**
 * Adapted from Kepano's Web Clipper
 * @param {[button: string, post: string, postBody: string, postId: string, postType: string]} params
 */
function exportToObsidian(params) {
  const [button, post, postBody, postId, postType] = params;
  Promise.all([import('https://unpkg.com/turndown@6.0.0?module'), import('https://unpkg.com/@tehshrike/readability@0.2.0'), ]).then(async ([{
      default: Turndown
  }, {
      default: Readability
  }]) => {

    /* Optional vault name */
    const vault = "";

    /* Optional folder name such as "Clippings/" */
    const folder = "Stack Exchange/" + getSiteName() + "/";

    /* Optional tags  */
    let tags = "";

    /* Parse the question tags */
    if(postType === "Question"){
      const questionTags = Array.from(document.querySelector('div.question').querySelectorAll('.post-tag'));
      tags += questionTags.map(tag => tag.innerText).join(' ');
    }

    const {
        title,
        byline,
        content
    } = new Readability(document.cloneNode(true)).parse();

    var vaultName ;
    if (vault) {
        vaultName = '&vault=' + encodeURIComponent(`${vault}`);
    } else {
        vaultName = '';
    }

    const markdownBody = new Turndown({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
    }).turndown(postBody);

    var date = new Date();

    const today = convertDate(date);

    // Fetch post author
    var author = post.querySelector('.user-details[itemprop=author]');
    var anchor = author.querySelector('a');
    // Check if there's an author and add brackets.
    var authorBrackets = ( author
    ? anchor
      ? `"[[${folder + /users\/\d+/.exec(anchor.href)}|${anchor.innerText}]]"`
      : `"[[${author.innerText}]]"`
    : "" );


    /* Try to get post creation timestamp */
    const createdElement = post.querySelector('.user-action-time');
    const createdTimestamp = createdElement ? createdElement.querySelector('span').getAttribute('title') : "";
    let created;
    if(createdTimestamp && createdTimestamp.trim() !== ""){
      date = new Date(createdTimestamp);
      created = formatter(date);
    } else {
      created = '';
    }

    /* YAML front matter as tags render cleaner with special chars  */
    const fileContent =
        '---\n'
        + 'title: "' + title + '"\n'
        + 'category: "[[' + postType + ']]"\n'
        + 'author: ' + authorBrackets + '\n'
        + 'title: "' + title + '"\n'
        + 'source: ' + document.URL + '\n'
        + 'clipped: ' + today + '\n'
        + (created ? 'created: ' + created + '\n' : '')
        + 'topics: \n'
        + 'tags: [' + tags + ']\n'
        + '---\n\n'
        + markdownBody ;

     document.location.href = "obsidian://new?"
      + "file=" + encodeURIComponent(folder + postId)
      + "&content=" + encodeURIComponent(fileContent)
      + vaultName ;

  })
}

/**
 * Adapted from Glorfindel's Archivist
 * @param {PointerEvent} event
 */
function startExporting(event) {
  event.preventDefault();
  const button = event.target
  if (!confirm('Are you sure you want to export this post?')) return;

  // Disable further clicks - the button becomes a progress indicator
  button.removeEventListener('click', startExporting);
  button.addEventListener('click', function(e) { e.preventDefault(); });
  button.style.color = "#BBB";
  button.removeAttribute("title");
  button.innerText = "exporting ...";
  let shareButton = button.closest('.js-post-menu');
  const postId = shareButton.closest('[data-post-id]').dataset.postId;
  let post = shareButton.closest("div.question");
  let postType = '';
  if (post == null) {
    post = shareButton.closest("div.answer");
    postType = "Answer"
  } else {
    postType = "Question"
  }
  const postBody = post.querySelector("div.js-post-body");
  const params = [button, post, postBody, postId, postType];
  exportToObsidian(params);

  // Update archive button
  button.innerText = "exporting tab opened";
}

/**
 * Main
 * Maschup of parts taked from Glorfidel's Archivist and Kepano's Web Clipper
 */
(function () {
  "use strict";

  Array.from(document.querySelectorAll("a.js-share-link")).forEach((shareButton) => {

    let post = shareButton.closest("div.question");
    let postType = '';
    if (post == null) {
      post = shareButton.closest("div.answer");
      postType = 'Answer';
    } else {
      postType = 'Question'
    }

    const postBody = post.querySelector("div.js-post-body");

    const disabled = false;
    const hoverMessage = 'Export this post as a markdown file to a local Obsidian vault';
    /** Create button */
    const button = document.createElement('button');
    button.classList.add("s-btn", "s-btn__link");
    button.setAttribute('type',"button");
    button.setAttribute('href',"#");
    button.setAttribute('style', (disabled ? "color: #BBB" : ""));
    button.setAttribute('title', hoverMessage);
    button.innerText = 'Export';
    /** Create cell with button */
    const cell = document.createElement('div')
    cell.classList.add('flex--item');
    cell.append(button);

    /** Append cell to post menu */
    const menu = shareButton.parentElement.parentElement;
    menu.append(cell);

    button.addEventListener('click', startExporting);

  });
})();