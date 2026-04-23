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
| (pending) Meng 孟辰璋 dragon dual-slash | [`sprint3/a-01-meng-dragon.md`](sprint3/a-01-meng-dragon.md) | **ready to dispatch** |
| (planned) Yin 寅 tiger fist combo | `sprint3/a-02-yin-tiger.md` | tbd |
| (planned) Xuanmo 玄墨 tortoise hammer | `sprint3/a-03-xuanmo-hammer.md` | tbd |
| (planned) Lingyu 凌羽 phoenix arrow | `sprint3/a-04-lingyu-phoenix.md` | tbd |

### Chore

| PR | Prompt file |
|---|---|
| [#26](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/26) Subagent defs → Pixi.js 8 | `chore/subagent-defs-pixi.md` *(not backfilled)* |
| [#30](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/30) PNG → WebP Q82 compression | `chore/compress-webp.md` *(not backfilled)* |
| [#39](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/39) (closed — superseded by #40) | — |

## Backfill policy

Merged prompts from before this archive existed (2026-04-23 and earlier) are marked *(not backfilled)* above. Retrieve the original prompt from the conversation transcript if needed. New prompts from 2026-04-23 afternoon onward are written directly as `.md` files — no more pasting.
