-- Publish only an approved donation's public ID, never slip or account data.
create table public.heart_collection_events(id uuid primary key,approved_at timestamptz not null default clock_timestamp());
alter table public.heart_collection_events enable row level security;
revoke all on public.heart_collection_events from public,anon,authenticated;
grant select on public.heart_collection_events to anon,authenticated;
create policy collection_event_read on public.heart_collection_events for select to anon,authenticated using(true);
create function heart_private.publish_collection_approval() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.heart_collection_events(id) values(new.id) on conflict do nothing;
 return new;
end;
$$;
revoke all on function heart_private.publish_collection_approval() from public,anon,authenticated;
create trigger collection_approved_event after insert on heart_private.donations for each row execute function heart_private.publish_collection_approval();
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.heart_collection_events; end if; end $$;
