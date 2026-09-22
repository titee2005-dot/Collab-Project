-- The pet bath is a shared, free game state.  Its mutable rows and request
-- ledger stay private; browsers only reach them through the hardened RPC.
create schema if not exists heart_private;
revoke all on schema heart_private from public,anon,authenticated;

create table heart_private.pet_bath_rooms(
  recipient text primary key check(recipient in ('rose','praew')),
  day date not null,
  round int not null default 1 check(round>=1),
  progress int not null default 0 check(progress between 0 and 120),
  completed_at timestamptz,
  last_completed_at timestamptz,
  check((progress=120 and completed_at is not null) or (progress<120 and completed_at is null))
);
insert into heart_private.pet_bath_rooms(recipient,day)
  values('rose',(clock_timestamp() at time zone 'Asia/Bangkok')::date),('praew',(clock_timestamp() at time zone 'Asia/Bangkok')::date);

-- A request UUID is the public client's retry/idempotency key.  Keeping the
-- response makes a retried request return exactly the result of its first run.
create table heart_private.pet_bath_requests(
  request_id uuid primary key,
  recipient text not null check(recipient in ('rose','praew')),
  action text not null check(action in ('help','start')),
  round int not null,
  stage int not null check(stage between 0 and 4),
  result jsonb not null,
  created_at timestamptz not null
);

alter table heart_private.pet_bath_rooms enable row level security;
alter table heart_private.pet_bath_requests enable row level security;
revoke all on heart_private.pet_bath_rooms,heart_private.pet_bath_requests from public,anon,authenticated;

create or replace function public.heart_pet_bath(
  p_recipient text default null,
  p_action text default null,
  p_round int default null,
  p_stage int default null,
  p_request uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  rose_room heart_private.pet_bath_rooms%rowtype;
  praew_room heart_private.pet_bath_rooms%rowtype;
  room heart_private.pet_bath_rooms%rowtype;
  prior heart_private.pet_bath_requests%rowtype;
  hatch heart_private.hatch_total%rowtype;
  snapshot jsonb;
  nowtime timestamptz:=clock_timestamp();
  nowday date;
  hatched boolean;
  current_stage int;
begin
  nowday:=(nowtime at time zone 'Asia/Bangkok')::date;

  -- Every read locks both rooms and rolls them forward at Bangkok midnight.
  -- The old completion timestamp remains available as the one-day reward.
  if p_recipient is null and p_action is null and p_round is null and p_stage is null and p_request is null then
    select * into hatch from heart_private.hatch_total where id=1;
    if not found then raise exception 'Hatching state is unavailable'; end if;
    select * into rose_room from heart_private.pet_bath_rooms where recipient='rose' for update;
    select * into praew_room from heart_private.pet_bath_rooms where recipient='praew' for update;
    if rose_room.recipient is null or praew_room.recipient is null then raise exception 'Pet bath state is unavailable'; end if;
    if rose_room.day<nowday then
      update heart_private.pet_bath_rooms
        set day=nowday,round=round+1,progress=0,completed_at=null,last_completed_at=coalesce(last_completed_at,completed_at)
        where recipient='rose' returning * into rose_room;
    end if;
    if praew_room.day<nowday then
      update heart_private.pet_bath_rooms
        set day=nowday,round=round+1,progress=0,completed_at=null,last_completed_at=coalesce(last_completed_at,completed_at)
        where recipient='praew' returning * into praew_room;
    end if;
    return jsonb_build_object(
      'rose',jsonb_build_object('day',rose_room.day,'round',rose_room.round,'progress',rose_room.progress,'completedAt',rose_room.completed_at,'lastCompletedAt',rose_room.last_completed_at,'hatched',hatch.rose>=100000),
      'praew',jsonb_build_object('day',praew_room.day,'round',praew_room.round,'progress',praew_room.progress,'completedAt',praew_room.completed_at,'lastCompletedAt',praew_room.last_completed_at,'hatched',hatch.praew>=100000)
    );
  end if;

  if p_recipient is null or p_action is null or p_recipient not in ('rose','praew') or p_action not in ('help','start') then
    raise exception 'Invalid pet bath request';
  end if;
  if p_round is null or p_stage is null or p_stage not between 0 and 4 or p_request is null then
    raise exception 'Invalid pet bath request';
  end if;

  -- Lock one room for the whole read/check/update/ledger sequence.  This
  -- serializes concurrent helpers for the same pet and keeps +1 bounded.
  select * into room from heart_private.pet_bath_rooms where recipient=p_recipient for update;
  if not found then raise exception 'Pet bath state is unavailable'; end if;
  if room.day<nowday then
    update heart_private.pet_bath_rooms
      set day=nowday,round=round+1,progress=0,completed_at=null,last_completed_at=coalesce(last_completed_at,completed_at)
      where recipient=p_recipient returning * into room;
  end if;
  select * into hatch from heart_private.hatch_total where id=1;
  if not found then raise exception 'Hatching state is unavailable'; end if;
  hatched:=case when p_recipient='rose' then hatch.rose>=100000 else hatch.praew>=100000 end;
  if not hatched then raise exception 'Pet is not hatched'; end if;

  -- A duplicate UUID is a successful replay. The current snapshot is
  -- returned so a browser cannot move backwards after another helper acts.
  select * into prior from heart_private.pet_bath_requests where request_id=p_request;
  if found then
    if prior.recipient<>p_recipient or prior.action<>p_action or prior.round<>p_round or prior.stage<>p_stage then
      raise exception 'Request UUID was already used for another action';
    end if;
    select * into rose_room from heart_private.pet_bath_rooms where recipient='rose';
    select * into praew_room from heart_private.pet_bath_rooms where recipient='praew';
    return jsonb_build_object(
      'rose',jsonb_build_object('day',rose_room.day,'round',rose_room.round,'progress',rose_room.progress,'completedAt',rose_room.completed_at,'lastCompletedAt',rose_room.last_completed_at,'hatched',hatch.rose>=100000),
      'praew',jsonb_build_object('day',praew_room.day,'round',praew_room.round,'progress',praew_room.progress,'completedAt',praew_room.completed_at,'lastCompletedAt',praew_room.last_completed_at,'hatched',hatch.praew>=100000)
    );
  end if;

  current_stage:=case when room.progress<20 then 0 when room.progress<70 then 1 when room.progress<100 then 2 when room.progress<120 then 3 else 4 end;
  -- Delayed browser calls are harmless no-ops. Recording the snapshot makes
  -- a retry with the same UUID deterministic while the client catches up.
  if p_round<>room.round or p_stage<>current_stage then
    select * into rose_room from heart_private.pet_bath_rooms where recipient='rose';
    select * into praew_room from heart_private.pet_bath_rooms where recipient='praew';
    snapshot:=jsonb_build_object(
      'rose',jsonb_build_object('day',rose_room.day,'round',rose_room.round,'progress',rose_room.progress,'completedAt',rose_room.completed_at,'lastCompletedAt',rose_room.last_completed_at,'hatched',hatch.rose>=100000),
      'praew',jsonb_build_object('day',praew_room.day,'round',praew_room.round,'progress',praew_room.progress,'completedAt',praew_room.completed_at,'lastCompletedAt',praew_room.last_completed_at,'hatched',hatch.praew>=100000)
    );
    insert into heart_private.pet_bath_requests(request_id,recipient,action,round,stage,result,created_at)
      values(p_request,p_recipient,p_action,p_round,p_stage,snapshot,nowtime);
    return snapshot;
  end if;

  -- One round belongs to the current Bangkok day. `start` is retained as a
  -- compatibility action but never resets a room manually on the same day;
  -- midnight rollover above is the only way to begin the next round.
  if p_action='help' and room.progress<120 then
    room.progress:=room.progress+1;
    if room.progress=120 then room.completed_at:=nowtime; room.last_completed_at:=nowtime; end if;
    update heart_private.pet_bath_rooms
      set progress=room.progress,completed_at=room.completed_at,last_completed_at=room.last_completed_at
      where recipient=p_recipient;
  end if;

  select * into rose_room from heart_private.pet_bath_rooms where recipient='rose';
  select * into praew_room from heart_private.pet_bath_rooms where recipient='praew';
  snapshot:=jsonb_build_object(
    'rose',jsonb_build_object('day',rose_room.day,'round',rose_room.round,'progress',rose_room.progress,'completedAt',rose_room.completed_at,'lastCompletedAt',rose_room.last_completed_at,'hatched',hatch.rose>=100000),
    'praew',jsonb_build_object('day',praew_room.day,'round',praew_room.round,'progress',praew_room.progress,'completedAt',praew_room.completed_at,'lastCompletedAt',praew_room.last_completed_at,'hatched',hatch.praew>=100000)
  );
  insert into heart_private.pet_bath_requests(request_id,recipient,action,round,stage,result,created_at)
    values(p_request,p_recipient,p_action,p_round,p_stage,snapshot,nowtime);
  return snapshot;
end;
$$;
revoke all on function public.heart_pet_bath(text,text,int,int,uuid) from public;
grant execute on function public.heart_pet_bath(text,text,int,int,uuid) to anon,authenticated;
