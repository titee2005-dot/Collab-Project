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
 async function submit(){if(lock.current||!slip||!config?.enabled)return;lock.current=true;setBusy(true);setError('');try{setResult(await submitSlip(form,id.current,slip));}catch(e){setError(e.message);}finally{lock.current=false;setBusy(false);}}
 if(result)return <Modal title="ผลการส่งสลิป" onClose={onClose}><div className="payment"><Heart color={heart.color}/><b>{result.status==='approved'?'ยืนยันแล้ว ขอบคุณสำหรับโดเนท':result.status==='rejected'?'สลิปไม่ผ่านการตรวจสอบ':'รอแอดมินตรวจรายการ'}</b><p>{result.status==='approved'?'หัวใจจะปรากฏเมื่อข้อมูลอัปเดต':'ยังไม่เพิ่มหัวใจ กรุณาเก็บรหัสไว้ติดต่อแอดมิน ไม่ต้องโอนซ้ำ'}</p><small>ID: {result.id}</small></div><button className="primary full" onClick={onClose}>กลับไปที่ห้อง</button></Modal>;
 if(!config?.enabled)return <Modal title="ยังไม่เปิดรับเงินจริง" onClose={onClose}><p>{error||config?.message||'กำลังตรวจความพร้อมของระบบ…'}</p><p>ต้องตั้งค่าบัญชีผู้รับทั้งโรสและแพรว และเปิดใช้งานจากเซิร์ฟเวอร์ก่อน</p></Modal>;
 const account=config.accounts[form.recipient],qr=paymentQR(form.recipient,account);
 return <Modal title={step?'โอนเงินและส่งสลิป':'ส่งหัวใจให้คนที่คุณรัก'} onClose={()=>{if(!busy)onClose();}}>
 <form className="supporter-form" onSubmit={e=>{e.preventDefault();if(step)submit();else setStep(1);}}>
 {!step?<>
 <div className="recipient-options">{['rose','praew'].map(r=><button key={r} type="button" aria-pressed={form.recipient===r} className={'recipient-option '+r+(form.recipient===r?' selected':'')} onClick={()=>set('recipient',r)}><b>{r==='rose'?'Rose · โรส':'Praew · แพรว'}</b><small>บัญชีรับเงินแยกเฉพาะฝั่งนี้</small></button>)}</div>
 <div className="heart-options">{heartTypes.map(h=><button key={h.id} type="button" aria-pressed={form.heartType===h.id} className={form.heartType===h.id?'selected':''} onClick={()=>set('heartType',h.id)}><Heart color={h.color}/><b>{h.name}</b><small>{h.price} THB</small></button>)}</div>
 <label>จำนวนหัวใจ<input required type="number" min="1" max="100" step="1" value={form.quantity} onChange={e=>set('quantity',e.target.value===''?'':Number(e.target.value))}/></label>
 <label>ชื่อผู้โดเนท<input required={!form.anonymous} disabled={form.anonymous} maxLength={30} pattern=".*\S.*" value={form.supporterName} onChange={e=>set('supporterName',e.target.value)}/></label>
 <label className="checkbox"><input type="checkbox" checked={form.anonymous} onChange={e=>set('anonymous',e.target.checked)}/>ไม่ระบุชื่อ</label>
 <label>ข้อความ (แสดงสาธารณะ)<textarea maxLength={120} value={form.message} onChange={e=>set('message',e.target.value)}/></label>
 <label>Social username (ไม่บังคับ)<input disabled={form.anonymous} maxLength={40} value={form.socialUsername} onChange={e=>set('socialUsername',e.target.value)}/></label>
 <p className="total-line">ยอดโดเนท <b>{heart.price*form.quantity} THB</b></p><button className="primary">ตรวจบัญชีและโอนเงิน →</button>
 </>:<>
 <div className="payment"><Heart color={heart.color}/><b>ผู้รับ: {form.recipient==='rose'?'โรส':'แพรว'}</b><p>{account.bankName}<br/>{account.accountName}<br/><strong>{account.accountNumber}</strong></p><strong>{heart.price*form.quantity} THB</strong><p>{heart.name} × {form.quantity}</p></div>
 {qr&&<section className="payment-qr"><h3>สแกน QR เพื่อโดเนทให้{form.recipient==='rose'?'โรส':'แพรว'}</h3><p>โอนยอด {heart.price*form.quantity} บาท และตรวจชื่อผู้รับในแอปธนาคารให้ตรงกับบัญชีด้านบนก่อนยืนยัน</p><img src={qr} alt={'QR รับโดเนทของ'+(form.recipient==='rose'?'โรส':'แพรว')} /><a href={qr} download>บันทึกภาพ QR</a><p>ชำระแล้วแนบสลิปด้านล่างเพื่อให้ตรวจสอบยอด</p></section>}
 <label>อัปโหลดสลิป PNG/JPEG ไม่เกิน 4 MB<input required type="file" accept="image/png,image/jpeg" disabled={busy} onChange={e=>{const file=e.target.files[0];id.current=crypto.randomUUID();if(file&&file.size>4*1024*1024){setError('ไฟล์ต้องไม่เกิน 4 MB');setSlip(null);return;}setError('');setSlip(file);}}/></label>
 <p>ตรวจอัตโนมัติหรือรอแอดมินอนุมัติก่อนเพิ่มหัวใจ สลิปอาจถูกส่งให้ EasySlip ตรวจสอบ และแอดมินเข้าถึงเพื่อยืนยันยอด</p>
 <p className="fine-print">ชื่อ ข้อความ และ Social username จะแสดงสาธารณะ เลือกไม่ระบุชื่อเพื่อซ่อนชื่อและ Social username</p>
 <small>รหัสรายการ: {id.current}</small>
 <div className="flow-actions"><button type="button" className="text-button" disabled={busy} onClick={()=>setStep(0)}>กลับ</button><button className="primary" disabled={busy||!slip}>{busy?'กำลังส่งและตรวจสลิป…':'ส่งสลิปเพื่อตรวจสอบ'}</button></div>
 </>}
 {error&&<p className="error" role="alert">{error}</p>}
 </form></Modal>;
}
