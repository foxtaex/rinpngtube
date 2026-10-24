// Deterministic app-icon composition from the supplied character, NOT a newly generated avatar.
import {_electron} from '@playwright/test';
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
const temp=mkdtempSync(path.join(os.tmpdir(),'rinpng-icon-'));let app;
try{
 app=await _electron.launch({args:[process.cwd(),`--user-data-dir=${temp}`]});
 const page=await app.firstWindow();
 const data=await page.evaluate(async()=>{
  const image=new Image();image.src='/assets/01_Neutral_Augen_offen_Mund_zu.png';await image.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');
  c.beginPath();c.roundRect(24,24,976,976,210);c.clip();
  const bg=c.createLinearGradient(0,0,1024,1024);bg.addColorStop(0,'#412638');bg.addColorStop(1,'#17121f');c.fillStyle=bg;c.fillRect(0,0,1024,1024);
  c.drawImage(image,36,30,952,952);
  c.fillStyle='#8a375a';c.beginPath();c.roundRect(724,736,242,242,80);c.fill();
  c.strokeStyle='#fff1f6';c.lineWidth=22;c.lineCap='round';
  [50,108,156,94,40].forEach((h,i)=>{const x=778+i*34;c.beginPath();c.moveTo(x,857-h/2);c.lineTo(x,857+h/2);c.stroke();});
  return canvas.toDataURL('image/png').split(',')[1];
 });
 mkdirSync('build',{recursive:true});writeFileSync('build/icon.png',Buffer.from(data,'base64'));console.log('build/icon.png: 1024px app icon composed from unchanged original character');
}finally{if(app)await app.close();rmSync(temp,{recursive:true,force:true});}
