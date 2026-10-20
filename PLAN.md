# Project Plan

Status legend: `[ ]` not started, `[~]` written but NOT RUN/verified, `[x]` completed and verified, `[!]` blocked/needs attention. Do not mark a task complete without evidence.

## Phase 0 — Inspect and plan
- [x] Inspect repository and existing changes. (Docs-only starter, 16 files, no source, no git repo, no migrations.)
- [x] Confirm Node/npm versions and package manager. (Node v22.22.2, npm 10.9.7, git 2.43.0; no package.json yet, so npm is the default.)
- [x] Read all project docs.
- [ ] Confirm app name/branding and default auction rules.
- [x] Record unresolved decisions without blocking safe progress.

## Phase 1 — Foundation
- [~] Scaffold React + TypeScript + Vite. (files written; `npm install` NOT RUN: no network)
- [~] Configure Tailwind, routing, lint, formatting and strict TypeScript. (configs written; lint/tsc NOT RUN)
- [~] Add environment validation and `.env.example`. (zod validation in src/lib/env.ts)
- [~] Add shared UI primitives, responsive shell, loading/error/empty states.
- [~] Add unit-test setup and scripts. (Vitest config + auction/csv tests written; NOT RUN)

## Phase 2 — Database and access control
- [~] Create versioned Supabase migrations.
- [~] Create profiles/participants, rooms, teams, players, bids, purchases and event/audit records. (no profiles table: guests use anonymous Auth + participants)
- [~] Add constraints, indexes and database functions.
- [~] Implement deny-by-default RLS policies. (SELECT-only for members; no write policies. NOT tested against Postgres)
- [~] Add explicit development seed script and sample CSV. (CSV template only: supabase/seed/players_template.csv; no SQL seed yet)
- [ ] Verify migration from an empty database.

## Phase 3 — Room lifecycle
- [~] Create room with secure unique code. (create_room RPC, gen_random_bytes, collision loop)
- [~] Join/leave room and handle duplicate nicknames safely. (join works; no leave action yet)
- [~] Host permissions and participant list.
- [~] Claim/assign team with concurrency-safe uniqueness. (claim/release; host assign-to-other NOT implemented)
- [ ] Persist settings and lobby state.
- [ ] Test invalid/full/closed room cases.

## Phase 4 — Auction engine
- [~] Implement server-side start/pause/resume/skip/unsold/sold transitions.
- [~] Implement atomic bid validation and insertion.
- [~] Enforce purse, increments, team membership and roster constraints.
- [~] Store server-side deadlines and authoritative event ordering.
- [~] Implement trusted timer expiry/finalization mechanism. (finalize_expired_lots + pg_cron doc + sync_room fallback; scheduler not configured)
- [~] Add idempotency and auditability.

## Phase 5 — Realtime UX
- [~] Subscribe to authorized room changes.
- [~] Update bids, timer display, purses, squads and status without refresh.
- [~] Reconnect by fetching a fresh snapshot then resubscribing.
- [~] Handle duplicate/out-of-order events and disconnected status.
- [ ] Test two browsers/devices in one room.

## Phase 6 — Product experience
- [~] Landing/create/join pages.
- [~] Lobby and host settings. (settings set at creation only; no edit screen)
- [~] Live auction screen and bid history.
- [ ] Team/squad dashboard and final results.
- [~] Player management and CSV import/export. (import only; export, edit and remove NOT implemented)
- [ ] Mobile accessibility, keyboard controls and reduced motion.

## Phase 7 — Quality and security
- [~] Unit tests for auction rules. (written, NOT RUN)
- [ ] Integration tests for RPC/functions and RLS.
- [ ] E2E tests for create/join/bid/sold/reload.
- [ ] Test simultaneous bids and expired timers.
- [ ] Test unauthorized access and private-room isolation.
- [ ] Run lint, typecheck, tests and production build.
- [ ] Review bundle, errors, logs and secrets.

## Phase 8 — Deployment
- [ ] Apply migrations to the intended Supabase project.
- [ ] Configure production environment variables securely.
- [ ] Deploy frontend.
- [ ] Configure server-side timer scheduling and verify it.
- [ ] Smoke-test with two separate devices on the public URL.
- [ ] Document rollback and recovery steps.

## Final release gate
- [ ] No hardcoded runtime auction data.
- [ ] No fake/mock bidding path in production.
- [ ] No service-role key in frontend bundle.
- [ ] Server-side bid validation and timer expiry verified.
- [ ] Two-device real-time flow verified.
- [ ] README and deployment docs match actual implementation.
- [ ] Final report lists verified features and known limitations.

## Phase 0 findings (recorded from actual inspection)

### Environment prerequisites
- NOT AVAILABLE in the build sandbox: outbound network (npm registry unreachable), `psql`/PostgreSQL, Docker, Supabase CLI.
- Consequence: `npm install`, lint, typecheck, Vitest, Playwright, `vite build` and SQL migration/RLS/concurrency tests are NOT RUN until network access (or a local toolchain) exists.
- Needed from the project owner (never paste secrets into chat): a Supabase project URL + anon/publishable key, and database access for applying migrations.

### Unresolved decisions (safe defaults proposed, not blocking)
- App name/branding: proposed original working name "Stumped Bid" (placeholder; easy to rename).
- Guest identity: Supabase Anonymous Auth (server-issued JWT, no nickname-as-authority). Requires "Anonymous sign-ins" enabled in the Supabase dashboard.
- Timer finalization: pg_cron (every 5s via pg_net/Edge Function or direct SQL function) plus a host-triggered `finalize_expired` fallback, as documented in docs/DEPLOYMENT.md. Needs pg_cron enabled on the Supabase project.
- Host bidding policy: host may bid only if they own a team (explicit rule).
- Viewers: disabled by default; host toggle in room settings.

## Build log — session 1 (nothing below was executed; sandbox has no network/Postgres)
| Check | Result |
|---|---|
| npm install / lint / typecheck / vitest / build | NOT RUN (npm registry unreachable) |
| Migration applied to empty Postgres | NOT RUN |
| RLS isolation, concurrent bids, expiry finalization | NOT RUN |
| Playwright E2E, two-device test | NOT RUN |
| Static sanity (balanced `$$`, brace/paren counts) | see terminal output; this is not a real compile |

### Known gaps / next steps
- Add a SQL integration test suite (pgTAP or Vitest against local Supabase) for RLS, place_bid races, finalize idempotency.
- Playwright config + e2e, final results screen, CSV export, player edit/remove, host assign team to participant, leave-room, per-user bid rate limit, SQL dev seed.
- `import_players` skips duplicate names silently; surface the skipped count.
- Verify `into part.id` assignment in join_room and pg_cron seconds syntax on the target Postgres.
