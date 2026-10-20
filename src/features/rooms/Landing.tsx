import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Field } from "../../components/ui";
import { createRoom, joinRoom } from "../../lib/api";
import { ensureSession } from "../../lib/supabase";
import { friendlyError } from "../../lib/errors";

export default function Landing() {
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<string>) {
    setBusy(true); setErr(null);
    try { await ensureSession(); nav(`/room/${await fn()}`); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  }
  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k));
    const count = n("teams");
    const names = Array.from({ length: count }, (_, i) => `Team ${i + 1}`);
    void run(() => createRoom(String(f.get("room")), String(f.get("nick")), names,
      { purse: n("purse"), increment: n("increment"), timer_seconds: n("timer"), roster_limit: n("roster") }));
  };
  const join = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(async () => { const code = String(f.get("code")).trim().toUpperCase(); await joinRoom(code, String(f.get("nick"))); return code; });
  };

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      <h1 className="text-4xl font-extrabold tracking-tight">Stumped <span className="text-gold">Bid</span></h1>
      <p className="mt-2 text-slate-300">Private, real-time cricket auctions with friends. Virtual money only.</p>
      <div className="mt-4" aria-live="polite">{err && <Alert>{err}</Alert>}</div>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <form onSubmit={create} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-xl font-bold">Create a room</h2>
          <Field label="Room name" name="room" required maxLength={60} />
          <Field label="Your nickname" name="nick" required minLength={2} maxLength={24} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teams (2–12)" name="teams" type="number" min={2} max={12} defaultValue={4} required />
            <Field label="Purse (₹ Cr)" name="purse" type="number" min={1} step="any" defaultValue={100} required />
            <Field label="Bid increment" name="increment" type="number" min={0.01} step="any" defaultValue={0.25} required />
            <Field label="Timer (s)" name="timer" type="number" min={5} max={120} defaultValue={20} required />
            <Field label="Squad size" name="roster" type="number" min={1} max={30} defaultValue={15} required />
          </div>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Working…" : "Create room"}</Button>
        </form>
        <form onSubmit={join} className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-xl font-bold">Join a room</h2>
          <Field label="Room code" name="code" required minLength={6} maxLength={6} autoCapitalize="characters" />
          <Field label="Your nickname" name="nick" required minLength={2} maxLength={24} />
          <Button type="submit" disabled={busy} variant="ghost" className="w-full">{busy ? "Working…" : "Join room"}</Button>
        </form>
      </div>
    </main>
  );
}
