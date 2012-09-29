function say(msg)
{
	worker.postMessage({'msg': msg});
}

var blob = new Blob(["onmessage = function(e) { postMessage(e.data.msg); };"]);
var windowURL = window.URL || window.webkitURL;
// Obtain a blob URL reference to our worker 'file'.
var blobURL = windowURL.createObjectURL(blob);

var worker = new Worker(blobURL);

worker.onmessage = function(e) {
  document.getElementById('result').textContent = e.data;
};

/*var socket = io.connect('http://localhost:8123');
socket.on('news', function (data) {
  console.log(data);
  socket.emit('my other event', { my: 'data' });
});*/

worker.postMessage({'msg': 'worker started'});