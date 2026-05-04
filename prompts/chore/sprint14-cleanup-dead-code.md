# Chore — Sprint 14 cleanup（dead code + stale JSDoc + 廢棄 const）

## 1. Context

Sprint 14 closure 列出 3 個 deferred cleanup item — 一併 dispatch 處理：

1. **Dead code**：`gridPlacementA/B = [0,1,2,3,4]` 在 onMount 仍 set 但 chore #181 後 slotToArenaPos 已不讀
2. **Stale JSDoc / comments**：BattleScreen 4 處仍提 row 0|1|2 / 0.78+0.32（chore #181 後 5-slot zigzag 已不對應）
3. **廢棄 const**：NINE_GRID_TOTAL（chore #181 後僅 NINE_CELL_SIZE/GAP/STEP 仍給 HP bar 用）

純 cleanup — 不動任何 runtime 行為。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit (cleanup tightly bundled)
- **`source-driven-development`** — grep 確認 reference 後才刪

---

## 2. Spec drift check (P6)

1. 確認 chore #181 SLOT_TO_POS_SPEC 仍是當前 layout source of truth
2. 確認 chore #163 UNIT_HP_BAR_Y_OFF 仍 reference NINE_CELL_SIZE
3. 確認 drawSpiritShadows 仍 reference NINE_CELL_SIZE (line 574 shadow Y offset)

---

## 3. Task

### Single commit — Cleanup all 3 items

#### 3a. 移除 gridPlacementA/B field + onMount 賦值

`src/screens/BattleScreen.ts`：

當前 line ~123-124（field declaration）+ line ~316-317（onMount assignment）：
```ts
private gridPlacementA: number[] = [];
private gridPlacementB: number[] = [];
// ...
this.gridPlacementA = [0, 1, 2, 3, 4];
this.gridPlacementB = [0, 1, 2, 3, 4];
```

Pre-cleanup audit — grep 確認沒其他 reader：
```bash
grep "gridPlacementA\|gridPlacementB" src/
```

若**除了 declaration + onMount 外無其他 reference** → 安全刪除 field + onMount 兩行。
若有其他 reader（如 debug log / refresh 流程）→ 保留 field，至少 onMount 行可改 inline comment 標 deprecated。

#### 3b. 移除 NINE_GRID_TOTAL 等廢棄 const

當前 line ~92（const declaration）：
```ts
const NINE_GRID_TOTAL = 3 * NINE_CELL_SIZE + 2 * NINE_GAP;  // = 288 px grid total width
```

Pre-cleanup audit：
```bash
grep "NINE_GRID_TOTAL\|NINE_GRID_TOP_Y\|NINE_A_GRID_LEFT_X\|NINE_B_GRID_LEFT_X" src/
```

預期 chore #181 後這些 const 應該 0 reference（已被 ROW_Y_BASE / COL_X_OUTER/INNER 取代）。若 grep 有 hit → 保留；若無 hit → 安全刪除。

`NINE_CELL_SIZE` / `NINE_GAP` / `NINE_STEP` **保留**（chore #163 HP bar offset / drawSpiritShadows shadow Y 仍用）。

#### 3c. 更新 stale JSDoc / comments

#### Top comment（line ~85-87）
```ts
// ─── NineGrid 3×3 formation layout (p11-vA-02) ──────────────────────────────
// 9 cells per side; 5 spirits placed via seeded Fisher-Yates at mount time.
// Depth scale: row 0 (back) = 0.78 × SPIRIT_H, row 1 (mid) = 0.94 ×, row 2 (front) = 1.10 ×
```

改成：
```ts
// ─── Formation layout (chore #181: 5-slot zigzag) ───────────────────────────
// Each side: 3 spirits in outer col (rows 0/2/4) + 2 spirits in inner col (rows 1/3)
// Scale gradient by row 0..4: 0.85 / 0.91 / 0.97 / 1.04 / 1.10 (back→front)
// Centre clash zone (between A inner and B inner edges): 320px clear
```

#### drawSpiritShadows JSDoc（line ~575）
```ts
/* One ellipse per occupied cell — size and alpha scale with depth (row 0=small/faint, row 2=large/dark). */
```
改成：
```ts
/* One ellipse per spirit — size + alpha scale with depth (row 0 small/faint → row 4 large/dark). */
```

#### drawFormation JSDoc（line ~915）
```ts
* Sprites are addChild'd sorted back→front (row 0 first, row 2 last) for correct z-order
```
改成：
```ts
* Sprites are addChild'd sorted back→front (row 0 first, row 4 last) for correct z-order
```

#### slotToArenaPos JSDoc（line ~1011-1014）— 已 chore #181 更新但檢查一次
應為 chore #181 留下的更新版：
```ts
* Layout: 5-slot zigzag — outer/inner col alternating across 5 rows.
* Slot 0/2/4 = outer col (rows 0/2/4); Slot 1/3 = inner col (rows 1/3).
* Scale gradient: row 0 (top, back) = 0.85 → row 4 (bottom, front) = 1.10.
```
若仍有殘留 row 0|1|2 / 0.78+0.32 → 修正。

**Commit**: `chore: cleanup Sprint 14 dead code + stale JSDoc — gridPlacement removal, NINE_GRID_* deprecated const audit, JSDoc 5-row update`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（field + onMount + const + 3-4 處 JSDoc/comment）

**禁止**：
- 動 runtime 邏輯（slotToArenaPos / drawFormation / refreshFormation / playAttackAnimations 等）
- 動 chore #181 SLOT_TO_POS_SPEC / ROW_SCALE_* / COL_X_*
- 動 chore #163 UNIT_HP_BAR_Y_OFF
- 動 NINE_CELL_SIZE / NINE_GAP / NINE_STEP（仍被使用）
- 動 SlotEngine / SymbolsConfig / DamageDistributor
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Pre-merge audit (executor 自查)**：
   - `grep "gridPlacementA\|gridPlacementB" src/` — 應 0 hits（or 只剩 deprecation comment）
   - `grep "NINE_GRID_TOTAL\|NINE_GRID_TOP_Y\|NINE_A_GRID_LEFT_X\|NINE_B_GRID_LEFT_X" src/` — 應 0 hits
   - `grep "0\.78\|0\.94\|row 0|1|2" src/screens/BattleScreen.ts` — 應 0 hits（or 只在 chore note 說明歷史）
5. **Preview 驗證**：
   - 整局跑通（無 runtime 行為差異）
   - 5-slot zigzag formation + clash + attack 全部仍正常
   - 試玩 5 spin + 1 局結束流暢

## 5. Handoff

- PR URL
- 1 行摘要
- pre-cleanup grep 結果（每個 grep command output 摘要）
- 確認 NINE_CELL_SIZE 仍有合理 reference（HP bar + drawSpiritShadows）
- Spec deviations：預期 0
