import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
let rpc;
const hooks=registerHooks({load(url,context,next){if(url.endsWith('/src/services/supabaseClient.js'))return {format:'module',shortCircuit:true,source:"export const backend='supabase';export const getSupabase=()=>({rpc:(...args)=>globalThis.__storyQueueRPC(...args)});export const edgeURL=()=>'';export const publicKey=()=>'';"};return next(url,context);}});
globalThis.__storyQueueRPC=(...args)=>rpc(...args);
const {refreshDonations,getDonations}=await import('../src/services/donationService.js');
const memory=id=>({id,recipient:'rose',heartType:'pink',quantity:1,createdAt:'2026-09-21T10:00:00Z'});
test('refresh retains all queued memories beyond the RPC 100-ID limit without multiplying totals',async()=>{
 const calls=[];rpc=async(name,{p_ids})=>{calls.push(p_ids);return {data:{donations:[memory('recent'),...p_ids.map(memory)],groups:[{recipient:'rose',heartType:'pink',quantity:251}]}};};
 const ids=Array.from({length:250},(_,i)=>'queued-'+i),rows=await refreshDonations([...ids,ids[0]]);
 assert.deepEqual(calls.map(c=>c.length),[100,100,50]);assert.equal(rows.length,251);assert.equal(new Set(rows.map(d=>d.id)).size,251);assert.equal(rows.collectionStats.total,251);assert.equal(rows.collectionStats.points,251);
});
test('an empty requested queue still fetches the latest world and failures preserve cache',async()=>{
 rpc=async(name,{p_ids})=>{assert.deepEqual(p_ids,[]);return {data:{donations:[memory('latest')],groups:[{recipient:'rose',heartType:'pink',quantity:1}]}};};
 await refreshDonations();const previous=getDonations();rpc=async()=>({error:new Error('unavailable')});await assert.rejects(refreshDonations(['missing']),/unavailable/);assert.equal(getDonations(),previous);
});
