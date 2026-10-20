# Security and Threat Model

## Protect against
- Participant impersonation or forged user IDs.
- Non-members reading private room state.
- Participants changing purse, leader, player status or timer directly.
- Bids below the increment, above budget, after expiry or for the wrong player.
- Duplicate submissions and simultaneous bid races.
- Host-only actions by ordinary participants.
- Service-role key leakage.
- Room-code guessing, spam room creation and bid flooding.
- Malicious CSV content, unsafe URLs and untrusted imported fields.

## Required controls
- RLS enabled on every exposed table, deny by default.
- RLS policies verify membership and permitted role for every room-specific read/write.
- Sensitive state transitions happen only in server-side functions with narrow permissions.
- Re-check authorization inside the trusted operation; do not rely only on UI hiding controls.
- Keep service-role secrets in server-side secrets only. Never prefix with `VITE_`.
- Validate and normalize all inputs at server boundaries.
- Rate-limit or add abuse protection for room creation, joining and bids.
- Use unique constraints, transactions and idempotency keys.
- Use HTTPS in production; avoid logging tokens or secrets.
- Keep dependency updates and security review in the release checklist.
- Guest identity design must be resistant to easy host impersonation; nickname alone is not authorization.
- Provide room close/delete and data retention rules.

## Privacy
Collect only data required for gameplay. Explain what is stored. Do not collect phone numbers or exact location for the MVP. Use no real-money betting or payment processing.

## Security verification
Test that:
- Anonymous/non-member users cannot read private rooms.
- Participant cannot change host role, purse, deadline or player sale status.
- Host-only commands fail for other participants.
- Invalid bids fail even when calling the RPC directly.
- Service-role key is absent from built frontend assets and Git history.
