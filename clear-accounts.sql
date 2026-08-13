-- ============================================================
--  Clear all Corona accounts so add-staff.sql can be run again.
--  Leaves the tables, policies and add_staff function in place.
-- ============================================================

delete from public.staff;
delete from auth.identities
 where user_id in (select id from auth.users where email like '%@corona.local');
delete from auth.users where email like '%@corona.local';

select count(*) as accounts_remaining
  from auth.users where email like '%@corona.local';
