const { app, BrowserWindow, ipcMain, dialog, session, Menu, Tray } = require('electron');
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const child_process = require("child_process");
const fs = require('node:fs');
const path = require('node:path');
const https = require('https');
const url = require('url');
const isDevApp = process.env.APP_DEV ? (process.env.APP_DEV.trim() == "true") : false;

let exobpathtmp = "";
switch (process.platform) {
    case "win32":
        exobpathtmp = (fs.existsSync("resources/libs")) ? "resources\\libs\\ExoBuilder.exe" : "libs\\ExoBuilder.exe";
        break;
    case "darwin":
        exobpathtmp = (fs.existsSync("resources/libs")) ? "./resources/libs/ExoBuilder-macos" : "./libs/ExoBuilder-macos";
        break;
    case "linux":
        exobpathtmp = (fs.existsSync("resources/libs")) ? "./resources/libs/ExoBuilder-linux" : "./libs/ExoBuilder-linux";
        break;
    default: 
        exobpathtmp = (fs.existsSync("resources/libs")) ? "./resources/libs/ExoBuilder" : "./libs/ExoBuilder";
}
const exobpath = exobpathtmp;
const lpcpath = exobpath.replace('ExoBuilder', 'LPC'+path.sep+'lpc');
const wpcpath = exobpath.replace('ExoBuilder', 'LPC'+path.sep+'wpc');
const icopath = (fs.existsSync("resources/libs")) ? "./resources/libs/Ex0sArc4d3P1C" : "./libs/Ex0sArc4d3P1C";
const webprefs = {
    sandbox: false,
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: true,
    contextIsolation: false,
    devTools: isDevApp
};

const createWindow = () => {
    const win = new BrowserWindow({
        width: 950,
        height: 600,
        minWidth: 520,
        minHeight: 500,
        icon: icopath + ".png",
        webPreferences: webprefs
    });
    // win.webContents.session.setProxy({
    //     proxyRules: `dns:${['8.8.8.8', '8.8.4.4'].join(',')}` //, '1.1.1.1', '1.0.0.1'
    // });
    
    (!process.env.APP_DEV || (process.env.APP_DEV.trim() != "true")) && win.removeMenu();
    win.webContents.setWindowOpenHandler(({ url }) => {
        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                frame: false,
                fullscreenable: false,
                backgroundColor: 'black',
                webPreferences: webprefs
            }
        };
    });

    win.loadFile('index.html');

    return win;
};
function convertAppVer(appVersion) {return Number(appVersion.substr(0, appVersion.indexOf(".")+1)+appVersion.substr(appVersion.indexOf(".")+1, appVersion.length).replaceAll('.', ''));}

function liveProcess (command, arguments, datacb, errcb) {
    let spawn = child_process.spawn;
    let bat = spawn(command, (arguments ?? "").split(" "));
    let out = "";
    bat.stdout.on("data", (data) => {
        out += data;
        if (typeof datacb === "function") datacb(data, ()=>bat.kill("SIGTERM"));
    });
    bat.stderr.on("data", (err) => {
        out += err;
        if (typeof errcb === "function") errcb(err, ()=>bat.kill("SIGTERM"));
    });

    return [()=>bat.kill("SIGTERM"), new Promise((resolve, reject) => {
        bat.on("exit", (code) => {
            resolve([code, out]);
        });
        bat.on("error", (e)=>{
            resolve([false, e]);
        });
    })];
}

// Shop functions

function getFiles(dir, files = [], filterOut = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        if (filterOut.includes(file)) return [];
    }
    for (const file of fileList) {
        const name = `${dir}/${file}`;
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files, filterOut);
        } else {
            files.push(name);
        }
    }
    return files;
}
function loadSources(sources, formats, req, localOnly) {
    var list = [];
    var grps = {};
    var protocol = req.urldata.protocol;
    var host = req.urldata.host;
    for (var src of sources) {
        if (src.active === 0) continue;
        var dir = src.source;
        var resp = /* isURL(dir, ["http", "https"])
            ? fetchSync(dir).json()
            : */ getFiles(dir, undefined, ["downloading"]);
        //if (isURL(dir, ["http", "https"]) && localOnly) continue;
        for (var file of resp) {
            var convertedFile;
            if (typeof file === "string") {
                const stat = fs.statSync(file);
                const fmtime = new Date(stat.mtimeMs).toString().split(" ") ?? [
                    "Thu",
                    "Jan",
                    "01",
                    "1970",
                    "00:00:00",
                    "UTC",
                ];
                convertedFile = {
                    name: protocol + "//" + host + "/" + file,
                    type: "file",
                    size: stat.size,
                    mtime: `${fmtime[0]}, ${fmtime[2]} ${fmtime[1]} ${fmtime[3]} ${fmtime[4]} ${fmtime[5]}`,
                };
            } else if (typeof file === "object" && !Array.isArray(file)) {
                convertedFile = {
                    name: file.name ?? file.url,
                    type: file.type ?? "file",
                    size: file.size ?? 0,
                    mtime: file.mtime ?? file.edit ?? `Thu, 01 Jan 1970 00:00:00 UTC`,
                };
            }
            if (typeof convertedFile != "object") {
                console.error("File != STRING || JSON_OBJECT");
                continue;
            }
            var fileExt = convertedFile.name.substr(
                convertedFile.name.lastIndexOf(".") + 1
            );
            if (Array.isArray(formats) && !formats.includes(fileExt)) continue;
            list.push(convertedFile);
            if (typeof src.group === "string") {
                grps[src.group] ??= [];
                grps[src.group].push(convertedFile);
            }
        }
    }
    return JSON.stringify({ res: list, grps: grps });
}

if (app) {
    ipcMain.on("clearappdata", (event, message) => {
        const appName = app.getName();
        const appDataPath = path.join(app.getPath('appData'), appName);
        var cp = child_process;
        var child;
        if (process.platform === "win32") {
            child = cp.spawn('rmdir', ["/S", "/Q", appDataPath], { detached: true, shell: true });
        } else {
            child = cp.spawn('rm', ["-rf", appDataPath], { detached: true, shell: true });
        }
        child.unref();
        app.relaunch();
        app.exit();
    });
    ipcMain.on("restart", (event, message) => {
        app.relaunch();
        app.exit();
    });
    ipcMain.on('setWindowProgress', (event, message) => {
        if (Number(message) == 0) message = "0.01";
        return global.mainWindow && global.mainWindow.setProgressBar(Number(message));
    });
    ipcMain.on('checkForUpdates', async (event, message) => {
        let appVersion = app.getVersion();
        var version = convertAppVer(appVersion);
        let data = await https.get("https://api.github.com/repos/Xarber/exobuilder-gui/releases").then(r=>r.json());
        const ext = (process.platform === 'win32') ? ".exe" : ".zip";
        global.releases = data.reduce((arr, release) => {
          release.assets
            .map((d) => {
              return d.browser_download_url
            })
            .filter((d) => { return !d.includes('untagged') })
            .filter((d) => d.endsWith(ext))
            .forEach((url) => {
              if (!url.endsWith("-delta.exe") && !url.includes("-Setup")) {
                arr.push({ version: release.tag_name, url });
              }
            });
          return arr;
        }, []);
        if (convertAppVer(global.releases[0].version) > appVersion) {
            global.updAvailable = true;
            global.mainWindow.webContents.send('updateAvailable', global.releases[0].version);
        }
    });
    ipcMain.on('updateNow', (event, message) => {
        if (isDevApp) return false;
        return false;
        //Updating is yet to be implemented
        var oldVersions = [];
        fs.readdirSync("../").forEach(e=>{if (e.indexOf('app-') === 0 && e != "app-"+app.getVersion()) oldVersions.push(e)});
        dialog.showMessageBoxSync({
            message: oldVersions.join(", ")
        });
        oldVersions.forEach(e=>fs.rmSync("../"+e));
        fs.copyFileSync("../app-"+app.getVersion(), "../app-"+message);
    });
    ipcMain.handle('linktgaccount', async (e, message)=>{
        message.prompt = (text) =>{
            return new Promise(function(resolve, reject) {
                ipcMain.once('promptreply', (e, t)=>resolve(t));
                global.mainWindow.webContents.send("prompt", text);
            });
        };
        const apiId = Number(message.api_id ?? await message.prompt('Please enter your API ID: '));
        const apiHash = message.api_hash ?? await message.prompt('Please enter your API HASH: ');
        const stringSession = new StringSession("");
        const client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 5,
        });
        await client.start({
            phoneNumber: async () => await message.prompt("Please enter your number: "),
            password: async () => await message.prompt("Please enter your password: "),
            phoneCode: async () => await message.prompt("Please enter the code you received: "),
            onError: (err) => console.log(err),
        });
        return JSON.stringify([client.session.save(), {apiId, apiHash}]);
    });
    ipcMain.on('downloadTGame', async (e, message)=>{
        const apiId = Number(message.api_id);
        const apiHash = message.api_hash;
        const client = new TelegramClient(new StringSession(message.api_token), apiId, apiHash, {
            connectionRetries: 5,
        });
        await client.start({
            onError: (err) => console.log(err),
        });
        let WebTorrent, WTClient, TCType;
        try {
            WebTorrent = (await import("webtorrent")).default;
            WTClient = new WebTorrent({logLevel: 'DEBUG'});
            TCType = "wt";
        } catch(e) {
            console.error("Failed to import torrent library! Using Linux CLI method instead");
            TCType = "cli";
        }
        async function sendMessageToExternalBot(botUsername, message) {
            const result = await client.sendMessage(botUsername, { message: message });
            console.log("Message sent:", botUsername, result.message);
            global.lastSentMessage = result.message;
        }
        const usermsg = message;
        const bot = "Switch_library_bot";
        client.addEventHandler(async (event) => {
            const message = event.message;
            if (message && message.media && message.media.document) {
                const fileId = message.media.document.id;
                const fileUrl = await client.downloadMedia(message.media, { workers: 1 });
            
                // Download the file
                let torrentPath = "./content/" + global.lastSentMessage.replaceAll(" ", "_").replace(/[<>:"/\\|?*]/g, "") + ".torrent";
                fs.writeFileSync(torrentPath, fileUrl);
                var torrentDownloadPath = `./downloads/${torrentPath.replace("./content/", "").replace(".torrent", "")}`;
                if (!fs.existsSync(torrentDownloadPath)) fs.mkdirSync(torrentDownloadPath);
                if (!fs.existsSync(torrentDownloadPath + "/downloading") || fs.readFileSync(torrentDownloadPath + "/downloading", "utf8") != process.pid.toString()) {
                    if (TCType == "wt") 
                        WTClient.add(torrentPath, (torrent) => {
                            console.log("Client is downloading:", torrent.name);
                            fs.writeFileSync(
                                torrentDownloadPath + "/downloading",
                                process.pid.toString()
                            );
                    
                            torrent.on("done", () => {
                                console.log("Download complete");
                                var newtorrentDownloadPath = torrentDownloadPath.replace(torrentPath
                                .replace("./content/", "")
                                .replace(".torrent", ""), torrent.name);
                                fs.rmSync(torrentDownloadPath + "/downloading");
                                if (fs.existsSync(newtorrentDownloadPath)) fs.rmSync(newtorrentDownloadPath, {force: true});
                                fs.renameSync(torrentDownloadPath, newtorrentDownloadPath);
                                global.mainWindow.webContents.send('updateTDP', JSON.stringify({name: torrent.name, speed: false, progress: false, complete: true}));
                            });
    
                            torrent.on('download', bytes=>{
                                global.mainWindow.webContents.send('updateTDP', JSON.stringify({name: torrent.name, speed: torrent.downloadSpeed, progress: torrent.progress, complete: false}));
                            });
                    
                            torrent.files.forEach((file) => {
                                const source = file.createReadStream();
                                const destination = fs.createWriteStream(
                                `${torrentDownloadPath}/${file.name}`
                                );
                                source.pipe(destination);
                            });
                        });
                    if (TCType == "cli") {
                        if (!fs.existsSync("usr")) {
                            await liveProcess("apt-get", "download transmission-cli")[1];
                            for (var e of fs.readdirSync(".")) { 
                                if (e.indexOf('transmission-cli_') != -1) {
                                    await liveProcess("dpkg", "-x "+e+" .")[1];
                                    await liveProcess("rm", e)[1];
                                    break;
                                }
                            }
                        }
                        let torrentName = "";
                        await liveProcess("./usr/bin/transmission-show", torrentPath, (output, kill)=>{
                            output = output.toString().split("\n");
                            for (var out of output) {
                                if (out.indexOf('  Name: ') != -1 && torrentName.length < 1) {
                                    torrentName = out.replace('  Name: ', '');
                                    global.mainWindow.webContents.send('updateTDP', JSON.stringify({name: torrentName, speed: undefined, progress: undefined, complete: false}));
                                    kill();
                                    break;
                                }
                            }
                        })[1]
                        console.log("Client is downloading:", torrentName);
                        fs.writeFileSync(
                            torrentDownloadPath + "/downloading",
                            process.pid.toString()
                        );
                        await liveProcess("./usr/bin/transmission-cli", torrentPath+" -w downloads", (output, kill)=>{
                            output = output.toString().split("\n\r");
                            for (var out of output) {
                                out = out.split("\r")[out.split("\r").length - 2] ?? out.split("\r")[out.split("\r").length - 1];
                                if (out.indexOf('Seeding,') != -1) {
                                    console.log("Download complete");
                                    global.mainWindow.webContents.send('updateTDP', JSON.stringify({name: torrentName, speed: false, progress: false, complete: true}));
                                    fs.rmSync(torrentDownloadPath + "/downloading");
                                    fs.rmdirSync(torrentDownloadPath);
                                    kill();
                                }
                                if (out.indexOf('Progress:') === 0) {
                                    global.mainWindow.webContents.send('updateTDP', JSON.stringify({
                                        name: torrentName,
                                        speed: out.toString().substring(out.indexOf('(') + 1, out.indexOf(')')),
                                        progress: Number(out.toString().substring(10, out.indexOf('%'))) / 100,
                                        complete: Number(out.toString().substring(10, out.indexOf('%'))) / 100 >= 1
                                    }));
                                }
                            }
                        })[1]
                    }
                }
            } else if (typeof message === "string" && message.indexOf("/download") != -1) {
                var arr = message.split("\n");
                var downloadcount = 0;
                for (var line of arr) {
                    if (line.indexOf("/download") == -1 || downloadcount > 9) continue;
                    var downloadCommand = line.substr(line.indexOf("/download"));
                    downloadCommand = downloadCommand.substr(
                        0,
                        downloadCommand.indexOf(" ")
                    );
                    console.log(downloadCommand);
                    downloadcount++;
                    await sendMessageToExternalBot(bot, downloadCommand);
                }
            }
        });
        if (!fs.existsSync("content")) fs.mkdirSync("content");
        if (!fs.existsSync("downloads")) fs.mkdirSync("downloads");
        await sendMessageToExternalBot(
            bot,
            message.query
        );
    });
    ipcMain.handle('dialog:openDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        })
        return (canceled ? undefined : filePaths[0]);
    });

    app.whenReady().then(async () => {
        global.mainWindow = createWindow();

        mainWindow.on("close", (e)=>{
            if (!app.isQuitting) {
                e.preventDefault();
                mainWindow.hide();
            }
            return false;
        });
        var appIcon = null;
        appIcon = new Tray(icopath+".png");
        var contextMenu = Menu.buildFromTemplate([
            { label: 'Show App', click: ()=>{mainWindow.show()} },
            { label: 'Quit App', click: ()=>{
                app.isQuitting = true;
                app.quit();
            } }
        ]);
        appIcon.setToolTip('ExoBuilder');
        appIcon.setContextMenu(contextMenu);

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
    
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    // Tinfoil Server
    (async()=>{
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
        require('http').createServer(apphttp).listen(server.port.http, undefined, ()=>{console.log('Tinfoil HTTP Server Running on Port `'+server.port.http+'`!', server.ip, server.pubip, 'localhost')});
        if (!!server.certs.key && !!server.certs.cert) https.createServer(server.certs, apphttps).listen(server.port.https, undefined, ()=>{console.log('HTTPS Support Enabled on Port `'+server.port.https+'`!')});
    })();

    // app.on('certificate-error', (e)=>{
    //     e.preventDefault();
    //     return false;
    // });
}
module.exports = {
    isDev: isDevApp,
    https: https,
    lpcpath: lpcpath,
    wpcpath: wpcpath,
    ExoBuilder: async (arguments)=>{
        let outpromise = new Promise((resolve, reject) => {
            let spawn = child_process.spawn;
            let bat = spawn(exobpath, (arguments ?? "").split(" "));
            let out = {
                out: "",
                err: "",
                exitcode: 0
            };
            bat.stdout.on("data", (data) => {
                out.out += data + "\n";
            });
            bat.stderr.on("data", (err) => {
                out.err += err + "\n";
            });
            bat.on("exit", (code) => {
                out.exitcode = code;
                resolve(out);
            });
        });
        return outpromise;
    },
    liveProcess: liveProcess
}