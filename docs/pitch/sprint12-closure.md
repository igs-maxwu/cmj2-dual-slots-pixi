# Sprint 12 — UI Asset Decommission · Closure Report

**Sprint duration**: 2026-04-28
**Status**: COMPLETE 6/6 + closure
**Trigger**: Owner reported「遊戲還是很多舊的圖耶 ... 之前用 gemini 產的邊框都不要了」after Sprint 11 trial

---

## 1. Sprint 12 完整交付清單

| # | PR | Size | Scope |
|---|---|---|---|
| **s12-ui-01** | #153 | 64/61/9 | 4 orphan webp delete + corner-ornament programmatic L-bracket + dragon-corner force-fallback |
| **s12-ui-02** | #154 | 35/41/5 | LoadingScreen logo-mark + divider → Graphics |
| **s12-ui-03** | #155 | 76/64/4 | UiButton component rewrite (Sprite → Graphics gradient + Rectangle hitArea) |
| **s12-ui-04** | #156 | 64/24/3 | SpiritPortrait clan-aware ring (mockup SpiritToken style) |
| **s12-ui-05** | #157 | 65/32/2 | SlotReel slot-frame + BattleScreen win-burst → Graphics |
| **s12-ui-06** | #158 | 6/84/10 | Final cleanup (delete remaining webp + GemMapping.ts dead file + LoadingScreen drop UI/gems preload) |
| **closure** | (this commit) | — | Sprint 12 closure report |

---

## 2. Decommission Summary（before / after）

### Before Sprint 12（end of Sprint 11 + chores）

```
public/assets/ui/
├── 13 webp (Gemini-produced UI borders / frames / buttons)
└── 2 PWA icon png

public/assets/symbols/gems/
└── 5 gem-shape webp (orphan since p11-vA-03 glossy ball)

src/config/
├── UiAssets.ts (UI_ASSET_KEYS = 13 entries)
└── GemMapping.ts (dead since p11-vA-03)
```

### After Sprint 12

```
public/assets/ui/
└── 2 PWA icon png ONLY

public/assets/symbols/  (entire directory removed)

src/config/
├── UiAssets.ts (UI_ASSET_KEYS = [] empty array, kept for future-proof)
└── (GemMapping.ts deleted)
```

**13 Gemini UI webp + 5 gem-shape webp + 1 dead config file = 19 files retired**

---

## 3. Asset → Programmatic Migration Map

| Asset (deleted) | Replaced by (programmatic Pixi.Graphics) | Sprint PR |
|---|---|---|
| `vs-badge.webp` | (already replaced by p11-vA-01 50px circle) | s12-ui-01 |
| `jp-marquee.webp` | (already replaced by p11-vA-01 hero panel) | s12-ui-01 |
| `hp-frame.webp` | (orphan, no replacement needed) | s12-ui-01 |
| `draft-tile-frame.webp` | (orphan, no replacement needed) | s12-ui-01 |
| `corner-ornament.webp` | `Decorations.ts` Graphics L-bracket (mockup CornerOrnament style) | s12-ui-01 |
| `dragon-corner.webp` | `SlotReel.buildFrame` programmatic L-bracket (was fallback since p10-bug-01) | s12-ui-01 |
| `logo-mark.webp` | `LoadingScreen` titleText 1.2× scale + dropShadow glow | s12-ui-02 |
| `divider.webp` | Graphics 1px hairline + center gold dot | s12-ui-02 |
| `btn-normal.webp` + `btn-ornate.webp` | `UiButton` 2-rect gradient + border + Rectangle hitArea | s12-ui-03 |
| `portrait-ring.webp` | `SpiritPortrait` 4-layer clan-aware ring (mockup SpiritToken) | s12-ui-04 |
| `slot-frame.webp` | `SlotReel` 3-stroke ornate + 4 corner dots | s12-ui-05 |
| `win-burst.webp` | `BattleScreen` Container with 3 concentric rings + 12 radial rays | s12-ui-05 |
| 5 gem-shape webp | (already replaced by p11-vA-03 glossy clan ball + Chinese char) | s12-ui-06 |

---

## 4. Sprint 12 Exit Gate Checklist

- [x] `public/assets/ui/` 只剩 `pwa-icon-192.png` + `pwa-icon-512.png`
- [x] `public/assets/symbols/` 整目錄不存在
- [x] `UI_ASSET_KEYS = []` empty array
- [x] LoadingScreen UI / gems preload 整段移除
- [x] `GemMapping.ts` 刪除
- [x] 視覺對齊 mockup variant-a — 所有 border / frame / button / decoration 純 Pixi.Graphics
- [x] `npm run build` 過（PWA precache 162→126 entries，-36 entries）
- [x] sim coin_rtp 維持 95-110%（純視覺 sprint，sim 路徑零變動）

**Sprint 12 EXIT GATE PASS**

---

## 5. Bundle Impact

| 指標 | Sprint 11 end | Sprint 12 end | Δ |
|---|---|---|---|
| PWA precache entries | 162 | 126 | **-36** |
| `public/assets/ui/` webp | 13 | 0 | -13 |
| `public/assets/symbols/gems/` webp | 5 | 0 | -5 |
| `src/config/*` files | UiAssets + GemMapping | UiAssets only | -1 |

Bundle size reduction estimate: ~400-500KB（webp + dead config + preload code removal）

---

## 6. 累計戰績（Sprints 6+7+8+9+10+11+12 in single continuous session）

| Sprint | PRs | 主題 |
|---|---|---|
| 6 | 10 (#121-130) | Free Spin + Jackpot ship |
| 7 | 4 (#131-134) | Demo Polish |
| 8 | 1 + 5 docs (#135) | Pitch Prep Package |
| 9 | 5 + 1 doc (#136-140) | Pitch Feedback Response |
| Chore | 5 (#141, #146, #150-152) | Various bug fixes + manual SPIN |
| 10 | 4 + 1 doc (#142-145) | the-stylist Audit Response |
| 11 | 3 + 1 doc (#147-149) | Variant A Migration |
| **12** | **6 + 1 doc (#153-158)** | **UI Asset Decommission** |
| **TOTAL** | **38 PRs + 9 inline docs** | **Single continuous session 2026-04-27→28** |

| 指標 | 值 |
|---|---|
| **Spec drift hits** | 1 owner-approved (auto-loop → manual SPIN, #150) |
| **Iteration cap (P3) hits** | 0 |
| **Re-review iterations** | 0（每張第一次 review 就 merge）|
| **Skill plugins activated** | 8 distinct |
| **Subagents dispatched** | the-stylist 1 次（Sprint 10）|

---

## 7. 專案現況

```
✓ Demo-ready PWA (live URL)
✓ Balanced sim (RTP 108.74%, all metrics in SPEC)
✓ Variant A visual layout (JP HERO + NineGrid + glossy ball)
✓ All 7 SPEC §15 mechanics shipped
✓ Match closure UX (ResultScreen)
✓ Battle pacing 4-stage 1.7s/round
✓ Manual SPIN button (auto-loop SPEC drift, owner-approved)
✓ AUTO/SKIP buttons + PAYLINES indicator
✓ Pixel-perfect mockup compliance
✓ ZERO Gemini UI assets — all programmatic Pixi.Graphics
✓ Bundle compact: -36 PWA entries from Sprint 11 baseline
→ Awaiting owner trial of fully cleaned visual
```

**Live demo**: https://igs-maxwu.github.io/cmj2-dual-slots-pixi/

---

## 8. Sprint 13 候選方向

### A. SOS2 Spine 動畫升級（**previous recommendation**）
3 polish PRs from the-stylist's earlier inventory of `slot-sos2-client-main`:
- s13-fx-01 Free Spin 進場 ceremony 升級（FG_Declare + FG_Declare_Fire）
- s13-fx-02 Streak multiplier fly-text + JP fly-in（FX_Fly_Multiplier）
- s13-fx-03 Free Spin retrigger 通知（FG_MoreSpins）

Bundle cost ~500KB（acceptable post-Sprint 12 -36 entries reduction）。

### B. 等下一輪 pitch / 試玩 feedback
Sprint 12 完整重做視覺 — owner 可重新試玩確認效果，再決定 Sprint 13 spec。

### C. P2-B ROUND pill 簡化（micro PR）
Last unaddressed Sprint 10 audit item.

### D. Sprint 8 owner-data backfill（補 deck）
Slide 9 競品流水 / Slide 10 Phase 2 budget。

### E. Deferred infra（Lighthouse / PWA / SFX）

### F. 機制改動（**not recommended pre-feedback**）

---

## 9. Closure Statement

**Sprint 12 — UI Asset Decommission — COMPLETE 6/6 + closure.**

Owner 在 Sprint 11 試玩後明確要求廢除所有 Gemini-produced UI 邊框/框/按鈕資產。Sprint 12 透過 6 個 atomic PRs 漸進式 audit + replace，所有 13 個 UI webp + 5 個 gem-shape webp + 1 dead config (GemMapping.ts) 全部退役，被純 Pixi.Graphics programmatic 等價物取代。

**Decommission methodology**:
1. Audit current usage (grep import + visual)
2. Replace each webp with programmatic Pixi.Graphics primary path
3. Verify no import + delete asset file
4. Update UI_ASSET_KEYS / config

**Skill validation**: `code-simplification` 主導 — 所有 PR 都是「廢 if-asset/else-fallback indirection → 直接 programmatic primary」pattern。`incremental-implementation` 確保每 PR 2-3 atomic commits 可獨立 revert。

**Bundle impact**: PWA precache 162 → 126 entries（-36），public/assets/ 從 30+ files 縮到 spirits + audio + fx + 2 PWA icon。

**Project state**: Variant A demo-ready PWA, fully programmatic UI layer, SPEC §15 7/7 mechanics, balanced sim, complete pitch material, zero Gemini-produced borders/frames/buttons. Awaiting owner trial of fully cleaned visual to decide Sprint 13 direction.

**MemPalace closure refs**:
- Sprint 11: drawer `c29e8b0b444501f8`
- Sprint 12: this drawer (auto-generated below)
