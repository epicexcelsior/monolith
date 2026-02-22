# Monolith — Claude Code Instructions

> Auto-loaded by Claude Code. Shared rules are in `.agent/rules/AGENTS.md`.

## Boot Sequence

1. **Read `CONTEXT.md`** — living state, file map, gotchas, data flow, system dependencies
2. **Scan `docs/LESSONS.md` index** — check topic headers relevant to your task
3. **Run `/find-skills`** if working on an unfamiliar domain

## Claude Code Specific

- **Slash commands**: `/commit`, `/wrapup`, `/context`, `/learn`, `/improve`, `/perf`, `/ui-standards`, `/build`, `/anchor-test`
- **`/wrapup` auto-updates CONTEXT.md** — always use it when finishing work
- **`/learn` categorizes by topic** — adds lessons to the correct section of docs/LESSONS.md
- **MEMORY.md** is auto-loaded with high-level project context (200 line limit)

## Key Rules

1. Read before writing — always read a file before modifying it
2. Check CONTEXT.md gotchas — the top 10 pitfalls are documented there
3. Check system dependencies — CONTEXT.md has a "Change X → Must Update Y" table
4. Use skills — `/perf` after shader/geometry changes, `/ui-standards` after UI changes
5. Log lessons — use `/learn` for non-obvious gotchas (categorized by topic)
6. Wrap up — use `/wrapup` when finishing (runs checks + updates CONTEXT.md)

## See Also

- `.agent/rules/AGENTS.md` — full shared agent guide (conventions, don'ts, tech stack, Anchor patterns)
- `CONTEXT.md` — living project state (primary reference)
- `docs/LESSONS.md` — technical lessons indexed by topic
- `apps/video/GUIDE.md` — **content engine**: making marketing videos with Remotion + real tower shaders. Never modify mobile app files when working in `apps/video/`.
