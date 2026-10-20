# Auction Rules and State Machine

## Suggested defaults (make configurable)
- Currency: virtual purse, default ₹100 crore per team.
- Bid increment: configurable, default ₹0.25 crore or another host-selected amount.
- Team count: configurable.
- Roster size and role limits: configurable or disabled unless explicitly enabled.
- One active player/lot per room.
- No real-money transactions or wagering.

## State machine
Room: `lobby -> active <-> paused -> completed`; host may close according to documented rules.
Player/lot: `upcoming -> live -> sold | unsold`; unsold may return to upcoming only through an explicit re-auction action.

## Bid acceptance
A bid is valid only if:
1. Room is active and the caller is an active participant with an assigned team.
2. Caller has permission to bid; host bidding policy is explicit.
3. The current player/lot is live and the authoritative server deadline has not passed.
4. Amount is at least the current minimum legal bid, following the configured increment.
5. Team has sufficient purse and roster capacity.
6. Bid is not a duplicate retry and does not violate room rules.

The server validates all conditions inside a transaction after locking the authoritative row. A client check is only a usability hint.

## Tie/concurrency policy
- Database transaction serialization determines the accepted order.
- Each accepted bid gets a server sequence and timestamp.
- If a bid arrives after the deadline, reject it even if a client countdown still displays time.
- Document the exact policy for simultaneous requests; never display two winning bids.

## Finalizing a lot
- A trusted backend worker checks the deadline and current committed bid.
- If there is a leading valid bid, atomically record sale, debit purse, update player status and create purchase/ledger/audit rows.
- If there is no valid bid, mark unsold.
- The finalizer must be idempotent: repeated scheduled runs cannot sell or debit twice.
- Broadcast the committed result after transaction completion.

## Host controls
- Start, pause, resume, skip, mark unsold, close and re-auction.
- Every control is authorized server-side and recorded in the audit trail.
- Pause/resume updates the stored deadline safely; no client may set an arbitrary deadline.
