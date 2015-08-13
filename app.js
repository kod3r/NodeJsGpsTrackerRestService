// main file

var HTTPServer = require('./HttpServer.js');

// This function is for logging. It's being passed to the HTTPServer constructor below
var consoleWrite = function(msg) {
	console.log(msg);
};

// Create a new instance of the HTTPServer and let it listen
var server = new HTTPServer(consoleWrite);
server.listen();