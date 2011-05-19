#!/bin/bash
# Build Script to create XPI files

# Cleanup, then make build directory
rm -f nicofox.xpi
rm -rf build

echo "Generating directories..."
mkdir build
mkdir build/content
mkdir build/skin
mkdir build/components
mkdir build/modules
mkdir build/defaults
mkdir build/defaults/preferences
mkdir build/locale

echo "Copy files..."

# Copy all scripts, images and stylesheets
cp install.rdf chrome.manifest LICENSE.md build/
cp content/*.js content/*.xul content/*.xml content/*.swf build/content/
cp skin/*.css skin/*.png build/skin/
cp components/*.js build/components/
cp modules/*.jsm build/modules/
cp defaults/preferences/*.js build/defaults/preferences/

# Copy all locales, inspired from build.sh in Greasemonkey
for entry in locale/*; do
  if [ -d $entry ]; then
    entry=`basename $entry`
    from_paths="locale/$entry/*.dtd locale/$entry/*.properties"
    to_path="build/locale/$entry"
    mkdir $to_path
    cp $from_paths $to_path
  fi
done

echo "Generate XPI file..."
cd build
zip -r1DX ../nicofox.xpi *
echo "Cleanup..."
cd ..
rm -rf build
echo "Done!"
