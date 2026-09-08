import {randomHex,passwordHash,sameHash} from '../_shared/passwords.js';
import {cleanForm,imageType,verifySlip,normalizeRef} from '../_shared/domain.js';
export const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?new TextEncoder().encode(bytes):bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
const error=(message,status=400)=>Object.assign(new Error(message),{status});
export function createHandler({db,env,verify=verifySlip}){
 return async req=>{
  const origin=env('APP_ORIGIN')||'',requestOrigin=req.headers.get('origin');
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(requestOrigin===origin && origin)headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info, x-reviewer-token';
  headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  const apiAvailable=!!env('EASYSLIP_API_KEY')?.trim();
  const live=env('RECEIVING_ENABLED')==='true' && !!origin && (origin.startsWith('https://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  let reviewerHash=null;
  const rpc=async(action,payload={},actor=null,withReviewer=true)=>{
   const {data,error:e}=await db.rpc('heart_api',{p_action:action,p_payload:{...payload,apiAvailable,...(reviewerHash&&withReviewer?{reviewerHash}:{})},p_actor:actor});
   if(e)throw error(e.code==='23505'?'สลิป เลขอ้างอิง หรือรหัสรายการนี้ถูกใช้แล้ว':e.code==='42501'?'บัญชีนี้ไม่มีสิทธิ์แอดมิน':e.code==='P0001'?e.message:'ทำรายการฐานข้อมูลไม่สำเร็จ',e.code==='23505'?409:e.code==='28000'?401:e.code==='42501'?403:400);
   return data;
  };
  try{
   if(req.method==='OPTIONS')return requestOrigin===origin&&origin?new Response(null,{status:204,headers}):json({error:'Origin not allowed'},403);
   const url=new URL(req.url),path=url.pathname.slice(url.pathname.indexOf('/heart-api')+10);
   if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed'},405);
   if(req.method==='POST'&&(!origin||requestOrigin!==origin))throw error('เว็บไซต์ไม่ตรง APP_ORIGIN',403);
   let actor=null;
   if(path.startsWith('/admin/')||path==='/reviewer/logout'){
    const token=req.headers.get('x-reviewer-token');
    if(token){if(!/^[a-f0-9]{64}$/.test(token))throw error('กรุณาใส่รหัสผ่านใหม่',401);reviewerHash=await digest(token);await rpc('authorize');}
    else{
     const match=/^Bearer (.+)$/i.exec(req.headers.get('authorization')||'');
     if(!match)throw error('กรุณาเข้าสู่ระบบ',401);
     const {data,error:e}=await db.auth.getUser(match[1]);
     if(e||!data?.user)throw error('เซสชันหมดอายุ กรุณาล็อกอินใหม่',401);
     actor=data.user.id;await rpc('authorize',{},actor);
    }
   }
   const ready=async()=>{
    if(!live)throw error('ยังไม่เปิดรับเงินจริง',503);
    const config=await rpc('config',{},null,false);if(!config.enabled)throw error('บัญชีผู้รับหรือแอดมินยังตั้งค่าไม่ครบ',503);
   };
   const body=async()=>{
    const limit=5*1024*1024;
    if(Number(req.headers.get('content-length'))>limit)throw error('ไฟล์ใหญ่เกินกำหนด',413);
    const reader=req.body?.getReader();if(!reader)throw error('ไม่มีข้อมูล');
    const chunks=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw error('ไฟล์ใหญ่เกินกำหนด',413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return bytes;
   };
   const readJSON=async()=>JSON.parse(new TextDecoder().decode(await body()));
   if(path==='/reviewer/login'&&req.method==='POST'){
    const b=await readJSON();if(!['rose','praew','all'].includes(b.scope)||typeof b.password!=='string'||b.password.length>128)throw error('รหัสผ่านไม่ถูกต้อง',401);
    if(!(await rpc('rate',{key:'reviewer-login:'+b.scope})).allowed)throw error('ลองรหัสผ่านหลายครั้งเกินไป กรุณารอสักครู่',429);
    const credentials=await rpc('reviewer_credentials',{scope:b.scope});
    const candidate=await passwordHash(b.password,credentials?.salt||'00000000000000000000000000000000');
    if(!credentials||!sameHash(candidate,credentials.passwordHash))throw error('รหัสผ่านไม่ถูกต้อง หรือยังไม่ได้ตั้งรหัสสำหรับหน้านี้',401);
    const token=randomHex(32);const session=await rpc('reviewer_session_create',{scope:b.scope,version:credentials.version,tokenHash:await digest(token)});
    return json({...session,token});
   }
   if(path==='/reviewer/logout'&&req.method==='POST'){if(!reviewerHash)throw error('เซสชันไม่ถูกต้อง',401);return json(await rpc('reviewer_logout'));}
   if(path==='/admin/reviewer-password'&&req.method==='POST'){
    await rpc('settings',{},actor);const b=await readJSON();
    if(!['rose','praew','all'].includes(b.scope)||typeof b.password!=='string'||b.password.length<12||b.password.length>128)throw error('รหัสผ่านต้องยาว 12–128 ตัวอักษร');
    const salt=randomHex(16);return json(await rpc('reviewer_password',{scope:b.scope,salt,passwordHash:await passwordHash(b.password,salt)},actor));
   }
   if(path==='/config'&&req.method==='GET'){
    if(!live)return json({enabled:false,accounts:null,message:'ยังไม่เปิดรับเงินจริง กำลังตั้งค่าระบบ'});
    return json(await rpc('config'));
   }
   if(path==='/donations'&&req.method==='GET')return json(await rpc('donations'));
   if(path==='/orders'&&req.method==='POST'){
    await ready();
    // A shared upload allowance cannot be bypassed using client-forged forwarding headers.
    if(!(await rpc('rate',{key:'website-uploads'})).allowed)throw error('มีการส่งสลิปถี่เกินไป กรุณารอหรือติดต่อแอดมิน',429);
    const formData=await new Request('https://local.invalid',{method:'POST',headers:{'Content-Type':req.headers.get('content-type')||''},body:await body()}).formData();
    const file=formData.get('slip');if(!file||typeof file.arrayBuffer!=='function')throw error('กรุณาแนบสลิป');
    const bytes=new Uint8Array(await file.arrayBuffer()),mime=imageType(bytes),form=cleanForm(JSON.parse(formData.get('form')));
    const id=formData.get('id');if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw error('รหัสรายการไม่ถูกต้อง');
    const slipHash=await digest(bytes),fingerprint=await digest(JSON.stringify({form,slipHash}));
    let order=await rpc('prepare',{id,form,slipHash,fingerprint});
    if(order.status!=='pending'||order.slipReady)return json({id:order.id,status:order.status});
    const {error:uploadError}=await db.storage.from('donation-slips').upload(order.slipPath,bytes,{contentType:mime,upsert:true});
    // The path includes a server-calculated content hash; retries overwrite identical bytes only.
    if(uploadError)throw error('อัปโหลดสลิปยังไม่สำเร็จ ลองส่งรายการเดิมอีกครั้ง',503);
    order=await rpc('ready',{id,fingerprint});
    if(order.runVerification){
     let result;
     try{result=await verify(bytes,mime,order.form,order.account,env('EASYSLIP_API_KEY'));}
     catch{result={status:'pending',pauseAuto:true,reason:'บริการตรวจสลิปไม่พร้อม รอแอดมิน'};}
     if(result.pauseAuto)await rpc('pause');
     order=await rpc('verificationResult',{id,result});
    }
    return json({id:order.id,status:order.status});
   }
   if(path==='/admin/state'&&req.method==='GET'){
    const state=await rpc('state',{scope:url.searchParams.get('scope')||undefined},actor);
    if(!live)state.readiness={enabled:false,missing:[...state.readiness.missing,'RECEIVING_ENABLED หรือ APP_ORIGIN ยังไม่พร้อม']};
    return json(state);
   }
   if(path==='/admin/settings'&&req.method==='GET'){const state=await rpc('settings',{},actor);if(!live)state.readiness={enabled:false,missing:[...state.readiness.missing,'RECEIVING_ENABLED หรือ APP_ORIGIN ยังไม่พร้อม']};return json(state);}
   if(path==='/admin/mode'&&req.method==='POST')return json(await rpc('mode',await readJSON(),actor));
   if(path==='/admin/verification'&&req.method==='POST')return json(await rpc('policy',await readJSON(),actor));
   if(path==='/admin/review'&&req.method==='POST'){const b=await readJSON();if(b.decision==='approve')await ready();return json(await rpc('review',b,actor));}
   if(path==='/admin/external'&&req.method==='POST'){
    await ready();const b=await readJSON(),form=cleanForm(b.form);
    const payload={id:b.id,form,verified:b.form.verified,paidAmount:b.form.paidAmount,channel:'Other',externalRef:normalizeRef(b.form.externalRef),paidAt:b.form.paidAt,reason:'แอดมินยืนยันยอดเข้าบัญชีจากรายการภายนอก',scope:b.scope};
    payload.fingerprint=await digest(JSON.stringify(payload));
    return json(await rpc('external',payload,actor));
   }
   if(path.startsWith('/admin/slips/')&&req.method==='GET'){
    const slip=await rpc('slip',{id:path.split('/').pop()},actor);
    const {data,error:e}=await db.storage.from('donation-slips').createSignedUrl(slip.path,60);
    if(e)throw error('เปิดสลิปไม่สำเร็จ',503);return json({url:data.signedUrl});
   }
   return json({error:'ไม่พบ API'},404);
  }catch(e){return json({error:e.status?e.message:'ทำรายการไม่สำเร็จ กรุณาลองใหม่ด้วยรหัสเดิม'},e.status||400);}
 };
}
