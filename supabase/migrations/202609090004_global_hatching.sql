create table heart_private.hatch_total(id int primary key check(id=1),rose int not null default 0 check(rose between 0 and 100000),praew int not null default 0 check(praew between 0 and 100000));
insert into heart_private.hatch_total(id) values(1);
create table heart_private.hatch_clients(id uuid primary key,seq bigint not null,rose int not null,praew int not null,updated_at timestamptz not null);
alter table heart_private.hatch_total enable row level security;
alter table heart_private.hatch_clients enable row level security;
revoke all on heart_private.hatch_total,heart_private.hatch_clients from public,anon,authenticated;
create table public.heart_hatching(id int primary key check(id=1),rose int not null,praew int not null,updated_at timestamptz not null);
insert into public.heart_hatching values(1,0,0,clock_timestamp());
alter table public.heart_hatching enable row level security;
revoke all on public.heart_hatching from public,anon,authenticated;
grant select on public.heart_hatching to anon,authenticated;
create policy hatch_public_totals on public.heart_hatching for select to anon,authenticated using(true);
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.heart_hatching; end if; end $$;
create function public.heart_hatch(p_client uuid default null,p_seq bigint default 0,p_rose int default 0,p_praew int default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t heart_private.hatch_total%rowtype;c heart_private.hatch_clients%rowtype; nowtime timestamptz:=clock_timestamp();
begin
 if p_client is null and p_seq=0 and p_rose=0 and p_praew=0 then
  select * into t from heart_private.hatch_total where id=1;
  return jsonb_build_object('rose',t.rose,'praew',t.praew);
 end if;
 if p_client is null or p_seq is null or p_seq<1 or p_seq>1000000000 or p_rose is null or p_praew is null or p_rose<0 or p_praew<0 or p_rose+p_praew not between 1 and 100 then raise exception 'Invalid click batch'; end if;
 select * into t from heart_private.hatch_total where id=1 for update;
 select * into c from heart_private.hatch_clients where id=p_client;
 if found then
  if p_seq=c.seq and p_rose=c.rose and p_praew=c.praew then return jsonb_build_object('rose',t.rose,'praew',t.praew); end if;
  if p_seq<>c.seq+1 then raise exception 'Invalid batch sequence'; end if;
  if nowtime<c.updated_at+interval '1800 milliseconds' then raise exception 'Please retry after 2 seconds'; end if;
 elsif p_seq<>1 then raise exception 'Invalid initial sequence'; end if;
 update heart_private.hatch_total set rose=least(100000,rose+p_rose),praew=least(100000,praew+p_praew) where id=1 returning * into t;
 insert into heart_private.hatch_clients values(p_client,p_seq,p_rose,p_praew,nowtime) on conflict(id) do update set seq=excluded.seq,rose=excluded.rose,praew=excluded.praew,updated_at=excluded.updated_at;
 -- One global realtime event at most every two seconds, regardless of active players.
 update public.heart_hatching set rose=t.rose,praew=t.praew,updated_at=nowtime where id=1 and updated_at<=nowtime-interval '2 seconds' and (rose<>t.rose or praew<>t.praew);
 return jsonb_build_object('rose',t.rose,'praew',t.praew);
end;
$$;
revoke all on function public.heart_hatch(uuid,bigint,int,int) from public;
grant execute on function public.heart_hatch(uuid,bigint,int,int) to anon,authenticated;
