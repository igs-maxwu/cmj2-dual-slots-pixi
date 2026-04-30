# Chore — 修 spin BlurFilter ghost 殘影 + 中獎 cell 加圈框（連連看 + ring sequential）

## 1. Context

Owner 試玩 #170 + #171 後反映 2 issue（截圖佐證）：

### Issue 1：殘影 bug（chore #170 BlurFilter 沒清乾淨）

每 spin 後**平均 1-2 個 cell** 卡在模糊狀態（截圖左下角 替 / 右下角 替 模糊）。

**Root cause（已 inspect）**：`SlotReel.setCellSymbol` line 197-199：
```ts
private setCellSymbol(cell: Cell, symId: number): void {
  if (cell.currentSymbol === symId) return;   // ← 早期 return
  cell.currentSymbol = symId;
  // ... rebuild gemBall children + set GlowFilter (line 249) ...
}
```

當 spin lock 到 finalSymbol 時（line 412 / 495），若 finalSymbol **碰巧等於** cell.currentSymbol（最後一個 random swap symbol），`setCellSymbol` 早期 return → **GlowFilter 未重設** → 留下 spin 期間 set 的 BlurFilter（line 398 / 481）。

機率：1/12 per cell × 15 cells = 平均 1-2 cell stuck per spin。

### Issue 2：除箭頭外，中獎 cell 加圈框

#171 連連看箭頭 OK，但 owner 想**加層 visual**：每個中獎 cell 用「圈框」依序 highlight，跟箭頭並行。框先出，箭頭接著畫到下一個 cell。

純視覺 — 不動機制 / WayHit / hitCells / damage / coin。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（fix bug / add ring）
- **`source-driven-development`** — 用 console-instrument 確認 ghost cell 真的是 BlurFilter 殘留再 fix
- **`debugging-and-error-recovery`** — fix root cause（早期 return 觸發 filter 殘留），不用 hack workaround

---

## 2. Spec drift check (P6)

1. `mempalace_search "chore 170 BlurFilter setCellSymbol gemBall filters"`
2. `mempalace_search "chore 171 popCell drawArrow pulseWay sequential trace"`
3. 確認 既 SlotReel `setCellSymbol` line 198 early-return guard `if (cell.currentSymbol === symId) return;`
4. 確認 既 line 249 `cell.gemBall.filters = [new GlowFilter({...})]` 是 setCellSymbol 結束時設的 default filter
5. 確認 既 chore #170 spinColumn line 412 + spinColumnCenter line 495 lock paths

---

## 3. Task

### 3a. Commit 1 — Fix ghost bug：抽 resetGemBallFilter helper

#### 3a-1. 新 helper

`SlotReel.ts` 加 private method：

```ts
/**
 * Apply the default GlowFilter that setCellSymbol normally installs.
 * Used in spin lock paths to guarantee filter cleanup even when
 * setCellSymbol early-returns (currentSymbol === finalSymbol case).
 */
private resetGemBallFilter(cell: Cell): void {
  // chore: same params as setCellSymbol line 249 — keep in sync
  cell.gemBall.filters = [new GlowFilter({
    color: 0xfff0b3,            // T.GOLD.glow or whatever existing line 249 uses
    distance: 4,
    outerStrength: 0.4,
    innerStrength: 0.3,
    quality: 0.3,
  })];
}
```

> **Important**：executor 必須讀 line 249 setCellSymbol 內 GlowFilter 真實 params 並 copy 過來，不能猜（保 visual consistency）。若 visual diff，bug 沒解。

#### 3a-2. spinColumn lock 加 explicit reset

`spinColumn` line 411-413（lock to final）改成：
```ts
// Lock to final
for (let r = 0; r < ROWS; r++) {
  this.setCellSymbol(colCells[r], finalGrid[r][col]);
  this.resetGemBallFilter(colCells[r]);   // chore: force filter reset (handles setCellSymbol early-return)
  colCells[r].container.alpha = 1;
}
```

#### 3a-3. spinColumnCenter lock 同樣 reset

`spinColumnCenter` line 494-496 同樣 pattern：
```ts
for (let r = 0; r < ROWS; r++) {
  this.setCellSymbol(colCells[r], finalGrid[r][col]);
  this.resetGemBallFilter(colCells[r]);   // chore: same reset
}
for (const cell of colCells) cell.container.alpha = 1;
```

#### 3a-4. 驗證

`npm run build` + 試玩 5+ spins → 觀察是否還有 cell 卡 blur。**console.log 不留**（fix 確認後 cleanup）。

**Commit 1**: `fix(chore): SlotReel BlurFilter ghost — explicit resetGemBallFilter at spin lock (handles setCellSymbol early-return when finalSymbol == currentSymbol)`

---

### 3b. Commit 2 — Win cell 加圈框（ring frame）

#### 3b-1. 新 helper：drawWinRing(cell, tint)

```ts
/**
 * Draw a sequential win-ring around a cell. Returns the Graphics so caller
 * can manage destroy timing (typically held until full chain ends).
 */
private drawWinRing(cell: Cell, tint: number): Graphics {
  const ring = new Graphics();
  const r = Math.min(CELL_W, CELL_H) * 0.48;   // slightly larger than ball radius

  // Outer glow underlay (thicker, semi-transparent)
  ring.circle(0, 0, r + 4)
    .stroke({ width: 6, color: tint, alpha: 0.30 });
  // Main stroke
  ring.circle(0, 0, r)
    .stroke({ width: 2.5, color: tint, alpha: 1 });

  ring.x = cell.container.x;
  ring.y = cell.container.y;
  ring.alpha = 0;
  ring.scale.set(1.15);   // start slightly larger
  this.addChild(ring);

  // Pop-in: scale 1.15 → 1.0 + alpha 0 → 1, fire-and-forget 120ms
  void tween(120, t => {
    ring.alpha = t;
    ring.scale.set(1.15 - 0.15 * t);
  }, Easings.easeOut);

  return ring;
}
```

#### 3b-2. pulseWay 內 wire ring

當前 chore #171 寫的 `pulseWay`（line 526+，看執行上的實際 number）內：

當前 sequential loop：
```ts
for (let i = 0; i < targets.length; i++) {
  if (i === 0) {
    const popPromises = targets[0].map(c => this.popCell(c, tint, STEP_MS));
    await Promise.all(popPromises);
  } else {
    const fromCell = targets[i - 1][0];
    const toCell   = targets[i][0];
    const arrow = this.drawArrow(fromCell, toCell, tint);
    arrows.push(arrow);
    const popPromises = targets[i].map(c => this.popCell(c, tint, STEP_MS));
    await Promise.all(popPromises);
  }
}
```

加入 ring：每 column pop 時同步畫該 column 的 ring（每 cell 一個 ring）：

```ts
const arrows: Graphics[] = [];
const rings: Graphics[]  = [];
const STEP_MS = 100;

for (let i = 0; i < targets.length; i++) {
  // Draw arrow from prev column to this (skip on first column)
  if (i > 0) {
    const fromCell = targets[i - 1][0];
    const toCell   = targets[i][0];
    arrows.push(this.drawArrow(fromCell, toCell, tint));
  }

  // Draw ring on each cell of this column (parallel) + pop
  for (const cell of targets[i]) {
    rings.push(this.drawWinRing(cell, tint));
  }

  const popPromises = targets[i].map(c => this.popCell(c, tint, STEP_MS));
  await Promise.all(popPromises);
}

// Hold final state — all rings + arrows visible, last column popped
await delay(300);

// Fade out + cleanup BOTH arrows AND rings together
await tween(220, t => {
  for (const a of arrows) a.alpha = 1 - t;
  for (const r of rings)  r.alpha  = 1 - t;
});
for (const a of arrows) a.destroy();
for (const r of rings)  r.destroy();
```

> **Z-order**：ring 跟 arrow 都用 `this.addChild` 加到 SlotReel（不 cell.container），於是顯示在所有 cell 之上。Arrow 後加會在 ring 上方蓋住 — 通常無影響但若視覺檢查有 issue 可改 ring 用 `addChildAt(ring, 0)` 放底層。**Default 順序執行即可**。

> **多 wayHits 並行 ring 重疊**：若 col 1 row 0 同時被多 wayHit 包含，會畫多個 ring 重疊（同色加深）。**Acceptable**（visual 只是亮一點，不糊）。

**Commit 2**: `feat(chore): SlotReel drawWinRing — circle frame around winning cell, sequential per column, fades with arrows`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（resetGemBallFilter helper + spinColumn/Center lock paths + drawWinRing helper + pulseWay loop wire-up）

**禁止**：
- 動 setCellSymbol 內部邏輯（保留 early-return guard，只在 lock site 額外 force reset）
- 動 SlotEngine / WayHit / hitCells
- 動 SymbolsConfig / damage / coin
- 動 BattleScreen
- 改 SPEC.md / DesignTokens / sim-rtp.mjs / main.ts
- 加新 asset

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 連續 spin 10 次，**無任何 cell 卡 blur 殘影**（前提是 fix 對 — 若殘留則 root cause 不對 stop 並 report console）
   - 中獎瞬間每 cell 加圈金/azure/vermilion 框（ring 跟 arrow 同步 fade in）
   - Ring 跟箭頭都在 hold 300ms 後一起 fade（220ms）+ destroy
   - A 側 azure / B 側 vermilion 色 ring + arrow 一致
   - DevTools FPS 仍 ≥ 50（每 cell 多 1 Graphics ring，輕微）
   - 無 console error
5. 截圖 1 張：trace mid-flight（含 ring + arrow + popping cells）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- ghost 殘影是否完全消失（10 spins zero residual）— 若仍有，console-debug 重新定位 root cause
- ring 視覺感受（+4px outer glow + 2.5px main stroke 是否合適）
- pop-in 120ms 是否合適（or 跟 popCell 100ms 對齊改 100ms）
- ring + arrow 共存視覺是否雜（or 太花俏）
- Spec deviations：預期 0
