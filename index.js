var OS = require('os');
var MD5 = require('md5');
var Path = require('path');
var FS = require('fs-extra');
var Fuse = require('fuse-bindings');
var USBDetect = require('usb-detection');
var spawnFile = require('child_process').spawn;


var VOLUME_LABEL = 'Android Phone';
var VOLUME_ICON = Path.resolve(__dirname, 'volicon.icns');
var ADB_PATH = Path.resolve(__dirname, 'adb');
var MOUNT_PATH = getTmpDir();


var MNT_OPTIONS = {

	force: true,

	options: [
		`volname=${VOLUME_LABEL}`,
		`volicon=${VOLUME_ICON}`,
		'noappledouble',
		'kill_on_unmount',
		'allow_other',
		'rdonly',
		'local'
	],

};

function getTmpDir() {
	var result = [new Date().getTime(), Math.random()];
	return Path.resolve(OS.tmpdir(), MD5(result.join('-')));
}

function runAdb(args, ret) {
	var stdout = '';
	var proc = spawnFile(ADB_PATH, args);
	proc.stdout.on('data', (data) => stdout += data);
	proc.on('close', () => ret(stdout));
}

function doMount(ret) {
	if (!ret) ret = (() => 0);
	runAdb(['shell', '-nT', 'ls', '-lLa', '/'], function(result) {
		result = result.replace(/\s+/g, '');
		console.info(result)
		if (result.length === 0) return ret(true);
		FS.ensureDir(MOUNT_PATH, function(error) {
			Fuse.mount(MOUNT_PATH, MNT_OPTIONS, ret);
		});
	});
}

function doUnmount(ret) {
	if (!ret) ret = (() => 0);
	Fuse.unmount(MOUNT_PATH, function() {
		FS.remove(MOUNT_PATH, ret);
	});
}

function checkAdbDevice() {
	USBDetect.find(function(error, devices) {
		if (devices.some(device => device.manufacturer.toLowerCase() === 'xiaomi'))
			doMount((error) => error && setTimeout(checkAdbDevice, 1000));
		else doUnmount();
	});
}

function doTerminate(message) {
	if (message) console.info(message);
	USBDetect.stopMonitoring();
	doUnmount(() => process.exit());
}

process.on('SIGINT', doTerminate);
process.on('SIGTERM', doTerminate);
process.on('SIGUSR1', doTerminate);
process.on('SIGUSR2', doTerminate);
process.on('uncaughtException', doTerminate);
USBDetect.on('change', checkAdbDevice);
USBDetect.startMonitoring();
checkAdbDevice();