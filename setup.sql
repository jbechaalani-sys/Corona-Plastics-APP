-- ============================================================
--  Corona Plastics — Shift Log
--  DATABASE SETUP.  Run this whole file in the SQL Editor.
--  Safe to run again at any time; it will not lose data.
--  Afterwards, run add-staff.sql once to create the logins.
-- ============================================================

create extension if not exists pgcrypto;

-- ── Who works here ──────────────────────────────────────────
create table if not exists public.staff (
  id      uuid primary key references auth.users(id) on delete cascade,
  op_id   text unique not null,
  name    text        not null,
  role    text        not null default 'operator'
            check (role in ('operator','admin')),
  active  boolean     not null default true,
  created timestamptz not null default now()
);

-- ── Every record the app writes ─────────────────────────────
create table if not exists public.records (
  key        text primary key,
  owner      uuid references auth.users(id) on delete cascade,
  shared     boolean     not null default false,
  value      text        not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists records_key_prefix on public.records (key text_pattern_ops);
create index if not exists records_owner_idx  on public.records (owner);
create index if not exists records_shared_idx on public.records (shared) where shared;

-- ── Helpers ─────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff
                 where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.touch_record()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end; $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_record();

-- ── Row level security ──────────────────────────────────────
alter table public.staff   enable row level security;
alter table public.records enable row level security;

drop policy if exists staff_read   on public.staff;
drop policy if exists staff_write  on public.staff;
create policy staff_read  on public.staff for select to authenticated using (true);
create policy staff_write on public.staff for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists records_read   on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;

create policy records_read on public.records for select to authenticated
  using (shared or owner = auth.uid() or public.is_admin());
create policy records_insert on public.records for insert to authenticated
  with check (shared or owner = auth.uid() or public.is_admin());
create policy records_update on public.records for update to authenticated
  using  (shared or owner = auth.uid() or public.is_admin())
  with check (shared or owner = auth.uid() or public.is_admin());
create policy records_delete on public.records for delete to authenticated
  using (shared or owner = auth.uid() or public.is_admin());

-- ── Creating a login ────────────────────────────────────────
--  Dropped first: a return type cannot be changed in place, and
--  an earlier version of this function returned uuid.
drop function if exists public.add_staff(text, text, text, text);
drop function if exists public.add_staff(text, text, text);

create function public.add_staff(
  p_op_id text, p_name text, p_code text, p_role text default 'operator')
returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  uid  uuid := gen_random_uuid();
  mail text := lower(p_op_id) || '@corona.local';
begin
  if length(p_code) < 6 then
    raise exception 'Access code for % must be at least 6 digits', p_name;
  end if;
  if exists (select 1 from auth.users where email = mail) then
    raise exception 'An account for % already exists', p_op_id;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    mail, crypt(p_code, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
  );

  -- sign-in resolves the user through this row, not auth.users alone
  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), uid, uid::text, 'email',
    json_build_object('sub', uid::text, 'email', mail, 'email_verified', true)::jsonb,
    now(), now(), now()
  );

  insert into public.staff (id, op_id, name, role) values (uid, p_op_id, p_name, p_role);
  return p_name || ' added';
end; $$;

-- ── Start from a clean roster ───────────────────────────────
delete from public.staff;
delete from auth.identities
 where user_id in (select id from auth.users where email like '%@corona.local');
delete from auth.users where email like '%@corona.local';

select 'Setup complete. Now run add-staff.sql.' as next_step;
