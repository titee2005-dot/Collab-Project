-- Expand the shared pet bath to its durable reward-bearing game state.
-- Migration 202609220010_pet_bath.sql is already deployed, so this keeps the
-- public RPC signature and request ledger contract while replacing the old
-- 120-click goal with the four long-running stages.

alter table heart_private.pet_bath_rooms
  drop constraint if exists pet_bath_rooms_progress_check,
  drop constraint if exists pet_bath_rooms_check;

alter table heart_private.pet_bath_rooms
  add column if not exists reward_points int not null default 0;

alter table heart_private.pet_bath_rooms
  drop constraint if exists pet_bath_rooms_reward_points_check;
alter table heart_private.pet_bath_rooms
  add constraint pet_bath_rooms_reward_points_check check(reward_points>=0);

-- One durable award per recipient and Bangkok calendar day.  The room keeps
-- the cumulative total used by the public snapshot; this ledger is the
-- idempotency boundary that survives daily room rollover and RPC retries.
create table if not exists heart_private.pet_bath_reward_ledger(
  recipient text not null check(recipient in ('rose','praew')),
  day date not null,
  points int not null default 20 check(points=20),
  awarded_at timestamptz not null default clock_timestamp(),
  primary key(recipient,day)
);
alter table heart_private.pet_bath_reward_ledger enable row level security;
revoke all on heart_private.pet_bath_reward_ledger from public,anon,authenticated;

-- Rows completed by the deployed 120-click game remain completed after the
-- goal expansion.  Insert their historical daily award only when it is not
-- already present, so a recovery/replay of this backfill cannot add points
-- twice.
do $$
declare
  old_completion record;
  inserted_day date;
begin
  for old_completion in
    select recipient,day,completed_at
      from heart_private.pet_bath_rooms
     where progress>=120 and completed_at is not null
  loop
    update heart_private.pet_bath_rooms
       set progress=500000,
           last_completed_at=coalesce(last_completed_at,completed_at)
     where recipient=old_completion.recipient;

    inserted_day:=null;
    insert into heart_private.pet_bath_reward_ledger(recipient,day,points,awarded_at)
      values(old_completion.recipient,old_completion.day,20,old_completion.completed_at)
      on conflict(recipient,day) do nothing
      returning day into inserted_day;
    if inserted_day is not null then
      update heart_private.pet_bath_rooms
         set reward_points=reward_points+20
       where recipient=old_completion.recipient;
    end if;
  end loop;
end;
$$;

alter table heart_private.pet_bath_rooms
  add constraint pet_bath_rooms_progress_check check(progress between 0 and 500000),
  add constraint pet_bath_rooms_check check((progress=500000 and completed_at is not null) or (progress<500000 and completed_at is null));

-- Keep the private state private even when this migration is applied to a
-- project with broad default grants.
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
  inserted_day date;
begin
  nowday:=(nowtime at time zone 'Asia/Bangkok')::date;

  -- Every read locks both rooms and rolls them forward on a Bangkok midnight.
  -- Completion timestamps and cumulative reward points survive the rollover.
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
      'rose',jsonb_build_object('day',rose_room.day,'round',rose_room.round,'progress',rose_room.progress,'completedAt',rose_room.completed_at,'lastCompletedAt',rose_room.last_completed_at,'rewardPoints',rose_room.reward_points,'hatched',hatch.rose>=100000),
      'praew',jsonb_build_object('day',praew_room.day,'round',praew_room.round,'progress',praew_room.progress,'completedAt',praew_room.completed_at,'lastCompletedAt',praew_room.last_completed_at,'rewardPoints',praew_room.reward_points,'hatched',hatch.praew>=100000)
    );
  end if;

  if p_recipient is null or p_action is null or p_recipient not in ('rose','praew') or p_action not in ('help','start') then
    raise exception 'Invalid pet bath request';
  end if;
  if p_round is null or p_stage is null or p_stage not between 0 and 4 or p_request is null then
    raise exception 'Invalid pet bath request';
  end if;

  -- Lock one room for the complete read/check/update/award/ledger sequence.
  -- This serializes concurrent helpers for one pet and keeps +1 bounded.
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

  -- A duplicate UUID is a successful replay.  Return the current snapshot so
  -- a retried browser request cannot move its local room backwards.
  select * into prior from heart_private.pet_bath_requests where request_id=p_request;
  if found then
    if prior.recipient<>p_recipient or prior.action<>p_action or prior.round<>p_round or prior.stage<>p_stage then
      raise exception 'Request UUID was already used for another action';
    end if;
    select * into rose_room from heart_private.pet_bath_rooms where recipient='rose';
    select * into praew_room from heart_private.pet_bath_rooms where recipient='praew';
    return jsonb_build_object(
      'rose',jsonb_build_object('day',rose_room.day,'round',rose_room.round,'progress',rose_room.progress,'completedAt',rose_room.completed_at,'lastCompletedAt',rose_room.last_completed_at,'rewardPoints',rose_room.reward_points,'hatched',hatch.rose>=100000),
      'praew',jsonb_build_object('day',praew_room.day,'round',praew_room.round,'progress',praew_room.progress,'completedAt',praew_room.completed_at,'lastCompletedAt',praew_room.last_completed_at,'rewardPoints',praew_room.reward_points,'hatched',hatch.praew>=100000)
    );
  end if;

  current_stage:=case when room.progress<100000 then 0 when room.progress<300000 then 1 when room.progress<400000 then 2 when room.progress<500000 then 3 else 4 end;
  -- Delayed browser calls are harmless no-ops.  Recording the snapshot makes
  -- a retry with the same UUID deterministic while the client catches up.
  if p_round<>room.round or p_stage<>current_stage then
    select * into rose_room from heart_private.pet_bath_rooms where recipient='rose';
    select * into praew_room from heart_private.pet_bath_rooms where recipient='praew';
    snapshot:=jsonb_build_object(
      'rose',jsonb_build_object('day',rose_room.day,'round',rose_room.round,'progress',rose_room.progress,'completedAt',rose_room.completed_at,'lastCompletedAt',rose_room.last_completed_at,'rewardPoints',rose_room.reward_points,'hatched',hatch.rose>=100000),
      'praew',jsonb_build_object('day',praew_room.day,'round',praew_room.round,'progress',praew_room.progress,'completedAt',praew_room.completed_at,'lastCompletedAt',praew_room.last_completed_at,'rewardPoints',praew_room.reward_points,'hatched',hatch.praew>=100000)
    );
    insert into heart_private.pet_bath_requests(request_id,recipient,action,round,stage,result,created_at)
      values(p_request,p_recipient,p_action,p_round,p_stage,snapshot,nowtime);
    return snapshot;
  end if;

  -- One round belongs to the current Bangkok day.  `start` remains a
  -- compatibility action but never resets a room on the same day.
  if p_action='help' and room.progress<500000 then
    room.progress:=room.progress+1;
    if room.progress=500000 then
      room.completed_at:=nowtime;
      room.last_completed_at:=nowtime;
      inserted_day:=null;
      insert into heart_private.pet_bath_reward_ledger(recipient,day,points,awarded_at)
        values(p_recipient,room.day,20,nowtime)
        on conflict(recipient,day) do nothing
        returning day into inserted_day;
      if inserted_day is not null then room.reward_points:=room.reward_points+20; end if;
    end if;
    update heart_private.pet_bath_rooms
      set progress=room.progress,completed_at=room.completed_at,last_completed_at=room.last_completed_at,reward_points=room.reward_points
      where recipient=p_recipient;
  end if;

  select * into rose_room from heart_private.pet_bath_rooms where recipient='rose';
  select * into praew_room from heart_private.pet_bath_rooms where recipient='praew';
  snapshot:=jsonb_build_object(
    'rose',jsonb_build_object('day',rose_room.day,'round',rose_room.round,'progress',rose_room.progress,'completedAt',rose_room.completed_at,'lastCompletedAt',rose_room.last_completed_at,'rewardPoints',rose_room.reward_points,'hatched',hatch.rose>=100000),
    'praew',jsonb_build_object('day',praew_room.day,'round',praew_room.round,'progress',praew_room.progress,'completedAt',praew_room.completed_at,'lastCompletedAt',praew_room.last_completed_at,'rewardPoints',praew_room.reward_points,'hatched',hatch.praew>=100000)
  );
  insert into heart_private.pet_bath_requests(request_id,recipient,action,round,stage,result,created_at)
    values(p_request,p_recipient,p_action,p_round,p_stage,snapshot,nowtime);
  return snapshot;
end;
$$;
revoke all on function public.heart_pet_bath(text,text,int,int,uuid) from public;
grant execute on function public.heart_pet_bath(text,text,int,int,uuid) to anon,authenticated;
