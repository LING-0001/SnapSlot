import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await readFile(resolve(root,'apps/website/package.json'),'utf8'));
const approved=JSON.parse(await readFile(resolve(root,'apps/website/vendor/libraries.json'),'utf8'));
for(const [name,reference] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){
 assert(!/^(?:workspace:|link:|git\+|https?:|github:)/.test(reference),'Unreviewed source dependency: '+name);
 if(name.startsWith('@linglinglab/')||reference.startsWith('file:')){
  const pin=approved[name];assert(pin?.visibility==='public',`Internal or unreviewed dependency: ${name}`);
  assert.match(reference,/^file:vendor\/npm\/[a-z0-9.-]+\.tgz$/);
  const file=resolve(root,'apps/website',reference.slice(5));
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),pin.sha256);
  const entries=execFileSync('tar',['-tzf',file],{encoding:'utf8'}).trim().split('\n');
  assert(entries.every(path=>pin.files.includes(path.replace(/^package\//,''))),'Unapproved package content');
  const manifest=JSON.parse(execFileSync('tar',['-xOzf',file,'package/package.json'],{encoding:'utf8'}));
  assert.equal(manifest.name,name);assert.equal(manifest.version,pin.version);assert.equal(manifest.license,'MIT');
  assert(!manifest.dependencies,'Public UI package must use only declared public peer dependencies');
 }
}
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/(shared\/internal|backend\/taptally|@linglinglab\/(receipt-preview|download-client|internal)|\/taptally-api\/|\/admin\/site\/v1|\/site-api\/v1\/products|\/Users\/ling\/code\/(Home|TapTally|LingLingLab))/;
const secret=/(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk-[A-Za-z0-9]{24,}))/;
let checked=0;
for(const file of files){
 if(file==='scripts/check-public-boundary.mjs')continue;
 if(/(^|\/)(\.env(?:\..+)?|credentials\.json|secrets\.json|AccessKey[^/]*)$/.test(file)&&!file.endsWith('.env.example'))throw Error('Private file in public candidate set: '+file);
 if(!/\.(?:ts|tsx|js|mjs|json|yml|yaml|sh|ps1|swift|cs|md|css|html)$/.test(file))continue;
 let text;try{text=await readFile(resolve(root,file),'utf8')}catch(error){if(error.code==='ENOENT')continue;throw error}
 assert(!forbidden.test(text),'Private source/API dependency: '+file);assert(!secret.test(text),'Possible credential material: '+file);checked++;
}
console.log(`Public boundary passed: ${checked} text files; reviewed immutable dependencies only; no private APIs`);
