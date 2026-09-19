import {heartTypes} from '../data/heartTypes';
import ReviewerPasswords from './ReviewerPasswords';
import VerificationControls from './VerificationControls';
import ExternalDonationForm from './ExternalDonationForm';
import {useState,useEffect} from 'react';
import {getAdminState,getAdminSettings,setReviewMode,reviewOrder,recordExternalDonation,login,logout,setVerificationPolicy,getSlipURL,loginReviewer,logoutReviewer,setReviewerPassword,deleteApprovedDonation} from '../services/adminService';
const name=id=>id==='rose'?'โรส':id==='praew'?'แพรว':'ทั้งสองฝั่ง';
export default function AdminPanel({scope='all',settings=false}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[filter,setFilter]=useState('pending');
 const refresh=async()=>setData(await (settings?getAdminSettings():getAdminState(scope)));
 async function run(fn){if(busy)return;setBusy(true);setError('');try{await fn();await refresh();}catch(e){setError(e.message);if([401,403].includes(e.status))setData(null);}finally{setBusy(false);}}
 async function signOut(){try{await (settings||data?.permissions?.owner?logout():logoutReviewer(scope));setData(null);setPassword('');setError('');}catch(e){setError(e.message);}}
 useEffect(()=>{if(!settings){refresh().catch(e=>{if(e.status!==401)setError(e.message);});}},[scope,settings]);
 const title=settings?'ตั้งค่าอัตโนมัติ · เจ้าของระบบ':'อนุมัติโดเนท · '+name(scope);
 return <main className="admin-page"><div className="admin-page-header"><a href="/">← กลับหน้าหลัก</a><span>HEART COLLECTION</span></div><h1>{title}</h1>
 {error&&<p className="error" role="alert">{error}</p>}
 {!data?<form className="supporter-form admin-login" onSubmit={e=>{e.preventDefault();run(async()=>{await (settings?login(username,password):loginReviewer(scope,password));setPassword('');});}}>
 <p>{settings?'เข้าสู่ระบบเจ้าของ':'ใส่รหัสผ่านของหน้านี้ ระบบจะจำเบราว์เซอร์ 7 วัน'}</p>
 {settings&&<label>อีเมลเจ้าของระบบ<input type="email" autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></label>}
 <label>รหัสผ่าน<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'กำลังตรวจสิทธิ์…':'เข้าสู่ระบบ'}</button>
 </form>:<>
 <p className="admin-session">เข้าสู่ระบบแล้ว <button disabled={busy} onClick={signOut}>ออกจากระบบ</button></p>
 <div className="admin-demo"><b>{data.readiness.enabled?'เปิดรับโดเนท':'ปิดรับเงินจริง'}</b>{data.readiness.missing.map(m=><p key={m}>{m}</p>)}</div>
 {settings?<>
 <nav className="admin-actions" aria-label="หน้าอนุมัติ"><a href="/adminpage-rose">อนุมัติโรส</a><a href="/adminpage-praew">อนุมัติแพรว</a><a href="/adminpage-all">อนุมัติทั้งสองฝั่ง</a></nav>
 <ReviewerPasswords configured={data.reviewerPasswords} busy={busy} onSave={(scope,password)=>run(()=>setReviewerPassword(scope,password))}/>
 <VerificationControls policy={data.verification} busy={busy} onSave={value=>run(()=>setVerificationPolicy(value))}/>
 <section className="admin-modes"><h2>โหมดตรวจรายการใหม่</h2>{['rose','praew'].map(id=><div key={id}><b>{name(id)}</b><select aria-label={'โหมดตรวจ '+name(id)} value={data.modes[id]} disabled={busy} onChange={e=>run(()=>setReviewMode(id,e.target.value))}><option value="auto">อัตโนมัติภายในเพดานรวม</option><option value="manual">รอแอดมินอนุมัติ</option></select></div>)}<p>มีผลเฉพาะรายการใหม่ คิวเดิมไม่ส่งตรวจย้อนหลัง</p></section>
 <details><summary>ประวัติตั้งค่า</summary>{data.audit.slice().reverse().map((a,i)=><p key={i}>{a.action} · {a.reason} · {new Date(a.at).toLocaleString()}</p>)}</details>
 </>:<>
 <ExternalDonationForm key={scope} scope={scope} actor={data.actor} busy={busy||!data.readiness.enabled} onSave={(form,id)=>run(()=>recordExternalDonation(form,id,scope))}/>
 <section className="admin-queue"><h2>รายการและประวัติ · {name(scope)}</h2><div className="admin-filters"><select aria-label="สถานะรายการ" value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">รอตรวจ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ปฏิเสธแล้ว</option><option value="deleted">ลบแล้ว</option><option value="all">ทั้งหมด</option></select><button disabled={busy} onClick={()=>run(async()=>{})}>รีเฟรช</button></div>
 {!data.orders.some(o=>filter==='all'||o.status===filter)&&<p>ยังไม่มีรายการในหมวดนี้</p>}
 {data.orders.filter(o=>filter==='all'||o.status===filter).slice().reverse().map(o=><AdminOrder key={o.id} scope={scope} o={o} busy={busy} enabled={data.readiness.enabled} onReview={(decision,evidence)=>run(()=>reviewOrder(o.id,decision,evidence,scope))} onDelete={()=>run(()=>deleteApprovedDonation(o.id,scope))}/>)}
 </section>
 </>}
 </>}
 </main>;
}
export function AdminOrder({o,busy,enabled,onReview,onDelete,scope}){
 const [slipURL,setSlipURL]=useState(''),[slipError,setSlipError]=useState(''),[reloadSlip,setReloadSlip]=useState(0),[confirm,setConfirm]=useState(null);
 const heart=heartTypes.find(h=>h.id===o.form.heartType);
 useEffect(()=>{let active=true;setSlipURL('');setSlipError('');if(o.hasSlip)getSlipURL(o.id,scope).then(url=>{if(active)setSlipURL(url);}).catch(e=>{if(active)setSlipError(e.message);});return()=>{active=false;};},[o.id,o.hasSlip,scope,reloadSlip]);
 useEffect(()=>setConfirm(null),[o.status]);
 const act=()=>{onDelete();setConfirm(null);};
 return <article className="admin-order">
 {o.hasSlip&&<div className="admin-slip">{slipURL&&!slipError?<a href={slipURL} target="_blank" rel="noreferrer"><img src={slipURL} alt="ภาพสลิป / QR code ที่ผู้โดเนทส่งมา" referrerPolicy="no-referrer" style={{maxWidth:'100%',maxHeight:500,objectFit:'contain'}} onError={()=>setSlipError('เปิดภาพไม่สำเร็จ กรุณาลองอีกครั้ง')}/></a>:!slipError&&<p role="status">กำลังโหลดภาพที่ส่งมา…</p>}{slipError&&<><p className="error" role="alert">{slipError}</p><button type="button" onClick={()=>setReloadSlip(n=>n+1)}>โหลดภาพอีกครั้ง</button></>}</div>}
 <dl className="admin-donation-summary"><div><dt>ชื่อ</dt><dd>{o.form.supporterName}</dd></div><div><dt>ข้อความ</dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{o.form.message||'—'}</dd></div><div><dt>หัวใจ</dt><dd>{o.form.quantity} × {heart?.name||o.form.heartType} · {name(o.form.recipient)}</dd></div><div><dt>ยอด</dt><dd>{o.amount} THB</dd></div></dl>
 {o.status==='pending'&&<div className="admin-actions"><button className="primary" disabled={busy||!enabled||!slipURL||!!slipError} onClick={()=>onReview('approve',{confirmed:true,reviewMethod:'manual'})}>อนุมัติ</button><button className="secondary admin-reject" disabled={busy} onClick={()=>onReview('reject',{})}>ปฏิเสธ</button></div>}
 {o.status==='approved'&&<button className="secondary" disabled={busy} onClick={()=>setConfirm('delete')}>ลบหัวใจที่อนุมัติแล้ว</button>}
 {confirm==='delete'&&<div className="admin-confirm" role="group" aria-label="ยืนยันรายการ"><p>ลบรายการของ {o.form.supporterName} และหัก {o.form.quantity} หัวใจออกจาก{ name(o.form.recipient)}?</p><button className="primary" disabled={busy} onClick={act}>ยืนยันลบหัวใจ</button><button className="text-button" disabled={busy} onClick={()=>setConfirm(null)}>ยกเลิก</button></div>}
 {o.status!=='pending'&&<details><summary>{o.status==='approved'?'อนุมัติแล้ว':o.status==='deleted'?'ลบหัวใจแล้ว':'ปฏิเสธแล้ว'} · ประวัติรายการ</summary>{o.audit.map((a,i)=><p key={i}>{a.action} · {a.actor} · {new Date(a.at).toLocaleString()}</p>)}</details>}
 </article>;
}
