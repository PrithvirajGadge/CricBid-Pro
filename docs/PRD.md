# Product Requirements Document (PRD)

## 1. Product vision
An original, mobile-first cricket auction platform where friends create a private room, join from separate devices, draft teams, and auction players with live synchronized bidding.

## 2. Target users
- Host: creates and configures the room, controls auction lifecycle.
- Participant: joins a room, selects/receives a team, places bids and views squads.
- Optional viewer: may view a room only if the host enables that permission.

## 3. MVP scope
1. Landing page and create/join room.
2. Private room code, lobby and participant presence.
3. Configurable number of teams, purse, minimum increment, squad limit and player pool.
4. Host-managed teams and player data; CSV import/export.
5. Real-time auction screen with player, current bid, leader, timer, bid history and budgets.
6. Server-validated bids, sold/unsold outcomes and purse ledger.
7. Team squad dashboard and final results.
8. Persistent state and safe reconnection.
9. Responsive mobile/desktop UI.
10. Secure database permissions and automated tests.

## 4. User stories and acceptance criteria
### Create room
As a host, I can create a room with settings and receive a unique code. A collision must be handled safely. Only the host can change settings or control the auction.

### Join room
As a participant, I can join with a room code and nickname. Invalid, closed, or full rooms show a helpful error. Team assignment must not allow two participants to own the same team.

### Bid
As a participant with a team, I can submit a bid. The server checks room membership, active player, auction state, deadline, bid increment, purse and squad constraints. A valid bid is saved once and broadcast; invalid bids are rejected with a clear reason.

### Timer
All clients display a timer derived from a server-owned deadline. Browser timers are display-only. The backend finalizes expiry; a hidden tab or disconnected host must not prevent expiry.

### Sell player
When a player is sold, one authoritative transaction records the winning team, final price, purse debit, player status and event. No player can be sold twice.

### Reconnect
After a reload/network interruption, the client fetches the latest authorized snapshot, resumes subscriptions, and does not show stale bid state as authoritative.

### Player data
Players come from the database or authorized import. UI source code must not contain the runtime player list.

## 5. Out of scope for MVP
- Real-money payments, gambling, betting, cash prizes.
- Official league affiliation or official logos.
- Voice/video calls.
- Native mobile apps.
- AI-generated player valuations.
- Public matchmaking at scale.

## 6. UX requirements
- Clear LIVE/PAUSED/SOLD/UNSOLD status.
- Prominent bid and purse numbers.
- Loading, no-data, disconnected and error states.
- Confirmation for irreversible host actions.
- Keyboard accessible controls, readable contrast and reduced motion.
- Useful mobile layout without horizontal scrolling.

## 7. Success metrics for a test release
- Two independent browsers can complete a room-to-auction flow.
- Accepted bids appear without refresh.
- Invalid bids are rejected consistently.
- Reload/reconnect restores current state.
- No unauthorized user can mutate room state.
- Build, tests and deployment smoke test pass.
