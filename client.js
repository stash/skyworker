var blob = new Blob(["onmessage = function(e) { postMessage(e.data.msg); };"]);
var windowURL = window.URL || window.webkitURL
// Obtain a blob URL reference to our worker 'file'.
var blobURL = windowURL.createObjectURL(blob);

var worker = new Worker(blobURL);

worker.onmessage = function(e) {
  document.getElementById('result').textContent = e.data;
};

worker.postMessage({'msg': 'worker started'});