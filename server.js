var fs = require('fs');
var http = require('http');
var socketio = require('socket.io');

// Buffer for the client script
var client = fs.readFileSync('./node_modules/socket.io-client/dist/socket.io.min.js');

function sendFile(filename,req,res) {
  fs.readFile(filename, function(err,buf) {
    res.writeHead(200, {'content-type':'text/html', 'content-length':buf.length});
    res.end(buf);
  });
}

var server = http.createServer(function(req,res) {
  var url = req.url;
  if (url.match(/^\/client.js/)) {
    return sendFile('./client.js',req,res);
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

io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});

server.listen(8123);

