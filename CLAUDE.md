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
