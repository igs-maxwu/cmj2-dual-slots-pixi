# Sprint 6 · f-01 — Scatter symbol（靈脈晶 id:10，weight 2，不 score way 但統計觸發 Free Spin）

## 1. Context

PR: **加 Scatter symbol id:10，pool 中會出現但不 score way；本 PR 只做 symbol 註冊 + sim 統計。Free Spin 模式邏輯留 f-02。**

Why: SPEC §15.7 Free Spin (M10) 觸發條件「3+ scatters same spin」需要先有 Scatter symbol 存在於 pool。f-01 跟 m-05 Wild / k-01 Curse 同 pattern：加 SymbolsConfig entry + SlotEngine skip + GemMapping + DraftScreen/LoadingScreen filter + sim count。

Source:
- SPEC §15.7 M10 Free Spin
- m-05 Wild PR #91 / k-01 Curse PR #110 是同 pattern 範本
- `src/config/SymbolsConfig.ts` 目前 SYMBOLS 含 id 0-7 spirits + id:8 Wild + id:9 Curse

Base: master HEAD（Sprint 5 closed post PR #119）
Target: `feat/sprint6-f-01-scatter-symbol`

## 2. Spec drift check (P6)

1. `mempalace_search "Scatter Free Spin M10 weight 2 isScatter"`
2. `Read prompts/sprint6/ROADMAP.md`
3. 確認 SYMBOLS 目前 length=10（id 0-9），預計加 id:10
4. 確認 m-05 Wild + k-01 Curse 的 isWild / isCurse 判旗在 SymbolDef interface

## 3. Task

### 3a. SymbolsConfig.ts — 加 isScatter + 新 entry

```ts
export interface SymbolDef {
  // ... existing fields ...
  isWild?:    boolean;
  isCurse?:   boolean;
  isScatter?: boolean;    // NEW — Scatter never scores way; 3+ triggers Free Spin
}

// extend shape union
shape: 'triangle'|'hexagon'|'square'|'cross'|'circle'|'heart'|'diamond'|'star'|'wild'|'curse'|'scatter';

// SYMBOLS array — append after Curse (id:9):
{ id:10, name:'Scatter', shape:'scatter', color:0xff3b6b, weight:2,
  spiritKey:'scatter', spiritName:'靈脈晶', clan:'azure', isScatter:true },
```

`clan:'azure'` 是 placeholder（Scatter 不在 clan 系統內），`spiritKey:'scatter'` 不會載入（filter 會擋）。

### 3b. SlotEngine.ts — outer loop 跳過 Scatter

`_evalSide()` 既有 Wild/Curse skip pattern：

```ts
for (let symId = 0; symId < SYMBOLS.length; symId++) {
  if (SYMBOLS[symId].isWild)    continue;
  if (SYMBOLS[symId].isCurse)   continue;
  if (SYMBOLS[symId].isScatter) continue;   // NEW
  // ... existing scoring logic ...
}
```

**注意**：Scatter cells 也**不應該**像 Wild 那樣被當成 substitute。在 inner loop 的 `cellId === wildId` 檢查那邊**不要**包含 isScatter（保留現狀，否則 Scatter 會誤幫 score）。

### 3c. GemMapping.ts — 加 id:10 對應

```ts
// MVP visual: gem-pentagon 配粉紅亮色 (SPEC: 'glowing jade orb with pulsing aura')
10: { assetKey: 'gem-pentagon', tint: 0xff3b6b },
```

未來 Sprint 6 後期可換 Symbol_09 SCATTER asset（SOS2 import 已含金甲蟲 SCATTER 圖），本 PR MVP 用 tint 區分即可。

### 3d. DraftScreen + LoadingScreen filter

兩處既有 `filter(s => !s.isWild && !s.isCurse)` 擴充為：

```ts
.filter(s => !s.isWild && !s.isCurse && !s.isScatter)
```

DraftScreen 不顯示、LoadingScreen 不嘗試載 `scatter.webp`。

### 3e. sim-rtp.mjs — Scatter cell counting

加新統計：

```ts
let totalScatterCells = 0;
let scatterTriggerCount = 0;     // spins with ≥3 scatters

const SCATTER_ID = SYMBOLS.findIndex(s => s.isScatter);

// Inside per-spin loop:
let scatterThisSpin = 0;
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 5; c++) {
    if (spin.grid[r][c] === SCATTER_ID) scatterThisSpin++;
  }
}
totalScatterCells += scatterThisSpin;
if (scatterThisSpin >= 3) scatterTriggerCount++;
```

新 output 區塊：

```ts
scatter: {
  total_cells: totalScatterCells,
  avg_per_spin: totalScatterCells / (ROUNDS * 2),    // both sides share same grid actually so /1
  spins_with_3plus: scatterTriggerCount,
  trigger_rate: scatterTriggerCount / ROUNDS,
  per_match_estimate: scatterTriggerCount / totalMatches,    // ← key SPEC target ~0.2
}
```

**注意**：5×3 grid 共享（不是雙 grid），所以一個 spin 的 scatter cells 是固定的。triggerCount 計一次。

### 3f. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（+1 interface field + 1 SYMBOLS entry + shape union）
- `src/systems/SlotEngine.ts`（+1 行 isScatter skip）
- `src/config/GemMapping.ts`（+1 entry id:10）
- `src/screens/DraftScreen.ts`（filter 加 isScatter）
- `src/screens/LoadingScreen.ts`（filter 加 isScatter）
- `scripts/sim-rtp.mjs`（+scatter tracking + output）

**禁止**：
- BattleScreen（f-02 才碰，本 PR 不做 Free Spin 模式）
- Resonance / Curse / Formation
- SPEC.md
- 任何 Free Spin 觸發邏輯（純統計）

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON
4. 4 numbers：
   - scatter.avg_per_spin（期望 ~0.34 — 5×3 cells × weight2/totalW）
   - scatter.spins_with_3plus / ROUNDS（期望 ~0.025-0.05，每 20-40 spin 出一次）
   - scatter.per_match_estimate（期望 0.15-0.30，~1/5 match SPEC 目標）
   - coin_rtp（不該變太多 — Scatter 不 score）

## 5. Handoff

- PR URL
- 1 行摘要
- 4 numbers + 是否落 SPEC 範圍
- 若 trigger rate 偏離 ~0.2/match 過大，flag weight 是否要調整（SPEC 寫 weight=2，可能後期調 3）
- Spec deviations：預期 0
