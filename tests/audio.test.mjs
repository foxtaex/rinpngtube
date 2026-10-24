import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Microphone } from '../app/microphone.mjs';
function harness(options = {}) {
  const track = new EventTarget(); track.stop = () => track.stopped = true;
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  let constraints; let resumed = false; let closed = false;
  class Context {
    constructor(settings){this.settings=settings;}
    state = 'suspended';
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 2048, getFloatTimeDomainData(a) { a.fill(.1); }, disconnect() {} }; }
    async resume() { resumed = true; if(options.failResume) throw Error('resume'); this.state = 'running'; }
    async close() { closed = true; }
  }
  const mic = new Microphone({ mediaDevices: { async getUserMedia(c) { constraints = c; return options.pending ? await options.pending : stream; } }, AudioContext: Context });
  return {mic, track, stream, get constraints(){return constraints}, get resumed(){return resumed}, get closed(){return closed}};
}
test('selected microphone is exact, suspended context resumes and RMS reaches UI without playback', async () => {
  const h = harness(); await h.mic.start('usb');
  assert.equal(h.resumed, true); assert.deepEqual(h.constraints.audio.deviceId, {exact:'usb'});
  assert.ok(h.mic.level() > 9); h.mic.stop(); assert.equal(h.track.stopped,true); assert.equal(h.closed,true);
});
test('failure after capture releases stream and audio context', async () => {
 const h=harness({failResume:true}); await assert.rejects(h.mic.start(),/resume/);
 assert.equal(h.track.stopped,true);assert.equal(h.closed,true);assert.equal(h.mic.active,false);
});
test('cancelled permission request releases late stream and never becomes active',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const h=harness({pending});
 const start=h.mic.start();h.mic.stop();resolve(h.stream);await start;
 assert.equal(h.track.stopped,true);assert.equal(h.mic.active,false);assert.equal(h.resumed,false);
});
test('device ended event stops capture',async()=>{
 const h=harness();await h.mic.start();h.track.dispatchEvent(new Event('ended'));
 assert.equal(h.mic.active,false);assert.equal(h.track.stopped,true);
});
test('repeated start does not allocate a second active capture',async()=>{
 const h=harness();await h.mic.start();const context=h.mic.context;await h.mic.start();assert.equal(h.mic.context,context);h.mic.stop();
});
test('analysis uses a silent audio sink so an unavailable speaker clock cannot freeze microphone levels',async()=>{
 const h=harness();await h.mic.start();assert.deepEqual(h.mic.context.settings,{sinkId:{type:'none'}});h.mic.stop();
});
