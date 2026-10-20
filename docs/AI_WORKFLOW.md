# AI Build Workflow

1. Give the coding agent `MASTER_BUILD_PROMPT.md` and instruct it to read `AGENTS.md` and all `docs/` files.
2. Ask it to inspect the repository and report a short plan before writing code.
3. Have it implement one phase from `PLAN.md` at a time.
4. After each phase, ask it to run checks and update `PLAN.md` with verified results only.
5. Do not paste secrets into prompts or commit `.env.local`.
6. Run the app locally and follow the manual two-device test in `docs/TESTING.md`.
7. Fix actual errors before proceeding to visual polish.
8. Before deployment, review RLS policies, database migrations, timer scheduler and service-role key handling.
9. Ask for a final report of completed features, commands run, tests passed/failed/not run, deployment instructions and known limitations.

## Continuation prompt
Read `MASTER_BUILD_PROMPT.md`, `AGENTS.md`, `PLAN.md`, and all relevant `docs/`. Inspect the current repository and git diff. Continue with the next unchecked task in `PLAN.md`. Do not redo completed work without a reason. Implement the next smallest complete vertical slice, run the relevant tests/build, update documentation and PLAN.md, and report verified results honestly.
