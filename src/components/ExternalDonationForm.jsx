import {useRef,useState} from 'react';
import {heartTypes} from '../data/heartTypes';
export default function ExternalDonationForm({actor,busy,onSave,scope='all'}){
 const [form,setForm]=useState({recipient:scope==='all'?'rose':scope,heartType:'pink',quantity:1,supporterName:'',message:'',paidAmount:'',externalRef:'',paidAt:'',verified:false});
 const [confirm,setConfirm]=useState(false);const key=useRef(crypto.randomUUID());
 const heart=heartTypes.find(h=>h.id===form.heartType),recipient=form.recipient==='rose'?'Rose':'Praew';
 function update(k,v){setForm(f=>({...f,[k]:v,verified:k==='verified'?v:false}));setConfirm(false);key.current=crypto.randomUUID();}
 return <details className="admin-add"><summary>＋ บันทึกโดเนทจากสลิปภายนอก</summary><p className="muted">สำหรับผู้โดเนทที่ส่งสลิปผ่าน LINE, Facebook หรือช่องทางอื่น โดยไม่ได้สั่งหัวใจในเว็บ แอดมินตรวจยอดเข้าบัญชีของฝั่งที่เลือกก่อนบันทึก</p>
 <form onSubmit={e=>{e.preventDefault();setConfirm(true);}}><div className="admin-fields">
 <label>ผู้รับเงินและหัวใจ<select disabled={scope!=='all'} value={form.recipient} onChange={e=>update('recipient',e.target.value)}><option value="rose">Rose · บัญชีโรส</option><option value="praew">Praew · บัญชีแพรว</option></select></label>
 <label>ชื่อผู้โดเนท<input required maxLength={30} value={form.supporterName} onChange={e=>update('supporterName',e.target.value)}/></label>
 <label>ชนิดหัวใจ<select value={form.heartType} onChange={e=>update('heartType',e.target.value)}>{heartTypes.map(h=><option key={h.id} value={h.id}>{h.name} · {h.price} THB</option>)}</select></label>
 <label>จำนวนหัวใจ (1–100)<input required type="number" min="1" max="100" value={form.quantity} onChange={e=>update('quantity',e.target.value===''?'':Number(e.target.value))}/></label>
 <label>ยอดเงินตามสลิป (THB)<input required type="number" min="1" step="0.01" value={form.paidAmount} onChange={e=>update('paidAmount',e.target.value===''?'':Number(e.target.value))}/></label>
 <label>วันและเวลาที่โอน<input required type="datetime-local" value={form.paidAt} onChange={e=>update('paidAt',e.target.value)}/></label>
 <label>เลขอ้างอิงธุรกรรมบนสลิป<input required maxLength={100} value={form.externalRef} onChange={e=>update('externalRef',e.target.value)} placeholder="ใช้เลขอ้างอิงธนาคาร เพื่อป้องกันสลิปซ้ำ"/></label>
 <label>ข้อความผู้โดเนท (ไม่บังคับ)<input maxLength={120} value={form.message} onChange={e=>update('message',e.target.value)}/></label></div>
 <p className="muted">ยอดสำหรับหัวใจที่เลือก: {heart.price*form.quantity} THB · ต้องตรงกับยอดสลิป</p>
 <label className="admin-verified"><input required type="checkbox" checked={form.verified} onChange={e=>update('verified',e.target.checked)}/>ตรวจแล้วว่าเงินเข้า {recipient} ยอดตรง และยังไม่เคยบันทึกรายการนี้</label>
 <button className="secondary" disabled={busy||!actor.trim()}>ตรวจรายการก่อนบันทึก</button></form>
 {confirm&&<div className="admin-confirm"><p>{form.supporterName} → {recipient}<br/>{form.paidAmount} THB · {form.quantity} {heart.name}<br/>อ้างอิง {form.externalRef}</p><button className="primary" disabled={busy} onClick={()=>onSave({...form,paidAt:new Date(form.paidAt).toISOString()},key.current)}>ยืนยันบันทึกโดเนทภายนอก</button></div>}
 </details>;
}
