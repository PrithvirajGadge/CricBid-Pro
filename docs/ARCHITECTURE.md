# Architecture

## Components
- Browser client: React/TypeScript UI, routing, local presentation state and Supabase client.
- Supabase Auth: user identity where account sign-in is enabled.
- PostgreSQL: authoritative rooms, participants, teams, players, bids, purchases and deadlines.
- Server-authoritative operations: Postgres RPC functions and/or Edge Functions; validate permissions and execute state transitions transactionally.
- Supabase Realtime: broadcast/subscribe to authorized committed changes.
- Trusted timer worker: scheduled Edge Function/cron or another server-side scheduler finalizes expired lots.
- Hosting: Vercel or equivalent for the frontend.

## Bid flow
1. User clicks Bid.
2. Client calls a server-authoritative RPC/Edge Function with room, team, amount and idempotency key.
3. Server validates identity, membership, role, auction state, current player, deadline, increment, purse and squad rules.
4. A transaction locks the relevant auction/room row and validates again against current committed state.
5. Server inserts the bid and updates authoritative current bid/leader/sequence in the same transaction.
6. Committed change is broadcast through Realtime.
7. Each client updates its projection. It must not infer that a bid succeeded before the server confirms it.

## Timer flow
- Store `deadline_at` using server time.
- Client derives remaining display time from server deadline and current time; do not write every countdown tick to the database.
- A trusted scheduled worker finalizes a lot after deadline with a transaction and idempotent state transition.
- Host/browser disconnection must not stop expiry.
- Define a documented scheduling mechanism and test it in production-like conditions.

## Reconnect flow
- Mark connection state as connecting/connected/reconnecting in UI.
- On reconnect, fetch an authorized room snapshot from the database.
- Subscribe to changes, then reconcile by event sequence/version to avoid missed or duplicate updates.
- If events arrive out of order, prefer authoritative versioned state and refetch when a gap is detected.

## Suggested application layers
- `src/features/rooms/`
- `src/features/lobby/`
- `src/features/auction/`
- `src/features/teams/`
- `src/features/players/`
- `src/components/`
- `src/lib/supabase/`
- `src/lib/validation/`
- `src/types/`
- `supabase/migrations/`
- `supabase/functions/`
- `tests/`

## Key tradeoffs
Supabase Realtime is for delivery, not authorization or correctness. Database transactions/RPCs provide correctness; RLS protects reads and direct access; trusted server-side functions handle lifecycle tasks. Realtime events can be delayed or missed, so clients must support snapshot reconciliation.
