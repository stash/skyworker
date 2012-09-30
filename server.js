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

var resultsPerClient = {};
var clientTimeouts = {};
var mains = [];
var startTime = Date.now();

io.sockets.on('connection', function (socket) {
  var clientNum = socket.id;
  // console.log('client number',clientNum,'started');

  socket.emit('load', { name: clientNum, clientID: clientNum, source: clientFunction, url: workerUrl });

  socket.on('resetStats', function(message)
  {
    resultsPerClient = {};
    startTime = Date.now();
    broadcastUpdate();
  });

  socket.on('ready', function (message) {
    if (message.role === 'main') {
      mains.push(socket);
      return;
    }

    if (message.clientID != clientNum)
      throw new Error('something\'s wrong: client number ain\'t right');

    sendJobToClient(socket, clientNum);
  });

  socket.on('jobResult', function(message) {
    // console.log('ClientID: ', message.clientID, ' Completed job num ', message.jobNum);

    if (!resultsPerClient[clientNum])
      resultsPerClient[clientNum] = {
        clientNum: clientNum,
        name: clientNum,
        times: [],
        avg: 0,
        hidden: false,
      };

    var time = message.result.time;
    resetTimer(clientNum);

    process.nextTick(recordResult.bind(null, clientNum, time));

    sendJobToClient(socket, message.clientID);
  });

  socket.on('nameChange', function(message)
  {
    var cli = resultsPerClient[clientNum];
    if (!cli) return;
    cli.name = message.clientName;
    process.nextTick(broadcastUpdate);
  });
});

function sendJobToClient(socket, clientNum)
{
  var jobNum;
  if(!(safe_add(hashCounter, 65535) > 0xFFFFFFFF))
  {
    jobNum = ++jobCounter;
    // console.log('sending job num', jobNum, ' to ', clientNum);
    // console.log('hashCounter', hashCounter);
    socket.emit('job', {jobNum:jobNum, hashCounter:hashCounter, block: job});
    hashCounter = safe_add(hashCounter, 65535);
  }
}

function resetTimer(clientNum) {
  var cli = resultsPerClient[clientNum];
  if (!cli) return;
  var timer = clientTimeouts[clientNum];

  cli.hidden = false;
  if (timer) clearTimeout(timer);
  timer = setTimeout(function() {
    var cli = resultsPerClient[clientNum];
    if (!cli) return;
    cli.hidden = true;
    broadcastUpdate();
  }, 20*1000);
  clientTimeouts[clientNum] = timer;
}

function recordResult(clientNum, time) {
  var cli = resultsPerClient[clientNum];
  if (!cli) return;

  cli.last = Date.now();
  cli.times.push(time);

  var numberOfJobs = cli.times.length;
  var totalTime = cli.times.reduce(function(a,b) { return a + b; }, 0);
  cli.averageTime = totalTime/numberOfJobs;
  cli.totalTime = totalTime;

  broadcastUpdate();
}

function broadcastUpdate() {
  var totals = {
    numberOfJobs: 0,
    totalTime: 0
  };
  var currTime = Date.now();

  var update = Object.keys(resultsPerClient).map(function(clientNum) {
    var cli = resultsPerClient[clientNum];
    totals.numberOfJobs += cli.times.length;
    totals.totalTime += cli.totalTime;
    return cli;
  }).sort(function(a,b) {
    return b.averageTime - a.averageTime;
  });

  totals.averageTime = totals.totalTime / totals.numberOfJobs / 1000;
  totals.perSecond = totals.numberOfJobs * 65535 / (currTime - startTime) * 1000;

  mains.forEach(function(socket) {
    socket.emit('updateDisplay',{order:update, totals:totals});
  });
}

server.listen(8123);

