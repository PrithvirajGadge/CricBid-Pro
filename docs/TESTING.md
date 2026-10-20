# Testing Strategy

## Commands
The implementation should provide scripts such as:
```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```
Document any differences in the actual package scripts.

## Unit tests
- Minimum bid and increment rules.
- Purse affordability and roster capacity.
- Legal room/lot state transitions.
- Timer deadline comparisons.
- CSV validation and error reporting.
- Formatting and display helpers.

## Integration tests
- Create room and join with valid/invalid code.
- Team assignment is unique under concurrent claims.
- Valid bid is committed once.
- Invalid, stale, duplicate and over-budget bids are rejected.
- Two near-simultaneous bids produce a consistent ordered outcome.
- Sale finalization debits exactly once.
- Expired lots finalize even if host browser is closed.
- RLS blocks non-members and unauthorized mutations.
- Re-auction does not duplicate purchase/ledger entries.

## Manual two-device test
1. Open the deployed URL in two separate browsers/devices.
2. Create a room in browser A; join it from browser B using the room code.
3. Assign two different teams and start an auction.
4. Bid from A; verify B updates without refreshing.
5. Bid from B; verify A updates and the bid history order matches.
6. Submit a too-low or unaffordable bid; verify the server rejects it.
7. Reload one browser; verify the same current player, leader, purse and deadline are restored.
8. Disconnect the host browser; verify the server-side timer still finalizes.
9. Attempt a host action from a participant; verify it is denied.
10. Open a different room and verify no private data crosses rooms.

## Release gates
- Record actual command outputs/results.
- No fake test results or claims of concurrency guarantees without test evidence.
- Any skipped tests are listed as NOT RUN with the reason.

## Manual concurrency test (two browsers, repeatable)
1. Two members each own a team; start a lot. 2. In both browsers open devtools and prepare `await supabase.rpc('place_bid', {...})` with different idempotency keys and the SAME amount. 3. Fire both within the same tick (`Promise.all` in one tab using two sessions, or click simultaneously). 4. Expected: exactly one succeeds; the other gets `BID_TOO_LOW`/`ALREADY_LEADING`; `select count(*) from bids where player_id=...` shows strictly increasing `sequence`. 5. Replay one request with the same key: response has `replay: true`, no new row.
Status: **NOT RUN** (no database was available in the build sandbox).
