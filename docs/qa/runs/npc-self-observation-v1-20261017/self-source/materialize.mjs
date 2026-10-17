import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url));
assert.equal(process.argv.length,4,'node materialize.mjs --out NEW_DIRECTORY');
assert.equal(process.argv[2],'--out');
const out=path.resolve(process.argv[3]);
assert.ok(!fs.existsSync(out),'new output only');
const index=JSON.parse(fs.readFileSync(path.join(base,'index.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const safe=(root,relative)=>{assert.ok(typeof relative==='string'&&!path.isAbsolute(relative)&&!relative.split(/[\\/]/).includes('..'));const result=path.resolve(root,relative);assert.ok(result.startsWith(root+path.sep));return result;};
const plans=Object.entries(index.aliases).map(([target,ref])=>{const bytes=fs.readFileSync(safe(base,ref.path));assert.equal(hash(bytes),ref.sha256);assert.equal(bytes.length,ref.bytes);return [safe(out,target),bytes];});
fs.mkdirSync(out,{recursive:true});
for(const [target,bytes] of plans){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
console.log(JSON.stringify({ok:true,materializedFiles:plans.length,testsExecuted:0}));
