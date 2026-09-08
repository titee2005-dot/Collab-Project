import {useState} from 'react';
export default function VerificationControls({policy:p,busy,onSave}){
 const [limit,setLimit]=useState(p.limit),[expires,setExpires]=useState(''),[confirm,setConfirm]=useState(false);
 return <section className="admin-order"><h3>ควบคุมตรวจสลิปอัตโนมัติ</h3>
 <p role="status"><b>{p.active?'เปิดตรวจอัตโนมัติ':'รายการใหม่รอแอดมิน'}</b> · {p.reason}</p>
 <p>ใช้แล้ว {p.used} ครั้ง / เพดานสะสม {p.limit} ครั้ง · เหลือ {p.remaining} ครั้ง</p>
 <p>ใช้โควต้าร่วมกันทั้งโรสและแพรว นับทุกครั้งที่พยายามเรียก API แม้ตรวจไม่สำเร็จ ไม่รีเซ็ตเอง</p>
 {p.expiresAt&&<p>หมดอายุ: {new Date(p.expiresAt).toLocaleString()}</p>}
 {!p.keyConfigured&&<p>ยังไม่มี EasySlip key — ตรวจและอนุมัติเองได้ตามปกติ</p>}
 <button type="button" className="secondary" disabled={busy||!p.enabled} onClick={()=>onSave({enabled:false})}>ปิดตรวจอัตโนมัติทั้งสองฝั่ง</button>
 <form className="supporter-form" onSubmit={e=>{e.preventDefault();onSave({enabled:true,limit:Number(limit),expiresAt:new Date(expires).toISOString()});setConfirm(false);}}>
 <label>เพดานจำนวนเรียกสะสม (รวมจำนวนที่ใช้แล้ว)<input required type="number" min={p.used+1} max="1000000" step="1" value={limit} onChange={e=>{setLimit(e.target.value);setConfirm(false);}}/></label>
 <small>เช่น ใช้แล้ว 10 ครั้ง และมีสิทธิ์เหลืออีก 40 ครั้ง ให้ตั้งเพดาน 50</small>
 <label>วันและเวลาสิ้นสุดสิทธิ์ตรวจอัตโนมัติ<input required type="datetime-local" value={expires} onChange={e=>{setExpires(e.target.value);setConfirm(false);}}/></label>
 <label className="admin-verified"><input required type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>ตรวจสิทธิ์และวันหมดอายุในบัญชี EasySlip แล้ว จำนวนที่ตั้งไม่เกินสิทธิ์ที่เหลือ</label>
 <p className="fine-print">ตัวเลขนี้เป็นเพดานของเว็บ ไม่ใช่ยอดโควต้าที่ดึงจาก EasySlip หากใช้คีย์ที่อื่นด้วย ต้องหักการใช้งานนั้นก่อน ตั้งเผื่อให้ต่ำกว่าสิทธิ์จริง</p>
 <button className="primary" disabled={busy||!p.keyConfigured||!confirm}>บันทึกและเปิดตรวจอัตโนมัติ</button>
 </form><p>ปิดสวิตช์แล้วจะไม่เริ่มเรียก API ใหม่ แต่คำขอที่ส่งไปแล้วอาจทำงานจนจบ</p>
 </section>;
}
