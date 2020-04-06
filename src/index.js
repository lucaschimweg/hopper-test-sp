const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const request = require('request');
const url = require('url');
const Handlebars = require('hbs');

//get data -> later database?
let data;
let datapath;
let configpath;
let config;

//view engine setup
app.set('views', path.join(__dirname, "views"));
app.set('view engine', 'hbs');
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, '/views')));

Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
    return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

app.get('/', (req,res)=>{
    res.render('index');
})

app.post('/login', (req,res)=>{
    let username = req.body.username;
    let password = hashPassword(req.body.password);
    user = {"username":username};
    index = contains(data.user, user, 'username');
    if(index == -1){
        // user not found
        res.redirect('/')
    }else if(data.user[index].password == password){
        // correct user
        res.render('overview', 
        {username: username, serviceProvider: data.user[index].serviceProvider, 
            addresser: data.user[index].addresser, index: index, notifications: data.user[index].notifications});
    } else{
        //wrong password
        res.redirect('/')
    }
})

app.post('/register', (req,res)=>{
    let username = req.body.username;
    let password = hashPassword(req.body.password);
    user = {"username":username, "password":password, "serviceProvider": [], "addresser": [], "notifications": []};
    index = contains(data.user, user, 'username');
    if(index == -1){
        data.user.push(user);
        updateData();
        res.render('overview', 
        {username: username, serviceProvider: user.serviceProvider, 
            addresser: user.addresser, index: data.user.length-1,notifications: user.notifications});
    } else{
        // user already taken
        res.redirect('/')
    }
})

app.post('/newsp', (req,res)=>{
    if(!validPassword(req.body.username, req.body.password, req.body.index)){
        //wrong password
        res.redirect('/')
    }else{
        createNewSP(req.body, res);
    }
})

app.post('/newad', (req,res)=>{
    if(!validPassword(req.body.username, req.body.password, req.body.index)){
        //wrong password
        res.redirect('/')
    }else{
        createNewAD(req.body, res);
    }
})

app.get('/callback', (req,res)=>{
    var q = url.parse(req.url, true).query;
    console.log(q);
    a = {"id":q.aid};
    console.log(a);
    console.log(data.user[q.index].addresser);
    aindex = contains(data.user[q.index].addresser, a, 'id');
    
    if(aindex == -1){
        //invalid request
        res.redirect('/')
    }else{
        if(q.status == "success"){
            data.user[q.index].addresser[aindex].approved = "true";
            data.user[q.index].addresser[aindex].subscriptionId = q.id;
            updateData();
            res.render('overview', {username: data.user[q.index].username, 
                serviceProvider: data.user[q.index].serviceProvider, 
                addresser: data.user[q.index].addresser, index: q.index, notifications: data.user[q.index].notifications});
        }else{
            console.log(q.error);
            console.log('delete user: ' + data.user[q.index].addresser[aindex].accountName)
            data.user[q.index].addresser.splice(aindex, 1);
            res.redirect('/')
        }
    }
})

app.get('/notification', (req,res)=>{
    //check if request is valid;
    var q = url.parse(req.url, true).query;
    console.log(q);
    var aindex = contains(data.user[q.index].addresser, q, 'id');
    if(aindex == -1){
        res.redirect('/');
    } else if(data.user[q.index].addresser[aindex].appId == q.appId){
        //get account name and subId;
        var accountName = data.user[q.index].addresser[aindex].accountName;
        var subId = data.user[q.index].addresser[aindex].subscriptionId;
        var username = data.user[q.index].username;
        var o = {"id":q.appId};
        var appindex = contains(data.user[q.index].serviceProvider, o, 'id');
        var app = data.user[q.index].serviceProvider[appindex].name;
        var id = generateId();
        res.render('notification', {username: username, appId: q.appId, appName: app, 
        index: q.index, subId: subId, accountName: accountName, id: id});
    } else{
        res.redirect('/');
    }
})

app.post('/send', (req,res)=>{
    if(!validPassword(req.body.username, req.body.password, req.body.index)){
        //wrong password
        res.redirect('/')
    }else{
        var timestamp = new Date();
        timestamp = Date.now();
        var notification = {};
        data.user[req.body.index].notifications.push(notification);
        notification.id = req.body.id;
        notification.heading = req.body.heading;
        notification.timestamp = timestamp;
        if(req.body.imageUrl != ""){
            notification.imageUrl = req.body.imageUrl;
        }
        if(req.body.isDone == 'checked'){
            notification.isDone = true;
        } else{
            notification.isDone = false;
        }
        if(req.body.isSilent == 'checked'){
            notification.isSilent = true;
        } else{
            notification.isSilent = false;
        }
        notification.type = req.body.type;
        notification.content = req.body.content;
        notification.actions = [];
        obj = Object.assign({}, notification);
        notification.appId = req.body.appId;
        notification.appName = req.body.appName;
        request.post('https://' + config.baseUrl + '/notification', {json:{subscriptionId:req.body.subscriptionId,notification:obj}}, (error, res2, body) => {
            if (error) {
                console.error(error)
                return
            }
            console.log(`statusCode: ${res2.statusCode}`);
            console.log(body);
            if (body.status === 'success'){
                notification.systemId = body.id;
                updateData();
            }
            res.render('overview', 
            {username: req.body.username, serviceProvider: data.user[req.body.index].serviceProvider, 
                addresser: data.user[req.body.index].addresser, index: req.body.index, notifications: data.user[req.body.index].notifications});
        });
    }
})

app.get('/serviceprovider', (req,res)=>{
    //check if request is valid;
    var q = url.parse(req.url, true).query;
    console.log(q);
    var spindex = contains(data.user[q.index].serviceProvider, q, 'id');
    if(spindex == -1){
        res.redirect('/');
    } else{
        //get account name and subId;
        var username = data.user[q.index].username;
        var name = data.user[q.index].serviceProvider[spindex].name;
        var imageUrl = data.user[q.index].serviceProvider[spindex].imageUrl;
        res.render('serviceprovider', {username: username, id: q.id, name: name, imageUrl: imageUrl, 
        index: q.index});
    }
})

app.post('/update', (req,res)=>{
    console.log(req.body);
    if(!validPassword(req.body.username, req.body.password, req.body.index)){
        //wrong password
        res.redirect('/')
    }else{
        spindex = contains(data.user[req.body.index].serviceProvider, req.body, 'id');
        if(spindex == -1){
            res.redirect('/');
        } else{
            var update = {};
            update.imageUrl = req.body.imageUrl;
            update.name = req.body.name;
            if(req.body.newCert == 'checked'){
                //generate new keypair
                var passphrase = config.passphrase;
                const { generateKeyPairSync } = crypto;
                const { publicKey, privateKey } = generateKeyPairSync('rsa', {
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
                });
                update.publicKey = publicKey;
                update.privateKey = privateKey;
                var certificate = Buffer.from(update.publicKey).toString('base64');
                update.cert = certificate;
            } else{
                update.cert = data.user[req.body.index].serviceProvider[spindex].cert;
            }
            var id = req.body.id;
            console.log(id);
            var obj = {"name": update.name, "imageUrl": update.imageUrl, "cert":update.cert};
            //encrypt
        
            var sha = crypto.createHash('sha256');
            sha.update(JSON.stringify(obj));
            var hash = sha.digest('hex');
            var passphrase = config.passphrase;
	        var toEncrypt = Buffer.from(hash);
	        var encrypted = crypto.privateEncrypt(
		        {
                    key : data.user[req.body.index].serviceProvider[spindex].privateKey,
                    passphrase: passphrase
                },
                toEncrypt);
            var content = {"verify":encrypted.toString('base64'), "data": obj};
            console.log(content);
            request.put('https://' + config.baseUrl + '/app', {json: {id:id, content:Buffer.from(JSON.stringify(content)).toString('base64')}}, (error, res2, body) => {

                if (error) {
                    console.error(error)
                    return
                }
                console.log(`statusCode: ${res2.statusCode}`);
                console.log(body);
                if (body.status === 'success'){
                    if(data.user[req.body.index].serviceProvider[spindex].name != update.name){
                        //update name in notifications and addressers
                        for(var i = 0; i < data.user[req.body.index].addresser.length; i++){
                            if(data.user[req.body.index].addresser[i] != null){
                                if(data.user[req.body.index].addresser[i].appId == id){
                                    data.user[req.body.index].addresser[i].appName = update.name;
                                }
                            }
                        }
                        for(var i = 0; i < data.user[req.body.index].notifications.length; i++){
                            if(data.user[req.body.index].notifications[i] != null){
                                if(data.user[req.body.index].notifications[i].appId == id){
                                    data.user[req.body.index].notifications[i].appName = update.name;
                                }
                            }
                        }
                    }
                    data.user[req.body.index].serviceProvider[spindex].name = update.name;
                    data.user[req.body.index].serviceProvider[spindex].imageUrl = update.imageUrl;
                    data.user[req.body.index].serviceProvider[spindex].cert = update.cert;
                    if(update.privateKey != undefined){
                        data.user[req.body.index].serviceProvider[spindex].privateKey = update.privateKey;
                    }
                    if(update.publicKey != undefined){
                        data.user[req.body.index].serviceProvider[spindex].publicKey = update.publicKey;
                    }
                    updateData();
                }
                res.render('overview', 
                {username: req.body.username, serviceProvider: data.user[req.body.index].serviceProvider, 
                addresser: data.user[req.body.index].addresser, index: req.body.index, notifications: data.user[req.body.index].notifications});
            });
        }
    }
})


let hashPassword = (password) => {
    const SALT = "2346ad27d7568ba9896f1b7da6b5991251debdf2";
    const hash = crypto.createHash('sha256');
    hash.update(SALT);
    hash.update(password);
    return hash.digest('hex');
}

let updateData = () =>{
    fs.writeFile(datapath, JSON.stringify(data), (err) =>{
        if (err) throw err;
        console.log('data saved');
    });
}

let contains = (list, obj, att) => {
    var i = 0;
    for(i = 0; i < list.length; i++){
        if(list[i] != null){
            if (list[i][att] === obj[att]){
                return i;
            }
        }
    }
    return -1;
}

let validPassword = (username, password, index) => {
    if(data.user[index].username != username){
        return false;
    } else if(data.user[index].password == hashPassword(password)){
        return true;
    } else{
        return false;
    }
}

let createNewSP = (obj, res) => {
    serviceProvider = {};
    console.log(obj);
    data.user[obj.index].serviceProvider.push(serviceProvider);
    //generate rsa key
    var passphrase = config.passphrase;
    const { generateKeyPairSync } = crypto;
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
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
    });
    serviceProvider.publicKey = publicKey;
    serviceProvider.privateKey = privateKey;

    //register sp
    certificate = Buffer.from(serviceProvider.publicKey).toString('base64');
    var username = obj.username;
    var index = obj.index;
    delete obj.username;
    delete obj.password;
    delete obj.index;
    var base = config.host;
    //cut away http// or https://
    if(base.slice(0, 7) == 'http://'){
        base = base.slice(7);
    } else if(base.slice(0, 8) == 'https://'){
        base = base.slice(8);
    }
    obj.baseUrl = base;
    Object.assign(serviceProvider, obj, {cert:certificate});
    request.post('https://' + config.baseUrl + '/app', {json:Object.assign({}, obj, {cert:certificate})}, (error, res2, body) => {
		if (error) {
            console.error(error)
			return
		}
		console.log(`statusCode: ${res2.statusCode}`)
		console.log(body)
		if (body.status === 'success'){
            serviceProvider.id = body.id;
            updateData();
        }
        res.render('overview', {username: username, 
            serviceProvider: data.user[index].serviceProvider, 
            addresser: data.user[index].addresser, index: index, notifications: data.user[index].notifications});
	});
}

createNewAD = (obj, res) => {
    addresser = {"approved":false,"id":generateId()};
    data.user[obj.index].addresser.push(addresser);
    index = obj.index;
    delete obj.username;
    delete obj.password;
    delete obj.index;
    Object.assign(addresser, obj);
    updateData();
    //check port
    if(config.port==80){
        var callback = config.host + '/callback?index=' + index + '&aid=' + addresser.id;
    } else{
        var callback = config.host + ':' + config.port + '/callback?index=' + index + '&aid=' + addresser.id;
    }
    var subscribeRequest = {id:obj.appId,callback: callback, accountName: obj.accountName, requestedInfos:[]};
    var passphrase = config.passphrase;
    c = {"id":obj.appId};
    spindex = contains(data.user[index].serviceProvider, c, 'id');
    if(spindex==-1){
        res.redirect('/');
    }else{
        addresser.appName = data.user[index].serviceProvider[spindex].name;
        //encrypt
        
        var sha = crypto.createHash('sha256');
        sha.update(JSON.stringify(subscribeRequest));
        var hash = sha.digest('hex');
        var privateKey = data.user[index].serviceProvider[spindex].privateKey;
        var toEncrypt = Buffer.from(hash);
        var encrypted = crypto.privateEncrypt(
            {
                key : privateKey,
                passphrase: passphrase
            },
            toEncrypt);
        var content = {"verify":encrypted.toString('base64'), "data": subscribeRequest};
        console.log(content);


        res.redirect('https://' + config.redirectUrl + '/subscribe?id=' + encodeURIComponent(c.id) + '&content=' + encodeURIComponent(Buffer.from(JSON.stringify(content)).toString('base64')));
    }
}

generateId = () => {
    const hash = crypto.createHash('sha256');
    hash.update(crypto.randomBytes(128).toString('base64'));
    return hash.digest('hex');
}

generatePassphrase = () =>{
    var rand = crypto.randomBytes(128).toString('base64');
    return rand;
}

defaultConfig = () => {
    var passphrase = "0adf5AD11A23adfAD524f8DFA9495sa7AD3DF6543";
    var lconfig = {"baseUrl": "api-dev.hoppercloud.net/v1", "redirectUrl": "dev.hoppercloud.net", "host": "http://localhost", "data": "localfiles/data.json", "port": 5000, "passphrase": passphrase};
    return lconfig;
}

//check for config
try {
    if(!process.argv[2]){ 
        console.log("Specify config!"); 
        process.exit(1);
    }
    configpath = process.argv[2];
    console.log("Loading config from " + configpath);
    
    if (!fs.existsSync(configpath)) {
        fs.writeFileSync(configpath, JSON.stringify(defaultConfig()));
        console.log("Could not read config! Default config written to disk!");
        process.exit(1);

    }

    config = JSON.parse(fs.readFileSync(configpath));

    datapath = config.data;
    if (!fs.existsSync(datapath)) {
        var test = datapath.substring(0, datapath.lastIndexOf('/'));
        fs.mkdirSync(test, { recursive: true });
        data = {"user":[]};
        updateData();
    }else{
        data = JSON.parse(fs.readFileSync(datapath));
        if(data == {}){
            data = {"user":[]};
        }
    }
    //start server
    app.listen(config.port, ()=>{
        console.log(`Service Provider is running on port ${config.port}!`);
    });
} catch(err) {
    console.error(err)
}
