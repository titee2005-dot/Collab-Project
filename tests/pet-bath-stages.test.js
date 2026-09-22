import test from 'node:test';import assert from 'node:assert/strict';import {bathStage,bathRooms} from '../src/services/petBath.js';
test('bath stages advance at shared boundaries',()=>assert.deepEqual([0,99999,100000,299999,300000,399999,400000,499999,500000].map(bathStage),[0,0,1,1,2,2,3,3,4]));
test('missing rooms are locked and progress is bounded',()=>{assert.equal(bathRooms().rose.hatched,false);assert.equal(bathRooms({rose:{progress:999999,hatched:true}}).rose.progress,500000);assert.equal(bathRooms({praew:{progress:-1}}).praew.progress,0);});
import {mergeBathRooms} from '../src/services/petBath.js';
test('late snapshots cannot roll back progress but a new round can reset it',()=>{const old=bathRooms({rose:{round:2,progress:80,hatched:true}});assert.equal(mergeBathRooms(old,{rose:{round:2,progress:20}}).rose.progress,80);assert.equal(mergeBathRooms(old,{rose:{round:1,progress:120}}).rose.round,2);assert.equal(mergeBathRooms(old,{rose:{round:3,progress:0}}).rose.progress,0);});

import {bathRewardActive} from '../src/services/petBath.js';
test('towel lasts five minutes even after a restart',()=>{const room={progress:0,lastCompletedAt:'2026-09-22T00:00:00Z'};const start=Date.parse(room.lastCompletedAt);assert.equal(bathRewardActive(room,start+61000),true);assert.equal(bathRewardActive(room,start+299999),true);assert.equal(bathRewardActive(room,start+300000),false);});

import {withBathRewards} from '../src/services/petBath.js';
test('mission rewards add only unlock points, not donated quantities or types',()=>{
 const stats={total:3,points:17,rose:{total:1,points:15,types:{golden:1}},praew:{total:2,points:2,types:{pink:2}}};
 const next=withBathRewards(stats,{rose:{rewardPoints:40},praew:{rewardPoints:20}});
 assert.equal(next.points,77);assert.equal(next.rose.points,55);assert.equal(next.praew.points,22);
 assert.equal(next.total,3);assert.equal(next.rose.total,1);assert.deepEqual(next.rose.types,{golden:1});assert.equal(stats.points,17);
 assert.deepEqual(withBathRewards(stats,{}),stats);
});
