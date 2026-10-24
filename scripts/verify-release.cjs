const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const assert=require('node:assert/strict');const asar=require('@electron/asar');
const version=require('../package.json').version;
const report={version,platform:process.platform,arch:process.arch,artifacts:[],archives:[],reports:{}};
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
for(const filename of [`RinPNGTube-${version}-mac-arm64.dmg`,`RinPNGTube-${version}-mac-arm64.zip`,`RinPNGTube-${version}-win-x64.exe`,`RinPNGTube-${version}-win-x64.zip`]){
 const p=path.resolve('release',filename),data=fs.readFileSync(p);assert.ok(data.length>1000000);report.artifacts.push({path:p,bytes:data.length,sha256:hash(data)});
}
const files=['desktop/assets.cjs','desktop/main.cjs','desktop/preload.cjs','desktop/server.cjs','app/index.html','app/studio.css','app/studio.mjs','app/microphone.mjs',...fs.readdirSync('app/assets').map(f=>'app/assets/'+f)];
for(const archive of ['release/mac-arm64/RinPNGTube.app/Contents/Resources/app.asar','release/win-unpacked/resources/app.asar']){
 for(const file of files)assert.equal(hash(asar.extractFile(archive,file)),hash(fs.readFileSync(file)),`${archive}: stale ${file}`);
 // electron-builder intentionally removes scripts/build/devDependencies and reformats package.json.
 const pkg=JSON.parse(asar.extractFile(archive,'package.json')),source=require('../package.json');for(const key of ['name','version','description','author','main'])assert.equal(pkg[key],source[key]);report.archives.push({path:path.resolve(archive),verifiedSourceFiles:files.length});
}
for(const [file,expected] of Object.entries(require('./asset-hashes.json')))assert.equal(hash(fs.readFileSync('app/assets/'+file)),expected);
for(const name of ['packaged-ui-report','packaged-import-report','packaged-report','packaged-lipsync-report','permissions-report','normal-launch-report']){const r=JSON.parse(fs.readFileSync('verification/'+name+'.json'));assert.equal(r.success,true,name);report.reports[name]=true;}
const exe=fs.readFileSync('release/win-unpacked/RinPNGTube.exe');assert.equal(exe.toString('ascii',0,2),'MZ');assert.equal(exe.readUInt16LE(exe.readUInt32LE(0x3c)+4),0x8664);assert.ok(exe.includes(Buffer.from('RinPNGTube','utf16le')),'Windows resource metadata must be branded');
assert.ok(fs.statSync('release/mac-arm64/RinPNGTube.app/Contents/Resources/icon.icns').size>1000);
report.originalAssetsUnchanged=true;report.windowsRuntimeTested=false;report.success=true;
fs.writeFileSync(`verification/release-${version}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
