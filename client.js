function say(msg)
{
	worker.postMessage({'msg': msg});
}

var socket = io.connect('http://' + window.location.host);
var blob,
	clientID,
	windowURL = window.URL || window.webkitURL,
	blobURL,
	worker,
	jobNumber;

socket.on('load', function (message)
{
	clientID = message.clientID;
	// blob = new Blob(["onmessage = function(workUnit) { postMessage(function(data) { \n" + message.source + "\n }(workUnit.data)); } "]);
	// Obtain a blob URL reference to our worker 'file'.
	// blobURL = windowURL.createObjectURL(blob);
  
  $('#worker-script').text('Loaded script: '+message.url);
	worker = new Worker(message.url);

	worker.onmessage = function(e) {
		console.log("job result: " + e.data.golden_ticket);
    if (e.data.golden_ticket) {
      $('golden-ticket').text('FOUND GOLDEN TICKET');
    }
		socket.emit('jobResult', { clientID: clientID, jobNum: jobNumber, result: e.data });
	};

	socket.emit('ready', { clientID: message.clientID });
});

socket.on('job', function (message) {
	jobNumber = message.jobNum;
  worker.postMessage(message);
});

$(function()
{
	$('#setName').click(function(e)
	{
		e.preventDefault();
		socket.emit('nameChange', {clientName: $('#clientName').val()});
	});
})
