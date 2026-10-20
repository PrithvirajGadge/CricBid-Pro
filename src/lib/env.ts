import { z } from "zod";

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
});

export type Env = z.infer<typeof schema>;

/** Throws a readable error when browser config is missing. Never reads server secrets. */
export function readEnv(raw: Record<string, unknown> = import.meta.env): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${names}. Copy .env.example to .env.local.`);
  }
  return parsed.data;
}
