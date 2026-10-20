# MASTER BUILD PROMPT — REAL-TIME CRICKET AUCTION

You are a senior full-stack engineer, product designer, database engineer, and QA engineer. Build a production-minded, genuinely working multiplayer cricket player auction web application inspired by the *type of experience* on https://crickauction.in/. Do not copy its proprietary source code, branding, images, or exact visual identity. Create an original brand and design.

## Non-negotiable outcome
Deliver a functioning application, not a static mockup. Friends on separate phones/laptops must be able to join the same room and see valid bids, player status, timer state, team purses, and squads update in real time without refreshing. Persistent state must survive reloads and reconnects.

## Stack
- React + TypeScript + Vite
- Tailwind CSS; use accessible reusable components
- Supabase Auth, PostgreSQL, Row Level Security, Realtime
- Server-authoritative operations through Supabase Postgres RPC functions and/or Supabase Edge Functions. Never trust client-calculated prices, purse values, winner selection, role, or timer expiry.
- Vitest + React Testing Library for unit/component tests; Playwright for end-to-end multiplayer flows where practical.
- Deploy frontend to Vercel or another static hosting provider; Supabase hosts database/auth/realtime/functions.

## Before coding
1. Inspect the existing repository and package manager. Do not overwrite working files blindly.
2. Read AGENTS.md, PLAN.md, PRD.md, ARCHITECTURE.md, DATABASE.md, AUCTION_RULES.md, SECURITY.md, TESTING.md, and DEPLOYMENT.md.
3. Summarize the implementation plan and identify missing credentials/configuration. Never ask the user to paste secrets into chat.
4. Implement in small, verifiable milestones. Keep PLAN.md checkboxes current.
5. If there is no existing app, scaffold it. If an app exists, adapt it without destroying unrelated work.

## Product requirements
- Landing page with create room / join room flows.
- Host can create a private auction room with a short unique room code, configurable rules, budget, bid increment, team count, squad size and player pool.
- Users can join with nickname and room code. Support optional account login if needed for persistence and host privileges; guest identity must not allow impersonation or privilege escalation.
- Lobby shows connected participants, team selections and host controls.
- Host can assign teams or let participants claim available teams, with no duplicate team ownership.
- Player database is persisted in PostgreSQL, editable/importable by authorized host, and not hardcoded into UI source. Provide CSV import/export with validation and a starter CSV template.
- Live auction view shows current player, role, nationality if available, base price, current bid, leading team/bidder, bid controls, server deadline/countdown, bid history, team purses, squad counts and connection status.
- Host can start/pause/resume/close an auction, skip a player, mark unsold, and conduct a re-auction according to configured rules.
- Sold/unsold outcomes, bids, teams and purse ledger are persisted. Reloading must restore the correct state.
- Show errors clearly: room invalid/full, team unavailable, bid too low, insufficient purse, auction closed, timer expired, disconnected, or action unauthorized.
- Mobile-first responsive design, keyboard accessible controls, reduced-motion support, loading/empty/error states, and clear confirmations for destructive host actions.
- Provide demo seed data only through an explicit seed script/migration. Runtime pages must fetch data from the database; do not embed fixed players, bids, room codes, purses, timers, participants, or auction results as UI data.

## Realtime and correctness requirements
- Database/server is the source of truth. Client state is a projection/cache, not authority.
- Every bid is sent to a server-authoritative function. Validate room membership, room status, auction status, current player, bid increment, current deadline, team ownership, purse and minimum remaining-squad obligations.
- Serialize competing bids using a database transaction and row locks or equivalent concurrency-safe logic. A valid bid must be accepted/rejected atomically; never use a client-side read-then-write sequence as the only validation.
- Store accepted bids with server-generated timestamps and a monotonically increasing sequence or equivalent ordering.
- Broadcast accepted changes via Supabase Realtime. Clients should subscribe to the room's authorized events and update UI without page refresh.
- Persist auction state and deadlines in the database. A browser interval is for display only; it must not decide whether a player is sold.
- A trusted server-side process must finalize expiry/sales. Use a scheduled function/cron or another documented server-side mechanism. If no scheduler is configured, provide an explicit safe host action and clearly document the limitation; never pretend a client timer is secure.
- Reconnect flow: resubscribe, fetch a fresh authorized room snapshot, then resume live updates. Deduplicate events and handle out-of-order or missed events.
- Avoid leaking private room data across rooms. Validate access on reads and writes with RLS and server-side checks.
- Handle duplicate requests with idempotency keys or equivalent where appropriate.

## Security
- Never expose the Supabase service-role key in frontend code or VITE_ variables.
- Include SQL migrations for schema, indexes, constraints, functions and RLS policies.
- RLS must deny by default. Verify room membership and host privileges on every sensitive action.
- Do not trust client-supplied user IDs, prices, role names, purse balances or timestamps.
- Rate-limit or otherwise protect room creation and bid submission where possible.
- Avoid storing unnecessary personal information. Do not add payments, gambling, real-money wagering or cash prizes.
- Document all secrets in `.env.example` by name only, with placeholder values.

## Design direction
Create an original, polished sports auction interface: dark stadium-inspired canvas, high-contrast typography, clear live status, readable player cards, visible budget numbers, restrained motion and responsive layouts. Use real images only when licensed/available; provide graceful placeholders. Do not use copyrighted logos or imply official IPL affiliation. Ensure the website still works if images fail.

## Engineering quality
- Strict TypeScript; no unexplained `any`.
- Keep UI components, domain logic, database access and realtime subscriptions separate.
- No fake buttons, dead links, TODO-only implementations, hardcoded successful API responses, localStorage as the authoritative shared database, or mock bidding in the production flow.
- Add validation, useful error messages, logs that do not expose secrets, loading states, and error boundaries.
- Use environment variables for credentials/configuration.
- Provide SQL migrations and a seed script separate from production data.
- Include tests for auction rules and concurrency-sensitive operations. If concurrency cannot be fully simulated in unit tests, provide a repeatable manual test procedure using two browsers/devices.

## Required deliverables
1. Working source code and complete package scripts.
2. All required Supabase migrations/functions and seed instructions.
3. `.env.example` with no real secrets.
4. README.md with exact Windows PowerShell and cross-platform setup commands.
5. All documentation files listed in this starter kit.
6. Unit/integration/E2E tests and instructions to run them.
7. Deployment guide, database migration steps, environment variable checklist and rollback notes.
8. A final implementation report listing features actually completed, commands/tests run, known limitations, and steps requiring the user's Supabase/Vercel credentials.

## Definition of done
Do not claim completion until:
- A clean install succeeds.
- TypeScript/build/lint/tests pass, or remaining failures are explicitly reported.
- Two separate browser sessions can join one room.
- A bid from browser A appears in browser B without refresh.
- Invalid/too-low/over-budget bids are rejected server-side.
- Two nearly simultaneous bids produce one consistent authoritative outcome.
- Sold players are assigned once, purse changes are correct, and state persists after reload.
- Expired timer behavior is enforced server-side, not just by a browser.
- Unauthorized users cannot control a room or read another private room's data.
- Deployment and configuration steps are documented.

Work in phases. At the end of each phase, run the relevant checks and update PLAN.md. If you cannot execute commands in the environment, say exactly what could not be verified; do not fabricate test results.
