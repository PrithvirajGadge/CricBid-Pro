# Database Model (Implementation Specification)

Use UUID primary keys, `timestamptz` timestamps, foreign keys, indexes, and check constraints where applicable. Finalize exact SQL in versioned migrations.

## Core tables
### profiles
- `id` references authenticated user ID where accounts are used
- `display_name`, `created_at`, `updated_at`
- Never use a client-supplied profile ID as proof of identity.

### rooms
- `id`, unique short `code`, `host_user_id` or securely bound host identity
- `name`, `status` (lobby/active/paused/completed/closed)
- `settings` JSONB only for non-relational configuration, validated server-side
- `created_at`, `updated_at`, `version`

### participants
- `id`, `room_id`, optional `user_id`, `display_name`
- `role` (host/participant/viewer), `connection/last_seen` if implemented
- `joined_at`, `left_at`, `status`
- Unique constraints prevent duplicate active membership/team ownership as appropriate.

### teams
- `id`, `room_id`, `name`, optional `short_name`/`color`
- `owner_participant_id` nullable
- `initial_purse`, `remaining_purse`, `roster_limit`
- `created_at`
- Enforce one owner per team and one team per participant within a room.

### players
- `id`, optional global catalogue/source ID, `room_id` or catalogue ownership model
- `name`, `role`, `nationality`, `base_price`, `image_url` nullable
- `status` (upcoming/live/sold/unsold/removed)
- `created_at`, `updated_at`
- Player details are database-backed. Imported data must be validated.

### auction_state / lots
- `room_id`, `current_player_id`, `status`, `deadline_at`, `current_bid`, `leading_team_id`, `leading_participant_id`, `event_sequence`, `updated_at`
- Ensure only one active lot per room. A normalized `auction_lots` table may be used if the design needs multiple lots/history.

### bids
- `id`, `room_id`, `player_id`, `team_id`, `participant_id`
- `amount`, server-generated `created_at`, `sequence`, `idempotency_key`
- Append-only for accepted bids; index by room/player/sequence.
- Unique idempotency constraint where appropriate.

### purchases / purse_ledger
- `id`, `room_id`, `player_id`, `team_id`, `winning_bid`, `created_at`
- A ledger row records each purse debit/refund with reason and unique source event.
- A player may be purchased at most once per auction.

### auction_events / audit_log
- `id`, `room_id`, `sequence`, `event_type`, safe payload, `created_at`, actor ID
- Avoid sensitive data. Events must not be treated as client-authoritative commands.

## Required integrity
- Use transactions for bid acceptance and sale finalization.
- Check nonnegative purse and allowed bid increments.
- Prevent duplicate sales, duplicate active lots and duplicate team ownership.
- Use foreign keys and indexes.
- Protect room rows and private events through RLS/authorization.
- Decide whether guest mode uses short-lived secure sessions, anonymous Auth, or server-issued signed guest identities; do not trust a nickname alone for host privileges.
- Do not expose service-role credentials in the browser.

## Migration rules
- Keep every schema change in a new migration.
- Do not edit an already-applied production migration; create a corrective migration.
- Include rollback notes when safe. Backups are required before destructive production changes.
