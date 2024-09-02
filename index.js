const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const DeltaUpdater = require("@electron-delta/updater");
const child_process = require("child_process");
const { existsSync, rm } = require('node:fs');
const path = require('node:path');

let exobpathtmp = "";
switch (process.platform) {
    case "win32":
        exobpathtmp = (existsSync("resources/libs")) ? "resources\\libs\\ExoBuilder.exe" : "libs\\ExoBuilder.exe";
        break;
    case "darwin":
        exobpathtmp = (existsSync("resources/libs")) ? "./resources/libs/ExoBuilder-macos" : "./libs/ExoBuilder-macos";
        break;
    case "linux":
        exobpathtmp = (existsSync("resources/libs")) ? "./resources/libs/ExoBuilder-linux" : "./libs/ExoBuilder-linux";
        break;
    default: 
        exobpathtmp = (existsSync("resources/libs")) ? "./resources/libs/ExoBuilder" : "./libs/ExoBuilder";
}
const exobpath = exobpathtmp;
const webprefs = {
    sandbox: false,
    preload: path.join(__dirname, 'preload.js'),
    nodeIntegration: true,
    contextIsolation: false,
    devTools: process.env.APP_DEV ? (process.env.APP_DEV.trim() == "true") : false
};

const createWindow = () => {
    const win = new BrowserWindow({
        width: 950,
        height: 600,
        minWidth: 520,
        minHeight: 500,
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

if (app) {
    ipcMain.on("clearappdata", (event, message) => {
        const appName = app.getName();
        const appDataPath = path.join(app.getPath('appData'), appName);
        var cp = require('child_process');
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
    ipcMain.handle('dialog:openDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        })
        if (canceled) {
            return
        } else {
            return filePaths[0]
        }
    });

    const deltaUpdater = new DeltaUpdater({
        logger: console,
        autoUpdater: require("electron-updater").autoUpdater,
        // Where delta.json is hosted, for github provider it's not required to set the hostURL
        hostURL: "https://example.com/updates/windows/",
    });
    
    try {await deltaUpdater.boot()} catch (e) {console.error(e)}

    app.whenReady().then(() => {
        global.mainWindow = createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });
    
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    // app.on('certificate-error', (e)=>{
    //     e.preventDefault();
    //     return false;
    // });
}
module.exports = {
    isDev: process.env.APP_DEV ? (process.env.APP_DEV.trim() == "true") : false,
    https: require("https"),
    ExoBuilder: async (arguments)=>{
        let outpromise = new Promise((resolve, reject) => {
            let spawn = require("child_process").spawn;
            let bat = spawn(exobpath, arguments.split(" "));
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
    }
}