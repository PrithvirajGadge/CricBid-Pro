import type { AuctionState, Player, RoomSettings, Team } from "../types/db";

const EPS = 1e-9;

export function round2(n: number): number { return Math.round(n * 100) / 100; }
export function formatCrore(n: number): string { return `₹${n.toFixed(2)} Cr`; }

/** Minimum legal next bid (usability hint only: the server is authoritative). */
export function minimumBid(state: Pick<AuctionState, "current_bid">, player: Pick<Player, "base_price">, increment: number): number {
  return state.current_bid == null ? player.base_price : round2(state.current_bid + increment);
}

export function followsIncrement(amount: number, basePrice: number, increment: number): boolean {
  const steps = (amount - basePrice) / increment;
  return Math.abs(steps - Math.round(steps)) < EPS;
}

export type BidHint = "ok" | "NO_LIVE_LOT" | "TIMER_EXPIRED" | "NO_TEAM" | "ALREADY_LEADING" | "BID_TOO_LOW" | "BAD_INCREMENT" | "INSUFFICIENT_PURSE" | "ROSTER_FULL";

export function bidHint(args: { state: AuctionState; player: Player | undefined; team: Team | undefined; settings: RoomSettings; amount: number; serverNowMs: number; ownedCount: number }): BidHint {
  const { state, player, team, settings, amount, serverNowMs, ownedCount } = args;
  if (state.status !== "live" || !player) return "NO_LIVE_LOT";
  if (state.deadline_at && Date.parse(state.deadline_at) <= serverNowMs) return "TIMER_EXPIRED";
  if (!team) return "NO_TEAM";
  if (state.leading_team_id === team.id) return "ALREADY_LEADING";
  if (amount < minimumBid(state, player, settings.increment) - EPS) return "BID_TOO_LOW";
  if (!followsIncrement(amount, player.base_price, settings.increment)) return "BAD_INCREMENT";
  if (ownedCount >= team.roster_limit) return "ROSTER_FULL";
  if (team.remaining_purse < amount) return "INSUFFICIENT_PURSE";
  return "ok";
}

/** Remaining ms from a server deadline, corrected by the measured client/server clock offset. Display only. */
export function remainingMs(deadlineIso: string | null, clockOffsetMs: number, nowMs: number = Date.now()): number {
  if (!deadlineIso) return 0;
  return Math.max(0, Date.parse(deadlineIso) - (nowMs + clockOffsetMs));
}

/** Drops stale/duplicate snapshots: only a higher event_sequence replaces the current one. */
export function isNewer(incomingSeq: number, currentSeq: number | undefined): boolean {
  return currentSeq === undefined || incomingSeq > currentSeq;
}
