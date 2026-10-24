import {_electron,expect} from '@playwright/test';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=process.cwd(),exe=process.argv[2];
const temp=mkdtempSync(path.join(os.tmpdir(),'rinraku-qa-'));

mkdirSync('verification',{recursive:true});
const report={platform:process.platform,arch:process.arch,mode:exe?'packaged':'source',syntheticAudio:true,checks:[],errors:[]};
let app;
try{
 // Chromium's built-in synthetic beep input works without disabling any sandbox.
 app=await _electron.launch({executablePath:exe,args:[...(!exe?[root]:[]),`--user-data-dir=${temp}/profile`,'--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'],timeout:30000});
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 app.process().stderr.on('data',data=>{report.stderr=(report.stderr||'')+String(data);});
 await expect(page.locator('h1')).toHaveText('RinPNGTube');
 await expect.poll(()=>page.locator('#avatar').evaluate(i=>i.naturalWidth)).toBeGreaterThan(100);
 await expect(page.locator('#micButton')).toHaveText('Mikrofon starten');
 report.checks.push('RinPNGTube studio and original avatar loaded; microphone off by default');
 const next=app.waitForEvent('window');await page.locator('#overlayTab').click();const output=await next;
 await expect.poll(()=>output.locator('#avatar').evaluate(i=>i.naturalWidth)).toBeGreaterThan(100);
 assert.equal(await output.evaluate(()=>window.rinraku.copyOutputUrl()),false,'output must not write clipboard');
 await page.getByRole('tab',{name:'Bewegung',exact:true}).click();
 await page.locator('#cry').click();await expect.poll(()=>output.locator('#avatar').getAttribute('src')).toContain('03_Weinen');
 await page.locator('#cry').click();
 await page.locator('#open').click();await expect.poll(()=>output.locator('#avatar').getAttribute('src')).toMatch(/02_Sprechen|05_Augen/);
 await page.getByRole('tab',{name:'Ausgabe',exact:true}).click();
 await page.locator('#reset').click();await expect(page.locator('#manual')).not.toBeChecked();
 const windows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({url:w.webContents.getURL(),resizable:w.isResizable(),background:w.getBackgroundColor(),backgroundThrottling:w.webContents.getBackgroundThrottling(),prefs:w.webContents.getLastWebPreferences()})));
 report.windows=windows;
 assert.equal(windows.length,2);for(const win of windows){assert.equal(win.prefs.sandbox,true);assert.equal(win.prefs.nodeIntegration,false);assert.equal(win.backgroundThrottling,false);}
 assert.equal(windows.find(w=>w.url.includes('overlay')).resizable,false);
 assert.equal(await output.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
 report.checks.push('Second native transparent output window, cry/manual mouth/reset synchronize through local state');
 await page.getByRole('tab',{name:'Bilder',exact:true}).click();
 await page.screenshot({path:`verification/${report.mode}-studio.png`});
 await output.screenshot({path:`verification/${report.mode}-output.png`,omitBackground:true});
 const outputPixels=await output.screenshot({omitBackground:true});
 const cornerAlpha=await app.evaluate(({nativeImage},png)=>nativeImage.createFromBuffer(Buffer.from(png,'base64')).toBitmap()[3],outputPixels.toString('base64'));
 assert.equal(cornerAlpha,0,'output background must actually be transparent at the PNG pixel level');
 // Deliberately bypass only OS permission lookup in this test process, not a real user prompt.
 await app.evaluate(({systemPreferences})=>{systemPreferences.getMediaAccessStatus=()=> 'granted';systemPreferences.askForMediaAccess=async()=>true;});
 await page.evaluate(async()=>{const {Microphone}=await import('/microphone.mjs');const level=Microphone.prototype.level;Microphone.prototype.level=function(){window.__qaContext=this.context;window.__qaStream=this.stream;return level.call(this);};});
 await page.locator('#micButton').click();
 await expect(page.locator('#micButton')).toHaveText('Mikrofon stoppen',{timeout:15000});
 const samples=await page.evaluate(async()=>{const result=[];for(let i=0;i<55;i++){result.push({level:Number(document.getElementById('meter').getAttribute('aria-valuenow')),pose:document.getElementById('avatar').getAttribute('src')});await new Promise(r=>setTimeout(r,100));}return result;});
 report.audioDiagnostic=await page.evaluate(()=>({status:document.getElementById('micStat').textContent,context:window.__qaContext?.state,time:window.__qaContext?.currentTime,tracks:window.__qaStream?.getTracks().map(t=>({label:t.label,muted:t.muted,enabled:t.enabled,state:t.readyState,settings:t.getSettings()}))}));
 report.samples=samples;
 assert.ok(samples.some(s=>s.level>1),'Real Web Audio analyser must receive synthetic waveform');
 assert.ok(samples.some(s=>/02_Sprechen|05_Augen/.test(s.pose)),'Voice must animate mouth');
 assert.ok(samples.some(s=>/01_Neutral|04_Augen/.test(s.pose)),'Silence must close mouth');
 report.maxLevel=Math.max(...samples.map(s=>s.level));
 await page.locator('#micButton').click();await expect(page.locator('#micButton')).toHaveText('Mikrofon starten');
 await expect(page.locator('#meter')).toHaveAttribute('aria-valuenow','0');
 report.checks.push('Synthetic audio → real getUserMedia/Web Audio → meter → mouth/idle; stop clears meter');
 await page.getByRole('tab',{name:'Ausgabe',exact:true}).click();
 await page.locator('#chroma').click();await expect(output.locator('body')).toHaveClass(/chroma/);
 report.checks.push('OBS chroma-key fallback synchronized');
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.success=false;report.failure=String(error.stack);throw error;}finally{
 if(app)await app.close();writeFileSync(`verification/${report.mode}-report.json`,JSON.stringify(report,null,2));rmSync(temp,{recursive:true,force:true});console.log(JSON.stringify(report,null,2));
}
