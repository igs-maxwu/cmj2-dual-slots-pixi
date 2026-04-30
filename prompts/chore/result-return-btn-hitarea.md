# Chore — ResultScreen 返回 DRAFT 按鈕 hitArea fix（Pixi 8 explicit Rectangle）

## 1. Context

Owner 試玩反映：對戰結束後 ResultScreen「返回 DRAFT」按鈕**常常點不到**（截圖佐證）。

### Root cause

`src/screens/ResultScreen.ts` line 222-234：
```ts
const bg = new Graphics()
  .roundRect(btnX, btnY, btnW, btnH, 14)
  .fill({ color: T.GOLD.base })
  .stroke({ width: 2, color: T.GOLD.shadow });
bg.eventMode = 'static';
bg.cursor    = 'pointer';
bg.on('pointertap', () => this.onReturn());
```

**Pixi 8 known issue**：Graphics with `roundRect` 畫在 **non-zero offset**（btnX/btnY ≠ 0,0）+ `eventMode='static'` 但**沒設 explicit hitArea**，auto hit-test 對 offset roundRect 處理不可靠 → 部分區域點不到。

這是 chore #151 SPIN 按鈕**同一 pattern**（chore #151 fix：加 `hitArea = new Rectangle(0, 0, BTN_W, BTN_H)`）。

ResultScreen 沒被 chore #151 audit 到，所以 RETREAT button 仍是 buggy。

純 hit-test fix — 不動視覺 / 不動 game state。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 沿用 chore #151 同樣 hitArea fix pattern

---

## 2. Spec drift check (P6)

1. `mempalace_search "Pixi 8 Graphics hitArea Rectangle eventMode chore 151 SPIN button"`
2. 確認 chore #151 fix pattern：`hitArea = new Rectangle(...)` + eventMode='static' + cursor='pointer'
3. 確認 既有 ResultScreen line 222 drawReturnButton 結構

---

## 3. Task

### Single commit — Add Rectangle hitArea

`src/screens/ResultScreen.ts` line 222-234：

當前：
```ts
private drawReturnButton(): void {
  const btnW = 280, btnH = 72;
  const btnX = (CANVAS_WIDTH - btnW) / 2;
  const btnY = 1080;

  const bg = new Graphics()
    .roundRect(btnX, btnY, btnW, btnH, 14)
    .fill({ color: T.GOLD.base })
    .stroke({ width: 2, color: T.GOLD.shadow });
  bg.eventMode = 'static';
  bg.cursor    = 'pointer';
  bg.on('pointertap', () => this.onReturn());
  this.container.addChild(bg);
  // ...
}
```

改成：
```ts
import { Rectangle } from 'pixi.js';   // chore: explicit hitArea require
// ... existing imports
private drawReturnButton(): void {
  const btnW = 280, btnH = 72;
  const btnX = (CANVAS_WIDTH - btnW) / 2;
  const btnY = 1080;

  const bg = new Graphics()
    .roundRect(btnX, btnY, btnW, btnH, 14)
    .fill({ color: T.GOLD.base })
    .stroke({ width: 2, color: T.GOLD.shadow });
  // chore: Pixi 8 explicit hitArea — auto hit-test on offset roundRect unreliable (chore #151 lesson)
  bg.hitArea   = new Rectangle(btnX, btnY, btnW, btnH);
  bg.eventMode = 'static';
  bg.cursor    = 'pointer';
  bg.on('pointertap', () => this.onReturn());
  this.container.addChild(bg);
  // ... rest unchanged
}
```

> **Import**：line 1 既有 import 加 `Rectangle`（若沒在 import list 內）：
> ```ts
> import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
> ```

### 驗證

`npm run build` + 試玩：
- 對戰結束 → ResultScreen 顯示
- 點「返回 DRAFT」按鈕 → **每次都正確返回 DraftScreen**（不會 stuck）
- 點按鈕邊緣（接近 roundRect 弧角）也應該觸發

**Commit**: `fix(chore): ResultScreen return button explicit Rectangle hitArea (Pixi 8 chore #151 pattern)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/ResultScreen.ts`（drawReturnButton 加 hitArea + import Rectangle if needed）

**禁止**：
- 動 ResultScreen 視覺 layout / 文字 / 顏色
- 動 onReturn callback 邏輯
- 動 BattleScreen / DraftScreen / main.ts
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 跑一局到結束 → ResultScreen 顯示
   - 點「返回 DRAFT」中央 → 立刻回 DraftScreen
   - 點按鈕邊緣 + 弧角區域 → 也應觸發
   - 連續測試 5 次都成功
5. 截圖：ResultScreen + 截圖切到 DraftScreen 證明返回成功

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 確認 5 次測試全部成功（每次點都返回）
- Spec deviations：預期 0
- Note：可能還有其他 Graphics-with-roundRect-at-offset 按鈕有同樣 bug — future audit 需 grep 全 Graphics 含 eventMode='static' 但無 hitArea 的 pattern
