# CLAUDE.md

Claude Code session rules for this repository.

## Project

PixiJS 8 rewrite of Dual Slots Battle. Source in `src/`. GitHub Pages demo: https://igs-maxwu.github.io/cmj2-dual-slots-pixi/

## Pull Request Workflow

- **Do NOT create PRs as draft.** Owner wants ready-for-review PRs so they can merge in one click.
- Always push to a feature branch (never directly to `master`) and open a PR.
- Owner decides when to merge — do not enable auto-merge unless asked.
- PR bodies: Summary / Why / Test plan.

## Deployment

Pushes to `master` auto-deploy to GitHub Pages via `.github/workflows/deploy-pages.yml`. Do not change `base` in `vite.config.ts` unless the repo name changes.

## Architecture notes

- No Phaser. No FSM. No scene lifecycle events. Transitions are plain `await ScreenManager.show(next)`.
- Algorithm modules in `src/systems/` are pure TypeScript (zero Pixi dependency) — ported from the Phaser version and should stay that way.
- UI screens in `src/screens/` own their own Pixi containers and must `destroy({ children: true })` in `onUnmount`.

---

## Executor Rules (anti-pattern prevention, locked 2026-04-23)

These rules apply to ANY Claude Code session that writes code in this repo. They exist because two real stalls happened on 2026-04-22 (spec-drift miss on P0.4, HMR debug loop on 4 female signatures). Full rationale + invocation template in MemPalace drawer `drawer_GameEconomy_DualSlot-engine_f9b2d1727ebf23a7`.

### P1 · Definition of Done

A PR is "done" when:

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

**DoD does NOT include**: preview visual verification, screenshot capture, manual gameplay testing. Those are the reporter session's job.

### P2 · Forbidden in feature PRs

Do NOT add:

- `console.log` in production code paths (dev-time temp debug is fine but must be removed before commit)
- `debugger` statements
- `setTimeout` / `delay` pauses for "screenshot capture" — that is demo-mode scope (§21 of SPEC.md), not feature scope
- Any helper code not explicitly listed in the prompt's TASK section

If you believe such a helper is necessary, STOP and ask the owner before adding.

### P3 · Iteration cap

If you edit the same file ≥ 3 times without resolving the task, **STOP and report** what you tried. Do not continue trial-and-error.

Specifically, if Vite HMR keeps reloading between your edits and breaking your validation, you are in a debug loop. Stop, commit what you have, report.

### P4 · PR-first discipline

Push the PR as soon as code compiles + commits pass. The reporter session runs preview + code review + merge decision. Executor sessions do not self-validate visually.

### P5 · Role separation

- **Executor session**: writes feature code. Ships PRs.
- **Reporter session**: reviews, decides merge, runs preview, writes SPEC updates.
- **Debug / Screenshot / QA** work: separate session, Opus model recommended for system-level diagnosis.

Do not mix roles within one session.

### P6 · Spec drift check

Spec (SPEC.md + MemPalace drawers) may have evolved since the prompt was written. At the start of every executor session:

1. Run `mempalace_search` on the topic keywords from the prompt
2. Confirm drawer content matches the prompt's assumptions
3. Flag any discrepancy BEFORE writing code

### Invocation template

Every executor prompt should include these 5 sections:

1. **Context** — what PR does, why, source drawer ID
2. **Spec drift check** (P6) — `mempalace_search` keywords
3. **Task** — file paths + line ranges + specific changes
4. **DoD** (P1) — quoted verbatim from above
5. **Handoff** — PR URL + 1-line summary + spec deviations + dependencies

Full template: drawer `f9b2d1727ebf23a7`.

---

## Prompt archive (added 2026-04-23)

All executor prompts dispatched by the orchestrator live in `prompts/` at the repo root. The workflow is:

1. Orchestrator writes the prompt as `prompts/<folder>/<sprint-nn-slug>.md` (not pasted into chat).
2. Owner tells the executor CLI: "Read `prompts/sprint3/a-01-meng-dragon.md` and execute it."
3. Executor opens the file with the `Read` tool and follows its instructions verbatim.
4. After merge, the prompt file stays in the folder as historical record. `git log prompts/...` shows when / why each prompt evolved.

See `prompts/README.md` for the index of all dispatched prompts, the folder convention, and the backfill policy. Prompts from before 2026-04-23 afternoon are not backfilled — retrieve from conversation transcripts if needed.
