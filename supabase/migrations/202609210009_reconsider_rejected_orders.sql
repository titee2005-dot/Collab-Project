-- Simplified human review and audited credit removal. No changes to automatic verification.
create or replace function heart_private.heart_api_base(p_action text,p_payload jsonb default '{}',p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; p jsonb; o jsonb; f jsonb; a jsonb; old heart_private.orders%rowtype; rid uuid;
 actor text; ref text; reason text; active boolean; ready boolean; reserved boolean:=false; nowtime timestamptz:=clock_timestamp(); n int; expires timestamptz;
begin
 if p_action in ('mode','policy','review','delete','external','state','slip','authorize') then
  if p_actor is null or not exists(select 1 from heart_private.admins where user_id=p_actor) then raise exception using errcode='42501',message='ต้องเป็นแอดมินที่ได้รับอนุญาต'; end if;
 end if;
 actor:=coalesce(p_payload->>'operatorLabel',p_actor::text,'system');
 -- Serialize mutations across Edge Function instances, including quota and credits.
 if p_action in ('prepare','ready','verificationResult','mode','policy','review','delete','external','pause') then
  select data into s from heart_private.settings where id=1 for update;
 else select data into s from heart_private.settings where id=1; end if;
 p:=s->'verification';
 ready:=heart_private.ready(s);
 active:=coalesce((p->>'enabled')::boolean,false) and coalesce((p_payload->>'apiAvailable')::boolean,false)
  and (p->>'used')::int<(p->>'limit')::int and coalesce((p->>'expiresAt')::timestamptz>nowtime,false);

 if p_action='authorize' then return jsonb_build_object('actor',actor); end if;
 if p_action='config' then return jsonb_build_object('enabled',ready,'accounts',case when ready then s->'accounts' else null end,'message',case when ready then 'เปิดรับโดเนท' else 'ยังไม่เปิดรับเงินจริง กำลังตั้งค่าระบบ' end); end if;
 if p_action='donations' then return (select coalesce(jsonb_agg(data order by data->>'createdAt',id),'[]') from heart_private.donations); end if;
 if p_action='state' then
  return jsonb_build_object('actor',actor,'modes',s->'modes','verification',p||jsonb_build_object('active',active,'keyConfigured',coalesce((p_payload->>'apiAvailable')::boolean,false),'remaining',greatest(0,(p->>'limit')::int-(p->>'used')::int)),
   'readiness',jsonb_build_object('enabled',ready,'missing',case when ready then '[]'::jsonb else '["ยังปิดรับเงินจริง หรือบัญชีผู้รับทั้งสองฝั่งยังตั้งค่าไม่ครบ"]'::jsonb end),
   'orders',(select coalesce(jsonb_agg(data order by data->>'createdAt',id),'[]') from heart_private.orders),
   'audit',(select coalesce(jsonb_agg(data order by id),'[]') from heart_private.audit));
 end if;
 if p_action='rate' then
  delete from heart_private.limits where reset_at<nowtime;
  insert into heart_private.limits values(p_payload->>'key',1,nowtime+interval '1 hour')
   on conflict(key) do update set count=heart_private.limits.count+1 returning count into n;
  return jsonb_build_object('allowed',n<=20);
 end if;
 if p_action='mode' then
  if coalesce(p_payload->>'recipient','') not in ('rose','praew') or coalesce(p_payload->>'mode','') not in ('manual','auto') then raise exception 'โหมดไม่ถูกต้อง'; end if;
  s:=jsonb_set(s,array['modes',p_payload->>'recipient'],p_payload->'mode');
 elsif p_action='policy' then
  if jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'สถานะไม่ถูกต้อง'; end if;
  if (p_payload->>'enabled')::boolean then
   if not coalesce((p_payload->>'apiAvailable')::boolean,false) then raise exception 'ยังไม่มี EasySlip API key'; end if;
   if (p_payload->>'limit')::numeric<>trunc((p_payload->>'limit')::numeric) then raise exception 'เพดานต้องเป็นจำนวนเต็ม'; end if;
   n:=(p_payload->>'limit')::int; expires:=(p_payload->>'expiresAt')::timestamptz;
   if n is null or n<=(p->>'used')::int or n>1000000 or expires is null or expires<=nowtime then raise exception 'เพดานหรือวันหมดอายุไม่ถูกต้อง'; end if;
   p:=p||jsonb_build_object('enabled',true,'limit',n,'expiresAt',expires,'reason','เปิดโดยแอดมิน');
  else p:=p||'{"enabled":false,"reason":"แอดมินปิดตรวจอัตโนมัติ"}'; end if;
  s:=jsonb_set(s,'{verification}',p);
 elsif p_action='pause' then
  s:=jsonb_set(s,'{verification}',p||jsonb_build_object('enabled',false,'reason','บริการตรวจสลิปไม่พร้อม รอแอดมินเปิดใหม่'));
 elsif p_action in ('prepare','external') then
  if not ready then raise exception 'ยังไม่เปิดรับเงินจริง'; end if;
  rid:=(p_payload->>'id')::uuid; f:=heart_private.form(p_payload->'form'); a:=s->'accounts'->(f->>'recipient');
  select * into old from heart_private.orders where id=rid;
  if found then
   if old.fingerprint is distinct from p_payload->>'fingerprint' then raise exception using errcode='23505',message='รหัสรายการใช้กับข้อมูลอื่นแล้ว'; end if;
   return old.data||jsonb_build_object('runVerification',false);
  end if;
  o:=jsonb_build_object('id',rid,'form',f,'amount',f->'amount','mode',s->'modes'->(f->>'recipient'),'kind',case when p_action='external' then 'external-payment' else 'bank-transfer' end,
    'status','pending','createdAt',nowtime,'account',a,'hasSlip',p_action='prepare','slipReady',false,
    'audit',jsonb_build_array(heart_private.event('submitted',case when p_action='external' then actor else 'supporter' end,'รอตรวจเงินจริง')));
  if p_action='external' then
   if (p_payload->>'verified')::boolean is distinct from true or (p_payload->>'paidAmount')::numeric is distinct from (f->>'amount')::numeric or coalesce(p_payload->>'channel','') not in ('LINE','Facebook','Instagram','Other')
    or (nullif(p_payload->>'paidAt','') is not null and (p_payload->>'paidAt')::timestamptz>nowtime+interval '5 minutes')
    or length(trim(coalesce(p_payload->>'reason','')))=0 or length(p_payload->>'reason')>200 then raise exception 'ข้อมูลการตรวจยอดภายนอกไม่ถูกต้อง'; end if;
   ref:=case when nullif(p_payload->>'externalRef','') is not null then heart_private.reference(p_payload->>'externalRef') else null end;
   o:=o||jsonb_strip_nulls(jsonb_build_object('mode','manual','externalRef',ref,'channel',p_payload->>'channel','paidAt',nullif(p_payload->>'paidAt','')));
  else
   if coalesce(p_payload->>'slipHash','')!~'^[a-f0-9]{64}$' then raise exception 'สลิปไม่ถูกต้อง'; end if;
   o:=o||jsonb_build_object('slipPath',rid::text||'/'||(p_payload->>'slipHash'));
  end if;
  insert into heart_private.orders values(rid,p_payload->>'fingerprint',p_payload->>'slipHash',ref,o);
  if p_action='external' then o:=heart_private.credit(o,actor,p_payload->>'reason'); end if;
  return o||jsonb_build_object('runVerification',false);
 elsif p_action='ready' then
  rid:=(p_payload->>'id')::uuid;select * into old from heart_private.orders where id=rid for update;
  if not found or old.fingerprint is distinct from p_payload->>'fingerprint' then raise exception 'ไม่พบรายการตรงกัน'; end if;
  o:=old.data;
  if (o->>'slipReady')::boolean or o->>'status'<>'pending' then return o||jsonb_build_object('runVerification',false); end if;
  o:=o||'{"slipReady":true,"effectiveMode":"manual"}';
  if ready and o->>'mode'='auto' and active then
   reserved:=true;p:=jsonb_set(p,'{used}',to_jsonb((p->>'used')::int+1));
   o:=o||'{"effectiveMode":"auto","reserved":true}';
   if (p->>'used')::int>=(p->>'limit')::int then p:=p||'{"enabled":false,"reason":"ถึงเพดานเรียก API แล้ว"}'; end if;
  elsif o->>'mode'='auto' then
   p:=p||'{"enabled":false,"reason":"ปิดตรวจอัตโนมัติ โควต้าหรือสิทธิ์ไม่พร้อม"}';
  end if;
  o:=o||jsonb_build_object('audit',o->'audit'||jsonb_build_array(heart_private.event(case when reserved then 'API call reserved' else 'manual fallback' end,'system',case when reserved then 'จองโควต้าร่วม 1 ครั้ง' else 'รอแอดมินตรวจยอด' end)));
  update heart_private.settings set data=jsonb_set(s,'{verification}',p) where id=1;
  update heart_private.orders set data=o where id=rid;
  return o||jsonb_build_object('runVerification',reserved);
 elsif p_action='delete' then
  rid:=(p_payload->>'id')::uuid;select * into old from heart_private.orders where id=rid for update;
  if not found then raise exception 'ไม่พบรายการ'; end if;o:=old.data;
  if (p_payload->>'confirmed')::boolean is distinct from true then raise exception 'กรุณายืนยันการลบหัวใจ'; end if;
  if o->>'status'='deleted' then return o; end if;
  if o->>'status' not in ('approved','rejected') then raise exception 'ลบได้เฉพาะรายการที่อนุมัติหรือปฏิเสธแล้ว'; end if;
  reason:=case when o->>'status'='rejected' then 'แอดมินลบรายการที่ปฏิเสธ' else 'แอดมินลบรายการที่อนุมัติและคืนยอดหัวใจ' end;
  o:=o||jsonb_build_object('status','deleted','deletedAt',nowtime,'audit',o->'audit'||jsonb_build_array(heart_private.event('deleted',actor,reason)));
  update heart_private.orders set data=o where id=rid;
  delete from heart_private.donations where id=rid;
  insert into heart_private.audit(data) values(heart_private.event('deleted',actor,rid::text||': '||reason));
  return o;
 elsif p_action in ('review','verificationResult') then
  rid:=(p_payload->>'id')::uuid;select * into old from heart_private.orders where id=rid for update;
  if not found then raise exception 'ไม่พบรายการ'; end if;o:=old.data;
  if o->>'status'<>'pending' and not (p_action='review' and o->>'status'='rejected' and p_payload->>'decision'='approve') then return o; end if;
  if p_action='review' then
   reason:=trim(p_payload->>'reason');
   if reason is null or length(reason)=0 or length(reason)>200 or coalesce(p_payload->>'decision','') not in ('approve','reject') then raise exception 'คำสั่งหรือเหตุผลไม่ถูกต้อง'; end if;
   if p_payload->>'decision'='approve' then
    if not ready then raise exception 'ยังไม่เปิดรับเงินจริง'; end if;
    if o->>'kind'='bank-transfer' and not (o->>'slipReady')::boolean then raise exception 'สลิปยังอัปโหลดไม่สำเร็จ'; end if;
    if p_payload->>'reviewMethod'='manual' then
     if (p_payload->>'confirmed')::boolean is distinct from true then raise exception 'ต้องยืนยันการตรวจภาพและยอดเงินจริง'; end if;
     return heart_private.credit(o||'{"reviewMethod":"manual"}',actor,reason);
    end if;
    if (p_payload->>'confirmed')::boolean is distinct from true or (p_payload->>'paidAmount')::numeric is distinct from (o->>'amount')::numeric
      or p_payload->>'accountNumber' is distinct from o->'account'->>'accountNumber' or p_payload->>'bankCode' is distinct from o->'account'->>'bankCode'
      or (p_payload->>'paidAt')::timestamptz is null or (p_payload->>'paidAt')::timestamptz>nowtime+interval '5 minutes' then raise exception 'ยอดหรือบัญชีผู้รับไม่ตรง'; end if;
    ref:=heart_private.reference(p_payload->>'externalRef');
    if old.reference is not null and old.reference<>ref then raise exception 'เลขอ้างอิงไม่ตรงผลตรวจ'; end if;
    o:=o||jsonb_build_object('externalRef',ref,'paidAt',p_payload->>'paidAt');
    return heart_private.credit(o,actor,reason);
   end if;
   o:=o||jsonb_build_object('status','rejected','audit',o->'audit'||jsonb_build_array(heart_private.event('rejected',actor,reason)));
  else
   if (o->>'reserved')::boolean is distinct from true then raise exception 'ไม่มีการจองตรวจอัตโนมัติ'; end if;
   if o ? 'verification' then return o; end if;
   a:=p_payload->'result';o:=o||jsonb_build_object('verification',a->>'status','audit',o->'audit'||jsonb_build_array(heart_private.event('verification','EasySlip',a->>'reason')));
   if a->>'ref' is not null then
    ref:=heart_private.reference(a->>'ref');
    if exists(select 1 from heart_private.orders where reference=ref and id<>rid) then
     o:=o||'{"status":"rejected"}';ref:=null;
    else o:=o||jsonb_build_object('externalRef',ref,'paidAt',a->>'paidAt'); end if;
   end if;
   if o->>'status'='pending' then
    if a->>'status'='verified' and ready and ref is not null then return heart_private.credit(o,'EasySlip',a->>'reason');
    elsif a->>'status'='rejected' then o:=o||'{"status":"rejected"}'; end if;
   end if;
  end if;
  update heart_private.orders set data=o,reference=coalesce(ref,old.reference) where id=rid;return o;
 elsif p_action='slip' then
  select data into o from heart_private.orders where id=(p_payload->>'id')::uuid;
  if o is null or (o->>'slipReady')::boolean is distinct from true then raise exception 'ไม่พบสลิปที่พร้อมเปิด'; end if;
  return jsonb_build_object('path',o->>'slipPath');
 else raise exception 'ไม่พบคำสั่ง'; end if;
 update heart_private.settings set data=s where id=1;
 insert into heart_private.audit(data) values(heart_private.event(p_action,actor,(p_payload-'apiAvailable')::text));
 return '{"ok":true}';
end;
$$;


revoke all on function heart_private.heart_api_base(text,jsonb,uuid) from public,anon,authenticated,service_role;
