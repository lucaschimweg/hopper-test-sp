const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const path = require("path");
const request = require("request");

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
	
	var absolutePath = path.resolve(config.publicKey);
	var publicKey = fs.readFileSync(absolutePath, "utf8");
	var base = Buffer.from(publicKey).toString('base64');
	
	console.log('\nregistration:');
	
	request.post('https://' + config.baseUrl + '/api/v1/app', {
		json: {
			"name": "Example",
			"baseUrl": "https://www.google.com/",
			"logoUrl": "https://hoppercloud.net/img/logo.svg",
			"imageUrl": "https://hoppercloud.net/img/logo.svg",
			"contactEmail": "noreplay@hoppercloud.net",
			"cert": base
		}
	}, (error, res, body) => {
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

app.get('/publickey', function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/html'});
	var absolutePath = path.resolve('publickey.txt');
	var publicKey = fs.readFileSync(absolutePath, "utf8");
	var base = Buffer.from(publicKey).toString('base64');
	res.write(base);
	
	res.end(); 
	console.log('publicKey');
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

app.get('/crypt', function (req, res) {
	
	// passphrase should be hard to guess -> later not writing it plain
	
	res.writeHead(200, {'Content-Type': 'text/html'});
	res.write('encrypt and decrypt is in process -> ');
	//res.write(req.url);
	
	var absolutePath = path.resolve('publickey.txt');
    var publicKey = fs.readFileSync(absolutePath, "utf8");
    var buffer = Buffer.from(req.url);
    var encrypted = crypto.publicEncrypt(publicKey, buffer);
	
	var absolutePath = path.resolve('privatekey.txt');
    var privateKey = fs.readFileSync(absolutePath, "utf8");
    var buffer = Buffer.from(encrypted, "base64");
    var decrypted = crypto.privateDecrypt(
		{
			key : privateKey,
			passphrase: 'Fh<~p;]}r^&\3}&69^Hr'
		},
		buffer);
	res.write(decrypted + " = " + req.url);
	res.end(); 
	console.log('crypt');
});