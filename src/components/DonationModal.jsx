import {eventTimeLeft} from '../services/eventCountdown';
import '../styles/unlock-points.css';
import '../styles/payment-summary.css';
import {useEffect,useRef,useState} from 'react';
import Modal from './Modal';
import {paymentQR} from '../services/paymentQR';
import {Heart} from './Artwork';
import {heartTypes} from '../data/heartTypes';
import {getPaymentConfig,submitSlip} from '../services/paymentService';
export default function DonationModal({initialRecipient,onClose}){
 const [form,setForm]=useState({recipient:initialRecipient||'rose',heartType:'pink',quantity:1,supporterName:'',anonymous:false,message:'',socialUsername:''}),[config,setConfig]=useState(null),[slip,setSlip]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[step,setStep]=useState(0);
 const id=useRef(crypto.randomUUID()),lock=useRef(false);
 useEffect(()=>{let active=true;getPaymentConfig().then(c=>{if(active)setConfig(c);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 const set=(key,value)=>{id.current=crypto.randomUUID();setForm(f=>({...f,[key]:value}));};
 const heart=heartTypes.find(h=>h.id===form.heartType);
 async function submit(){if(eventTimeLeft().ended||lock.current||!slip||!config?.enabled)return;lock.current=true;setBusy(true);setError('');try{setResult(await submitSlip(form,id.current,slip));}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 if(result&&result.status!=='approved'&&result.status!=='rejected')return <Modal title="ขอบคุณสำหรับการโดเนท" onClose={onClose}><div className="payment transfer-pending"><Heart color={heart.color}/><p>กำลังรอแอดมินตรวจสอบรายการ</p></div><button className="primary full" onClick={onClose}>กลับไปที่ห้อง</button></Modal>;
 if(result)return <Modal title="ผลการส่งสลิป" onClose={onClose}><div className="payment"><Heart color={heart.color}/><b>{result.status==='approved'?'ยืนยันแล้ว ขอบคุณสำหรับโดเนท':result.status==='rejected'?'สลิปไม่ผ่านการตรวจสอบ':'รอแอดมินตรวจรายการ'}</b><p>{result.status==='approved'?'หัวใจจะปรากฏเมื่อข้อมูลอัปเดต':'ยังไม่เพิ่มหัวใจ กรุณาติดต่อแอดมิน ไม่ต้องโอนซ้ำ'}</p></div><button className="primary full" onClick={onClose}>กลับไปที่ห้อง</button></Modal>;
 if(eventTimeLeft().ended)return <Modal title="กิจกรรมสิ้นสุดแล้ว" onClose={onClose}><p>ปิดรับโดเนทแล้ว ขอบคุณทุกหัวใจที่ร่วมกิจกรรม</p><button className="primary full" onClick={onClose}>กลับไปที่ห้อง</button></Modal>;
 if(!config?.enabled)return <Modal title="Donation" onClose={onClose}><p>{error||config?.message||'กำลังตรวจความพร้อมของระบบ…'}</p><p></p></Modal>;
 const account=config.accounts[form.recipient],qr=paymentQR(form.recipient,account);
 return <Modal title={step?'โอนเงินและส่งสลิป':'ส่งหัวใจให้คนที่คุณรัก'} onClose={()=>{if(!busy)onClose();}}>
 <form className="supporter-form" onSubmit={e=>{e.preventDefault();if(step)submit();else setStep(1);}}>
 {!step?<>
 <div className="recipient-options">{['rose','praew'].map(r=><button key={r} type="button" aria-pressed={form.recipient===r} className={'recipient-option '+r+(form.recipient===r?' selected':'')} onClick={()=>set('recipient',r)}><b>{r==='rose'?'Team Rose':'Team Praew'}</b><small></small></button>)}</div>
 <div className="heart-options">{heartTypes.map(h=><button key={h.id} type="button" aria-pressed={form.heartType===h.id} className={form.heartType===h.id?'selected':''} onClick={()=>set('heartType',h.id)}><Heart color={h.color}/><b>{h.name}</b><small>{h.price} THB</small><span className="heart-points-badge">+{h.unlockPoints} คะแนน / ดวง</span></button>)}</div>
 <p className="unlock-points-explainer">คะแนนใช้ปลดล็อกไอเทมของห้องที่เลือก แยกจากจำนวนหัวใจจริง</p><label>จำนวนหัวใจ<input required type="number" min="1" max="100" step="1" value={form.quantity} onChange={e=>set('quantity',e.target.value===''?'':Number(e.target.value))}/></label>
 <label>ชื่อที่ต้องการให้แสดง<input required={!form.anonymous} disabled={form.anonymous} maxLength={30} pattern=".*\S.*" value={form.supporterName} onChange={e=>set('supporterName',e.target.value)}/></label>
 <label className="checkbox"><input type="checkbox" checked={form.anonymous} onChange={e=>set('anonymous',e.target.checked)}/>ไม่ระบุชื่อ</label>
 <label>ข้อความ (แสดงสาธารณะ)<textarea maxLength={120} value={form.message} onChange={e=>set('message',e.target.value)}/></label>
 <p className="unlock-points-summary">{form.quantity||0} หัวใจ <span>เพิ่ม <b>{(heart.unlockPoints*(form.quantity||0)).toLocaleString()} คะแนนปลดล็อก</b></span></p><p className="total-line">ยอดโดเนท <b>{heart.price*form.quantity} THB</b></p><button className="primary">ตรวจบัญชีและโอนเงิน →</button>
 </>:<>
 <section className="transfer-summary" aria-label="สรุปการโอนเงิน">
  <div className="transfer-recipient"><Heart color={heart.color}/><div><span>ส่งหัวใจให้</span><h3>{form.recipient==='rose'?'โรส':'แพรว'}</h3></div></div>
  <div className="transfer-total"><span className="transfer-label">ยอดที่ต้องโอน</span><p className="transfer-amount"><strong>{(heart.price*form.quantity).toLocaleString('en-US')}</strong><span>THB</span></p><div className="transfer-heart-line"><span className="transfer-heart-name"><Heart color={heart.color}/><span>{heart.name}</span></span><b>{form.quantity} หัวใจ</b></div></div>
  <p className="unlock-points-summary">เพิ่ม {heart.unlockPoints*form.quantity} คะแนนปลดล็อกให้{form.recipient==='rose'?'โรส':'แพรว'}</p><div className="transfer-account"><h3>บัญชีรับโอน</h3><dl><div><dt>ธนาคาร</dt><dd>{account.bankName}</dd></div><div><dt>ชื่อบัญชี</dt><dd>{account.accountName}</dd></div><div className="transfer-account-number"><dt>เลขบัญชี</dt><dd>{account.accountNumber}</dd></div></dl>
 {qr&&<section className="payment-qr transfer-payment-qr"><img src={qr} alt={'QR รับโดเนทของ'+(form.recipient==='rose'?'โรส':'แพรว')} /><a href={qr} download>บันทึกภาพ QR</a><p>ชำระแล้วแนบสลิปด้านล่างเพื่อให้ตรวจสอบยอด</p></section>}
  </div>
 </section>

 <label>อัปโหลดสลิป PNG/JPEG ไม่เกิน 4 MB<input required type="file" accept="image/png,image/jpeg" disabled={busy} onChange={e=>{const file=e.target.files[0];id.current=crypto.randomUUID();if(file&&file.size>4*1024*1024){setError('ไฟล์ต้องไม่เกิน 4 MB');setSlip(null);return;}setError('');setSlip(file);}}/></label>
 <div className="transfer-notes"><p className="transfer-review-note">ต้องรอแอดมินตรวจสอบรายการ</p><p className="transfer-privacy-note">ชื่อและข้อความจะแสดงสาธารณะ เลือกไม่ระบุชื่อเพื่อซ่อนชื่อ</p></div>
 <div className="flow-actions transfer-actions"><button type="button" className="secondary transfer-back" disabled={busy} onClick={()=>setStep(0)}><span aria-hidden="true">←</span> กลับ</button><button className="primary" disabled={busy||!slip}>{busy?'กำลังส่งและตรวจสลิป…':'ส่งสลิปเพื่อตรวจสอบ'}</button></div>
 </>}
 {error&&<p className="error" role="alert">{error}</p>}
 </form></Modal>;
}
