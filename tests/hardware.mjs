import {_electron,expect} from '@playwright/test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';import os from 'node:os';import path from 'node:path';
const profile=mkdtempSync(path.join(os.tmpdir(),'rinraku-hardware-'));let app;
const report={platform:process.platform,arch:process.arch,syntheticAudio:false,audioRecorded:false};
try{
 app=await _electron.launch({executablePath:process.argv[2],args:[`--user-data-dir=${profile}`]});
 const page=await app.firstWindow();await expect(page.locator('#micButton')).toHaveText('Mikrofon starten');
 report.osPermission=await app.evaluate(({systemPreferences})=>systemPreferences.getMediaAccessStatus('microphone'));
 if(report.osPermission!=='granted'){report.skipped='No existing OS grant; no permission dialog accepted.';}
 else{
  await page.evaluate(async()=>{const {Microphone}=await import('/microphone.mjs');const level=Microphone.prototype.level;Microphone.prototype.level=function(){window.__qaMic=this;return level.call(this);};});
  await page.locator('#micButton').click();await expect(page.locator('#micButton')).toHaveText('Mikrofon stoppen');
  report.observation=await page.evaluate(async()=>{let max=0;for(let i=0;i<40;i++){max=Math.max(max,Number(document.getElementById('meter').getAttribute('aria-valuenow')));await new Promise(r=>setTimeout(r,50));}const mic=window.__qaMic;window.__qaTrack=mic.stream.getAudioTracks()[0];return {maxLevel:max,context:mic.context.state,trackState:window.__qaTrack.readyState,muted:window.__qaTrack.muted};});
  await page.locator('#micButton').click();await expect(page.locator('#micButton')).toHaveText('Mikrofon starten');
  report.trackAfterStop=await page.evaluate(()=>window.__qaTrack.readyState);
  report.success=report.observation.context==='running'&&report.observation.trackState==='live'&&report.trackAfterStop==='ended';
 }
} catch(e){report.success=false;report.error=String(e.stack);throw e;}finally{if(app)await app.close();rmSync(profile,{recursive:true,force:true});writeFileSync('verification/hardware-report.json',JSON.stringify(report,null,2));console.log(report);}
