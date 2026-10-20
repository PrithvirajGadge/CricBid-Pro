const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Your session expired. Reload the page.",
  ROOM_NOT_FOUND: "No room with that code.",
  ROOM_CLOSED: "This room is closed.",
  ROOM_FULL: "This room is full.",
  NICKNAME_TAKEN: "That nickname is already used in this room.",
  RATE_LIMITED: "Too many rooms created recently. Try again later.",
  BAD_TEAM_COUNT: "Choose between 2 and 12 teams.",
  BAD_SETTINGS: "One of the room settings is out of range.",
  TEAM_TAKEN: "Another participant already owns that team.",
  ALREADY_HAS_TEAM: "You already own a team.",
  AUCTION_BUSY: "Teams can't change while a lot is live.",
  NOT_MEMBER: "You are not a member of this room.",
  NOT_HOST: "Only the host can do that.",
  NOT_ALLOWED: "You are not allowed to do that.",
  NO_TEAM: "Claim a team before bidding.",
  AUCTION_NOT_ACTIVE: "The auction is not active.",
  NO_LIVE_LOT: "There is no live player right now.",
  TIMER_EXPIRED: "Time is up for this player.",
  ALREADY_LEADING: "Your team already leads the bidding.",
  BID_TOO_LOW: "Bid is below the minimum.",
  BAD_INCREMENT: "Bid must follow the room's increment.",
  INSUFFICIENT_PURSE: "Your team can't afford that bid.",
  PURSE_RESERVE: "That bid would leave too little to fill your squad.",
  ROSTER_FULL: "Your squad is full.",
  BAD_KEY: "Duplicate or invalid request. Try again.",
  NO_PLAYERS: "No upcoming players. Import players first.",
  NO_TEAMS_CLAIMED: "At least one team must be claimed.",
  LOT_ALREADY_LIVE: "A player is already live.",
  INVALID_TRANSITION: "That action isn't valid right now.",
  BAD_IMPORT: "Import must contain 1–500 valid rows.",
};

/** Maps a Postgres exception message (our error codes) to user-facing text. */
export function friendlyError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message
    : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message)
    : String(err);
  const code = raw.split(":")[0]?.trim() ?? "";
  if (code.startsWith("BAD_IMPORT_ROW")) return `Invalid player row: ${raw.split(":").slice(1).join(":").trim()}`;
  return MESSAGES[code] ?? "Something went wrong. Please try again.";
}
