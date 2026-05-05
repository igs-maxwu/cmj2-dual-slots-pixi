# Chore — UiButton DropShadowFilter → inline shadow（效能修正）

## 1. Context

Owner 試玩 chore #204 後反映「動畫都會卡卡的」。

### Root cause（已 audit）

Always-on filter count：
- 15 cells × GlowFilter on gemBall = 15
- 6 UI text/dot × GlowFilter (VS/JP/戰/aDot/spinButton/freeSpinBanner) = 6
- **chore #204 加 4-5 UiButton × DropShadowFilter = 5** ← bottleneck
- = **~26 active filters** in gameplay

Spin 期間還會多 15 BlurFilters = 41 filters total briefly。

mid-tier mobile：
- ~26 × 0.5ms = ~13ms / frame
- 60fps budget 16.7ms → 已接近上限
- Spin 期間直接掉 fps

### Fix
**移除 UiButton DropShadowFilter**，改用 **inline drawn shadow**（多畫一個半透明深色 roundRect 在 button 後方）— **0 filter cost**。

純 perf optimization — 視覺差別微小（inline shadow 沒 blur，但對小 button 來說幾乎看不出）。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用 Pixi.Graphics roundRect 模擬 shadow

---

## 2. Spec drift check (P6)

1. 確認 chore #204 UiButton.drawBg 結構（已加 DropShadowFilter line ~196）
2. 確認 UiButton 仍是 DraftScreen 唯一 caller (4 toolbar + START BATTLE)

---

## 3. Task

### Single commit — Replace DropShadowFilter with inline shadow

`src/components/UiButton.ts`：

#### 3a. 移除 DropShadowFilter import + 套用

當前 line ~196：
```ts
if (!this.bg.filters || (Array.isArray(this.bg.filters) && this.bg.filters.length === 0)) {
  this.bg.filters = [new DropShadowFilter({ ... })];
}
```

刪除整個 if-block。也移除 import：
```ts
import { DropShadowFilter } from 'pixi-filters';   // ← 移除
```

#### 3b. 加 inline shadow as separate Graphics in drawBg

`drawBg` 開頭（在 gradient fill 之前）加：
```ts
private drawBg(state: 'normal' | 'hover' | 'pressed' | 'disabled'): void {
  this.bg.clear();
  const radius = 10;
  const halfW = this.w / 2;
  const halfH = this.h / 2;

  // chore #205: inline shadow (replaces chore #204 DropShadowFilter for perf)
  // 3 layers stacked dark roundRects offset down — simulates shadow blur
  if (state !== 'disabled') {
    this.bg.roundRect(-halfW + 1, -halfH + 4, this.w, this.h, radius)
      .fill({ color: 0x000000, alpha: 0.20 });
    this.bg.roundRect(-halfW + 0.5, -halfH + 3, this.w, this.h, radius)
      .fill({ color: 0x000000, alpha: 0.25 });
    this.bg.roundRect(-halfW, -halfH + 2, this.w, this.h, radius)
      .fill({ color: 0x000000, alpha: 0.30 });
  }

  // ... existing gradient + outer stroke + inner hairline + top highlight + corner dots ...
}
```

> **3-layer fake shadow**：3 個 dark roundRect 微 offset 模擬 blur 邊緣。深度感 ~80% 接近 DropShadow 但 0 filter cost。
>
> 可調整：layer 越多越像 blur（但畫得越多）。3 layers 折衷。

**Commit**: `perf(chore): UiButton DropShadowFilter → inline 3-layer shadow (~5 filter reduction for mobile fps)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/components/UiButton.ts`（drawBg + remove DropShadowFilter）

**禁止**：
- 動 chore #204 其他 visual layers（gradient / borders / corner dots / top highlight）
- 動 callers (DraftScreen 不變)
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "DropShadowFilter" src/components/UiButton.ts` — 應 0 hits
   - `grep "alpha: 0\.20\|alpha: 0\.25\|alpha: 0\.30" src/components/UiButton.ts` — 應有 inline shadow layers
5. **Preview 驗證**：
   - DraftScreen 4 button + START BATTLE 仍顯示「立體 shadow」（雖比 DropShadow 略硬）
   - **整體動畫 fps 改善**（owner 主觀感受）
   - DevTools Performance 量 frame time（可選）
   - 如果 owner 仍卡 → 進一步 optimize gemBall GlowFilter

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（4 button 含 inline shadow 視覺）
- 動畫 fps 改善程度（main hurdle）
- shadow 視覺品質 vs filter 版本（accept compromise?）
- Spec deviations：預期 0
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3`
