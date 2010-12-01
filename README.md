NicoFox - A better Nico Nico Douga on Firefox, featuring video download
=============
** I'm now finailizing the 0.6 version with Harajuku(原宿) support, new download manager UI and lots of improvements. There will be a beta in early December, and the final release of 0.6 is scheduled on December 24. **

Latest release
-------------
Latest release of the addon will be always on the [Mozilla Add-ons](https://addons.mozilla.org/firefox/addon/8888).

Test the development snapshot on repository
-------------
The simplest way: Click the "Downloads" on the github page, download the source in zip format, rename the file with the .xpi extension, then drop the file into the addon manager in Firefox.  (The `player-develop` folder is a FlashDevelop project with the original source code for NicoFox Player, which can be remove from the ZIP archive to save the file size.)

If you use Git to synchronize the latest source code, the following is a very simple `zip` command to grab the XPI files from the directory:
    zip -r nicofox.xpi install.rdf chrome.manifest content/ locale/ skin/ components/ modules/ defaults/ player/
