-- Replace all empty strings with verified recipient details before running.
-- This intentionally keeps receiving disabled.
update heart_private.settings
set data=jsonb_set(jsonb_set(data,'{accounts}',jsonb_build_object(
 'rose',jsonb_build_object('bankCode','','bankName','','accountName','','accountNumber',''),
 'praew',jsonb_build_object('bankCode','','bankName','','accountName','','accountNumber','')
)),'{receivingEnabled}','false')
where id=1;
-- Do not enable until both accounts and admin access have been checked.
