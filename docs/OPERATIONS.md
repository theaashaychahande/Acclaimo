# Operations

Everything Acclaimo needs to run is free-tier friendly. This file is the setup
and maintenance checklist.

## 1. Apply the database migrations

The files in `supabase/migrations` must be applied in filename order. Either
link the project and push, or paste each file into the Supabase SQL editor:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create the tables, revoke direct access, add the public RPCs,
and create the private `templates` storage bucket.

## 2. Deploy the template upload function

Certificate images are uploaded by an Edge Function, not by the browser
directly. The function checks the organizer's edit-key hash, confirms the
category belongs to them, and writes to the private bucket with the service
role. Supabase provides `SUPABASE_SERVICE_ROLE_KEY` to the function
automatically; never copy it into Vercel or the repository.

```bash
npx supabase functions deploy upload-template --no-verify-jwt
```

JWT verification is off because Acclaimo does not use Supabase Auth. The
function performs its own edit-key check on every request, including draft
previews.

Acclaimo does not use Supabase Auth. In the dashboard, open Authentication →
Sign In / Providers and disable email signups and anonymous sign-ins. The last
migration already revokes default function privileges, so a new helper stays
private until it is granted explicitly.

## 3. Create the admin secret

The admin page is useless until `admin_config` has one row. Pick a long random
value (32 characters or more), hash it in the SQL editor, and never store the
plain value in the repository:

```sql
insert into public.admin_config (id, secret_hash)
values (true, encode(extensions.digest('REPLACE_WITH_A_LONG_RANDOM_SECRET', 'sha256'), 'hex'))
on conflict (id) do update
  set secret_hash = excluded.secret_hash,
      updated_at = now();
```

To rotate it later, run the same statement with a new secret. The page keeps
the secret in memory only, so a reload asks for it again.

## 4. Deploy the frontend to Vercel

1. Import the GitHub repository in Vercel.
2. Framework preset: Vite. Build command: `npm run build`. Output: `dist`.
3. Add environment variables in the Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

`vercel.json` already adds the React Router rewrite, HSTS, and a Content-Security
Policy that allows only the app itself, Google Fonts, and the Supabase project.
If you move to a custom Supabase domain, update `connect-src` and `img-src`.

The secret key and the database password never belong in Vercel. They are not
read by the frontend at all.

## 5. Keep the free project awake

Supabase pauses inactive free projects. `.github/workflows/keepalive.yml`
calls a harmless public RPC once a day. Add two repository secrets before
enabling it:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

The publishable key is safe in a public repository, but repository secrets keep
the workflow reusable by anyone who forks the project. The workflow runs with
`contents: read` and nothing else.

## 6. Schedule retention

Expired events are hidden immediately. To delete them after 90 days, enable
`pg_cron` once and schedule the cleanup function:

```sql
create extension if not exists pg_cron;

select cron.schedule(
  'acclaimo-cleanup',
  '0 3 * * *',
  $$select public.cleanup_expired(90);$$
);
```

Confirm it registered before moving on:

```sql
select jobid, schedule, active from cron.job where jobname = 'acclaimo-cleanup';
```

The function removes events, categories, and participant hashes. It also trims
`rate_limits` after one day and `lookup_streaks` after 30 days, so repeated
requests with random device ids cannot grow those tables forever. The SQL
function cannot remove Storage objects, so delete the template files for events
removed by cleanup through the Storage API or dashboard. Replacing an image
does remove the previous object automatically.

## 7. Routine checks

- Open `/admin` and check the organization list after a busy event.
- Open the designer, replace a test image, reload, and confirm the draft preview
  keeps the same name and position placement.
- Confirm the student link still works after changing an event's expiry.
- Watch the Supabase usage page: database size, storage, and bandwidth.
- Export the database before a pilot if the data matters. Free-plan backups are
  limited.
- Rotate the admin secret if a laptop is lost.
- If an organizer loses an edit key, issue a new one from `/admin` after
  checking their identity out of band. The old key stops working immediately.

## 8. Rotating a publishable key

If the publishable key is compromised, rotate it in the Supabase dashboard,
update `VITE_SUPABASE_ANON_KEY` in Vercel, and redeploy. The key is not a login;
the database rules are what keep data safe. Still, rotate it to stop abuse of
your project's quota.

Never put the secret key or the database password in a `VITE_` variable. Vite
inlines every `VITE_` value into the public JavaScript bundle.
