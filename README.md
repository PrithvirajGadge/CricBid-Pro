# Cricket Auction — Real-time Multiplayer

A full-stack, private-room cricket player auction app. Source is implemented but **unverified**: see the Build log in `PLAN.md` for what has and hasn't been run.

## Intended stack
React, TypeScript, Vite, Tailwind CSS, Supabase Auth/Postgres/Realtime, server-authoritative Postgres RPC/Edge Functions, Vitest and Playwright.

## Prerequisites
- Node.js LTS and npm
- Git
- A Supabase project
- Optional deployment account (e.g. Vercel)

## Setup (after implementation)
```powershell
# From the project root
npm install
Copy-Item .env.example .env.local
# Edit .env.local with your own project values
npm run dev
```
For a production-like local preview:
```powershell
npm run build
npm run preview
```

## Configuration
See `.env.example` and `docs/DEPLOYMENT.md`. Never place a Supabase service-role key in browser-visible variables. Only public/anon keys intended for browser use belong in `VITE_` variables.

## Database
Apply `supabase/migrations/*.sql` (Supabase CLI: `supabase db push`, or paste into the SQL editor). Enable Anonymous sign-ins and pg_cron (see `docs/DEPLOYMENT.md`). Tests: `npm run test` (unit), `npm run lint`, `npm run typecheck`.

Apply version-controlled migrations in order. Never use a production database as a scratchpad. Seed demo players only in development or through a deliberate host import.

## Project docs
- `MASTER_BUILD_PROMPT.md`: full implementation brief for an AI coding agent.
- `PLAN.md`: phased roadmap and completion checklist.
- `docs/PRD.md`: user stories and product requirements.
- `docs/ARCHITECTURE.md`: system architecture and realtime flow.
- `docs/DATABASE.md`: data model expectations.
- `docs/AUCTION_RULES.md`: authoritative auction rules.
- `docs/SECURITY.md`: threat model and access controls.
- `docs/TESTING.md`: automated/manual test strategy.
- `docs/DEPLOYMENT.md`: deployment and operations.

## Important
This starter is not a deployed website. A working production application requires implementation, Supabase project configuration, database migrations, secrets configured privately, testing and deployment.
