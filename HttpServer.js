// http server

var http = require('http');
var url = require('url');
var fs = require('fs');
var db = require('ibm_db');

// Bluemix provides the port and the host of the application in the "process.env.*" constants
var PORT = (process.env.VCAP_APP_PORT || 8000); 
var HOST = (process.env.VCAP_APP_HOST || 'localhost');

// This is the dbconn object, it will be assigned later
var dbconn = null;

// This is the console callback function (for logging), which will be assigned later
var consoleCallback = function(msg){ };


// This function checks whether it's parameter is a function or not
function isFunction(functionToCheck) {
	 var getType = {};
	 return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

// This function gets the location according to the device ID out of the DB
function getDeviceLocation(deviceId, callbackFunction)
{
	dbconn.query("SELECT * FROM DEVICE WHERE DEVICEID='" + deviceId + "';", function(err, data, moreResultSets) 
	{
		if(err)
		{
			callbackFunction(err, null);
		}
		else
		{
			callbackFunction(null, data);
		}
	});
}

// This is the constructor of the HTTP Server object. It tries to open a connection to the DB and creates a table (and its columns) called "DEVICE"
var HTTPServer = function(ConsoleCallback) 
{
	if (!isFunction(ConsoleCallback))
	{
		throw new Error("consoleCallback is not a function");
	}
	
	consoleCallback = ConsoleCallback;
	
	// Get the credentials for the DB and save it in the variable "db2"
	var db2 = "";
	
	if (process.env.VCAP_SERVICES)
	{
		var env = JSON.parse(process.env.VCAP_SERVICES);
		db2 = env['sqldb'][0].credentials;
	}
	else
	{
		consoleCallback("ERROR: Could not get DB credentials.");
	}
	
	db.open("DRIVER={DB2};DATABASE=" + db2.db + ";UID=" + db2.username + ";PWD=" + db2.password + ";HOSTNAME=" + db2.hostname + ";port=" + db2.port, function(err, conn)
	{
		if (err)
		{
			consoleCallback(err.toString());
		}
		else
		{
			dbconn = conn;
			consoleCallback("Connection to the db was successfully established.");
			dbconn.query("CREATE TABLE DEVICE(ID int NOT NULL GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1), DEVICEID varchar(255), LATITUDE varchar(255), LONGITUDE varchar(255))", function(err, moreResultSets) {
				if (err)
				{
					consoleCallback("ERROR: IMPORTANT: You can ignore this error if the table already exists in the db: " + err.toString());
				}
				else
				{
					consoleCallback("The following DDL-Statement was successfully ran against the db2: \"CREATE TABLE DEVICE(ID int NOT NULL GENERATED ALWAYS AS IDENTITY (START WITH 1 INCREMENT BY 1), DEVICEID varchar(255), LATITUDE varchar(255), LONGITUDE varchar(255))\"");
				}
			});
		}
	});
};

// This function creates a http server, which answers and processes requests
HTTPServer.prototype.listen = function () {
	try
	{
		http.createServer(function(request, response) {
			// queryData contains the http parameters of the request
			var queryData = url.parse(request.url, true).query;
			if (dbconn != null && queryData.deviceid != null && (queryData.latitude == null && queryData.longitude == null)) // Getting location
			{
				getDeviceLocation(queryData.deviceid, function(err, data) {
					if (err)
					{
						consoleCallback(err.toString());
						response.writeHeader(200, {"Content-Type": "text/html"});
						response.write("<title>GPS Tracker - ERROR</title>");
						response.write("<h1>An error occured</h1>");
						response.write("<p>" + err.toString() + "</p>");
						response.end();
					}
					else
					{
						response.writeHeader(200, {"Content-Type": "text/html"});
						response.write("<title>GPS Tracker - Location</title>");
						response.write("<h1>Last registered location of your device</h1>");
						response.write("<p>Device ID: " + data[0].DEVICEID + "</p>");
						response.write("<p>Latitude: " + data[0].LATITUDE + "</p>");
						response.write("<p>Longitude: " + data[0].LONGITUDE + "</p><br>");
						response.write("<a href=\"http://maps.google.com/?q=" + data[0].LATITUDE + "," + data[0].LONGITUDE + "\" target=\"_blank\">See the location on Google Maps</a>")
						response.end();
						
						consoleCallback("The following DDL-Statement was successfully ran against the db2: \"SELECT * FROM DEVICE WHERE DEVICEID='" + queryData.deviceid + "';\"");
					}
				});
			}
			else if (dbconn != null && queryData.deviceid != null && queryData.latitude != null && queryData.longitude != null) // Setting location
			{
				dbconn.query("DELETE FROM DEVICE WHERE DEVICEID='" + queryData.deviceid + "';", function(err, data) {
					if (err)
					{
						consoleCallback(err.toString());
					}
					else
					{
						consoleCallback("The following DDL-Statement was successfully ran against the db2: \"DELETE FROM DEVICE WHERE DEVICEID='" + queryData.deviceid + "';\"");
					}
				});
				
				dbconn.query("INSERT INTO DEVICE (DEVICEID, LATITUDE, LONGITUDE) VALUES ('" + queryData.deviceid + "', '" + queryData.latitude + "', '" + queryData.longitude + "');", function(err, data) {
					if (err)
					{
						consoleCallback(err.toString());
					}
					else
					{
						consoleCallback("The following DDL-Statement was successfully ran against the db2: \"INSERT INTO DEVICE (DEVICEID, LATITUDE, LONGITUDE) VALUES ('" + queryData.deviceid + "', '" + queryData.latitude + "', '" + queryData.longitude + "');\"");
					}
				});
				
				response.writeHeader(200, {"Content-Type": "text/plain"});
				response.write("request received and processed");
				response.end();
			}
			else // Gives back the index.html file, which contains a page that creates a request to obtain the location of a device
			{
				fs.readFile("./index.html", function(err, data)
				{
					if (err)
					{
						response.writeHeader(404, {"Content-Type": "text/html"});
						response.write("<title>ERROR - GPS Tracker</title>");
						response.write("<h1>Uups, something went wrong</h1>");
						response.write("<p>" + err.toString() + "</p>");
						response.end();
					}
					else
					{
						response.writeHeader(200, {"Content-Type": "text/html"});
						response.write(data);
						response.end();
					}
				});
			}
		}).listen(PORT, HOST);
		consoleCallback("server is now listening on port " + PORT);
	}
	catch (ex)
	{
		consoleCallback(ex);
	}
};

module.exports = HTTPServer;