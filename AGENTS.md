# Instructions for AI Coding Agents

## Source of truth
Read `MASTER_BUILD_PROMPT.md` and `docs/` before implementation. Follow the product and security requirements. If requirements conflict, prioritize security/correctness, then PRD, then visual polish.

## Workflow
- Inspect before editing; preserve existing user work.
- Plan before coding and keep `PLAN.md` current.
- Make small changes, run checks, and report the real results.
- Never claim a feature or test works without verifying it.
- Ask only for decisions/credentials that block progress; use safe documented defaults otherwise.
- Never write real secrets into source, docs, commits, screenshots, or logs.
- Never use mock data in the real auction flow. Seed data is allowed only through explicit development seed scripts.
- Do not leave dead controls, placeholder handlers, fake API success, or unimplemented routes presented as complete.
- Use strict TypeScript and accessible semantic HTML.
- Add tests for every important business rule and failure case.
- If a tool/environment cannot run a test, record it as NOT RUN rather than PASS.

## Before finishing a task
1. Run formatting/lint/typecheck/tests/build available in the repo.
2. Review `git diff` for accidental changes and secrets.
3. Update relevant docs and PLAN.md.
4. Report changed files, commands executed, results, limitations, and next steps.
