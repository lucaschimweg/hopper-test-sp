const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const path = require("path");
const request = require("request");
const crypto = require("crypto");
const url = require('url');

let config;

app.get('/', function (req, res) {
  fs.readFile('web.html', function(err, data){
	res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    res.end();
  });
});

app.get('/register', function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.write('registration is in process');

	console.log('\nregistration:');

	request.post('https://' + config.baseUrl + '/api/v1/app', {json:Object.assign({}, config.details, {cert:config.cert})}, (error, res, body) => {
		if (error) {
			console.error(error)
			return
		}
		console.log(`statusCode: ${res.statusCode}`)
		console.log(body)
		if (body.status === 'success'){
			config.id = body.id;
			console.log(config);
			fs.writeFileSync('config.json', JSON.stringify(config));
			console.log('update config file');
		}
	});

	res.write(' ------> registration finished');
	res.end();

});

app.get('/update', function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.write('update service provider is in process');

	console.log('\nupdate:');

	var passphrase = fs.readFileSync(config.passphrase, "utf8").trim();
	var privateKey = fs.readFileSync(config.privateKey, "utf8");
	var toEncrypt = Buffer.from(JSON.stringify(config.details));
	var encrypted = crypto.privateEncrypt(
		{
			key : privateKey,
			passphrase: passphrase
		},
		toEncrypt);

	console.log('Bytes of update string: ' + toEncrypt.length);
	console.log({id:config.id, data:encrypted.toString('base64')});


	request.put('https://' + config.baseUrl + '/api/v1/app', {id:config.id, data:encrypted.toString('base64')}, (error, res, body) => {
		if (error) {
			console.error(error)
			return
		}
		console.log(`statusCode: ${res.statusCode}`)
		console.log(body)
	});

	res.write(' ------> update finished');
	res.end();

});

app.get('/subscribe', function (req, res) {
	console.log('\nsubscribe:');

	var subscribeRequest = {id:config.id,callback:'http://localhost:3000/callback?name=mustermann', name:'mustermann',requestedInfos:[]};
	var passphrase = fs.readFileSync(config.passphrase, "utf8").trim();
	var privateKey = fs.readFileSync(config.privateKey, "utf8");
	var toEncrypt = Buffer.from(JSON.stringify(subscribeRequest));
	var encrypted = crypto.privateEncrypt(
		{
			key : privateKey,
			passphrase: passphrase
		},
		toEncrypt);

	/*subscripe?id={{spId}}&request={{base64-request}}*/
	console.log('id: ' + config.id);
	console.log('request: ' + encrypted.toString('base64'));

    res.redirect('https://' + config.baseUrl + '/subscribe?id=' + encodeURIComponent(config.id) + '&request=' + encodeURIComponent(encrypted.toString('base64')));

	res.end();

});

app.get('/callback', function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	var q = url.parse(req.url, true);
	res.write('received callback for ' + q.query.name);

	console.log('\ncallback received');

	res.end();

});

app.get('/keygen', function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write('key generation has started');

  console.log('\nkeygen:');

  var passphrase = fs.readFileSync(config.passphrase, "utf8").trim();

  const { generateKeyPair } = require('crypto');
  generateKeyPair('rsa', {
	  modulusLength: 2048,
	  publicKeyEncoding: {
		type: 'spki',
		format: 'pem'
	  },
	  privateKeyEncoding: {
		type: 'pkcs8',
		format: 'pem',
		cipher: 'aes-256-cbc',
		passphrase: passphrase
	  }
	}, (err, publicKey, privateKey) => {
	  // Handle errors and use the generated key pair.
	  if (err) throw err;

	  console.log(publicKey);
	  fs.writeFile(config.publicKey, publicKey, function (err) {
		if (err) throw err;
		console.log('Saved public key!');
	  });

	  console.log(privateKey);
	  fs.writeFile(config.privateKey, privateKey, function (err) {
		if (err) throw err;
		console.log('Saved private key!');
	  });

	  config.cert = Buffer.from(publicKey).toString('base64');
      console.log(config);
	  fs.writeFileSync('config.json', JSON.stringify(config));
	  console.log('update config file');

	});

	res.write(' ------> key generation finished');
	res.end();

});

app.listen(3000, function () {
  console.log('Mockup service provider listening on port 3000!');
  //get data from config.json
  console.log('\nconfig setup:');
  config = JSON.parse(fs.readFileSync('config.json'));
  console.log(config);
});
