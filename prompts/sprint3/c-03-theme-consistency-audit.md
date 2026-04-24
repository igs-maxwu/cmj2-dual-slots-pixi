# Sprint 3 C · 03 — Theme Consistency Audit（只收 FXAtlas + UiButton 兩檔硬碼）

## 1. Context

PR: **掃描 src/ 硬碼 hex 色碼，把應該走 DesignTokens 的收斂回來**

Why: Sprint 3 收尾 polish。掃描結果 44 處 hex literals：
- 25 處屬合理設計（`0xffffff` 白閃、FX 局部 tint、每雀靈 particleColor）→ **不改**
- 11 處該集中管理（UiButton UI 狀態色 + FXAtlas.clanTint 4 clan 色）→ **本 PR 收斂**
- 8 處 SpiritAttackChoreographer.PERSONALITIES.particleColor → **不改**（已在單一 config block，是每雀靈專屬 accent）

Source:
- `src/fx/FXAtlas.ts` line 170-178 `clanTint()` 目前 manual-sync CLAN 4 色
- `src/components/UiButton.ts` line 80, 93, 98, 103, 111, 115, 119 共 7 處 `this.bg.tint = 0x...`
- `src/config/DesignTokens.ts` 有 `CLAN` block（line 66）和 `GOLD` block（line 31），需新增 `TINT` block

Base: master HEAD
Target: `chore/sprint3c-03-theme-audit`

## 2. Spec drift check (P6)

1. `mempalace_search "theme consistency audit DesignTokens UiButton FXAtlas clanTint"`
2. 確認 `CLAN` export 在 DesignTokens.ts 存在（grep `export const CLAN`）
3. 確認 `FXAtlas` 的 clanTint 函式簽章現狀：

```ts
export function clanTint(clan: 'azure' | 'white' | 'vermilion' | 'black'): number {
  switch (clan) {
    case 'azure':     return 0x38b6f5;
    // ...
  }
}
```

4. 若任一常數已被 refactor 過（已從 CLAN import 等），STOP 回報

## 3. Task

### 3a. `src/config/DesignTokens.ts` — 新增 `TINT` block

在 `GLOW` block **之後**（約 line 112 後）加入：

```ts
// ─── UI tint states — for Sprite.tint control (UiButton 等) ───────────────
// identity = no color shift; disabled = desaturate; hover = warm gold pale;
// pressed = darker gold-deep.  Reuse these instead of hardcoding tint literals.
export const TINT = {
  identity: 0xFFFFFF,   // no shift (Pixi default)
  disabled: 0x555555,   // mid-grey, reads as desaturated
  hover:    0xFFE8A8,   // gold pale (matches GOLD.pale)
  pressed:  0xB88A40,   // gold shadow-deep
} as const;
```

### 3b. `src/fx/FXAtlas.ts` — import CLAN from DesignTokens

目前 `clanTint()` 硬碼 4 個 hex，改為：

```ts
// top of file, with other imports
import { CLAN } from '@/config/DesignTokens';

// ...

export function clanTint(clan: 'azure' | 'white' | 'vermilion' | 'black'): number {
  switch (clan) {
    case 'azure':     return CLAN.azure;
    case 'white':     return CLAN.white;
    case 'vermilion': return CLAN.vermilion;
    case 'black':     return CLAN.black;
  }
}
```

**移除** 原本 comment「Colours mirror CLAN.* in DesignTokens.ts — kept in sync manually」（已不再 manual sync）。

### 3c. `src/components/UiButton.ts` — 用 TINT 取代硬碼

目前（line 80, 93, 98, 103, 111, 115, 119）：

```ts
this.bg.tint = enabled ? 0xFFFFFF : 0x555555;  // line 80
// ...
this.bg.tint = 0xFFFFFF;   // line 93
this.bg.tint = 0xFFFFFF;   // line 98
this.bg.tint = 0xFFE8A8;   // line 103
this.bg.tint = 0xFFFFFF;   // line 111
this.bg.tint = 0xFFFFFF;   // line 115
this.bg.tint = 0xB88A40;   // line 119
```

改為：

```ts
// import at top
import * as T from '@/config/DesignTokens';  // may already exist

// replace each literal with T.TINT.*:
this.bg.tint = enabled ? T.TINT.identity : T.TINT.disabled;  // line 80
// ...
this.bg.tint = T.TINT.identity;  // line 93
this.bg.tint = T.TINT.identity;  // line 98
this.bg.tint = T.TINT.hover;     // line 103
this.bg.tint = T.TINT.identity;  // line 111
this.bg.tint = T.TINT.identity;  // line 115
this.bg.tint = T.TINT.pressed;   // line 119
```

若 UiButton.ts 已有 `import * as T from '@/config/DesignTokens'` 不重複 import。

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/config/DesignTokens.ts`（+12 行 TINT block）
- `src/fx/FXAtlas.ts`（-4 行 literal + +1 import + clanTint body 改用 CLAN.*）
- `src/components/UiButton.ts`（7 處 tint literal 換 T.TINT.*，可能加 1 import）

**禁止**：
- `SpiritAttackChoreographer.ts`（PERSONALITIES particleColor 不動）
- 任何 FX 內 `0xffffff` 白閃（是 FX 設計意圖）
- `SlotReel.ts` / `DraftScreen.ts` / `BattleScreen.ts` 內一次性 hex（屬於 local FX，維持）
- SPEC.md
- 任何視覺行為變動（本 PR 應**零視覺差異**）

**若發現 UiButton 有用 tint 的地方不在 line 80/93/98/103/111/115/119，列出實際行號再改**。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- **預期零視覺差異**：所有 tint 值不變，只是 literal → token 名
- UiButton 的 0xFFFFFF = TINT.identity（Pixi 預設不染色）
- `clanTint()` 回傳型別仍是 `number`，CLAN.azure 本身就是 number literal，行為一致
- 編輯 ≥ 3 次無法過 build → STOP 回報

## 5. Handoff

- PR URL
- 1 行摘要（例如 "3 files, 11 literals → DesignTokens tokens, zero visual change"）
- Spec deviations：預期 0
- 確認 preview 啟動 zero console error 且 UiButton hover/press 狀態正常
