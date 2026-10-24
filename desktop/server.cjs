'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const defaults = {talking:false,eyesClosed:false,crying:false,scale:80,x:50,y:0,mirror:false,chroma:false};
function validateState(value) {
 if (!value || typeof value !== 'object') return null;
 const next = {};
 for (const k of ['talking','eyesClosed','crying','mirror']) {if(typeof value[k] !== 'boolean') return null; next[k]=value[k];}
 next.chroma = value.chroma === true;
 for (const [k,min,max] of [['scale',20,150],['x',0,100],['y',0,100]]) {if(!Number.isFinite(value[k])||value[k]<min||value[k]>max)return null; next[k]=value[k];}
 return next;
}
async function startServer(assets) {
 let state = {...defaults};
 const root = path.join(__dirname,'../app');
 const files = new Map([['/','index.html'],['/index.html','index.html'],['/studio.css','studio.css'],['/studio.mjs','studio.mjs'],['/microphone.mjs','microphone.mjs']]);
 for(const name of await fs.readdir(path.join(root,'assets'))) if(name.endsWith('.png'))files.set('/assets/'+name,'assets/'+name);
 let origin;
 const server = http.createServer(async (req,res) => {
  const end=(status,body='')=>{res.writeHead(status);res.end(body);};
  if(req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site']==='cross-site')return end(403);
  if(req.method!=='GET')return end(405);
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  let route; try {route=decodeURIComponent(new URL(req.url,origin).pathname);}catch{return end(400);}
  if(route==='/api/state'){res.setHeader('Content-Type','application/json'); return end(200,JSON.stringify(assets?{...state,sources:assets.sources()}:state));}
  const custom=/^\/custom\/(neutral|talk|sleep|sleepTalk|cry)\.png$/.exec(route);
  if(custom&&assets){try{const data=await assets.read(custom[1]);if(!data)return end(404);res.setHeader('Content-Type','image/png');return end(200,data);}catch{return end(404);}}
  const filename=files.get(route); if(!filename)return end(404);
  try {const data=await fs.readFile(path.join(root,filename)); res.setHeader('Content-Type',filename.endsWith('.png')?'image/png':filename.endsWith('.css')?'text/css; charset=utf-8':filename.endsWith('.mjs')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');end(200,data);}catch{return end(500);}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 origin=`http://127.0.0.1:${server.address().port}`;
 return {url:origin+'/',setState(value){const next=validateState(value);if(next)state=next;return !!next;},close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={startServer,validateState};
