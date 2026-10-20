import type { Role } from "../types/db";

export interface PlayerRow { name: string; role: Role; nationality: string; base_price: number }
export interface CsvResult { rows: PlayerRow[]; errors: { line: number; message: string }[] }

const ROLES: Role[] = ["Batter", "Bowler", "Allrounder", "Wicketkeeper"];
const MAX_ROWS = 500;

/** Minimal RFC 4180 parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim() !== ""));
}

/** Neutralises spreadsheet formula injection and strips control characters. */
export function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = s.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
}

export function parsePlayersCsv(text: string): CsvResult {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  const errors: CsvResult["errors"] = [];
  const rows: PlayerRow[] = [];
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const idx = (n: string) => header.indexOf(n);
  const missing = ["name", "role", "base_price"].filter((n) => idx(n) < 0);
  if (missing.length) return { rows, errors: [{ line: 1, message: `Missing column(s): ${missing.join(", ")}` }] };
  if (table.length - 1 > MAX_ROWS) return { rows, errors: [{ line: 1, message: `Too many rows (max ${MAX_ROWS})` }] };
  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (n: string) => (cells[idx(n)] ?? "").trim();
    const name = sanitizeText(get("name"));
    const role = ROLES.find((r) => r.toLowerCase() === get("role").toLowerCase());
    const price = Number(get("base_price"));
    const nat = idx("nationality") >= 0 ? sanitizeText(get("nationality")) : "";
    if (!name || name.length > 80) return void errors.push({ line, message: "Name is required (max 80 chars)" });
    if (!role) return void errors.push({ line, message: `Role must be one of ${ROLES.join(", ")}` });
    if (!Number.isFinite(price) || price <= 0 || price > 1000) return void errors.push({ line, message: "base_price must be a number between 0 and 1000" });
    if (nat.length > 60) return void errors.push({ line, message: "Nationality too long" });
    if (seen.has(name.toLowerCase())) return void errors.push({ line, message: `Duplicate player "${name}"` });
    seen.add(name.toLowerCase());
    rows.push({ name, role, nationality: nat, base_price: Math.round(price * 100) / 100 });
  });
  return { rows, errors };
}
