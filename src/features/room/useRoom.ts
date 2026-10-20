import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSession, getSupabase } from "../../lib/supabase";
import { fetchSnapshot, measureClockOffset, syncRoom } from "../../lib/api";
import { isNewer } from "../../domain/auction";
import type { Snapshot } from "../../types/db";

export type Connection = "connecting" | "connected" | "reconnecting";

/**
 * Snapshot-then-subscribe. Realtime events only signal "something changed"; the client refetches
 * the authorized snapshot and keeps it only if event_sequence advanced (dedupes / out-of-order safe).
 */
export function useRoom(code: string) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [clockOffset, setClockOffset] = useState(0);
  const seq = useRef<number | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);
  const roomId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const uid = await ensureSession();
      const next = await fetchSnapshot(code, uid);
      roomId.current = next.room.id;
      if (isNewer(next.state.event_sequence, seq.current) || seq.current === undefined) {
        seq.current = next.state.event_sequence;
        setSnap(next);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    const sb = getSupabase();
    const schedule = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void refresh(), 120); };
    void (async () => {
      await refresh();
      if (cancelled || !roomId.current) return;
      setClockOffset(await measureClockOffset().catch(() => 0));
      const id = roomId.current;
      const ch = sb.channel(`room:${id}`);
      for (const [table, col] of [["rooms", "id"], ["participants", "room_id"], ["teams", "room_id"], ["players", "room_id"], ["auction_state", "room_id"], ["bids", "room_id"]] as const) {
        ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `${col}=eq.${id}` }, schedule);
      }
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") { setConnection("connected"); void refresh(); }   // resync after (re)connect
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("reconnecting");
      });
      (window as unknown as { __room_ch?: unknown }).__room_ch = ch;
    })();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      const ch = (window as unknown as { __room_ch?: Parameters<typeof sb.removeChannel>[0] }).__room_ch;
      if (ch) void sb.removeChannel(ch);
    };
  }, [refresh]);

  // Fallback nudge: ask the server to finalize if ITS deadline passed. The server decides; this only wakes it.
  useEffect(() => {
    const deadline = snap?.state.status === "live" ? snap.state.deadline_at : null;
    if (!deadline || !snap) return;
    const id = window.setInterval(() => {
      if (Date.parse(deadline) <= Date.now() + clockOffset) void syncRoom(snap.room.id).then(refresh).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(id);
  }, [snap, clockOffset, refresh]);

  return { snap, error, connection, clockOffset, refresh };
}
