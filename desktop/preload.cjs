'use strict';
const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('rinraku',Object.freeze({
 publish:state=>ipcRenderer.send('rinraku:state',state),
 openOutput:()=>ipcRenderer.send('rinraku:output'),
 copyOutputUrl:()=>ipcRenderer.invoke('rinraku:copy-output-url'),
 importPng:slot=>ipcRenderer.invoke('rinraku:import',slot),
 restorePng:slot=>ipcRenderer.invoke('rinraku:restore',slot),
}));
