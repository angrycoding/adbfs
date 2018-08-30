var MD5 = require('md5');
var ADB = require('./adb');
var Path = require('path');
var FS = require('fs-extra');
var Async = require('async');
var Fuse = require('fuse-bindings');

var MOUNTS_PATH = Path.resolve(__dirname, 'mounts');
var VOLUME_ICON = Path.resolve(__dirname, 'volicon.icns');
var FS_CACHE = {};

ADB.on('connected', function(device) {
	var serialNumber = device.serialNumber;
	unmountDevice(serialNumber, function() {
		var mountDir = Path.resolve(MOUNTS_PATH, serialNumber);
		FS.ensureDir(mountDir, function(error) {
			if (error) return;
			Fuse.mount(mountDir, xObj(device), (error) => error && unmountDevice(serialNumber));
		});
	});
});

ADB.on('disconnected', function(device) {
	unmountDevice(device.serialNumber);
});






function doSync(serialNumber, path, ret, useCache) {

	if (Path.basename(path)[0] === '.') return ret();


	path = path.replace(/\(/g, '\\(').replace(/\)/g, '\\)');

	if (useCache && FS_CACHE.hasOwnProperty(serialNumber + path)) return ret(null, FS_CACHE[serialNumber + path]);

	ADB.ls(path, function(items) {
		
		if (!items.length) {
			delete FS_CACHE[serialNumber + path]
			return ret([]);
		}

		var result = [];
		for (var c = 0; c < items.length; c++) {
			var item = items[c], date = item.date;
			
			FS_CACHE[serialNumber + item.path] = {
				atime: date,
				mtime: date,
				ctime: date,
				size: item.size,
				mode: (item.isDir ? 16877 : 33188)
			};

			if (c) result.push(item.name);
		}

		ret(result, FS_CACHE[serialNumber + path]);
	}, serialNumber);
}


function xObj(device) {

	var serialNumber = device.serialNumber;


	var result = {force: true, options: [
		`volname=${device.model}`,
		`volicon=${VOLUME_ICON}`,
		'noappledouble',
		'kill_on_unmount',
		'allow_other',
		'rdonly',
		'local'
	]};


	result.readdir = function(path, ret) {
		doSync(serialNumber, path, function(items, attr) {
			if (attr) ret(0, items);
			else ret(Fuse.ENOENT);
		});
	};

	result.getattr = function(path, ret) {
		doSync(serialNumber, path, function(items, attr) {
			if (attr) ret(0, attr);
			else ret(Fuse.ENOENT);
		}, true);
	};


	return result;

}


function unmountDevice(serialNumber, ret) {
	if (typeof ret !== 'function') ret = (() => 0);
	var mountDir = Path.resolve(MOUNTS_PATH, serialNumber);
	FS.stat(mountDir, function(error, stat) {
		if (error || !stat.isDirectory()) ret();
		else Fuse.unmount(mountDir, function() {
			FS.remove(mountDir, ret);
		});
	});
}

function unmountDevices(ret) {
	FS.readdir(MOUNTS_PATH, function(error, serialNumbers) {
		Async.each(serialNumbers, unmountDevice, ret);
	});
}

function doTerminate(message) {
	if (message) console.info(message);
	unmountDevices(() => process.exit());
}

unmountDevices(function() {
	FS.ensureDir(MOUNTS_PATH, function() {
		process.on('SIGINT', doTerminate);
		process.on('SIGTERM', doTerminate);
		process.on('SIGUSR1', doTerminate);
		process.on('SIGUSR2', doTerminate);
		process.on('uncaughtException', doTerminate);
		ADB.startMonitoring();
	});
});