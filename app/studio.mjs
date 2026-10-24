import {Microphone, microphoneError} from './microphone.mjs';
const $ = id => document.getElementById(id);
const overlay = new URLSearchParams(location.search).has('overlay');
const defaults = {talking:false, eyesClosed:false, crying:false, scale:80, x:50, y:0, mirror:false, chroma:false};
let state = {...defaults};
const sources = {neutral:'assets/01_Neutral_Augen_offen_Mund_zu.png',talk:'assets/02_Sprechen_Augen_offen_Mund_auf.png',cry:'assets/03_Weinen.png',sleep:'assets/04_Augen_geschlossen_Mund_zu.png',sleepTalk:'assets/05_Augen_geschlossen_Mund_auf.png'};
Object.values(sources).forEach(src => {const image=new Image();image.src=src;});
let current='';
function render() {
 const images={...sources,...state.sources};
 const src=state.crying?images.cry:state.eyesClosed?(state.talking?images.sleepTalk:images.sleep):(state.talking?images.talk:images.neutral);
 if(current!==src){$('avatar').src=src;current=src;}
 Object.assign($('avatar').style,{height:state.scale+'%',left:state.x+'%',bottom:state.y+'%',transform:`translateX(-50%) scaleX(${state.mirror?-1:1})`});
 document.body.classList.toggle('chroma',state.chroma);
 if(!overlay){$('poseLabel').textContent=state.crying?'Weinen':state.eyesClosed?'Blinzeln':state.talking?'Spricht':'Neutral';}
}
function update(){render();if(!overlay)window.rinraku?.publish(state);}
if(overlay){
 document.body.classList.add('overlay');
 // OBS browser sources do not have IPC; the local read-only endpoint preserves that workflow.
 const poll=async()=>{try{const r=await fetch('/api/state');if(r.ok){state=await r.json();render();}}catch{}};
 await poll();setInterval(poll,55);
}else{
 const tabs=[...document.querySelectorAll('[role="tab"]')];
 function selectPanel(tab){
  for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;$('panel-'+item.dataset.panel).hidden=!selected;}
 }
 tabs.forEach((tab,index)=>{
  tab.onclick=()=>selectPanel(tab);
  tab.onkeydown=event=>{
   let next;
   if(event.key==='ArrowRight')next=(index+1)%tabs.length;
   if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
   if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;
   if(next!==undefined){event.preventDefault();selectPanel(tabs[next]);tabs[next].focus();}
  };
 });
 const assetButtons=[...document.querySelectorAll('[data-slot]')];
 assetButtons.forEach(button=>button.onclick=()=>{$('assetSlot').value=button.dataset.slot;assetPreview();});
 try{const saved=await (await fetch('/api/state')).json();state.sources=saved.sources||{};}catch{state.sources={};}
 function assetPreview(){
  const slot=$('assetSlot').value;
  $('assetPreview').src=state.sources?.[slot]||sources[slot];
  $('restorePng').disabled=!state.sources?.[slot];
  $('assetStatus').textContent=state.sources?.[slot]?'Eigenes PNG · lokal gespeichert':'Originalbild';
  for(const button of assetButtons){
   const key=button.dataset.slot;button.setAttribute('aria-pressed',String(key===slot));
   button.querySelector('img').src=state.sources?.[key]||sources[key];
   button.querySelector('.asset-origin').textContent=state.sources?.[key]?'Eigenes':'Original';
   if(key===slot)$('selectedAssetName').textContent=button.querySelector('strong').textContent;
  }
 }
 $('assetSlot').onchange=assetPreview;
 async function changeAsset(restore){
  const slot=$('assetSlot').value;
  $('importPng').disabled=true;$('restorePng').disabled=true;$('assetSlot').disabled=true;
  assetButtons.forEach(button=>button.disabled=true);
  try{
   const result=await window.rinraku[restore?'restorePng':'importPng'](slot);
   if(result.sources){state.sources=result.sources;update();}
   assetPreview();
   if(result.error)$('assetStatus').textContent=result.error;
  }catch{$('assetStatus').textContent='Bild konnte nicht gespeichert werden. Bitte erneut versuchen.';}
  finally{$('importPng').disabled=false;$('assetSlot').disabled=false;$('restorePng').disabled=!state.sources?.[slot];assetButtons.forEach(button=>button.disabled=false);}
 }
 $('importPng').onclick=()=>void changeAsset(false);
 $('restorePng').onclick=()=>void changeAsset(true);
 assetPreview();
 $('serverStatus').textContent='Desktop · nur lokal';
 $('obsUrl').textContent=location.origin+'/?overlay=1';
 let manualTalk=false,blinking=true,nextBlink=performance.now()+2600,blinkUntil=0,lastTalk=-Infinity,attackSince=null,deviceGeneration=0;
 const status=text=>$('micStat').textContent=text;
 const mic=new Microphone({onEnded(){status('Mikrofon getrennt. Gerät anschließen und erneut starten.');syncMic();}});
 function syncMic(){
  $('micButton').textContent=mic.starting?'Start abbrechen':mic.active?'Mikrofon stoppen':'Mikrofon starten';
  if(!mic.active){$('meter').style.width='0%';$('meter').setAttribute('aria-valuenow','0');lastTalk=-Infinity;attackSince=null;state.talking=false;update();}
 }
 async function loadDevices(){
  const generation=++deviceGeneration;
  try{
   const devices=await navigator.mediaDevices.enumerateDevices();if(generation!==deviceGeneration)return;
   const select=$('micro'),old=select.value;
   select.replaceChildren(new Option('Standardmikrofon',''));
   devices.filter(d=>d.kind==='audioinput').forEach((d,i)=>select.add(new Option(d.label||`Mikrofon ${i+1}`,d.deviceId)));
   if(old&&!devices.some(d=>d.deviceId===old)){select.add(new Option('Nicht verbunden – anderes Gerät wählen',old)); if(mic.active||mic.starting){mic.stop();syncMic();status('Gewähltes Mikrofon getrennt. Bitte anderes Gerät wählen.');}}
   select.value=old;
  }catch{if(generation===deviceGeneration)status('Geräteliste nicht verfügbar. Mikrofonzugriff prüfen.');}
 }
 async function start(){
  const pending=mic.start($('micro').value);syncMic();status('Mikrofon wird gestartet …');
  try{await pending;syncMic();if(mic.active){await loadDevices();status('Mikrofon aktiv');}}catch(error){syncMic();status(microphoneError(error));}
 }
 $('micButton').onclick=()=>{if(mic.active||mic.starting){mic.stop();syncMic();status('Mikrofon aus');}else void start();};
 $('micro').onchange=()=>{const restart=mic.active||mic.starting;mic.stop();syncMic();if(restart)void start();};
 navigator.mediaDevices?.addEventListener('devicechange',loadDevices);void loadDevices();
 function frame(){
  const now=performance.now();
  if(mic.active){try{
   const level=mic.level();
   $('meter').style.width=Math.min(level*3,100)+'%';$('meter').setAttribute('aria-valuenow',String(Math.min(level,100)));
   status('Pegel: '+level.toFixed(1)+' | '+(state.talking?'Spricht':'Still'));
   const threshold=Number($('threshold').value)*.5;
   // Separate opening/closing levels keep quiet syllables from fluttering at the threshold.
   // Use audio history, not the manual pose or blinking, to decide whether speech continues.
   const speaking=now-lastTalk<Number($('hold').value);
   if(speaking){
    attackSince=null;
    if(level>threshold*.65)lastTalk=now;
   }else if(level>threshold){
    // Require a short onset, not a single noisy frame; normal speech stays responsive.
    attackSince??=now;
    if(now-attackSince>=25){lastTalk=now;attackSince=null;}
   }else attackSince=null;
  }catch(error){mic.stop();syncMic();status(microphoneError(error));}}
  if(blinking&&now>=nextBlink){blinkUntil=now+140;nextBlink=now+2500+Math.random()*3700;}
  const eyes=blinking&&now<blinkUntil,talking=$('manual').checked?manualTalk:mic.active&&(now-lastTalk<Number($('hold').value));
  if(state.eyesClosed!==eyes||state.talking!==talking){state.eyesClosed=eyes;state.talking=talking;update();}
  requestAnimationFrame(frame);
 }
 function cry(value){state.crying=value;$('cry').textContent=value?'Weinen: An':'Weinen: Aus';$('cry').setAttribute('aria-pressed',String(value));update();}
 $('cry').onclick=()=>cry(!state.crying);
 $('blink').onclick=()=>{blinking=!blinking;state.eyesClosed=false;$('blink').textContent='Blinzeln: '+(blinking?'An':'Aus');$('blink').setAttribute('aria-pressed',String(blinking));update();};
 $('open').onclick=()=>{manualTalk=true;$('manual').checked=true;state.talking=true;update();};
 $('close').onclick=()=>{manualTalk=false;$('manual').checked=true;state.talking=false;update();};
 for(const k of ['threshold','hold'])$(k).oninput=()=>$(k+'Text').textContent=$(k).value;
 for(const k of ['scale','x','y'])$(k).oninput=()=>{state[k]=Number($(k).value);$(k+'Text').textContent=$(k).value+(k==='y'?'':'%');update();};
 $('mirror').onchange=()=>{state.mirror=$('mirror').checked;update();};
 $('chroma').onclick=()=>{state.chroma=!state.chroma;$('chroma').textContent='OBS-Grün: '+(state.chroma?'An':'Aus');$('chroma').setAttribute('aria-pressed',String(state.chroma));update();};
 $('preview').onclick=()=>{$('preview').setAttribute('aria-pressed',String($('stage').classList.toggle('checker')));};
 $('copy').onclick=async()=>{try{if(!await window.rinraku.copyOutputUrl())throw Error('Nicht erlaubt');$('copy').textContent='✓ Kopiert!';}catch{$('copy').textContent='Bitte Link oben manuell kopieren';}};
 $('overlayTab').onclick=()=>window.rinraku?.openOutput();
 $('reset').onclick=()=>{
  state={...defaults,sources:state.sources};manualTalk=false;blinking=true;lastTalk=-Infinity;attackSince=null;$('manual').checked=false;
  for(const k of ['scale','x','y']){$(k).value=state[k];$(k+'Text').textContent=state[k]+(k==='y'?'':'%');}
  for(const [k,v]of [['threshold',4],['hold',170]]){$(k).value=v;$(k+'Text').textContent=v;}
  $('mirror').checked=false;$('blink').textContent='Blinzeln: An';$('blink').setAttribute('aria-pressed','true');$('chroma').textContent='OBS-Grün: Aus';$('chroma').setAttribute('aria-pressed','false');cry(false);
 };
 document.addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON'].includes(document.activeElement?.tagName))return;if(e.key==='1'||e.key==='2')cry(e.key==='2');if(e.code==='Space'&&$('manual').checked){e.preventDefault();manualTalk=!manualTalk;update();}});
 window.addEventListener('beforeunload',()=>mic.stop());
 requestAnimationFrame(frame);update();
}
render();
