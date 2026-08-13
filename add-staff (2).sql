-- ============================================================
--  Corona Plastics — create the logins. Run this ONCE,
--  after setup.sql. Change the codes before you use it.
--
--    add_staff( id , name , 6-digit code , role )
-- ============================================================

select public.add_staff('admin', 'Administrator', '900142', 'admin');

select public.add_staff('op01', 'Tauhed',     '104813');
select public.add_staff('op02', 'Bandi',      '109626');
select public.add_staff('op03', 'Raja',       '114439');
select public.add_staff('op04', 'Sunar',      '119252');
select public.add_staff('op05', 'Harish',     '124065');
select public.add_staff('op06', 'Deepak',     '128878');
select public.add_staff('op07', 'Allem',      '133691');
select public.add_staff('op08', 'Dileep',     '138504');
select public.add_staff('op09', 'Navas',      '143317');
select public.add_staff('op10', 'Pavan',      '148130');
select public.add_staff('op11', 'Anhiram',    '152943');
select public.add_staff('op12', 'Mahalingam', '157756');
select public.add_staff('op13', 'Younus',     '162569');
select public.add_staff('op14', 'Extra 1',    '167382');
select public.add_staff('op15', 'Extra 2',    '172195');

-- check it worked
select op_id, name, role, active from public.staff order by role desc, name;
