import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readEnv } from "./env";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = readEnv();
    client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/** Guests get a server-issued anonymous Supabase identity (needs "Anonymous sign-ins" enabled). */
export async function ensureSession(): Promise<string> {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error || !anon.user) throw new Error(error?.message ?? "Could not start a guest session");
  return anon.user.id;
}
