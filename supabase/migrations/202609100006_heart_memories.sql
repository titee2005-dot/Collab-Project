-- Bounded public reads of approved memories. No new donation records.
create view heart_private.approved_memories as
 select d.id,d.data->>'createdAt' as stamp,d.data->>'recipient' as recipient,d.data->>'heartType' as heart_type,(d.data->>'quantity')::bigint as quantity,
 jsonb_build_object('id',d.id,'status','approved','recipient',d.data->>'recipient','heartType',d.data->>'heartType','quantity',(d.data->>'quantity')::bigint,
 'anonymous',coalesce((d.data->>'anonymous')::boolean,false),'supporterName',case when coalesce((d.data->>'anonymous')::boolean,false) then 'A Mysterious Supporter' else d.data->>'supporterName' end,
 'socialUsername',case when coalesce((d.data->>'anonymous')::boolean,false) then '' else d.data->>'socialUsername' end,'message',d.data->>'message','createdAt',d.data->>'createdAt','approvedAt',d.data->>'createdAt','amount',d.data->'amount','source',d.data->>'source','memoryMilestones',d.data->'memoryMilestones','specialHeart',d.data->'specialHeart') as memory
 from heart_private.donations d join heart_private.orders o on o.id=d.id where o.data->>'status'='approved';
revoke all on heart_private.approved_memories from public,anon,authenticated;
create function public.heart_memories(p_recipient text default null,p_type text default null,p_search text default '',p_oldest boolean default false,p_cursor jsonb default null,p_ids uuid[] default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(memory order by case when p_oldest then stamp end asc,case when not p_oldest then stamp end desc,case when p_oldest then id end asc,case when not p_oldest then id end desc),'[]') from (
 select * from heart_private.approved_memories m where (p_recipient is null or recipient=p_recipient) and (p_type is null or heart_type=p_type)
 and (coalesce(p_search,'')='' or (not (memory->>'anonymous')::boolean and position(lower(left(p_search,100)) in lower(concat(memory->>'supporterName',' ',memory->>'socialUsername')))>0) or id::text=left(p_search,100))
 and (p_ids is null or id=any(p_ids[1:100]))
 and (p_cursor is null or case when p_oldest then (stamp,id::text)>(p_cursor->>'stamp',p_cursor->>'id') else (stamp,id::text)<(p_cursor->>'stamp',p_cursor->>'id') end)
 order by case when p_oldest then stamp end asc,case when not p_oldest then stamp end desc,case when p_oldest then id end asc,case when not p_oldest then id end desc limit 24) page;
$$;
create function public.heart_world(p_ids uuid[] default '{}') returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('groups',(select coalesce(jsonb_agg(g),'[]') from (select recipient,heart_type as "heartType",sum(quantity) as quantity from heart_private.approved_memories group by recipient,heart_type) g),
 'donations',(select coalesce(jsonb_agg(memory order by stamp,id),'[]') from (select * from heart_private.approved_memories where id=any(p_ids[1:100]) or id in(select id from (select id,row_number() over(partition by recipient order by stamp desc,id desc) as rank from heart_private.approved_memories) ranked where rank<=24)) recent));
$$;
revoke all on function public.heart_memories(text,text,text,boolean,jsonb,uuid[]),public.heart_world(uuid[]) from public;
grant execute on function public.heart_memories(text,text,text,boolean,jsonb,uuid[]),public.heart_world(uuid[]) to anon,authenticated;
-- Updates/deletions use the same realtime channel as approvals; clients refresh silently.
create function heart_private.publish_memory_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- The initial credit already emitted INSERT in this transaction.
 if TG_TABLE_NAME='orders' and old.data->>'status'='pending' and new.data->>'status'='approved' then return null; end if;
 update public.heart_collection_events set approved_at=clock_timestamp() where id=old.id;
 return null;
end; $$;
revoke all on function heart_private.publish_memory_change() from public,anon,authenticated;
create trigger memory_changed after update or delete on heart_private.donations for each row execute function heart_private.publish_memory_change();
create trigger memory_status_changed after update on heart_private.orders for each row when (old.data->>'status' is distinct from new.data->>'status') execute function heart_private.publish_memory_change();
