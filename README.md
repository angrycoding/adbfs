# OSX fuse - based file system to interact with android phone through ADB

Standard Android File Transfer application is not the best one in the world, so to make it simple I've combined Node.js, fuse-bindings and Android Debug Bridge to make android phone on Mac behave like external drive when connected to computer with USB cable.

From the phone side there is no additional software required, the only requirement is development mode enabled in phone settings.
From the computer side the only requirement is MacFuse installed.
