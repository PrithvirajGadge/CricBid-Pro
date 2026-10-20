import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Spinner } from "../../components/ui";
import { bidHint, formatCrore, minimumBid, remainingMs } from "../../domain/auction";
import { parsePlayersCsv } from "../../domain/csv";
import { claimTeam, hostAction, importPlayers, placeBid, releaseTeam, startNextLot } from "../../lib/api";
import { friendlyError } from "../../lib/errors";
import type { Snapshot } from "../../types/db";
import { useRoom } from "./useRoom";

export default function RoomPage() {
  const { code = "" } = useParams();
  const { snap, error, connection, clockOffset, refresh } = useRoom(code);
  if (error && !snap) return <main className="p-6"><Alert>{friendlyError(new Error(error))}</Alert><Link className="mt-4 inline-block underline" to="/">Back to start</Link></main>;
  if (!snap) return <Spinner label="Loading room…" />;
  return <Room snap={snap} connection={connection} clockOffset={clockOffset} refresh={refresh} />;
}

function Room({ snap, connection, clockOffset, refresh }: { snap: Snapshot; connection: string; clockOffset: number; refresh: () => Promise<void> }) {
  const { room, participants, teams, players, state, bids, selfUserId } = snap;
  const me = participants.find((p) => p.user_id === selfUserId);
  const isHost = me?.role === "host";
  const myTeam = teams.find((t) => t.owner_participant_id === me?.id);
  const player = players.find((p) => p.id === state.current_player_id);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(id); }, []);
  const left = state.status === "paused" ? state.paused_remaining_ms ?? 0 : remainingMs(state.deadline_at, clockOffset, now);
  const owned = useMemo(() => players.filter((p) => p.sold_team_id === myTeam?.id && p.status === "sold").length, [players, myTeam]);
  const minBid = player ? minimumBid(state, player, room.settings.increment) : 0;

  async function act(fn: () => Promise<unknown>) {
    setMsg(null);
    try { await fn(); await refresh(); } catch (e) { setMsg(friendlyError(e)); }
  }
  const bid = (amount: number) => {
    const hint = player ? bidHint({ state, player, team: myTeam, settings: room.settings, amount, serverNowMs: now + clockOffset, ownedCount: owned }) : "NO_LIVE_LOT";
    if (hint !== "ok") setMsg(friendlyError(new Error(hint)));       // hint only; server still validates
    void act(() => placeBid(room.id, amount, crypto.randomUUID()));
  };
  const onCsv = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parsePlayersCsv(await file.text());
    if (parsed.errors.length) return setMsg(parsed.errors.slice(0, 3).map((e) => `Line ${e.line}: ${e.message}`).join(" · "));
    void act(() => importPlayers(room.id, parsed.rows));
  };
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "—";
  const upcoming = players.filter((p) => p.status === "upcoming").length;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{room.name}</h1>
          <p className="text-sm text-slate-300">Room code <strong className="font-mono text-gold">{room.code}</strong> · {room.status.toUpperCase()}</p>
        </div>
        <span role="status" className={`rounded-full px-3 py-1 text-sm ${connection === "connected" ? "bg-emerald-900" : "bg-amber-800"}`}>{connection === "connected" ? "● Live" : "Reconnecting…"}</span>
      </header>
      <div aria-live="assertive">{msg && <Alert>{msg}</Alert>}</div>

      <section aria-label="Current player" className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        {state.status === "idle" || !player ? (
          <p className="text-slate-300">{room.status === "completed" ? "Auction complete." : room.status === "closed" ? "Room closed." : "No player on the block."}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">{state.status === "paused" ? "PAUSED" : "LIVE"} · {player.role}{player.nationality ? ` · ${player.nationality}` : ""}</p>
              <h2 className="text-3xl font-extrabold">{player.name}</h2>
              <p>Base {formatCrore(player.base_price)}</p>
              <p className="mt-2 text-2xl">Current bid <strong className="text-gold">{state.current_bid == null ? "—" : formatCrore(state.current_bid)}</strong></p>
              <p>Leading: {teamName(state.leading_team_id)}</p>
            </div>
            <div className="text-center sm:text-right">
              <p className="font-mono text-6xl" aria-label={`${Math.ceil(left / 1000)} seconds left`}>{Math.ceil(left / 1000)}s</p>
              {myTeam ? (
                <Button className="mt-3 w-full sm:w-auto" disabled={state.status !== "live"} onClick={() => bid(minBid)}>Bid {formatCrore(minBid)}</Button>
              ) : <p className="mt-3 text-sm text-slate-300">Claim a team to bid.</p>}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-label="Teams" className="rounded-xl border border-slate-700 p-4 lg:col-span-2">
          <h2 className="mb-2 font-bold">Teams & purses</h2>
          <ul className="space-y-2">
            {teams.map((t) => {
              const owner = participants.find((p) => p.id === t.owner_participant_id);
              const squad = players.filter((p) => p.sold_team_id === t.id && p.status === "sold").length;
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-800/60 px-3 py-2">
                  <span><strong>{t.name}</strong> <span className="text-sm text-slate-400">{owner ? `· ${owner.display_name}` : "· open"}</span></span>
                  <span className="text-sm">{formatCrore(t.remaining_purse)} · {squad}/{t.roster_limit} players</span>
                  {state.status === "idle" && !owner && !myTeam && <Button variant="ghost" onClick={() => void act(() => claimTeam(t.id))}>Claim</Button>}
                  {state.status === "idle" && owner && (isHost || owner.id === me?.id) && <Button variant="ghost" onClick={() => void act(() => releaseTeam(t.id))}>Release</Button>}
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-label="Bid history" className="rounded-xl border border-slate-700 p-4">
          <h2 className="mb-2 font-bold">Recent bids</h2>
          {bids.length === 0 ? <p className="text-sm text-slate-400">No bids yet.</p> : (
            <ol className="space-y-1 text-sm">{bids.slice(0, 10).map((b) => <li key={b.id}>#{b.sequence} {teamName(b.team_id)} — {formatCrore(b.amount)}</li>)}</ol>
          )}
        </section>
      </div>

      <section aria-label="Players" className="rounded-xl border border-slate-700 p-4">
        <h2 className="mb-2 font-bold">Players ({upcoming} upcoming)</h2>
        {players.length === 0 ? <p className="text-sm text-slate-400">No players yet.{isHost ? " Import a CSV below." : " Waiting for the host."}</p> : (
          <div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm">
            <thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Base</th><th scope="col">Status</th></tr></thead>
            <tbody>{players.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.role}</td><td>{formatCrore(p.base_price)}</td><td>{p.status}{p.status === "sold" ? ` → ${teamName(p.sold_team_id)} ${formatCrore(p.sold_price ?? 0)}` : ""}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      {isHost && (
        <section aria-label="Host controls" className="space-y-3 rounded-xl border border-gold/50 p-4">
          <h2 className="font-bold">Host controls</h2>
          <label className="block text-sm">Import players (CSV: name, role, nationality, base_price)
            <input type="file" accept=".csv,text/csv" className="mt-1 block" onChange={(e) => void onCsv(e.target.files?.[0])} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={state.status !== "idle" || room.status === "completed" || room.status === "closed"} onClick={() => void act(() => startNextLot(room.id))}>Next player</Button>
            <Button variant="ghost" disabled={state.status !== "live"} onClick={() => void act(() => hostAction(room.id, "pause"))}>Pause</Button>
            <Button variant="ghost" disabled={state.status !== "paused"} onClick={() => void act(() => hostAction(room.id, "resume"))}>Resume</Button>
            <Button variant="ghost" disabled={state.status === "idle"} onClick={() => setConfirm("skip")}>Skip</Button>
            <Button variant="ghost" disabled={state.status === "idle"} onClick={() => setConfirm("unsold")}>Mark unsold</Button>
            <Button variant="ghost" disabled={state.status !== "idle"} onClick={() => void act(() => hostAction(room.id, "reauction"))}>Re-auction unsold</Button>
            <Button variant="danger" onClick={() => setConfirm("close")}>Close room</Button>
          </div>
          {confirm && (
            <div role="alertdialog" aria-label="Confirm action" className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-800 p-3">
              <span>Really {confirm}? This can't be undone.</span>
              <Button variant="danger" onClick={() => { const a = confirm; setConfirm(null); void act(() => hostAction(room.id, a)); }}>Yes, {confirm}</Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
