function say(msg)
{
	worker.postMessage({'msg': msg});
}

var socket = io.connect('http://localhost:8123');
var blob,
	clientID,
	windowURL = window.URL || window.webkitURL,
	blobURL,
	worker,
	jobNumber;

socket.on('load', function (message)
{
	clientID = message.num;
	blob = new Blob(["onmessage = function(workUnit) { postMessage(function(data) { \n" + message.source + "\n }(workUnit.data)); } "]);
	// Obtain a blob URL reference to our worker 'file'.
	blobURL = windowURL.createObjectURL(blob);
	worker = new Worker(blobURL);

	worker.onmessage = function(e) {
		console.log("job result: " + e.data);
	 	socket.emit('jobResult', { jobNum: jobNumber, result: e.data });
	};

	socket.emit('ready', { num: message.num });
});

socket.on('job', function (message) {
	console.log("new job: " + message);
	jobNumber = message.jobNum;
  worker.postMessage(message.jobData);
});