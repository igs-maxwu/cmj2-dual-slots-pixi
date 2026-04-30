# Chore — Spin BlurFilter 漏出 reel 邊界 fix（cell 加 mask 限制視覺範圍）

## 1. Context

Owner 試玩 #173 後反映（截圖佐證）：spin 進行中時，**模糊效果**從 cell 內部**漏到 reel 框上方**，能看到彩色 vertical streaks 跑到 reel 邊界外面。

### Root cause

chore #170 設計：
- `BlurFilter({ strengthX: 0, strengthY: 16 })` 套到 `gemBall` during spin
- `gemBall.y` 從 `-CELL_H`（cell 上方一格距離）slide 到 `0`（cell 中心）
- BlurFilter strengthY=16 還會額外往外拓寬模糊範圍 ~16px

→ 結合下：spin 期間 gemBall 視覺上半部跑出 cell.container 區域（cell 不限制 child clipping），且 SlotReel 主框也不限制 cell clipping → 模糊穿透到 reel 邊界外。

特別 spin 啟動瞬間（gemBall.y = -CELL_H = 完整 cell 高度上方），整個 gemBall 在 cell 上方時被 BlurFilter 拉長模糊 → 直接擠破 reel 上框。

### 修法選項評估

| Option | 範圍 | 優點 | 缺點 |
|---|---|---|---|
| **A** Per-cell mask | 每 cell.container 加 Graphics rect mask | 局部化，每 cell 自治 | 15 個 mask Graphics |
| **B** Reel-level mask | SlotReel 上加單一大 rect mask | 1 mask 解決 | 也 clip 到 streak 上下緣（chore #170 的 light streaks 設計就是要 sit on edge） |
| **C** 縮小 slide range | -CELL_H → 0 改成 -CELL_H/2 → 0 | 0 行 mask | 視覺速度感變弱 |
| **D** 縮 BlurFilter strengthY | 16 → 8 | 0 mask | 模糊感下降 |

→ **採 Option A**（per-cell mask）：最局部、最不影響其他視覺（streak / ring / arrow 都加在 SlotReel level 不在 cell 內）。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit hotfix
- **`source-driven-development`** — 用實際 cell.container layout（chore #170 後）算 mask rect

---

## 2. Spec drift check (P6)

1. `mempalace_search "chore 170 BlurFilter strengthY 16 spin Y slide overflow"`
2. 確認 chore #170 `gemBall.y -CELL_H → 0` slide 範圍仍是 spin 路徑
3. 確認 既 cell.container 結構：`container.x = FRAME_PAD + col*(CELL_W+CELL_GAP) + CELL_W/2`，`container.y` 同樣 cell-centre coords，children 都繞 0,0 畫
4. 確認 既 cellBg / innerRing / gemBall / overlay / pipsContainer 都 anchor 0,0 畫於 cell 中心 (-CELL_W/2 ~ +CELL_W/2)

---

## 3. Task

### Single commit — Per-cell rect mask

`SlotReel.buildCells()` line 131-179（既有結構）內，每 cell 創建時新增 mask Graphics。

當前（精簡）：
```ts
private buildCells(): void {
  for (let c = 0; c < COLS; c++) {
    const colCells: Cell[] = [];
    for (let r = 0; r < ROWS; r++) {
      const x = FRAME_PAD + c * (CELL_W + CELL_GAP);
      const y = FRAME_PAD + r * (CELL_H + CELL_GAP);

      const container = new Container();
      container.x = x + CELL_W / 2;
      container.y = y + CELL_H / 2;
      this.addChild(container);

      // ... cellBg / innerRing / gemBall / pipsContainer / overlay add ...

      colCells.push({ container, gemBall, overlay, currentSymbol: -1, pipsContainer });
    }
  }
}
```

加 mask：
```ts
private buildCells(): void {
  for (let c = 0; c < COLS; c++) {
    const colCells: Cell[] = [];
    for (let r = 0; r < ROWS; r++) {
      const x = FRAME_PAD + c * (CELL_W + CELL_GAP);
      const y = FRAME_PAD + r * (CELL_H + CELL_GAP);

      const container = new Container();
      container.x = x + CELL_W / 2;
      container.y = y + CELL_H / 2;
      this.addChild(container);

      // chore: rect mask to clip blur/slide overflow within cell bounds
      // Mask is also a child of container so it tracks container x/y/scale
      const cellMask = new Graphics()
        .rect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H)
        .fill(0xffffff);
      container.addChild(cellMask);
      container.mask = cellMask;

      // ... existing cellBg / innerRing / gemBall / pipsContainer / overlay ...
    }
  }
}
```

> **重要**：mask 要 `addChild` 進 container 才能跟著 container 移動 / scale；否則 container.scale 變化時 mask 不跟。

> **⚠ 影響檢查**：
> - chore #171 popCell 對 cell.container.scale 0.9 → 1.3 → 0.9 變化 — mask child 自動跟 scale，仍 clip 對 ✓
> - chore #170 cell.container.alpha 變化 spin-up fade — mask 不影響 alpha ✓
> - chore #170 BackOut settle scale 0.9 → 1.0 — mask 跟 scale ✓
> - chore #172 drawWinRing 加在 SlotReel level（this.addChild），**不在 container 內** → ring 不被 cell mask clip ✓
> - chore #171 drawArrow 加在 SlotReel level — 不被 cell mask clip ✓
> - cell.overlay 是 cell-internal child — 被 mask 沒問題（overlay 本來就在 cell 範圍內畫的）

### 驗證

`npm run build` + 試玩：
- spin 期間**不應該再看到模糊跑出 reel 邊界**
- spin lock 後正常 sharp（chore #172 ghost fix 邏輯不受影響）
- popCell scale pulse 1.0 → 1.3 視覺仍正常（cell 變大時 mask 跟著變大 clip 範圍 OK）
- ring + arrow 在中獎時仍清楚 visible（不被 mask clip）

**Commit**: `fix(chore): SlotReel cell rect mask — clip BlurFilter overflow within cell bounds during spin`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（buildCells 內每 cell 加 cellMask Graphics + container.mask 設定）

**禁止**：
- 動 chore #170 BlurFilter strength / Y slide 範圍
- 動 chore #171 popCell / drawArrow / drawWinRing
- 動 chore #172 resetGemBallFilter
- 動 SlotEngine / SymbolsConfig / 機制
- 改 SPEC.md / DesignTokens / sim-rtp.mjs / main.ts
- 加新 asset

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Preview 驗證 critical**：
   - spin 期間**模糊不再漏出 reel 上下邊界**（截圖佐證）
   - spin 過程符號仍清楚有 motion blur + Y slide 視覺感（chore #170 的視覺感受保留）
   - 中獎 ring + arrow 仍 visible（不被 cell mask clip 掉）
   - popCell pulse 動畫 scale 1.3 倍仍正常 visible（mask 跟 cell.container scale 變大 → clip 範圍變大 ✓）
   - DevTools FPS 不變
   - 無 console error
5. 截圖 1 張：spin 中視角，確認模糊**全部 contained 在 reel 內**

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（before/after 對比優先）
- 確認 cell mask 不影響 popCell pulse 視覺（cell 變大時 mask 跟 scale，1.3 倍時仍應正常 visible）
- 確認 ring + arrow 仍正常（在 SlotReel level addChild 不被 cell mask clip）
- DevTools FPS 比較（mask 應該無感）
- Spec deviations：預期 0
