const express = require('express');
const app = express();
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require("path");


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
	res.end(); 
	console.log('registration');
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
  res.redirect('/');
  console.log('keygen');
  
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
		passphrase: 'Fh<~p;]}r^&\3}&69^Hr'
	  }
	}, (err, publicKey, privateKey) => {
	  // Handle errors and use the generated key pair.
	  console.log(publicKey);
	  fs.writeFile('publickey.txt', publicKey, function (err) {
		if (err) throw err;
		console.log('Saved public key!');
	  });
	  
	  console.log(privateKey);
	  fs.writeFile('privatekey.txt', privateKey, function (err) {
		if (err) throw err;
		console.log('Saved private key!');
	  });
	  
	});
	
});

app.listen(3000, function () {
  console.log('Mockup service provider listening on port 3000!');
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