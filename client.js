function say(msg)
{
	worker.postMessage({'msg': msg});
}

var blob = new Blob(["onmessage = function(e) { postMessage(\"back from the worker: \" + e.data.msg); };"]);
var windowURL = window.URL || window.webkitURL;
// Obtain a blob URL reference to our worker 'file'.
var blobURL = windowURL.createObjectURL(blob);

var worker = new Worker(blobURL);
var socket = io.connect('http://localhost:8123');

worker.onmessage = function(e) {
  socket.emit('my other event', { data: e.data });
};

socket.on('news', function (data) {
	console.log(data);
  worker.postMessage(data);
});

worker.postMessage({'msg': 'worker started'});