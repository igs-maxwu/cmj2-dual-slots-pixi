# Sprint 5 · k-01 — Curse symbol（咒符 id:9 weight 3，不 score / 不 substitute）

## 1. Context

PR: **新增 Curse symbol — pool 出現但不 score way、不當 wild 代替；本 PR 只做 symbol 註冊 + 視覺**

Why: SPEC §15.6 M6 Curse — PvP differentiator。Curse cell 落在「自己」grid 時對手累 stack（k-02 處理），3-stack 觸發 500 HP flat dmg（k-03）。本 PR k-01 **只處理 symbol 本身**：

- pool 加入 weight 3，出現機率 ~3.4%
- SlotEngine `_evalSide()` outer loop **skip** curse（不 score 自己 way）
- inner loop **不當 wild** 處理（不幫其他 symbol 配對）→ 自然成為 blocker（佔格、可斷 matchCount）
- DraftScreen 過濾不顯示
- LoadingScreen.preloadSpirits 過濾不載 curse.webp（不存在）
- 視覺：紫色 pentagon + 黑暗 tint（MVP，類似 Wild 借用 gem-pentagon + 金 tint pattern）

Source:
- SPEC §15.6 + ROADMAP table
- m-05 Wild prompt（pattern 完全一樣，本 PR 是 Curse 版本）
- `src/config/SymbolsConfig.ts` `SYMBOLS` array（已含 id:8 Wild）
- `src/systems/SlotEngine.ts` `_evalSide()` line 118-148

Base: master HEAD（r-02 merged）
Target: `feat/sprint5-k-01-curse-symbol`

## 2. Spec drift check (P6)

1. `mempalace_search "Curse symbol M6 SPEC §15.6 stack 500 HP"`
2. 確認 SYMBOLS 當前最後 id 是 8 (Wild)
3. `grep -n "isCurse\|Curse" src/` 確認尚未實作

## 3. Task

### 3a. SymbolsConfig.ts 擴充

`SymbolDef` interface 加 isCurse:

```ts
export interface SymbolDef {
  id:          number;
  name:        string;
  shape:       'triangle'|'hexagon'|'square'|'cross'|'circle'|'heart'|'diamond'|'star'|'wild'|'curse';
  color:       number;
  weight:      number;
  spiritKey:   string;
  spiritName:  string;
  clan:        Clan;
  isWild?:     boolean;
  isCurse?:    boolean;    // Curse — does not score, does not substitute, blocks matches
}
```

`SYMBOLS` array 末尾加（id:9，clan 任選 black/black 不重要，純占位）：

```ts
{ id:9, name:'Curse',  shape:'curse',    color:0x8b3aaa, weight:3,
  spiritKey:'curse',         spiritName:'咒符',     clan:'black',  isCurse:true },
```

### 3b. SlotEngine.ts `_evalSide()` skip Curse

line 118 附近：

```ts
for (let symId = 0; symId < SYMBOLS.length; symId++) {
  if (SYMBOLS[symId].isWild) continue;
  if (SYMBOLS[symId].isCurse) continue;   // ← 新增：Curse 不 score 自己
  // ... rest unchanged
```

inner cell-scan loop **不需動** — Curse cells 在 inner loop 不滿足 `cellId === symId` 也不是 wild，直接 skip → 自然成為 blocker。

### 3c. GemMapping.ts 加 id:9

```ts
9: { assetKey: 'gem-pentagon', tint: 0x8b3aaa },   // dark purple — Curse skull placeholder
```

### 3d. DraftScreen.ts 過濾 isCurse

找已有的 `filter(s => !s.isWild)` 那兩處（spiritsByClan + pickRandomFive），改為：

```ts
.filter(s => !s.isWild && !s.isCurse)
```

### 3e. LoadingScreen.ts 過濾

`preloadSpirits()` line 169 `.filter(s => !s.isWild)` 改為：

```ts
.filter(s => !s.isWild && !s.isCurse)
```

### 3f. sim-rtp.mjs 加 Curse cell counting

不需動 SymbolsConfig（共享 src/）。在 sim loop 內每 spin 結束後統計 curse cells：

```ts
// After spin result obtained (loop after engine.spin):
const CURSE_ID = SYMBOLS.findIndex(s => s.isCurse);
let curseCellsA = 0, curseCellsB = 0;
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 5; c++) {
    if (spin.grid[r][c] === CURSE_ID) {
      // Cell on left half (cols 0-2) = A's side; right half (cols 2-4) = B's side
      // Per SPEC: curse on YOUR grid charges OPPONENT's stack.
      // Since the reel is shared, define A-side cells as cols 0-1 (left), B-side as cols 3-4 (right).
      // Center column 2 = neutral / split. (Confirm with owner if needed.)
      if (c < 2) curseCellsA++;
      else if (c > 2) curseCellsB++;
    }
  }
}
totalCurseCellsA += curseCellsA;  // for stats only — k-02 implements stacking
totalCurseCellsB += curseCellsB;
```

加 output：

```ts
curse: {
  total_cells_on_A_side: totalCurseCellsA,
  total_cells_on_B_side: totalCurseCellsB,
  avg_cells_per_round: (totalCurseCellsA + totalCurseCellsB) / (ROUNDS * 2),
}
```

### 3g. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（+1 interface field + 1 SYMBOLS entry + shape union）
- `src/systems/SlotEngine.ts`（+1 line skip in outer loop）
- `src/config/GemMapping.ts`（+1 entry id:9）
- `src/screens/DraftScreen.ts`（filter 加 isCurse 條件）
- `src/screens/LoadingScreen.ts`（同 filter）
- `scripts/sim-rtp.mjs`（curse cell counting + output）

**禁止**：
- `Resonance.ts` / Formation.ts / DamageDistributor.ts
- BattleScreen.ts（k-02 才碰 — stack tracking 在那）
- 新 asset
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON + 3 numbers：
   - coin_rtp（應變化很小，因 Curse 不 score）
   - hitFreq.miss（**可能變高** — Curse 佔格不參與配對）
   - curse.avg_cells_per_round（期望 ~3/15 cells × 2 sides = ~0.4 per side per round）

## 5. Handoff

- PR URL
- 1 行摘要
- 3 numbers + 判斷
- 是否確認 Curse cell 不影響 wild 配對（grep wild substitution code 確認）
- 是否 DraftScreen + LoadingScreen 都過濾 isCurse（兩處別忘了）
- 視覺：preview 啟動後 reel 會出現紫色 pentagon（curse 的視覺），確認可看到
