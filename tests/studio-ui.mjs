import {_electron,expect} from '@playwright/test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const exe=process.argv[2],temp=mkdtempSync(path.join(os.tmpdir(),'rin-ui-'));
const report={packaged:!!exe,checks:[],errors:[]};let app;
try{
 app=await _electron.launch({executablePath:exe,args:[...(!exe?[process.cwd()]:[]),`--user-data-dir=${temp}`]});
 const page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));
 await expect(page.getByRole('tab',{name:'Bilder',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('tabpanel',{name:'Bilder',exact:true})).toBeVisible();
 await expect(page.locator('[data-slot]')).toHaveCount(5);
 for(const slot of ['neutral','talk','sleep','sleepTalk','cry']){
  const button=page.locator(`[data-slot="${slot}"]`);await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>button.locator('img').evaluate(i=>i.naturalWidth)).toBeGreaterThan(100);
  await expect(page.locator('#assetSlot')).toHaveValue(slot);
 }
 await page.getByRole('tab',{name:'Bilder',exact:true}).focus();await page.keyboard.press('ArrowRight');
 await expect(page.getByRole('tab',{name:'Mikrofon',exact:true})).toBeFocused();
 await expect(page.getByRole('tabpanel',{name:'Mikrofon',exact:true})).toBeVisible();
 await page.getByLabel('Empfindlichkeit').fill('9');await expect(page.locator('#thresholdText')).toHaveText('9');
 await page.keyboard.press('Tab');
 await page.getByRole('tab',{name:'Bewegung',exact:true}).click();
 await page.locator('#mirror').check();await expect(page.locator('#avatar')).toHaveCSS('transform',/matrix\(-1/);
 await page.locator('#cry').click();await expect(page.locator('#cry')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('tab',{name:'Ausgabe',exact:true}).click();
 await page.locator('#reset').click();await expect(page.locator('#mirror')).not.toBeChecked();
 await page.locator('#copy').click();
 await expect(page.locator('#copy')).toHaveText('✓ Kopiert!');
 const copied=await app.evaluate(({clipboard})=>clipboard.readText());assert.equal(copied,await page.locator('#obsUrl').textContent());
 await page.locator('#preview').click();await expect(page.locator('#preview')).toHaveAttribute('aria-pressed','false');await expect(page.locator('#stage')).not.toHaveClass(/checker/);await page.locator('#preview').click();
 await page.getByRole('tab',{name:'Bewegung',exact:true}).click();
 for(const [id,value] of [['scale','65'],['x','40'],['y','10']])await page.locator('#'+id).fill(value);
 await expect(page.locator('#avatar')).toHaveCSS('height',/px$/);
 const state=await page.evaluate(async()=>await(await fetch('/api/state')).json());assert.equal(state.scale,65);assert.equal(state.x,40);assert.equal(state.y,10);
 await page.getByRole('tab',{name:'Ausgabe',exact:true}).click();await page.locator('#reset').click();
 for(const name of ['Mikrofon','Bewegung','Ausgabe']){await page.getByRole('tab',{name,exact:true}).click();await page.screenshot({path:`verification/${exe?'packaged':'source'}-${name.toLowerCase()}.png`});}
 report.checks.push('Clipboard OBS link, preview background toggle, position/scale IPC and all inspector screenshots');
 report.checks.push('Five real thumbnails, slot selection, keyboard tabs, labelled sliders, mirror, toggle semantics and reset');
 for(const [width,height] of [[1180,900],[900,680],[720,600]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);
  await page.getByRole('tab',{name:'Bilder',exact:true}).click();
  await page.locator('[data-slot="neutral"]').click();
  await expect(page.locator('#micButton')).toBeInViewport();await expect(page.locator('#overlayTab')).toBeInViewport();
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,stage:document.getElementById('stage').getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight}));
  assert.equal(layout.overflow,false);assert.ok(layout.stage.width>250);assert.ok(Math.abs(layout.stage.width-layout.stage.height)<2);
  await page.screenshot({path:`verification/${exe?'packaged':'source'}-studio-${width}.png`});
  for(const name of ['Mikrofon','Bewegung','Ausgabe']){await page.getByRole('tab',{name,exact:true}).click();await expect(page.getByRole('tabpanel',{name,exact:true})).toBeVisible();}
 }
 report.checks.push('1180×900, 900×680, 720×600: square canvas, no horizontal overflow, persistent audio/output actions');
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.success=false;report.error=String(error.stack);throw error;}finally{if(app)await app.close();rmSync(temp,{recursive:true,force:true});writeFileSync(`verification/${exe?'packaged':'source'}-ui-report.json`,JSON.stringify(report,null,2));console.log(report);}
