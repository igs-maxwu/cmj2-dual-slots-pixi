# Chore — 5 reels 同時開始轉，分 3 階段停（1+5 / 2+4 / 3）

## 1. Context

當前 SlotReel.spin (line 360+) timing：
```
t=0     : R1+R5 (cols 0,4) start
t=500   : R2+R4 (cols 1,3) start    ← await delay(500) between
t=1000  : R3   (col 2) start
t=600   : R1+R5 lock
t=1100  : R2+R4 lock
t=1610  : R3   lock
```

→ 5 reels **錯開啟動**（外環先轉、內環後轉、中央最後）。

### Owner spec change
> 「我要改停輪，希望是大家一起轉，然後 1、5 輪一起停，2、4 輪一起停，第 3 輪最後停」

→ **同時開始**轉，**依序停**：
```
t=0     : ALL 5 reels start (cols 0,1,2,3,4)
t=600   : R1+R5 (cols 0,4) lock
t=1100  : R2+R4 (cols 1,3) lock      (Δ500 from R1+R5)
t=1610  : R3 (col 2) lock              (Δ510 from R2+R4)
```

純視覺 timing 改動 — 不動 spin 內部邏輯（fade / swap / settle / 信號 fx）。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用既有 spinColumn / spinColumnCenter 結構，調 spinMs 參數 + 移除 `await delay(500)`

---

## 2. Spec drift check (P6)

1. 確認 `SlotReel.spin` line 360-380 既有結構（3 group + 2 await delay）
2. 確認 `spinColumn` 內部 timing：fade 90 + swap spinMs + compress 70 + settle 240
3. 確認 `spinColumnCenter` 內部 timing：pre-flash 200/400 + fade 90 + swap spinMs + compress 70 + settle 240
4. 確認 chore #170/172/174 (BlurFilter / mask / ghost fix) 在 spinColumn 內部不受影響

---

## 3. Task

### Single commit — Adjust spinMs + remove inter-group delays

`src/screens/SlotReel.ts` `spin()` line 360-380 area：

當前：
```ts
async spin(finalGrid: number[][]): Promise<void> {
  // chore: light streak fade-in at spin start
  if (this.streakLayer) { ... }

  // Outer pair — start immediately, lock at t ≈ 600ms
  const p04 = Promise.all([
    this.spinColumn(0, finalGrid, 510),
    this.spinColumn(4, finalGrid, 510),
  ]);

  // Inner pair — start 500ms later, lock at t ≈ 1100ms
  await delay(500);
  const p13 = Promise.all([
    this.spinColumn(1, finalGrid, 510),
    this.spinColumn(3, finalGrid, 510),
  ]);

  // Center — start 500ms after inner, lock at t ≈ 1600ms (or ≈ 1800ms if teaser)
  await delay(500);
  const p2 = this.spinColumnCenter(2, finalGrid, 310, teaser);

  await Promise.all([p04, p13, p2]);
  ...
}
```

改成：
```ts
async spin(finalGrid: number[][]): Promise<void> {
  // chore: light streak fade-in at spin start
  if (this.streakLayer) { ... }

  // chore #191: ALL 5 reels start simultaneously; stops staggered in 3 stages
  // Stage 1 (t≈600): cols 0+4 lock first
  // Stage 2 (t≈1100): cols 1+3 lock (Δ500 from stage 1)
  // Stage 3 (t≈1610): col 2 locks last (slow-mo + pre-flash, Δ510 from stage 2)
  const teaser = hasPreMatch(finalGrid, 0, 1) || hasPreMatch(finalGrid, 4, 3);

  const p04 = Promise.all([
    this.spinColumn(0, finalGrid, 510),     // unchanged: lock t=600
    this.spinColumn(4, finalGrid, 510),
  ]);
  const p13 = Promise.all([
    this.spinColumn(1, finalGrid, 1010),    // chore: was 510, +500 to stagger lock to t=1100
    this.spinColumn(3, finalGrid, 1010),
  ]);
  // chore: center column slow-mo extends — was spinMs=310 (with pre-flash 200 + fade 90 + settle 240 = total 840 from start delay 1000 = lock at 1610)
  // New: start at t=0, total to t=1610 → swap spinMs = 1610 - pre-flash(200) - fade(90) - compress(70) - settle(240) = 1010
  const p2 = this.spinColumnCenter(2, finalGrid, 1010, teaser);

  await Promise.all([p04, p13, p2]);

  // chore: light streak fade-out at spin end (existing)
  if (this.streakLayer) { ... existing ... }
}
```

> **Note**：`teaser` 計算（既有 line 357-358）保留，移到 spin() 開頭。

> **Center spinMs 計算**：
> - 既有 spinColumnCenter 內 phase: pre-flash 200ms (or 400ms teaser) + fade 90ms + swap spinMs ms + compress 70ms + settle 240ms
> - 既有 spinMs=310 ⇒ total internal = 200+90+310+70+240 = 910ms
> - 加上 outer await delay 500 + inner await delay 500 = 1000ms 啟動延遲
> - 既有 lock time = 1000 + 910 = 1910ms（spec note 寫 1610，可能 spec note 略誤差或實測）
> - 新版 start at t=0：center swap spinMs = 1610 - 200 - 90 - 70 - 240 = 1010
> - **若 teaser**：pre-flash 400ms → swap = 1610 - 400 - 90 - 70 - 240 = 810
>
> **Decision**：spinColumnCenter 內部已 conditional pre-flash (line ~376 `flashMs = anticipated ? 400 : 200`)。passing spinMs=1010 in normal case，teaser 仍 swap 1010 (lock 推遲到 1810ms — acceptable，teaser 是戲劇加長)。**或**：傳遞 `spinMs=810` if teaser else `1010`（兩段 logic）— 更精確。Executor 視 trial 決定。

#### Update spec note JSDoc (line 351-358)

當前：
```ts
/**
 * Spec-locked stop times (measured from spin() call, settle phase excluded):
 *   R1+R5  lock at t = 0.6 s   (start t=0,    fade 90ms + swap 510ms)
 *   R2+R4  lock at t = 1.1 s   (start t=500ms, fade 90ms + swap 510ms)
 *   R3     lock at t = 1.6 s   (start t=1000ms, pre-flash 200ms + fade 90ms + swap 310ms)
 *
 * Each group is separated by 500 ms.
 */
```

改成：
```ts
/**
 * Spec (chore #191): ALL 5 reels start simultaneously at t=0; stops staggered in 3 stages.
 *   R1+R5  lock at t ≈ 0.6 s  (fade 90ms + swap 510ms + settle, lock = 600ms)
 *   R2+R4  lock at t ≈ 1.1 s  (fade 90ms + swap 1010ms + settle, lock = 1100ms)
 *   R3     lock at t ≈ 1.6 s  (pre-flash 200ms + fade 90ms + swap 1010ms + compress + settle = 1610ms)
 *                              (teaser: pre-flash 400ms → lock at 1810ms)
 *
 * Owner spec 2026-05-04: "大家一起轉，1+5 一起停，2+4 一起停，第 3 輪最後停"
 */
```

**Commit**: `feat(chore): SlotReel spin — all 5 cols start simultaneously, lock staggered in 3 stages (cols 0+4 / 1+3 / 2)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（spin() function 內 3 group call + JSDoc + 移除 2 await delay）

**禁止**：
- 動 spinColumn / spinColumnCenter 內部邏輯（fade / swap / compress / settle / overlay 動畫）
- 動 chore #170 BlurFilter (gemBall.filters)
- 動 chore #172 resetGemBallFilter
- 動 chore #174 cell mask
- 動 hasPreMatch helper (既有 line 28-33)
- 動 light streak fade-in/out（既有 streakLayer 流程）
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "await delay(500)" src/screens/SlotReel.ts` — 0 hits（兩個 inter-group delay 都移除）
   - `grep "spinMs.*1010\|spinColumn(.*1010" src/screens/SlotReel.ts` — 確認新 spinMs 數值
5. **Preview 驗證 critical**：
   - 按 SPIN：5 reels **同時啟動**（不再外環先轉、內環後）
   - **R1 (col 0) + R5 (col 4) 一起停**（最早）
   - 約 0.5s 後 **R2 (col 1) + R4 (col 3) 一起停**
   - 再約 0.5s 後 **R3 (col 2) 最後停**（含 pre-flash 戲劇感）
   - chore #170 BlurFilter motion blur 仍正常（per-cell mask 仍 clip）
   - chore #171/172 連連看 trace + ring 仍正常
   - 中柱 teaser anticipation pre-flash 在某些 spin 仍觸發（hasPreMatch 為 true 時）
   - 整體節奏感**戲劇性更強**（owner 期望）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（spin 中段，5 reels 同時轉）
- timing 是否 OK：t=600/1100/1610 三個 lock point 視覺戲劇性
- teaser 觸發時 R3 推到 t=1810 是否覺得太久（or accept）
- chore #170-174 SlotReel 改動全保留無 regression
- Spec deviations：1（spin timing 從 staggered-start 改為 simultaneous-start，owner-approved 2026-05-04）
