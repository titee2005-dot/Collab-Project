import test from 'node:test';import assert from 'node:assert/strict';import {bathStage,bathRooms} from '../src/services/petBath.js';
test('bath stages advance at shared boundaries',()=>assert.deepEqual([0,19,20,69,70,99,100,119,120].map(bathStage),[0,0,1,1,2,2,3,3,4]));
test('missing rooms are locked and progress is bounded',()=>{assert.equal(bathRooms().rose.hatched,false);assert.equal(bathRooms({rose:{progress:999,hatched:true}}).rose.progress,120);assert.equal(bathRooms({praew:{progress:-1}}).praew.progress,0);});
import {mergeBathRooms} from '../src/services/petBath.js';
test('late snapshots cannot roll back progress but a new round can reset it',()=>{const old=bathRooms({rose:{round:2,progress:80,hatched:true}});assert.equal(mergeBathRooms(old,{rose:{round:2,progress:20}}).rose.progress,80);assert.equal(mergeBathRooms(old,{rose:{round:1,progress:120}}).rose.round,2);assert.equal(mergeBathRooms(old,{rose:{round:3,progress:0}}).rose.progress,0);});

import {bathRewardActive} from '../src/services/petBath.js';
test('towel lasts five minutes even after a restart',()=>{const room={progress:0,lastCompletedAt:'2026-09-22T00:00:00Z'};const start=Date.parse(room.lastCompletedAt);assert.equal(bathRewardActive(room,start+61000),true);assert.equal(bathRewardActive(room,start+299999),true);assert.equal(bathRewardActive(room,start+300000),false);});
