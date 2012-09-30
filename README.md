skyworker
=========

Client:
* Going to `/` loads a server-relative URL ("/miner.js" in this case) on the client as a WebWorker.
* stats are reported back to server.
* All client-server interaction is via socket.io

Dashboard:
* Going to `/main.html` loads the dashboard
* As jobs complete, a leaderboard of the fastest workers is displayed.
* Again, all interaction except the initial page load is via socket.io
* Shows aggregate SHA256 hashes per second.