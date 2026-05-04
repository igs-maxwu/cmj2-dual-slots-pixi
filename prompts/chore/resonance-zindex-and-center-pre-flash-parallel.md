# Chore — Resonance banner zIndex 提到最上 + 中柱 pre-flash 改 parallel（真同時開始轉）

## 1. Context

Owner 試玩 chore #191/#192 後 2 issue：

### Issue 1: Resonance banner 不在最上層

chore #191 `playSideResonanceBanner` 設 `banner.zIndex = 1000`。
chore #189 設 `fxLayer.zIndex = 3000`。
→ fxLayer (3000) > resonance banner (1000) → fxLayer 蓋住 banner。

**Fix**：banner.zIndex = 3500（高於 fxLayer）。

### Issue 2: 中柱仍視覺晚啟動

chore #192 移除 group 間 `await delay(500)`，但 `spinColumnCenter` 內部仍有：
```ts
await tween(flashMs, ...);   // pre-flash 200/400ms (BEFORE swap)
await tween(90, ...);        // fade 90ms (BEFORE swap)
// then enter swap loop
```

→ 中柱 swap 視覺啟動晚 290-490ms（owner 視覺感受「沒一起開始轉」）。

**Fix**：pre-flash 改 fire-and-forget 並行 swap：
```ts
void tween(flashMs, ...);   // overlay 動畫平行 swap 跑
await tween(90, ...);        // fade 90ms
// enter swap immediately (no pre-flash await)
```

這樣中柱 swap loop 跟 outer/inner 一樣在 t=90 啟動。Pre-flash overlay 跟 swap **並行**呈現（更戲劇）。

### Center spinMs 重新計算

- 之前 chore #192: 200(pre-flash 序) + 90(fade) + 1320(swap) = 1610 lock target
- 之後 chore #193: pre-flash 並行 → 90(fade) + spinMs(swap) = lock target
- 為維持 owner spec lock t=1610: **spinMs = 1520**（從 1320 增加 200）
- Teaser 觸發時 pre-flash 400ms 並行，swap 1520ms 仍 dominate → lock 仍 1610（pre-flash 消失於 t≈490 之後）

---

## Skills suggested

- **`incremental-implementation`** — 1 commit (兩處 fix tightly bundled)
- **`source-driven-development`** — 沿用既有 await/void tween pattern

---

## 2. Spec drift check (P6)

1. 確認 chore #189 fxLayer.zIndex=3000 + container.sortableChildren=true 仍存在
2. 確認 chore #191 playSideResonanceBanner banner.zIndex=1000 (line ~1672)
3. 確認 chore #192 spin() group 結構 + center spinMs=1320

---

## 3. Task

### Single commit — 雙修

#### 3a. Resonance banner zIndex bump

`src/screens/BattleScreen.ts` `playSideResonanceBanner` (line ~1670 area)：

```ts
// 當前：
banner.zIndex = 1000;

// 改成：
banner.zIndex = 3500;   // chore #193: above fxLayer (z=3000) so always topmost
```

#### 3b. spinColumnCenter pre-flash parallel

`src/screens/SlotReel.ts` `spinColumnCenter` (line 469+)：

當前：
```ts
private async spinColumnCenter(col: number, finalGrid: number[][], spinMs: number, anticipated: boolean): Promise<void> {
  const colCells = this.cells[col];

  AudioManager.playSfx('reel-r3-anticipation');

  const flashFill = anticipated ? (T.GOLD.light ?? T.GOLD.base) : T.GOLD.base;
  const flashMs   = anticipated ? 400 : 200;
  const flashPeak = anticipated ? 0.85 : 0.55;
  for (const cell of colCells) {
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(flashFill);
  }
  await tween(flashMs, p => {              // ← BLOCKING await
    const a = Easings.pulse(p) * flashPeak;
    for (const cell of colCells) cell.overlay.alpha = a;
  });
  for (const cell of colCells) {
    cell.overlay.alpha = 0;
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(0xffffff);
  }

  // Spin-up fade
  await tween(90, p => {
    for (const cell of colCells) cell.container.alpha = 1 - p * 0.35;
  });
  // ... swap loop ...
```

改成：
```ts
private async spinColumnCenter(col: number, finalGrid: number[][], spinMs: number, anticipated: boolean): Promise<void> {
  const colCells = this.cells[col];

  AudioManager.playSfx('reel-r3-anticipation');

  // chore #193: pre-flash overlay runs IN PARALLEL with swap (was BEFORE) — center spins simultaneously with outer/inner
  const flashFill = anticipated ? (T.GOLD.light ?? T.GOLD.base) : T.GOLD.base;
  const flashMs   = anticipated ? 400 : 200;
  const flashPeak = anticipated ? 0.85 : 0.55;
  for (const cell of colCells) {
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(flashFill);
  }
  // Fire-and-forget pre-flash — overlay animates while swap runs underneath (more dramatic)
  void tween(flashMs, p => {
    const a = Easings.pulse(p) * flashPeak;
    for (const cell of colCells) cell.overlay.alpha = a;
  }).then(() => {
    for (const cell of colCells) {
      cell.overlay.alpha = 0;
      cell.overlay.clear()
        .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
        .fill(0xffffff);
    }
  });

  // Spin-up fade (proceeds immediately — does NOT wait for pre-flash)
  await tween(90, p => {
    for (const cell of colCells) cell.container.alpha = 1 - p * 0.35;
  });
  // ... swap loop unchanged ...
```

#### 3c. spin() center spinMs bump

`src/screens/SlotReel.ts` `spin()` line ~390 area：

當前：
```ts
const p2 = this.spinColumnCenter(2, finalGrid, 1320, teaser);
```

改成：
```ts
// chore #193: center pre-flash now parallel — swap extended from 1320→1520 to maintain lock at t≈1610
const p2 = this.spinColumnCenter(2, finalGrid, 1520, teaser);
```

#### 3d. Update JSDoc

`spin()` 上方 JSDoc：

當前：
```ts
*   R3     lock at t ≈ 1.6 s  (pre-flash 200ms + fade 90ms + swap 1320ms = 1610ms)
*                              (teaser: pre-flash 400ms → lock at 1810ms)
```

改成：
```ts
*   R3     lock at t ≈ 1.6 s  (fade 90ms + swap 1520ms = 1610ms)
*                              (pre-flash overlay parallel, 200/400ms — visual only, no lock impact)
*                              (teaser: same lock t≈1610ms — pre-flash 400ms still parallel)
```

> **Teaser 改動**：teaser 不再延遲 lock（pre-flash 並行）。失去原本「teaser 多 200ms 戲劇」效果 — trade-off for simultaneous-start spec。Owner 確認此妥協。

**Commit**: `fix(chore): resonance banner zIndex 3500 (above fxLayer) + center pre-flash parallel for true simultaneous spin start`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（playSideResonanceBanner banner.zIndex 1000→3500）
- `src/screens/SlotReel.ts`（spinColumnCenter pre-flash await→void + spin() center spinMs 1320→1520 + JSDoc）

**禁止**：
- 動 chore #189 fxLayer.zIndex
- 動 chore #191 banner color / position / fade timing
- 動 chore #192 outer/inner spinMs
- 動 chore #170/#172/#174 SlotReel BlurFilter / mask / ghost fix
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL OR direct master commit (executor 可走任一 pattern，但 mechanic-impact 偏好 PR)
4. **Pre-merge audit**：
   - `grep "zIndex.*3500\|banner\.zIndex" src/screens/BattleScreen.ts` — 確認 3500 設置
   - `grep "void tween" src/screens/SlotReel.ts` — 確認 pre-flash 改 fire-and-forget
   - `grep "1520\|spinMs.*1520" src/screens/SlotReel.ts` — 確認 swap 1520
5. **Preview 驗證 critical**：
   - 共鳴觸發時 banner 浮在 spirits **之上**（不再被蓋）
   - 按 SPIN 後 5 reels 視覺**真的同時開始 swap**（中柱不再延遲 290ms 才動）
   - 中柱 pre-flash overlay 跟 swap **並行**呈現（金色閃光在轉動中柱上）
   - 3-stage 停止仍 t≈600 / 1100 / 1610（teaser 也 1610，不再 1810）
   - chore #170/#172/#174 BlurFilter / mask / ghost fix 仍正常

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（共鳴 banner 在最上層 + 5 reels 同時轉）
- 中柱 pre-flash 並行視覺感受是否更戲劇（or 失去原本 anticipation 感）
- teaser 不再延遲 lock 是否可惜（vs simultaneous-start trade-off）
- Spec deviations：1（teaser 不再延遲 lock — owner-approved 2026-05-04 chore #192 simultaneous-start spec 推進）
