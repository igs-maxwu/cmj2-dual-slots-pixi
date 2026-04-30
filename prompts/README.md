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
| [#149](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/149) p11-vA-03 — Gem reskin (drop gem-shape PNG → glossy ball + 青/白/朱/玄/替/咒/散/寶 中文字, T.CLAN.whiteGlow+blackGlow grep-confirmed, all p10-v02+d-06 invariants preserved) | [`sprint11/p11-vA-03-gem-reskin-ball.md`](sprint11/p11-vA-03-gem-reskin-ball.md) | ✅ merged (90/21/1) |
| (`docs/pitch/sprint11-closure.md` commit `d443545`) Sprint 11 closure — Variant A migration 3/3 complete | — | ✅ delivered (orchestrator inline) — **Sprint 11 COMPLETE** |
| [#150](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/150) chore: SPIN button (manual spin replaces auto-loop SPEC drift per owner) + spirit shadow fix (drawSpiritShadows was called before placements seeded → all fallback cellIdx=0) + loop refactor wait-for-click | [`chore/spin-button-and-stuck-fix.md`](chore/spin-button-and-stuck-fix.md) | ✅ merged |
| [#151](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/151) chore: SPIN button hitArea fix (Pixi 8 Container needs explicit Rectangle hitArea — Graphics children don't propagate to parent) + AUTO/SKIP ghost buttons + PAYLINES 1-10 decorative indicator + reel header A·YOUR TURN/B·WAITING with active-dot/hollow-circle | [`chore/spin-button-bug-and-mockup-elements.md`](chore/spin-button-bug-and-mockup-elements.md) | ✅ merged (hitArea fix correct but insufficient — see #152) |
| [#152](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/152) chore: SPIN button **ULTIMATE** fix — `refreshFormation()` array bounds bug (`i<9` but `cells.length=5` since p11-vA-02) silently crashed async onMount before `void this.loop()` → button was unreachable. Console-bisect via `[onMount] A..K` breadcrumb logs found exact crash point. + `app.stage.eventMode='static'` Pixi 8 stage requirement + visual cleanup (drop grid overlay + edge vignette) | [`chore/spin-still-broken-and-visual-rebuild.md`](chore/spin-still-broken-and-visual-rebuild.md) | ✅ merged (8/5/1 — `debugging-and-error-recovery` 5-step evidence-based finally found real root cause) |

### Sprint 12 · UI Asset Decommission (drop all Gemini webp UI borders / frames / buttons)

Roadmap doc: [`sprint12/ROADMAP.md`](sprint12/ROADMAP.md)

**形態**：Owner 反映「遊戲還是很多舊的圖 ... 之前用 gemini 產的邊框都不要了」。Audit 13 Gemini UI webp → 4 orphan + 9 in-use → 全部 programmatic 重做。

| PR | Prompt file | Status |
|---|---|---|
| [#153](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/153) s12-ui-01 — orphan delete (6 webp = 4 orphan + corner-ornament + dragon-corner) + Decorations.ts programmatic L-bracket + SlotReel force-fallback path (3 atomic commits, PWA precache 162→150 entries) | [`sprint12/s12-ui-01-orphan-and-corners.md`](sprint12/s12-ui-01-orphan-and-corners.md) | ✅ merged (64/61/9) |
| [#154](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/154) s12-ui-02 — LoadingScreen logo-mark + divider programmatic (titleText 1.2× scale + glow, Graphics hairline + center gold dot; BattleScreen drawLog divider Graphics) | [`sprint12/s12-ui-02-loading-logo-divider.md`](sprint12/s12-ui-02-loading-logo-divider.md) | ✅ merged (35/41/5, PWA precache 150→146) |
| [#155](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/155) s12-ui-03 — UiButton rewrite (Sprite + 2 webp → Pixi.Graphics 2-rect gradient + border + Rectangle hitArea; killed dead 'ornate' variant) | [`sprint12/s12-ui-03-uibutton-rewrite.md`](sprint12/s12-ui-03-uibutton-rewrite.md) | ✅ merged (76/64/4, PWA precache 146→142) |
| [#156](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/156) s12-ui-04 — SpiritPortrait rewrite (portrait-ring webp → Graphics 4-layer clan ring with GlowFilter + clan-aware color logic) | [`sprint12/s12-ui-04-spirit-portrait-rewrite.md`](sprint12/s12-ui-04-spirit-portrait-rewrite.md) | ✅ merged (64/24/3, PWA precache 142→140) |
| [#157](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/157) s12-ui-05 — SlotReel slot-frame + BattleScreen win-burst → Pixi.Graphics (3-stroke ornate + 4 corner dots; concentric rings + 12 radial rays) | [`sprint12/s12-ui-05-reel-frame-and-winburst.md`](sprint12/s12-ui-05-reel-frame-and-winburst.md) | ✅ merged (65/32/2) |
| [#158](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/158) s12-ui-06 — Final cleanup (delete 2 UI webp + 5 gem-shape webp + GemMapping.ts + LoadingScreen drop UI/gems preload + UI_ASSET_KEYS empty) | [`sprint12/s12-ui-06-final-cleanup.md`](sprint12/s12-ui-06-final-cleanup.md) | ✅ merged (6/84/10, PWA precache 162→126 cumulative -36 entries) |
| (`docs/pitch/sprint12-closure.md` commit `91d1b3d`) Sprint 12 closure — UI Asset Decommission 6/6 complete (all 18 Gemini UI/gem webp retired + 1 dead config file deleted) | — | ✅ delivered (orchestrator inline) — **Sprint 12 COMPLETE** |

### Sprint 13 · SOS2 動畫升級 (Free Spin entry / Streak fly / JP fly-in / retrigger)

Roadmap doc: [`sprint13/ROADMAP.md`](sprint13/ROADMAP.md)

**形態**：3 polish PRs 用既有 SOS2 atlas / webp 升級「機制觸發瞬間」戲劇性。**機制不動**，純視覺 ceremony。Inventory grep-confirmed 所有需要 asset 都在 `public/assets/fx/`。

| PR | Prompt file | Status |
|---|---|---|
| [#159](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/159) s13-fx-01 — Free Spin entry ceremony (FreeSpinEntryCeremony.ts new module + BattleScreen await on trigger; sos2-declare-fire Fire_1/6/2 + 「FREE SPIN」 80pt + 「靈氣爆發·5 ROUNDS」 sub) | [`sprint13/s13-fx-01-freespin-entry-ceremony.md`](sprint13/s13-fx-01-freespin-entry-ceremony.md) | ✅ merged |
| [#160](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/160) chore — 3 issues fix: MAJOR/MINOR font 9→12 / 16→22, spirit 5v5 visibility (Case D root cause: NINE_GAP 4→24 stops front-row scale 1.10 spirit horizontal overlap), white-clan ball dark text 0x4a3a1a (WCAG AAA 7:1) | [`chore/jp-text-formation-count-ball-contrast.md`](chore/jp-text-formation-count-ball-contrast.md) | ✅ merged |
| [#161](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/161) chore — MAJOR/MINOR overflow + spirit 5v5 r2 + ball dark unified. **Issue 2 REAL root cause: `createFormation` scatters 5 spirits into random idx 0-8 of 9-elem array; `drawFormation`/`refreshFormation` read `grid[0..4]` only → any spirit at idx ≥5 never rendered (~2.78/5 per side missing).** Fix: `activeUnits = grid.filter(u => u !== null)` + read `activeUnits[slot]`. Also JP value 22→20 + bottom-anchor inset; all-ball dark text 0x2a1a05; curse purple 0x8b3aaa→0xc77fe0 | [`chore/jp-overflow-spirit-count-r2-ball-text-unify.md`](chore/jp-overflow-spirit-count-r2-ball-text-unify.md) | ✅ merged |
| [#162](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/162) chore — AUTO button real feature. autoSpinsRemaining counter replaces setInterval; waitForSpinClick self-resolves after 350ms when counter>0 (aligned with round loop); popup spin selector 10/25/50/100+CANCEL; stop on FreeSpin/JP/match-end; gold STOP N active state + popup hover highlight | [`chore/auto-spin-feature.md`](chore/auto-spin-feature.md) | ✅ merged |
| [#163](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/163) chore — HP bar above-head → below-feet (踏板能量條). UNIT_HP_BAR_Y_OFF flips sign: -(NINE_CELL_SIZE/2)-10 → +(NINE_CELL_SIZE/2)+10. Spirit sprite anchor (0.5,1) + sprite.y=NINE_CELL_SIZE/2 → feet at container y=40, HP bar at y=50 (10px gap below feet) | [`chore/hp-bar-to-feet.md`](chore/hp-bar-to-feet.md) | ✅ merged |
| [#166](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/166) chore — DraftScreen 圓頭像 → 整隻全身 spirit 立繪 (mockup 蒼嵐 style). TILE_H 152→185, full-body Sprite (aspect-preserved) + clan glow backdrop replaces SpiritPortrait circle; name 24pt overlay with dark outline + clan dropShadow; meta 9pt below sprite; A/B btns bottom-anchored y=147; normal fill 0.45→0.60 for readability on busy tile | [`chore/draft-screen-full-body-spirit.md`](chore/draft-screen-full-body-spirit.md) | ✅ merged |
| [#167](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/167) chore — DraftScreen tile widen 152→296 + name above sprite. TILES_TOTAL_W 344→616 (margin 188→52), GAP 40→24, BTN_W auto 68→140. Name moves to dedicated 28px clan-color strip at top (was overlay covering character); SPIRIT_ZONE_H 115→85 to fit; TILE_H kept 185 (200 would push goButton over 1280) | [`chore/draft-tile-wider-name-above.md`](chore/draft-tile-wider-name-above.md) | ✅ merged |
| [#168](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/168) chore — DraftScreen tile horizontal split. LEFT info col 100W (name strip + meta 2-line + A/B vertical stack) / RIGHT sprite col 172W full-height (~169px tall, 2× old 85). TILE_H kept 185 (200 over canvas budget). Sprite glow bg + aspect-preserved sprite | [`chore/draft-tile-horizontal-split.md`](chore/draft-tile-horizontal-split.md) | ✅ merged |
| [#164](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/164) s13-fx-02 — Streak multiplier fly-text + JP NT$ fly-in. New: src/fx/StreakFlyText.ts (gold ×N.N pop+trail+fade 1.0s, fire-and-forget), src/fx/JackpotFlyIn.ts (+N,NNN dramatic pop → trail-fly to both wallets via Promise.all → cascadeWallet 1.2s). BattleScreen wires streak fly after streakMult apply (fire-and-forget) + JP fly-in awaited after JackpotCeremony before wallet credit. Note: sos2-particles/fly-multiplier webp had no .atlas sidecar — trail uses Graphics circles | [`sprint13/s13-fx-02-streak-fly-jp-fly-in.md`](sprint13/s13-fx-02-streak-fly-jp-fly-in.md) | ✅ merged |
| [#165](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/165) chore HOTFIX — playAttackAnimations addSide closure adds activeAttackers/activeDefenders filter, three call sites patched (findIndex bestDrafted origin + 2× filter defender targets). Resolves chore #161 missed audit; SPIN no longer stuck after round 2-3. Post-mortem: chore #161 should have grepped ALL `cellsA[`/`cellsB[` index accesses, not just drawFormation/refreshFormation | [`chore/hotfix-attack-animations-active-units.md`](chore/hotfix-attack-animations-active-units.md) | ✅ merged |
| (roadmap) s13-fx-02 — Streak multiplier fly-text + JP fly-in (sos2-fly-multiplier + sos2-particles trail) | — | depends on s13-fx-01 |
| (next) chore — Spin BlurFilter ghost fix (root cause: setCellSymbol early-return when finalSymbol == currentSymbol skips filter reset, ~1-2 cell stuck per spin) + win cell circle ring frame (sequential per column alongside arrows) | [`chore/reel-blur-ghost-fix-and-win-ring.md`](chore/reel-blur-ghost-fix-and-win-ring.md) | dispatch ready |
| [#171](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/171) chore — Win-line sequential trace (連連看式中獎動畫). 3 commits: popCell helper (saves+restores existing GlowFilter, scale+0.3 peak Easings.pulse + temp glow + tint overlay) + drawArrow helper (sync glow underlay + main line + arrowhead, 100ms fade-in, returns Graphics ref) + pulseWay rewrite (sequential per-column pop + concurrent arrow fire-and-forget, 300ms hold + 220ms fade cleanup). A/B parallel via existing Promise.all | [`chore/win-trace-sequential-arrow.md`](chore/win-trace-sequential-arrow.md) | ✅ merged |
| [#170](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/170) chore — SlotReel 轉動視覺生動化. 3 commits in SlotReel.ts: (1) Y slide illusion — gemBall.y -CELL_H→0 per 65/93ms swap, symbols scroll down into cells; (2) BlurFilter strengthY 16 (outer) / 22 (centre slow-mo) re-applied after each setCellSymbol (which resets to GlowFilter) — auto-removed on lock; (3) Gold light streak Container per-col top/bottom 180ms fade in/out around spin window | [`chore/reel-spin-motion-vivid.md`](chore/reel-spin-motion-vivid.md) | ✅ merged |
| [#169](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/169) s13-fx-03 — Free Spin retrigger 「MORE SPINS!」 ceremony. New `src/fx/FreeSpinRetriggerCeremony.ts` 4-stage 1.6s: rainbow halo expand → 72pt MORE SPINS! gold + +N ROUNDS sub pop-in → 16 LightBall radial burst (sos2-bigwin) → fade. Wire fire-and-forget in refreshFreeSpinOverlay retrigger branch; mild 0.10 banner pulse retained | [`sprint13/s13-fx-03-freespin-retrigger-ceremony.md`](sprint13/s13-fx-03-freespin-retrigger-ceremony.md) | ✅ merged |
| (roadmap) sprint13 closure | — | depends on s13-fx-03 |
| (roadmap) s12-ui-03 — UiButton component rewrite (btn-normal + btn-ornate → Graphics gradient + border) | — | depends on s12-ui-02 |
| (roadmap) s12-ui-04 — SpiritPortrait component rewrite (portrait-ring → Graphics clan ring per mockup SpiritToken) | — | depends on s12-ui-03 |
| (roadmap) s12-ui-05 — SlotReel slot-frame + BattleScreen win-burst → Graphics | — | depends on s12-ui-04 |
| (roadmap) s12-ui-06 — Final cleanup (UI_ASSET_KEYS empty + LoadingScreen drop UI preload + delete remaining webp) | — | depends on s12-ui-05 |
| (roadmap) sprint12 closure | — | depends on s12-ui-06 |
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
