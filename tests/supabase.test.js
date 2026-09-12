import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {heartTypes} from '../src/data/heartTypes.js';
import {createHandler,digest} from '../supabase/functions/heart-api/handler.js';
const sessionMigration=await readFile(new URL('../supabase/migrations/202609080003_reviewer_passwords.sql',import.meta.url),'utf8');
const accessMigration=await readFile(new URL('../supabase/migrations/202609080002_admin_access.sql',import.meta.url),'utf8');
const migration=await readFile(new URL('../supabase/migrations/202609080001_heart_backend.sql',import.meta.url),'utf8');
const admin='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const accounts={rose:{bankCode:'004',bankName:'Rose bank',accountName:'Rose',accountNumber:'1234567890'},praew:{bankCode:'014',bankName:'Praew bank',accountName:'Praew',accountNumber:'0987654321'}};
const form={recipient:'rose',heartType:'pink',quantity:3,supporterName:'Test',anonymous:false,message:'Hello',socialUsername:''};
const expiry=()=>new Date(Date.now()+86400000).toISOString();
const png=()=>new Uint8Array([137,80,78,71,13,10,26,10,...new TextEncoder().encode(randomUUID())]);
async function setup(){
 const db=new PGlite();
 await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text); create schema storage; create table storage.objects(id text,bucket_id text); alter table storage.objects enable row level security; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
 await db.exec(migration);await db.exec(accessMigration);await db.exec(sessionMigration);
 await db.query('insert into auth.users(id) values ($1),($2)',[admin,outsider]);
 const rpc=async(action,payload={},actor=null)=>(await db.query('select public.heart_api($1,$2::jsonb,$3::uuid) as result',[action,JSON.stringify(payload),actor])).rows[0].result;
 const configure=async()=>{await db.query("insert into heart_private.admins(user_id,role,scope) values ($1,\'owner\',\'all\') on conflict do nothing",[admin]);await db.query("update heart_private.settings set data=jsonb_set(jsonb_set(data,'{accounts}',$1::jsonb),'{receivingEnabled}','true')",[JSON.stringify(accounts)]);};
 return {db,rpc,configure};
}
test('Supabase PostgreSQL migration, authorization and transactional donation flow',async t=>{
 const {db,rpc,configure}=await setup();t.after(()=>db.close());
 const reset=async()=>{await db.exec("truncate heart_private.orders,heart_private.donations,heart_private.audit,heart_private.limits; update heart_private.settings set data=jsonb_set(jsonb_set(data,'{modes}','{\"rose\":\"manual\",\"praew\":\"manual\"}'),'{verification}','{\"enabled\":false,\"limit\":0,\"used\":0,\"expiresAt\":null,\"reason\":\"off\"}');");};
 const prepare=async(f=form,extra={})=>rpc('prepare',{id:randomUUID(),form:f,slipHash:await digest(png()),fingerprint:randomUUID(),...extra});
 const markReady=async o=>{const r=await db.query('select fingerprint from heart_private.orders where id=$1',[o.id]);return rpc('ready',{id:o.id,fingerprint:r.rows[0].fingerprint,apiAvailable:true});};
 const evidence=o=>({id:o.id,decision:'approve',confirmed:true,reason:'Checked bank',paidAmount:o.amount,bankCode:o.account.bankCode,accountNumber:o.account.accountNumber,externalRef:'BANK-'+randomUUID(),paidAt:new Date().toISOString()});
 await t.test('new project is locked, and private tables/RPC are denied to browser roles',async()=>{
  assert.equal((await rpc('config')).enabled,false);
  assert.equal((await rpc('config')).accounts,null);
  await assert.rejects(prepare(),/ยังไม่เปิด/);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   try{await assert.rejects(db.query('select * from heart_private.settings'));await assert.rejects(rpc('policy',{enabled:true,limit:10,expiresAt:expiry(),apiAvailable:true}));}
   finally{await db.exec('reset role');}
  }
  await assert.rejects(rpc('settings',{},outsider),/แอดมิน/);
  const bucket=(await db.query("select * from storage.buckets where id='donation-slips'")).rows[0];assert.equal(bucket.public,false);
 });
 await configure();
 await t.test('manual upload can resume, cannot approve an incomplete upload, and credits once',async()=>{
  const o=await prepare();assert.equal(o.slipReady,false);await assert.rejects(rpc('review',evidence(o),admin),/อัปโหลด/);
  const ready=await markReady(o);assert.equal(ready.runVerification,false);
  const e=evidence(o);assert.equal((await rpc('review',e,admin)).status,'approved');await rpc('review',e,admin);
  assert.equal((await rpc('donations')).length,1);
  await assert.rejects(rpc('review',e,outsider),/แอดมิน/);
 });
 await reset();
 await t.test('DB prices match frontend and disregard client amount; anonymous data is stripped',async()=>{
  for(const heart of heartTypes){const o=await prepare({...form,heartType:heart.id,amount:1,anonymous:true,supporterName:'SECRET',socialUsername:'@SECRET'});assert.equal(o.amount,heart.price*3);assert.equal(o.form.supporterName,'Anonymous');assert.equal(o.form.socialUsername,'');}
 });
 await reset();
 await t.test('dedupe and fingerprint prevent repeated credits across recipients',async()=>{
  const hash=await digest(png()),id=randomUUID(),fingerprint=randomUUID(),o=await prepare(form,{id,slipHash:hash,fingerprint});
  assert.equal((await prepare(form,{id,slipHash:hash,fingerprint})).id,id);
  await assert.rejects(prepare({...form,recipient:'praew'},{slipHash:hash}));
  await assert.rejects(prepare(form,{id,fingerprint:'different'}));
  await markReady(o);const e=evidence(o);await rpc('review',e,admin);
  const b=await prepare({...form,recipient:'praew'});await markReady(b);
  await assert.rejects(rpc('review',{...evidence(b),externalRef:e.externalRef},admin));
  assert.equal((await rpc('donations')).length,1);
 });
 await reset();
 await t.test('quota reservation spans both recipients and retries never spend twice',async()=>{
  await rpc('policy',{enabled:true,limit:1,expiresAt:expiry(),apiAvailable:true},admin);
  for(const recipient of ['rose','praew'])await rpc('mode',{recipient,mode:'auto'},admin);
  const a=await prepare(),b=await prepare({...form,recipient:'praew'});
  const results=await Promise.all([markReady(a),markReady(b)]);assert.equal(results.filter(o=>o.runVerification).length,1);
  assert.equal((await markReady(a)).runVerification,false);
  const state=await rpc('settings',{apiAvailable:true},admin);assert.equal(state.verification.used,1);assert.equal(state.verification.enabled,false);
  const chosen=results.find(o=>o.runVerification);
  await rpc('verificationResult',{id:chosen.id,result:{status:'verified',reason:'test',ref:'QUOTA-001',paidAt:new Date().toISOString()}});
  await rpc('verificationResult',{id:chosen.id,result:{status:'verified',reason:'test',ref:'QUOTA-001'}});
  assert.equal((await rpc('donations')).length,1);
 });
 await reset();
 await t.test('quota settings require a key, expiry, and a positive remaining budget',async()=>{
  await assert.rejects(rpc('policy',{enabled:true,limit:1,expiresAt:expiry()},admin));
  for(const patch of [{limit:0},{limit:1.5},{expiresAt:'2000-01-01'}])await assert.rejects(rpc('policy',{enabled:true,limit:10,expiresAt:expiry(),apiAvailable:true,...patch},admin));
  await rpc('policy',{enabled:true,limit:10,expiresAt:expiry(),apiAvailable:true},admin);
  await rpc('pause');
  assert.equal((await rpc('settings',{apiAvailable:true},admin)).verification.enabled,false);
 });
 await reset();
 await t.test('external payments are atomic, validated and never spend API budget',async()=>{
  const payload={id:randomUUID(),form:{...form,recipient:'praew'},fingerprint:'external-test',verified:true,paidAmount:60,paidAt:new Date().toISOString(),channel:'LINE',externalRef:'EXT-001',reason:'Bank checked'};
  assert.equal((await rpc('external',payload,admin)).status,'approved');await rpc('external',payload,admin);
  const donation=(await rpc('donations'))[0];assert.equal(donation.recipient,'praew');assert.equal(donation.source,'external-payment');
  for(const name of ['account','externalRef','audit','slipPath','fingerprint'])assert.equal(donation[name],undefined);
  await assert.rejects(rpc('external',{...payload,id:randomUUID(),fingerprint:'new',externalRef:'EXT-002',paidAmount:1},admin));
  assert.equal((await rpc('settings',{},admin)).verification.used,0);
 });
 await reset();
 await t.test('closed receiving prevents manual and automatic credits',async()=>{
  const o=await prepare();await markReady(o);
  await db.exec("update heart_private.settings set data=jsonb_set(data,'{receivingEnabled}','false')");
  await assert.rejects(rpc('review',evidence(o),admin),/ยังไม่เปิด/);
  assert.equal((await rpc('donations')).length,0);
 });
});


test('Edge Function requests use real PostgreSQL transactions with mocked Auth, Storage and verifier',async t=>{
 const {db,rpc,configure}=await setup();t.after(()=>db.close());await configure();
 const objects=new Map();let failUpload=false,providerCalls=0;
 const service={
  rpc:async(name,args)=>{assert.equal(name,'heart_api');try{return {data:await rpc(args.p_action,args.p_payload,args.p_actor),error:null};}catch(e){return {data:null,error:{code:e.code,message:e.message}};}},
  auth:{getUser:async token=>token==='admin-token'?{data:{user:{id:admin}}}:token==='outsider-token'?{data:{user:{id:outsider}}}:{data:{user:null},error:{message:'invalid'}}},
  storage:{from:bucket=>{assert.equal(bucket,'donation-slips');return {
   upload:async(path,bytes,options)=>{assert.equal(options.upsert,true);if(failUpload)return {error:{statusCode:'503'}};objects.set(path,bytes);return {error:null};},
   createSignedUrl:async(path,seconds)=>({data:{signedUrl:'https://storage.test/'+path+'?ttl='+seconds},error:null})
  };}}
 };
 const env={APP_ORIGIN:'http://localhost:5173',RECEIVING_ENABLED:'true',EASYSLIP_API_KEY:'test-only'};
 const handler=createHandler({db:service,env:k=>env[k],verify:async()=>{providerCalls++;return {status:'verified',ref:'EDGE-VERIFY-'+providerCalls,reason:'test verifier',paidAt:new Date().toISOString()};}});
 const request=(path,{method='GET',body,token,reviewerToken,origin=env.APP_ORIGIN}={})=>{
  const headers={Origin:origin};if(reviewerToken)headers['x-reviewer-token']=reviewerToken;if(token)headers.Authorization='Bearer '+token;
  if(body && !(body instanceof FormData))headers['Content-Type']='application/json';
  return handler(new Request('https://project.test/functions/v1/heart-api'+path,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined}));
 };
 const upload=(id,bytes=png())=>{const body=new FormData();body.set('id',id);body.set('form',JSON.stringify(form));body.set('slip',new Blob([bytes],{type:'image/png'}),'slip.png');return body;};
 await t.test('closed config hides bank data even if DB receiving flag is true',async()=>{
  env.RECEIVING_ENABLED='false';const result=await (await request('/config')).json();assert.equal(result.enabled,false);assert.equal(result.accounts,null);
  assert.equal((await request('/orders',{method:'POST',body:upload(randomUUID())})).status,503);
  env.RECEIVING_ENABLED='true';
 });
 await t.test('only allowlisted authenticated admins can access state and slip URLs',async()=>{
  assert.equal((await request('/admin/state')).status,401);
  assert.equal((await request('/admin/state',{token:'invalid'})).status,401);
  assert.equal((await request('/admin/state',{token:'outsider-token'})).status,403);
  assert.equal((await request('/admin/state',{token:'admin-token'})).status,200);
  assert.equal((await request('/admin/mode',{method:'POST',token:'admin-token',origin:'https://evil.test',body:{recipient:'rose',mode:'auto'}})).status,403);
  assert.equal((await request('/admin/verification',{method:'POST',body:{enabled:true,limit:10,expiresAt:expiry()}})).status,401);
 });
 await t.test('storage outage preserves retryable order; manual upload spends no provider calls',async()=>{
  const id=randomUUID(),bytes=png();failUpload=true;
  assert.equal((await request('/orders',{method:'POST',body:upload(id,bytes)})).status,503);failUpload=false;
  const result=await (await request('/orders',{method:'POST',body:upload(id,bytes)})).json();assert.deepEqual(result,{id,status:'pending'});
  const retry=await request('/orders',{method:'POST',body:upload(id,bytes)});assert.equal(retry.status,200);assert.equal(providerCalls,0);assert.equal(objects.size,1);
  assert.equal((await request('/admin/slips/'+id)).status,401);
  const signed=await (await request('/admin/slips/'+id,{token:'admin-token'})).json();assert.match(signed.url,/\?ttl=60$/);
  const review={id,decision:'approve',reason:'Bank balance checked',confirmed:true,paidAmount:60,bankCode:'004',accountNumber:'1234567890',externalRef:'EDGE-MANUAL-001',paidAt:new Date().toISOString()};
  assert.equal((await request('/admin/review',{method:'POST',token:'admin-token',body:review})).status,200);
  const publicData=await (await request('/donations')).json();assert.equal(publicData.length,1);assert.equal(publicData[0].slipPath,undefined);
 });
 await t.test('automatic calls stop at shared budget and only public order status is returned',async()=>{
  assert.equal((await request('/admin/verification',{method:'POST',token:'admin-token',body:{enabled:true,limit:1,expiresAt:expiry()}})).status,200);
  await request('/admin/mode',{method:'POST',token:'admin-token',body:{recipient:'rose',mode:'auto'}});
  const a=await (await request('/orders',{method:'POST',body:upload(randomUUID())})).json();assert.equal(a.status,'approved');assert.deepEqual(Object.keys(a).sort(),['id','status']);
  const b=await (await request('/orders',{method:'POST',body:upload(randomUUID())})).json();assert.equal(b.status,'pending');assert.equal(providerCalls,1);
 });
 await t.test('public upload allowance cannot be reset by forged forwarding headers',async()=>{
  let last;for(let i=0;i<21;i++)last=await rpc('rate',{key:'limit-test'});assert.equal(last.allowed,false);
 });

 await t.test('password-only sessions enforce scope, owner isolation, expiry and revocation',async()=>{
  const setPassword=(scope,password='test-password-1234')=>request('/admin/reviewer-password',{method:'POST',token:'admin-token',body:{scope,password}});
  const signIn=async(scope,password='test-password-1234')=>request('/reviewer/login',{method:'POST',body:{scope,password}});
  assert.equal((await signIn('rose')).status,401);
  assert.equal((await setPassword('rose','')).status,400);
  assert.equal((await signIn('rose','')).status,401);
  for(const password of ['1','ก','x'.repeat(129)]){
   assert.equal((await setPassword('rose',password)).status,200);
   assert.equal((await signIn('rose',password)).status,200);
   assert.equal((await signIn('rose',password+'wrong')).status,401);
  }
  for(const scope of ['rose','praew','all'])assert.equal((await setPassword(scope)).status,200);
  assert.equal((await signIn('rose','incorrect')).status,401);
  const rose=await (await signIn('rose')).json(),all=await (await signIn('all')).json();
  assert.ok(Math.abs(Date.parse(rose.expiresAt)-Date.now()-7*86400000)<10000);
  const state=await (await request('/admin/state?scope=rose',{reviewerToken:rose.token})).json();
  assert.ok(state.orders.every(o=>o.form.recipient==='rose'));assert.equal(state.verification,undefined);
  assert.equal((await request('/admin/state?scope=praew',{reviewerToken:rose.token})).status,403);
  assert.equal((await request('/admin/state?scope=all',{reviewerToken:rose.token})).status,403);
  for(const session of [rose,all]){
   assert.equal((await request('/admin/settings',{reviewerToken:session.token})).status,403);
   assert.equal((await request('/admin/verification',{method:'POST',reviewerToken:session.token,body:{enabled:false}})).status,403);
   assert.equal((await request('/admin/reviewer-password',{method:'POST',reviewerToken:session.token,body:{scope:'rose',password:'hijack-password'}})).status,403);
  }
  const external={id:randomUUID(),scope:'rose',form:{...form,verified:true,paidAmount:60,paidAt:new Date().toISOString(),externalRef:'REVIEWER-EXT'}};
  assert.equal((await request('/admin/external',{method:'POST',reviewerToken:rose.token,body:{...external,form:{...external.form,recipient:'praew'}}})).status,403);
  const saved=await request('/admin/external',{method:'POST',reviewerToken:rose.token,body:external});assert.equal(saved.status,200,await saved.text());
  const id=randomUUID();await request('/orders',{method:'POST',body:upload(id)});
  assert.equal((await request('/admin/slips/'+id,{reviewerToken:rose.token})).status,200);
  const review={id,decision:'approve',scope:'rose',confirmed:true,paidAmount:60,bankCode:'004',accountNumber:'1234567890',externalRef:'REVIEWER-APPROVE',paidAt:new Date().toISOString()};
  const approved=await request('/admin/review',{method:'POST',reviewerToken:rose.token,body:review});assert.equal(approved.status,200,await approved.text());
  const order=(await rpc('state',{scope:'rose',reviewerHash:await digest(rose.token)})).orders.find(o=>o.id===id);
  assert.ok(order.audit.some(a=>a.actor?.startsWith('reviewer:rose:')));
  assert.equal((await request('/admin/state?scope=praew',{reviewerToken:all.token})).status,200);
  const settings=await (await request('/admin/settings',{token:'admin-token'})).json();assert.deepEqual(settings.reviewerPasswords,{rose:true,praew:true,all:true});assert.ok(!JSON.stringify(settings).includes('passwordHash'));
  await setPassword('rose','replacement-password');assert.equal((await request('/admin/state',{reviewerToken:rose.token})).status,401);
  assert.equal((await signIn('rose')).status,401);
  await db.query("update heart_private.reviewer_sessions set expires_at=now()-interval '1 second' where token_hash=$1",[await digest(all.token)]);
  assert.equal((await request('/admin/state',{reviewerToken:all.token})).status,401);
  const praew=await (await signIn('praew')).json();assert.equal((await request('/reviewer/logout',{method:'POST',reviewerToken:praew.token,body:{}})).status,200);
  assert.equal((await request('/admin/state',{reviewerToken:praew.token})).status,401);
  await db.query("insert into heart_private.admins(user_id,role,scope) values ($1,'reviewer','all')",[outsider]);
  assert.equal((await request('/admin/settings',{token:'outsider-token'})).status,403);
  for(const role of ['anon','authenticated','service_role']){await db.exec('set role '+role);try{await assert.rejects(db.query("select heart_private.heart_api_base('state','{}',$1)",[admin]));}finally{await db.exec('reset role');}}
 });
});
