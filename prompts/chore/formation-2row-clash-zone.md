# Chore — Formation 2-row 重設計（前 2 / 後 3 / 中間 col 1 EMPTY，clash zone 加寬至 152px）

## 1. Context

Owner 試玩 chore #179 後反映：雙側 attack clash 中央會撞到 formation 前排（centerX±70 clash zone vs NineGrid 前排重疊）。

**期望新 layout**（owner 確認 2026-04-30）：

```
Per side, 2 rows × 3 cols, 5 spirits with middle-front empty:

Back row  (y=305, scale 0.85):  s0  s1  s2     ← 3 spirits across
Front row (y=409, scale 1.10):  s3      s4     ← 2 spirits at edges (col 1 EMPTY)

Per-side grid pulled toward outer canvas edge:
  A: NINE_A_GRID_LEFT_X 32 → 16
  B: NINE_B_GRID_LEFT_X 400 → 416

Resulting clash zone (canvas centre):
  A right edge:  16 + 288 = 304 (was 320)
  B left  edge:  416         (was 400)
  Centre clash gap: 152px (was 80px) ← 1.9× wider, ±70 clash now well-clear
```

機制零改動 — `createFormation` 仍產 9-elem sparse、chore #161 activeUnits filter 仍套、chore #165 playAttackAnimations hotfix 邏輯保留。**只動視覺座標 + slot→position mapping**。

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（const + slotToArenaPos / Fisher-Yates 移除 / floor + spirit shadow 跟新位置）
- **`source-driven-development`** — 沿用既有 NINE_CELL_SIZE / NINE_GAP / NINE_STEP / NINE_GRID_TOP_Y const，不發明新的座標系
- **`debugging-and-error-recovery`** — 5-step verify chore #161/#165 hotfix 邏輯仍正確（activeUnits 跟 5-slot 對應）

---

## 2. Spec drift check (P6) + Pre-merge audit checklist

### Spec drift
1. `mempalace_search "NineGrid Fisher-Yates 5-of-9 placement gridPlacement chore 161 activeUnits"`
2. 確認 `createFormation` (`src/systems/Formation.ts:12-33`) 仍是 9-elem sparse（random placement 0-8）— **本 PR 不動 Formation.ts**
3. 確認 chore #161 + #165 在 `BattleScreen.ts` 內 `activeUnits = formation.filter(u => u !== null)` pattern 仍存在
4. 確認 chore #163 HP bar UNIT_HP_BAR_Y_OFF = +50 (relative to spirit container) — **本 PR 不影響**
5. 確認 chore #170/172/174 SlotReel BlurFilter / mask / ghost fix 全在 SlotReel.ts，**本 PR 不碰 SlotReel**

### Pre-merge audit（executor 完成前自查 + 我會 review）
- [ ] `formationA/B` 仍是 9-elem sparse（不變）
- [ ] `activeUnits[slot]` 仍對應 spirit 0..4
- [ ] `SLOT_TO_GRID_POS[slot]` 對應 5 個固定位置
- [ ] B 側 mirroredCol = 2 - col 仍套（face A）
- [ ] front row scale 1.10 spirit 沒 overlap to clash zone（A 右邊到 304，clash zone 290-430，front row right 在 304-40=264 OK）
- [ ] floor / shadow / hp bar 跟新 row Y 重對齊

---

## 3. Task

### 3a. Commit 1 — SLOT_TO_GRID_POS table + const 更新

`src/screens/BattleScreen.ts` line 87-95 area：

當前：
```ts
// Depth scale: row 0 (back) = 0.78 × SPIRIT_H, row 1 (mid) = 0.94 ×, row 2 (front) = 1.10 ×
const NINE_CELL_SIZE     = 80;
const NINE_GAP           = 24;
const NINE_STEP          = NINE_CELL_SIZE + NINE_GAP;        // = 104
const NINE_GRID_TOTAL    = 3 * NINE_CELL_SIZE + 2 * NINE_GAP; // = 288
const NINE_GRID_TOP_Y    = 305;
const NINE_A_GRID_LEFT_X = 32;
const NINE_B_GRID_LEFT_X = CANVAS_WIDTH - NINE_GRID_TOTAL - 32; // 400
```

改成：
```ts
// chore: 2-row formation layout (was 3-row NineGrid 5-of-9)
// Back row 3 spirits + front row 2 spirits (col 1 of front row EMPTY for clash zone clearance)
// Per side scale: back=0.85 / front=1.10 (was 3-tier 0.78/0.94/1.10)
const NINE_CELL_SIZE     = 80;
const NINE_GAP           = 24;
const NINE_STEP          = NINE_CELL_SIZE + NINE_GAP;          // 104
const NINE_GRID_TOTAL    = 3 * NINE_CELL_SIZE + 2 * NINE_GAP;  // 288
const NINE_GRID_TOP_Y    = 305;
// chore: pulled toward outer edges to widen centre clash zone (was 32 / 400, now 16 / 416)
const NINE_A_GRID_LEFT_X = 16;
const NINE_B_GRID_LEFT_X = CANVAS_WIDTH - NINE_GRID_TOTAL - 16;  // 416

// chore: deterministic slot→cell mapping (replaces Fisher-Yates 5-of-9)
// Slots 0-2 = back row L/M/R; Slots 3-4 = front row L/R (col 1 of front row EMPTY)
const SLOT_TO_GRID_POS: { col: number; row: number }[] = [
  { col: 0, row: 0 },   // slot 0: back-left
  { col: 1, row: 0 },   // slot 1: back-mid
  { col: 2, row: 0 },   // slot 2: back-right
  { col: 0, row: 1 },   // slot 3: front-left
  { col: 2, row: 1 },   // slot 4: front-right (front-col-1 EMPTY)
];

// chore: 2-row depth scale (was 3-row 0.78/0.94/1.10)
const ROW_SCALE_BACK  = 0.85;
const ROW_SCALE_FRONT = 1.10;
```

`slotToArenaPos`（line ~1023）改成：
```ts
private slotToArenaPos(side: 'A' | 'B', slot: number): { x: number; y: number; row: number; scale: number } {
  // chore: deterministic slot→position (no more Fisher-Yates)
  const pos = SLOT_TO_GRID_POS[slot] ?? SLOT_TO_GRID_POS[0];
  const { col, row } = pos;
  const mirroredCol = side === 'B' ? (2 - col) : col;

  const gridLeftX = side === 'A' ? NINE_A_GRID_LEFT_X : NINE_B_GRID_LEFT_X;
  const cellX     = gridLeftX + mirroredCol * NINE_STEP + NINE_CELL_SIZE / 2;
  const cellY     = NINE_GRID_TOP_Y + row * NINE_STEP + NINE_CELL_SIZE / 2;

  // 2-row scale: back=0.85 / front=1.10
  const scale = row === 0 ? ROW_SCALE_BACK : ROW_SCALE_FRONT;

  return { x: cellX, y: cellY, row, scale };
}
```

> **Critical**：slotToArenaPos 簽名不變（仍回傳 `{x, y, row, scale}`）— 所有 caller（drawFormation / refreshFormation / drawSpiritShadows / floor calc）自動跟 const 走。
> **chore #161/#165 兼容性**：activeUnits[slot] 給入 slot 0..4，slotToArenaPos 接收 0..4，map to SLOT_TO_GRID_POS[0..4]。**100% 兼容**。

**Commit 1**: `feat(chore): formation 2-row layout — SLOT_TO_GRID_POS deterministic mapping (back-3 + front-2 col-1-empty), grid edges pulled +16 to widen clash zone`

---

### 3b. Commit 2 — Remove Fisher-Yates computeGridPlacement

當前 `BattleScreen.onMount`（既 line 294-298）：
```ts
this.gridPlacementA = this.computeGridPlacement(`${seedBase}-A`);
this.gridPlacementB = this.computeGridPlacement(`${seedBase}-B`);
if (import.meta.env.DEV) {
  console.log(`[NineGrid] A placement: [${this.gridPlacementA.join(',')}]`);
  console.log(`[NineGrid] B placement: [${this.gridPlacementB.join(',')}]`);
}
```

改成：
```ts
// chore: deterministic slot mapping replaces Fisher-Yates (formation 2-row layout)
// gridPlacement field still set for backward-compat with any logging/debug
this.gridPlacementA = [0, 1, 2, 3, 4];
this.gridPlacementB = [0, 1, 2, 3, 4];
```

`computeGridPlacement` 函式可保留（dead code，後續 cleanup）OR 移除。**推薦移除** — clean code。Grep 確認沒其他 caller 才移。

```bash
grep "computeGridPlacement" src/
```
若只在 onMount + 函式定義內部，可安全 delete 函式 + import 'fnv1a'/xorshift32（若是 import）。

**Commit 2**: `tune(chore): remove Fisher-Yates computeGridPlacement — slot mapping now deterministic via SLOT_TO_GRID_POS`

---

### 3c. Commit 3 — Floor + drawBackground 跟新 row Y

當前 `drawBackground`（line ~377）：
```ts
const floorTop = NINE_GRID_TOP_Y + 2 * NINE_STEP;  // ≈473: below mid-row cell bottom
```

當前是 row 2 (front, 3-row layout) 底部 = NINE_GRID_TOP_Y + 2*NINE_STEP = 305+208 = 513。**Wait，本來邏輯就有錯**：comment 說 "below mid-row" 但 2*NINE_STEP 是 row 2 起點，不是 row 1 (mid) 底部。先看 chore #150 怎麼設...

Actually executor 自己 grep 一下確認 floor 應該對齊 front row（**新 layout 的 row 1 front 底部**）：
- New front row Y center = NINE_GRID_TOP_Y + 1 * NINE_STEP + NINE_CELL_SIZE/2 = 305 + 104 + 40 = 449
- New front row bottom = 449 + 40 = 489
- New floorTop = 489（or +5 padding）

改成：
```ts
// chore: floor below new front row bottom (was 3-row layout, now 2-row)
const floorTop = NINE_GRID_TOP_Y + NINE_STEP + NINE_CELL_SIZE;  // 305+104+80 = 489
```

`drawSpiritShadows` (line 564-579) **無需動** — 自動 follow slotToArenaPos 新座標。

**Verify**：
- Back row spirit shadow at y = 345 + 40 + 2 = 387
- Front row spirit shadow at y = 449 + 40 + 2 = 491

兩 row shadow 仍在 floor (y=489 起點) 之上 / 之下，視覺合理。若視覺有 issue，executor 微調 floorTop 或 shadow offset。

**Commit 3**: `tune(chore): floor + spirit shadow follow new 2-row formation Y coords (floorTop 305+NINE_STEP+CELL=489)`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（const + slotToArenaPos + onMount placement + floorTop + 移除 computeGridPlacement function）

**禁止**：
- 動 `src/systems/Formation.ts` (createFormation 仍 9-elem sparse)
- 動 SlotEngine / DamageDistributor / SymbolsConfig
- 動 chore #161/#165 activeUnits filter pattern
- 動 chore #163 UNIT_HP_BAR_Y_OFF
- 動 chore #170-174 SlotReel
- 動 chore #177-179 attack avatar
- 改 SPEC.md / DesignTokens / sim-rtp.mjs / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Pre-merge audit（owner 試玩前 self-check）**：
   - `grep "gridPlacementA\|gridPlacementB" src/` — 確認新 [0,1,2,3,4] 不會撞其他 caller
   - `grep "row.*=.*2" src/screens/BattleScreen.ts` — 確認沒有 hardcoded row=2 的邏輯（front 從 row 2 變 row 1）
   - 試玩 5 spin 確認雙側 spirit 顯示在新 layout（back-3 / front-2 中間空）
5. **Preview 驗證 critical**：
   - 雙側都 5 spirit visible（back row 3 + front row 2）
   - **front-row 中間 col 1 空著**（A 跟 B 各自的中間 col 1 都看不到 spirit）
   - clash zone（中央區）跑 attack 動畫**不再撞 front row**（chore #178/179 attack avatar 在中央可見不被擋）
   - HP bar 在 spirit 腳底（chore #163 不變）
   - chore #161 fix 仍 work：5 spirit 全可見（無消失）
   - chore #165 fix 仍 work：spin 連 10 次 console 無 TypeError
   - DevTools FPS：無回退
   - 8 signature attack fx 仍正常（chore #177-179）
   - SlotReel 連連看 trace + ring + arrow 仍正常（chore #171/172）
5. 截圖 1-2 張：formation 新 layout（看得出 2 row + 中間空）+ attack clash 中央無遮擋

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖（formation + clash 中央 attack）
- ROW_SCALE_BACK 0.85 / FRONT 1.10 視覺差異是否合適（or 0.78/1.10 更顯 depth？）
- floor 視覺位置是否對（floor 是否從 spirit 腳底正確開始）
- 雙側 attack clash 在新 152px gap 內是否完全不撞 formation
- 5 spirit 排列順序視覺感受（s0..s2 back 左中右 / s3..s4 front 左右）
- Spec deviations：預期 0
- **Audit lessons applied**：
  - 沒用 Sprite.width/height + scale.set 衝突 pattern（無新 Sprite 動畫）
  - hitArea 無新增 button 因此無需處理
  - chore #161/165 activeUnits 兼容（slot 0..4 仍對 SLOT_TO_GRID_POS）
  - 未動 setCellSymbol（無 SlotReel 改動）
