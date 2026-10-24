import {_electron,expect} from '@playwright/test';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp=mkdtempSync(path.join(os.tmpdir(),'rinraku-permissions-'));
const executablePath=process.argv[2];let app;
const report={platform:process.platform,packaged:!!executablePath,checks:[],success:false};
try{
 app=await _electron.launch({executablePath,args:[...(!executablePath?[process.cwd()]:[]),`--user-data-dir=${temp}`,'--use-fake-device-for-media-stream']});
 const page=await app.firstWindow();await expect(page.locator('#micButton')).toBeVisible();
 await app.evaluate(({systemPreferences})=>{systemPreferences.getMediaAccessStatus=()=> 'denied';systemPreferences.askForMediaAccess=async()=>{throw new Error('OS prompt must never be requested for denied status');};});
 await page.locator('#micButton').click();await expect(page.locator('#micStat')).toContainText('Mikrofonzugriff verweigert');
 await expect(page.locator('#micButton')).toHaveText('Mikrofon starten');report.checks.push('Real Electron permission handler rejects denied macOS status and shows recovery guidance');
 await app.evaluate(({systemPreferences})=>{systemPreferences.getMediaAccessStatus=()=> 'granted';});
 await page.locator('#micButton').click();await expect(page.locator('#micButton')).toHaveText('Mikrofon stoppen');
 await expect.poll(()=>page.locator('#meter').getAttribute('aria-valuenow').then(Number),{intervals:[40],timeout:10000}).toBeGreaterThan(1);
 await page.locator('#micButton').click();report.checks.push('Explicit retry after permission change succeeds through real permission handler');
 const camera=await page.evaluate(async()=>{try{await navigator.mediaDevices.getUserMedia({video:true});return 'unexpected grant';}catch(e){return e.name;}});
 assert.equal(camera,'NotAllowedError');report.checks.push('Camera access denied');
 const next=app.waitForEvent('window');await page.locator('#overlayTab').click();const output=await next;
 const outputMic=await output.evaluate(async()=>{try{await navigator.mediaDevices.getUserMedia({audio:true});return 'unexpected grant';}catch(e){return e.name;}});
 assert.equal(outputMic,'NotAllowedError');report.checks.push('Output window cannot request microphone');report.success=true;
}catch(e){report.failure=String(e.stack);throw e;}finally{if(app)await app.close();rmSync(temp,{recursive:true,force:true});mkdirSync('verification',{recursive:true});writeFileSync('verification/permissions-report.json',JSON.stringify(report,null,2));console.log(report);}
