// Include required modules.
var express = require('express');
var tropowebapi = require('tropo-webapi');
var request = require('request');
var moment = require('moment');
var prompts = require('./prompts');

// Define flight information API endpoint.
var apiEndpoint = 'http://flightinfo.phlapi.com/number/'

// Transfer number.
var transferNumber = "2159991111";

// Create express app.
var app = express();
app.use(express.bodyParser());
moment().format();

// Greeting.
app.post('/', function(req, res) {
	var tropo = new tropowebapi.TropoWebAPI();
	tropo.say(prompts.greeting);
	var say = new Say(prompts.languageSplit, null, null, null, "Soledad");
	var choices = new Choices("[1 DIGITS]", "dtmf");
	tropo.ask(choices, 1, true, null, "foo", null, true, say, 3, null);
	tropo.on("continue", null, "/menu", true);
	res.send(tropowebapi.TropoJSON(tropo));
});

// Language split.
app.post('/menu', function(req, res) {
	var result = req.body;
	var tropo = new tropowebapi.TropoWebAPI();
	tropo.say(".");
	var selection = result.result.actions.interpretation;
	var language = selection == 1 ? 'es' : 'en';
	tropo.on("continue", null, '/select?language=' + language, true);
	res.send(tropowebapi.TropoJSON(tropo));
});

// Select service type.
app.post('/select', function(req, res) {
	var tropo = new tropowebapi.TropoWebAPI();
	var language = req.query.language;
	var say = new Say(prompts.initialPrompt);
	var choices = new Choices("[1 DIGITS]", "dtmf");
	tropo.ask(choices, 1, true, null, "foo", null, true, say, 5, null);
	tropo.on("continue", null, "/options?language=" + language, true);
	res.send(tropowebapi.TropoJSON(tropo));
});

// Service options.
app.post('/options', function(req, res) {
	var result = req.body;
	var language = req.query.language;
	var selection = typeof(result.result.actions) != 'undefined' ? result.result.actions.interpretation : "1";
	var tropo = new tropowebapi.TropoWebAPI();
	if(selection == 1) {
		var say = new Say(prompts.selectPrompt);
		var choices = new Choices("[1 DIGITS]", "dtmf");
		tropo.ask(choices, 1, true, null, "foo", null, true, say, 5, null);
		tropo.on("continue", null, "/result?language=" + language, true);
	}
	else {
		tropo.say("Please hold.");
		tropo.transfer(transferNumber);
	}
	res.send(tropowebapi.TropoJSON(tropo));
});

// Process service option selection.
app.post('/result', function(req, res) {
	var result = req.body;
	var language = req.query.language;
	var option = result.result.actions.interpretation;
	var tropo = new tropowebapi.TropoWebAPI();
	tropo.say(".");
	switch(option) {
		case "1":
			tropo.on("continue", null, "/flightnumber?language=" + language + "&direction=Arrival", true);
			break;

		case "2":
			tropo.on("continue", null, "/flightnumber?language=" + language + "&direction=Departure", true);
			break;

		case "3":
			tropo.say("Please hold.");
			tropo.transfer(transferNumber);
			break;

		case "4":
			tropo.on("continue", null, "/options?language=" + language, true);
			break;

		case "5":
			tropo.say("Thank you for calling. Goodbye.");
			tropo.hangup();
			break;
	}
	res.send(tropowebapi.TropoJSON(tropo));
});

// Get flight number.
app.post('/flightnumber', function(req, res) {
	var language = req.query.language;
	var direction = req.query.direction;
	var tropo = new tropowebapi.TropoWebAPI();
	var say = new Say(prompts.numberPrompt);
	var choices = new Choices("[4-5 DIGITS]", "dtmf");
	tropo.ask(choices, 3, true, null, "foo", null, true, say, 5, null);
	tropo.on("continue", null, "/ask?language=" + language + "&direction=" + direction, true);
	res.send(tropowebapi.TropoJSON(tropo));

});

// Prompt caller to confirm flight number entry.
app.post('/ask', function(req, res) {
	var language = req.query.language;
	var direction = req.query.direction;
	var result = req.body;
	var flightNumber = result.result.actions.interpretation;
	var tropo = new tropowebapi.TropoWebAPI();
	var say = new Say(prompts.youEnteredPrompt + flightNumber.split("").join(" ") + prompts.ifCorrectPrompt);
	var choices = new Choices("[1 DIGITS]", "dtmf");
	tropo.ask(choices, 3, true, null, "foo", null, true, say, 5, null);
	tropo.on("continue", null, "/confirm?language=" + language + "&direction=" + direction + '&flightNumber=' + flightNumber, true);
	res.send(tropowebapi.TropoJSON(tropo));
});

// Confirm flight number entry.
app.post('/confirm', function(req, res) {
	var language = req.query.language;
	var direction = req.query.direction;
	var flightNumber = req.query.flightNumber;
	var result = req.body;
	var selection = result.result.actions.interpretation;
	var tropo = new tropowebapi.TropoWebAPI();
	tropo.say(".");
	if(selection == 1) {
		tropo.on("continue", null, "/flightinfo?language=" + language + "&direction=" + direction + '&flightNumber=' + flightNumber, true);
	}
	else {
		tropo.on("continue", null, "/flightnumber", true);
	}
	res.send(tropowebapi.TropoJSON(tropo));
});

// Play flight information.
app.post('/flightinfo', function(req, res) {
	var language = req.query.language;
	var direction = req.query.direction;
	var flightNumber = req.query.flightNumber;
	var preposition = direction == 'Arrival' ? ' from ' : ' to ';
	var tropo = new tropowebapi.TropoWebAPI();
	request(apiEndpoint + flightNumber, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var flightInfo = JSON.parse(body);
			if(flightInfo.length > 0) {
				// Loop through flights in API response
				for(var i=0; i<flightInfo.length; i++) {
					if(flightInfo[i].direction == direction) {
						var scheduledDateTime = moment(flightInfo[i].scheduledDateTime);
						var estimatedDateTime = moment(flightInfo[i].estimatedDateTime);
						tropo.say('Flight number, ' + flightNumber.split("").join(" ") + ',');
						tropo.say(direction + preposition + flightInfo[0].airport + ',');
						tropo.say("Scheduled for " + direction + ' on ' + scheduledDateTime.format('MMMM Do YYYY, h:mm a'));
						tropo.say(preposition + ' gate ' + flightInfo[0].gate + ",");
						tropo.say("Currently estimated for " + direction + ' on ' + estimatedDateTime.format('MMMM Do YYYY, h:mm a'))
					}
					else {
						continue;
					}
				}
			}
			else {
				tropo.say("I could not retireve information on that flight");
				tropo.on("continue", null, "/flightnumber", true);
			}
	  	}
	  	else {
	  		tropo.say("I could not retireve information on that flight");
	  		tropo.on("continue", null, "/flightnumber", true);
	  	}
	  	res.send(tropowebapi.TropoJSON(tropo));
	});
});

// Start express app.
app.listen(3000);