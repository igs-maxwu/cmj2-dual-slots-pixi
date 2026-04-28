# Sprint 11 — Variant A Migration · Closure Report

**Sprint duration**: 2026-04-28
**Status**: COMPLETE 3/3 + closure
**Trigger**: Owner Sprint 10 試玩後決定改採 Claude Design 新版 Variant A mockup（更清楚的 hero JP + 9-grid formation + glossy clan ball）

---

## 1. Sprint 11 完整交付清單

| # | PR | Size | Scope |
|---|---|---|---|
| **p11-vA-01** | #147 | M (278/186/1) | Layout reset — JP HERO 178px + 「戰」 separator + arena 310px + VS 50px circle + reel SHARED BOARD header + log 185px |
| **p11-vA-02** | #148 | M (134/91/1) | NineGrid 3×3 formation — 5-of-9 Fisher-Yates seeded placement + depth scale 0.78→1.10 + B-side col mirror + render back-to-front z-order |
| **p11-vA-03** | #149 | S (90/21/1) | Gem reskin — drop gem-shape PNG → glossy clan ball + 青/白/朱/玄/替/咒/散/寶 中文字 |
| **closure** | (this commit) | — | Sprint 11 closure report |

---

## 2. Owner 兩個前置決策（已套用）

| 決策 | 採取路徑 |
|---|---|
| Spirit 立繪 | **保留既有 `public/assets/spirits/*.webp`**（同一批角色，新提供的 figures/*.png 是 duplicate）|
| Gem 視覺 | **接受 reskin** — 從 5 shape PNG → glossy ball + 中文字（d-02 5-shape lineage 廢棄）|

---

## 3. Variant A 視覺架構（locked post-Sprint 11）

```
y=0-60      Compact header — RETREAT | ROUND | wallet A/B
y=70        「— THE POOL OF EIGHT SEAS —」 label 9pt
y=88-220    JP HERO marquee 132px — dark warm bg + bulbs decoration
              + GRAND 42pt Cinzel gold + GlowFilter 2.5
              + MAJOR/MINOR 16pt cream side-by-side bottom
y=255-275   「戰」 zone separator — gold hairline + 戰字 14pt
y=285-595   Battle arena 310px hero
              ├─ Side banners 「A · 我方陣營」(L) / 「對手陣營 · B」(R)
              ├─ NineGrid 3×3 per side — 5 spirits at deterministic
              │     Fisher-Yates positions, depth scale 0.78→1.10
              ├─ B-side col mirror (front faces A)
              └─ VS 50px circle at y=415 (in arena center gap)
y=615-955   Reel zone 340px — 1 shared 5×3 SHARED BOARD
              ├─ Header strip y=587: A · 我方 ◇ SHARED BOARD ◇ B · 對手
              └─ Cells 124×100 with: glossy clan ball + Chinese char
                   + GlowFilter + p10-v02 inner ring + tier pip
                   + d-06 wayhit highlight overlay
y=1055-1240 Battle log 185px panel — cream 13pt
```

---

## 4. Sprint 11 Exit Gate Checklist

- [x] BattleScreen layout 對照 Variant A mockup 整體一致（zone hierarchy / 配色 / 字體 / 元素位置都對齊）
- [x] 9-cell formation per side，5 spirit per-mount Fisher-Yates 確定性放置（同場 reload 一致 / 不同場不同）
- [x] Reel gem 為「glossy 圓球 + 中文字」風格，clan 識別清楚（青龍/白虎/朱雀/玄武 一目了然）
- [x] 「戰」字 separator 在 JP 與 arena 之間視覺區隔
- [x] 沒有 SPIN/AUTO/SKIP 按鈕、沒有 PAYLINES indicator
- [x] `npm run build` 過（3 PRs 全綠）
- [x] sim coin_rtp 維持 95-110%（純視覺 sprint，sim 路徑零變動）

**Sprint 11 EXIT GATE PASS**

---

## 5. Path 1 SPEC 守則維持

Mockup 有 / 我們刪：
- ❌ SPIN / AUTO / SKIP 按鈕（auto-loop SPEC，無手動 spin）
- ❌ PAYLINES 1-10 indicator（243-Ways evaluation，無固定 paylines）
- ❌ A·YOUR TURN / B·WAITING（simultaneous spin，無回合制）— 改成靜態「A·我方 / B·對手」label
- ❌ 2 個獨立 3×3 reel（mockup variant B 假設）— 採 1 個 shared 5×3（SPEC §3）

10 sprint 累積 23 PRs 投資在 shared-grid + auto-loop 機制（FreeSpin / JP / Resonance / Curse 等），**Path 1 守得住**。

---

## 6. 累計戰績（Sprints 6+7+8+9+10+11 in single continuous session）

| Sprint | PRs | 主題 |
|---|---|---|
| 6 | 10 (#121-130) | Free Spin + Jackpot ship |
| 7 | 4 (#131-134) | Demo Polish |
| 8 | 1 PR + 5 docs (#135) | Pitch Prep Package |
| 9 | 5 PRs + 1 doc (#136-140) | Pitch Feedback Response |
| Chore | 2 (#141, #146) | LoadingScreen + 3-row formation bug fixes |
| 10 | 4 PRs + 1 doc (#142-145) | the-stylist Audit Response |
| 11 | 3 PRs + 1 doc (#147-149) | Variant A Migration |
| **TOTAL** | **29 PRs + 8 inline docs** | **Single continuous session 2026-04-27→28** |

| 指標 | 值 |
|---|---|
| **Spec drift hits** | **0** |
| **Iteration cap (P3) hits** | **0** |
| **Re-review iterations** | **0**（每張第一次 review 就 merge）|
| **Skill plugins activated** | 8 distinct |
| **Subagents dispatched** | the-stylist 1 次（Sprint 10 audit）|

---

## 7. 專案現況

```
✓ Demo-ready PWA (live URL with ?demo=1 capture mode)
✓ Balanced sim (RTP 108.74%, all metrics in SPEC band)
✓ Variant A visual layout complete:
    ├─ JP HERO marquee dominates upper third
    ├─ NineGrid 3×3 spirit formation with depth illusion
    ├─ Glossy clan ball reel (青/白/朱/玄/替/咒/散/寶)
    └─ Battle log + RETREAT in compact header
✓ All 7 SPEC §15 meta mechanics shipped (M1-M3, M5-M6, M10, M12)
✓ Match closure UX (ResultScreen + MatchResult)
✓ Battle pacing 4-stage 1.7s/round breath
✓ Complete pitch material (deck + video + one-pager)
→ Ready for round 4 pitch feedback
```

**Live demo**: https://igs-maxwu.github.io/cmj2-dual-slots-pixi/?demo=1

---

## 8. Sprint 12 候選方向

### A. **SOS2 Spine 動畫升級**（推薦）⭐
基於前面對 `download_picture/slot-sos2-client-main` 與 `download_picture/cny` 兩個 SOS2 Spine 資產源的盤點，3 個 Priority polish PR 可加：

| PR | 用途 | Cost | 視覺增益 |
|---|---|---|---|
| s12-fx-01 | Free Spin 進場 ceremony 升級（取代 f-04 banner，用 FG_Declare + FG_Declare_Fire 火焰文字宣告） | M (~2 day, +200KB asset) | **大**（最弱 placeholder 變最戲劇性） |
| s12-fx-02 | Streak multiplier 飛字 + JP 數字 fly-in（用 FX_Fly_Multiplier magic particle 軌跡） | M (~1.5 day, +150KB) | **中** |
| s12-fx-03 | Free Spin retrigger 通知（用 FG_MoreSpins 文字 ceremony） | S (~半 day, +100KB) | **小** |

**不採用**：Spine character runtime / 11 animated symbols（cost 大且與 4 聖獸主題 / glossy ball 衝突）。

### B. 等下一輪 pitch feedback
若 Sprint 11 升級後 owner 想再拍 demo 給高層 → 收 round 4 feedback → Sprint 12 spec 由 feedback 信號決定。

### C. P2-B ROUND pill 簡化（micro PR）
the-stylist Sprint 10 audit P2-B 唯一未處理項。Tiny ~5 行。

### D. 既有 owner-data 補完（Sprint 8 deck）
Slide 9 競品流水 / Slide 10 Phase 2 budget 紅框 flag 還在。Owner 給數字 → 我 edit + regenerate pptx。

### E. Deferred infra（Lighthouse / PWA / SFX）

### F. 機制改動（**not recommended pre-feedback**）

---

## 9. Closure Statement

**Sprint 11 — Variant A Migration — COMPLETE 3/3 + closure.**

Owner 看完 Sprint 10 後決定切到 Claude Design 新版 Variant A，包含 NineGrid 3×3 formation + glossy clan ball + JP HERO marquee。Sprint 11 三 PR 嚴守 Path 1（保 SPEC，棄 mockup 不適用元素）：

- p11-vA-01 Layout reset：JP 從 thin 64px → HERO 178px / arena 從 hero 520px → 310px
- p11-vA-02 NineGrid：1-2-2 三排（chore #146）→ 3×3 9-cell + Fisher-Yates 5-of-9 seeded
- p11-vA-03 Gem reskin：5-shape PNG → glossy ball + 青/白/朱/玄/替/咒/散/寶

29 PRs 累積投資 (Sprint 6-11) 在 shared-grid + auto-loop 機制完整保留 — **zero spec drift across 11 sprints in single session**。

**Project state**: Variant A demo-ready PWA + balanced sim + 完整 pitch material + 4-stage pacing + audit-clean 視覺 + match closure UX + 9-grid formation depth + glossy ball clan readability。

**MemPalace closure refs**:
- Sprint 10: drawer `6877a864bb5bf100`
- Sprint 11: this drawer (auto-generated below)
