import ReviewerPasswords from './ReviewerPasswords';
import VerificationControls from './VerificationControls';
import ExternalDonationForm from './ExternalDonationForm';
import {useState,useEffect} from 'react';
import {getAdminState,getAdminSettings,setReviewMode,reviewOrder,recordExternalDonation,login,logout,setVerificationPolicy,getSlipURL,loginReviewer,logoutReviewer,setReviewerPassword} from '../services/adminService';
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
 <section className="admin-queue"><h2>รายการและประวัติ · {name(scope)}</h2><div className="admin-filters"><select aria-label="สถานะรายการ" value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">รอตรวจ</option><option value="approved">อนุมัติแล้ว</option><option value="rejected">ปฏิเสธแล้ว</option><option value="all">ทั้งหมด</option></select><button disabled={busy} onClick={()=>run(async()=>{})}>รีเฟรช</button></div>
 {!data.orders.some(o=>filter==='all'||o.status===filter)&&<p>ยังไม่มีรายการในหมวดนี้</p>}
 {data.orders.filter(o=>filter==='all'||o.status===filter).slice().reverse().map(o=><Order key={o.id} scope={scope} o={o} busy={busy} enabled={data.readiness.enabled} onReview={(decision,evidence)=>run(()=>reviewOrder(o.id,decision,evidence,scope))}/>)}
 </section>
 </>}
 </>}
 </main>;
}
function Order({o,busy,enabled,onReview,scope}){
 const [slipURL,setSlipURL]=useState(''),[slipError,setSlipError]=useState('');
 const [evidence,setEvidence]=useState({externalRef:o.externalRef||'',paidAmount:'',bankCode:'',accountNumber:'',paidAt:'',confirmed:false});
 const set=(key,value)=>setEvidence(e=>({...e,[key]:value,confirmed:key==='confirmed'?value:false}));
 async function viewSlip(){try{setSlipError('');setSlipURL(await getSlipURL(o.id,scope));}catch(e){setSlipError(e.message);}}
 return <article className="admin-order"><b>{name(o.form.recipient)} · {o.amount} THB · {o.status}</b><p>{o.form.supporterName} · {o.form.quantity} หัวใจ</p><small>ID: {o.id} · {new Date(o.createdAt).toLocaleString()}</small>
 <p>บัญชีผู้รับ: {o.account.bankName} ({o.account.bankCode}) · {o.account.accountName} · {o.account.accountNumber}</p>
 {o.externalRef&&<p>อ้างอิง: {o.externalRef} · {o.paidAt}</p>}
 {o.hasSlip&&<button type="button" onClick={viewSlip}>เปิดภาพสลิป</button>}
 {slipError&&<p className="error">{slipError}</p>}
 {slipURL&&<img src={slipURL} alt="สลิปสำหรับตรวจยอด" referrerPolicy="no-referrer" style={{maxWidth:'100%',maxHeight:500,objectFit:'contain'}} onError={()=>setSlipError('ลิงก์หมดอายุ กดเปิดภาพอีกครั้ง')}/>}
 {o.form.message&&<blockquote>{o.form.message}</blockquote>}
 {o.status==='pending'&&<><div className="admin-fields">
 <label>เลขอ้างอิงจากธนาคาร<input maxLength={100} value={evidence.externalRef} onChange={e=>set('externalRef',e.target.value)}/></label>
 <label>ยอดเข้าบัญชี (THB)<input type="number" min="1" step="0.01" value={evidence.paidAmount} onChange={e=>set('paidAmount',Number(e.target.value))}/></label>
 <label>รหัสธนาคารผู้รับ 3 หลัก<input maxLength={3} value={evidence.bankCode} onChange={e=>set('bankCode',e.target.value)}/></label>
 <label>เลขบัญชีผู้รับที่ตรวจแล้ว<input value={evidence.accountNumber} onChange={e=>set('accountNumber',e.target.value)}/></label>
 <label>เวลาโอน<input type="datetime-local" value={evidence.paidAt} onChange={e=>set('paidAt',e.target.value)}/></label>
 </div><label className="admin-verified"><input type="checkbox" checked={evidence.confirmed} onChange={e=>set('confirmed',e.target.checked)}/>ตรวจยอดเข้าบัญชีจริง และยังไม่เคยบันทึกแล้ว</label>
 <div className="admin-actions"><button className="primary" disabled={busy||!enabled||!evidence.confirmed||!evidence.paidAt} onClick={()=>onReview('approve',{...evidence,paidAt:new Date(evidence.paidAt).toISOString()})}>อนุมัติ</button><button className="secondary" disabled={busy} onClick={()=>onReview('reject',{})}>ปฏิเสธ</button></div></>}
 <details><summary>ประวัติรายการ</summary>{o.audit.map((a,i)=><p key={i}>{a.action} · {a.actor} · {new Date(a.at).toLocaleString()}</p>)}</details>
 </article>;
}

