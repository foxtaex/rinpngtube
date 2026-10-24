import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Run the actual renderer loop with a deterministic clock and microphone levels.
// Only browser/hardware boundaries are substituted, not the mouth decision logic.
async function studio() {
 const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{value:({threshold:4,hold:170})[id]??'',checked:false,style:{},classList:{toggle(){}},setAttribute(k,v){this[k]=v;},replaceChildren(){},add(){}});return elements.get(id);};
 let now=0,level=0,frame;
 class Microphone {active=false; async start(){this.active=true;} stop(){this.active=false;} level(){return level;}}
 const document={getElementById:el,querySelectorAll:()=>[],body:{classList:{toggle(){}}},addEventListener(){}};
 const window={rinraku:{publish(){}},addEventListener(){}};
 const navigator={mediaDevices:{enumerateDevices:async()=>[],addEventListener(){}}};
 const source=(await readFile(new URL('../app/studio.mjs',import.meta.url),'utf8')).replace(/^import .*\n/,'');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 await new AsyncFunction('Microphone','microphoneError','document','window','navigator','location','Image','Option','requestAnimationFrame','Date','performance',source)(Microphone,String,document,window,navigator,{search:'',origin:'http://localhost'},class{},class{},cb=>frame=cb,{now:()=>now},{now:()=>now});
 el('micButton').onclick();await new Promise(resolve=>setImmediate(resolve));
 return {el,step(t,v){now=t;level=v;frame();return /02_Sprechen|05_Augen/.test(el('avatar').src);}};
}

test('speech near opening threshold stays open rather than dropping out after hold',async()=>{
 const s=await studio();
 s.step(0,3);assert.equal(s.step(40,3),true);
 for(let t=60;t<=600;t+=20)assert.equal(s.step(t,t%40?1.8:1.9),true,`mouth dropped out at ${t}ms despite sustained speech`);
 assert.equal(s.step(800,0),false,'silence must still close the mouth');
});

test('a single noisy frame does not open the mouth; sustained speech opens within 40ms',async()=>{
 const s=await studio();
 assert.equal(s.step(0,4),false,'single-frame spike must not open the mouth');
 assert.equal(s.step(16,0),false);
 assert.equal(s.step(200,4),false);
 assert.equal(s.step(240,4),true);
});

test('adjustable threshold and hold bridge short gaps but close on silence',async()=>{
 const s=await studio();s.el('threshold').value=8;s.el('hold').value=100;
 s.step(0,3);assert.equal(s.step(100,3),false);
 s.step(120,5);assert.equal(s.step(160,5),true);
 assert.equal(s.step(220,0),true);
 assert.equal(s.step(260,0),false);
 // Lower closing threshold must not trigger a fresh opening from silence.
 s.step(300,3);assert.equal(s.step(400,3),false);
});

test('blinking never overrides speech; stop and restart clear mouth history',async()=>{
 const s=await studio();s.step(0,4);s.step(40,4);
 for(let t=60;t<=2640;t+=20)assert.equal(s.step(t,4),true);
 assert.match(s.el('avatar').src,/05_Augen/);
 s.el('micButton').onclick();assert.equal(s.step(2660,0),false);
 s.el('micButton').onclick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(s.step(2680,0),false);
});

test('manual mouth does not lower audio opening threshold; reset clears pending onset',async()=>{
 const s=await studio();s.el('open').onclick();assert.equal(s.step(0,1.8),true);
 s.el('manual').checked=false;assert.equal(s.step(40,1.8),false);
 s.step(100,4);s.el('reset').onclick();
 assert.equal(s.step(120,4),false);
 assert.equal(s.step(160,4),true);
});
