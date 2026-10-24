const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
test('PNG slots are copied, persist across store instances and reject unsafe input atomically',async()=>{
 const {createAssetStore}=require('../desktop/assets.cjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rinpng-assets-'));
 try{
  const store=await createAssetStore(dir,()=>true);
  const png=await fs.readFile(path.join(__dirname,'../app/assets/01_Neutral_Augen_offen_Mund_zu.png'));
  await store.save('neutral',png);
  assert.deepEqual(await store.read('neutral'),png);
  const reopened=await createAssetStore(dir,()=>true);
  assert.match(reopened.sources().neutral,/^\/custom\/neutral.png\?v=/);
  await assert.rejects(store.save('../escape',png));
  await assert.rejects(store.save('neutral',Buffer.from('<svg/>')));
  await assert.rejects(store.save('talk',Buffer.alloc(12*1024*1024+1)));
  const oversized=Buffer.from(png);oversized.writeUInt32BE(99999,16);
  await assert.rejects(store.save('neutral',oversized));
  assert.deepEqual(await store.read('neutral'),png);
  const rejecting=await createAssetStore(dir,()=>false);
  await assert.rejects(rejecting.save('talk',png));
  await store.remove('neutral');assert.equal(store.sources().neutral,undefined);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
