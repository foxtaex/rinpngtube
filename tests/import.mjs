import {_electron,expect} from '@playwright/test';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),exe=process.argv[2],temp=mkdtempSync(path.join(os.tmpdir(),'rinpng-import-'));
let app;const report={platform:process.platform,arch:process.arch,packaged:!!exe,checks:[]};
const launch=()=>_electron.launch({executablePath:exe,args:[...(!exe?[root]:[]),`--user-data-dir=${temp}/profile`],timeout:30000});
try{
 app=await launch();let page=await app.firstWindow();
 await expect(page.locator('h1')).toHaveText('RinPNGTube');
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},path.join(root,'app/assets/02_Sprechen_Augen_offen_Mund_auf.png'));
 await page.locator('[data-slot="neutral"]').click();await page.locator('#importPng').click();
 await expect(page.locator('#assetStatus')).toContainText('gespeichert');
 await expect(page.locator('#assetPreview')).toHaveAttribute('src',/custom\/neutral/);
 await page.getByRole('tab',{name:'Bewegung',exact:true}).click();
 await page.locator('#blink').click();await page.locator('#close').click();
 await expect(page.locator('#avatar')).toHaveAttribute('src',/custom\/neutral/);
 const next=app.waitForEvent('window');await page.locator('#overlayTab').click();const output=await next;
 await expect(output.locator('#avatar')).toHaveAttribute('src',/custom\/neutral/);
 report.checks.push('Native file chooser → validated copy → preview/editor/output');
 const forbidden=await output.evaluate(()=>window.rinraku.restorePng('neutral'));assert.ok(forbidden.error);
 const traversal=await page.evaluate(()=>window.rinraku.restorePng('../escape'));assert.ok(traversal.error);
 for(const slot of ['talk','sleep','sleepTalk','cry']){
  await page.getByRole('tab',{name:'Bilder',exact:true}).click();
  await page.locator(`[data-slot="${slot}"]`).click();await page.locator('#importPng').click();
  await expect(page.locator('#assetPreview')).toHaveAttribute('src',new RegExp(`custom/${slot}.png`));
  await expect(page.locator(`[data-slot="${slot}"] img`)).toHaveAttribute('src',new RegExp(`custom/${slot}.png`));
 }
 await page.locator('[data-slot="neutral"]').click();
 await page.getByRole('tab',{name:'Ausgabe',exact:true}).click();
 await page.locator('#reset').click();await expect(page.locator('#assetPreview')).toHaveAttribute('src',/custom\/neutral/);
 await page.getByRole('tab',{name:'Bilder',exact:true}).click();
 await page.screenshot({path:`verification/${exe?'packaged':'source'}-import.png`});
 report.checks.push('All five slots import; reset preserves PNGs; output-window writes and path traversal denied');
 const bad=path.join(temp,'bad.png');writeFileSync(bad,'<svg/>');
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},bad);
 await page.locator('#importPng').click();await expect(page.locator('#assetStatus')).toContainText('gültige PNG');
 await expect(page.locator('#assetPreview')).toHaveAttribute('src',/custom\/neutral/);
 report.checks.push('Invalid PNG rejected without changing saved slot');
 await app.close();app=await launch();page=await app.firstWindow();
 await expect(page.locator('#assetPreview')).toHaveAttribute('src',/custom\/neutral/);
 await expect.poll(()=>page.locator('#assetPreview').evaluate(i=>i.naturalWidth)).toBeGreaterThan(100);
 report.checks.push('Saved PNG survives full application restart with changed HTTP port');
 for(const slot of ['talk','sleep','sleepTalk','cry']){
  await page.locator(`[data-slot="${slot}"]`).click();await expect(page.locator('#assetPreview')).toHaveAttribute('src',new RegExp(`custom/${slot}.png`));
 }
 await page.locator('[data-slot="neutral"]').click();
 await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
 await page.locator('#importPng').click();await expect(page.locator('#assetPreview')).toHaveAttribute('src',/custom\/neutral/);
 await page.locator('#restorePng').click();await expect(page.locator('#assetPreview')).toHaveAttribute('src',/01_Neutral/);
 await app.close();app=await launch();page=await app.firstWindow();await expect(page.locator('#assetPreview')).toHaveAttribute('src',/01_Neutral/);
 report.checks.push('Cancel preserves slot; explicit per-slot original restore survives restart');
 assert.equal(await app.evaluate(({app})=>app.getName()),'RinPNGTube');report.success=true;
}catch(error){report.success=false;report.error=String(error.stack);throw error;}finally{if(app)await app.close();mkdirSync('verification',{recursive:true});writeFileSync(`verification/${exe?'packaged':'source'}-import-report.json`,JSON.stringify(report,null,2));rmSync(temp,{recursive:true,force:true});console.log(report);}
