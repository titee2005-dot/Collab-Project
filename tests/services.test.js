import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHearts} from '../src/data/heartTypes.js';
import {getDonations,getCollectionStats,searchSupporters} from '../src/services/donationService.js';
import {getNewDiscoveries,getUnlockedCollectibles} from '../src/services/progressionService.js';
test('public cache begins empty without demo credit',()=>{assert.deepEqual(getDonations(),[]);assert.equal(getCollectionStats(getDonations()).total,0);});
test('fixed and amount calculations remain exact',()=>{assert.equal(resolveHearts({heartType:'golden',quantity:3})[0].amount,600);assert.equal(resolveHearts({mode:'amount',amount:270}).reduce((s,d)=>s+d.amount,0),270);assert.throws(()=>resolveHearts({mode:'amount',amount:21}));});
test('supporter search does not reveal anonymous handles or names',()=>{const data=[{id:'1',recipient:'rose',heartType:'pink',quantity:2,supporterName:'Test',socialUsername:'@test',anonymous:false},{id:'2',recipient:'praew',heartType:'pink',quantity:1,supporterName:'Hidden',socialUsername:'@secret',anonymous:true}];assert.equal(searchSupporters('@test',data)[0].total,2);assert.deepEqual(searchSupporters('@secret',data),[]);assert.deepEqual(searchSupporters('Hidden',data),[]);});
test('progression still uses exact milestones',()=>{assert.equal(getNewDiscoveries(469,499).length,0);assert.equal(getNewDiscoveries(499,500)[0].id,'moon');assert.equal(getUnlockedCollectibles('rose',249).length,1);assert.equal(getUnlockedCollectibles('rose',250).length,2);});
