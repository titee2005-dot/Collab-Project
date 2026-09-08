import {useState} from 'react';
export default function ReviewerPasswords({configured={},busy,onSave}){
 return <section className="admin-order"><h2>รหัสผ่านหน้าอนุมัติ</h2><p>จำเบราว์เซอร์ 7 วัน เมื่อเปลี่ยนรหัส เซสชันเดิมของฝั่งนั้นจะถูกยกเลิกทันที</p>
 {['rose','praew','all'].map(scope=><PasswordRow key={scope} scope={scope} configured={configured[scope]} busy={busy} onSave={onSave}/>)}</section>;
}
function PasswordRow({scope,configured,busy,onSave}){
 const [password,setPassword]=useState('');
 return <form className="supporter-form" onSubmit={async e=>{e.preventDefault();await onSave(scope,password);setPassword('');}}>
 <label>{scope==='rose'?'โรส':scope==='praew'?'แพรว':'รวมทั้งสองฝั่ง'} · {configured?'ตั้งรหัสแล้ว':'ยังไม่มีรหัส'}<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="รหัสใหม่อย่างน้อย 12 ตัวอักษร"/></label>
 <button className="secondary" disabled={busy}>บันทึกรหัส{scope==='rose'?'โรส':scope==='praew'?'แพรว':'หน้ารวม'}</button></form>;
}

