-- Restore evidence-backed unfinished rounds and preserve future progress.
-- The private audit makes recovery one-time and records the original state.
create table if not exists heart_private.pet_bath_carryover_audit(
 recipient text primary key,
 before_state jsonb not null,
 evidence jsonb not null,
 restored_progress int not null,
 recovered_at timestamptz not null default clock_timestamp()
);
alter table heart_private.pet_bath_carryover_audit enable row level security;
revoke all on heart_private.pet_bath_carryover_audit from public,anon,authenticated;

do $$
declare
 r heart_private.pet_bath_rooms%rowtype;
 evidence jsonb;
 recovered bigint;
 cutoff int;
 award_day date:=(clock_timestamp() at time zone 'Asia/Bangkok')::date;
 awarded int;
begin
 -- Lock in the same order as reads, keeping help calls out of the recovery.
 perform recipient from heart_private.pet_bath_rooms order by recipient for update;
 for r in select * from heart_private.pet_bath_rooms order by recipient loop
  if exists(select 1 from heart_private.pet_bath_carryover_audit a where a.recipient=r.recipient) then continue; end if;
  select coalesce(max((q.result->r.recipient->>'round')::int),0) into cutoff
  from heart_private.pet_bath_requests q
  where q.result->r.recipient->>'completedAt' is not null;
  with observations as (
   select (q.result->r.recipient->>'round')::int as round,
          (q.result->r.recipient->>'progress')::int as progress
   from heart_private.pet_bath_requests q
   where q.result->r.recipient->>'completedAt' is null
     and (q.result->r.recipient->>'round')::int>cutoff
     and (q.result->r.recipient->>'round')::int<=r.round
     and (r.last_completed_at is null or q.created_at>r.last_completed_at)
   union all select r.round,r.progress
  ), rounds as (
   select round,max(progress) as progress from observations group by round
  ) select coalesce(sum(progress),0),coalesce(jsonb_agg(jsonb_build_object('round',round,'progress',progress) order by round),'[]'::jsonb)
  into recovered,evidence from rounds;
  -- A completed live room remains completed and never receives another award.
  if r.completed_at is not null then recovered:=r.progress; end if;
  recovered:=greatest(r.progress,least(500000,recovered));
  insert into heart_private.pet_bath_carryover_audit(recipient,before_state,evidence,restored_progress)
    values(r.recipient,to_jsonb(r),evidence,recovered::int);
  if recovered>r.progress then
   awarded:=0;
   if recovered=500000 then
    insert into heart_private.pet_bath_reward_ledger(recipient,day,points)
     values(r.recipient,award_day,20) on conflict(recipient,day) do nothing;
    get diagnostics awarded=row_count;
   end if;
   update heart_private.pet_bath_rooms
    set progress=recovered::int,day=award_day,
        completed_at=case when recovered=500000 then clock_timestamp() else null end,
        last_completed_at=case when recovered=500000 then clock_timestamp() else last_completed_at end,
        reward_points=reward_points+20*awarded
    where recipient=r.recipient;
  end if;
  raise notice 'Bath recovery %: before %, after %, recovered %',r.recipient,r.progress,recovered,recovered-r.progress;
 end loop;
end;
$$;

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

  -- Incomplete rounds survive midnight. Only completed rounds restart next day.
  -- Completion timestamps and cumulative reward points survive the rollover.
  if p_recipient is null and p_action is null and p_round is null and p_stage is null and p_request is null then
    select * into hatch from heart_private.hatch_total where id=1;
    if not found then raise exception 'Hatching state is unavailable'; end if;
    select * into rose_room from heart_private.pet_bath_rooms where recipient='rose' for update;
    select * into praew_room from heart_private.pet_bath_rooms where recipient='praew' for update;
    if rose_room.recipient is null or praew_room.recipient is null then raise exception 'Pet bath state is unavailable'; end if;
    if rose_room.completed_at is not null and (rose_room.completed_at at time zone 'Asia/Bangkok')::date<nowday then
      update heart_private.pet_bath_rooms
        set day=nowday,round=round+1,progress=0,completed_at=null,last_completed_at=coalesce(last_completed_at,completed_at)
        where recipient='rose' returning * into rose_room;
    elsif rose_room.day<nowday then
      update heart_private.pet_bath_rooms set day=nowday
        where recipient='rose' returning * into rose_room;
    end if;
    if praew_room.completed_at is not null and (praew_room.completed_at at time zone 'Asia/Bangkok')::date<nowday then
      update heart_private.pet_bath_rooms
        set day=nowday,round=round+1,progress=0,completed_at=null,last_completed_at=coalesce(last_completed_at,completed_at)
        where recipient='praew' returning * into praew_room;
    elsif praew_room.day<nowday then
      update heart_private.pet_bath_rooms set day=nowday
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
  if room.completed_at is not null and (room.completed_at at time zone 'Asia/Bangkok')::date<nowday then
    update heart_private.pet_bath_rooms
      set day=nowday,round=round+1,progress=0,completed_at=null,last_completed_at=coalesce(last_completed_at,completed_at)
      where recipient=p_recipient returning * into room;
    elsif room.day<nowday then
      update heart_private.pet_bath_rooms set day=nowday
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

  -- Incomplete rounds carry over across Bangkok days. `start` remains a
  -- compatibility action but never resets a room on the same day.
  if p_action='help' and room.progress<500000 then
    room.progress:=room.progress+1;
    if room.progress=500000 then
      room.completed_at:=nowtime;
      room.last_completed_at:=nowtime;
      inserted_day:=null;
      insert into heart_private.pet_bath_reward_ledger(recipient,day,points,awarded_at)
        values(p_recipient,nowday,20,nowtime)
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
