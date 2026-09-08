# ผลการย้ายหลังบ้านไป Supabase

โปรเจกต์: ctimhxkwpzsebodbtptx
URL: https://ctimhxkwpzsebodbtptx.supabase.co

ติดตั้งแล้ว:
- migration 202609080001_heart_backend.sql บนฐานข้อมูลจริง
- Edge Function heart-api
- private bucket donation-slips พร้อมนโยบายป้องกันเข้าถึงโดยตรง
- สิทธิ์แอดมินของผู้ใช้ Auth ที่ผู้ใช้ระบุ (รายละเอียด bootstrap เก็บในไฟล์ local ที่ไม่ติด Git)
- APP_ORIGIN=http://localhost:5173 และ RECEIVING_ENABLED=false

ผลตรวจจาก API จริง:
- GET /config: HTTP 200, enabled=false, accounts=null
- GET /donations: HTTP 200, รายการว่าง
- GET /admin/state โดยไม่ล็อกอิน: HTTP 401
- เรียก RPC heart_api ด้วย publishable key โดยตรง: HTTP 401 / permission denied
- CORS สำหรับ localhost:5173: HTTP 204

ผลทดสอบในเครื่อง: 49 tests ผ่าน รวม PostgreSQL migration และ Edge Function ที่จำลอง Auth/Storage/EasySlip; frontend build ผ่าน
ไม่ได้รับเงินจริง ไม่ได้ใช้ EasySlip จริง และไม่ได้ทดสอบรหัสผ่านของแอดมิน

ยังต้องทำก่อนเปิดรับเงินจริง:
- ตั้งและตรวจบัญชีรับเงินของโรสและแพรว
- ผู้ใช้ลองล็อกอินด้วยอีเมลและรหัสผ่าน Supabase Auth ของตนเอง
- ถ้าจะนำหน้าเว็บขึ้นโฮสต์สาธารณะ ให้ตั้งตัวแปร VITE_ และแก้ APP_ORIGIN เป็น URL HTTPS ของเว็บนั้น
- เปิดรับเงินจริงอย่างตั้งใจทั้งในฐานข้อมูลและ Edge Function หลังตรวจครบ
- หากจะใช้อัตโนมัติ ให้ตั้ง EasySlip key และเพดาน/วันหมดอายุใน Admin

ข้อมูลจาก SQLite เดิมไม่ได้ถูกนำขึ้น Supabase อัตโนมัติ ไม่มีการนำ demo มาเพิ่มยอดจริง

## อัปเดตสิทธิ์และรหัสผู้อนุมัติ 2026-09-08

ติดตั้ง migrations 002 และ 003 และ deploy heart-api แล้ว เจ้าของเพียงบัญชีเดียวคือ heartcollection@gmail.com (owner / all)

หน้า /adminpage-settings ใช้อีเมลและรหัส Supabase Auth เจ้าของที่ล็อกอินแล้วเข้าหน้า /adminpage-rose, /adminpage-praew และ /adminpage-all ได้ด้วยเซสชันเดียวกัน ผู้อนุมัติทั่วไปใช้รหัสแยกแต่ละหน้า จำเบราว์เซอร์ 7 วัน เปลี่ยนรหัสจะยกเลิกเซสชันเดิมของฝั่งนั้น ไม่มีปุ่มแอดมินบนหน้าสาธารณะ

ตรวจจริง: config ปิดรับเงินและซ่อนบัญชี; หน้า settings/state ที่ไม่ล็อกอินตอบ 401; รหัสที่ยังไม่ตั้งตอบ 401; ฐานข้อมูล receiving=false และ automatic=false ยังไม่ได้ตั้งรหัสผู้อนุมัติทั้งสามชุด เจ้าของต้องตั้งเองในหน้าตั้งค่า ไม่ได้ทดสอบรหัสผ่านเจ้าของจริง

## เตรียม QR รับโดเนท 2026-09-09

เก็บภาพต้นฉบับที่ผู้ใช้ส่งใน public/payments แยก rose-payment.png และ praew-payment.png เพิ่มปุ่มบันทึกภาพในขั้นโอนเงิน QR จะแสดงเฉพาะเมื่อธนาคารและเลขบัญชีตรงกับภาพที่กำหนด

ตั้งบัญชีจริงใน Supabase จากโปสเตอร์แล้ว: โรส กสิกรไทย 219-2-97350-6 และแพรว กสิกรไทย 236-1-65639-6 ยังปิด receiving และ automatic ใช้โหมด manual ทั้งคู่

เว็บไซต์เป้าหมาย https://heartcollection.vercel.app ตรวจพบว่ายังเป็น bundle เดิมที่ไม่มี Supabase และหน้าเจ้าของ ต้อง deploy frontend รุ่นใหม่และตั้ง APP_ORIGIN ก่อนเปิดรับเงินจริง

## เปิดรับจริง 2026-09-09

เผยแพร่ Vercel production สำเร็จ deployment dpl_CTrqpvV7Hp9TVcqzmLUrRi3iZPmc ที่ https://heartcollection.vercel.app พร้อมตัวแปร Supabase production ครบ ตั้ง APP_ORIGIN เป็นโดเมนจริงและ RECEIVING_ENABLED=true รวมถึง receivingEnabled=true ในฐานข้อมูลแล้ว โหมด manual ทั้งโรสและแพรว automatic=false

ตรวจ HTTP จริงผ่าน: bundle เชื่อม Supabase, หน้าแอดมินทั้ง 4 URL, รูป QR ทั้งคู่ hash ตรงต้นฉบับ, CORS โดเมนจริง, API config enabled=true และบัญชีตรง, API เจ้าของที่ไม่ล็อกอินตอบ 401 ไม่มีการโอนเงินจริงหรือสร้างโดเนททดสอบบน production

ใช้งานโดเนทและแอดมินผ่านโดเมนจริง ตอนนี้ localhost ไม่อยู่ใน APP_ORIGIN

## เกมฟักไข่ยอดรวม Realtime 2026-09-09

ติดตั้ง migration 202609090004_global_hatching.sql แล้ว ไข่แต่ละตัวใช้ยอดรวม 100,000 คลิก RPC batch สูงสุด 100 คลิก / 2 วินาที Realtime public snapshot ไม่ถี่กว่า 2 วินาที ไม่มีข้อมูลผู้เล่นใน snapshot ทดสอบ 54 tests และ build ผ่าน ทดสอบรับ UPDATE ผ่าน Supabase Realtime จริงโดยอัปเดตเฉพาะ timestamp ไม่เพิ่มยอดเกม
