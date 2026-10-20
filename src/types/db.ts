export type Role = "Batter" | "Bowler" | "Allrounder" | "Wicketkeeper";
export interface RoomSettings { purse: number; increment: number; timer_seconds: number; extend_seconds: number; roster_limit: number; max_participants: number }
export interface Room { id: string; code: string; name: string; status: "lobby" | "active" | "paused" | "completed" | "closed"; settings: RoomSettings; version: number }
export interface Participant { id: string; room_id: string; user_id: string; display_name: string; role: "host" | "participant" | "viewer"; status: "active" | "left" }
export interface Team { id: string; name: string; owner_participant_id: string | null; initial_purse: number; remaining_purse: number; roster_limit: number }
export interface Player { id: string; name: string; role: Role; nationality: string | null; base_price: number; status: "upcoming" | "live" | "sold" | "unsold" | "removed"; sold_team_id: string | null; sold_price: number | null; sort_order: number }
export interface AuctionState { room_id: string; status: "idle" | "live" | "paused"; current_player_id: string | null; deadline_at: string | null; paused_remaining_ms: number | null; current_bid: number | null; leading_team_id: string | null; leading_participant_id: string | null; event_sequence: number }
export interface Bid { id: string; player_id: string; team_id: string; participant_id: string; amount: number; sequence: number; created_at: string }
export interface Snapshot { room: Room; participants: Participant[]; teams: Team[]; players: Player[]; state: AuctionState; bids: Bid[]; selfUserId: string }
