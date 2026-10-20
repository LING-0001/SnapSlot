import { build } from 'esbuild';
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const website=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(website,'../..');
const output=path.join(root,'artifacts/native-ui');
await mkdir(output,{recursive:true});await mkdir(path.join(output,'assets'),{recursive:true});await mkdir(path.join(output,'skins'),{recursive:true});
await build({entryPoints:[path.join(root,'apps/native-ui/index.tsx')],outdir:output,entryNames:'desktop',bundle:true,minify:true,platform:'browser',target:['chrome109','safari16.4'],jsx:'automatic',alias:{'@':website,react:path.join(website,'node_modules/react'),'react-dom':path.join(website,'node_modules/react-dom')},loader:{'.png':'file','.svg':'file'},assetNames:'assets/[name]-[hash]',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'offline-assets',setup(api){
api.onLoad({filter:/globals\.css$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('@import "tailwindcss";','').replaceAll("url('/","url('../public/"),loader:'css',resolveDir:path.dirname(args.path)}));
api.onLoad({filter:/sample-artwork\.tsx$|skin-editor\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replaceAll('"/mountains.svg"','"assets/mountains.svg"'),loader:'tsx',resolveDir:path.dirname(args.path)}));
}}]});
for(const name of ['mountains.svg','studio.svg'])await copyFile(path.join(website,'public',name),path.join(output,'assets',name));
for(const name of ['notes.json','cards.json'])await copyFile(path.join(website,'public/skins',name),path.join(output,'skins',name));
await copyFile(path.join(root,'apps/native-ui/menus.json'),path.join(output,'menus.json'));
await writeFile(path.join(output,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\'; connect-src \'none\'; object-src \'none\'; base-uri \'none\'"><title>SnapSlot</title><link rel="stylesheet" href="desktop.css"></head><body><div id="root"></div><script src="desktop.js"></script></body></html>');
console.log(output);
