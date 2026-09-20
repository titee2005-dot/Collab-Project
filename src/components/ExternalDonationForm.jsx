import {useRef,useState} from 'react';
import {heartTypes} from '../data/heartTypes';
import {Heart} from './Artwork';
import '../styles/external-donation.css';
export default function ExternalDonationForm({actor,busy,onSave,scope='all',error}){
 const [form,setForm]=useState({recipient:scope==='all'?'rose':scope,heartType:'pink',quantity:1,supporterName:'',message:'',paidAmount:'',verified:false});
 const key=useRef(crypto.randomUUID());
 const heart=heartTypes.find(h=>h.id===form.heartType),recipient=form.recipient==='rose'?'โรส':'แพรว';
 const expected=heart.price*Number(form.quantity),validQuantity=Number.isInteger(form.quantity)&&form.quantity>=1&&form.quantity<=100;
 const amountMatches=form.paidAmount!==''&&Number(form.paidAmount)===expected&&validQuantity;
 function update(k,v){setForm(f=>({...f,[k]:v,verified:k==='verified'?v:false}));key.current=crypto.randomUUID();}
 return <details className="admin-add external-donation"><summary>＋ บันทึกโดเนทจากสลิปภายนอก</summary>
 <p className="external-intro">สำหรับสลิปที่ได้รับผ่านแชตหรือช่องทางอื่น กรอกข้อมูลตามที่ผู้โดเนทแจ้ง</p>
 <form onSubmit={e=>{e.preventDefault();if(!busy&&actor?.trim()&&amountMatches&&form.verified)onSave(form,key.current);}}>
 <fieldset disabled={busy} className="external-fields">
 <div className="external-section"><h3><span>1</span> ผู้รับและผู้โดเนท</h3><div className="external-grid">
 <label>ผู้รับเงินและหัวใจ<select disabled={scope!=='all'} value={form.recipient} onChange={e=>update('recipient',e.target.value)}><option value="rose">โรส · บัญชีโรส</option><option value="praew">แพรว · บัญชีแพรว</option></select></label>
 <label>ชื่อที่ต้องการให้แสดง<input required pattern=".*\S.*" maxLength={30} placeholder="ชื่อผู้โดเนท" value={form.supporterName} onChange={e=>update('supporterName',e.target.value)}/></label>
 </div><label className="external-message">ข้อความผู้โดเนท <small>ไม่บังคับ</small><textarea rows={2} maxLength={120} placeholder="ข้อความที่ต้องการฝากไว้" value={form.message} onChange={e=>update('message',e.target.value)}/></label></div>
 <div className="external-section"><h3><span>2</span> หัวใจและยอดโอน</h3>
 <div className="external-hearts" role="group" aria-label="ชนิดหัวใจ">{heartTypes.map(h=><button type="button" key={h.id} aria-pressed={form.heartType===h.id} onClick={()=>update('heartType',h.id)}><Heart color={h.color}/><b>{h.name}</b><small>{h.price} บาท / หัวใจ</small></button>)}</div>
 <div className="external-grid"><label>จำนวนหัวใจ <small>1–100 หัวใจ</small><input required type="number" min="1" max="100" step="1" value={form.quantity} onChange={e=>update('quantity',e.target.value===''?'':Number(e.target.value))}/></label>
 <label>ยอดเงินตามสลิป (THB)<input required type="number" min="1" step="0.01" inputMode="decimal" placeholder="กรอกยอดที่โอนจริง" value={form.paidAmount} onChange={e=>update('paidAmount',e.target.value===''?'':Number(e.target.value))}/></label></div>
 <div className="external-total" aria-live="polite"><span>{heart.name} × {form.quantity||0}<small>ยอดที่ต้องตรงกับสลิป</small></span><strong>{expected.toLocaleString()} <small>THB</small></strong></div>
 {form.paidAmount!==''&&!amountMatches&&<p className="external-mismatch" role="status">ยอดตามสลิปยังไม่ตรงกับหัวใจที่เลือก กรุณาตรวจจำนวนหัวใจและยอดอีกครั้ง</p>}
 </div>
 <label className="admin-verified external-verified"><input required type="checkbox" checked={form.verified} onChange={e=>update('verified',e.target.checked)}/><span>ตรวจแล้วว่าเงินเข้าบัญชี{recipient} ยอดตรง และยังไม่เคยบันทึกรายการนี้</span></label>
 {error&&<p className="error admin-action-error" role="alert">{error}</p>}
 <button className="primary external-next" disabled={busy||!actor?.trim()||!amountMatches}>{busy?'กำลังบันทึก…':'บันทึกรายการ'}</button>
 </fieldset></form>
 </details>;
}
