import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import {heartTypes} from '../supabase/functions/_shared/hearts.js';
import {specialHearts} from '../src/data/specialHearts.js';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('exports/artwork');
fs.mkdirSync(out,{recursive:true});
const artwork=fs.readFileSync('src/components/Artwork.jsx','utf8');
const heartJsx=artwork.match(/return (<svg[\s\S]*?<\/svg>)/)[1];
const heartCode=transformSync(heartJsx,{loader:'jsx',jsxFactory:'React.createElement'}).code;
const heartFn=new Function('React','color','id','className','props',`return ${heartCode}`);
const world=fs.readFileSync('src/components/World.jsx','utf8');
const jarJsx=world.match(/<svg className="jar-glass"[\s\S]*?<\/svg>/)[0];
const jarCode=transformSync(jarJsx,{loader:'jsx',jsxFactory:'React.createElement'}).code;
const jarFn=new Function('React','id',`return ${jarCode}`);
const assets=[];
function add(name,element,w,h){
 const svg=renderToStaticMarkup(element).replace('<svg ',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `);
 fs.writeFileSync(path.join(out,name+'.svg'),svg);
 assets.push({name,w,h,svg});
}
for(const h of [...heartTypes,...specialHearts,{id:'little-love',color:'#ce92b7'}]) add('heart-'+h.id,heartFn(React,h.color,'gradient-'+h.id,'',{}),1200,1080);
for(const id of ['rose','praew']) add('jar-'+id,jarFn(React,id),1200,1360);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 for(const asset of assets){
  await page.setViewportSize({width:asset.w,height:asset.h});
  await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block}</style>'+asset.svg);
  await page.locator('svg').screenshot({path:path.join(out,asset.name+'.png'),omitBackground:true});
 }
 await page.setViewportSize({width:1100,height:1200});
 const html=`<!doctype html><meta charset="utf-8"><title>Heart Collection — exported artwork</title><style>body{margin:0;padding:32px;background:#f8f1eb;color:#654a59;font:16px Arial}h1{font-size:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}figure{margin:0;padding:16px;background:#fff9;border-radius:16px;text-align:center}img{width:100%;height:180px;object-fit:contain}figcaption{padding-top:12px}</style><h1>Heart Collection · transparent artwork</h1><main>${assets.map(a=>`<figure><img src="${a.name}.png"><figcaption>${a.name}</figcaption></figure>`).join('')}</main>`;
 fs.writeFileSync(path.join(out,'index.html'),html);
 await page.goto('file:///'+out.replaceAll('\\','/')+'/index.html');
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 await page.screenshot({path:path.join(out,'preview.png'),fullPage:true});
}finally{await browser.close();}
fs.writeFileSync(path.join(out,'README.txt'),'11 transparent artwork assets, each in PNG and SVG.\nHearts: 1200 x 1080 px. Jars: 1200 x 1360 px.\nExported from actual Heart and jar-glass SVG source.\nJars contain the glass and lid only; surrounding room, CSS emblem, items and animations are separate elements.\nOpen index.html or preview.png to view all assets.\n');
console.log(JSON.stringify({out,assets:assets.map(a=>a.name)},null,2));
