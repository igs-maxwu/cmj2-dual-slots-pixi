# Chore — Formation 5-slot zigzag layout（外內外內外 Z 字陣型，中央 clash 320px）

## 1. Context

Owner 試玩 chore #180 後再要求調整（截圖佐證 + 對話確認 2026-04-30）：

把 chore #180 的「2-row 後 3 前 2」改成 **5-slot Z 字鋸齒**（outer/inner col 交替 5 rows）：

```
LEFT (A): outer 在左 / inner 在右

  COL_X_OUTER (60)    COL_X_INNER (160)
       [P0]                              ← slot 0: outer row 0 (top)
                          [P1]           ← slot 1: inner row 1
       [P2]                              ← slot 2: outer row 2
                          [P3]           ← slot 3: inner row 3
       [P4]                              ← slot 4: outer row 4 (bottom)

RIGHT (B): 鏡射 — inner 在左 / outer 在右
```

每側 5 spirits：3 個在外側 col (rows 0, 2, 4) / 2 個在內側 col (rows 1, 3)。

### 視覺 spec（owner 已確認 4 點）
- Y row spacing: 50px / 5 rows = formation 高 200px
- Outer col x (A): 60 / Inner col x (A): 160
- Scale 由下到上漸變小：row 4=1.10 (front, 最近) → row 0=0.85 (back, 最遠)
- 中央 clash zone：520-200 = **320px**（chore #180 是 152px，這版 2.1×）

機制零改動 — chore #161 activeUnits 兼容、chore #165 hotfix 邏輯保留。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（const + slotToArenaPos / floor + drawSpiritShadows 跟新座標）
- **`source-driven-development`** — 用既有 NINE_CELL_SIZE 80px / canvas_width const，新加 ROW_Y_BASE / COL_X_OUTER 等
- **`debugging-and-error-recovery`** — pre-merge audit checklist 內含 chore #161/#165 兼容驗證

---

## 2. Spec drift check (P6) + Pre-merge audit checklist

### Spec drift check
1. `mempalace_search "Formation 2-row chore 180 SLOT_TO_GRID_POS clash zone"`
2. 確認 chore #180 的 `SLOT_TO_GRID_POS` table 結構（仍存於 BattleScreen.ts）
3. 確認 chore #161 + #165 在 BattleScreen 內 `activeUnits = formation.filter(u => u !== null)` pattern 仍存在
4. 確認 createFormation 仍 9-elem sparse — **本 PR 不動 Formation.ts**

### Pre-merge audit
- [ ] formationA/B 仍 9-elem sparse（不變）
- [ ] activeUnits[slot] (slot 0..4) 對應 SLOT_TO_POS_A/B[slot]
- [ ] B 側 mirror x via `CANVAS_WIDTH - COL_X_OUTER_A` / `CANVAS_WIDTH - COL_X_INNER_A`
- [ ] floor / spirit shadow 跟新 row Y
- [ ] NINE_GRID_TOP_Y / NINE_CELL_SIZE / NINE_GAP / NINE_STEP **不再被 slotToArenaPos 用**（純廢棄 const，不刪保留作 chore #182 cleanup）
- [ ] HP bar UNIT_HP_BAR_Y_OFF unchanged (chore #163)

---

## 3. Task

### 3a. Commit 1 — 5-slot zigzag const + slotToArenaPos 重寫

`src/screens/BattleScreen.ts`：

#### 3a-1. 移除 chore #180 SLOT_TO_GRID_POS + const，新增 zigzag spec

當前 chore #180 line 87-115 area：
```ts
const NINE_CELL_SIZE     = 80;
const NINE_GAP           = 24;
const NINE_STEP          = NINE_CELL_SIZE + NINE_GAP;
const NINE_GRID_TOTAL    = ...
const NINE_GRID_TOP_Y    = 305;
const NINE_A_GRID_LEFT_X = 16;
const NINE_B_GRID_LEFT_X = ...
const SLOT_TO_GRID_POS: { col: number; row: number }[] = [...];
const ROW_SCALE_BACK  = 0.85;
const ROW_SCALE_FRONT = 1.10;
```

改成（保留 NINE_CELL_SIZE 等廢棄 const 作 deprecation 註解，避免破壞其他 reference）：
```ts
// chore: 5-slot zigzag formation — outer/inner col alternating across 5 rows
// Owner-confirmed layout 2026-04-30: scales bottom→top (row 4 largest = nearest viewer)
// Each side: 3 spirits in outer col (rows 0/2/4) + 2 spirits in inner col (rows 1/3)
const ROW_Y_BASE = 320;          // first row centre Y
const ROW_Y_STEP = 50;            // 5 rows × 50 = 200px formation height (320..520)
const COL_X_OUTER_A = 60;         // A side outer col x (far-left, near canvas edge)
const COL_X_INNER_A = 160;        // A side inner col x (closer to centre)
const COL_X_OUTER_B = CANVAS_WIDTH - 60;    // 660 (B mirror)
const COL_X_INNER_B = CANVAS_WIDTH - 160;   // 560 (B mirror)

// Per-side 5-slot mapping: { x_offset_key, y_row, scale }
// scale gradient: row 0=0.85 (smallest, top/back) → row 4=1.10 (largest, bottom/front)
const SLOT_TO_POS_SPEC: { col: 'outer' | 'inner'; row: number; scale: number }[] = [
  { col: 'outer', row: 0, scale: 0.85 },   // slot 0: outer top
  { col: 'inner', row: 1, scale: 0.91 },   // slot 1: inner row 1
  { col: 'outer', row: 2, scale: 0.97 },   // slot 2: outer row 2
  { col: 'inner', row: 3, scale: 1.04 },   // slot 3: inner row 3
  { col: 'outer', row: 4, scale: 1.10 },   // slot 4: outer bottom (front)
];

// chore: keep NINE_CELL_SIZE etc. for chore #163 HP bar offset compat — UNIT_HP_BAR_Y_OFF still references it
const NINE_CELL_SIZE = 80;       // (deprecated as grid metric — kept for HP bar offset)
const NINE_GAP       = 24;       // (deprecated)
const NINE_STEP      = NINE_CELL_SIZE + NINE_GAP;  // (deprecated)
// const NINE_GRID_TOP_Y / NINE_A_GRID_LEFT_X / NINE_B_GRID_LEFT_X / NINE_GRID_TOTAL → removed
// const SLOT_TO_GRID_POS / ROW_SCALE_BACK / ROW_SCALE_FRONT → removed
```

> **Important**：UNIT_HP_BAR_Y_OFF (chore #163) 用 `NINE_CELL_SIZE / 2 + 10`，所以保留 `NINE_CELL_SIZE` const 不破壞 HP bar 對齊。其他 NINE_* const 看 grep 結果決定刪除順序（若還有 reference 則保留）。

#### 3a-2. slotToArenaPos 重寫

當前 chore #180 line 1014+：
```ts
private slotToArenaPos(side: 'A' | 'B', slot: number): { x: number; y: number; row: number; scale: number } {
  const pos = SLOT_TO_GRID_POS[slot] ?? SLOT_TO_GRID_POS[0]!;
  const { col, row } = pos;
  const mirroredCol = side === 'B' ? (2 - col) : col;

  const gridLeftX = side === 'A' ? NINE_A_GRID_LEFT_X : NINE_B_GRID_LEFT_X;
  const cellX     = gridLeftX + mirroredCol * NINE_STEP + NINE_CELL_SIZE / 2;
  const cellY     = NINE_GRID_TOP_Y + row * NINE_STEP + NINE_CELL_SIZE / 2;

  const scale = row === 0 ? ROW_SCALE_BACK : ROW_SCALE_FRONT;

  return { x: cellX, y: cellY, row, scale };
}
```

改成：
```ts
private slotToArenaPos(side: 'A' | 'B', slot: number): { x: number; y: number; row: number; scale: number } {
  // chore: 5-slot zigzag — outer/inner col alternating, scale gradient bottom→top
  const spec = SLOT_TO_POS_SPEC[slot] ?? SLOT_TO_POS_SPEC[0]!;
  const { col, row, scale } = spec;

  const x = side === 'A'
    ? (col === 'outer' ? COL_X_OUTER_A : COL_X_INNER_A)
    : (col === 'outer' ? COL_X_OUTER_B : COL_X_INNER_B);
  const y = ROW_Y_BASE + row * ROW_Y_STEP;

  return { x, y, row, scale };
}
```

> **JSDoc 也更新**（chore #180 留下舊註解仍提 row 0|1|2）：
> ```ts
> /**
>  * Maps a formation slot index (0-4) to arena position.
>  * Layout: 5-slot zigzag — outer/inner col alternating across 5 rows.
>  * Slot 0/2/4 = outer col (rows 0/2/4) ; Slot 1/3 = inner col (rows 1/3).
>  * Scale gradient: row 0 (top, back) = 0.85 → row 4 (bottom, front) = 1.10.
>  */
> ```

**Commit 1**: `feat(chore): formation 5-slot zigzag — outer/inner col alternating, scale gradient bottom→top, clash zone 320px`

---

### 3b. Commit 2 — Floor + drawSpiritShadows 跟新座標

#### 3b-1. drawBackground floor

當前 chore #180 line ~387:
```ts
const floorTop = NINE_GRID_TOP_Y + NINE_STEP + NINE_CELL_SIZE;  // 489
```

改成：
```ts
// chore: floor below new front-most slot (slot 4 row 4 at y=520) bottom
// slot 4 cell bottom = ROW_Y_BASE + 4*ROW_Y_STEP + spirit_visual_half ≈ 520+44=564
// Use 565 as floor top, ARENA_BOT 585 → 20px floor depth
const floorTop = ROW_Y_BASE + 4 * ROW_Y_STEP + 45;  // 320+200+45 = 565
```

> 實際 spirit visual height 可能不到 80px (sprite anchor 0.5,1)，executor 視 preview 微調 floor top 數值（求視覺自然，floor 從 spirit 腳底開始）。

#### 3b-2. drawSpiritShadows

`drawSpiritShadows` (line 564-579) 不需動 — 自動 follow slotToArenaPos 新座標 + scale。

但 shadow Y offset 計算當前用 `NINE_CELL_SIZE / 2`（line 574）— 若新 layout 視覺感受 shadow 位置偏離 spirit feet，executor 微調 +offset。

**Verify**：
- Slot 0 (outer top, scale 0.85, y=320)：shadow at y=320 + 80/2 + 2 = 362
- Slot 4 (outer bottom, scale 1.10, y=520)：shadow at y=520 + 80/2 + 2 = 562
- Floor at y=565, slot 4 shadow at y=562 → 緊貼 floor 邊緣 OK

#### 3b-3. drawFormation z-order

`drawFormation` 內既 chore #150 spirits 按 row 排序 back→front。新 layout 5 rows，sortedSlots 按 row 0..4 排序仍正確（row 越大 = 越前 = 後 addChild）。**不需動**。

**Commit 2**: `tune(chore): formation floor + shadow follow new 5-row Y coords (floorTop ROW_Y_BASE+200+45=565)`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（const 重寫 + slotToArenaPos + floor 計算 + JSDoc 更新）

**禁止**：
- 動 createFormation / Formation.ts
- 動 chore #161/#165 activeUnits filter pattern
- 動 chore #163 UNIT_HP_BAR_Y_OFF（仍 reference NINE_CELL_SIZE）
- 動 chore #170-179 SlotReel + SpiritAttackChoreographer
- 改 SymbolsConfig / DesignTokens / sim-rtp / SPEC.md / main.ts
- 動 ResultScreen / DraftScreen

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Pre-merge audit (executor 自查)**：
   - `grep "NINE_GRID_TOP_Y\|NINE_A_GRID_LEFT_X\|NINE_B_GRID_LEFT_X\|SLOT_TO_GRID_POS\|ROW_SCALE_" src/screens/BattleScreen.ts` — 應只在新 const 區附近 + JSDoc 殘留，不應有 runtime reference
   - `grep "NINE_CELL_SIZE\|NINE_STEP" src/screens/BattleScreen.ts` — 確認剩餘 reference 是 chore #163 HP bar / drawSpiritShadows shadow offset 等合理用途
5. **Preview 驗證 critical**：
   - 雙側 formation 顯示 **Z 字鋸齒**（outer-inner-outer-inner-outer 從上到下）
   - 上面 spirit 比下面 spirit **小**（scale 0.85 → 1.10 漸變）
   - 中央 clash zone **完全淨空**（可從 200x to 520x = 320px 清楚看到 floor 透視）
   - chore #178/179 attack avatar clash 不撞 formation
   - chore #163 HP bar 仍在 spirit 腳底
   - chore #161/#165 5 spirit 全可見、SPIN 不卡
   - 8 signature attack fx 仍正常
5. 截圖 1-2 張：formation Z 字陣 + clash 中央 attack 對打

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- Z 字 zigzag 視覺感受 OK 嗎（vs chore #180 的 2-row）
- Scale 漸進 0.85→1.10 是否 owner 想要的 depth feel
- floor 起點 565 是否視覺自然（or 需 +/-10 微調）
- 中央 clash 320px 是否寬到讓 attack 戲劇性夠
- Spec deviations：預期 0
- **Audit lessons applied**：
  - 沒新 Sprite.width/height vs scale.set 衝突
  - 沒新 hitArea button
  - chore #161/#165 兼容（slot 0..4 仍對 SLOT_TO_POS_SPEC）
  - HP bar offset 保留 NINE_CELL_SIZE 不破壞 chore #163
