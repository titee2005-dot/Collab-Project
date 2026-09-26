-- Close new donation intake after the event. Preserve accounts, existing
-- orders, review access, memories, and all collected hearts.
update heart_private.settings
set data=jsonb_set(data,'{receivingEnabled}','false'::jsonb,true)
where id=1;
