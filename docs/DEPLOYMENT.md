# Deployment and Operations

## Required services
- Supabase project (Postgres, Auth, Realtime, optional Edge Functions/cron).
- Frontend hosting such as Vercel.
- A trusted scheduled mechanism for auction deadline finalization.

## Environment
`.env.example` should contain only variable names and safe placeholders. Typical browser values:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```
Use current Supabase key conventions in the project dashboard. Never put a service-role key in frontend variables. Server-side secrets belong in Supabase Function secrets or the hosting provider's server-side environment.

## Deploy steps
1. Create a Supabase project.
2. Configure authentication/guest identity model.
3. Apply migrations in order using Supabase CLI or SQL migration workflow.
4. Configure required server-side functions and secrets.
5. Configure and test scheduled timer finalization.
6. Set frontend environment variables in local `.env.local` and deployment dashboard.
7. Install dependencies and run lint/typecheck/tests/build.
8. Deploy frontend and configure SPA routing if required.
9. Open the public URL on two separate devices and perform the manual test in TESTING.md.
10. Check logs and database state for errors; do not log secrets.

## Local PowerShell setup
```powershell
npm install
Copy-Item .env.example .env.local
# Edit .env.local privately
npm run dev
```
Production-like preview:
```powershell
npm run build
npm run preview
```

## Operations
- Keep migrations in version control.
- Back up production data before destructive changes.
- Never edit applied migrations; create a new migration.
- Monitor function errors, database limits and realtime connections.
- Document incident recovery and how to pause/close an auction safely.
- If the timer scheduler is unavailable, fail visibly and alert the host; do not silently rely on an open browser.

## Timer scheduler (pg_cron) — required for server-side expiry
Enable the `pg_cron` extension (Dashboard → Database → Extensions), then run once in the SQL editor:
```sql
select cron.schedule('finalize-expired-lots', '5 seconds', $$select public.finalize_expired_lots()$$);
```
(Sub-minute schedules need a recent pg_cron; otherwise use `'* * * * *'` plus the `sync_room` fallback, which any room member's client calls once the server deadline has passed. The server always decides: both paths run the same idempotent `finalize_lot`.)
Check it runs: `select * from cron.job_run_details order by start_time desc limit 5;`
Also enable **Authentication → Providers → Anonymous sign-ins**. Rollback: `select cron.unschedule('finalize-expired-lots');` and restore the DB from backup; never edit an applied migration.
