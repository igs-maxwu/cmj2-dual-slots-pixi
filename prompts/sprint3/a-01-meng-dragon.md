# Sprint 3 A · 01 — Meng Chenzhang signature（青龍雙劍斬）

## 1. Context

PR: **Sprint 3 A · 孟辰璋 dragon-dual-slash signature**

Why: Sprint 1 把 4 女性雀靈 signature 做完（Canlan X-cross / Luoluo triple-dash / Zhuluan dual-fireball / Zhaoyu python-summon），4 男用 `generic` placeholder。Sprint 3 A 補 4 男 signature；**本 PR 先做孟辰璋**（青龍男，雙劍），後續 3 支 PR 接續做 殷 / 玄墨 / 凌羽。

Source:
- SPEC §7 (spirit attack choreography)
- SPEC §11 Sprint 3 row
- PR #21 Canlan/Luoluo/Zhuluan/Zhaoyu signatures 作為結構模板（已在 master）

Base: `master` (HEAD `3870cbe` or later)
Target: `feat/sprint3a-meng-dragon-dual-slash`

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "Sprint 3 C4 male spirit signatures"` + `"Meng dragon sword azure dragon signature"`.

Known:
- 孟辰璋 Pinyin 識別符 `mengchenzhang`（**不可改**）
- SPEC §7.4 當時寫「男性 signature 留給 Sprint 3」— 本 PR 屬於 SPEC-aligned 實作
- 現有 `attackTimeline()` Phase 4 對 `generic` 走 `_fireShot + _screenShake`；本 PR 新增 `'dragon-dual-slash'` signature，只讓 mengchenzhang 換到新 signature

## 3. Task

### 3a. `src/screens/SpiritAttackChoreographer.ts`

**新增 signature type**（行 ~22–28 的 `SpiritSignature` union）：

```ts
| 'dragon-dual-slash'   // 孟辰璋 — twin jade swords + dragon-scale trail
```

順序放在 `'python-summon'` 之後、`'generic'` 之前。

**PERSONALITIES 更新**（找到 `mengchenzhang` 那筆）：

```ts
mengchenzhang: {
  signature: 'dragon-dual-slash',  // was 'generic'
  shakeIntensity: 'medium',        // keep existing values
  // ... 保留 prep/leap/hold/fire/return 時序
},
```

**新增 `_sigDragonDualSlash(ctx: Phase4Ctx): Promise<void>`**（放在 `_sigPythonSummon` 之後、`_screenShake` helper 之前）。

Phase 4 choreography（0.6–0.9 s 視覺重心）：

| t (ms) | 動作 |
|---|---|
| 0–120 | 兩把碧藍劍 Graphics 出現在 avatar 兩側（x offset `-28` / `+28`）；6 × 44 px 矩形，漸層 `#a0d8ff → #4a90e2` |
| 120–400 | 雙劍同步斜斬：左劍 rotation `-0.8 → -1.6` rad + translate 往 target 1；右劍 rotation `+0.8 → +1.6` rad + translate 往 target 2（若無則同 target 1） |
| 280–420 | 龍鱗粒子尾跡跟劍：12 小六角形 Graphics，tint `#1E90FF`，alpha `0.8 → 0`，隨劍路徑 jitter ±5 px |
| 400–520 | 擊中閃光：target cell 套 `GlowFilter({ distance: 16, outerStrength: 2.5, color: 0x4A90E2 })` + 白色 ScreenFlash overlay 80 ms alpha 0.4 |
| 520–640 | 雙劍 fade out + 粒子清理 + hitstop 60 ms |

**實作要點**：
- 參考 `_sigLightningXCross`（蒼嵐）的結構：Graphics 建在 `ctx.stage` 上，結束時全部 `.destroy()`
- 劍身用 `Graphics().rect(...).fill({ type:'linear', colorStops:[...] })` 金屬漸層
- 龍鱗粒子用 `Graphics().regularPoly(0, 0, 4, 6)` 或手畫 6-side polygon
- **單一 `Promise<void>` 回傳**，內部用 `tween` / `delay` / `Promise.all` 編排
- 所有 filter / graphics 在 signature 結束前清乾淨，避免 leak

**重用已有 helpers**（不重造）：
- `tween`, `delay`, `Easings` from `@/systems/tween`
- `_screenShake` 已在檔裡
- `Hitstop` from `@/fx/Hitstop`
- `GlowFilter` from `pixi-filters`（已裝）
- 若檔裡沒 `_flash` / `_screenFlash` helper，可自寫短版（10–15 行）

**時序對齊**：signature 總長 0.6–0.9 s 落在 `attackTimeline()` 現有 Phase 4 時間窗內（SPEC §7.2 表），外部 phase 架構**不改**。

### 3b. 檔案範圍（嚴格）

**修改**：`src/screens/SpiritAttackChoreographer.ts`（新 signature case + `_sigDragonDualSlash` 函式 + `PERSONALITIES.mengchenzhang` 一個欄位）

**禁止**：其他任何檔案。SPEC.md **不動**（§7.4 當時已預留，本 PR 只是落地實作）。若想改 SPEC，留給合併後另開 docs PR。

**若發現其他檔案 bug，STOP 回報，不要自己改。**

## 4. DoD (P1 — 逐字)

A PR is "done" when:

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

**DoD does NOT include**: preview visual verification, screenshot capture, manual gameplay testing.

特別提醒：
- 劍 Graphics / 粒子 Graphics 全部在 signature Promise resolve 前 `destroy()` — 必做 cleanup
- 不得 `await` signature 之後還讓 Phase 5 被推遲 — 總長保持 ≤ 0.9 s
- `SpiritAttackChoreographer.ts` 編輯 ≥ 3 次未收斂 → STOP 回報
- 音效 `skill-meng` 已在 `public/assets/audio/sfx/skill-meng.mp3` + `AudioManager`，本 PR **可選擇性** 在 signature 開頭加 `AudioManager.playSfx('skill-meng')`；若加請在 Handoff 註記

## 5. Handoff

回報格式：
- PR URL
- 1 行摘要
- Spec deviations：0（SPEC §7.4 預留的「Sprint 3 signature」實作到位）
- Dependencies：`pixi-filters` GlowFilter、`@/systems/tween`、可選 `AudioManager.playSfx`
- 有沒有加音效觸發（optional）
