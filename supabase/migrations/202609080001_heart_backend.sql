-- Private tables are never exposed to browser roles. Only the Edge Function can call the RPC.
create schema if not exists heart_private;
revoke all on schema heart_private from public, anon, authenticated;
create table heart_private.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table heart_private.settings(id int primary key check(id=1), data jsonb not null);
insert into heart_private.settings values (1,'{"receivingEnabled":false,"accounts":{"rose":{},"praew":{}},"modes":{"rose":"manual","praew":"manual"},"verification":{"enabled":false,"limit":0,"used":0,"expiresAt":null,"reason":"ยังไม่ได้เปิดตรวจอัตโนมัติ"}}');
create table heart_private.orders(id uuid primary key, fingerprint text not null, slip_hash text unique, reference text unique, data jsonb not null);
create table heart_private.donations(id uuid primary key references heart_private.orders(id), data jsonb not null);
create table heart_private.audit(id bigint generated always as identity primary key, data jsonb not null);
create table heart_private.limits(key text primary key, count int not null, reset_at timestamptz not null);
alter table heart_private.admins enable row level security;
alter table heart_private.settings enable row level security;
alter table heart_private.orders enable row level security;
alter table heart_private.donations enable row level security;
alter table heart_private.audit enable row level security;
alter table heart_private.limits enable row level security;
revoke all on all tables in schema heart_private from public,anon,authenticated;

create function heart_private.event(action text,actor text,reason text) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('action',action,'actor',actor,'reason',reason,'at',clock_timestamp());
$$;
create function heart_private.ready(s jsonb) returns boolean language plpgsql set search_path='' as $$
declare a jsonb; r text;
begin
 if (s->>'receivingEnabled')::boolean is distinct from true or not exists(select 1 from heart_private.admins) then return false; end if;
 foreach r in array array['rose','praew'] loop
  a:=s->'accounts'->r;
  if not coalesce(a->>'bankCode' ~ '^[0-9]{3}$',false) or not coalesce(a->>'accountNumber' ~ '^[0-9]{10,15}$',false)
   or length(trim(coalesce(a->>'bankName','')))=0 or length(trim(coalesce(a->>'accountName','')))=0 then return false; end if;
 end loop;
 return (s->'accounts'->'rose'->>'bankCode',s->'accounts'->'rose'->>'accountNumber') is distinct from
 (s->'accounts'->'praew'->>'bankCode',s->'accounts'->'praew'->>'accountNumber');
end;
$$;
create function heart_private.form(f jsonb) returns jsonb language plpgsql set search_path='' as $$
declare price int; q numeric; anon boolean;
begin
 if f->>'recipient' not in ('rose','praew') or f->>'recipient' is null or coalesce(f->>'mode','fixed')<>'fixed' then raise exception 'ผู้รับหรือรูปแบบไม่ถูกต้อง'; end if;
 price:=case f->>'heartType' when 'pink' then 20 when 'ruby' then 50 when 'amber' then 100 when 'golden' then 200 else null end;
 q:=(f->>'quantity')::numeric;
 if price is null or q is null or q<>trunc(q) or q<1 or q>100 then raise exception 'จำนวนหัวใจไม่ถูกต้อง'; end if;
 anon:=coalesce((f->>'anonymous')::boolean,false);
 if jsonb_typeof(f->'supporterName') is distinct from 'string' or length(f->>'supporterName')>30 or (not anon and length(trim(f->>'supporterName'))=0)
  or jsonb_typeof(f->'message') is distinct from 'string' or length(f->>'message')>120 or length(coalesce(f->>'socialUsername',''))>40 then raise exception 'ชื่อหรือข้อความไม่ถูกต้อง'; end if;
 return jsonb_build_object('recipient',f->>'recipient','heartType',f->>'heartType','quantity',q::int,'amount',price*q::int,
 'anonymous',anon,'supporterName',case when anon then 'Anonymous' else trim(f->>'supporterName') end,
 'socialUsername',case when anon then '' else coalesce(f->>'socialUsername','') end,'message',f->>'message');
end;
$$;
create function heart_private.reference(v text) returns text language plpgsql set search_path='' as $$
begin
 if v is null or trim(v) !~ '^[a-zA-Z0-9-]{4,100}$' then raise exception 'เลขอ้างอิงไม่ถูกต้อง'; end if;
 return upper(trim(v));
end;
$$;
create function heart_private.credit(o jsonb, actor text, reason text) returns jsonb language plpgsql set search_path='' as $$
declare total bigint; d jsonb; marks jsonb;
begin
 select coalesce(sum((data->>'quantity')::int),0) into total from heart_private.donations;
 select coalesce(jsonb_agg(m order by m),'[]') into marks from unnest(array[500,1000,2000,3000,5000]) m where total<m and total+(o->'form'->>'quantity')::int>=m;
 d:=o->'form'||jsonb_build_object('id',o->>'id','sourceOrderId',o->>'id','source',o->>'kind','createdAt',clock_timestamp(),'specialHeart',null,'memoryMilestones',marks);
 insert into heart_private.donations values((o->>'id')::uuid,d);
 o:=o||jsonb_build_object('status','approved','donationId',o->>'id','audit',o->'audit'||jsonb_build_array(heart_private.event('approved',actor,reason)));
 update heart_private.orders set data=o,reference=o->>'externalRef' where id=(o->>'id')::uuid;
 return o;
end;
$$;

create function public.heart_api(p_action text,p_payload jsonb default '{}',p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; p jsonb; o jsonb; f jsonb; a jsonb; old heart_private.orders%rowtype; rid uuid;
 actor text; ref text; reason text; active boolean; ready boolean; reserved boolean:=false; nowtime timestamptz:=clock_timestamp(); n int; expires timestamptz;
begin
 if p_action in ('mode','policy','review','external','state','slip','authorize') then
  if p_actor is null or not exists(select 1 from heart_private.admins where user_id=p_actor) then raise exception using errcode='42501',message='ต้องเป็นแอดมินที่ได้รับอนุญาต'; end if;
 end if;
 actor:=coalesce(p_actor::text,'system');
 -- Serialize mutations across Edge Function instances, including quota and credits.
 if p_action in ('prepare','ready','verificationResult','mode','policy','review','external','pause') then
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
    or (p_payload->>'paidAt')::timestamptz is null or (p_payload->>'paidAt')::timestamptz>nowtime+interval '5 minutes'
    or length(trim(coalesce(p_payload->>'reason','')))=0 or length(p_payload->>'reason')>200 then raise exception 'ข้อมูลการตรวจยอดภายนอกไม่ถูกต้อง'; end if;
   ref:=heart_private.reference(p_payload->>'externalRef');
   o:=o||jsonb_build_object('mode','manual','externalRef',ref,'channel',p_payload->>'channel','paidAt',p_payload->>'paidAt');
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
 elsif p_action in ('review','verificationResult') then
  rid:=(p_payload->>'id')::uuid;select * into old from heart_private.orders where id=rid for update;
  if not found then raise exception 'ไม่พบรายการ'; end if;o:=old.data;
  if o->>'status'<>'pending' then return o; end if;
  if p_action='review' then
   reason:=trim(p_payload->>'reason');
   if reason is null or length(reason)=0 or length(reason)>200 or coalesce(p_payload->>'decision','') not in ('approve','reject') then raise exception 'คำสั่งหรือเหตุผลไม่ถูกต้อง'; end if;
   if p_payload->>'decision'='approve' then
    if not ready then raise exception 'ยังไม่เปิดรับเงินจริง'; end if;
    if o->>'kind'='bank-transfer' and not (o->>'slipReady')::boolean then raise exception 'สลิปยังอัปโหลดไม่สำเร็จ'; end if;
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
revoke all on all functions in schema heart_private from public,anon,authenticated;
revoke all on function public.heart_api(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.heart_api(text,jsonb,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('donation-slips','donation-slips',false,4194304,array['image/png','image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=4194304,allowed_mime_types=array['image/png','image/jpeg'];
-- No browser Storage policies: upload and signed-download access are handled by the authenticated Edge Function.


-- Restrictive policy also protects this bucket if the project has broad existing Storage policies.
create policy heart_slips_private on storage.objects as restrictive for all to anon,authenticated
 using (bucket_id <> 'donation-slips') with check (bucket_id <> 'donation-slips');

