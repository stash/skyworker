var fs = require('fs');
var http = require('http');
var socketio = require('socket.io');

// Buffer for the client script
var client = fs.readFileSync('./node_modules/socket.io-client/dist/socket.io.min.js');

function sendFile(filename,req,res) {
  fs.readFile(filename, function(err,buf) {
    var ct = 'text/html';
    if (filename.match(/\.js$/)) ct = 'application/javascript; charset=UTF-8';
    res.writeHead(200, {'content-type':ct, 'content-length':buf.length});
    res.end(buf);
  });
}

function safe_add (x, y) {
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

function hexstring_to_binary(str)
{
  var result = [];

  for(var i = 0; i < str.length; i += 8) {
    var number = 0x00000000;
    
    for(var j = 0; j < 4; ++j) {
      number = safe_add(number, hex_to_byte(str.substring(i + j*2, i + j*2 + 2)) << (j*8));
    }

    result.push(number);
  }

  return result;
}

function hex_to_byte(hex)
{
  return( parseInt(hex, 16));
}

var server = http.createServer(function(req,res) {
  var url = req.url;
  if (url.match(/^\/client\.js/)) {
    return sendFile('./client.js',req,res);
  } else if (url.match(/^\/miner\.js/)) {
    return sendFile('./miner.js',req,res);
  } else if (url.match(/^\/main\.html/)) {
    return sendFile('./main.html',req,res);
  } else if (url.match(/^\/(?:index\.html)?/)) {
    return sendFile('./index.html',req,res);
  }

  res.writeHead(200, {'content-type':'text/plain'});
  res.end('SkyWorker! '+(new Date()));
});

var io = socketio.listen(server, {
});

io.set('flash policy server', false);
io.set('log level', 1);
io.enable('browser client minification');
io.enable('browser client etag');
io.disable('browser client gzip');
io.set('transports', ['websocket', 'xhr-polling', 'jsonp-polling']);
io.set('io name', 'skyworker.io');
io.disable('match origin protocol');

var clientCounter = 0;
var jobCounter = 0;
var hashCounter = 0x00000000;
var workerUrl = '/miner.js';

var workrequest = "{\"method\": \"getwork\", \"params\": [], \"id\":0}\r\n";
var response = "{\"result\":{\"midstate\":\"fd8c924ed9a07c7d6dd49c1079429142d94cf99d6bb978e123190d52fbf8ef6f\",\"data\":\"0000000116237c0c0d1baffc50d4bf2a19bf5bc6fbf381c26bac4a0a0000db40000000008108b0619305607e7f04634ffe7ef35294970d5656694c6b7a0ef3b07b87e9ac4d8d90321b00f33900000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000080020000\",\"hash1\":\"00000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000010000\",\"target\":\"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000\"},\"error\":null,\"id\":0}";

response = JSON.parse(response);
var job = {};

job.midstate = hexstring_to_binary(response.result.midstate);
job.data = hexstring_to_binary(response.result.data);
job.hash1 = hexstring_to_binary(response.result.hash1);
job.target = hexstring_to_binary(response.result.target);

// Remove the first 512-bits of data, since they aren't used
// in calculating hashes.
job.data = job.data.slice(16);

var clientFunction = fs.readFileSync(__dirname+'/function.js', 'utf8');

io.sockets.on('connection', function (socket) {
  var clientNum = ++clientCounter;
  console.log('client number',clientNum,'started');
  socket.emit('load', { clientID: clientNum, source: clientFunction, url: workerUrl });

  socket.on('ready', function (message) {
    if (message.clientID != clientNum) throw new Error('something\'s wrong: client number ain\'t right');

    sendJobToClient(socket, clientNum);
  });

  socket.on('jobResult', function(message) {
    console.log('ClientID: ', message.clientID, ' Completed job num ', message.jobNum);

    sendJobToClient(socket, message.clientID);
  });
});

function sendJobToClient(socket, clientNum)
{
  var jobNum;
  if(!(safe_add(hashCounter, 65535) > 0xFFFFFFFF))
  {
    jobNum = ++jobCounter;
    console.log('sending job num', jobNum, ' to ', clientNum);
    console.log('hashCounter', hashCounter);
    socket.emit('job', {jobNum:jobNum, hashCounter:hashCounter, block: job});
    hashCounter = safe_add(hashCounter, 65535);
  }
}

server.listen(8123);

