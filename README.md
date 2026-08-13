# Corona Plastics — Shift Log

Daily production record for the Dubai warehouse. One page, fourteen sections,
installable to a tablet home screen.

## Setting it up

### 1. Create the database

Sign up at **supabase.com** (free tier is enough) and create a project.
Open **SQL Editor**, paste the whole of `setup.sql`, and run it.
It is safe to run again later — it will not lose data.

### 2. Add your people

Still in the SQL editor, one line per person. Codes must be **6 digits** —
Supabase rejects anything shorter, and 6 digits is a hundred times harder to
guess than 4.

```sql
select public.add_staff('admin', 'Administrator', '900142', 'admin');
select public.add_staff('op01',  'A. Rahman',     '110234');
select public.add_staff('op02',  'M. Farooq',     '220518');
-- …one per operator
```

To change someone's code later, use **Authentication → Users** in Supabase.
To remove someone, set `active = false` in the `staff` table rather than
deleting them — their history stays intact.

### 3. Point the app at it

**Project Settings → API** gives you two values. Put them in `config.js`:

```js
window.CORONA_CONFIG = {
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi…',
  CODE_LENGTH: 6
};
```

The anon key is safe to publish — row level security is what protects the
data, not the key.

### 4. Put it online

Drag this folder onto **vercel.com/new** or **app.netlify.com/drop**.
You get an HTTPS address in under a minute.

On the tablet, open that address, then **Share → Add to Home Screen**.
It runs fullscreen with the Corona crown as its icon, and keeps working if
the wifi drops.

## How the data is protected

- Operators can read and write **only their own records**
- Shared lists — schedule, store, pending work, purchase orders, targets —
  are readable and writable by everyone signed in
- Admin can read and write everything
- All of this is enforced by Postgres, not by the browser, so it holds even
  if someone opens the developer tools

## Still to do

- **Purchase Orders code** is still in the file (`PO_CODE`). Move it to the
  staff table if that section needs real protection.
- **Attachments** — quality reports, scrap reports, purchase orders and
  sample photos — are stored as text in the database. That works, but
  Supabase Storage is the proper home for files and would lift the 2 MB cap.
- **Backups.** Supabase keeps daily backups on paid plans only. On free,
  export what matters monthly using the Excel downloads.
