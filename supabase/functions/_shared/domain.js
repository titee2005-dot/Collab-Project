import {resolveHearts} from './hearts.js';
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
export function cleanForm(input) {
  if (!input || !['rose','praew'].includes(input.recipient) || (input.mode && input.mode !== 'fixed')) fail('เลือกรูปแบบและผู้รับให้ถูกต้อง');
  const line = resolveHearts({heartType:input.heartType, quantity:input.quantity});
  const anonymous = input.anonymous === true;
  if (typeof input.supporterName !== 'string' || input.supporterName.length > 30 || (!anonymous && !input.supporterName.trim())) fail('กรอกชื่อผู้โดเนท ไม่เกิน 30 ตัวอักษร');
  if (typeof input.message !== 'string' || input.message.length > 120 || (input.socialUsername && (typeof input.socialUsername !== 'string' || input.socialUsername.length > 40))) fail('ข้อความยาวเกินกำหนด');
  return {recipient:input.recipient, ...line[0], anonymous, supporterName:anonymous?'Anonymous':input.supporterName.trim(), socialUsername:anonymous?'':(input.socialUsername || '').trim(), message:input.message};
}
export function imageType(bytes) {
  if (bytes.length < 12 || bytes.length > 4*1024*1024) fail('สลิปต้องเป็นภาพ PNG/JPEG ไม่เกิน 4 MB');
  if ([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  fail('รองรับเฉพาะไฟล์ภาพ PNG/JPEG');
}
export async function verifySlip(bytes, type, form, account, apiKey) {
  const body = new FormData();
  body.set('file', new Blob([bytes], {type}), type === 'image/png'?'slip.png':'slip.jpg');
  body.set('checkDuplicate', 'true');
  const response = await fetch('https://api.easyslip.com/v1/verify', {method:'POST', headers:{Authorization:`Bearer ${apiKey}`}, body, signal:AbortSignal.timeout(20000)});
  const result = await response.json();
  if (result.message === 'duplicate_slip') return {status:'rejected', reason:'ผู้ให้บริการแจ้งว่าสลิปถูกใช้แล้ว'};
  if (!response.ok || result.status !== 200) return {status:'pending', pauseAuto:true, reason:'บริการตรวจสลิปไม่พร้อมหรือสิทธิ์ใช้งานหมด ปิดอัตโนมัติและรอแอดมิน'};
  return assessSlip(result.data, form, account);
}
export function assessSlip(data, form, account) {
  const date = Date.parse(data?.date);
  if (!data?.transRef || !Number.isFinite(date)) return {status:'pending', reason:'ผลตรวจไม่มีเลขอ้างอิงหรือวันเวลา'};
  const ref = normalizeRef(data.transRef);
  if (data.countryCode !== 'TH' || (data.amount?.local?.currency && data.amount.local.currency !== 'THB') || data.amount?.amount !== form.amount || data.receiver?.bank?.id !== account.bankCode || date > Date.now()+300000 || date < Date.now()-7*86400000) return {status:'rejected', reason:'ยอดเงิน ธนาคาร สกุลเงิน หรือวันเวลาไม่ตรงเงื่อนไข', ref};
  // A masked account is not proof of an exact destination: leave it for a human.
  const actual = data.receiver?.account?.bank?.account;
  if (typeof actual !== 'string' || !/^\d+$/.test(actual)) return {status:'pending', reason:'เลขบัญชีถูกปกปิด ต้องตรวจบัญชีผู้รับด้วยตนเอง', ref};
  if (actual !== account.accountNumber) return {status:'rejected', reason:'บัญชีผู้รับไม่ตรงกับฝั่งที่เลือก', ref};
  return {status:'verified', reason:'ตรวจยอดและบัญชีผู้รับตรงกัน', ref, paidAt:new Date(date).toISOString()};
}
export function normalizeRef(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{4,100}$/.test(value.trim())) fail('กรอกเลขอ้างอิงธุรกรรมธนาคาร 4–100 ตัวอักษร');
  return value.trim().toUpperCase();
}
