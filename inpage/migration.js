/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 et filetype=javascript
 */
var Cc = Components.classes;
var Ci = Components.interfaces;

var migration = {};

/* Initialize to check database scheme */
migration.load = function() {
  
};


window.addEventListener("DOMContentLoaded", function() { migration.load(); }, false);
