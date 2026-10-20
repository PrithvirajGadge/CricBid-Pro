# Product Decisions and Defaults

Use these as provisional defaults unless the product owner changes them:
- Product: original cricket auction app; not affiliated with any league.
- MVP room type: private room with code.
- Joining: nickname/guest flow only if implemented with secure server-issued identity; otherwise use Supabase Auth.
- Starting purse: ₹100 crore per team, configurable by host.
- Teams: configurable, default 10.
- Player pool: database-backed, editable and CSV-importable.
- Realtime: Supabase Realtime; PostgreSQL/server functions remain authoritative.
- Currency is virtual gameplay currency only; no payments, betting or cash prizes.
- UI style: dark sports/stadium-inspired, original brand, mobile-first.
- Deployment: Vercel frontend + Supabase backend, subject to project needs.
- Do not hardcode player lists, room codes, bid values, timer deadlines, team purse values or winning results into runtime UI.
