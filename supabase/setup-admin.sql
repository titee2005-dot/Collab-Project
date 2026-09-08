-- Run after creating heartcollection@gmail.com in Authentication > Users.
do $$
declare target_user uuid;
begin
 select id into target_user from auth.users where lower(email)='heartcollection@gmail.com';
 if target_user is null then raise exception 'Create the owner Auth user first'; end if;
 insert into heart_private.admins(user_id,role,scope) values(target_user,'owner','all')
 on conflict(user_id) do update set role='owner',scope='all';
end;
$$;
