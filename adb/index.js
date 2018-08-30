var Path = require('path');
var EventEmitter = require('events');
var USBDetect = require('usb-detection');
var spawnFile = require('child_process').spawn;

var updateDeviceListTimeout = null;
var LIST_OF_ADB_DEVICES = {};
var eventEmitter = new EventEmitter();
var ADB_PATH = Path.resolve(__dirname, 'adb');


function adb_run(args, ret, serialNumber) {
	var stdout = '';
	if (serialNumber) args = ['-s', serialNumber].concat(args);
	var proc = spawnFile(ADB_PATH, args);
	proc.stdout.on('data', (data) => stdout += data);
	proc.on('close', () => ret(stdout));
}

function adb_devices(ret) {
	adb_run(['devices', '-l'], function(result) {
		var devices = [];
		result = result.split('\n');
		nextLine: for (var c = 0; c < result.length; c++) {
			var line = result[c].split(/\s+|:/);
			var serialNumber = line.shift();
			if (!serialNumber || line.shift() !== 'device') continue nextLine;
			var device = {serialNumber: serialNumber};
			while (line.length) {
				var key = line.shift(), value = line.shift();
				if (!key || !value) continue nextLine;
				if (key === 'model') value = value.replace(/_/g, ' ');
				device[key] = value;
			}
			devices.push(device);
		}
		ret(devices);
	});
}

function adb_ls(path, ret, serialNumber) {
	adb_run(['shell', '-nT', 'ls', '-lLa',  path], function(lines) {
		var items = [], item;
		lines = lines.split('\n');
		for (var c = 0; c < lines.length; c++) {
			var line = lines[c].split(/\s+/);
			if (line.length < 8) continue;
			var name = line.slice(7).join(' ');
			if (name.length > 1 && name[0] === '.') continue;
			var date = line[5].split('-'), time = line[6].split(':');
			items.push({
				name: Path.basename(name),
				size: parseInt(line[4], 10),
				isDir: (line[0][0] === 'd'),
				path: Path.resolve(path, name),
				date: (new Date(Date.UTC(date[0], parseInt(date[1]) - 1, date[2], time[0], time[1]))).getTime()
			});
		}
		ret(items);
	}, serialNumber);
}




/*

function listUpdated() {
	console.info('listUpdated', JSON.stringify(waitingList));

	someCounter = 10;

	if (isRunning) return;
	isRunning = true;

	Async.whilst(function() {
		
		console.info('someCounter =', someCounter);
		return --someCounter;

	}, function(ret) {

		
		ADB.devices(function(devices) {

			for (var c = 0; c < devices.length; c++) {
				var device = devices[c];
				var index = waitingList.indexOf(device.serialNumber);
				if (index !== -1) {
					waitingList.splice(index, 1);
					doMount(device);
				}
			}

			if (!waitingList.length) {
				ret(true);
			} else {
				setTimeout(ret, 1000);
			}

		});



	}, function() {
		waitingList.splice(0, Infinity);
		console.info('DONE_ALL')
		isRunning = false;
	});



}


function mountDevice(device) {
	if (device) {
		var serialNumber = device.serialNumber;
		if (!waitingList.includes(serialNumber))
			waitingList.push(serialNumber);
		listUpdated();
	} else USBDetect.find(function(error, devices) { 
		var serialNumbers = devices.map(device => device.serialNumber);
		waitingList = serialNumbers.filter(serialNumbers => !!serialNumbers);
		listUpdated();
	});
}

*/




function updateDeviceList() {
	clearTimeout(updateDeviceListTimeout);
	updateDeviceListTimeout = setTimeout(function() {
		adb_devices(function(devices) {


			for (var serialNumber in LIST_OF_ADB_DEVICES) {
				if (!LIST_OF_ADB_DEVICES.hasOwnProperty(serialNumber)) continue;
				if (!devices.some(device => device.serialNumber === serialNumber)) {
					eventEmitter.emit('disconnected', LIST_OF_ADB_DEVICES[serialNumber]);
					delete LIST_OF_ADB_DEVICES[serialNumber];
				}
			}

			for (var c = 0; c < devices.length; c++) {
				var device = devices[c];
				var serialNumber = device.serialNumber;
				if (!LIST_OF_ADB_DEVICES.hasOwnProperty(serialNumber)) {
					LIST_OF_ADB_DEVICES[serialNumber] = device;
					eventEmitter.emit('connected', device);
				}
			}

		});
	}, 1000);
}



function doTerminate() {
	USBDetect.stopMonitoring();
}

process.on('SIGINT', doTerminate);
process.on('SIGTERM', doTerminate);
process.on('SIGUSR1', doTerminate);
process.on('SIGUSR2', doTerminate);
process.on('uncaughtException', doTerminate);
USBDetect.on('change', updateDeviceList);
USBDetect.startMonitoring();

module.exports = Object.assign(eventEmitter, {
	run: adb_run,
	devices: adb_devices,
	ls: adb_ls,
	startMonitoring: updateDeviceList
});