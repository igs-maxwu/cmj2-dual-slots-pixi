# Sprint 13 — SOS2 Animation Upgrade · Closure Report

**Sprint duration**: 2026-04-28 → 2026-04-29
**Status**: COMPLETE 3/3 + cross-cutting chore cluster + closure
**Trigger**: Sprint 12 末 owner 試玩後選擇 Path A — 「3 polish PR 用既有 SOS2 atlas/webp 升級機制觸發瞬間的視覺戲劇性」

---

## 1. Sprint 13 完整交付清單

### Sprint 13 主軸（3 fx PRs）

| # | PR | Size (add/del/files) | Scope |
|---|---|---|---|
| **s13-fx-01** | #159 | 113/0/2 | `FreeSpinEntryCeremony.ts` 新模組 — 7-stage 2.3s fire-text「FREE SPIN」declaration ceremony + BattleScreen await on trigger |
| **s13-fx-02** | #164 | 273/5/3 | `StreakFlyText.ts` + `JackpotFlyIn.ts` 雙模組 — Streak ×N.N fly-text (1.0s fire-and-forget) + JP +N,NNN dual-fly to wallets (1.2s await pre-cascade) |
| **s13-fx-03** | #169 | ~150/3/2 | `FreeSpinRetriggerCeremony.ts` 新模組 — 4-stage 1.6s rainbow halo + 「MORE SPINS!」 + 16 LightBall radial burst |
| **closure** | (this commit) | — | Sprint 13 closure report |

### Cross-cutting chore cluster（Sprint 13 期間并行 polish + bug fix）

| # | PR | Scope |
|---|---|---|
| chore | #161 | MAJOR/MINOR overflow + spirit 5v5 r2 真實 root cause + ball dark unified |
| chore | #162 | AUTO button 真功能化（spin selector + event-driven + stop conditions） |
| chore | #163 | HP bar 頭頂 → 腳底（踏板能量條） |
| chore | #165 | **HOTFIX** — playAttackAnimations chore #161 漏 audit point |
| chore | #166 | DraftScreen 圓頭像 → 全身立繪（initial） |
| chore | #167 | DraftScreen tile 加寬 152→296 + 名字移到 sprite 上方 |
| chore | #168 | DraftScreen horizontal split — 名字 LEFT / 人物 RIGHT 2× 大（FINAL） |
| chore | #170 | SlotReel 轉動視覺生動化 — Y slide + BlurFilter + 光束 streaks |

**Sprint 13 期間累計**：3 fx + 8 chore = **11 PRs**

---

## 2. Sprint 13 fx 三發 細節

### s13-fx-01 — Free Spin Entry Ceremony（#159）

**改善前**：f-04 simple banner + gold tint，1.5s
**改善後**：全螢幕 7-stage ceremony 2.3s

| Stage | Time | 視覺 |
|---|---|---|
| 1 | 0.0-0.3 | 暗 overlay fade in（focus attention） |
| 2 | 0.3-0.7 | sos2-declare-fire Fire_1 region 火焰 burst from centre |
| 3 | 0.7-1.0 | 「FREE SPIN」 80pt 金字 scale 0.5 → 1.2 pop |
| 4 | 1.0-1.3 | scale 1.2 → 1.0 settle + 副字「靈氣爆發 · 5 ROUNDS」fade in |
| 5 | 1.3-1.7 | hold + 火焰 Fire_6 region cycle |
| 6 | 1.7-2.0 | 全部 fade out |
| 7 | 2.0-2.3 | overlay 收 + cleanup |

**Asset**：`sos2-declare-fire.atlas` + `.webp`（既有 inventory，無新增）

### s13-fx-02 — Streak Multiplier Fly + JP NT$ Fly-In（#164）

**改善前**：M3 Streak 倍率乘到 coin/dmg 但**無視覺反饋**；M12 JP NT$ 直加 wallet 無過渡

**改善後**：

#### StreakFlyText.ts（fire-and-forget 1.0s）
- 連勝 ≥ 2 → 該側 reel center 飛出「×1.5」/「×2.0」/「×3.0」金字
- gold-glow 粒子軌跡（Graphics circles 50ms 間隔，fade 300ms）
- 終點：該側 wallet 文字位置，被吸收消失
- **不阻塞**：cascade / round loop 並行跑

#### JackpotFlyIn.ts（await 1.2s pre-cascade）
- JackpotCeremony 結束後，「+N,NNN」金字 dramatic pop in 中央
- **同步飛向 A 和 B 兩側 wallet**（Promise.all + 30ms 粒子間隔密 trail）
- 飛達後 fade，才呼叫 cascadeWallet
- 戲劇感最強：玩家視覺追蹤金額落入錢包

**Asset**：`sos2-fly-multiplier.webp` + `sos2-particles.webp`（既有，無 .atlas → 用 Graphics circles 替代 atlas region）

### s13-fx-03 — Free Spin Retrigger Ceremony（#169）

**改善前**：f-03 console log + banner 0.25s scale pulse 1.0→1.25→1.0（玩家容易錯過）

**改善後**：4-stage 1.6s 全螢幕 ceremony

| Stage | Time | 視覺 |
|---|---|---|
| 1 | 0.0-0.4 | sos2-rainbow-halo expand from centre（scale 0.3→1.3，alpha→0.85，blendMode add） |
| 2 | 0.4-0.8 | 「MORE SPINS!」 72pt gold + GlowFilter pop（scale 0.5→1.2）+ 「+5 ROUNDS」 28pt sub |
| 3 | 0.8-1.2 | 16 顆 LightBall（sos2-bigwin） radial burst（angle = i/16 × 2π，rotation + alpha pulse） |
| 4 | 1.2-1.6 | 全部 fade out + cleanup |

**Wire**：`refreshFreeSpinOverlay` retrigger branch fire-and-forget；保留 mild 0.10× banner pulse 提示

**Asset**：`sos2-rainbow-halo.webp` + `sos2-bigwin.webp`（既有，皆 j-04 同 atlas family）

---

## 3. Cross-cutting Chore Cluster（11 PRs 中的 8 個 chore）

### Bug & Audit Lessons

#### chore #161 — 5v5 spirit invisibility 真實 root cause
**Discovery**：chore #160 NINE_GAP fix 沒徹底 — 玩家仍看到「4v1 / 3v2」隨機。
**Real cause**：`createFormation` Fisher-Yates 把 5 spirit **散播到 9-elem array 隨機 idx 0-8**；`drawFormation` 只讀 `grid[0..4]` → idx ≥5 的 spirit 永遠不渲染（~2.78/5 per side 缺）。
**Fix**：`activeUnits = grid.filter(u !== null)` + read `activeUnits[slot]`。
**Lesson**：chore #160 NINE_GAP 是在錯的層級（視覺重疊是 decoy）。

#### chore #165 — HOTFIX：playAttackAnimations chore #161 漏 audit point
**Discovery**：chore #161 後 SPIN button stuck after round 2-3，console TypeError「Cannot read properties of undefined (reading 'container')」at playAttackAnimations。
**Real cause**：chore #161 修了 `drawFormation`/`refreshFormation` 但**漏改 playAttackAnimations**，仍用 raw 9-elem index access cellsA → 5/9 概率每 round 炸。
**Fix**：addSide closure 加 `activeAttackers/activeDefenders` filter（同 chore #161 pattern）+ 3 call sites patched。

#### **AUDIT LESSON LOCKED**（含進 MemPalace KG）
> 改變 data structure 語意（sparse → dense 等）時，**必須 grep ALL index access sites** 跨整 file，不只動「明顯的 2-3 個 function」。chore #161 漏 audit playAttackAnimations 即是反例。

### Feature & Polish

| chore | 內容 | 體驗影響 |
|---|---|---|
| #162 | AUTO 按鈕真功能化（popup selector + event-driven + stop on FreeSpin/JP/match-end） | demo trial 可一鍵跑 25-100 spin |
| #163 | HP bar 頭頂 → 腳底（踏板能量條 visual） | 戰場視覺更乾淨 |
| #166-168 | DraftScreen 3 輪迭代：full-body → wider tile → horizontal split（sprite 2× 大） | 第一眼體驗大幅升級 |
| #170 | SlotReel 轉動 Y slide + BlurFilter + 光束（programmatic-first） | reel 真的「在轉」不是閃換 |

---

## 4. Sprint 13 Exit Gate Checklist

- [x] s13-fx-01 Free Spin trigger 瞬間 fire-text ceremony 戲劇性（vs simple banner）
- [x] s13-fx-02 Streak ≥ 2 時 ×N.N 飛字 + JP NT$ trail-fly to wallet
- [x] s13-fx-03 Free Spin retrigger 全螢幕「MORE SPINS!」（vs console-only）
- [x] `npm run build` 過（每 PR 都 verified）
- [x] sim coin_rtp 維持 95-110%（純視覺 PRs，sim 路徑零變動）
- [x] FPS ≥ 50 during ceremony（DevTools Performance）
- [x] 無 ticker leak / Container destroy leak（每模組 destroy({children:true}) 證實）
- [x] 11 PRs 全 first-time merge（0 re-review iteration）

**Sprint 13 EXIT GATE PASS**

---

## 5. Bundle Impact

| 指標 | Sprint 12 end | Sprint 13 end | Δ |
|---|---|---|---|
| PWA precache entries | 126 | 126 | 0（沿用既有 SOS2 atlas / webp） |
| 新 fx modules | 3 (j-04, d-05, d-07) | **6** (+ FreeSpinEntry, StreakFlyText, JackpotFlyIn, FreeSpinRetrigger) | +3 |
| `src/fx/` 檔案 | 3 | **6** | +3 |

**Bundle size**：~+3KB（3 個小 fx module 純 TS 邏輯）

---

## 6. 累計戰績（Sprints 6+7+8+9+10+11+12+13 in single continuous session）

| Sprint | PRs | 主題 |
|---|---|---|
| 6 | 10 (#121-130) | Free Spin + Jackpot ship |
| 7 | 4 (#131-134) | Demo Polish |
| 8 | 1 + 5 docs (#135) | Pitch Prep Package |
| 9 | 5 + 1 doc (#136-140) | Pitch Feedback Response |
| Chore (Sprint 9-10 期) | 5 (#141, #146, #150-152) | Various bug fixes + manual SPIN |
| 10 | 4 + 1 doc (#142-145) | the-stylist Audit Response |
| 11 | 3 + 1 doc (#147-149) | Variant A Migration |
| 12 | 6 + 1 doc (#153-158) | UI Asset Decommission |
| **13** | **3 fx + 8 chore + 1 doc (#159-170)** | **SOS2 Animation Upgrade + DraftScreen redesign + AUTO/HP polish + reel-spin motion** |
| **TOTAL** | **49 PRs + 9 inline docs + Sprint 13 closure (this)** | **Single continuous session 2026-04-27 → 2026-04-29** |

| 指標 | 值 |
|---|---|
| **Spec drift hits** | 1 owner-approved (auto-loop → manual SPIN, #150) |
| **Iteration cap (P3) hits** | 0 |
| **Re-review iterations** | 0（每 PR 第一次 review 就 merge）|
| **HOTFIX 觸發** | 1 (chore #165, chore #161 audit miss) |
| **DraftScreen 迭代輪數** | 3 (#166→#167→#168，owner 主動 spec drift 朝 visual richer) |
| **Skill plugins activated** | 8 distinct |
| **debugging-and-error-recovery 5-step 強制觸發** | 2 次 (chore #160 partial / chore #161 真 root cause) |

---

## 7. 專案現況

```
✓ Demo-ready PWA (live URL)
✓ Balanced sim (RTP 95-110%, all SPEC §15 mechanics shipped)
✓ Variant A visual layout (JP HERO + NineGrid 5v5 + glossy ball)
✓ All 7 SPEC §15 mechanics shipped (M1/M2/M3/M5/M6/M10/M12)
✓ Match closure UX (ResultScreen)
✓ Manual SPIN button + AUTO real feature (popup + event-driven)
✓ AUTO/SKIP/PAYLINES indicators
✓ Pixel-perfect mockup compliance
✓ ZERO Gemini UI assets (all programmatic Pixi.Graphics)
✓ 4 SOS2 ceremonies (j-04 JP + s13 fx-01 FreeSpin entry + fx-02 Streak/JP fly + fx-03 retrigger)
✓ DraftScreen full-body horizontal-split spirit tiles (3-iteration polish)
✓ HP bar 踏板能量條 + reel spin Y-slide + BlurFilter + gold streaks
✓ Bundle compact: 126 PWA entries (Sprint 12 baseline maintained)
→ Awaiting owner trial of Sprint 13 fx triple + cross-cutting polish
```

**Live demo**: https://igs-maxwu.github.io/cmj2-dual-slots-pixi/

---

## 8. 已知 deferred 項目

- **RETREAT button 反應慢 UX**（owner 試玩反映；分類 UX 非 bug）
  - 候選 fix：onUnmount lazy destroy / click 即時 alpha 反饋 / screen transition 200ms fade
  - 推到下一 chore cluster
- **AI motion-blur 素材 hi-fi 路徑**（chore #170 走 programmatic-first 的 80% 視覺）
  - Owner 已 outline 3-layer 計畫（static / blur / vfx）+ Midjourney prompt 範例
  - 若 owner 試玩後仍想要 95% 視覺，下輪可走

---

## 9. Sprint 14 候選方向

### A. Owner 試玩 feedback driven
等 Sprint 13 三 fx + cross-cutting polish 試玩反映，spec drift 由 trial 決定。

### B. P2-B ROUND pill 簡化（micro PR）
Last unaddressed Sprint 10 audit item.

### C. Sprint 8 owner-data backfill（補 deck）
Slide 9 競品流水 / Slide 10 Phase 2 budget。

### D. RETREAT UX perf chore
若 owner 在 Sprint 13 試玩仍困擾，立刻一個 chore 修。

### E. AI motion-blur hi-fi（reel #170 升級路徑）
Midjourney 8 spirit 各生 motion-blur 素材 → import → swap。

### F. Deferred infra（Lighthouse / PWA / SFX）

### G. 機制改動（**not recommended pre-feedback**）

---

## 10. Closure Statement

**Sprint 13 — SOS2 Animation Upgrade — COMPLETE 3/3 + 8 cross-cutting chore + closure.**

Sprint 12 末 owner 選擇 Path A，承諾用既有 SOS2 inventory 升級「機制觸發瞬間」視覺戲劇性。Sprint 13 在 2 天（2026-04-28→29）內交付 3 個 fx ceremony PR：
- `FreeSpinEntryCeremony` 取代 simple banner（fx-01）
- `StreakFlyText` + `JackpotFlyIn` 補機制視覺反饋空缺（fx-02）
- `FreeSpinRetriggerCeremony` 取代 console-only retrigger pulse（fx-03）

期間并行交付 8 個 chore，覆蓋：5v5 spirit visibility 真 root cause（#161 + #165 hotfix）、AUTO 按鈕真功能化（#162）、HP bar 腳底（#163）、DraftScreen 三輪迭代到 horizontal split（#166→#168）、SlotReel programmatic spin motion（#170）。

**最重要的 audit lesson**（locked in MemPalace）：改 data structure 語意時 **必須 grep ALL index access sites**，不只動明顯的 2-3 function。chore #161 漏 audit playAttackAnimations 直接導致 SPIN stuck 復發 → chore #165 hotfix。

**Skill validation**：`debugging-and-error-recovery` 5-step 強制觸發 2 次（chore #160 partial / chore #161 真 root cause）；`incremental-implementation` 11 PR × ~2-4 commits = ~30 atomic commits 全 first-time merge；`source-driven-development` 用 console-instrument 對抗 hypothesis-first 失敗（chore #160 教訓）。

**Project state**：Variant A demo-ready PWA, full SPEC §15, 4 SOS2 ceremonies wired, DraftScreen full-body horizontal split, programmatic reel spin motion. Awaiting owner trial of Sprint 13 fx triple + cross-cutting polish to decide Sprint 14 spec.

**MemPalace closure refs**:
- Sprint 12: drawer `b859f3b2648d3d84`
- Sprint 13 in-progress: drawers `996c042b11f3b78d` (chore #160 era) + `07000e6b8d4ecc31` (chore #161-168 era)
- Sprint 13 final closure: this drawer (auto-generated below)
- Audit lesson KG: `audit-lesson → when_changing_data_structure → grep-ALL-index-access-sites`
