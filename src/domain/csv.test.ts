import { describe, expect, it } from "vitest";
import { parsePlayersCsv, sanitizeText } from "./csv";

describe("parsePlayersCsv", () => {
  it("parses valid rows including quoted commas", () => {
    const r = parsePlayersCsv('name,role,nationality,base_price\n"Doe, John",batter,India,0.5\r\nA B,Bowler,,1');
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { name: "Doe, John", role: "Batter", nationality: "India", base_price: 0.5 },
      { name: "A B", role: "Bowler", nationality: "", base_price: 1 },
    ]);
  });
  it("reports missing columns, bad role, bad price and duplicates with line numbers", () => {
    expect(parsePlayersCsv("name,role\nA,Batter").errors[0]?.message).toMatch(/base_price/);
    const r = parsePlayersCsv("name,role,base_price\nA,Chef,1\nB,Batter,-2\nC,Batter,1\nc,Bowler,1");
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 5]);
    expect(r.rows).toHaveLength(1);
  });
  it("neutralises formula injection", () => expect(sanitizeText("=cmd()")).toBe("'=cmd()"));
});
