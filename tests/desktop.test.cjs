const {test} = require('node:test');
const assert = require('node:assert/strict');
const {startServer, validateState} = require('../desktop/server.cjs');
test('OBS server serves original avatar and exposes read-only validated state, without remote access or traversal', async () => {
 const server = await startServer();
 try {
  const page = await fetch(server.url); assert.equal(page.status,200); assert.match(await page.text(),/RinPNGTube/);
  const style=await fetch(server.url+'studio.css');assert.equal(style.status,200);assert.match(style.headers.get('content-type'),/^text\/css/);
  const asset = await fetch(server.url+'assets/03_Weinen.png'); assert.equal(asset.headers.get('content-type'),'image/png');
  assert.equal((await fetch(server.url+'api/state',{method:'POST',body:'{}'})).status,405);
  assert.equal((await fetch(server.url+'package.json')).status,404);
  const hostileHostStatus = await new Promise((resolve,reject)=>require('node:http').get(server.url,{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject));
  assert.equal(hostileHostStatus,403);
  assert.equal((await fetch(server.url+'api/state',{headers:{Origin:'https://evil.example'}})).status,403);
  server.setState({talking:true,eyesClosed:false,crying:true,scale:80,x:50,y:0,mirror:false});
  assert.equal((await (await fetch(server.url+'api/state')).json()).crying,true);
  assert.equal(validateState({talking:'yes'}),null);
 } finally {await server.close();}
});
