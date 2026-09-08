import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configuration,openStore,assessSlip,cleanForm,imageType} from '../server/core.js';
import {createApp} from '../server/index.js';
const env={RECEIVING_ENABLED:'true',APP_ORIGIN:'http://localhost:5173',ADMIN_USERNAME:'admin',ADMIN_PASSWORD:'test-password-only-123456',EASYSLIP_API_KEY:'test-only-key',ROSE_BANK_CODE:'004',ROSE_BANK_NAME:'Rose bank',ROSE_ACCOUNT_NAME:'Rose',ROSE_ACCOUNT_NUMBER:'1234567890',PRAEW_BANK_CODE:'014',PRAEW_BANK_NAME:'Praew bank',PRAEW_ACCOUNT_NAME:'Praew',PRAEW_ACCOUNT_NUMBER:'0987654321'};
const form={recipient:'rose',heartType:'pink',quantity:3,supporterName:'Test',anonymous:false,message:'Hello',socialUsername:''};
const png=()=>Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from(randomUUID())]);
function setup(t,config=configuration(env)){const s=openStore(':memory:',config);t.after(()=>s.db.close());if(config.apiKey)s.setVerificationPolicy({enabled:true,limit:100,expiresAt:new Date(Date.now()+86400000).toISOString()});return s;}
const evidence=(o,ref='TRANSFER-001')=>({decision:'approve',reason:'Checked incoming bank balance',confirmed:true,paidAmount:o.amount,bankCode:o.account.bankCode,accountNumber:o.account.accountNumber,externalRef:ref,paidAt:new Date().toISOString()});
const verified=(ref='TRANSFER-001')=>async()=>({status:'verified',reason:'verified test fixture',ref,paidAt:new Date().toISOString()});
const external=(patch={})=>({...form,paidAmount:60,verified:true,channel:'LINE',externalRef:'EXTERNAL-001',paidAt:new Date().toISOString(),reason:'Bank balance checked',...patch});

test('receiving fails closed for every missing setting and identical accounts',async t=>{
 for(const key of Object.keys(env).filter(k=>k!=='EASYSLIP_API_KEY')){const c=configuration({...env,[key]:''});assert.equal(c.enabled,false,key);}
 assert.equal(configuration({...env,RECEIVING_ENABLED:'false'}).enabled,false);
 assert.equal(configuration({...env,PRAEW_BANK_CODE:env.ROSE_BANK_CODE,PRAEW_ACCOUNT_NUMBER:env.ROSE_ACCOUNT_NUMBER}).enabled,false);
 assert.equal(configuration({...env,NODE_ENV:'production'}).enabled,false);
 const s=setup(t,configuration({}));await assert.rejects(s.submit({id:randomUUID(),form},png()),/ยังไม่เปิด/);assert.equal(s.publicDonations().length,0);
});
test('server prices ignore client totals and reject malformed allocations',()=>{
 assert.equal(cleanForm({...form,amount:1}).amount,60);
 for(const patch of [{recipient:'fake'},{quantity:1.2},{quantity:101},{mode:'amount'},{supporterName:' '},{message:'x'.repeat(121)}])assert.throws(()=>cleanForm({...form,...patch}));
 assert.throws(()=>imageType(Buffer.from('<svg>not a slip</svg>')));
 assert.throws(()=>imageType(Buffer.alloc(4*1024*1024+1)));
});
test('manual queue, mode snapshot, evidence validation and idempotent credit',async t=>{
 const s=setup(t);const o=await s.submit({id:randomUUID(),form},png());assert.equal(s.publicDonations().length,0);
 s.setMode('rose','auto');assert.equal(s.get(o.id).mode,'manual');assert.equal(s.modes().praew,'manual');
 for(const patch of [{confirmed:false},{paidAmount:1},{accountNumber:env.PRAEW_ACCOUNT_NUMBER},{bankCode:'014'},{externalRef:''},{paidAt:'invalid'}])assert.throws(()=>s.review(o.id,{...evidence(o),...patch}));
 const approved=s.review(o.id,evidence(o));assert.equal(approved.status,'approved');s.review(o.id,evidence(o));
 assert.equal(s.publicDonations().length,1);assert.equal(s.publicDonations()[0].amount,60);assert.equal(s.get(o.id).audit.at(-1).actor,'admin');
});
test('rejection is terminal',async t=>{const s=setup(t);const o=await s.submit({id:randomUUID(),form},png());s.review(o.id,{decision:'reject',reason:'Wrong slip'});s.review(o.id,evidence(o));assert.equal(s.publicDonations().length,0);});
test('auto verifier credits once during concurrent identical requests',async t=>{
 const s=setup(t);s.setMode('rose','auto');const input={id:randomUUID(),form},bytes=png();let calls=0;
 await Promise.all([s.submit(input,bytes,async()=>{calls++;await new Promise(r=>setTimeout(r,10));return {status:'verified',ref:'AUTO-001',reason:'test'};}),s.submit(input,bytes,verified())]);
 assert.equal(calls,1);assert.equal(s.publicDonations().length,1);assert.equal((await s.submit(input,bytes)).status,'approved');
 await assert.rejects(s.submit({...input,form:{...form,quantity:4}},bytes),/ข้อมูลอื่น/);
});
test('image hash and transaction reference deduplicate across recipients',async t=>{
 const s=setup(t);const bytes=png();const a=await s.submit({id:randomUUID(),form},bytes);s.review(a.id,evidence(a));
 await assert.rejects(s.submit({id:randomUUID(),form:{...form,recipient:'praew'}},bytes),/ถูกใช้แล้ว/);
 const b=await s.submit({id:randomUUID(),form:{...form,recipient:'praew'}},png());assert.throws(()=>s.review(b.id,evidence(b)),/ถูกใช้แล้ว/);assert.equal(s.get(b.id).status,'pending');assert.equal(s.publicDonations().length,1);
});
test('provider failure remains pending; rejected result cannot credit',async t=>{
 const s=setup(t);s.setMode('rose','auto');
 const a=await s.submit({id:randomUUID(),form},png(),async()=>{throw new Error('timeout');});assert.equal(a.status,'pending');
 s.setVerificationPolicy({enabled:true,limit:100,expiresAt:new Date(Date.now()+86400000).toISOString()});
 const b=await s.submit({id:randomUUID(),form},png(),async()=>({status:'rejected',reason:'wrong recipient'}));assert.equal(b.status,'rejected');assert.equal(s.publicDonations().length,0);
});
test('auto duplicate references reject second order without credit',async t=>{
 const s=setup(t);s.setMode('rose','auto');await s.submit({id:randomUUID(),form},png(),verified());
 const b=await s.submit({id:randomUUID(),form},png(),verified());assert.equal(b.status,'rejected');assert.equal(s.publicDonations().length,1);
});
test('approval and credit rollback together on a database failure',async t=>{
 const s=setup(t);const o=await s.submit({id:randomUUID(),form},png());
 s.db.exec("CREATE TRIGGER fail_credit BEFORE INSERT ON donations BEGIN SELECT RAISE(ABORT,'test storage failure'); END;");
 assert.throws(()=>s.review(o.id,evidence(o)));assert.equal(s.get(o.id).status,'pending');assert.equal(s.publicDonations().length,0);
 s.db.exec('DROP TRIGGER fail_credit');s.review(o.id,evidence(o));assert.equal(s.publicDonations().length,1);
});
test('closed receiving blocks pending approval and external writes',async t=>{
 const c=configuration(env),s=setup(t,c);const o=await s.submit({id:randomUUID(),form},png());c.enabled=false;
 assert.throws(()=>s.review(o.id,evidence(o)),/ยังไม่เปิด/);await assert.rejects(s.submit({id:randomUUID(),form},null,undefined,external()),/ยังไม่เปิด/);
});
test('external donations validate amount, deduplicate and credit selected recipient atomically',async t=>{
 const s=setup(t);const f={...form,recipient:'praew'},ext=external({recipient:'praew'}),id=randomUUID();
 await s.submit({id,form:f},null,undefined,ext);await s.submit({id,form:f},null,undefined,ext);
 assert.equal(s.publicDonations().length,1);assert.equal(s.publicDonations()[0].recipient,'praew');assert.equal(s.publicDonations()[0].source,'external-payment');
 await assert.rejects(s.submit({id:randomUUID(),form},null,undefined,ext),/ถูกใช้แล้ว/);
 for(const patch of [{paidAmount:59},{verified:false},{paidAt:'invalid'},{reason:''},{channel:'fake'}])await assert.rejects(s.submit({id:randomUUID(),form},null,undefined,external(patch)));
});
test('actual verifier assessment requires exact account, amount, currency and reference',()=>{
 const f=cleanForm(form),a=configuration(env).accounts.rose;
 const data={transRef:'REAL-123',countryCode:'TH',date:new Date().toISOString(),amount:{amount:60},receiver:{bank:{id:'004'},account:{bank:{account:a.accountNumber}}}};
 assert.equal(assessSlip(data,f,a).status,'verified');
 assert.equal(assessSlip({...data,receiver:{...data.receiver,account:{bank:{account:'1234xx7890'}}}},f,a).status,'pending');
 for(const patch of [{amount:{amount:1}},{countryCode:'US'},{date:'2020-01-01'},{receiver:{bank:{id:'014'}}},{receiver:{bank:{id:'004'},account:{bank:{account:'1111111111'}}}}])assert.equal(assessSlip({...data,...patch},f,a).status,'rejected');
 assert.equal(assessSlip({...data,transRef:null},f,a).status,'pending');
});
test('central database persists and public records exclude secrets and anonymous identity',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'heart-test-')),path=join(dir,'test.sqlite');let s;
 try{s=openStore(path,configuration(env));const o=await s.submit({id:randomUUID(),form:{...form,anonymous:true,supporterName:'SECRET',socialUsername:'@SECRET'}},png());s.review(o.id,evidence(o));s.db.close();s=openStore(path,configuration(env));const d=s.publicDonations()[0];assert.equal(d.supporterName,'Anonymous');assert.equal(d.socialUsername,'');for(const key of ['account','audit','externalRef','slip','creditedBy'])assert.equal(d[key],undefined);assert.equal(s.state().orders.length,1);}finally{s?.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('HTTP auth, CSRF origin, private images, logout and upload',async t=>{
 const config=configuration(env),store=setup(t),app=createApp({config,store,verify:verified()});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));
 const base='http://127.0.0.1:'+app.address().port;
 const req=(path,options={})=>fetch(base+'/api'+path,options);
 assert.equal((await req('/admin/state')).status,401);
 assert.equal((await req('/login',{method:'POST',body:'{}'})).status,403);
 const post=(body,cookie)=>({method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 assert.equal((await req('/login',post({username:'admin',password:'wrong'}))).status,401);
 const login=await req('/login',post({username:'admin',password:env.ADMIN_PASSWORD}));assert.equal(login.status,200);
 const header=login.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);const cookie=header.split(';')[0];
 assert.equal((await req('/admin/state',{headers:{Cookie:cookie}})).status,200);
 const fd=new FormData();fd.set('id',randomUUID());fd.set('form',JSON.stringify(form));fd.set('slip',new Blob([png()],{type:'image/png'}),'slip.png');
 const uploaded=await req('/orders',{method:'POST',headers:{Origin:env.APP_ORIGIN},body:fd});assert.equal(uploaded.status,200);const o=await uploaded.json();
 assert.equal(o.status,'pending');assert.deepEqual(Object.keys(o).sort(),['id','status']);
 assert.equal((await req('/admin/slips/'+o.id)).status,401);
 const slip=await req('/admin/slips/'+o.id,{headers:{Cookie:cookie}});assert.equal(slip.status,200);assert.equal(slip.headers.get('x-content-type-options'),'nosniff');
 assert.equal((await req('/admin/verification',post({enabled:false}))).status,401);
 assert.equal((await req('/admin/verification',{...post({enabled:false},cookie),headers:{Cookie:cookie,Origin:'https://wrong.example','Content-Type':'application/json'}})).status,403);
 assert.equal((await req('/admin/verification',post({enabled:false},cookie))).status,200);
 assert.equal((await (await req('/admin/state',{headers:{Cookie:cookie}})).json()).verification.active,false);
 await req('/logout',post({},cookie));assert.equal((await req('/admin/state',{headers:{Cookie:cookie}})).status,401);
});
test('closed HTTP API hides accounts and rejects uploads',async t=>{
 const config=configuration({}),store=setup(t,config),app=createApp({config,store});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));
 const base='http://127.0.0.1:'+app.address().port;
 const result=await (await fetch(base+'/api/config')).json();assert.equal(result.enabled,false);assert.equal(result.accounts,null);
 assert.deepEqual(await (await fetch(base+'/api/donations')).json(),[]);
});
test('session expiry and rate limiting are enforced',t=>{const s=setup(t);const token=s.login('admin',env.ADMIN_PASSWORD);assert.equal(s.authenticated(token),true);s.db.exec('UPDATE sessions SET expires=0');assert.equal(s.authenticated(token),false);s.rate('test',1,60000);assert.throws(()=>s.rate('test',1,60000),/ถี่เกิน/);});

test('manual receiving works without EasySlip key and cannot enable automatic',async t=>{
 const config=configuration({...env,EASYSLIP_API_KEY:''});assert.equal(config.enabled,true);
 const s=setup(t,config);assert.equal(s.policy().active,false);
 assert.throws(()=>s.setVerificationPolicy({enabled:true,limit:10,expiresAt:new Date(Date.now()+10000).toISOString()}),/API key/);
 let calls=0;s.setMode('rose','auto');
 const o=await s.submit({id:randomUUID(),form},png(),async()=>{calls++;return {};});
 assert.equal(calls,0);assert.equal(o.effectiveMode,'manual');s.review(o.id,evidence(o));assert.equal(s.publicDonations().length,1);
});
test('new databases start manual with automatic disabled and zero budget',t=>{
 const s=openStore(':memory:',configuration(env));t.after(()=>s.db.close());
 assert.deepEqual(s.modes(),{rose:'manual',praew:'manual'});assert.equal(s.policy().active,false);assert.equal(s.policy().limit,0);assert.equal(s.policy().used,0);
});
test('shared ceiling handles concurrent Rose and Praew submissions and retries',async t=>{
 const s=setup(t);s.setMode('rose','auto');s.setMode('praew','auto');
 s.setVerificationPolicy({enabled:true,limit:1,expiresAt:new Date(Date.now()+86400000).toISOString()});
 let calls=0;const verify=async()=>{calls++;await new Promise(r=>setTimeout(r,10));return {status:'verified',reason:'test',ref:'SHARED-001'};};
 const input={id:randomUUID(),form},bytes=png();
 const [a,b]=await Promise.all([s.submit(input,bytes,verify),s.submit({id:randomUUID(),form:{...form,recipient:'praew'}},png(),verify)]);
 assert.equal(calls,1);assert.equal(a.status,'approved');assert.equal(b.status,'pending');assert.equal(b.effectiveMode,'manual');assert.equal(s.policy().used,1);assert.equal(s.policy().enabled,false);
 await s.submit(input,bytes,verify);assert.equal(calls,1);assert.equal(s.policy().used,1);
});
test('failed calls consume budget and pause both recipients until explicit resume',async t=>{
 const s=setup(t);s.setMode('rose','auto');s.setMode('praew','auto');let calls=0;
 await s.submit({id:randomUUID(),form},png(),async()=>{calls++;throw Error('timeout');});
 assert.equal(s.policy().used,1);assert.equal(s.policy().enabled,false);
 await s.submit({id:randomUUID(),form:{...form,recipient:'praew'}},png(),async()=>{calls++;return {};});assert.equal(calls,1);
 s.setVerificationPolicy({enabled:true,limit:3,expiresAt:new Date(Date.now()+10000).toISOString()});
 assert.equal(s.policy().used,1);await s.submit({id:randomUUID(),form},png(),verified('RESUMED-001'));assert.equal(s.policy().used,2);
});
test('expired permission and global off never start provider calls',async t=>{
 const s=setup(t);s.setMode('rose','auto');let calls=0;
 s.db.prepare('UPDATE verification_policy SET expires_at=?').run('2020-01-01T00:00:00Z');
 await s.submit({id:randomUUID(),form},png(),async()=>{calls++;return {};});
 assert.equal(calls,0);assert.equal(s.policy().enabled,false);
 s.setVerificationPolicy({enabled:true,limit:2,expiresAt:new Date(Date.now()+10000).toISOString()});s.setVerificationPolicy({enabled:false});
 await s.submit({id:randomUUID(),form},png(),async()=>{calls++;return {};});assert.equal(calls,0);assert.equal(s.policy().used,0);
 for(const patch of [{limit:0},{limit:1.2},{limit:1000001},{expiresAt:'invalid'},{expiresAt:'2020-01-01'}])assert.throws(()=>s.setVerificationPolicy({enabled:true,limit:10,expiresAt:new Date(Date.now()+10000).toISOString(),...patch}));
});
test('duplicate upload rollback does not spend another API call',async t=>{
 const s=setup(t);s.setMode('rose','auto');const bytes=png();
 await s.submit({id:randomUUID(),form},bytes,verified('ROLLBACK-001'));
 await assert.rejects(s.submit({id:randomUUID(),form},bytes,verified('ROLLBACK-002')));assert.equal(s.policy().used,1);
});
test('quota usage survives restart and is not reset by changing the API key',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'heart-quota-')),path=join(dir,'test.sqlite');let s;
 try{
  s=openStore(path,configuration(env));s.setMode('rose','auto');s.setVerificationPolicy({enabled:true,limit:1,expiresAt:new Date(Date.now()+10000).toISOString()});
  await s.submit({id:randomUUID(),form},png(),verified('PERSIST-001'));s.db.close();
  s=openStore(path,configuration({...env,EASYSLIP_API_KEY:'changed-test-key'}));
  assert.equal(s.policy().used,1);assert.equal(s.policy().enabled,false);assert.throws(()=>s.setVerificationPolicy({enabled:true,limit:1,expiresAt:new Date(Date.now()+10000).toISOString()}));
 }finally{s?.db.close();rmSync(dir,{recursive:true,force:true});}
});


test('provider quota and authorization errors request a global pause',async t=>{
 const {verifySlip}=await import('../server/core.js');
 const mock=t.mock.method(globalThis,'fetch',async()=>({ok:false,json:async()=>({status:403,message:'quota_exceeded'})}));
 let result=await verifySlip(png(),'image/png',cleanForm(form),configuration(env).accounts.rose,'test-key');
 assert.equal(result.status,'pending');assert.equal(result.pauseAuto,true);
 mock.mock.mockImplementation(async()=>({ok:false,json:async()=>({status:401,message:'unauthorized'})}));
 result=await verifySlip(png(),'image/png',cleanForm(form),configuration(env).accounts.rose,'test-key');
 assert.equal(result.pauseAuto,true);
});
