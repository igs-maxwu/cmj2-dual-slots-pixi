# Sprint 15 — Polish Cluster + Process Evolution · Closure Report

**Sprint duration**: 2026-04-29 → 2026-05-05 (7 days)
**Status**: COMPLETE 22/22 chores + closure
**Trigger**: Owner trial of Sprint 14 fx triple → discovered cascading polish needs (attack VFX, mercenary mechanic, reel visual, UiButton, perf)

---

## 1. Sprint 15 完整交付清單

### Cluster 1: 22 chores merged (#184 + #185-205)

| # | Theme | Scope |
|---|---|---|
| **#184** | Sprint 14 cleanup | gridPlacement dead field + JSDoc 5-row update |
| **#185** | Attack 衝擊感 4 強化 | A 受擊 + B 命中 burst + C dmg punch + G 同步 timing |
| **#187** | STRICT mercenary spec | unpicked → 0 reward / 0 dmg / 0 trace, alive-gate dmg drafted-only |
| **#188** | popDamage sparse-to-dense | DmgEvent slotIndex 9-elem grid → 5-elem cells |
| **#189** | fxLayer zIndex 3000 | dmg numbers + hit burst above attack avatar |
| **#190** | Console warnings cleanup | favicon link + halo preload + filter warm-up + audit defer |
| **#191** | Resonance banner dual-side | A 左藍 / B 右紅 |
| **#192** | Spin timing simultaneous start | 5 cols start t=0, lock 600/1100/1610 staggered |
| **#193** | Banner zIndex + center pre-flash parallel | banner z=3500 + spinColumnCenter pre-flash await→void |
| **#194** | Attack uniform clash scale | CLASH_SCALE=1.0 lerp Phase 2/5 |
| **#195** | Decorations Graphics→Container | Pixi v9 deprecation fix corner parent |
| **#196** | Banner y → ZONE_SEP_Y(262) + zIndex 5000 | topmost + 戰 separator zone |
| **#197** | Pip circle → 5-point star ⭐ | RPG rarity feel |
| **#198** | Reel ball → pentagon + 8 unique colors | SPEC drift from chore #173 same-clan |
| **#199** | Shape by tier ◇⬠⬢⬤ + ⭐ 7px | shapeFor() dispatcher per symId tier |
| **#200** | GemSymbol component + DraftScreen tile | shared component + gem icon + meta 12pt + A\|B horizontal |
| **#201** | Tile micro-tune | meta 12→14pt / gem r 18→24 / 玄墨 0x9a4adb→0xb567f0 brighter |
| **#202** | Gem highlight match shape (GemSymbol) | polygon facet replaces ellipse on non-circle gems |
| **#203 HOTFIX** | SlotReel inline highlight sync | chore #202 audit miss caught by owner — apply same shape branch |
| **#204** | UiButton aesthetic upgrade | FillGradient 3-stop + double border + corner dots + DropShadowFilter |
| **#205 perf** | UiButton DropShadow → inline 3-layer | filter audit ~26 active during gameplay → ~21 after, mobile fps |
| **closure** | (this commit) | Sprint 15 closure report |

---

## 2. Sprint 15 主軸群組

### A. Attack & Damage Polish (#185 / #187 / #188 / #189)

#### #185 — Attack 衝擊感 4 大強化
新 onFireImpact callback (Phase 4 同步)：
- **A**: defenderHitReact (shake ±6px sine + 紅 tint overlay 250ms)
- **B**: spawnHitBurst (12 ray radial 180ms)
- **C**: popDamage 3-stage punch (0→1.5→1.0 + float + fade 800ms total)
- **G**: 受擊 + burst 跟 signature fx **並行**（不再串聯）

#### #187 — STRICT mercenary mechanic SPEC drift
Owner-approved 2026-05-04: 嚴格版「沒選中 = 0 reward + 0 dmg + 0 trace」
- SlotEngine drops mercenary wayHit early-continue
- 4 BattleScreen dmg accumulator blocks alive-gated (base / resonance ×0.5 / dragon ×0.2)
- Wild ×2 multiplier preserved
- Pre-merge review caught dragon-bonus alive-gate gap (executor fixed in revision)

#### #188 HOTFIX — popDamage sparse-to-dense
chore #181 missed audit — distributeDamage returns 9-elem grid slotIndex but slotToArenaPos uses 5-elem dense post-#181. Build sparseToDense map at playDamageEvents.

#### #189 — fxLayer zIndex 3000
fxLayer 預設 z=0 被 attack avatar (z=1500) 蓋過 → bump to 3000 above all spirits.

---

### B. Resonance + Spin Timing (#191 / #192 / #193 / #196)

#### #191 — Resonance banner dual-side display
playResonanceBanner refactored to dispatcher + playSideResonanceBanner helper. A side x=CANVAS_WIDTH×0.27 blue, B side ×0.73 red. Native Text replaces goldText.

#### #192 — Spin timing simultaneous start
Removed 2x await delay(500). All 5 cols start t=0; lock 600/1100/1610 staggered. spinMs 510/510/310 → 510/1010/1320.

#### #193 — Banner z=3500 + center pre-flash parallel
spinColumnCenter pre-flash await→void+then() so center swap starts at t=90 like outer/inner. spinMs 1320→1520 maintains lock 1610.

#### #196 — Banner y → ZONE_SEP_Y(262) + zIndex 5000
Banner moved from mid-arena (y=380) to 戰 separator zone. zIndex bumped to 5000 (above fxLayer 3000).

---

### C. Reel + DraftScreen Visual Evolution (#173 → #197 → #198 → #199 → #200 → #201 → #202 → #203)

5-axis spirit recognition system:

1. **Shape** (#199): ◇ low / ⬠ mid / ⬢ high / ⬤ specials
2. **Color** (#198/#201): 8 unique gem colors per spirit, bright 玄墨
3. **Char** (#173): 末字 寅鸞雨璋嵐洛羽墨 + W/S/JP
4. **Pip stars** (#197/#199): 1/2/3 ⭐ at 7px
5. **Highlight** (#202/#203): polygon facet OR ellipse per shape

Architecture: `src/components/GemSymbol.ts` shared component (chore #200) — exports shapeFor / polygonPoints / SYMBOL_VISUAL / drawGemSymbol. Used by DraftScreen tile (small icon).

DraftScreen tile redesign (#200):
- TILE_W 296, TILE_H 185 (chore #168 inherit)
- LEFT info col (100W): name strip + meta 14pt + GemSymbol r=24 + A|B horizontal
- RIGHT sprite col (172W): full-body spirit (chore #168 inherit)

---

### D. UI/UX Polish (#194 / #195 / #204 / #205)

#### #194 — Attack uniform clash scale
CLASH_SCALE=1.0 const. Phase 2 lerps origAbsScale→CLASH during leap. Phase 3-4 use uniform CLASH × phase factor. Phase 5 lerps back. Slot's base scale (0.85-1.10) preserved on return.

#### #195 — Decorations Graphics→Container (Pixi v9 prep)
Owner stack trace pinpointed chore #190 audit miss. Decorations.addCornerOrnaments corner parent changed from Graphics to Container.

#### #204 + #205 — UiButton aesthetic + perf
JP marquee style: FillGradient 3-stop + double border + corner dots. **Performance trade**: DropShadowFilter on 5 buttons pushed filter count to 26 → mobile fps drop. **#205 fix**: inline 3-layer dark roundRect shadows (0 filter cost). Net visual ~80%, perf restored.

---

## 3. Process Improvements (CRITICAL)

### Pre-merge review process (Sprint 14 introduced)
Sprint 15 had pre-merge review applied **~16 times across 22 chores**. Catch rate evolved:
- Sprint 14: caught 1 functional bug (chore #187 dragon bonus)
- Sprint 15: caught 0 — but **failed once** (chore #202 highlight not synced to SlotReel inline copy → #203 HOTFIX)

### Owner confrontation: "你做 code review 有確實嗎?"
2026-05-05 mid-cluster, after chore #202 highlight fix didn't apply to reel. Honest answer: NO — failed to grep SlotReel inline copy after GemSymbol component extraction.

### NEW Audit Lesson #6 LOCKED
**When extracting component or changing pattern, MUST grep ALL inline copies codebase-wide** — not just review the PR diff. chore #202 violated this; chore #203 hotfix.

### Cherry-pick Saga (10 times)
Executor "direct commit to feat branch" pattern continued throughout Sprint 15. Implementation commits routinely landed on feat branches but NOT on master. Orchestrator pre-merge review now MANDATORY:
```bash
git pull origin master
git log --oneline origin/master | head -5  # verify implementation actually on master
git status                                   # confirm correct branch
```

Sprint 15 cherry-pick count: ~10. Bulk closed all 14 orphaned PRs at sprint end.

### Process improvement (locked for future sprints)
After cherry-pick, immediately `gh pr close --comment` to keep GitHub clean. Sprint 16 onwards.

---

## 4. Audit Lessons Locked (6 lessons in MemPalace KG)

| # | Lesson | Triggers |
|---|---|---|
| 1 | grep ALL index access sites when changing data structure | #161/#181/#191/**#202** (4× violations) |
| 2 | Pixi 8 Graphics + offset + eventMode='static' needs explicit Rectangle hitArea | #151/#152/#176 |
| 3 | setCellSymbol early-return trap — explicit filter reset at lock | #170/#172 |
| 4 | Pixi 8 Sprite.width/height vs scale.set conflict — Container wrap | #177/#178 |
| 5 | Multi-source scale.x flip can double-cancel | #179/#182/#183 |
| **6** | **NEW**: When extracting component, grep ALL inline copies | **#200/#202/#203** |

Lesson #1 violated 4 times despite being locked since Sprint 13 — process discipline needed.

---

## 5. Sprint 15 Exit Gate Checklist

- [x] Attack 衝擊感 4 強化（#185 hit reactions + sync timing）
- [x] STRICT mercenary mechanic（#187 owner-approved spec drift）
- [x] popDamage 位置正確（#188 sparse-to-dense fix + #189 zIndex topmost）
- [x] Spin timing 同時開始（#192/#193 simultaneous start + center sync）
- [x] Resonance banner 雙側 + topmost（#191/#193/#196 dual color + zIndex 5000 + 戰 zone）
- [x] Attack uniform clash scale（#194 fairness across rows）
- [x] Reel + DraftScreen 5-axis recognition（#197-203 完整視覺重做）
- [x] GemSymbol component shared (#200 architecture)
- [x] UiButton JP marquee aesthetic + mobile fps（#204+#205 trade-off resolved）
- [x] Pixi v9 deprecation prep（#195/#203 Graphics→Container）
- [x] Console clean（#190 4-item cleanup）
- [x] `npm run build` 過（every chore verified）
- [x] **6 audit lessons locked in MemPalace KG**
- [x] Pre-merge review process active (10 cherry-pick saves)
- [x] 14 orphaned PRs closed at sprint end

**Sprint 15 EXIT GATE PASS**

---

## 6. Bundle Impact

| 指標 | Sprint 14 end | Sprint 15 end | Δ |
|---|---|---|---|
| PWA precache entries | 126 | 126 | 0 (no new asset) |
| `src/components/` files | (UiButton/GoldText/SpiritPortrait/Decorations) | + GemSymbol.ts | +1 |
| Always-on filters during gameplay | ~26 | ~21 | -5 (chore #205) |
| Gem visual axes | 2 (color + char) | **5** (shape + color + char + pip + highlight) | +3 |

---

## 7. 累計戰績（Sprints 6-15 in single continuous session 2026-04-27 → 2026-05-05）

| Sprint | PRs/commits | 主題 |
|---|---|---|
| 6 | 10 (#121-130) | Free Spin + Jackpot ship |
| 7 | 4 (#131-134) | Demo Polish |
| 8 | 1 + 5 docs (#135) | Pitch Prep Package |
| 9 | 5 + 1 doc (#136-140) | Pitch Feedback Response |
| Chore (S9-10 期) | 5 (#141, #146, #150-152) | Various bug fixes + manual SPIN |
| 10 | 4 + 1 doc (#142-145) | the-stylist Audit Response |
| 11 | 3 + 1 doc (#147-149) | Variant A Migration |
| 12 | 6 + 1 doc (#153-158) | UI Asset Decommission |
| 13 | 3 fx + 8 chore + 1 doc (#159-170) | SOS2 Animation Upgrade |
| 14 | 13 chore + 1 doc (#171-183) | Polish + Pre-merge Review Process |
| **15** | **22 chore + 1 doc (#184-#205)** | **Polish Cluster + Process Evolution + Symbol Visual Full Redesign** |
| **TOTAL** | **92 commits + 12 inline docs** | **Single continuous session 2026-04-27 → 2026-05-05 (9 days)** |

| 指標 | 值 |
|---|---|
| **Spec drift hits** | 5 (manual SPIN / mercenary strict / SYMBOL_VISUAL evolution / DraftScreen tile / UiButton perf) |
| **Iteration cap (P3) hits** | 0 |
| **HOTFIX 觸發** | 6 (#165 / #172 / #178 / #179 / #183 / #188 / #203) |
| **Cherry-pick saga** | 10 (Sprint 15 alone) |
| **Audit lessons locked** | 6 |
| **Largest single sprint** | **Sprint 15: 22 chores** |

---

## 8. 專案現況

```
✓ Demo-ready PWA (live URL)
✓ Balanced sim mechanic (RTP target +/- mercenary 30% removal — sim verification pending)
✓ Variant A visual layout
✓ All 7 SPEC §15 mechanics shipped (M1/M2/M3/M5/M6/M10/M12)
  - M6 Curse: Path L disabled (weight=0, mechanic preserved)
  - mercenary: STRICT spec — unpicked spirits score zero (chore #187)
✓ Reel visual: 5-axis spirit recognition (shape + color + char + pip + highlight)
✓ DraftScreen tile: full-body sprite + horizontal A|B + gem icon parity to reel
✓ Attack: full-body spirit container moves (no clone), uniform clash size, 4-action hit reaction sync
✓ Banner: dual-side resonance (blue/red), topmost zIndex 5000
✓ Spin: 5 cols simultaneous start, staggered stop in 3 stages
✓ AUTO: continues through Free Spin, popup count selector, stop on JP/match-end
✓ Mobile fps: ~21 active filters, perf-conscious UiButton
✓ Pixi v9 prep: Graphics→Container partial (Decorations + UiButton)
✓ ZERO Gemini UI assets (Sprint 12 baseline maintained)
✓ Bundle: 126 PWA entries unchanged
→ Awaiting owner trial of complete Sprint 15 polish
```

**Live demo**: https://igs-maxwu.github.io/cmj2-dual-slots-pixi/

---

## 9. 已知 deferred 項目

- **gemBall GlowFilter optimization** — 15 always-on filters; can lazy-apply (only on lock, remove during spin)
- **SlotReel inline ball drawing → use drawGemSymbol** — refactor to fully use GemSymbol component (currently SlotReel duplicates inline shape/highlight, only chore #203 synced highlight)
- **Pixi v9 full migration** — Graphics→Container prep partial (chore #195/#203). Need full audit when v9 ships.
- **Sim RTP verification post chore #187** — mercenary 30% removal expected RTP drop, may need base mult adjustment
- **`gh pr close` automation** — orchestrator should close PRs immediately after cherry-pick to keep GitHub clean

---

## 10. Sprint 16 候選方向

### A. Owner trial-driven polish
等 Sprint 15 整體試玩反饋。

### B. Sim RTP rebalance (chore #187 followup)
Run sim, check if RTP outside 95-110%. Adjust base mult if needed.

### C. gemBall GlowFilter lazy optimization
Reduce always-on filter count from ~21 to ~10 for stronger mobile fps.

### D. Pixi v9 full migration audit
Comprehensive grep for remaining Graphics-as-parent patterns.

### E. P2-B ROUND pill simplification (Sprint 10 deferred)

### F. Sprint 8 deck owner-data backfill
Slide 9 competitor data + Slide 10 Phase 2 budget.

### G. AI motion-blur asset hi-fi (chore #170 upgrade path)

---

## 11. Closure Statement

**Sprint 15 — Polish Cluster + Process Evolution — COMPLETE 22/22 + closure.**

Sprint 14 末 owner 試玩 fx triple 後，surface 一系列重大 polish needs：attack VFX 衝擊感不足、mercenary 機制太鬆、reel 寶石需要重新設計、DraftScreen tile 需重排、UiButton 美觀升級、效能 budget 緊。Sprint 15 在 7 天內交付 22 個 chore，覆蓋 attack VFX (#185) → mechanic (#187) → damage display (#188/#189) → console cleanup (#190) → resonance + spin timing (#191-#196) → reel symbol full redesign (#197-#203) → UiButton + perf (#204-#205)。

**最重要 single delivery**：reel + DraftScreen 5-axis spirit recognition 系統建立。每隻 spirit 可從 5 個維度識別（形狀 / 顏色 / 字 / pip / highlight），DraftScreen tile 跟 reel 視覺一致 — 透過新 GemSymbol component (chore #200) 共用 source-of-truth。

**Process evolution**：
- Pre-merge review 第 16 次套用，第 1 次失誤（chore #202 漏 grep SlotReel inline → #203 hotfix）
- Owner confrontation 「你做 code review 有確實嗎?」直接 trigger lesson #6 lock：「component 抽出後必 grep all inline copies」
- Cherry-pick saga 10 次 — executor direct-commit pattern 仍未根治，orchestrator 主動驗證 origin/master 已成 mandatory step
- 14 orphaned PRs 於 sprint 末批次關閉

**Skill validation**：
- `incremental-implementation` — 22 chores × 1-3 atomic commits
- `debugging-and-error-recovery` — chore #161/#202 5-step instrument-first 救援
- `source-driven-development` — chore #200 component extraction 抽 GemSymbol 共用
- **NEW**: codebase-wide grep meta-skill — chore #203 后立刻成為 standard pre-merge step

**Project state**：Variant A demo-ready PWA, 5-axis reel recognition, attack VFX 衝擊感完整, mercenary STRICT spec, 反光 facet 對應 shape, UiButton 立體感保留 0 filter cost. Awaiting owner trial of complete Sprint 15 polish.

**MemPalace closure refs**:
- Sprint 14: `docs/pitch/sprint14-closure.md` + drawer
- Sprint 15: this drawer (auto-generated below)
- Audit lessons 1-6: 6 KG facts (`audit-lesson-N` subjects)
- Reel visual evolution: drawer `f1abf0b9c67f6acd` (mid-cluster snapshot)
- Sprint 15 final state: drawer `ca60e04a93adc251`
