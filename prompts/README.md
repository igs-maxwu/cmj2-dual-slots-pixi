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
| [#123](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/123) f-03 trigger detection (≥3 scatter → enter mode, retrigger +5 cap 50) + sim free spin model | [`sprint6/f-03-free-spin-trigger.md`](sprint6/f-03-free-spin-trigger.md) | ✅ merged |
| [#124](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/124) f-04 UI overlay (`FREE SPINS N/5` banner, gold tint, retrigger pulse) | [`sprint6/f-04-free-spin-ui-overlay.md`](sprint6/f-04-free-spin-ui-overlay.md) | ✅ merged (skill hints validated — `source-driven-development` triggered API cross-reference in PR body) |
| [#125](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/125) f-05 sim verify + **RTP rebalance** to 95-110% — `DEFAULT_TARGET_RTP` 16→12, coin_rtp 108.74% (Sprint 6 Track F **CLOSED 5/5**) | [`sprint6/f-05-sim-verify-rtp-rebalance.md`](sprint6/f-05-sim-verify-rtp-rebalance.md) | ✅ merged |

### Sprint 6 · J — Progressive Jackpot (M12)

| PR | Prompt file | Status |
|---|---|---|
| [#126](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/126) j-01 JP symbol id:11 weight:1 (pool-present, non-scoring, mirrors f-01 Scatter pattern) | [`sprint6/j-01-jackpot-symbol.md`](sprint6/j-01-jackpot-symbol.md) | ✅ merged |
| [#127](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/127) j-02 JP pool localStorage persistence + 1% accrual + 50/30/20 split (new `src/systems/JackpotPool.ts` pure module, 2 commits per discipline) | [`sprint6/j-02-jackpot-pool-persistence.md`](sprint6/j-02-jackpot-pool-persistence.md) | ✅ merged |
| [#128](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/128) j-03 5-of-a-kind detect + tier draw (3/12/85) + Wild substitute + split 50/50 payout + pool reset + sim full integration | [`sprint6/j-03-jackpot-trigger-draw-payout.md`](sprint6/j-03-jackpot-trigger-draw-payout.md) | ✅ merged (sim: trigger 0.00024/match, RTP 109.00%) |
| [#129](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/129) j-04 JP ceremony FX (full-screen, SOS2 BigWin atlas, 3-tier visual differentiation Minor/Major/Grand) — new `src/fx/JackpotCeremony.ts` | [`sprint6/j-04-jackpot-ceremony-fx.md`](sprint6/j-04-jackpot-ceremony-fx.md) | ✅ merged |
| [#130](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/130) j-05 JP marquee live counter (replace hardcoded 50k/500k/5M with `this.jackpotPools` dynamic reads + grow/shrink pulse) — **Sprint 6 closure PR** | [`sprint6/j-05-jackpot-marquee-live-counter.md`](sprint6/j-05-jackpot-marquee-live-counter.md) | ✅ merged — **Sprint 6 COMPLETE: F 5/5 + J 5/5, all SPEC §15 7 meta mechanics shipped** |

### Sprint 7 · D — Demo Polish (deferred d-04 ~ d-07 from Sprint 3 D-track)

Roadmap doc: [`sprint7/ROADMAP.md`](sprint7/ROADMAP.md)

| PR | Prompt file | Status |
|---|---|---|
| [#131](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/131) d-04 4 男性靈 signature FX upgrade — Dragon fire-wave / Tiger radial flash / Tortoise smoke plume / Phoenix fire trail (SOS2 atlas + webp additive layers, 4 commits per spirit, found 3 missing webp preloads via P6 drift check) | [`sprint7/d-04-signature-fx-upgrade.md`](sprint7/d-04-signature-fx-upgrade.md) | ✅ merged |
| [#132](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/132) d-06 Way highlight win-frame (replace Pixi Graphics 框 with sos2-win-frame.webp + GlowFilter outerStrength pulse, per-pulse shared filter for O(1) hot-path updates) | [`sprint7/d-06-way-highlight-win-frame.md`](sprint7/d-06-way-highlight-win-frame.md) | ✅ merged |
| [#133](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/133) d-05 Near-win gold-dust teaser (4-of-5 reels covered → missing col Sand cycle particles, sim rate 36% accepted as-is per orchestrator decision — slot-juice frequency) | [`sprint7/d-05-near-win-gold-dust-teaser.md`](sprint7/d-05-near-win-gold-dust-teaser.md) | ✅ merged |
| [#134](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/134) d-07 BigWin / MegaWin ceremony for non-JP big payouts — new `src/fx/BigWinCeremony.ts`, reuses sos2-bigwin atlas, 25× / 100× bet thresholds, distinct from JP ceremony (no dim BG, shorter, upper position) — **Sprint 7 closure PR** | [`sprint7/d-07-bigwin-megawin-ceremony.md`](sprint7/d-07-bigwin-megawin-ceremony.md) | ✅ merged — **Sprint 7 COMPLETE: Demo Polish 4/4** |

### Sprint 8 · P — Pitch Prep Package (IGS RD5 demo deliverables)

Roadmap doc: [`sprint8/ROADMAP.md`](sprint8/ROADMAP.md)

**形態差異**：本 sprint 多 orchestrator-driven（content / deck / video），少 executor code work。

| PR | Prompt file | Status |
|---|---|---|
| ([`docs/pitch/sprint8-deck-outline.md`](../docs/pitch/sprint8-deck-outline.md) push commit `fe60bb4`) p-01 Pitch deck content outline (12 slides bilingual narrative + speaker notes + 視覺暗示, all facts cited from MemPalace drawers) | [`sprint8/p-01-pitch-deck-content-outline.md`](sprint8/p-01-pitch-deck-content-outline.md) | ✅ delivered (orchestrator inline, no PR) |
| [#135](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/135) p-02 Demo mode (`?demo=1` URL param, 5-spin scripted: NearWin→BigWin 33.7×→MegaWin 202×→JP→FreeSpin) | [`sprint8/p-02-demo-mode-scripted-capture.md`](sprint8/p-02-demo-mode-scripted-capture.md) | ✅ merged |
| (`docs/pitch/sprint8-pitch-deck.pptx` commit `c2cbc06`) p-03 Generate `.pptx` from p-01 outline (12 slides 310KB, 4-Beast palette, pptxgenjs path) | — | ✅ delivered (orchestrator inline via anthropic-skills:pptx) |
| (`docs/pitch/sprint8-hype-video-script.md` commit `09c9a6c`) p-04 60s hype video script (4 acts, 18 shots, full Mandarin VO + BGM curve, leverages `?demo=1` for capture) | — | ✅ delivered (orchestrator inline) |
| (`docs/pitch/sprint8-one-pager.md` commit `6e0f19e`) p-05 A4 marketing one-pager (5-band layout + Claude Design / Midjourney prompt + Figma/Canva alternatives) | — | ✅ delivered (orchestrator inline) |
| (`docs/pitch/sprint8-closure.md` commit `7ab0424`) p-06 Sprint 8 closure — 三件套 brand consistency final check + owner action list + Sprint 9 candidate paths | — | ✅ delivered (orchestrator inline) — **Sprint 8 COMPLETE 6/6** |

### Sprint 9 · Pitch Feedback Response (視覺升級 + 戰鬥節奏 + 結算畫面)

Roadmap doc: [`sprint9/ROADMAP.md`](sprint9/ROADMAP.md)

**形態**：Owner 試玩 + mockup review 後 3 條具體 feedback。Mockup 參考 `download_picture/high_quality_mockup.html` + `mockup_reference.jpg`。

| PR | Prompt file | Status |
|---|---|---|
| [#136](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/136) pace-01 Sequenced reveal — 轉輪→對獎→出招→算傷害 4 段落, PACE_* 700/400/300/300ms, +1.7s/round | [`sprint9/pace-01-sequenced-reveal.md`](sprint9/pace-01-sequenced-reveal.md) | ✅ merged |
| [#137](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/137) v-01 Top UI bar (☰ menu / ROUND pill / 🎁 store + PLAYER A/B labels above wallets, WALLET_Y 52→78) | [`sprint9/v-01-top-ui-bar.md`](sprint9/v-01-top-ui-bar.md) | ✅ merged |
| [#138](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/138) v-02 JP marquee 2-row reorg (GRAND 天獎 solo top 30pt + MAJOR 地獎/MINOR 人獎 split bottom 20pt + tier labels + j-05 fields preserved) | [`sprint9/v-02-jp-marquee-2row.md`](sprint9/v-02-jp-marquee-2row.md) | ✅ merged |
| [#139](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/139) v-03 Battle background depth (8-line perspective floor + 4-corner vignette + spirit ground shadows, slotToArenaPos dynamic positions) | [`sprint9/v-03-battle-background-depth.md`](sprint9/v-03-battle-background-depth.md) | ✅ merged |
| [#140](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/140) res-01 ResultScreen new file + MatchResult interface + BattleScreen tracking + main.ts callback chain (3 atomic commits, 5 outcome variants, dual-side stats panel, return-to-Draft button) | [`sprint9/res-01-result-screen.md`](sprint9/res-01-result-screen.md) | ✅ merged |
| (`docs/pitch/sprint9-closure.md` commit `30b6849`) Sprint 9 closure — 3 owner feedback items addressed (visual / pacing / result screen), session totals 20 PRs across Sprints 6-9 | — | ✅ delivered (orchestrator inline) — **Sprint 9 COMPLETE 6/6** |
| [#141](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/141) chore: LoadingScreen stray-line bug fix (subtitle 'DUAL SLOTS BATTLE' was local var, never hidden when logo loads — Fix 1 confirmed statically) | [`chore/loadingscreen-stray-line-fix.md`](chore/loadingscreen-stray-line-fix.md) | ✅ merged |

### Sprint 10 · BattleScreen Visual Polish (the-stylist audit response)

Audit report: [`docs/pitch/sprint10-visual-audit.md`](../docs/pitch/sprint10-visual-audit.md) (orchestrator inline via the-stylist subagent)
Roadmap doc: [`sprint10/ROADMAP.md`](sprint10/ROADMAP.md)

**形態**：Owner Sprint 9 試玩後對視覺不滿意 → orchestrator dispatch the-stylist → 完整 audit (3 P0 bugs + 5 P1 polish gaps + 5 P2 minor) + Sprint 10 PR plan + Claude Design mockup prompts。

| PR | Prompt file | Status |
|---|---|---|
| [#142](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/142) p10-bug-01 — 3 P0 bugs (title 切斷 / 角落白塊 / HP bar 浸 JP) + sortableChildren 啟用 (4 atomic commits) | [`sprint10/p10-bug-01-arena-bleed-asset-fix.md`](sprint10/p10-bug-01-arena-bleed-asset-fix.md) | ✅ merged |
| [#143](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/143) p10-v01 — Layout hierarchy reset (Variant B + Path 1 — battle hero arena 520px + JP thin strip 64px + compact header + perspective SVG-style + 1 shared 5×3 reel preserved + cell 124×100 landscape) | [`sprint10/p10-v01-layout-variant-b.md`](sprint10/p10-v01-layout-variant-b.md) | ✅ merged (373/245/2 — biggest p10 PR) |
| [#144](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/144) p10-v02 — Reel cell polish (gem fill 0.80→0.90 + teal inner accent ring + 1-3 tier pip with special-flag priority Jackpot>Scatter>Curse>Wild>id-range) | [`sprint10/p10-v02-reel-cell-polish.md`](sprint10/p10-v02-reel-cell-polish.md) | ✅ merged (T.SYM.low1/mid1/high1 confirmed present) |
| [#145](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/145) p10-v03 — Gold budget finalize (corner alpha 0.55→0.25 / dragon-corner alpha 0.30 / JP border+dividers gold→sea-mid; 3 atomic commits, 5/4/2 lines/files) | [`sprint10/p10-v03-gold-budget-finalize.md`](sprint10/p10-v03-gold-budget-finalize.md) | ✅ merged (≤3 gold focal points achieved) |
| (`docs/pitch/sprint10-closure.md` commit `fb4796c`) Sprint 10 closure — 12 of 13 audit findings resolved (P2-B ROUND pill simplification defers to Sprint 11) | — | ✅ delivered (orchestrator inline) — **Sprint 10 COMPLETE** |
| [#146](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/146) chore: 3-row formation 九宮格 layout — back(1) solo / mid(2) / front(2), VS shield y=380→475 to avoid mid-row collision | [`chore/formation-three-row-layout.md`](chore/formation-three-row-layout.md) | ✅ merged |

### Sprint 11 · Variant A Migration (Claude Design new mockup)

Roadmap doc: [`sprint11/ROADMAP.md`](sprint11/ROADMAP.md)
Source mockup: `download_picture/Dual Slot Pixi/battle-variant-a.jsx` + `battle-shared.jsx`

**Owner decisions**: (1) keep existing `public/assets/spirits/*.webp` (same characters, no swap), (2) accept gem reskin from 5-shape PNG to glossy ball + Chinese character (drop d-02 5-shape lineage)

| PR | Prompt file | Status |
|---|---|---|
| [#147](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/147) p11-vA-01 — Layout reset (JP HERO 178px + 「戰」 separator + arena 310px + VS 50px circle + reel header SHARED BOARD + log 185px) | [`sprint11/p11-vA-01-layout-reset.md`](sprint11/p11-vA-01-layout-reset.md) | ✅ merged (278/186/1) |
| [#148](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/148) p11-vA-02 — NineGrid 3×3 formation (5-of-9 deterministic Fisher-Yates seeded placement, depth scale 0.78→1.10, B-side col mirror, render back-to-front z-order) | [`sprint11/p11-vA-02-ninegrid-formation.md`](sprint11/p11-vA-02-ninegrid-formation.md) | ✅ merged (134/91/1) |
| (pending) p11-vA-03 — Gem reskin (drop gem-shape PNG → glossy ball + 青/白/朱/玄/替/咒/散/寶 中文字 per Pixi.Graphics + GlowFilter, preserves p10-v02 inner ring + tier pips + d-06 wayhit highlight) | [`sprint11/p11-vA-03-gem-reskin-ball.md`](sprint11/p11-vA-03-gem-reskin-ball.md) | **ready to dispatch** — skill hints: frontend-ui-engineering, code-simplification, source-driven-development |
| (roadmap) p11-vA-03 — Gem reskin (replace gem-shape PNG with glossy circle ball + 青/白/朱/玄 Chinese character + dashed inner ring + tier pip corner) | — | depends on p11-vA-02 |
| (roadmap) sprint11 closure | — | depends on p11-vA-03 |
| (roadmap) p10-v02 — Reel cell polish (gem 0.80→0.90 + inner ring + tier pip) | — | depends on p10-v01 |
| (roadmap) p10-v04 — 8 spirit gem custom PNG art (replace programmatic tint) | — | depends on art delivery |
| (roadmap) sprint10 closure | — | depends on all above |

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
