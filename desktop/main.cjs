'use strict';
const {app,BrowserWindow,ipcMain,session,systemPreferences,Menu,dialog,nativeImage,clipboard} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {startServer} = require('./server.cjs');
const {createAssetStore,slots,MAX_BYTES}=require('./assets.cjs');
// Preserve the original profile location across the product rename.
app.setPath('userData',path.join(app.getPath('appData'),'Rinraku Studio'));
app.setName('RinPNGTube');
const isolation=process.argv.find(arg=>arg.startsWith('--user-data-dir='));
if(isolation){const directory=path.resolve(isolation.slice('--user-data-dir='.length));fs.mkdirSync(directory,{recursive:true});app.setPath('userData',directory);}
let server,editor,output;
function isEditor(contents){return contents===editor?.webContents;}
function trusted(event){return isEditor(event.sender)&&event.senderFrame===editor.webContents.mainFrame&&event.senderFrame.url===server.url;}
function secureWindow(options){
 const win=new BrowserWindow({...options,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.on('will-attach-webview',event=>event.preventDefault());
 return win;
}
async function main(){
 await app.whenReady();
 const assets=await createAssetStore(path.join(app.getPath('userData'),'avatar-pngs'),data=>!nativeImage.createFromBuffer(data).isEmpty());
 server=await startServer(assets);
 ipcMain.handle('rinraku:copy-output-url',event=>{
  if(!trusted(event))return false;
  // Only the trusted editor can copy this fixed local URL, never arbitrary text.
  clipboard.writeText(server.url+'?overlay=1');return true;
 });
 let importing=false;
 ipcMain.handle('rinraku:import',async(event,slot)=>{
  if(!trusted(event)||!slots.includes(slot))return {error:'Ungültiger Bildzustand.'};
  if(importing)return {error:'Bitte den offenen Dateidialog zuerst schließen.'};
  importing=true;
  try{
   const result=await dialog.showOpenDialog(editor,{title:'RinPNGTube – PNG zuordnen',properties:['openFile'],filters:[{name:'PNG-Bilder',extensions:['png']}]});
   if(result.canceled||!result.filePaths.length)return {canceled:true};
   const filename=result.filePaths[0];
   const stat=await fs.promises.stat(filename);
   if(!stat.isFile()||stat.size>MAX_BYTES||path.extname(filename).toLowerCase()!=='.png')throw Error('Bitte eine PNG-Datei bis 12 MiB wählen.');
   return {sources:await assets.save(slot,await fs.promises.readFile(filename))};
  }catch(error){return {error:error.message};}finally{importing=false;}
 });
 ipcMain.handle('rinraku:restore',async(event,slot)=>{
  if(!trusted(event)||!slots.includes(slot))return {error:'Ungültiger Bildzustand.'};
  try{return {sources:await assets.remove(slot)};}catch{return {error:'Original konnte nicht wiederhergestellt werden.'};}
 });
 const origin=new URL(server.url).origin;
 session.defaultSession.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>isEditor(contents)&&permission==='media'&&requestingOrigin===origin&&(!details.mediaType||details.mediaType==='audio'));
 session.defaultSession.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
  if(!isEditor(contents)||permission!=='media'||details.isMainFrame===false||!details.requestingUrl?.startsWith(server.url)||!details.mediaTypes?.length||details.mediaTypes.some(type=>type!=='audio'))return callback(false);
  if(process.platform==='darwin'){
   const status=systemPreferences.getMediaAccessStatus('microphone');
   if(status==='denied'||status==='restricted')return callback(false);
   if(status==='not-determined'){try{return callback(await systemPreferences.askForMediaAccess('microphone'));}catch{return callback(false);}}
  }
  callback(true);
 });
 ipcMain.on('rinraku:state',(event,state)=>{if(trusted(event))server.setState(state);});
 ipcMain.on('rinraku:output',event=>{
  if(!trusted(event))return;
  if(output&&!output.isDestroyed()){output.show();output.focus();return;}
  output=secureWindow({title:'RinPNGTube – OBS',width:800,height:800,transparent:true,backgroundColor:'#00000000',frame:false,resizable:false,hasShadow:false});
  output.on('closed',()=>{output=null;});void output.loadURL(server.url+'?overlay=1');
 });
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(process.platform==='darwin'?[{role:'appMenu'}]:[]),
  {label:'Bearbeiten',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'Fenster',submenu:[{role:'minimize'},{role:'close'}]},
 ]));
 editor=secureWindow({title:'RinPNGTube',width:1180,height:900,minWidth:720,minHeight:600,backgroundColor:'#111018'});
 editor.on('closed',()=>app.quit());
 await editor.loadURL(server.url);
}
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{void server?.close();});
main().catch(error=>{console.error(error);dialog.showErrorBox('RinPNGTube konnte nicht starten',error.message);app.quit();});
