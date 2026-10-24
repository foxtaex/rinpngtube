import {_electron,expect} from '@playwright/test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
const profile=mkdtempSync(path.join(os.tmpdir(),'rinraku-normal-'));
let app;
try{
 app=await _electron.launch({executablePath:process.argv[2],args:[`--user-data-dir=${profile}`]});
 const page=await app.firstWindow();await expect(page.locator('#micButton')).toHaveText('Mikrofon starten');
 await expect.poll(()=>page.locator('#avatar').evaluate(i=>i.naturalWidth)).toBeGreaterThan(100);
 const osStatus=await app.evaluate(({systemPreferences,app})=>({packaged:app.isPackaged,microphoneStatus:systemPreferences.getMediaAccessStatus('microphone')}));
 const devices=await page.evaluate(async()=>{const ds=await navigator.mediaDevices.enumerateDevices();return {audioInputCount:ds.filter(d=>d.kind==='audioinput').length,secureContext:window.isSecureContext};});
 await page.screenshot({path:'verification/normal-packaged-launch.png'});
 const report={success:true,platform:process.platform,arch:process.arch,...osStatus,...devices,note:'No fake-device flags, no microphone capture and no OS dialog accepted. Hardware speech not tested.'};
 writeFileSync('verification/normal-launch-report.json',JSON.stringify(report,null,2));console.log(report);
}finally{if(app)await app.close();rmSync(profile,{recursive:true,force:true});}
