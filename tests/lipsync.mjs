import {_electron,expect} from '@playwright/test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const exe=process.argv[2],temp=mkdtempSync(path.join(os.tmpdir(),'rinraku-lipsync-'));
const report={mode:exe?'packaged':'source',syntheticAudio:true,checks:[],errors:[]};
let app;
try{
 app=await _electron.launch({executablePath:exe,args:[...(!exe?[process.cwd()]:[]),`--user-data-dir=${temp}`],timeout:30000});
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 await expect(page.locator('#micButton')).toHaveText('Mikrofon starten');
 // A controlled waveform, not a mocked level(): real stream -> real microphone analyser -> renderer -> IPC -> output.
 await page.evaluate(async()=>{
  const context=new AudioContext({sinkId:{type:'none'}}),oscillator=context.createOscillator(),gain=context.createGain(),destination=context.createMediaStreamDestination();
  oscillator.frequency.value=180;gain.gain.value=0;oscillator.connect(gain);gain.connect(destination);oscillator.start();await context.resume();
  navigator.mediaDevices.getUserMedia=async()=>destination.stream;
  window.qaAudio={context,gain};
 });
 const next=app.waitForEvent('window');await page.locator('#overlayTab').click();const output=await next;
 await page.locator('#micButton').click();await expect(page.locator('#micButton')).toHaveText('Mikrofon stoppen');
 const amplitude=async value=>page.evaluate(value=>window.qaAudio.gain.gain.setValueAtTime(value,window.qaAudio.context.currentTime),value);
 const open=/02_Sprechen|05_Augen/,closed=/01_Neutral|04_Augen/;
 await expect(page.locator('#avatar')).toHaveAttribute('src',closed);
 await amplitude(.04);await expect(page.locator('#avatar')).toHaveAttribute('src',open);await expect(output.locator('#avatar')).toHaveAttribute('src',open);
 await amplitude(.025);
 const samples=await page.evaluate(async()=>{const samples=[];for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,50));samples.push({pose:document.getElementById('avatar').getAttribute('src'),level:Number(document.getElementById('meter').getAttribute('aria-valuenow'))});}return samples;});
 assert.ok(samples.every(s=>open.test(s.pose)),'quieter ongoing syllable must stay open beyond hold');
 assert.ok(samples.slice(4).every(s=>s.level>1.3&&s.level<2),'waveform must lie between closing and opening thresholds');
 report.samples=samples;report.checks.push('Real analyser receives quieter waveform between thresholds; mouth stays open for 2s, output synchronized');
 await amplitude(0);await expect(page.locator('#avatar')).toHaveAttribute('src',closed,{timeout:1500});await expect(output.locator('#avatar')).toHaveAttribute('src',closed);
 await amplitude(.025);
 await page.waitForTimeout(400);await expect(page.locator('#avatar')).toHaveAttribute('src',closed);
 await amplitude(.04);await expect(page.locator('#avatar')).toHaveAttribute('src',open);
 await page.locator('#micButton').click();await expect(page.locator('#avatar')).toHaveAttribute('src',closed);await expect(output.locator('#avatar')).toHaveAttribute('src',closed);
 report.checks.push('Silence closes; below-opening audio cannot reopen; stronger audio reopens; stop closes both windows');
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.success=false;report.failure=String(error.stack);throw error;}finally{
 if(app)await app.close();mkdirSync('verification',{recursive:true});writeFileSync(`verification/${report.mode}-lipsync-report.json`,JSON.stringify(report,null,2));rmSync(temp,{recursive:true,force:true});console.log(JSON.stringify(report,null,2));
}
