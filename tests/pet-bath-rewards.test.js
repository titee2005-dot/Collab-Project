import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

const readMigration=path=>readFile(new URL(`../supabase/migrations/${path}`,import.meta.url),'utf8');
const call=(db,args={})=>db.query(
  'select public.heart_pet_bath($1,$2,$3,$4,$5) as result',
  [args.recipient??null,args.action??null,args.round??null,args.stage??null,args.request??null]
).then(result=>result.rows[0].result);
const today=async db=>(await db.query("select ((clock_timestamp() at time zone 'Asia/Bangkok')::date)::text as day")).rows[0].day;

async function setup({legacyCompletion=false}={}){
  const db=new PGlite();
  await db.exec('create role anon;create role authenticated;create schema heart_private;');
  await db.exec(await readMigration('202609090004_global_hatching.sql'));
  await db.exec(await readMigration('202609220010_pet_bath.sql'));
  if(legacyCompletion){
    await db.exec("update heart_private.pet_bath_rooms set progress=120,completed_at=clock_timestamp()-interval '1 minute',last_completed_at=null where recipient='rose'");
  }
  await db.exec(await readMigration('202609220011_pet_bath_rewards.sql'));
  return db;
}

test('migration preserves completed legacy rooms and backfills one durable daily reward',async t=>{
  const db=await setup({legacyCompletion:true});t.after(()=>db.close());
  const room=(await db.query("select progress,reward_points,completed_at,last_completed_at from heart_private.pet_bath_rooms where recipient='rose'")).rows[0];
  assert.equal(room.progress,500000);assert.equal(room.reward_points,20);assert.ok(room.completed_at);assert.ok(room.last_completed_at);
  const ledger=(await db.query("select recipient,day,points,count(*) over () as entries from heart_private.pet_bath_reward_ledger")).rows;
  assert.deepEqual(ledger.map(({recipient,points,entries})=>({recipient,points,entries})),[{recipient:'rose',points:20,entries:1}]);
});

test('goal boundaries, stale requests, UUID replay, and completion award use the 500000-stage contract',async t=>{
  const db=await setup();t.after(()=>db.close());
  await db.exec('update heart_private.hatch_total set rose=100000');
  const request=(stage)=>({recipient:'rose',action:'help',round:1,stage,request:randomUUID()});
  await db.exec('update heart_private.pet_bath_rooms set progress=99999 where recipient=\'rose\'');
  let state=await call(db,request(0));assert.equal(state.rose.progress,100000);assert.equal(state.rose.rewardPoints,0);
  state=await call(db,request(0));assert.equal(state.rose.progress,100000);
  state=await call(db,request(1));assert.equal(state.rose.progress,100001);
  await db.exec('update heart_private.pet_bath_rooms set progress=299999 where recipient=\'rose\'');
  assert.equal((await call(db,request(1))).rose.progress,300000);
  await db.exec('update heart_private.pet_bath_rooms set progress=399999 where recipient=\'rose\'');
  assert.equal((await call(db,request(2))).rose.progress,400000);
  await db.exec('update heart_private.pet_bath_rooms set progress=499999 where recipient=\'rose\'');
  const completion=request(3);state=await call(db,completion);
  assert.equal(state.rose.progress,500000);assert.equal(state.rose.rewardPoints,20);assert.ok(state.rose.completedAt);
  assert.deepEqual(await call(db,completion),state);
  assert.equal((await call(db,request(4))).rose.rewardPoints,20);
  assert.deepEqual((await db.query("select count(*)::int as count,sum(points)::int as points from heart_private.pet_bath_reward_ledger where recipient='rose'")).rows[0],{count:1,points:20});
});

test('concurrent final helpers award one row and one set of points',async t=>{
  const db=await setup();t.after(()=>db.close());
  await db.exec('update heart_private.hatch_total set rose=100000');
  await db.exec("update heart_private.pet_bath_rooms set progress=499999 where recipient='rose'");
  const args=()=>({recipient:'rose',action:'help',round:1,stage:3,request:randomUUID()});
  const [first,second]=await Promise.all([call(db,args()),call(db,args())]);
  assert.equal(first.rose.progress,500000);assert.equal(second.rose.progress,500000);
  assert.equal(first.rose.rewardPoints,20);assert.equal(second.rose.rewardPoints,20);
  assert.deepEqual((await db.query("select reward_points from heart_private.pet_bath_rooms where recipient='rose'")).rows[0],{reward_points:20});
  assert.deepEqual((await db.query("select count(*)::int as count from heart_private.pet_bath_reward_ledger where recipient='rose'")).rows[0],{count:1});
});

test('Bangkok rollover retains cumulative rewards and permits exactly one new daily award',async t=>{
  const db=await setup();t.after(()=>db.close());
  await db.exec('update heart_private.hatch_total set rose=100000');
  await db.exec("update heart_private.pet_bath_rooms set progress=499999 where recipient='rose'");
  const completed=await call(db,{recipient:'rose',action:'help',round:1,stage:3,request:randomUUID()});
  const oldStamp=completed.rose.completedAt;assert.equal(completed.rose.rewardPoints,20);
  await db.exec("update heart_private.pet_bath_rooms set day=((clock_timestamp() at time zone 'Asia/Bangkok')::date-1) where recipient='rose'; update heart_private.pet_bath_reward_ledger set day=((clock_timestamp() at time zone 'Asia/Bangkok')::date-1) where recipient='rose'");
  const rolled=await call(db);assert.equal(rolled.rose.progress,0);assert.equal(rolled.rose.rewardPoints,20);assert.equal(rolled.rose.lastCompletedAt,oldStamp);assert.equal(rolled.rose.round,2);
  await db.exec("update heart_private.pet_bath_rooms set progress=499999 where recipient='rose'");
  const next=await call(db,{recipient:'rose',action:'help',round:2,stage:3,request:randomUUID()});
  assert.equal(next.rose.progress,500000);assert.equal(next.rose.rewardPoints,40);
  assert.deepEqual((await db.query("select count(*)::int as count,sum(points)::int as points from heart_private.pet_bath_reward_ledger where recipient='rose'")).rows[0],{count:2,points:40});
  assert.equal(await today(db),next.rose.day);
});

test('hatching remains the gate for the expanded bath goal',async t=>{
  const db=await setup();t.after(()=>db.close());
  await assert.rejects(call(db,{recipient:'rose',action:'help',round:1,stage:0,request:randomUUID()}),/not hatched/);
  await db.exec('update heart_private.hatch_total set rose=99999');
  await assert.rejects(call(db,{recipient:'rose',action:'help',round:1,stage:0,request:randomUUID()}),/not hatched/);
  await db.exec('update heart_private.hatch_total set rose=100000');
  const state=await call(db,{recipient:'rose',action:'help',round:1,stage:0,request:randomUUID()});
  assert.equal(state.rose.progress,1);assert.equal(state.rose.hatched,true);
});
