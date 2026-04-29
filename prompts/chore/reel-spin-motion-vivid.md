# Chore — Reel 轉動視覺生動化（Pixi BlurFilter + Y 位移 + 光束 streaks）

## 1. Context

Owner 試玩反映 SlotReel 轉動「不夠生動」。當前實作（`SlotReel.spinColumn` line 325-364 / `spinColumnCenter` line 369+）是：

- **原地 setCellSymbol swap** — 每 65ms 換符號，**沒垂直位移**
- 沒 motion blur
- 沒 light streak 視覺
- 玩家視覺感受比較像「圖切換」不是「轉動」

### Reference 素材
- `download_audio/slot_ref.mp4`（owner 生成的視覺概念參考）— executor 開來看一下方向確認 expected feel

### 設計選擇：Programmatic-first
**不依賴新 AI 生圖**（避開 prompt + 後製成本），先用 Pixi 內建 + Graphics 達到 80% 視覺：
1. **BlurFilter (vertical only)** — Pixi.BlurFilter strength Y 高 / X 0 → 自動垂直拉長模糊
2. **Y 位移 illusion** — 每 swap frame，gemBall.y 從 `-CELL_H` tween 到 `0`（65ms），再 setCellSymbol + reset，造成「捲下」錯覺
3. **Vertical light streaks** — 在 reel container 加 2 條金色 gradient strip 上下淡入淡出 + 高速 Y 位移，模擬光線衝刺感

未來若 owner 想升級高保真，再走 AI 圖路徑（motion-blur 圖標素材取代 BlurFilter）— 本 PR 不做。

機制零改動 — 只升級轉動視覺。

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（位移 / blur / streak）
- **`source-driven-development`** — 用 Pixi 內建 BlurFilter + Graphics gradient，不發明 framework
- **`debugging-and-error-recovery`** — Filter cleanup 必須在 spin 結束移除（否則 idle 時 cell 仍模糊）

---

## 2. Spec drift check (P6)

1. `mempalace_search "SlotReel spinColumn motion blur Y displacement light streak"`
2. 確認 既 SlotReel.ts cell 結構：`container` (位於 cell center) → `gemBall` (子，x=0 y=0) + `overlay` + `pipsContainer`
3. 確認 既 spin timing：`spinColumn` 510ms / `spinColumnCenter` 310ms（slow-mo），不變
4. 確認 既 `tween / delay / Easings` from `@/systems/tween`
5. 確認 既 BlurFilter 已 import 過？`grep "BlurFilter" src/screens/SlotReel.ts` — 若沒 import 則 chore commit 1 加

---

## 3. Task

### 3a. Commit 1 — Y 位移 illusion（每 swap frame 帶垂直滑動）

`SlotReel.ts` `spinColumn` line 333-340 內當前：
```ts
const stopAt = performance.now() + spinMs;
while (performance.now() < stopAt) {
  for (const cell of colCells) {
    this.setCellSymbol(cell, Math.floor(Math.random() * SYMBOLS.length));
  }
  await delay(65);
}
```

改成：
```ts
const stopAt = performance.now() + spinMs;
while (performance.now() < stopAt) {
  // chore: vertical slide illusion — gemBall slides from top (-CELL_H) to center (0) in 65ms
  // simulates "next symbol scrolling down into cell from above"
  const slideDur = 65;
  const slideStart = performance.now();

  // Reset gemBall to top of cell (off-screen above)
  for (const cell of colCells) cell.gemBall.y = -CELL_H;

  // Swap to new random symbol
  for (const cell of colCells) {
    this.setCellSymbol(cell, Math.floor(Math.random() * SYMBOLS.length));
  }

  // Animate slide down to center (0) within 65ms
  while (performance.now() - slideStart < slideDur && performance.now() < stopAt) {
    const t = (performance.now() - slideStart) / slideDur;
    for (const cell of colCells) cell.gemBall.y = -CELL_H * (1 - t);
    await delay(16);     // ~60fps frame step
  }
}

// Reset gemBall.y to 0 before lock (cleanup)
for (const cell of colCells) cell.gemBall.y = 0;
```

> **Important**：spin 結束後 gemBall.y 必須 reset 到 0，否則最後一格 fix-symbol 會偏移。
> **`spinColumnCenter`** (line 369+) 同樣套用此 pattern（slow-mo 65→93ms slide）。具體 delay 數字 by executor 算（同樣 1 cell 距離分散到 frame budget）。

**Commit 1**: `feat(chore): SlotReel vertical slide illusion — gemBall.y -CELL_H→0 per swap frame for rolling feel`

---

### 3b. Commit 2 — BlurFilter（垂直方向 motion blur）

#### 3b-1. Import + helper

`SlotReel.ts` 上方 import 若沒有 `BlurFilter` → 加：
```ts
import { BlurFilter } from 'pixi-filters';
```

#### 3b-2. spinColumn 加 blur on/off

當前 spinColumn line 328-331（spin-up fade）後 + line 343 lock 前 加：

```ts
private async spinColumn(col: number, finalGrid: number[][], spinMs: number): Promise<void> {
  const colCells = this.cells[col];

  // Spin-up fade
  await tween(90, p => {
    for (const cell of colCells) cell.container.alpha = 1 - p * 0.35;
  });

  // chore: apply vertical motion blur to gemBall during spin
  const blur = new BlurFilter({ strength: 0, strengthX: 0, strengthY: 16, quality: 2 });
  for (const cell of colCells) cell.gemBall.filters = [blur];

  // ... existing rapid swap + slide logic ...

  // Lock to final
  for (let r = 0; r < ROWS; r++) this.setCellSymbol(colCells[r], finalGrid[r][col]);
  for (const cell of colCells) {
    cell.container.alpha = 1;
    cell.gemBall.filters = [];                              // chore: remove blur on lock
  }

  // ... existing settle / scale / overlay flash ...
}
```

> **Pixi 8 BlurFilter 注意**：`strengthY` 才是垂直 blur，`strengthX` = 0 保水平清晰（直線拖影）。`quality: 2` 折衷品質與 perf。

> **`spinColumnCenter` 同樣套用**，但 strength 可微高（22）因為慢動作期間視覺停留更久，plus 中柱戲劇感更強。

#### 3b-3. Cleanup safety

`onUnmount` 或 SlotReel `destroy` 時自動連 filter 一起釋放 — Pixi 8 destroy({ children: true }) 會 cleanup。**不需特別處理**。

**Commit 2**: `feat(chore): SlotReel vertical BlurFilter (strengthY 16/22) on gemBall during spin, removed on lock`

---

### 3c. Commit 3 — Vertical light streaks（reel 上下緣）

#### 3c-1. drawLightStreaks helper

新方法 `drawLightStreaks()`，在 SlotReel constructor 內呼叫一次（建立 streak Container + 子 Graphics），預設 visible=false。

```ts
private streakLayer?: Container;
private streakA!: Graphics;     // top streak
private streakB!: Graphics;     // bottom streak

private drawLightStreaks(): void {
  this.streakLayer = new Container();
  this.streakLayer.visible = false;
  this.addChild(this.streakLayer);

  // Top streak — gold gradient bar above each cell column
  this.streakA = new Graphics();
  this.streakA.alpha = 0;
  this.streakLayer.addChild(this.streakA);

  // Bottom streak
  this.streakB = new Graphics();
  this.streakB.alpha = 0;
  this.streakLayer.addChild(this.streakB);
}
```

#### 3c-2. drawStreakBars helper（每 spin 呼叫）

```ts
private drawStreakBars(): void {
  if (!this.streakA || !this.streakB) return;

  this.streakA.clear();
  this.streakB.clear();

  // Per-column vertical streak strips inside reel border (16px wide gold gradient)
  for (let c = 0; c < COLS; c++) {
    const cx = FRAME_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
    // Top streak
    this.streakA.rect(cx - 8, FRAME_PAD - 4, 16, 12)
      .fill({ color: T.GOLD.glow, alpha: 1 });
    // Bottom streak
    this.streakB.rect(cx - 8, REEL_H - FRAME_PAD - 8, 16, 12)
      .fill({ color: T.GOLD.glow, alpha: 1 });
  }
}
```

#### 3c-3. spin() entry / exit 控制 streak

`spin(finalGrid)` 進入時：
```ts
this.drawStreakBars();
if (this.streakLayer) {
  this.streakLayer.visible = true;
  void tween(180, t => {
    this.streakA.alpha = t * 0.6;
    this.streakB.alpha = t * 0.6;
  });
}
```

`spin()` 結束時（`Promise.all` 之後）：
```ts
if (this.streakLayer) {
  void tween(180, t => {
    this.streakA.alpha = (1 - t) * 0.6;
    this.streakB.alpha = (1 - t) * 0.6;
  }).then(() => {
    if (this.streakLayer) this.streakLayer.visible = false;
  });
}
```

> Streak 採全 COL 同步（不分 col 早晚停），因為視覺上 reel 整盤有「氣場」感即可。若視覺太雜，executor 可改成「整 reel 上下緣 2 條」(non-per-col)。

**Commit 3**: `feat(chore): SlotReel light streaks — gold strip per col top/bottom edges, fade in/out on spin`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（spinColumn / spinColumnCenter / constructor / spin entry-exit）

**禁止**：
- 動 SlotEngine / SymbolsConfig / Resonance / payline 邏輯
- 動 BattleScreen round loop / damage / wallet
- 動 timing const（spinMs 510 / 310 不變 — 視覺包裝層）
- 加新 asset / 改 webp
- 改 SPEC.md / DesignTokens / sim-rtp.mjs / main.ts
- 動 ResultScreen / DraftScreen / LoadingScreen

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 按 SPIN 看 reel 「真的在轉」 — 符號**從上往下滑入**而不是原地閃換（Y 位移肉眼可見）
   - Spin 期間 cells 有**垂直拖影模糊**（清楚但有速度感）
   - Reel 上下緣**金色光束 fade in / out**（spin 啟動時亮，停止時淡出）
   - Spin 停止 5 顆 reel 都正常 lock 到 finalGrid，**無位移殘留**（gemBall.y 必須回 0）
   - **無 BlurFilter 殘留**（spin 結束 cells 必須 sharp）
   - DevTools FPS：spin 期間 ≥ 50（vertical-only blur 較水平+垂直雙向便宜）
   - 無 console error / ticker leak
5. 截圖 1 張：spin 中視角（看得到 blur + slide + streak）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- BlurFilter strengthY 16/22 是否合適（or 太糊看不到符號 / 太清沒速度感）
- Y 位移幅度 -CELL_H 是否合適（-CELL_H/2 較保守 / -CELL_H × 1.5 較誇張？）
- Light streak 視覺效果（per-col 16px 是否 OK / 需改 4px hairline 或 24px wide？）
- DevTools FPS during spin
- Spec deviations：預期 0
- Future enhancement note：若 owner 想要更高保真，下一輪可走 AI 生圖 motion-blur 素材（per owner 的 3-layer 計畫）取代 BlurFilter
