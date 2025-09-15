console.log('Proess Started');

const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const path = require("path");
const url = require("url");

let win; 

function createWindow(){
    win = new BrowserWindow({width:350, height:550, resizable:false, frame:true});
    win.loadFile('index.html');

win.on('closed', () => {
    win = null;
    })
}

app.on('ready', createWindow);
