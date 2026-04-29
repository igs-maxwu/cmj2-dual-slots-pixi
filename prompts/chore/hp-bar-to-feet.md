# Chore — HP bar 從頭頂上方移到腳底下方

## 1. Context

Owner 試玩 chore #161 NineGrid 5v5 全可見後反映：spirit HP 血條當前畫在**頭頂上方**（cell top 上方 10px），視覺上跟「綠色橫條」混在天空 — 看不直覺。希望改成**腳底下方**（bottom anchor 下 10px），讓血條看起來像腳下「踏板能量條」。

純視覺位置調整 — 1 個 const 修改 + drawFormation refreshFormation 內 2 處 y reference 同步。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 確認 spirit sprite anchor (0.5, 1) feet at container y=0

---

## 2. Spec drift check (P6)

1. `mempalace_search "UNIT_HP_BAR_Y_OFF spirit anchor feet container"`
2. 確認 既 chore #161 spirit sprite `anchor.set(0.5, 1)` (feet at container y=0)
3. 確認 既 const `UNIT_HP_BAR_Y_OFF = -(NINE_CELL_SIZE / 2) - 10`（line 98）

---

## 3. Task

### Single commit

`src/screens/BattleScreen.ts` line 98：

當前：
```ts
// HP bar y offset: above cell top edge (cell center is anchor, cell top is -NINE_CELL_SIZE/2)
const UNIT_HP_BAR_Y_OFF = -(NINE_CELL_SIZE / 2) - 10;       // above cell top by 10px
```

改成：
```ts
// HP bar y offset: below feet (spirit anchor 0.5,1 puts feet at container y=0)
// chore: relocate from above-head to below-feet for "踏板能量條" visual feel
const UNIT_HP_BAR_Y_OFF = 10;                                // below feet by 10px
```

### Verify

- L984 `hpTrack.roundRect(-scaledBarW / 2, UNIT_HP_BAR_Y_OFF, ...)` 自動跟 const → 不用改
- L1714 `hpFill.roundRect(-UNIT_HP_BAR_W / 2, UNIT_HP_BAR_Y_OFF, ...)` 自動跟 const → 不用改

注意：spirit container 的 y 已是 cell center（cellY = NINE_GRID_TOP_Y + row * NINE_STEP + NINE_CELL_SIZE / 2），sprite 是 `anchor.set(0.5, 1)`. 但**spirit container 內部 y=0 就是 feet 位置嗎？**

需確認 — 找 drawFormation 內 sprite addChild 邏輯（既有 chore #150 spirit shadow PR 在的地方）。如果 sprite 不在 container y=0 而是 cell top（即 sprite.y = -NINE_CELL_SIZE/2 + cellHeight），則 feet 位置 = sprite.y + spriteHeight × 1.0。在這種情況下，HP bar 應該擺在 sprite.y + spriteHeight + 10。

**Executor 必須先 grep + 讀 drawFormation 內 sprite 的 .x .y anchor 設定**，再決定真實 feet y。若 sprite.y 已 = NINE_CELL_SIZE/2（feet 在 cell bottom），則 `UNIT_HP_BAR_Y_OFF = NINE_CELL_SIZE / 2 + 10` 才對。

**禁止盲改 const 值再 push**。先讀代碼確認 spirit sprite y 是 0 還是 NINE_CELL_SIZE/2，再算正確 offset。

### 截圖驗證

進 Battle 後 spirit 腳下應該看到綠色 HP 血條，**不再在頭上**。

**Commit**: `tune(chore): HP bar relocate above-head → below-feet for踏板能量條 feel`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（const UNIT_HP_BAR_Y_OFF 一個值；drawFormation 內若 sprite y 不是 0 則需配合調 const 算式）

**禁止**：
- 動 spirit sprite anchor（0.5, 1 不變）
- 動 NineGrid layout 或 cell size
- 動 HP bar width / height / color
- 加新 const
- 改其他 file

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. 截圖：A 側 + B 側 spirit 腳下都看到綠色 HP 血條（不再頭頂）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 確認 spirit sprite container y=0 是 feet 還是 cell-center（影響真實 offset 值）
- Spec deviations：預期 0
