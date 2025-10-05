console.log('Proess Started');

const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const { ipcMain } = electron;
const path = require("path");
const url = require("url");

let win; 

function createWindow(){
    // frameless, always-on-top window; fixed size per request
    win = new BrowserWindow({
        width:350,
        height:550,
        resizable:false,
        frame:false,
        alwaysOnTop:true,
        backgroundColor:'#000000',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    win.loadFile('index.html');

    win.on('closed', () => {
        win = null;
    });
}

app.on('ready', createWindow);

// Listen for close requests from renderer
ipcMain.on('close-window', () => {
    if (win) win.close();
});
