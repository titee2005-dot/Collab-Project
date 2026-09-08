alter table heart_private.admins add column role text not null default 'reviewer' check(role in ('owner','reviewer'));
alter table heart_private.admins add column scope text not null default 'all' check(scope in ('rose','praew','all'));
update heart_private.admins set role='owner',scope='all'
where user_id in(select id from auth.users where lower(email)='heartcollection@gmail.com');
create unique index heart_single_owner on heart_private.admins(role) where role='owner';

-- Move the original entrypoint into the private schema so it cannot bypass role checks.
alter function public.heart_api(text,jsonb,uuid) set schema heart_private;
alter function heart_private.heart_api(text,jsonb,uuid) rename to heart_api_base;
revoke all on function heart_private.heart_api_base(text,jsonb,uuid) from public,anon,authenticated,service_role;

create function public.heart_api(p_action text,p_payload jsonb default '{}',p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member heart_private.admins%rowtype; wanted text; target text; result jsonb;
begin
 if p_action in ('authorize','state','settings','mode','policy','review','external','slip') then
  select * into member from heart_private.admins where user_id=p_actor;
  if not found then raise exception using errcode='42501',message='ไม่มีสิทธิ์แอดมิน'; end if;
  if p_action in ('settings','mode','policy') and member.role<>'owner' then
   raise exception using errcode='42501',message='เฉพาะเจ้าของระบบเท่านั้น';
  end if;
  wanted:=coalesce(p_payload->>'scope',member.scope);
  if wanted not in ('rose','praew','all') or (member.scope<>'all' and wanted<>member.scope) then
   raise exception using errcode='42501',message='ไม่มีสิทธิ์เข้าหน้าของฝั่งนี้';
  end if;
  if p_action in ('review','slip') then
   select data->'form'->>'recipient' into target from heart_private.orders where id=(p_payload->>'id')::uuid;
   if target is null or (member.scope<>'all' and target<>member.scope) or (wanted<>'all' and target<>wanted) then
    raise exception using errcode='42501',message='ไม่มีสิทธิ์เข้าถึงรายการนี้';
   end if;
  elsif p_action='external' then
   target:=p_payload->'form'->>'recipient';
   if target is null or (member.scope<>'all' and target<>member.scope) or (wanted<>'all' and target<>wanted) then
    raise exception using errcode='42501',message='ไม่มีสิทธิ์บันทึกให้ฝั่งนี้';
   end if;
  end if;
  if p_action='authorize' then return jsonb_build_object('actor',p_actor,'permissions',jsonb_build_object('owner',member.role='owner','scope',member.scope)); end if;
  if p_action='settings' then
   result:=heart_private.heart_api_base('state',p_payload,p_actor);
   return (result-'orders')||jsonb_build_object('permissions',jsonb_build_object('owner',true,'scope',member.scope));
  end if;
  if p_action='state' then
   result:=heart_private.heart_api_base('state',p_payload,p_actor);
   result:=result-'verification'-'modes'-'audit';
   result:=jsonb_set(result,'{orders}',coalesce((select jsonb_agg(value) from jsonb_array_elements(result->'orders') where wanted='all' or value->'form'->>'recipient'=wanted),'[]'));
   return result||jsonb_build_object('permissions',jsonb_build_object('owner',member.role='owner','scope',member.scope));
  end if;
  -- Operator identity and audit reasons are server generated. No channel/note form fields.
  if p_action='review' then
   p_payload:=p_payload||jsonb_build_object('reason',case when p_payload->>'decision'='approve' then 'แอดมินตรวจยอดเข้าบัญชีและอนุมัติ' else 'แอดมินปฏิเสธรายการ' end);
  elsif p_action='external' then
   p_payload:=p_payload||jsonb_build_object('channel','Other','reason','แอดมินยืนยันยอดเข้าบัญชีจากรายการภายนอก');
  end if;
 end if;
 return heart_private.heart_api_base(p_action,p_payload,p_actor);
end;
$$;
revoke all on function public.heart_api(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.heart_api(text,jsonb,uuid) to service_role;

