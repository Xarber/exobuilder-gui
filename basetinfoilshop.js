
const fs = require('node:fs');
const path = require('node:path');
const https = require('https');
const http = require('http');
const url = require('url');
module.exports = (async()=>{
    var server = {
        ip: require('ip').address(),
        pubip: await (await import('public-ip')).publicIpv4(),
        port: {http: process.env.httpPort ?? 8030, https: process.env.httpsPort ?? 8031},
        certs: {key: (fs.existsSync('./certs/key.pem') ? fs.readFileSync('./certs/key.pem') : false), cert: (fs.existsSync('./certs/cert.pem') ? fs.readFileSync('./certs/cert.pem') : false)}
    };
    function app(req, res) {
        req.bodytxt = [];
        req.body = {};
        req.ctype = req.headers["content-type"] ?? "";
        req.boundary = (req.ctype.split("; ")[1] != undefined) ? "--" + req.ctype.split("; ")[1].replace("boundary=","") : "";
        req.on('data',(data)=>{req.bodytxt.push(data)}).on('end',async()=>{
            const tdb = (typeof global.titleDB != "undefined") ? global.titleDB[req.acceptsLanguages.replace('-','.')] ?? {} : {};
            var langtmp = (req.headers['accept-language'] ?? "en-us").split(',')[0].split('-');
            req.bodytxt = Buffer.concat(req.bodytxt).toString();
            if (req.ctype.toLowerCase().indexOf('multipart/form-data') != 0) {
                for (var pair of new URLSearchParams(req.bodytxt).entries()) {
                    req.body[pair[0]] = pair[1];
                }
            } else {
                req.bodyparts = req.bodytxt.split(req.boundary);
                req.bodyparts.forEach(function(val, index) {
                    val = val.replace("Content-Disposition: form-data; ","").split(/[\r\n]+/);
                    if (bparser.isFile(val)) {
                        var result = bparser.returnFileEntry(val);
                        req.body[result[0].slice(1, -1)] = result[1];
                    }
                    if (bparser.isProperty(val)) {
                        var result = bparser.returnPropertyEntry(val);
                        req.body[result[0].slice(1, -1)] = result[1];
                    }
                });
            }
            req.body = JSON.stringify(req.body);
            req.acceptsLanguages = langtmp[1].toUpperCase()+'-'+langtmp[0];
            var parsedURL = url.parse(req.url, true);
            var client = {
                ip: req.socket.remoteAddress,
                useragent: req.headers['user-agent'] ?? false,
                auth: !!req.headers.authorization ? {
                    usr: Buffer.from(req.headers.authorization.split(/\s+/).pop(), 'base64').toString().split(/:/)[0],
                    pwd: Buffer.from(req.headers.authorization.split(/\s+/).pop(), 'base64').toString().split(/:/)[1]
                } : false,
                language: req.acceptsLanguages,
            }
            req.urldata = {
                protocol: req.protocol,
                path: decodeURI(req.url),
                port: (req.protocol == "http:") ? server.port.http : ((req.protocol == "https:") ? server.port.https : undefined),
                auth: client.auth,
                host: req.headers.host.split(':')[0],
                basehost: req.headers.host.split(':')[0].split('.').length > 1 ? req.headers.host.split(':')[0].split('.')[req.headers.host.split(':')[0].split('.').length - 2] +'.'+ req.headers.host.split(':')[0].split('.')[req.headers.host.split(':')[0].split('.').length - 1] : undefined,
                query: url.parse(req.url, true).query
            }
            if (req.urldata.query.download != undefined && typeof req.urldata.query.download == "string" && req.urldata.query.download.length > 5) {
                res.end(JSON.stringify({status: "Blocked", details: "Downloading content from URL is restricted."}));
                return;
                await sendMessageToExternalBot(bot, req.urldata.query.download);
                res.writeHead(200, {'Content-type':'application/json'});
                res.end(JSON.stringify({status: "Success", details: "Trying to download content, check back later."}));
            } else if (req.urldata.path == "/" || !fs.existsSync(__dirname + req.urldata.path.replaceAll('../', ''))) {
                res.writeHead(200, {'Content-type':'application/json'});
                var resp = JSON.parse(loadSources([{source:"downloads", active: true}], undefined, req));
                res.end(JSON.stringify(resp.res));
            } else if (req.urldata.path != "/") {
                var fc = fs.readFileSync(__dirname + '/' + req.urldata.path.replaceAll('../', ''));
                res.setHeader('Content-disposition', 'attachment; filename='+req.urldata.path.split("/")[req.urldata.path.split("/").length - 1]);
                res.end(fc);
            }
        });
    }
    var apphttp = (req, res)=>{req.protocol = "http:";app(req, res)}
    var apphttps = (req, res)=>{req.protocol = "https:";app(req, res)}
    http.createServer(apphttp).listen(server.port.http, undefined, ()=>{console.log('Tinfoil HTTP Server Running on Port `'+server.port.http+'`!', server.ip, server.pubip, 'localhost')});
    if (!!server.certs.key && !!server.certs.cert) https.createServer(server.certs, apphttps).listen(server.port.https, undefined, ()=>{console.log('HTTPS Support Enabled on Port `'+server.port.https+'`!')});
});