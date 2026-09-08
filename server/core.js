import {createHash, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {cleanForm,imageType,verifySlip} from '../supabase/functions/_shared/domain.js';
export {cleanForm,imageType,verifySlip,assessSlip,normalizeRef} from '../supabase/functions/_shared/domain.js';
import {normalizeRef} from '../supabase/functions/_shared/domain.js';
import {crossedMilestones} from '../src/services/memoryService.js';

export const hash = value => createHash('sha256').update(value).digest('hex');
export function configuration(env = process.env) {
  const accounts = Object.fromEntries(['rose','praew'].map(id => {
    const prefix = id.toUpperCase();
    return [id, {bankCode:env[`${prefix}_BANK_CODE`] || '', bankName:env[`${prefix}_BANK_NAME`] || '', accountName:env[`${prefix}_ACCOUNT_NAME`] || '', accountNumber:env[`${prefix}_ACCOUNT_NUMBER`] || ''}];
  }));
  const missing = [];
  for (const [id,a] of Object.entries(accounts)) {
    if (!/^\d{3}$/.test(a.bankCode) || !a.bankName.trim() || !a.accountName.trim() || !/^\d{10,15}$/.test(a.accountNumber)) missing.push(`${id}: บัญชีผู้รับยังไม่ครบหรือไม่ถูกต้อง`);
  }
  if (accounts.rose.bankCode === accounts.praew.bankCode && accounts.rose.accountNumber === accounts.praew.accountNumber) missing.push('ต้องใช้บัญชีผู้รับแยกกัน');
  if (!env.ADMIN_USERNAME?.trim() || (env.ADMIN_PASSWORD?.length || 0) < 16) missing.push('ADMIN_USERNAME / ADMIN_PASSWORD (อย่างน้อย 16 ตัวอักษร)');
  let origin;
  try { origin = new URL(env.APP_ORIGIN).origin; } catch { missing.push('APP_ORIGIN'); }
  if (env.NODE_ENV === 'production' && !origin?.startsWith('https://')) missing.push('APP_ORIGIN ต้องเป็น HTTPS');
  if (env.RECEIVING_ENABLED !== 'true') missing.push('RECEIVING_ENABLED ยังปิดอยู่');
  return {accounts, missing, enabled:missing.length === 0, origin, production:env.NODE_ENV === 'production', apiKey:env.EASYSLIP_API_KEY, username:env.ADMIN_USERNAME, password:env.ADMIN_PASSWORD};
}
function fail(message, status=400) { throw Object.assign(new Error(message), {status}); }
export function openStore(path, config) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, slip BLOB, mime TEXT, slip_hash TEXT UNIQUE, reference TEXT UNIQUE);
    CREATE TABLE IF NOT EXISTS donations(id TEXT PRIMARY KEY REFERENCES orders(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS modes(recipient TEXT PRIMARY KEY, mode TEXT NOT NULL);
    INSERT OR IGNORE INTO modes VALUES ('rose','manual'),('praew','manual');
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS verification_policy(id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL, max_calls INTEGER NOT NULL, used INTEGER NOT NULL, expires_at TEXT NOT NULL, reason TEXT NOT NULL);
    INSERT OR IGNORE INTO verification_policy VALUES (1,0,0,0,'','ยังไม่ได้เปิดตรวจอัตโนมัติ');
    CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);`);
  const transaction = fn => {db.exec('BEGIN IMMEDIATE');try {const value=fn();db.exec('COMMIT');return value;} catch(e){db.exec('ROLLBACK');if(e.message.includes('UNIQUE constraint')) fail('สลิปหรือเลขอ้างอิงนี้ถูกใช้แล้ว',409);throw e;}};
  const event = (action,actor,reason) => ({action,actor,reason,at:new Date().toISOString()});
  const get = id => {const row=db.prepare('SELECT data FROM orders WHERE id=?').get(id);return row?JSON.parse(row.data):null;};
  const save = o => db.prepare('UPDATE orders SET status=?, data=?, reference=? WHERE id=?').run(o.status,JSON.stringify(o),o.externalRef || null,o.id);
  const modes = () => Object.fromEntries(db.prepare('SELECT * FROM modes').all().map(r=>[r.recipient,r.mode]));
  const policy = () => {
    const p=db.prepare('SELECT * FROM verification_policy WHERE id=1').get();
    const keyConfigured=!!config.apiKey?.trim();
    const active=!!p.enabled && keyConfigured && p.used<p.max_calls && Date.parse(p.expires_at)>Date.now();
    const reason=!p.enabled?p.reason:!keyConfigured?'ยังไม่มี EasySlip API key':p.used>=p.max_calls?'ถึงเพดานเรียก API แล้ว':!(Date.parse(p.expires_at)>Date.now())?'สิทธิ์ตรวจอัตโนมัติหมดอายุ':p.reason;
    return {enabled:!!p.enabled,active,keyConfigured,limit:p.max_calls,used:p.used,remaining:Math.max(0,p.max_calls-p.used),expiresAt:p.expires_at,reason};
  };
  const pause = (reason,actor='system') => {db.prepare('UPDATE verification_policy SET enabled=0, reason=? WHERE id=1').run(reason);db.prepare('INSERT INTO audit(data) VALUES (?)').run(JSON.stringify(event('automatic paused',actor,reason)));};
  const requireReady = () => {if(!config.enabled) fail('ยังไม่เปิดรับเงินจริง: การตั้งค่ายังไม่ครบหรือยังไม่เปิดใช้งาน',503);};
  const credit = (o,actor,reason) => {
    const before=db.prepare('SELECT data FROM donations').all().reduce((n,r)=>n+JSON.parse(r.data).quantity,0);
    const d={...o.form,id:o.id,sourceOrderId:o.id,source:o.kind,amount:o.amount,createdAt:new Date().toISOString(),specialHeart:null,memoryMilestones:crossedMilestones(before,before+o.form.quantity).map(m=>m.at)};
    db.prepare('INSERT INTO donations VALUES (?,?)').run(o.id,JSON.stringify(d));
    o.status='approved';o.donationId=o.id;o.audit.push(event('approved',actor,reason));save(o);
  };
  // A restart revokes all sessions, including after a credential change.
  db.exec('DELETE FROM sessions');
  const salt=randomBytes(16), passwordHash=scryptSync(config.password || randomBytes(32).toString('hex'),salt,64);
  return {
    db, get, modes, requireReady, policy,
    setVerificationPolicy(input) {
      if(typeof input.enabled!=='boolean')fail('สถานะเปิดปิดไม่ถูกต้อง');
      return transaction(()=>{
        if(!input.enabled){pause('แอดมินปิดตรวจอัตโนมัติ',config.username);return policy();}
        const current=policy();
        if(!config.apiKey?.trim())fail('ต้องตั้ง EasySlip API key ก่อนเปิดตรวจอัตโนมัติ');
        if(!Number.isSafeInteger(input.limit)||input.limit<=current.used||input.limit>1000000)fail('เพดานสะสมต้องมากกว่าจำนวนที่ใช้แล้ว และไม่เกิน 1,000,000');
        const expires=Date.parse(input.expiresAt);if(!Number.isFinite(expires)||expires<=Date.now())fail('กำหนดวันหมดอายุในอนาคต');
        db.prepare('UPDATE verification_policy SET enabled=1,max_calls=?,expires_at=?,reason=? WHERE id=1').run(input.limit,new Date(expires).toISOString(),'เปิดโดยแอดมิน');
        db.prepare('INSERT INTO audit(data) VALUES (?)').run(JSON.stringify(event('automatic enabled',config.username,JSON.stringify({limit:input.limit,used:current.used,expiresAt:new Date(expires).toISOString()}))));return policy();
      });
    },
    publicDonations:()=>db.prepare('SELECT data FROM donations ORDER BY rowid').all().map(r=>JSON.parse(r.data)),
    state:()=>({verification:policy(),modes:modes(),orders:db.prepare('SELECT data FROM orders ORDER BY rowid').all().map(r=>JSON.parse(r.data)),audit:db.prepare('SELECT data FROM audit').all().map(r=>JSON.parse(r.data)),actor:config.username,readiness:{enabled:config.enabled,missing:config.missing}}),
    rate(key,max,windowMs) {transaction(()=>{const now=Date.now();db.prepare('DELETE FROM limits WHERE reset < ?').run(now);const row=db.prepare('SELECT * FROM limits WHERE key=?').get(key);if(row && row.count>=max) fail('ทำรายการถี่เกินไป กรุณารอสักครู่',429);db.prepare('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,now+windowMs);});},
    login(username,password) {if(typeof password!=='string' || password.length>256) fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',401);const candidate=scryptSync(password,salt,64);if(!timingSafeEqual(candidate,passwordHash) || username!==config.username || !config.username || (config.password?.length||0)<16) fail('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',401);const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());db.prepare('INSERT INTO sessions VALUES (?,?)').run(hash(token),Date.now()+8*3600000);return token;},
    authenticated(token) {return !!db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(hash(token || ''),Date.now());},
    logout(token) {db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token || ''));},
    setMode(recipient,mode) {if(!['rose','praew'].includes(recipient)||!['auto','manual'].includes(mode)) fail('โหมดไม่ถูกต้อง');transaction(()=>{db.prepare('UPDATE modes SET mode=? WHERE recipient=?').run(mode,recipient);db.prepare('INSERT INTO audit(data) VALUES (?)').run(JSON.stringify(event('mode changed',config.username,`${recipient}: ${mode}`)));});},
    async submit(input, bytes, verify=verifySlip, external=null) {
      requireReady(); const form=cleanForm(input.form);
      if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/.test(input.id)) fail('รหัสรายการไม่ถูกต้อง');
      const mime=bytes?imageType(bytes):null;
      if(!bytes&&!external) fail('กรุณาแนบสลิป');
      const fingerprint=hash(JSON.stringify({form,slip:bytes?hash(bytes):null,external}));
      const old=get(input.id);if(old){const row=db.prepare('SELECT fingerprint FROM orders WHERE id=?').get(input.id);if(row.fingerprint!==fingerprint) fail('รหัสรายการนี้ใช้กับข้อมูลอื่นแล้ว',409);return old;}
      const o={id:input.id,form,amount:form.amount,mode:modes()[form.recipient],kind:external?'external-payment':'bank-transfer',status:'pending',createdAt:new Date().toISOString(),account:{...config.accounts[form.recipient]},hasSlip:!!bytes,audit:[event('submitted',external?config.username:'supporter','รอตรวจยอดเงินจริง')]};
      if(external){
        if(external.verified!==true||external.paidAmount!==form.amount||!['LINE','Facebook','Instagram','Other'].includes(external.channel)) fail('ต้องยืนยันยอดเงินและช่องทางให้ถูกต้อง');
        const date=Date.parse(external.paidAt);if(!Number.isFinite(date)||date>Date.now()+300000) fail('วันเวลาโอนไม่ถูกต้อง');
        if(typeof external.reason!=='string'||!external.reason.trim()||external.reason.length>200) fail('กรอกเหตุผลการบันทึก');
        o.externalRef=normalizeRef(external.externalRef);o.channel=external.channel;o.paidAt=new Date(date).toISOString();o.mode='manual';
      }
      let reserved=false;
      transaction(()=>{
        db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?)').run(o.id,fingerprint,o.status,JSON.stringify(o),bytes,mime,bytes?hash(bytes):null,o.externalRef||null);
        if(external){credit(o,config.username,external.reason);return;}
        if(o.mode==='manual')return;
        const p=policy();
        if(!p.active){
          if(p.enabled)pause(p.reason);
          o.effectiveMode='manual';o.audit.push(event('manual fallback','system',p.reason));save(o);return;
        }
        // Reserve atomically with the order. Failures and crashes never refund calls.
        db.prepare('UPDATE verification_policy SET used=used+1 WHERE id=1').run();
        reserved=true;o.effectiveMode='auto';o.audit.push(event('API call reserved','system','จองโควต้าร่วมโรส–แพรว 1 ครั้ง'));save(o);
        if(p.remaining===1)pause('ถึงเพดานเรียก API แล้ว กรุณาตรวจสิทธิ์ก่อนเปิดใหม่');
      });
      if(!reserved) return get(o.id);
      let result;
      try {result=await verify(bytes,mime,form,o.account,config.apiKey);} catch {result={status:'pending',pauseAuto:true,reason:'บริการตรวจสลิปไม่พร้อม ปิดอัตโนมัติและรอแอดมินตรวจยอด'};}
      if(result.pauseAuto)transaction(()=>pause(result.reason));
      try {transaction(()=>{const current=get(o.id);if(current.status!=='pending') return;current.audit.push(event('verification','EasySlip',result.reason));current.verification=result.status;current.externalRef=result.ref;current.paidAt=result.paidAt;if(result.status==='verified') credit(current,'EasySlip',result.reason);else {current.status=result.status==='rejected'?'rejected':'pending';save(current);}});} catch(e) {if(e.status!==409)throw e;transaction(()=>{const current=get(o.id);if(current.status!=='pending')return;current.status='rejected';current.audit.push(event('rejected','system','เลขอ้างอิงถูกใช้แล้ว'));save(current);});}
      return get(o.id);
    },
    review(id,input) {return transaction(()=>{const o=get(id);if(!o) fail('ไม่พบรายการ',404);if(!['approve','reject'].includes(input.decision)) fail('คำสั่งไม่ถูกต้อง');if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>200)fail('กรอกเหตุผล ไม่เกิน 200 ตัวอักษร');if(o.status!=='pending')return o;
      if(input.decision==='approve'){requireReady();if(input.confirmed!==true||input.paidAmount!==o.amount||input.accountNumber!==o.account.accountNumber||input.bankCode!==o.account.bankCode)fail('ต้องยืนยันยอดเงินและบัญชีปลายทางจากธนาคาร');const ref=normalizeRef(input.externalRef);if(o.externalRef&&o.externalRef!==ref)fail('เลขอ้างอิงไม่ตรงกับผลตรวจ');const date=Date.parse(input.paidAt);if(!Number.isFinite(date)||date>Date.now()+300000)fail('วันเวลาโอนไม่ถูกต้อง');o.externalRef=ref;o.paidAt=new Date(date).toISOString();credit(o,config.username,input.reason);}else{o.status='rejected';o.audit.push(event('rejected',config.username,input.reason));save(o);}return o;});},
    slip(id) {return db.prepare('SELECT slip,mime FROM orders WHERE id=?').get(id);}
  };
}
