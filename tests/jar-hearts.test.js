import test from 'node:test';import assert from 'node:assert/strict';import {jarHeartCount,jarHeartPosition} from '../src/services/jarHearts.js';
test('first twenty hearts grow one by one; compression never reduces count',()=>{for(let n=0;n<=20;n++)assert.equal(jarHeartCount(n),n);let previous=0;for(let n=0;n<=10000;n++){const count=jarHeartCount(n);assert.ok(count>=previous&&count<=96);previous=count;}});
test('first heart starts visible at bottom centre and smoothly settles as pile grows',()=>{assert.equal(jarHeartPosition(0,1).left,'50%');assert.equal(jarHeartPosition(0,1).bottom,'3%');assert.equal(jarHeartPosition(0,1).width,'34px');assert.ok(parseFloat(jarHeartPosition(0,120).width)<34);for(let i=0;i<96;i++){const p=jarHeartPosition(i,1000);assert.ok(parseFloat(p.left)>=10&&parseFloat(p.left)<=90);assert.ok(parseFloat(p.bottom)<80);}});
test('pile is deterministic and has irregular positions and angles instead of rows',()=>{
 const positions=Array.from({length:50},(_,i)=>jarHeartPosition(i,187));
 assert.deepEqual(positions,Array.from({length:50},(_,i)=>jarHeartPosition(i,187)));
 assert.ok(new Set(positions.map(p=>parseFloat(p.bottom).toFixed(1))).size>40);
 assert.ok(new Set(positions.map(p=>parseFloat(p.left).toFixed(1))).size>40);
 assert.ok(new Set(positions.map(p=>p.transform)).size>40);
 for(const total of [1,10,20,80,187,1000])for(let i=0;i<jarHeartCount(total);i++){
  const p=jarHeartPosition(i,total);assert.ok(parseFloat(p.bottom)>=3&&parseFloat(p.bottom)<80);assert.ok(parseFloat(p.width)>=21&&parseFloat(p.width)<=37);
 }
});
