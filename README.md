NicoFox - A better Nico Nico Douga on Firefox, featuring video download
=============

AMO entry is currently disabled due to the review process changes on the site :(. I'm trying to fix all the problem and upload new version ASAP.

Test the development snapshot on repository
-------------
The simplest way: Click the "Downloads" on the github page, download the source in zip format, rename the file with the .xpi extension, then drop the file into the addon manager in Firefox.  (The `player-develop` folder is a FlashDevelop project with the original source code for NicoFox Player, which can be remove from the ZIP archive to save the file size.)

If you use Git to synchronize the latest source code, the following is a very simple `zip` command to grab the XPI files from the directory:
    zip -r nicofox.xpi install.rdf chrome.manifest content/ locale/ skin/ components/ modules/ defaults/ player/
