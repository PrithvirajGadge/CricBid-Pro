import { describe, expect, it } from "vitest";
import { bidHint, followsIncrement, isNewer, minimumBid, remainingMs } from "./auction";
import type { AuctionState, Player, Team } from "../types/db";

const settings = { purse: 100, increment: 0.25, timer_seconds: 20, extend_seconds: 10, roster_limit: 15, max_participants: 20 };
const player: Player = { id: "p1", name: "X", role: "Batter", nationality: null, base_price: 1, status: "live", sold_team_id: null, sold_price: null, sort_order: 1 };
const team: Team = { id: "t1", name: "A", owner_participant_id: "u1", initial_purse: 100, remaining_purse: 10, roster_limit: 15 };
const state = (o: Partial<AuctionState> = {}): AuctionState => ({ room_id: "r", status: "live", current_player_id: "p1", deadline_at: new Date(10_000).toISOString(), paused_remaining_ms: null, current_bid: null, leading_team_id: null, leading_participant_id: null, event_sequence: 1, ...o });
const hint = (o: { s?: Partial<AuctionState>; amount: number; now?: number; team?: Team | undefined; owned?: number }) =>
  bidHint({ state: state(o.s), player, team: "team" in o ? o.team : team, settings, amount: o.amount, serverNowMs: o.now ?? 0, ownedCount: o.owned ?? 0 });

describe("minimumBid", () => {
  it("uses base price before the first bid, then adds the increment", () => {
    expect(minimumBid({ current_bid: null }, player, 0.25)).toBe(1);
    expect(minimumBid({ current_bid: 1.5 }, player, 0.25)).toBe(1.75);
  });
});
describe("followsIncrement", () => {
  it("accepts multiples of the increment from base and rejects others", () => {
    expect(followsIncrement(1.75, 1, 0.25)).toBe(true);
    expect(followsIncrement(1.6, 1, 0.25)).toBe(false);
  });
});
describe("bidHint", () => {
  it("accepts a valid opening bid", () => expect(hint({ amount: 1 })).toBe("ok"));
  it("rejects too-low, off-increment, over-budget and full-roster bids", () => {
    expect(hint({ amount: 0.75 })).toBe("BID_TOO_LOW");
    expect(hint({ amount: 1.1 })).toBe("BAD_INCREMENT");
    expect(hint({ amount: 11 })).toBe("INSUFFICIENT_PURSE");
    expect(hint({ amount: 1, owned: 15 })).toBe("ROSTER_FULL");
  });
  it("rejects after the deadline, with no team, when already leading, or with no live lot", () => {
    expect(hint({ amount: 1, now: 10_000 })).toBe("TIMER_EXPIRED");
    expect(hint({ amount: 1, team: undefined })).toBe("NO_TEAM");
    expect(hint({ amount: 2, s: { leading_team_id: "t1", current_bid: 1 } })).toBe("ALREADY_LEADING");
    expect(hint({ amount: 1, s: { status: "idle" } })).toBe("NO_LIVE_LOT");
  });
});
describe("remainingMs", () => {
  it("applies the clock offset and never goes negative", () => {
    expect(remainingMs(new Date(10_000).toISOString(), 500, 5_000)).toBe(4_500);
    expect(remainingMs(new Date(1_000).toISOString(), 0, 5_000)).toBe(0);
    expect(remainingMs(null, 0)).toBe(0);
  });
});
describe("isNewer", () => {
  it("ignores duplicate or out-of-order snapshots", () => {
    expect(isNewer(5, 5)).toBe(false);
    expect(isNewer(4, 5)).toBe(false);
    expect(isNewer(6, 5)).toBe(true);
    expect(isNewer(1, undefined)).toBe(true);
  });
});
