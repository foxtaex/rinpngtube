'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const slots=['neutral','talk','sleep','sleepTalk','cry'];
const MAX_BYTES=12*1024*1024;
async function createAssetStore(directory,decode){
 await fs.mkdir(directory,{recursive:true});
 const versions={};
 function checkSlot(slot){if(!slots.includes(slot))throw Error('Unbekannter Bildzustand.');}
 function validate(data){
  if(!Buffer.isBuffer(data)||data.length<33||data.length>MAX_BYTES||!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||data.toString('ascii',12,16)!=='IHDR')throw Error('Bitte eine gültige PNG-Datei bis 12 MiB wählen.');
  const w=data.readUInt32BE(16),h=data.readUInt32BE(20);
  if(!w||!h||w>4096||h>4096||w*h>16777216)throw Error('PNG darf höchstens 4096 × 4096 Pixel groß sein.');
  if(!decode(data))throw Error('Die PNG-Datei ist beschädigt oder nicht lesbar.');
 }
 const version=data=>createHash('sha256').update(data).digest('hex').slice(0,16);
 for(const slot of slots){try{const data=await fs.readFile(path.join(directory,slot+'.png'));validate(data);versions[slot]=version(data);}catch{}}
 return {
  sources(){return Object.fromEntries(Object.entries(versions).map(([slot,v])=>[slot,`/custom/${slot}.png?v=${v}`]));},
  async read(slot){checkSlot(slot);if(!versions[slot])return null;return fs.readFile(path.join(directory,slot+'.png'));},
  async save(slot,data){checkSlot(slot);validate(data);const temp=path.join(directory,randomUUID()+'.tmp');try{await fs.writeFile(temp,data,{flag:'wx'});await fs.rename(temp,path.join(directory,slot+'.png'));versions[slot]=version(data);}finally{await fs.rm(temp,{force:true});}return this.sources();},
  async remove(slot){checkSlot(slot);await fs.rm(path.join(directory,slot+'.png'),{force:true});delete versions[slot];return this.sources();}
 };
}
module.exports={createAssetStore,slots,MAX_BYTES};
