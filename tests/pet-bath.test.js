import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

async function setup(){
  const db=new PGlite();
  await db.exec('create role anon;create role authenticated;create schema heart_private;');
  await db.exec(await readFile('supabase/migrations/202609090004_global_hatching.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/202609220010_pet_bath.sql','utf8'));
  return db;
}
const call=(db,args={})=>db.query('select public.heart_pet_bath($1,$2,$3,$4,$5) as result',[args.recipient??null,args.action??null,args.round??null,args.stage??null,args.request??null]).then(r=>r.rows[0].result);
const room=(result,name)=>result[name];
const today=async db=>(await db.query("select ((clock_timestamp() at time zone 'Asia/Bangkok')::date)::text as day")).rows[0].day;

 test('pet bath reads daily dirty rounds, exposes authoritative hatch state, and grants only the RPC',async t=>{
  const db=await setup();t.after(()=>db.close());
  const day=await today(db);
  let state=await call(db);assert.deepEqual(state,{rose:{day,round:1,progress:0,completedAt:null,lastCompletedAt:null,hatched:false},praew:{day,round:1,progress:0,completedAt:null,lastCompletedAt:null,hatched:false}});
  await db.exec('update heart_private.hatch_total set rose=100000');
  state=await call(db);assert.equal(room(state,'rose').hatched,true);assert.equal(room(state,'praew').hatched,false);assert.equal(room(state,'rose').day,day);
  await db.exec('set role anon');
  assert.deepEqual(await call(db),state);
  await assert.rejects(db.exec('select * from heart_private.pet_bath_rooms'));
  await assert.rejects(db.exec("update heart_private.pet_bath_rooms set progress=20 where recipient='rose'"));
  await db.exec('reset role');
 });

test('help is bounded, stale round/stage requests are snapshots, and UUID replay is idempotent',async t=>{
  const db=await setup();t.after(()=>db.close());await db.exec('update heart_private.hatch_total set rose=100000');
  const request=randomUUID();let state=await call(db,{recipient:'rose',action:'help',round:1,stage:0,request});
  assert.equal(room(state,'rose').progress,1);assert.deepEqual(await call(db,{recipient:'rose',action:'help',round:1,stage:0,request}),state);
  await call(db,{recipient:'rose',action:'help',round:1,stage:0,request:randomUUID()});
  const latest=await call(db,{recipient:'rose',action:'help',round:1,stage:0,request});assert.equal(room(latest,'rose').progress,2);
  const stale=await call(db,{recipient:'rose',action:'help',round:1,stage:1,request:randomUUID()});assert.equal(room(stale,'rose').progress,2);
  assert.equal(room(await call(db,{recipient:'rose',action:'help',round:99,stage:0,request:randomUUID()}),'rose').progress,2);
  await assert.rejects(call(db,{recipient:null,action:'help',round:1,stage:0,request:randomUUID()}),/Invalid pet bath request/);
  await assert.rejects(call(db,{recipient:'praew',action:'help',round:1,stage:0,request:randomUUID()}),/not hatched/);
  await db.exec("update heart_private.pet_bath_rooms set progress=119 where recipient='rose'");
  const done=await call(db,{recipient:'rose',action:'help',round:1,stage:3,request:randomUUID()});assert.equal(room(done,'rose').progress,120);assert.ok(room(done,'rose').completedAt);assert.equal(room(done,'rose').lastCompletedAt,room(done,'rose').completedAt);
  const staleComplete=await call(db,{recipient:'rose',action:'help',round:1,stage:3,request:randomUUID()});assert.equal(room(staleComplete,'rose').progress,120);
});

test('one round per Bangkok day rolls over on reads and preserves the completion reward',async t=>{
  const db=await setup();t.after(()=>db.close());await db.exec('update heart_private.hatch_total set rose=100000');
  const day=await today(db);
  const started=await call(db,{recipient:'rose',action:'start',round:1,stage:0,request:randomUUID()});assert.equal(room(started,'rose').round,1);assert.equal(room(started,'rose').progress,0);assert.equal(room(started,'rose').day,day);
  await db.exec("update heart_private.pet_bath_rooms set progress=120,completed_at=clock_timestamp()-interval '2 minutes',last_completed_at=clock_timestamp()-interval '2 minutes' where recipient='rose'");
  const blocked=await call(db,{recipient:'rose',action:'start',round:1,stage:4,request:randomUUID()});assert.equal(blocked.rose.progress,120);assert.equal(blocked.rose.round,1);
  await db.exec("update heart_private.pet_bath_rooms set progress=120,completed_at=clock_timestamp()-interval '2 minutes',last_completed_at=clock_timestamp()-interval '2 minutes',day=((clock_timestamp() at time zone 'Asia/Bangkok')::date-1) where recipient='rose'");
  const expectedStamp=(await db.query("select last_completed_at::text as stamp from heart_private.pet_bath_rooms where recipient='rose'")).rows[0].stamp;
  const rolled=await call(db);assert.equal(room(rolled,'rose').day,day);assert.equal(room(rolled,'rose').round,2);assert.equal(room(rolled,'rose').progress,0);assert.equal(room(rolled,'rose').completedAt,null);assert.ok(room(rolled,'rose').lastCompletedAt);
  assert.equal(room(rolled,'praew').day,day);assert.equal(room(rolled,'praew').round,1);assert.equal(room(rolled,'praew').progress,0);
  const sameDayStart=await call(db,{recipient:'rose',action:'start',round:2,stage:0,request:randomUUID()});assert.equal(room(sameDayStart,'rose').round,2);assert.equal(room(sameDayStart,'rose').progress,0);
  assert.equal(Date.parse(room(rolled,'rose').lastCompletedAt),Date.parse(expectedStamp));
});

test('an action also rolls a fixture into the current Bangkok day before validation',async t=>{
  const db=await setup();t.after(()=>db.close());await db.exec('update heart_private.hatch_total set rose=100000');
  await db.exec("update heart_private.pet_bath_rooms set progress=0,completed_at=null,day=((clock_timestamp() at time zone 'Asia/Bangkok')::date-1),round=8 where recipient='rose'");
  const state=await call(db,{recipient:'rose',action:'start',round:8,stage:0,request:randomUUID()});
  assert.equal(room(state,'rose').round,9);assert.equal(room(state,'rose').progress,0);assert.equal(room(state,'rose').completedAt,null);
});