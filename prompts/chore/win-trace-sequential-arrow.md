# Chore — Win-line Sequential Trace（連連看式中獎動畫，取代同時 pulse）

## 1. Context

當前兌獎動畫（`SlotReel.pulseWay` line 526+）：所有 winning cells **同時** flash overlay tint + sos2-win-frame sprite + GlowFilter pulse，330ms 一次完成。

**問題**：玩家視覺感受平淡，不知道是「哪幾個符號連成一線」，特別是多 wayHits 同時觸發時更糊。

### Owner 想要的（mockup 4-panel 截圖）

「**Sequential connect-the-dots trace**」：
- Cell 1（col 0）放大 + glow → 0.1s
- 箭頭從 cell 1 中心畫到 cell 2 中心 → 0.1s
- Cell 2 放大 + glow → 0.1s
- 箭頭從 cell 2 → cell 3 → 0.1s
- ... 依此 column 順序展開
- 全鏈完成後 hold 0.3s 再淡出

每個 wayHit 獨立 trace，A 側用 azure 色、B 側用 vermilion 色。視覺上像「連連看」連成完整 way 的氣勢。

純視覺改動 — 不動 SlotEngine / WayHit 結構 / damage / coin 計算。

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（cell pop / arrow draw / wire-up replace pulseWay）
- **`source-driven-development`** — 沿用既有 `WayHit.hitCells: number[][]` 結構（row indices per column）
- **`debugging-and-error-recovery`** — 多 wayHits 並行時 Promise / Graphics cleanup 不能 leak

---

## 2. Spec drift check (P6)

1. `mempalace_search "highlightWays pulseWay sos2-win-frame WayHit hitCells"`
2. 確認 `WayHit` 結構 — `hitCells: number[][]` (`hit.hitCells[col]` = 該 column 的 row indices array, length = matchCount-1 or matchCount?)
3. 確認 既有 `highlightWays(hitA, hitB)` 在 BattleScreen 哪裡 await（grep 用 SlotReel.highlightWays / this.reel.highlightWays）
4. 確認 既有 `pulseWay` 用 `T.TEAM.azureGlow / T.TEAM.vermilionGlow` color + sos2-win-frame sprite

---

## 3. Task

### 3a. Commit 1 — 新 helper：sequential cell pop

新方法 `SlotReel.popCellSequence(targets: Cell[][], tint: number, stepMs: number = 100): Promise<void>`

`targets[i]` = 第 i 個 column 的 cell array（可能 1+ rows）。

```ts
private async popCellSequence(
  targets: Cell[][],
  tint: number,
  stepMs: number = 100,
): Promise<void> {
  // For each column, simultaneously pop all hit-cells in that column
  for (let i = 0; i < targets.length; i++) {
    const colTargets = targets[i];

    // For each cell in column: parallel pop animation (scale 1.0→1.3→1.0 + glow)
    const popPromises = colTargets.map(cell => this.popCell(cell, tint, stepMs));
    await Promise.all(popPromises);
  }
}

private async popCell(cell: Cell, tint: number, durMs: number): Promise<void> {
  // Save original scale to restore
  const baseScale = cell.container.scale.x;

  // Apply tint overlay during pop
  cell.overlay.clear()
    .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
    .fill(tint);

  // Add temp glow filter
  const glow = new GlowFilter({
    color: tint, distance: 14, outerStrength: 2.5, innerStrength: 0.6, quality: 0.5,
  });
  cell.gemBall.filters = [glow];

  await tween(durMs, t => {
    // pulse curve: 0 → peak (~0.5) → 0
    const p = Easings.pulse(t);
    cell.container.scale.set(baseScale + 0.3 * p);
    cell.overlay.alpha = p * 0.7;
    glow.outerStrength = p * 4;
  });

  // Restore (overlay still holds tint until cleared by chain)
  cell.container.scale.set(baseScale);
  cell.gemBall.filters = [];   // remove temp glow
  cell.overlay.alpha = 0;       // clear tint after pulse
}
```

> **Note**：`popCell` 結束時清 overlay alpha → 0（等下一個 column 接著 pop）。若想保留 trail（前面 column 還亮著直到全鏈完成），改成不在 popCell 內清 alpha，而是在 popCellSequence 結束後統一 fade。設 owner 偏好 trail effect → 改保留 alpha=0.4 直到 sequence 結束。

**Commit 1**: `feat(chore): SlotReel popCellSequence helper — staggered per-column cell pop + glow`

---

### 3b. Commit 2 — Arrow connector Graphics

新方法 `drawArrow(from: Cell, to: Cell, tint: number): Promise<void>`

```ts
private async drawArrow(from: Cell, to: Cell, tint: number): Promise<void> {
  const arrow = new Graphics();
  arrow.alpha = 0;
  this.addChild(arrow);   // sit on top of cells

  // Calculate arrow geometry (from → to in SlotReel-local coords)
  const fx = from.container.x;
  const fy = from.container.y;
  const tx = to.container.x;
  const ty = to.container.y;
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;

  // Inset endpoint slightly so arrow doesn't overlap cell centre marker
  const inset = 32;
  const sx = fx + ux * inset;
  const sy = fy + uy * inset;
  const ex = tx - ux * inset;
  const ey = ty - uy * inset;

  // Draw glow underlay (thicker, semi-transparent)
  arrow
    .moveTo(sx, sy).lineTo(ex, ey)
    .stroke({ width: 8, color: tint, alpha: 0.35, cap: 'round' });

  // Draw main line
  arrow
    .moveTo(sx, sy).lineTo(ex, ey)
    .stroke({ width: 3, color: tint, alpha: 1, cap: 'round' });

  // Arrow head (triangle at end pointing in direction)
  const headSize = 14;
  const perpX = -uy;
  const perpY = ux;
  arrow
    .moveTo(ex, ey)
    .lineTo(ex - ux * headSize + perpX * headSize * 0.5, ey - uy * headSize + perpY * headSize * 0.5)
    .lineTo(ex - ux * headSize - perpX * headSize * 0.5, ey - uy * headSize - perpY * headSize * 0.5)
    .closePath()
    .fill({ color: tint, alpha: 1 });

  // Animate stroke draw — fade in over 100ms
  await tween(100, t => {
    arrow.alpha = t;
  });

  // Hold + auto-cleanup queued by caller (caller adds arrow Graphics to cleanup list)
  // Return arrow Container for caller to manage destroy timing
}
```

> **Cleanup pattern**：caller 收 arrow refs，sequence 結束統一 `await tween(200, t => arrow.alpha = (1-t))` 然後 `destroy()`。具體 by executor 設計（推薦：將 arrow refs 存陣列傳回，caller iterate destroy）。

**Refactor signature**：
```ts
private drawArrow(from: Cell, to: Cell, tint: number): Graphics  // 同步建構並 fade-in，return ref 給 caller
```

**Commit 2**: `feat(chore): SlotReel drawArrow helper — gradient line + arrowhead + fade-in 100ms`

---

### 3c. Commit 3 — Wire-up：替換 pulseWay 主流程

`pulseWay(hit, side)` 內 line 526-580 重寫：

```ts
private async pulseWay(hit: WayHit, side: 'A' | 'B'): Promise<void> {
  const dir       = side === 'A' ? 1 : -1;
  const anchorCol = side === 'A' ? 0 : COLS - 1;
  const tint      = side === 'A' ? T.TEAM.azureGlow : T.TEAM.vermilionGlow;

  // Build targets[] indexed by column-step (0 = first column for this side)
  // hit.hitCells[i] = row indices in column (anchorCol + i*dir)
  const targets: Cell[][] = [];
  for (let offset = 0; offset < hit.hitCells.length; offset++) {
    const actualCol = anchorCol + offset * dir;
    const cellsAtCol: Cell[] = hit.hitCells[offset].map(row => this.cells[actualCol][row]);
    targets.push(cellsAtCol);
  }

  // chore: sequential connect-the-dots trace replaces parallel-pulse
  // Steps:
  //   1. Pop col 0, await
  //   2. Draw arrow col 0 → col 1, simultaneously pop col 1, await pop done
  //   3. ... iterate through all columns
  //   4. Hold final state 300ms, then fade arrows + return

  const arrows: Graphics[] = [];
  const STEP_MS = 100;

  for (let i = 0; i < targets.length; i++) {
    if (i === 0) {
      // First column: just pop
      const popPromises = targets[0].map(c => this.popCell(c, tint, STEP_MS));
      await Promise.all(popPromises);
    } else {
      // Subsequent columns:
      // (a) Draw arrow from one rep cell of previous column to one rep cell of current column
      const fromCell = targets[i - 1][0];   // first matched row of previous col
      const toCell   = targets[i][0];        // first matched row of current col
      const arrow = this.drawArrow(fromCell, toCell, tint);
      arrows.push(arrow);
      // (b) Simultaneously pop all matched cells in current column
      const popPromises = targets[i].map(c => this.popCell(c, tint, STEP_MS));
      await Promise.all(popPromises);
    }
  }

  // Hold final state — all arrows visible, last column popped
  await delay(300);

  // Fade out + cleanup arrows
  await tween(220, t => {
    for (const a of arrows) a.alpha = 1 - t;
  });
  for (const a of arrows) a.destroy();
}
```

> **Multi-row note**：若某 column 有多個 row 中（e.g. col 1 的 row 0 + row 2 都是相同符號），arrow 從前 column **第一個 row** 連到 current column **第一個 row**（簡化）。多 row 的所有 cell 都同時 pop。
> **Multi-wayHit 並行**：`highlightWays` 仍 `Promise.all([pulseWay(...)])` 並行 — A、B 兩側同時 trace OK；但同側多 wayHit 並行可能畫面雜（多條 arrow 重疊）。**先不處理**，看實際視覺效果決定後續 polish。

**Commit 3**: `feat(chore): SlotReel pulseWay rewrite — sequential connect-the-dots trace + arrow connectors per column`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（新增 popCellSequence / popCell / drawArrow + pulseWay 重寫）

**禁止**：
- 動 SlotEngine / WayHit struct / hitCells 邏輯
- 動 SymbolsConfig / damage / coin 計算
- 動 BattleScreen round loop / await highlightWays 順序
- 改 sos2-win-frame asset 用法（既有 sprite 暫不需要 — 由 popCell 的 GlowFilter 替代）
- 動 cellsA/cellsB / formation
- 加新 asset
- 改 SPEC.md / DesignTokens / sim-rtp.mjs / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 中獎瞬間每個 winning cell 依 column 順序**逐個放大 + glow**（不再同時 pulse）
   - 相鄰 column 之間有金色 arrow 從前 cell 中心畫到後 cell 中心
   - A 側 azure 色 / B 側 vermilion 色，兩側並行 trace 互不干擾
   - 全鏈完成後 hold 0.3s 再 fade，arrow 自動 destroy 無 leak
   - 5-of-5 wayHit（最長鏈）視覺感受清楚連串感
   - DevTools FPS：trace 期間 ≥ 50（每 column 4-cell pop + arrow Graphics）
   - 無 console error
5. 截圖 1 張：trace 中（mid-flight，看得到 arrow + popped cells）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- STEP_MS = 100 是否合適（or 太快 80 / 太慢 150？）
- 全鏈 5 column × 100ms + 300ms hold + 220ms fade = ~1.0s 整體節奏感受 OK 嗎
- 多 wayHit 並行時視覺是否會雜（同側多條 arrow 重疊）— 若是 future polish 點記下
- DevTools FPS 觀察結果
- Spec deviations：預期 0
- Future hint：若多 wayHit 並行雜亂 → 改 sequential per-side（A 全跑完才跑 B）or 簡化為「最高 wayHit only show trace, 其他 only flash」
