# Veyora — rules for Claude Code

Full spec: `docs/SPEC.md`. These rules override everything else in it.

1. **Never edit tests in `packages/scheduler/test/anki-ported/`.** They are ports of Anki's tests and act as the answer key. A failing test means fix the implementation. If you think a ported test is wrong, STOP, explain, and ask the user.
2. **Port line by line, don't re-derive rules.** Keep Anki's function names, branch order and constants. Each ported file starts with:
   `// Ported from Anki: rslib/src/scheduler/states/<file>.rs @ <commit>` and
   `// Copyright: Ankitects Pty Ltd and contributors, AGPL-3.0-or-later`.
   The commit in use is recorded in `docs/ANKI_REF.md`; the source lives at `../anki-ref`.
3. **`packages/scheduler` is pure.** No `new Date()`, `Date.now()`, `Math.random()`; `now`, config and fuzz seed are parameters (ESLint enforces this).
4. **FSRS-6 only:** import `FSRS6Algorithm` from `ts-fsrs/models/fsrs-6`. Never `DefaultScheduler` (FSRS-7). Pin `ts-fsrs` exactly (no `^`/`~`).
5. **Layer-1 intervals are unrounded floats.** Don't use ts-fsrs `next_interval` to obtain them.
6. **One milestone at a time.** Nothing from M2 onward until the scheduler passes the Gate.
7. **`review_logs` is append-only** (only the `undone` flag may be updated).
8. Never commit `.env`, audio files, or secrets.

Commands: `pnpm install`, `pnpm test`, `pnpm --filter scheduler test`, `pnpm lint`, `pnpm typecheck`.

Done = `pnpm test`, `pnpm lint`, `pnpm typecheck` all pass. Report: files changed, tests added, open doubts.
