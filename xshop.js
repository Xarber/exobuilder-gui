const cluster        = require("cluster");
if (!cluster.isPrimary) {console.tmpLog = console.log;console.log = function(){};process.removeAllListeners('warning');}
console.log('Importing modules...');
const {performance}  = require("perf_hooks");
const https          = require("https");
const http           = require("http");
const url            = require("url");
const path           = require("path");
const fs             = require("fs");
const util           = require("util");
const crypto         = require("crypto");
const zlib           = require("zlib");
const {IncomingForm} = require("formidable");
const request        = require("request");
const {lookpath}     = require("lookpath");
const child_process  = require("child_process");
const process        = require("process");
const QRCode         = require("qrcode");
const OTPAuth        = require("otpauth");
const deasync        = require("deasync");
const base32         = require("hi-base32");
const os             = require("os");
let    peerjs       = false;
let    websocket    = false;
try {
    peerjs = require("peer");
} catch (e) {
    console.log("* To create a PeerServer, install the peer module (npm i peer)", e);
}
try {
    websocket = require("ws");
} catch (e) {
    console.log("* To create a WebSocket Server, install the ws module (npm i ws)", e);
}
const startXShop = (async()=>{
    const publicIpv4     = (await import("public-ip")).publicIpv4;

    console.log('Creating environment variables...');
    const //__filename    = path.normalize(url.fileURLToPath(import.meta.url)),
          //__dirname     = path.dirname(__filename),
          numCPUs       = os.cpus().length;
          cluster.schedulingPolicy = cluster.SCHED_RR;
    var args = {};
    process.argv.forEach(function (val, index, array) {
        args[index] = val;
        if (val == "-h") {
            console.log ('N.JS WEB SERVER - HELP\nUsage: node . [arguments]\nValid arguments:\n-s = Silent mode (do not log accesses)\n-l = Live Reload (automatically refresh clients on updates)\n-nil = Non Intrusive Live Reload (prompts user to refresh on updates)\n-t = Performance Timing (Time all the heavier actions made by the server)\n-nlb = No Load Balancing (disable multi-threading)\n-p = Proxy (changes the port to allow reverse proxying)');
            args = false;
        }
        if (val == "-s") {
            console.log ('Silent mode requested!');
            args.silent = true;
        }
        if (val == "-l") {
            console.log ('Live reload requested!');
            args.livereload = true;
        }
        if (val == "-nil") {
            console.log ('Non Intrusive Live reload requested!');
            args.nilivereload = true;
            args.livereload = true;
        }
        if (val == "-t") {
            console.log ('Performance timing requested!');
            args.perftimer = true;
        }
        if (val == "-nlb") {
            console.log ('Load balancing disabled!');
            args.noLoadBalancing = true;
        }
        if (val == "-p") {
            console.log ('Proxy mode requested! Port will be overrided with "22324" (http), "22325" (https).');
            args.proxymode = true;
            //* This is a sample proxy config for nginx, redirecting the NodeJS output to a NGinx served webpage.
    
            // server {
            //     listen 80;
            //     server_name your.server.domain;
            //     location / {
            //         proxy_set_header X-Real-IP $remote_addr;
            //         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            //         Host $http_host;
            //         proxy_set_header X-NginX-Proxy true;
            //         proxy_pass http://127.0.0.1:22324;
            //         proxy_redirect off;
            //     }
            // }
        }
    });
    if (!args) process.exit();
    
    /* ! BEGIN X-SHOP CODE ! */
    console.log('Reading configurations...');
    var settings        = fs.existsSync('data/import/options.json') ? JSON.parse(fs.readFileSync('data/import/options.json', {encoding: 'utf-8'}).replace(/\/\*[\s\S]*?\*\/|(?<=[^:])\/\/.*|^\/\/.*/g,'').trim()) : {};
    settings['log_accesses']   ??= 1;
    settings['sources']        ??= 1;
    settings['modes']          ??= 1;
    settings['groups']         ??= 1;
    settings['saves']          ??= 1;
    settings['shp_ttl']        ??= 1;
    settings['lckdwn']         ??= 1;
    settings['allow_web_part'] ??= 1;
    settings['allow_uploads']  ??= 1;
    settings['auth_users']     ??= 0;
    settings['max_devs']       ??= 3;
    settings['admin_key']      ??= 0;
    /* ! END X-SHOP CODE ! */
    
    async function loadSettings() {
        var server = {
            ip: await publicIpv4(),
            port: (!!args.proxymode) ? {http: 22324, https: 22325} : {http: 80, https: 443},
            certs: {key: (fs.existsSync('./certs/key.pem') ? fs.readFileSync('./certs/key.pem') : false), cert: (fs.existsSync('./certs/cert.pem') ? fs.readFileSync('./certs/cert.pem') : false)},
            filetypes: {
                "default": "application/octet-stream",
                "html": "text/html",
                "htm": "text/html",
                "php": "text/html",
                "njs": "text/html",
                "js": "text/javascript",
                "json": "application/json",
                "css": "text/css",
                "txt": "text/plain",
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "ico": "image/vnd.microsoft.icon"
            },
            protected: ["private/"],
            protectedOverrideIPs: ["::1"],
            root: "/HTML",
            tries: ["$FN", "$FN.njsc", "$FN.html", "$FN.php", "$FN.njs", "/$FN", "/$FN.njsc", "/$FN.html", "/$FN.php", "/$FN.njs", "/$FN/index.njsc", "/$FN/index.html", "/$FN/index.php", "/$FN/index.njs", "/index.njsc", "/index.html", "/index.php", "/index.njs"],
            rules: fs.existsSync('./private/server/rules.json') ? JSON.parse(fs.readFileSync('./private/server/rules.json')) : {},
            systemRoot: ((process.platform == "win32") ? process.cwd().split(path.sep)[0] : "/"),
            uploads: {
                path: "/upload",
                destination: "uploads/",
                handler: false,
                filter: false,
                postScript: false,
                maxSize: 1024 * 1024 * 1024,
                ids: false
            },
            autoindex: {enable: false},
            headers: {},
            maxHeaderSize: 536870912,
            errors: {},
            proxy_pass: false,
            availableFunctions: {
                php: (await lookpath('php') != undefined),
                loadBalancing: !args.noLoadBalancing
            }
        };
        if (fs.existsSync('server.cfg')) server = {...server, ...(JSON.parse(fs.readFileSync('server.cfg')))};
        if (!!server.rules.hosts && !!server.rules.hosts.default) server = {...server, ...server.rules.hosts.default};
        const originalServer = server;
        server.tries.push(server.root + "$FN", server.root + "/$FN");
    
        var publicServer = {
            ip: server.ip,
            port: server.port,
            root: server.root,
            rules: server.rules,
            systemRoot: ((process.platform == "win32") ? process.cwd().split(path.sep)[0] : "/"),
            uploads: server.uploads,
            settings: settings // X-SHOP LINE
        };
        return {server, originalServer, publicServer};
    }
    var tmps = await loadSettings();
    global.server = tmps.server;
    const originalServer = tmps.originalServer;
    global.publicServer = tmps.publicServer;
    tmps = undefined;
    if (!!server.availableFunctions.php && !!cluster.isPrimary) console.log('PHP is installed and PATH is configured! Support for PHP was enabled.');
    
    console.log('Defining functions...');
    fs.dirSize = async (dirPath)=>{
        let size = 0;
        const files = await fs.readdir(dirPath);
      
        for (let i = 0; i < files.length; i++) {
            const filePath = path.join(dirPath, files[i]);
            const stats = await fs.stat(filePath);
      
            if (stats.isFile()) {
                size += stats.size;
            } else if (stats.isDirectory()) {
                size += await fs.dirSize(filePath);
            }
        }
        return size;
    }
    fs.dirSizeSync = (dirPath)=>{
        let size = 0;
        const files = fs.readdirSync(dirPath);
      
        for (let i = 0; i < files.length; i++) {
            const filePath = path.join(dirPath, files[i]);
            const stats = fs.statSync(filePath);
      
            if (stats.isFile()) {
                size += stats.size;
            } else if (stats.isDirectory()) {
                size += fs.dirSizeSync(filePath);
            }
        }
        return size;
    };
    fs.cleardirSync = (dirPath)=>{
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(function(file, index) {
                var curPath = dirPath + "/" + file;
                if(fs.lstatSync(curPath).isDirectory()) {
                    fs.cleardirSync(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dirPath);
        }
    }
    fs.cleardir = fs.cleardirSync;
    function getFiles(dir, removeOriginalDir, files = [], originalDir) {
        var originalDir = originalDir ?? dir;
        const fileList = fs.readdirSync(dir);
        for (const file of fileList) {
            const name = `${dir}/${file}`;
            if (fs.statSync(name).isDirectory()) {
                getFiles(name, removeOriginalDir, files, originalDir);
            } else {
                files.push(removeOriginalDir ? name.replace(originalDir, '') : name);
            }
        }
        return files;
    }
    function getFilesInfo(dir, removeOriginalDir, files = [], originalDir) {
        var originalDir = originalDir ?? dir;
        const fileList = fs.readdirSync(dir);
        for (const file of fileList) {
            const name = `${dir}/${file}`;
            var stat = fs.statSync(name);
            var giveStat = {
                type: stat.isDirectory() ? "dir" : "file",
                name: name.split('/')[name.split('/').length - 1],
                location: name.slice(0, name.lastIndexOf('/') + 1).replace('//', '/'),
                path: name.replace('//', '/'),
                size: stat.size,
                formattedSize: formatBytes(stat.size),
                created: stat.birthtimeMs,
                modified: stat.mtimeMs
            }
            if (giveStat.type == "dir") {
                if (fs.readdirSync(name).length === 0) {
                    giveStat.location = removeOriginalDir ? giveStat.location.replace(originalDir, '') : giveStat.location;
                    giveStat.path = removeOriginalDir ? giveStat.path.replace(originalDir, '') : giveStat.path;
                    files.push(giveStat);
                } else getFilesInfo(name, removeOriginalDir, files, originalDir);
            }
            if (giveStat.type == "file") {
                giveStat.location = removeOriginalDir ? giveStat.location.replace(originalDir, '') : giveStat.location;
                giveStat.path = removeOriginalDir ? giveStat.path.replace(originalDir, '') : giveStat.path;
                files.push(giveStat);
            }
        }
        return files.sort((a, b)=>{
            if (a.location.split('/').length > b.location.split('/').length) return 1;
            if (a.location.split('/').length < b.location.split('/').length) return -1;
            if (a.location.length > b.location.length) return 1;
            if (a.location.length < b.location.length) return -1;
            return 0;
        });
    }
    function filterFileList(list, method = 1) {
        var structure = {
            dirs: {},
            files: {}
        }
        var filtered = JSON.parse(JSON.stringify(structure));
    
        if (method === 2) for (var e of list) {
            if (e.type === "dir") {
                var str = "";
                for (var fd of e.path.split('/')) {
                    str += fd + "/";
                    str = str.replaceAll('//', '/');
                    filtered.dirs[str] ??= structure;
                }
            } else {
                if (e.location === "") {filtered.files[e.name] = e;continue}
                var str = "";
                for (var fd of e.location.split('/')) {
                    str += fd + "/";
                    str = str.replaceAll('//', '/');
                    filtered.dirs[str] ??= structure;
                }
                filtered.dirs[e.location].files[e.name] = e;
            }
        }
        if (method === 1) for (var e of list) {
            if (e.type === "dir") {
                var newDir = structure;
                var command = `(out, start)=>{\nstart ??= {dirs: {}, files: {}};\n$INSERTLOC;\nout(start);\n}`;
                var oldConsecutiveFolders = "start";
                for (var fd of e.path.split('/')) {
                    fd = fd.replaceAll('"', '\\"');
                    command = command.replace('$INSERTLOC', oldConsecutiveFolders + `.dirs["${fd}"] ??= {dirs: {}, files: {}};\n$INSERTLOC`);
                    oldConsecutiveFolders+=`.dirs["${fd}"]`;
                }
                command = command.replaceAll('$INSERTLOC', '');
                console.log(command);
                eval(command)((e)=>{filtered = e}, filtered);
            } else {
                if (e.location === "") {filtered.files[e.name] = e;continue}
                var newDir = structure;
                var command = `(out, start)=>{\nstart ??= {dirs: {}, files: {}};\n$INSERTLOC;\nout(start);\n}`;
                var oldConsecutiveFolders = "start";
                for (var fd of e.location.slice(0, e.location.length - 1).split('/')) {
                    fd = fd.replaceAll('"', '\\"');
                    command = command.replace('$INSERTLOC', oldConsecutiveFolders + `.dirs["${fd}"] ??= {dirs: {}, files: {}};\n$INSERTLOC`);
                    oldConsecutiveFolders+=`.dirs["${fd}"]`;
                }
                command = command.replace('$INSERTLOC', oldConsecutiveFolders+`.files["${e.name.replaceAll('"', '\\"')}"] = ${JSON.stringify(e)}`);
                console.log(command);
                eval(command)((e)=>{filtered = e}, filtered);
            }
        }
        console.log(filtered);
        return filtered;
    }
    function isURL(s, protocols) {
        try {
            const parsed = new url.URL(s);
            return protocols
                ? parsed.protocol
                    ? protocols.map(x => `${x.toLowerCase()}:`).includes(parsed.protocol)
                    : false
                : true;
        } catch (err) {
            return false;
        }
    }
    function matchesRule(str, rule) {
        //ciao.hey matches rule *hey, *.hey etc; ciao.hey.hello respects *hey*, *.hey.* etc.
        if (typeof str != "string" || typeof rule != "string") return false;
        var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
        return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
    }
    function makeid(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
          counter += 1;
        }
        return result;
    }
    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    }
    function mergeString(s1, s2) {
        let result = "";
        for (let i = 0; i < s1.length || i < s2.length; i++) {
            if (i < s1.length) result += s1.charAt(i);
            if (i < s2.length) result += s2.charAt(i);
        }
        return result;
    }
    function log(file, content) {
        if (!fs.existsSync('server.log')) fs.writeFileSync('server.log', '', 'utf8');
        fs.appendFileSync('server.log', new Date()+' | '+file+' | '+content+'\n', 'utf8');
        if (fs.existsSync(file)) return fs.appendFileSync(file, content+"\n", 'utf8');
        return fs.writeFileSync(file, content+"\n", 'utf8');
    }
    function getAllBetween(str, ch1, ch2) {
        var result = [];
        if (!ch1) return [str];
        if (!ch2) return [str.slice(str.indexOf(ch1) + ch1.length)];
        while (str.indexOf(ch1) != -1) {
            var ch1i = str.indexOf(ch1);
            var ch2i = str.indexOf(ch2);
            if (ch1 === ch2) ch2i = str.replace(ch1, '').indexOf(ch2);
            if (ch2i === -1) {
                var tmp = str.slice(ch1i + ch1.length);
                result.push(tmp);
                str = str.replace(ch1+tmp, '');
                break;
            }
            var tmp = str.slice(ch1i + ch1.length, ch2i);
            if (ch2.length === 1) var tmp = str.slice(ch1i + ch1.length, ch2i + 1);
            result.push(tmp);
            str = str.replace(ch1+tmp+ch2, '');
        }
        return result;
    }
    function timeSince(date) {
        var seconds = Math.floor((new Date() - date) / 1000);
        var interval = seconds / 31536000;
        if (interval > 1) {
            return Math.floor(interval) + " years";
        }
        interval = seconds / 2592000;
        if (interval > 1) {
            return Math.floor(interval) + " months";
        }
        interval = seconds / 86400;
        if (interval > 1) {
            return Math.floor(interval) + " days";
        }
        interval = seconds / 3600;
        if (interval > 1) {
            return Math.floor(interval) + " hours";
        }
        interval = seconds / 60;
        if (interval > 1) {
            return Math.floor(interval) + " minutes";
        }
        return Math.floor(seconds) + " seconds";
    }
    function timeFromNow(str, date = new Date()) {
        str = str.split(" ");
        for (var elem of str) {
            if (elem.slice(-1) === "y") {date.setYear(date.getUTCFullYear() + Number(elem.slice(0, elem.length - 1)))}
            if (elem.slice(-1) === "M") {date.setMonth(date.getMonth() + Number(elem.slice(0, elem.length - 1)))}
            if (elem.slice(-1) === "w") {date.setDate(date.getDate() + (Number(elem.slice(0, elem.length - 1)) * 7))}
            if (elem.slice(-1) === "d") {date.setDate(date.getDate() + Number(elem.slice(0, elem.length - 1)))}
            if (elem.slice(-1) === "h") {date.setHours(date.getHours() + Number(elem.slice(0, elem.length - 1)))}
            if (elem.slice(-1) === "m") {date.setMinutes(date.getMinutes() + Number(elem.slice(0, elem.length - 1)))}
            if (elem.slice(-1) === "s") {date.setSeconds(date.getSeconds() + Number(elem.slice(0, elem.length - 1)))}
            
        }
        return date;
    }
    function devTypeSync(nav = navigator) {
        var device = "Unknown";
        var type1 = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent) ? 'Mobile' : 'PC';
        device = type1;
        if (nav.userAgent.indexOf('Nintendo') != -1 || nav.userAgent.indexOf('Xbox') != -1) device = "Console";
        if (nav.userAgent.indexOf('VR') != -1) device = "VR";
        if (nav.userAgent.indexOf('PlayStation') != -1) device = "PlayStation";
        if (nav.userAgent.indexOf('Nintendo Switch') != -1) device = "Nintendo Switch";
        if (nav.userAgent.indexOf('Xbox One') != -1) device = "Xbox One";
        if (nav.userAgent.indexOf('Xbox Series X') != -1) device = "Xbox Series X";
        if (nav.userAgent.indexOf('Xbox Series S') != -1) device = "Xbox Series S";
        if (type1 === "PC" && device == type1)  {
            try {
                nav.getBattery().then(function(battery) {
                    if (battery.charging && battery.chargingTime === 0) {
                        device = "Desktop";
                    } else {
                        device = "Laptop";
                    }
                });
            }catch(e){}
        }
        if (type1 === "Mobile") {
            if(/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(nav.userAgent.toLowerCase())) device = "Tablet";
            if (nav.userAgent.indexOf('TV') != -1) device = "TV";
            if (nav.userAgent.indexOf('Watch') != -1 || nav.userAgent.indexOf('Wear') != -1) device = "Watch";
        }
        return device;
    }
    async function devType(nav = navigator) {
        var device = "Unknown";
        var type1 = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent) ? 'Mobile' : 'PC';
        device = type1;
        if (nav.userAgent.indexOf('Nintendo') != -1 || nav.userAgent.indexOf('Xbox') != -1) device = "Console";
        if (nav.userAgent.indexOf('VR') != -1) device = "VR";
        if (nav.userAgent.indexOf('PlayStation') != -1) device = "PlayStation";
        if (nav.userAgent.indexOf('Nintendo Switch') != -1) device = "Nintendo Switch";
        if (nav.userAgent.indexOf('Xbox One') != -1) device = "Xbox One";
        if (nav.userAgent.indexOf('Xbox Series X') != -1) device = "Xbox Series X";
        if (nav.userAgent.indexOf('Xbox Series S') != -1) device = "Xbox Series S";
        if (type1 === "PC" && device == type1)  {
            try {
                var battery = await nav.getBattery();
                if (battery.charging && battery.chargingTime === 0) {
                    device = "Desktop";
                } else {
                    device = "Laptop";
                }
            }catch(e){}
        }
        if (type1 === "Mobile") {
            if(/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(nav.userAgent.toLowerCase())) device = "Tablet";
            if (nav.userAgent.indexOf('TV') != -1) device = "TV";
            if (nav.userAgent.indexOf('Watch') != -1 || nav.userAgent.indexOf('Wear') != -1) device = "Watch";
        }
        return device;
    }
    function devTypeSlow(nav = navigator) {
        var device = "Unknown";
        var type1 = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent) ? 'Mobile' : 'PC';
        device = type1;
        if (nav.userAgent.indexOf('Nintendo') != -1 || nav.userAgent.indexOf('Xbox') != -1) device = "Console";
        if (nav.userAgent.indexOf('VR') != -1) device = "VR";
        if (nav.userAgent.indexOf('PlayStation') != -1) device = "PlayStation";
        if (nav.userAgent.indexOf('Nintendo Switch') != -1) device = "Nintendo Switch";
        if (nav.userAgent.indexOf('Xbox One') != -1) device = "Xbox One";
        if (nav.userAgent.indexOf('Xbox Series X') != -1) device = "Xbox Series X";
        if (nav.userAgent.indexOf('Xbox Series S') != -1) device = "Xbox Series S";
        if (type1 === "PC" && device == type1)  {
            try {
                var battery = false;
                nav.getBattery().then((b)=>{battery = b});
                Math.random() * Math.random();
                device = (battery.charging && battery.chargingTime === 0 && battery.level === 1) ? "Desktop" : "Laptop";
            }catch(e){}
        }
        if (type1 === "Mobile") {
            if(/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(nav.userAgent.toLowerCase())) device = "Tablet";
            if (nav.userAgent.indexOf('TV') != -1) device = "TV";
            if (nav.userAgent.indexOf('Watch') != -1 || nav.userAgent.indexOf('Wear') != -1) device = "Watch";
        }
        return device;
    }
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes'
        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }
    function recursiveExists(string, createIfMissing) {
        string = (string.indexOf('./') == 0) ? string.replace('./', '/') : string;
        string = (string.indexOf('/') == 0) ? string.replace('/', '') : string;
        var dirs = (string.match(/\//g) || []).length;
        var tmpstring = "";
        var exists = true;
        for (let i = 0;i < dirs;i++) {
            var dir = string.replace(tmpstring, "").slice(0, string.replace(tmpstring, "").indexOf('/') + 1);
            var toCheckPath = tmpstring+dir;
            if (!fs.existsSync('./'+toCheckPath)) {
                if (!!createIfMissing) fs.mkdirSync('./'+toCheckPath);
                if (!createIfMissing) {
                    exists = false;
                    break;
                }
            }
            tmpstring += dir;
        }
        return exists;
    }
    function runPHP(path, params) {
        if (!path || path.toString().length < 1) {
            console.error('Error in Running PHP! No file was defined!');
            return "";
        }
        path = path.toString();
        if (!server.availableFunctions.php || path.slice(path.lastIndexOf('.') + 1, path.length).toLowerCase() != "php") return fs.readFileSync(path, 'utf8');
        var output = child_process.execSync("php " + path + " " + params).toString();
        return output;
    }
    function execNodeCode(input, reqPath, ...arg) {
        var nodeScriptFile = (!!reqPath && reqPath.slice(reqPath.lastIndexOf('.') + 1) === "njs");
        if (input.indexOf('<?nodejs') == -1 && !nodeScriptFile) return input;
        var occ = nodeScriptFile ? [input] : getAllBetween(input, '<?nodejs', '?>');
        var results = {};
        for (var i = 0;i < occ.length;i++) {
            var oc = occ[i];
            results[i] ??= [];
            var handleError = true;
            try {
                eval(`((echo, loadFile, handleException, loadModule, safeData, ...otherargs) => { ${oc} })`)((...args) => {results[i].push(util.format(...args))}, (file, encoding = 'utf8')=>{return execNodeCode(fs.readFileSync(file, encoding), file, ...arg);}, (state)=>{handleError = state}, loadModule, safeData, ...arg);
            } catch (e) {
                if (!!handleError) console.error('Error in Node Code, on file "'+reqPath+'":', e);
                if (!handleError) throw new Error(e);
            }
        }
        for (var i = 0;i < occ.length;i++) {
            var r = (!!results[i] ? results[i].join('') : "");
            var o = occ[i];
            if (!results[i]) {continue;}
            if (nodeScriptFile) {
                input = r;
            } else if (input.indexOf('?>') != -1) {
                input = input.replace('<?nodejs'+o+'?>', r);
            } else {
                input = input.replace('<?nodejs'+o, r);
            }
        }
        return input;
    }
    function loadModule(path, insert, insertObj, ...args) {
        var file = !!server.availableFunctions.php ? runPHP(path) : fs.readFileSync(path, 'utf8');
        if (!insert || insert.length < 1) insert = [""];
        if (!Array.isArray(insert)) insert = [insert];
        var count = 0;
        while (file.indexOf('<$moduleInsert>') != -1) {
            file = file.replace('<$moduleInsert>', insert[count] ?? "");
            ++count;
        }
        count = 0;
        if (insertObj && file.indexOf('<$moduleInsert ') != -1) {
            var insertPositions = getAllBetween(file, "<$moduleInsert ", " end$>");
            for (var pos of insertPositions) {
                file = file.replace("<$moduleInsert "+pos+" end$>", insertObj[pos] ?? "");
            }
        }
        return execNodeCode(file, path, ...args);
    }
    function getQR(text, type = "base64") {
        var resp = false;
        if (type === "text") {
            QRCode.toString(text, function (err, url) {
                resp = url;
            })
        } else {
            QRCode.toDataURL(text, function (err, url) {
                resp = url;
            })
        }
        while(!resp) {deasync.sleep(100);}
        return resp;
    }
    var crypt = {
        genKey: crypto.randomBytes,
        encrypt: function(text, key, iv) {
            if (!key || key.length < 1) throw new Error("Provide a key!");
            iv ??= crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return {encrypted: encrypted, iv: iv};
        },
        decrypt: function(text, key, iv) {
            if (!key || key.length < 1) throw new Error("Provide a key!");
            if (!iv || iv.length < 1) throw new Error("Provide an IV!");
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            try {
                let decrypted = decipher.update(text, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
            } catch(e) {
                if (e.toString().indexOf("The argument 'encoding' is invalid for data of length") != -1 || e.toString().indexOf('wrong final block length') != -1) return text;
                throw new Error(e);
            }
            return decrypted;
        }
    }
    var compress = {
        compress: function(text) {
            var deflated = zlib.deflateSync(text);
            return deflated.toString('base64');
        },
        decompress: function(text) {
            try {
                var bfr = Buffer.from(text, 'base64');
                return zlib.inflateSync(bfr).toString();
            } catch(e) {return text;}
        }
    }
    var safeData = {
        encode: function(text, key, iv, encrypt) {
            try {
                var encrypted = encrypt ? crypt.encrypt(text, key, iv).encrypted : text;
                return compress.compress(encrypted);
            } catch(e) {
                if (e.toString().indexOf('node:internal') != -1) return text;
                throw new Error(e.toString());
            }
        },
        decode: function(text, key, iv) {
            try {
                var inflated = compress.decompress(text);
                return crypt.decrypt(inflated, key, iv);
            } catch(e) {
                if (e.toString().indexOf('node:internal') != -1) return text;
                if (e.toString().indexOf('Error: error:1C80006B:Provider routines::wrong final block length') === 0) {
                    try {
                        return compress.decompress(text);
                    } catch(e) {
                        if (e.toString().indexOf('node:internal') != -1) return text;
                        throw new Error(e.toString());
                    }
                } 
                if (e.toString().indexOf('node:internal') != -1) return text;
                throw new Error(e.toString());
            }
        }
    }
    var baseOTP = {
        create: function(secret = base32.encode(crypto.randomBytes(15)).replace(/=/g, "").substring(0, 24), appName = "App", author = "User", time = 30, digits = 6) {
            return {TOTP: new OTPAuth.TOTP({
                issuer: author,
                label: appName,
                algorithm: "SHA1",
                digits: digits,
                period: time,
                secret: secret
            }), secret: secret};
        },
        token: (TOTP)=>{return TOTP.generate()},
        verify: (TOTP, token, window = 1)=>{return (TOTP.validate({token: token, window: window}) != null)},
        URL: (TOTP)=>{return TOTP.toString()},
        parse: (URL)=>{return {TOTP: OTPAuth.URI.parse(URL), secret: OTPAuth.URI.parse(URL).secret}},
        QR: (TOTP, type)=>{return getQR(TOTP.toString(), type)}
    };
    var bparser = {
        returnPropertyEntry: function(arr) {
            if (!Array.isArray(arr)) {return false};
            let propertyName = '';
            let propertyVal = undefined;
            arr.forEach(function(val, index) {
                if (val.includes("name=")) {
                    propertyName = arr[index].split("name=")[1];
                    propertyVal = arr[index + 1]
                }
            })
            return [propertyName, propertyVal];
        },
        returnFileEntry: function(arr) {
            if (!Array.isArray(arr)) {return false};
            let fileName = '';
            let file = undefined;
            arr.forEach(function(val, index) {
                if (val.includes("filename=")) {
                    fileName = arr[index].split("filename=")[1];
                }
                if (val.toLowerCase().includes("content-type")) {
                    file = arr[index + 1];
                }
            })
            return [fileName, file];
        },
        isFile: function(part) {
            if (!Array.isArray(part)) {return false};
            let filenameFound = false;
            let contentTypeFound = false;
            part.forEach(function(val, index) {
                if (val.includes("filename=")) {
                    filenameFound = true;
                }
                if (val.toLowerCase().includes("content-type")) {
                    contentTypeFound = true;
                }
            });
            part.forEach(function(val, index) {
                if (!val.length) {
                    part.splice(index, 1)
                }
            });
            if (filenameFound && contentTypeFound) {
                return part;
            } else {
                return false;
            }
        },
        isProperty: function(part) {
            if (!Array.isArray(part)) {return false};
            let propertyNameFound = false;
            let filenameFound = false;
            part.forEach(function(val, index) {
                if (val.includes("name=")) {
                    propertyNameFound = true;
                }
            });
            part.forEach(function(val,index) {
                if (val.includes("filename=")) {
                    filenameFound = true;
                }
            });
            part.forEach(function(val,index) {
                if (!val.length) {
                    part.splice(index, 1)
                }
            });
            if(propertyNameFound && !filenameFound) {
                return part;
            } else {
                return false;
            }
        }
    }
    
    /* ! BEGIN X-SHOP CODE ! */
    function simcalc(s1, s2) {
        var m = 0;
        if ( s1.length === 0 || s2.length === 0 ) return 0;
        if ( s1 === s2 ) return 1;
        var range = (Math.floor(Math.max(s1.length, s2.length) / 2)) - 1,
            s1Matches = new Array(s1.length),
            s2Matches = new Array(s2.length);
        for ( i = 0; i < s1.length; i++ ) {
            var low  = (i >= range) ? i - range : 0,
                high = (i + range <= s2.length) ? (i + range) : (s2.length - 1);
            for ( j = low; j <= high; j++ ) {
                if ( s1Matches[i] !== true && s2Matches[j] !== true && s1[i] === s2[j] ) {
                    ++m;
                    s1Matches[i] = s2Matches[j] = true;
                    break;
                }
            }
        }
        if ( m === 0 ) return 0;
        var k = n_trans = 0;
        for ( i = 0; i < s1.length; i++ ) {
            if ( s1Matches[i] === true ) {
                for ( j = k; j < s2.length; j++ ) {
                    if ( s2Matches[j] === true ) {
                    k = j + 1;
                    break;
                    }
                }
                if ( s1[i] !== s2[j] ) ++n_trans;
            }
        }
        var weight = (m / s1.length + m / s2.length + (m - (n_trans / 2)) / m) / 3,
            l      = 0,
            p      = 0.1;
        if ( weight > 0.7 ) {
            while ( s1[l] === s2[l] && l < 4 ) {++l;}
            weight = weight + l * p * (1 - weight);
        }
        return weight;
    }
    function loadSources(sources, formats, req, localOnly) {
        var list = [];
        var grps = {};
        var protocol = req.urldata.protocol;
        var host = req.urldata.host;
        for (var src of sources) {
            if (src.active === 0 || (typeof src.active === "string" && !req.query[src.active])) continue;
            var dir = src.source;
            var resp = isURL(dir, ['http', 'https']) ? fetchSync(dir).json() : getFiles(dir);
            if (isURL(dir, ['http', 'https']) && localOnly) continue;
            for (var file of resp) {
                var convertedFile;
                if (typeof file === "string") {
                    const stat = fs.statSync(file);
                    const fmtime = new Date(stat.mtimeMs).toString().split(' ') ?? ['Thu', 'Jan', '01', '1970', '00:00:00', 'UTC'];
                    convertedFile = {name: protocol+'//'+host+':'+req.urldata.port+'/'+file, type: "file", size: stat.size, mtime: `${fmtime[0]}, ${fmtime[2]} ${fmtime[1]} ${fmtime[3]} ${fmtime[4]} ${fmtime[5]}`};
                } else if (typeof file === "object" && !Array.isArray(file)) {
                    convertedFile = {name: file.name ?? file.url, type: file.type ?? "file", size: file.size ?? 0, mtime: file.mtime ?? file.edit ?? `Thu, 01 Jan 1970 00:00:00 UTC`};
                }
                if (typeof convertedFile != "object") {console.error('File != STRING || JSON_OBJECT');continue;}
                var fileExt = convertedFile.name.substr(convertedFile.name.lastIndexOf('.') + 1);
                if (Array.isArray(formats) && !formats.includes(fileExt)) continue;
                list.push(convertedFile);
                if (typeof src.group === "string") {
                    grps[src.group] ??= [];
                    grps[src.group].push(convertedFile);
                }
            }
        }
        return JSON.stringify({res: list, grps: grps});
    }
    function fileToGame(fileArray, defIcon, mode, tdb) {
        var output = [];
        for (var game of fileArray) {
            var parsedgameinfo = game;
            var ginfo = game.name.match(/(?<=\[).*?(?=\])/g) ?? [];
            parsedgameinfo.url = game.name;
            parsedgameinfo.name = game.name.substring(game.name.lastIndexOf('/')+1).replace(`[${ginfo[0]}][${ginfo[1]}]`, "")
            parsedgameinfo.filename = game.name.slice(0, game.name.indexOf('.'));
            parsedgameinfo.titleid = ginfo[0] ?? "";
            parsedgameinfo.size = formatBytes(game.size);
            parsedgameinfo.version = ginfo[1] ?? "";
            parsedgameinfo.src = settings.tinfoil_icons == 1 ? "https://tinfoil.media/ti/"+parsedgameinfo.titleid+"/512/512/" : "";
            parsedgameinfo.bkg = settings.tinfoil_icons == 1 ? "https://tinfoil.media/thi/"+parsedgameinfo.titleid+"/0/0/" : "";
            parsedgameinfo.err_src = (settings.modes[mode] ?? {}).icon ?? "";
            parsedgameinfo.pltfrm = mode;
            parsedgameinfo.infos = ginfo;
            var toReplace = [];
            
            for (var info of ginfo) {
                if (info.length === 14 && !isNaN(info) && info.split('0').length > 1) {parsedgameinfo.id = info;toReplace.push(`[${info}]`)}
                if (info.length > 1 && info.indexOf('v') === 0 && !isNaN(info.replace('v', ''))) {parsedgameinfo.version = info;toReplace.push(`[${info}]`)}
                if (info.toLowerCase() === "base" || info.toLowerCase() === "dlc" || info.toLowerCase() === "upd" || info.toLowerCase() === "update") {parsedgameinfo.type = info;toReplace.push(`[${info}]`)}
            }
            for (var tr of toReplace) {
                game.name = game.name.replace(tr, '');
            }
            if (parsedgameinfo.filename.length === 14 && !isNaN(parsedgameinfo.filename) && parsedgameinfo.filename.split('0').length > 1) parsedgameinfo.id = parsedgameinfo.filename;
            if (typeof parsedgameinfo.id === "string" && typeof tdb === "object" && typeof tdb[parsedgameinfo.id] === "object") {
                for (var e in tdb[parsedgameinfo.id]) {
                    if (e === "size") parsedgameinfo['formattedSize'] = formatBytes(tdb[parsedgameinfo.id][e]);
                    if (e != "id" && e != "version" && e != "type") parsedgameinfo[e] = tdb[parsedgameinfo.id][e] ?? "";
                }
            }
            parsedgameinfo.icon = parsedgameinfo.icon ?? parsedgameinfo.iconUrl ?? defIcon ?? "";
            parsedgameinfo.src = parsedgameinfo.icon;
            parsedgameinfo.err_src = defIcon ?? "";
            parsedgameinfo.bkg = parsedgameinfo.bkg ?? parsedgameinfo.background ?? parsedgameinfo.banner ?? parsedgameinfo.bannerUrl ?? "";
            output.push(parsedgameinfo);
        }
        return output;
    }
    function search(query, gamelist, caseSensitive = 0, smartsearch = 1, maxErrCount = 3) {
        maxErrCount += 1;
        var absoluteResult = [];
        var newRes = [];
        var q = caseSensitive === 0 ? query.toLowerCase() : query;
        var equery = q.split("");
        var squery = q.split(" ");
        for (var o of gamelist) {
            o.originalName = o.name;
            o.name = o.name.substr(o.name.lastIndexOf('/')+1);
            if (smartsearch) {
                var eligible = true;
                var absolute = false;
                var sabsolute = true;
                var errCount = 0;
                var search = (caseSensitive === 0) ? o.name.toLowerCase() : o.name;
                var esearch = search.split("");
                var dsearch = search.split(".");
                var ssearch = search.split(" ");
                for (var ltr of equery) {
                    if (!esearch.includes(ltr)) {
                        eligible = false;
                        errCount++;
                        if (errCount >= maxErrCount) break;
                    }
                }
                for (var dp of dsearch) {
                    if (dp == query) {
                        o.name = o.originalName;
                        delete(o.originalName);
                        absoluteResult.push(o);
                        absolute = true;
                        break;
                    }
                }
                for (var sp of squery) {
                    for (var ssp of ssearch) {
                        if (!ssp.indexOf(sp) != -1) {
                            sabsolute = false;
                            break;
                        }
                    }
                }
                if ((!eligible && errCount >= maxErrCount) || absolute === true) continue;
                if (sabsolute === true) {
                    absoluteResult = [...absoluteResult, o];
                    continue;
                }
                o.name = o.originalName;
                delete(o.originalName);
                if (search.indexOf(query) != -1) {newRes = [...newRes, o]}
                else {newRes.push(o)}
            } else {
                if (((caseSensitive === 1 && o.name.indexOf(query) != -1) || (caseSensitive === 0 && o.name.toLowerCase().indexOf(query) != -1))) {
                    o.name = o.originalName;
                    delete(o.originalName);
                    newRes.push(o)
                }
            }
        }
        newRes = [...absoluteResult, ...newRes];
        return newRes;
    }
    
    console.log('Downloading TitleDB...');
    const tdbl = await fetch('https://raw.githubusercontent.com/blawar/titledb/master/languages.json').then(r=>r.json()).then(d=>{var r = [];for (var e in d) {var n = d[e];for (var f of n) {r.push(e+'.'+f)}};return r;});
    for (var e of tdbl) {
        console.log('TITLE DB LOADING DISABLED!!!');
        break;
        global.titleDB ??= {};
        if (fs.existsSync('data/nxtitle/'+e+'.json')) {
            var fdate = new Date(fs.statSync('data/nxtitle/'+e+'.json').mtimeMs).toString().split(' ') ?? ['Thu', 'Jan', '01', '1970', '00:00:00', 'UTC'];
            var cdate = new Date().toString().split(' ');
            if (fdate[2] == cdate[2] && fdate[3] == cdate[3]) {
                try {
                    var response = JSON.parse(fs.readFileSync('data/nxtitle/'+e+'.json', {encoding: 'utf-8'}));
                    global.titleDB[e] = response;
                    console.log('Read local '+e+' TitleDB!');
                    continue;
                } catch(err) {}
            }
        }
        var response = await fetch('https://raw.githubusercontent.com/blawar/titledb/master/'+e+'.json').then(r=>r.text()).catch(err=>{console.error('Failed to load '+e+' Title DB:', err)});
        fs.writeFileSync('data/nxtitle/'+e+'.json', response, {encoding: 'utf-8'});
        global.titleDB[e] = JSON.parse(response);
        console.log('Saved '+e+' TitleDB!');
    }
    
    /* ! END X-SHOP CODE ! */
    
    console.log('Preparing HTTP Host...');
    var app = (req, res)=>{
        console.log ??= function(){};
        // todo: OPTIMIZE THIS TO HEAVILY INCREASE PERFORMANCE!
        if (!!args.perftimer) {
            console.log("\x1b[33m Started measuring response time! ----------------------------- \x1b[0m");
            console.group();
            var reqHandleStartTime = performance.now();
            var reqHandleSections = {};
        }
        var server = global.server;
        if (!!server.rules.hosts && !!server.rules.hosts.default) server = {...server, ...server.rules.hosts.default};
        if (!!server.rules.hosts) {
            if (server.rules.hosts[req.headers.host]) {server = {...server, ...server.rules.hosts[req.headers.host]};}
            else {
                for (var host in server.rules.hosts) {
                    if (matchesRule(req.headers.host, host)) {
                        server = {...server, ...server.rules.hosts[host]};
                    }
                }
            }
        }
        server.tries.push(server.root + "$FN", server.root + "/$FN");
        if (!!args.perftimer) reqHandleSections["get host rules"] = performance.now() - reqHandleStartTime;
        if (!!server.headers && typeof server.headers === "object") for (var header in server.headers) {if (header.toLowerCase() === "expires") {server.headers[header] = timeFromNow(server.headers[header])};res.setHeader(header, server.headers[header])}
        var tmpReqPath = (server.root + ((req.url == "/") ? "/index.html" : req.url)).replaceAll("//", '/');
        if (tmpReqPath === server.root + server.uploads.path) {
            //Execute Server Operations
            var langtmp = (req.headers['accept-language'] ?? "en-us").split(',')[0].split('-');
            langtmp[0] ??= "en";
            langtmp[1] ??= "US";
            var client = {
                ip: req.socket.remoteAddress,
                useragent: req.headers['user-agent'] ?? false,
                auth: !!req.headers.authorization ? {
                    usr: Buffer.from(req.headers.authorization.split(/\s+/).pop(), 'base64').toString().split(/:/)[0],
                    pwd: Buffer.from(req.headers.authorization.split(/\s+/).pop(), 'base64').toString().split(/:/)[1]
                } : false,
                language: langtmp[1].toUpperCase()+'-'+langtmp[0]
            }
            client.devtype = !!client.useragent ? devTypeSync({userAgent: client.useragent}) : "Unknown";
            if (!!args.perftimer) reqHandleSections["define client"] = performance.now() - reqHandleStartTime;
            if (!args.silent) console.log(`New Access`, Date(), {...client, path: (server.root + tmpReqPath), handler: process.pid});
    
            //Get uploaded file
            var form = new IncomingForm();
            form.maxFileSize = server.uploads.maxSize ?? 1024 * 1024 * 1024; //1 GB
            form.parse(req, function (err, fields, files) {
                var reqUrlData = {
                    protocol: req.protocol,
                    headers: req.headers,
                    path: (server.root + ((req.url == "/") ? "/index.html" : req.url)).replaceAll("//", '/'),
                    port: (req.protocol == "http:") ? server.port.http : ((req.protocol == "https:") ? server.port.https : undefined),
                    auth: client.auth,
                    host: req.headers.host.split(':')[0],
                    basehost: req.headers.host.split(':')[0].split('.').length > 1 ? req.headers.host.split(':')[0].split('.')[req.headers.host.split(':')[0].split('.').length - 2] +'.'+ req.headers.host.split(':')[0].split('.')[req.headers.host.split(':')[0].split('.').length - 1] : undefined,
                    query: url.parse(req.url, true).query,
                    body: ((f)=>{var ret = {};for (var fn in fields) {ret[fn] = fields[fn][0]};return ret;})(fields),
                    client: client
                };
    
                if (!Array.isArray(files.file)) {
                    res.end('ERROR: The input upload must have the "name" property equal to "file".');
                } else {
                    res.writeHead(200, {'Content-type': server.filetypes['html']});
                    var count = 1;
                    for (var file of files.file) {
                        if (!!server.uploads.handler) {
                            var fcontent = !!server.availableFunctions.php ? runPHP('.'+server.uploads.handler) : fs.readFileSync('.'+server.uploads.handler, 'utf8');
                            fcontent = execNodeCode(fcontent, server.uploads.handler, reqUrlData, publicServer, file);
                            if (!!args.perftimer) reqHandleSections["run upload handler scripts"] = performance.now() - reqHandleStartTime;
                            res.write(fcontent);
                            count++;
                            continue;
                        }
                        if (!!server.uploads.filter) {
                            var fcontent = !!server.availableFunctions.php ? runPHP('.'+server.uploads.filter) : fs.readFileSync('.'+server.uploads.filter, 'utf8');
                            fcontent = execNodeCode(fcontent, server.uploads.filter, reqUrlData, publicServer, file);
                            if (!!args.perftimer) reqHandleSections["run upload filter scripts"] = performance.now() - reqHandleStartTime;
                            res.write(fcontent);
                            if (fcontent.indexOf('ERROR:') === 0) {
                                fs.unlinkSync(file.filepath);
                                count++;
                                continue;
                            }
                        }
                        var fileIdentifier = server.uploads.ids ? makeid(20) : "";
                        fs.cpSync(file.filepath, "./"+server.uploads.destination+fileIdentifier+file.originalFilename);
                        fs.rmSync(file.filepath);
                        if (!!server.uploads.postScript && server.uploads.postScript.length > 0 && fs.existsSync('.'+server.uploads.postScript)) {
                            var fcontent = !!server.availableFunctions.php ? runPHP('.'+server.uploads.postScript) : fs.readFileSync('.'+server.uploads.postScript, 'utf8');
                            fcontent = execNodeCode(fcontent, server.uploads.postScript, reqUrlData, publicServer, "./"+server.uploads.destination+fileIdentifier+file.originalFilename, fileIdentifier);
                            if (!!args.perftimer) reqHandleSections["run page scripts"] = performance.now() - reqHandleStartTime;
                            res.write(fcontent);
                        } else if (fields.redirect) {
                            res.write("<script>location.href = '"+fields.redirect[0]+"'</script>");
                        } else {
                            res.write('OK' + (server.uploads.ids ? ": "+fileIdentifier+file.originalFilename : ""));
                        }
                        count++;
                    }
                    res.end();
                }
            });
            if (!!args.perftimer) reqHandleSections["upload file"] = performance.now() - reqHandleStartTime;
            return;
        }
        req.bodytxt = [];
        req.body = {};
        req.ctype = req.headers["content-type"] ?? "";
        req.boundary = (req.ctype.split("; ")[1] != undefined) ? "--" + req.ctype.split("; ")[1].replace("boundary=","") : "";
        req.on('data',(data)=>{req.bodytxt.push(data)}).on('end',()=>{
            // X-SHOP LINE
            const tdb = (typeof global.titleDB != "undefined") ? global.titleDB[req.acceptsLanguages.replace('-','.')] ?? {} : {};
            var langtmp = (req.headers['accept-language'] ?? "en-us").split(',')[0].split('-');
            langtmp[0] ??= "en";
            langtmp[1] ??= "US";
            if (req.bodytxt && req.bodytxt.length > 0) {
                req.bodytxt = Buffer.concat(req.bodytxt).toString();
                if (req.ctype.toLowerCase().indexOf('multipart/form-data') != 0) {
                    for (var pair of new URLSearchParams(req.bodytxt).entries()) {
                        try {
                            req.body = JSON.parse(req.bodytxt);
                            break;
                        } catch(e) {}
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
                if (!!args.perftimer) reqHandleSections["parse body"] = performance.now() - reqHandleStartTime;
            }
            req.acceptsLanguages = langtmp[1].toUpperCase()+'-'+langtmp[0];
            // X-SHOP LINE
            var parsedURL = url.parse(req.url, true);
            var client = {
                ip: req.socket.remoteAddress,
                useragent: req.headers['user-agent'] ?? false,
                auth: !!req.headers.authorization ? {
                    usr: Buffer.from(req.headers.authorization.split(/\s+/).pop(), 'base64').toString().split(/:/)[0],
                    pwd: Buffer.from(req.headers.authorization.split(/\s+/).pop(), 'base64').toString().split(/:/)[1]
                } : false,
                language: req.acceptsLanguages,
                // X-SHOP LINES
                uid: req.headers.UID ?? crypto.createHash('md5').update((req.headers['user-agent'] ?? "") + (req.acceptsLanguages ?? "unknwn") + req.socket.remoteAddress).digest('hex'),
                shopedit: settings['admin_key'] != 0 && ((!!parsedURL.query['adminkey'] && parsedURL.query['adminkey'] === settings['admin_key']) || req.body['php_options_change_auth_key_sent'] === settings['admin_key']),
                accessdata: {
                    adminkey: parsedURL.query['adminkey'] ?? parsedURL.query['akey'] ?? undefined,
                    mode: parsedURL.query['type'],
                    ovr_key: {
                        unlink: !!parsedURL.query['unlink'],
                        maxdevs: !!parsedURL.query['maxdevs'] ? Number(parsedURL.query['maxdevs']) : false,
                        getaccdata: !!parsedURL.query['getaccdata']
                    },
                    fs: {
                        query: parsedURL.query['q'] ?? ""
                    },
                    pgl: {
                        page: Number(parsedURL.query['page'] ?? 1)
                    },
                    fbd: {
                        todel: parsedURL.query['filedel']
                    },
                    ovr_opt: {
                        get: !!req.headers['fetch-overridesettings-get'],
                        opt: !!req.headers['fetch-overridesettings'] ? (!!req.headers['fetch-overridesettings-get'] ? (()=>{
                            var response = {};
                            for (var key in settings) {
                                var val = settings[key];
                                if (key == "admin_key") continue;
                                if (typeof val === "object" && !Array.isArray(val) && key != "sources" && key != "uplloc" && key != "afiloc") {
                                    var na = [];
                                    for (var k2 in val) {
                                        var v2 = val[k2];
                                        var no = {};
                                        no['ar_name'] = k2;
                                        for (var k3 in v2) {
                                            var v3 = v2[k3];
                                            if (k3 == "frmt" || k3 == "fld") v3 = v3.join('*');
                                            no[k3] = v3;
                                        }
                                        na.push(no);
                                    }
                                    response[key] = na;
                                } else if (key === "uplloc" || key === "afiloc") {
                                    response[key] = JSON.stringify(val);
                                } else {
                                    response[key] = val;
                                }
                            }
                            return response;
                        })() : ((unparsed)=>{
                            //var usedAdminKey = unparsed['php_options_change_auth_key_sent'];
                            //if (settings['admin_key'] == 0 || usedAdminKey != settings['admin_key']) return qe("401 Unauthorized");
                            for (var key in unparsed) {
                                var val = unparsed[key];
                                if (key == "php_options_change_auth_key_sent") continue;
                                if (key == "admin_key" && val == "") continue;
                                if (Array.isArray(val) && key != "sources" && key != "uplloc" && key != "afiloc") {
                                    var no = {};
                                    for (var obj of val) {
                                        var on = obj['ar_name'];
                                        no[on] = {};
                                        for (var k2 in obj) {
                                            var v2 = obj[k2];
                                            if (k2 == "ar_name") continue;
                                            if (k2 == "grp_games") {
                                                no[on] = JSON.parse(v2);
                                                continue;
                                            }
                                            if (k2 == "frmt" || k2 == "fld") {
                                                no[on][k2] = v2.split('*');
                                                continue;
                                            }
                                            no[on][k2] = v2;
                                        }
                                    }
                                    settings[key] = no;
                                } else if (key === "uplloc" || key === "afiloc") {
                                    settings[key] = JSON.parse(val);
                                } else {
                                    settings[key] = val;
                                }
                            }
                            return settings;
                        })(req.body)) : {}
                    }
                }
            }
            client.accessdata.ovr_key.iuser = parsedURL.query['user'] ?? (client.auth ? client.auth.usr : null);
            client.accessdata.ovr_key.nuser = parsedURL.query['nusr'] ?? (parsedURL.query['user'] ?? (client.auth ? client.auth.user : null)) ?? null;
            client.accessdata.ovr_key.ipass = parsedURL.query['psswd'] ?? (client.auth ? client.auth.pwd : null);
        
            client.devtype = !!client.useragent ? devTypeSync({userAgent: client.useragent}) : "Unknown";
            if (!!args.perftimer) reqHandleSections["define client"] = performance.now() - reqHandleStartTime;
            req.urldata = {
                protocol: req.protocol,
                headers: req.headers,
                path: (server.root + ((req.url == "/") ? "/index.html" : decodeURI(req.url))).replaceAll("//", '/'),
                port: (req.protocol == "http:") ? server.port.http : ((req.protocol == "https:") ? server.port.https : undefined),
                auth: client.auth,
                host: req.headers.host.split(':')[0],
                basehost: req.headers.host.split(':')[0].split('.').length > 1 ? req.headers.host.split(':')[0].split('.')[req.headers.host.split(':')[0].split('.').length - 2] +'.'+ req.headers.host.split(':')[0].split('.')[req.headers.host.split(':')[0].split('.').length - 1] : undefined,
                query: url.parse(req.url, true).query,
                body: req.body,
                client: client
            }
            var query = req.urldata.query;
            if (req.urldata.path.indexOf('?') != -1) req.urldata.path = req.urldata.path.slice(0, req.urldata.path.indexOf('?'));
    
            if (!!server.rules.redirects) {
                for (var redirect of server.rules.redirects) {
                    redirect.expires ??= {};
                    //redirect.expires.used ??= 0;
                    if (typeof redirect.expires.date === "number" && new Date().getTime() - redirect.expires.date >= 0) continue;
                    //if (typeof redirect.expires.uses === "number" && redirect.expires.uses <= redirect.expires.used) continue;
                    if (req.urldata.path === server.root + redirect.from || matchesRule(req.urldata.path.replace(server.root, ''), redirect.from)) {
                        req.urldata.originalPath = req.urldata.path;
                        req.urldata.path = redirect.to;
                        req.urldata.allowrestricted = true;
                        req.urldata.followsRule = true;
                        //++redirect.expires.used;
                    } else if (redirect.replace && req.urldata.path.indexOf(server.root + redirect.from) === 0) {
                        req.urldata.originalPath = req.urldata.path;
                        req.urldata.path = req.urldata.path.replace(server.root + redirect.from, redirect.to);
                        req.urldata.allowrestricted = true;
                        req.urldata.followsRule = true;
                        //++redirect.expires.used;
                    } else if (server.protectedOverrideIPs.includes(req.urldata.client.ip) || matchesRule(req.urldata.client.ip, server.protectedOverrideIPs)) {
                        req.urldata.allowrestricted = true;
                        req.urldata.followsRule = true;
                    }
                }
            }
            if (!!args.perftimer) reqHandleSections["apply redirects"] = performance.now() - reqHandleStartTime;
    
            for (var tentatives of server.tries) {
                var tentative = tentatives.replaceAll('$FN', req.urldata.path);
                if (fs.existsSync('.'+tentative)) {
                    req.urldata.path = tentative;
                    break;
                }
            }
            if (!!args.perftimer) reqHandleSections["find file"] = performance.now() - reqHandleStartTime;
    
            if (fs.existsSync('.'+req.urldata.path) && fs.lstatSync('.'+req.urldata.path).isDirectory()) req.urldata.path += (req.urldata.path.slice(-1) != "/") ? "/index.html" : "index.html";
            // X-SHOP LINE: MODIFIED FUNCTION
            function qe(err) {
                if (!client.useragent) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({files: [], error: settings['shp_ttl']+': '+err}))
                } else {
                    res.statusCode = Number(err.slice(0, 3));
                    res.statusMessage = err.slice(4);
                    res.end();
                }
            }
            if (((req.urldata.path != server.root + "/LiveReload-CheckStatus-208340S908CXZ0CNDUSJCIN938WNSJKFEECNSDXC9" && !!args.livereload) || !args.livereload) && !args.silent) console.log(`New Access`, Date(), {...client, path: req.urldata.path, handler: process.pid});
            //res.writeHead(200, {'Content-type':'application/json'});
            //res.end({response_status: 200, text: "The server is up and running!"});
            
            //Serve a file
            if (!!server.proxy_pass) {
                var newPURL = new URL(server.proxy_pass);
                var reqURL  = !!server.proxy_pass_allow_path ? req.url : "";
                var options = {
                    hostname: newPURL.hostname,
                    port: req.protocol === "http:" ? 80 : 443,
                    path: (newPURL.pathname + '/' + reqURL).replaceAll('//', '/').replaceAll('//', '/'),
                    method: server.proxy_pass_method ?? "GET",
                    headers: {
                        ...req.headers,
                        ...(server.proxy_pass_headers ?? {}),
                        host: newPURL.hostname
                    },
                    body: (server.proxy_pass_method && server.proxy_pass_method.toUpperCase()) == "POST" ? req.body : undefined
                };
    
                request({
                    url: req.protocol + '//' + options.hostname + options.path,
                    headers: options.headers,
                    method: options.method,
                    body: options.body
                }).on('error', function(e) {
                    res.end(e);
                }).pipe(res);
            } else if (fs.existsSync('.'+req.urldata.path)) {
                var isProtected = false;
                for (var protectedfolder of server.protected) {
                    if (!!req.urldata.allowrestricted) break;
                    if (req.urldata.path.slice(1).indexOf(protectedfolder) == 0) isProtected = true;
                }
                if (!!args.perftimer) reqHandleSections["check protected folders"] = performance.now() - reqHandleStartTime;
                if (!isProtected) {
                    if (typeof req.headers['override-keys'] != "undefined") {
                        //*override-keys          = Change Auth Keys
                        if (settings.admin_key === 0 || client.accessdata.adminkey != settings.admin_key) {return qe("401 Unauthorized")}
                        if (settings.auth_CID === 0) {
                            var users = JSON.parse(fs.readFileSync('auth/mode2.json').replace(
                                /("(?:\\.|[^"])*")|#.*|\/\/.*|\/\*[\s\S]*?\*\//g,
                                '$1'
                            ));
                            var iuser = req.urldata.query.user ?? ((client.auth.usr != "") ? client.auth.usr : null) ?? null;
                            var nuser = req.urldata.query.nusr ?? iuser ?? null;
                            if (iuser == null) return qe("404 Not Found");
                            var ipass = req.urldata.query.psswd ?? ((client.auth.pwd != "") ? client.auth.pwd : null) ?? null;
                            if (ipass === null) return qe ("404 Not Found");
                            var newpwd = ipass;
                            var nmaxdevs = req.urldata.query.maxdevs ?? users[iuser].maxdevs ?? settings.nocid_max_dev;
                            if (typeof users[iuser] != "undefined") {
                                var oldDevs = (typeof req.urldata.query.unlink != "undefined") ? [] : users[iuser].devices;
                                if (typeof req.urldata.query.getaccdata != "undefined")  {
                                    res.writeHead(200, {'Content-type':'application/json'});
                                    res.end(JSON.stringify({}));
                                    return;
                                }
                                delete users[iuser];
                            } else if (typeof req.urldata.query.getaccdata != "undefined") {
                                res.writeHead(200, {'Content-type':'application/json'});
                                res.end(JSON.stringify({}));
                                return;
                            }
                            users[nuser] = {
                                key: newpwd,
                                devices: oldDevs ?? [],
                                maxdevs: nmaxdevs
                            };
                            fs.writeFileSync('auth/mode2.json', JSON.stringify(users, 0, 4));
                            return qe("200 OK");
                        } else {
                            var toChangeClientID = req.urldata.query.clientid ?? client.uid;
                            if (!fs.existsSync("auth/"+toChangeClientID)) {return qe("404 Not Found")}
                            var clientinfo = JSON.parse(fs.readFileSync("auth/"+toChangeClientID));
                            var changeUsername = req.urldata.query.user ?? clientinfo.user ?? "";
                            var changePassword = req.urldata.query.psswd ?? clientinfo.psswd ?? "";
                            fs.writeFileSync("auth/"+toChangeClientID, JSON.stringify({
                                user: changeUsername,
                                psswd: changePassword
                            }));
                            return qe("200 OK");
                        }
                        if (!client.shopedit) return qe("401 Unauthorized");
                    } else if (typeof req.headers['fetch-search'] != "undefined") {
                        //*fetch-search           = Search games in shop
                        var nres = search(req.urldata.query.q ?? "", JSON.parse(loadSources(settings.sources, false, req)).res,);
                        var newresponse = fileToGame(nres, null, (req.urldata.query.type ?? Object.keys(settings.modes)[0] ?? "").toLowerCase());
                        res.writeHead(200, {'Content-type':'application/json'});
                        res.end(JSON.stringify(newresponse));
                    } else if (typeof req.headers['fetch-groups'] != "undefined") {
                        //*fetch-groups           = Get game groups
                        res.writeHead(200, {'Content-type':'application/json'});
                        res.end(JSON.stringify(settings.groups));
                    } else if (typeof req.headers['fetch-list'] != "undefined") {
                        //*fetch-list             = Game list with pages
                        res.writeHead(200, {'Content-type':'application/json'});
                        var resp = JSON.parse(loadSources([{source:"games", active: true}], undefined, req)).res;
                        var pages = [];
                        for (let i = 0; i < resp.length; i += 10) {
                            const chunk = resp.slice(i, i + 10);
                            pages.push(chunk);
                        }
                        var pg = req.urldata.query.page ?? "1";
                        pg = Number(pg) - 1;
                        var result = pages[pg] ?? [];
                        res.end(JSON.stringify(fileToGame(result, null, (req.urldata.query.type ?? Object.keys(settings.modes)[0] ?? "").toLowerCase())));
                    } else if (typeof req.headers['fetch-files'] != "undefined") {
                        //*fetch-files            = File Browser
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(JSON.parse(loadSources([{source:"games", active: true}], undefined, req, true)).res));
                    } else if (typeof req.headers['fetch-delete'] != "undefined") {
                        //*fetch-delete           = File Browser Delete
                        if (client.shopedit && fs.existsSync(client.accessdata.ovr_opt.todel)) {
                            fs.rmSync(client.accessdata.ovr_opt.todel, {force: true});
                            return qe("200 OK");
                        }
                        return qe("401 Unauthorized");
                    } else if (typeof req.headers['fetch-sync-saves'] != "undefined") {
                        //todo: delayed - fetch-sync-saves       = Sync Save Backups
                    } else if (typeof req.headers['fetch-overridesettings'] != "undefined") {
                        //*fetch-overridesettings = Change Settings
                        if (client.accessdata.ovr_opt.get) {
                            var response = {};
                            for (var key in settings) {
                                var val = settings[key];
                                if (key == "admin_key") continue;
                                if (typeof val === "object" && key != "sources" && key != "uplloc" && key != "afiloc") {
                                    var na = [];
                                    for (var k2 in val) {
                                        var v2 = val[k2];
                                        var no = {ar_name: k2};
                                        for (var k3 in v2) {
                                            var v3 = v2[k3];
                                            if (k3 == "frmt" || k3 == "fld") v3 = v3.join("*");
                                            no[k3] = v3;
                                        }
                                        na.push(no);
                                    }
                                    response[key] = na;
                                } else if (key === "uplloc" || key === "afiloc") {
                                    response[key] = JSON.stringify(val);
                                } else {
                                    response[key] = val;
                                }
                            }
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(response));
                        } else {
                            if (!client.shopedit) return qe("401 Unauthorized");
                            settings = client.accessdata.ovr_opt.opt;
                            fs.writeFileSync('data/import/options.json', JSON.stringify(settings, null, 4), {encoding: 'utf-8'});
                            return qe("200 OK");
                        }
                    } else if (typeof req.body['upload'] != "undefined") {
                        //?POST_upload            = Upload File
                        //*Not needed anymore with new NJS WebServer
                        /*const bb = busboy({ headers: req.headers });
                        bb.on('file', (name, file, info) => {
                            const saveTo = path.join(__dirname, '/uploads/', info.filename);
                            file.pipe(fs.createWriteStream(saveTo));
                        });
                        bb.on('close', () => {
                            res.writeHead(200, { 'Content-Type': 'text/plain' });
                            res.end(`File Uploaded!`);
                        });
                        req.pipe(bb);*/
                    } else {
                        var ftype = ('.'+req.urldata.path).slice(('.'+req.urldata.path).lastIndexOf('.') + 1, ('.'+req.urldata.path).length);
                        var ctype = server.filetypes[ftype] ?? server.filetypes.default;
                        var fcontent = !!server.availableFunctions.php ? runPHP('.'+req.urldata.path) : fs.readFileSync('.'+req.urldata.path, 'utf8');
                        fcontent = ftype === "njsc" ? execNodeCode(fcontent, req.urldata.path, req.urldata, publicServer, res) : execNodeCode(fcontent, req.urldata.path, req.urldata, publicServer);
                        if (!!args.perftimer) reqHandleSections["run page scripts"] = performance.now() - reqHandleStartTime;
                        if (ftype != "njsc") {
                            const headers = {'Content-type':ctype};
                            var fn = req.urldata.path.slice(req.urldata.path.lastIndexOf('/') + 1, req.urldata.path.lastIndexOf('.'));
                            if ((ctype === server.filetypes.default && matchesRule(fn, "*.attachment")) || matchesRule(fn, "*.attachment")) headers['Content-Disposition'] = `attachment; filename="${fn.slice(0, fn.lastIndexOf('.attachment'))}.${('.'+req.urldata.originalPath).slice(('.'+req.urldata.originalPath).lastIndexOf('.') + 1, ('.'+req.urldata.originalPath).length)}"`;
                            res.writeHead(200, headers);
                            if ((ftype === "html" || (ftype === "php" && !!server.availableFunctions.php) || ftype === "njs") && !headers['Content-Disposition']) {
                                if (!!args.livereload && !req.urldata.followsRule && ftype != "njs") {
                                    var deflivereload = (!!args.nilivereload) ? "var reloads = "+reloads+";setInterval(()=>{fetch('/LiveReload-CheckStatus-208340S908CXZ0CNDUSJCIN938WNSJKFEECNSDXC9').then(r=>r.text()).then(r=>{if (isNaN(Number(r))) {return;} if (Number(r) > reloads || (reloads > 0 && Number(r) == 0)) {console.log('Live Reload - Change detected!', `New ${r}, Old ${reloads}`);if (window.confirm('Live Reload\\nThe original page was updated, want to refresh now?')) {location.reload();} else {reloads = Number(r)}}})}, 500)" : "var reloads = "+reloads+";setInterval(()=>{fetch('/LiveReload-CheckStatus-208340S908CXZ0CNDUSJCIN938WNSJKFEECNSDXC9').then(r=>r.text()).then(r=>{if (isNaN(Number(r))) {return;}if (Number(r) > reloads || (reloads > 0 && Number(r) == 0)) {console.log('Live Reload - Change detected!', `New ${r}, Old ${reloads}`);location.reload();}})}, 500)";
                                    var livereloadcontent = (fs.existsSync('./livereload.js')) ? fs.readFileSync('./livereload.js') : deflivereload;
                                    res.end(fcontent +`<script>\n${livereloadcontent}\n</script>`);
                                } else {
                                    res.end(fcontent);
                                }
                            } else {
                                if (!!headers['Content-Disposition']) {res.end(fcontent)}
                                else {res.end(fs.readFileSync('.'+req.urldata.path))}
                            }
                        } else {
                            //Live support not enabled for this file type!
                            res.end(fcontent);
                        }
                    }
                } else {
                    if (!!args.livereload && req.urldata.path === server.root + "/LiveReload-CheckStatus-208340S908CXZ0CNDUSJCIN938WNSJKFEECNSDXC9") {
                        res.writeHead(200, {'Content-type': server.filetypes['html']})
                        res.end(reloads+"");
                    } else {
                        res.writeHead(403, {'Content-type':'text/html'});
                        var error403 = (!!server.errors && server.errors['403'] && server.errors['403'].length > 0 && typeof server.errors['403'] === "string") ? (fs.existsSync(server.root + server.errors['403']) ? fs.readFileSync(server.root + server.errors['403']) : server.errors['403']) : "<h1 style='align-text: center;'>403: Access Denied</h1><p style='align-text:center'>You don't have the required permissions to access the page.</p>";
                        res.end(error403);
                    }
                }
            } else {
                if (!!args.livereload && req.urldata.path === server.root + "/LiveReload-CheckStatus-208340S908CXZ0CNDUSJCIN938WNSJKFEECNSDXC9") {
                    res.writeHead(200, {'Content-type': server.filetypes['html']})
                    res.end(reloads+"");
                } else {
                    var isProtected = false;
                    for (var protectedfolder of server.protected) {
                        if (req.urldata.path.slice(1).indexOf(protectedfolder) == 0) isProtected = true;
                    }
                    if (!!server.autoindex && !!server.autoindex.enable && fs.existsSync('.'+req.urldata.path.slice(0, req.urldata.path.lastIndexOf('/') + 1)) && !isProtected) {
                        server.autoindex.format ??= "html";
                        var atype = server.autoindex.format.toLowerCase() == "json" ? "json" : "html";
                        var filenames = fs.readdirSync('.'+req.urldata.path.slice(0, req.urldata.path.lastIndexOf('/') + 1));
                        var files = [];
                        if (atype === "json") {
                            for (var filename of filenames) {
                                var filestat = fs.statSync('.'+req.urldata.path.slice(0, req.urldata.path.lastIndexOf('/') + 1)+filename);
                                var rawDate = new Date(filestat.mtime).toString().split(" ");
                                files.push({name: filename, type: (filestat.isFile() ? "file" : "directory"), mtime: `${rawDate[0]}, ${rawDate[2]} ${rawDate[1]} ${rawDate[3]} ${rawDate[4]} ${rawDate[5]}`, size: filestat.size})
                            }
                            if (!!args.perftimer) reqHandleSections["JSON autoindex"] = performance.now() - reqHandleStartTime;
                            res.writeHead(404, {'Content-type': server.filetypes["json"]});
                            res.end(JSON.stringify(files, null, 4));
                        } else {
                            for (var filename of filenames) {
                                var filestat = fs.statSync('.'+req.urldata.path.slice(0, req.urldata.path.lastIndexOf('/') + 1)+filename);
                                var rawDate = new Date(filestat.mtime).toString().split(" ");
                                files.push({name: filename, type: (filestat.isFile() ? "file" : "directory"), mtime: `${rawDate[2]}-${rawDate[1]}-${rawDate[3]} ${rawDate[4].split(":")[0]}:${rawDate[4].split(":")[1]}`, size: filestat.size})
                            }
                            res.writeHead(404, {'Content-type': 'text/html'});
                            var autoindexResponse = `<html><head><title>Index of ${req.urldata.path.slice(0, req.urldata.path.lastIndexOf('/') + 1).replace(server.root, '')}</title></head><h1>Index of ${req.urldata.path.slice(0, req.urldata.path.lastIndexOf('/') + 1).replace(server.root, '')}</h1><hr><pre><a href="../">../</a>`;
                            for (var f of files) {
                                var fileName = f.name;
                                var fileMtime = f.mtime;
                                var fileSize = f.size;
                                var str = `${fileName} ${fileMtime} ${fileSize}`;
                                var len = str.length; // Must be 51,88
                                var spaces1 = "";
                                if ((fileName + " ").length != 52) spaces1 = (" ".repeat(52 - fileName.length));
                                autoindexResponse += `\n<a href="${f.name}">${fileName}</a>${spaces1} ${fileMtime}  ${fileSize} `;
                            }
                            if (!!args.perftimer) reqHandleSections["autoindex"] = performance.now() - reqHandleStartTime;
                            autoindexResponse += `</pre><hr></body></html>`;
                            res.end(autoindexResponse);
                        }
                    } else {
                        res.writeHead(404, {'Content-type':'text/html'});
                        var error404 = (!!server.errors && server.errors['404'] && server.errors['404'].length > 0 && typeof server.errors['404'] === "string") ? (fs.existsSync(server.root + server.errors['404']) ? fs.readFileSync(server.root + server.errors['404']) : server.errors['404']) : "<h1 style='align-text: center;'>404: Page not found!</h1><p style='align-text:center'>Try checking the URL.</p>";
                        res.end(error404);
                    }
                }
            }
    
            if (!!args.perftimer) {
                var consoleOutput = "\x1b[34m ENDED SCRIPTS EXECUTION -------------------------------------- \x1b[0m\n";
                var longest = {name: false, value: 0};
                for (var i = 0;i < Object.keys(reqHandleSections).length;i++) {
                    var prev = (i === 0) ? 0 : reqHandleSections[Object.keys(reqHandleSections)[i - 1]];
                    var sect = reqHandleSections[Object.keys(reqHandleSections)[i]];
                    var name = Object.keys(reqHandleSections)[i];
                    var time = sect - prev;
                    if (time > longest.value) longest = {name: name, value: time};
                    consoleOutput += `--"${name}" took ${time}ms (finished at ${sect}ms)!\n`;
                }
                console.groupEnd();
                if (!!longest.name) consoleOutput += `\x1b[96m "${longest.name}" took the longest (${longest.value}ms) \x1b[0m\n`;
                console.log(consoleOutput+`\x1b[33m Responded in ${performance.now() - reqHandleStartTime}ms! ---------------------------- \x1b[0m`);
            }
        });
    };
    var apphttp = (req, res)=>{req.protocol = "http:";app(req, res)}
    var apphttps = (req, res)=>{req.protocol = "https:";app(req, res)}
    
    if (!!args.livereload) {
        console.log('Preparing live reload...');
        var reloads = 0;
        try {
            fs.watch("."+server.root+"/", {recursive: true}, (et, fn)=>{
                console.log("Live Reload - Change detected!", `${et} on ${fn}!`);
                reloads++;
            });  
        } catch(e) {
            try {
                fs.watch("."+server.root+"/", {recursive: false}, (et, fn)=>{
                    console.log("Live Reload - Change detected!", `${et} on ${fn}!`);
                    reloads++;
                });
                console.error("Live Reload error, running non recursive version!", e);
            } catch(er) {
                console.error("Live Reload unavailable!", er);
            }
        }
    }
    
    if (fs.existsSync('./server.cfg')) fs.watch('./server.cfg', async (et, fn)=>{
        if (!!cluster.isPrimary) console.log("Reloaded server config!");
        var tmps = await loadSettings();
        global.server = tmps.server;
        global.publicServer = tmps.publicServer;
        tmps = undefined;
    });
    
    if (fs.existsSync('./private/server/rules.json')) fs.watch('./private/server/rules.json', async (et, fn)=>{
        if (!!cluster.isPrimary) console.log("Reloaded server config!");
        var tmps = await loadSettings();
        global.server = tmps.server;
        global.publicServer = tmps.publicServer;
        tmps = undefined;
    });
    
    console.log('Starting servers...');
    if (!originalServer.availableFunctions.loadBalancing || !cluster.isPrimary) {
        http.createServer({maxHeaderSize: server.maxHeaderSize}, apphttp).listen(server.port.http, undefined, ()=>{console.log ??= function(){};if (cluster.isPrimary) console.log('HTTP Server Running on Port `'+server.port.http+'`!', server.ip, 'localhost')});
        if (!!server.certs.key && !!server.certs.cert) {
            https.createServer({...server.certs, maxHeaderSize: server.maxHeaderSize}, apphttps).listen(server.port.https, undefined, ()=>{console.log('HTTPS Support Enabled on Port `'+server.port.https+'`!')});
        } else {console.log('HTTPS Support NOT Enabled: Insert both `key.pem` and `cert.pem` files inside of `./certs/` folder!')}
        if (!!originalServer.rules.additionalServers) for (var secondaryServer of originalServer.rules.additionalServers) {
            secondaryServer.enable ??= true;
            secondaryServer.certs ??= {key: false, cert: false};
            secondaryServer.port ??= 8080;
            secondaryServer.type ??= "HTTP";
            secondaryServer.type = secondaryServer.type.toUpperCase();
            if (!secondaryServer.enable) continue;
            if (secondaryServer.type === "PEER") {
                if (!peerjs) {
                    console.warn("PeerServer not created! Missing `peer` package!");
                    continue;
                }
                var serverOpts = {
                    port: secondaryServer.port,
                    path: (secondaryServer.path ?? "/pjs"),
                    key: secondaryServer.key ?? false,
                    allow_discovery: secondaryServer.discovery ?? true,
                    generateClientId: uuidv4
                };
                if (!!secondaryServer.certs.key) serverOpts.sslkey = secondaryServer.certs.key;
                if (!!secondaryServer.certs.cert) serverOpts.sslcert = secondaryServer.certs.cert;
                peerjs.PeerServer(serverOpts);
                console.log('Additional PeerServer Running on Port `'+secondaryServer.port+'`!', originalServer.ip, 'localhost');
            } else if (secondaryServer.type === "WEBSOCKET") {
                if (!websocket) {
                    console.warn("WS Server not created! Missing `ws` package!");
                    continue;
                }
                var WSServer = new websocket.Server({ port: secondaryServer.port});
                var clients = new Map();
                WSServer.on('connection', (ws) => {
                    const ID = uuidv4();
                    const IP = ws._socket.remoteAddress;
                    let metadata = { ID, IP };
                    if (secondaryServer.handler && fs.existsSync(secondaryServer.handler)) metadata = execNodeCode(fs.readFileSync(secondaryServer.handler, 'utf8'), secondaryServer.handler, WSServer, ws);
                    clients.set(ws, metadata);
                    ws.on('message', (msg)=>{
                        const message = JSON.parse(msg);
                        const metadata = clients.get(ws);
                        message.sender = metadata.ID;
                        message.addr = metadata.IP;
                        if (secondaryServer.handler && fs.existsSync(secondaryServer.handler)) message = execNodeCode(fs.readFileSync(secondaryServer.handler, 'utf8'), secondaryServer.handler, WSServer, ws, metadata, msg);
                        const outbound = JSON.stringify(message);
                        [...clients.keys()].forEach((client) => {
                            if (secondaryServer.handler && fs.existsSync(secondaryServer.handler)) {
                                outbound = execNodeCode(fs.readFileSync(secondaryServer.handler, 'utf8'), secondaryServer.handler, WSServer, ws, metadata, outbound, client.send);
                            } else {
                                client.send(outbound);
                            }
                        });
                    });
                    ws.on("close", () => {
                        clients.delete(ws);
                    });
                });
                console.log('Additional WS Server Running on Port `'+secondaryServer.port+'`!', originalServer.ip, 'localhost');
            } else if (!!secondaryServer.certs.key && !!secondaryServer.certs.cert) {
                https.createServer({...server.certs, maxHeaderSize: server.maxHeaderSize}, apphttps).listen(secondaryServer.port, undefined, ()=>{console.log('Additional HTTPS Server Running on Port `'+secondaryServer.port+'`!', originalServer.ip, 'localhost')});
            } else {
                http.createServer({maxHeaderSize: server.maxHeaderSize}, apphttp).listen(secondaryServer.port, undefined, ()=>{if (cluster.isPrimary) console.log('Additional HTTP Server Running on Port `'+secondaryServer.port+'`!', originalServer.ip, 'localhost')});
            }
        }
        console.log = console.tmpLog;
    } else if (cluster.isPrimary) {
        // Fork workers
        for (let i = 0;i < numCPUs;i++) {
            cluster.fork();
        }
      
        cluster.on('exit', (worker, code, signal) => {
            console.error(`A worker just died!`);
            cluster.fork();
        });
        
        console.log(`Load balancer ready!`);
    }
});
if (!module.parent) startXShop();
module.exports = startXShop;