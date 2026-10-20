import { getSupabase } from "./supabase";
import type { Snapshot, Room, Participant, Team, Player, AuctionState, Bid } from "../types/db";
import type { PlayerRow } from "../domain/csv";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const createRoom = (name: string, nickname: string, teamNames: string[], settings: Record<string, number>) =>
  rpc<string>("create_room", { p_name: name, p_nickname: nickname, p_team_names: teamNames, p_settings: settings });
export const joinRoom = (code: string, nickname: string) => rpc<string>("join_room", { p_code: code, p_nickname: nickname });
export const claimTeam = (teamId: string) => rpc<void>("claim_team", { p_team_id: teamId });
export const releaseTeam = (teamId: string) => rpc<void>("release_team", { p_team_id: teamId });
export const importPlayers = (roomId: string, rows: PlayerRow[]) => rpc<number>("import_players", { p_room: roomId, p_rows: rows });
export const startNextLot = (roomId: string) => rpc<string>("start_next_lot", { p_room: roomId });
export const hostAction = (roomId: string, action: string, arg: string | null = null) => rpc<string>("host_action", { p_room: roomId, p_action: action, p_arg: arg });
export const syncRoom = (roomId: string) => rpc<string>("sync_room", { p_room: roomId });
export const placeBid = (roomId: string, amount: number, key: string) => rpc<{ bid_id: string; sequence: number; replay: boolean }>("place_bid", { p_room: roomId, p_amount: amount, p_key: key });

/** Measures server clock offset (server - client) for display-only countdowns. */
export async function measureClockOffset(): Promise<number> {
  const t0 = Date.now();
  const server = await rpc<string>("server_time", {});
  const t1 = Date.now();
  return Date.parse(server) - (t0 + t1) / 2;
}

/** Fetches an authorized snapshot. RLS limits every table to rooms the caller belongs to. */
export async function fetchSnapshot(code: string, selfUserId: string): Promise<Snapshot> {
  const sb = getSupabase();
  const { data: room, error } = await sb.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle<Room>();
  if (error) throw new Error(error.message);
  if (!room) throw new Error("NOT_MEMBER");
  const [participants, teams, players, state, bids] = await Promise.all([
    sb.from("participants").select("*").eq("room_id", room.id).eq("status", "active").returns<Participant[]>(),
    sb.from("teams").select("*").eq("room_id", room.id).order("created_at").returns<Team[]>(),
    sb.from("players").select("*").eq("room_id", room.id).order("sort_order").returns<Player[]>(),
    sb.from("auction_state").select("*").eq("room_id", room.id).single<AuctionState>(),
    sb.from("bids").select("*").eq("room_id", room.id).order("sequence", { ascending: false }).limit(50).returns<Bid[]>(),
  ]);
  for (const r of [participants, teams, players, state, bids]) if (r.error) throw new Error(r.error.message);
  const num = <T extends object>(o: T, keys: string[]): T => { const c: Record<string, unknown> = { ...o }; for (const k of keys) if (c[k] != null) c[k] = Number(c[k]); return c as T; };
  return {
    room, selfUserId,
    participants: participants.data ?? [],
    teams: (teams.data ?? []).map((t) => num(t, ["initial_purse", "remaining_purse"])),
    players: (players.data ?? []).map((p) => num(p, ["base_price", "sold_price"])),
    state: num(state.data as AuctionState, ["current_bid"]),
    bids: (bids.data ?? []).map((b) => num(b, ["amount"])),
  };
}
