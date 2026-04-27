# Executor Prompts Archive

All executor prompts dispatched by the orchestrator session live here. Instead of pasting a full prompt into the right-side executor CLI, the owner says:

> Read `prompts/<folder>/<file>.md` and execute it.

The executor opens the file with the `Read` tool and follows it verbatim.

## Conventions

- **One `.md` file per PR**. Filename = `<sprint>-<nn>-<slug>.md` (sprint prefix lets alphabetical listing mirror sprint order).
- Prompts stay in the folder after merge — this folder IS the historical record. `git log prompts/sprint2/b3-dragon-corners.md` reveals when / why each prompt evolved.
- Every prompt follows the 5-section invocation template defined in `CLAUDE.md` § Executor Rules → Invocation template: Context / Spec-drift (P6) / Task / DoD / Handoff.
- Asset seed commits (orchestrator commits the Gemini / Suno / ElevenLabs slice before dispatching executor) are cross-referenced in the Context section of the prompt, not stored here.

## Naming conventions

| Folder | Purpose |
|---|---|
| `sprint2/` | Sprint 2 V-tier items (A/B/C categories per SPEC §11) |
| `sprint2-polish/` | Follow-up polish PRs after smoke-test findings |
| `sprint3/` | Sprint 3 male-spirit signatures + 4-beast theme depth |
| `chore/` | Non-feature infra (asset compression, tooling, docs) |

## Index

### Sprint 2 · V-tier

| PR | Prompt file | Date |
|---|---|---|
| [#28](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/28) A1 ink-wash parallax bg | `sprint2/a1-ink-wash-bg.md` *(not backfilled)* | 2026-04-23 |
| [#29](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/29) B2 VS badge animated | `sprint2/b2-vs-badge-animated.md` *(not backfilled)* | 2026-04-23 |
| [#31](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/31) B1 GoldText | `sprint2/b1-gold-text.md` *(not backfilled)* | 2026-04-23 |
| [#32](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/32) A5 ambient particles | `sprint2/a5-ambient-particles.md` *(not backfilled)* | 2026-04-23 |
| [#33](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/33) A6 ornate BACK button | `sprint2/a6-ornate-button.md` *(not backfilled)* | 2026-04-23 |
| [#34](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/34) B3 reel dragon corners | `sprint2/b3-dragon-corners.md` *(not backfilled)* | 2026-04-23 |
| [#35](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/35) B6 JP marquee | `sprint2/b6-jp-marquee.md` *(not backfilled)* | 2026-04-23 |
| [#36](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/36) C1+C2 AudioManager | `sprint2/c1-c2-audio.md` *(not backfilled)* | 2026-04-23 |
| [#37](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/37) B5 wallet cascade | `sprint2/b5-wallet-cascade.md` *(not backfilled)* | 2026-04-23 |

### Sprint 2 · polish

| PR | Prompt file | Date |
|---|---|---|
| [#38](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/38) VS badge scale + wallet overlap | `sprint2-polish/polish-01-vs-badge-wallet.md` *(not backfilled)* | 2026-04-23 |
| [#40](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/40) Wallet y + spirit 正名 + clan fix | `sprint2-polish/polish-02-wallet-y-names-clan.md` *(not backfilled)* | 2026-04-23 |

### Sprint 3 · male spirit signatures

| PR | Prompt file | Status |
|---|---|---|
| [#42](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/42) Meng 孟辰璋 dragon dual-slash | [`sprint3/a-01-meng-dragon.md`](sprint3/a-01-meng-dragon.md) | ✅ merged |
| [#44](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/44) Yin 寅 tiger fist combo | [`sprint3/a-02-yin-tiger.md`](sprint3/a-02-yin-tiger.md) | ✅ merged |
| [#48](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/48) Xuanmo 玄墨 tortoise hammer | [`sprint3/a-03-xuanmo-hammer.md`](sprint3/a-03-xuanmo-hammer.md) | ✅ merged |
| [#49](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/49) Lingyu 凌羽 phoenix arrow | [`sprint3/a-04-lingyu-phoenix.md`](sprint3/a-04-lingyu-phoenix.md) | ✅ merged — **Sprint 3 A COMPLETE 4/4** |

### Sprint 3 · C — 4-beast theme depth (T7)

| PR | Prompt file | Status |
|---|---|---|
| [#61](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/61) c-01 DraftScreen clan grouping | [`sprint3/c-01-draftscreen-4beast-grouping.md`](sprint3/c-01-draftscreen-4beast-grouping.md) | ✅ merged |
| (pending) c-02 BattleScreen free-standing spirits (no round frames) | [`sprint3/c-02-battlescreen-freestanding-spirits.md`](sprint3/c-02-battlescreen-freestanding-spirits.md) | **ready to dispatch** (parallel with d-03) |

### Sprint 3 · D — SOS2 asset integration (FX + Symbols)

Roadmap doc: [`sprint3/D-ROADMAP.md`](sprint3/D-ROADMAP.md)

| PR | Prompt file | Status |
|---|---|---|
| [#62](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/62) d-00 SOS2 assets import (chore) | *(orchestrator task, no executor prompt)* | ✅ merged |
| [#65](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/65) d-01 FXAtlas loader + clanTint helper | [`sprint3/d-01-fx-atlas-loader.md`](sprint3/d-01-fx-atlas-loader.md) | ✅ merged |
| (pending) d-02 Reel gem reskin (5 gems replace reel portraits) | [`sprint3/d-02-revived-reel-gem-reskin.md`](sprint3/d-02-revived-reel-gem-reskin.md) | **ready to dispatch** — revived after owner mockup 2026-04-23 |
| (pending) d-03 Phoenix coin-on-kill visual | [`sprint3/d-03-phoenix-coin-visual.md`](sprint3/d-03-phoenix-coin-visual.md) | **ready to dispatch** |
| (roadmap) d-04 Signature FX upgrade (dragon/phoenix/tortoise fire+smoke) | — | depends on d-01 |
| (roadmap) d-05 Near-win gold-dust teaser | — | depends on d-01 |
| (roadmap) d-06 Way highlight win-frame | — | depends on d-01 |
| (roadmap) d-07 BigWin / MegaWin ceremony (Sprint 6 prep) | — | depends on d-01 |

### Sprint 3 · B — Spirit passives (SPEC §8 gameplay skills)

| PR | Prompt file | Status |
|---|---|---|
| [#51](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/51) b-01 白虎 −10% damage taken | [`sprint3/b-01-tiger-passive-damage-reduction.md`](sprint3/b-01-tiger-passive-damage-reduction.md) | ✅ merged |
| [#54](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/54) b-02 玄武 last-alive shield | [`sprint3/b-02-tortoise-last-alive-shield.md`](sprint3/b-02-tortoise-last-alive-shield.md) | ✅ merged — **Sprint 3B COMPLETE 4/4** |
| [#55](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/55) b-03 青龍 4+ match +20% dmg | [`sprint3/b-03-dragon-4match-bonus.md`](sprint3/b-03-dragon-4match-bonus.md) | ✅ merged |
| [#57](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/57) b-04 朱雀 coin-on-kill | [`sprint3/b-04-phoenix-coin-on-kill.md`](sprint3/b-04-phoenix-coin-on-kill.md) | ✅ merged |

### Sprint 6 · F — Free Spin (M10)

Roadmap doc: [`sprint6/ROADMAP.md`](sprint6/ROADMAP.md)

| PR | Prompt file | Status |
|---|---|---|
| [#121](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/121) f-01 Scatter symbol id:10 (pool-present, non-scoring) | [`sprint6/f-01-scatter-symbol.md`](sprint6/f-01-scatter-symbol.md) | ✅ merged |
| [#122](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/122) f-02 Free Spin mode state (`inFreeSpin` / `freeSpinsRemaining` / win ×2) + scatter weight 2→4 | [`sprint6/f-02-free-spin-mode-state.md`](sprint6/f-02-free-spin-mode-state.md) | ✅ merged |
| (pending) f-03 trigger detection (≥3 scatter → enter mode, retrigger +5 cap 50) + sim free spin model | [`sprint6/f-03-free-spin-trigger.md`](sprint6/f-03-free-spin-trigger.md) | **ready to dispatch** |
| (roadmap) f-04 UI overlay (`FREE SPINS N/5` banner, gold tint) | — | depends on f-02 |
| (roadmap) f-05 sim verify trigger ~0.2/match + RTP impact | — | depends on f-03 |

### Chore

| PR | Prompt file |
|---|---|
| [#26](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/26) Subagent defs → Pixi.js 8 | `chore/subagent-defs-pixi.md` *(not backfilled)* |
| [#30](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/30) PNG → WebP Q82 compression | `chore/compress-webp.md` *(not backfilled)* |
| [#39](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/39) (closed — superseded by #40) | — |
| [#41](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/41) prompts/ archive convention | *(self-referential; the meta-PR that created this README)* |
| [#43](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/43) add Yin prompt to archive | *(doc PR, no standalone prompt file)* |
| [#46](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/46) FX Preview Harness (URL param + console hook) | [`chore/fx-preview-harness.md`](chore/fx-preview-harness.md) | ✅ merged |
| [#52](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/52) wire xuanmo + lingyu into SIG_SPIRIT maps | *(proactive cleanup by executor after a-03/a-04 landed)* |

## Backfill policy

Merged prompts from before this archive existed (2026-04-23 and earlier) are marked *(not backfilled)* above. Retrieve the original prompt from the conversation transcript if needed. New prompts from 2026-04-23 afternoon onward are written directly as `.md` files — no more pasting.
