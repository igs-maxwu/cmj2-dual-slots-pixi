# Sprint 10 · p10-v02 — Reel cell polish（gem fill 0.80→0.90 + inner accent ring + tier pip indicator）

## 1. Context

PR: **`SlotReel.ts` reel cell 視覺升級 — gem 佔比 0.80→0.90、加 inner accent ring、加 1-3 pip 顯示 symbol tier。對應 the-stylist audit P1-A「reel cells 太空」。**

Why: p10-v01 把 cell 從 128×150 portrait 改成 124×100 landscape，已經改善「空間比例」感。本 PR 進一步把每個 cell 視覺密度拉高 — gem 更大、cell 內有明確 inner border、加 tier pip 給玩家「這顆 symbol 多稀有」的快速資訊。

設計：

### 1. Gem fill ratio 0.80 → 0.90

既有 `setCellSymbol()` line 175-178：

```ts
const targetSize = Math.min(CELL_W, CELL_H) * 0.80;
```

改成 `0.90`。Cell 124×100 → `min=100 × 0.90 = 90` → gem 從 80px 變 90px，**fill ratio 80%→90%**，cell 上下死空間從 20px 變 10px。

### 2. Inner accent ring（per cell）

既有 `cellBg` (line 142-146)：

```ts
const cellBg = new Graphics()
  .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
  .fill({ color: T.SEA.deep, alpha: 0.55 })
  .stroke({ width: 1, color: T.SEA.rim, alpha: 0.7 });
```

加 inner ring（在 cellBg 之後、gemSprite 之前 addChild）：

```ts
const innerRing = new Graphics()
  .roundRect(-CELL_W/2 + 4, -CELL_H/2 + 4, CELL_W - 8, CELL_H - 8, T.RADIUS.sm - 2)
  .stroke({ width: 1, color: T.SEA.caustic, alpha: 0.20 });
container.addChild(innerRing);
```

`T.SEA.caustic` 是 teal-cyan tone（既有 token，drawing token reference）。Inner ring 給 cell 「玻璃內框」感，配合 outer rim 形成雙層 frame。

### 3. Tier pip indicator（1-3 pip 顯示 symbol 階級）

每個 cell 在 gem **下方**畫 1-3 個小圓，顯示 symbol tier：

| Symbol IDs | Tier | Pip count | Pip color |
|---|---|---|---|
| 0, 1, 2 | low | 1 | T.SYM.low1 |
| 3, 4, 5 | mid | 2 | T.SYM.mid1 |
| 6, 7 | high | 3 | T.SYM.high1 |
| 8 (Wild) | special | 1 (gold) | T.GOLD.glow |
| 9 (Curse) | special | 1 (purple) | 0xc77fdb |
| 10 (Scatter) | special | 2 (pink) | 0xff3b6b |
| 11 (Jackpot) | special | 3 (gold) | T.GOLD.glow |

**先確認 DesignTokens 有 `T.SYM.low1 / mid1 / high1`**（the-stylist audit §2 提到，假設存在）。若不存在用 fallback：
- low: T.GOLD.shadow
- mid: T.GOLD.base
- high: T.GOLD.glow

#### 實作位置

加 `gemSprite` 之後、`overlay` 之前（buildCells 內 line 152-154 之間）：

```ts
const pipsContainer = new Container();
pipsContainer.x = 0;
pipsContainer.y = CELL_H / 2 - 10;   // bottom of cell, 10px above edge
container.addChild(pipsContainer);
```

每次 `setCellSymbol()` 呼叫時 redraw pips（因為 symbol 改變 pip count/color 也要改）：

```ts
// In setCellSymbol(), after gem texture set:
this.refreshCellPips(cell, symId);
```

新 method `refreshCellPips()`：

```ts
private refreshCellPips(cell: Cell, symId: number): void {
  // Clear existing pips
  cell.pipsContainer.removeChildren();

  const sym = SYMBOLS[symId];
  let pipCount: number;
  let pipColor: number;

  if (sym.isJackpot)        { pipCount = 3; pipColor = T.GOLD.glow; }
  else if (sym.isScatter)   { pipCount = 2; pipColor = 0xff3b6b; }
  else if (sym.isCurse)     { pipCount = 1; pipColor = 0xc77fdb; }
  else if (sym.isWild)      { pipCount = 1; pipColor = T.GOLD.glow; }
  else if (symId <= 2)      { pipCount = 1; pipColor = T.SYM?.low1 ?? T.GOLD.shadow; }
  else if (symId <= 5)      { pipCount = 2; pipColor = T.SYM?.mid1 ?? T.GOLD.base; }
  else                      { pipCount = 3; pipColor = T.SYM?.high1 ?? T.GOLD.glow; }

  // Layout: centered horizontal row, 4px radius, 8px gap
  const totalW = pipCount * 8 + (pipCount - 1) * 4;
  const startX = -totalW / 2 + 4;
  for (let i = 0; i < pipCount; i++) {
    const pip = new Graphics()
      .circle(startX + i * 12, 0, 3)
      .fill({ color: pipColor, alpha: 0.9 });
    cell.pipsContainer.addChild(pip);
  }
}
```

`Cell` interface 加 field：

```ts
interface Cell {
  container: Container;
  gemSprite: Sprite;
  overlay: Graphics;
  currentSymbol: number;
  pipsContainer: Container;   // NEW — for tier pip indicator
}
```

`buildCells()` 創建 `pipsContainer` 後加進 `colCells.push({...})`。

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Cell 是 hot path（每 spin 5×3=15 個 cell 都會 setCellSymbol）。Pips redraw 用 `removeChildren()` 比保留+update 簡單，且 pip 數量本身少（1-3），**重建 cost 可忽略**。Inner ring 是 static（buildCells 一次），無 hot path 問題。
- **`code-simplification`** — `refreshCellPips()` 用 if-else 鏈而非 lookup table — 因為 special flag 判斷比 ID range 早，順序很重要（isJackpot / isScatter / isCurse / isWild **必須先判**，再 fall to ID range）。
- **`source-driven-development`** — 確認 `T.SYM.low1 / mid1 / high1` 是否存在於 DesignTokens — 不存在用 fallback，**先 grep DesignTokens.ts 再寫**。

---

## 2. Spec drift check (P6)

1. `mempalace_search "p10-v02 reel cell polish gem pip tier inner ring"`
2. 確認 `SlotReel.ts` 既有結構：`buildCells()` line 128-165, `setCellSymbol()` line 167-181, `Cell` interface (find via grep)
3. 確認 `DesignTokens.ts` 是否有 `T.SYM.low1 / mid1 / high1`（**executor 必查**）
4. 確認 `T.SEA.caustic`（既有 token，d-04 / v-03 用過）

## 3. Task

### 3a. 加 Cell interface field

搜尋 `interface Cell` 在 SlotReel.ts，加 `pipsContainer: Container`。

### 3b. buildCells() 加 pipsContainer

在 line 152 之後（gemSprite 加完）、line 154 之前（overlay 加進）：

```ts
const pipsContainer = new Container();
pipsContainer.x = 0;
pipsContainer.y = CELL_H / 2 - 10;
container.addChild(pipsContainer);

// ... existing overlay creation ...
```

並在 line 142-146 之後（cellBg 加完）加 inner ring：

```ts
const innerRing = new Graphics()
  .roundRect(-CELL_W/2 + 4, -CELL_H/2 + 4, CELL_W - 8, CELL_H - 8, Math.max(T.RADIUS.sm - 2, 2))
  .stroke({ width: 1, color: T.SEA.caustic, alpha: 0.20 });
container.addChild(innerRing);
```

`colCells.push` 改成包含 `pipsContainer`：

```ts
colCells.push({ container, gemSprite, overlay, currentSymbol: -1, pipsContainer });
```

### 3c. setCellSymbol() 改 targetSize + 加 refreshCellPips call

```ts
private setCellSymbol(cell: Cell, symId: number): void {
  if (cell.currentSymbol === symId) return;
  cell.currentSymbol = symId;
  const sym     = SYMBOLS[symId];
  const gemInfo = gemForSymbol(sym);
  const tex     = Assets.get<Texture>(gemInfo.assetKey);
  if (tex) {
    cell.gemSprite.texture = tex;
    const targetSize = Math.min(CELL_W, CELL_H) * 0.90;   // 0.80 → 0.90
    const scale = targetSize / Math.max(tex.width, tex.height);
    cell.gemSprite.scale.set(scale);
  }
  cell.gemSprite.tint = gemInfo.tint;

  // p10-v02: refresh tier pips
  this.refreshCellPips(cell, symId);
}
```

### 3d. 新 method `refreshCellPips()`

如上 §1 設計區段所示。**先 grep DesignTokens.ts 確認 `T.SYM` 是否存在**：
- 若有 → 直接用 `T.SYM.low1 / mid1 / high1`
- 若沒 → fallback 到 `T.GOLD.shadow / base / glow`

### 3e. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts` 唯一檔（Cell interface + buildCells + setCellSymbol + 新 refreshCellPips method）

**禁止**：
- BattleScreen / ResultScreen / DraftScreen / LoadingScreen / FXPreviewScreen
- DesignTokens.ts（**禁加新 token** — 用既有 fallback chain）
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- main.ts
- 加新 asset
- scripts/sim-rtp.mjs
- 改 d-06 wayHit highlight 邏輯（`pulseWay()` 沿用既有，pip 不參與 win highlight）
- p10-v01 / p10-bug-01 layout
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **1 個 commit**（per `incremental-implementation`，純 cell decoration）
3. push + PR URL
4. **Preview 驗證**：
   - 每 cell 內 gem 比之前**明顯更大**（fill 90%）
   - 每 cell 邊緣有 teal 細 inner ring（不顯眼但有「玻璃感」）
   - 每 cell 底部有 1-3 個小 pip（依 symbol tier 顏色不同）
   - Wayhit highlight (d-06) 仍正常觸發（pip 不影響 highlight）
   - Spin 期間 pips 跟著 reel column 動畫一起動（因 pipsContainer 在 cell container 內）
   - 5×3 = 15 cells，所有 pip 都正常 render，無 1 cell 空白
5. 截圖 1 張（mid-spin 後 stopped grid 有各種 symbol，看 pip 多樣性）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（含 pip + inner ring 視覺）
- `T.SYM.low1/mid1/high1` 是否存在（**重要 finding**，影響配色一致性）
- 改 0.90 後 gem 是否有溢出 cell 邊緣（landscape 124×100 應該還有 5px buffer）
- pip 在 spin 動畫期間是否會**飛出 cell**（垂直位置 y=CELL_H/2 - 10 = 40 px 靠近底邊）
- 任何 wayhit highlight 干擾 pip 的觀察（兩者 z-order 應 pip < overlay，**確認 buildCells addChild 順序**）
- Spec deviations：預期 0
