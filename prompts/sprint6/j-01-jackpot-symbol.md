# Sprint 6 · j-01 — Jackpot symbol（id:11，weight:1，isJackpot:true，pool 中存在但不 score way）

## 1. Context

PR: **加 JP symbol id:11，weight:1，pool 中會出現但不 score way；本 PR 只做 symbol 註冊 + GemMapping + DraftScreen/LoadingScreen filter + sim 統計。JP pool/persistence/trigger draw 邏輯留 j-02/j-03。**

Why: SPEC §15.8 M12 3-tier Progressive Jackpot「JP symbol 5-of-a-kind 觸發（Wild 可代替）」需要先有 JP symbol 存在於 pool。j-01 跟 f-01 Scatter (#121) / m-05 Wild / k-01 Curse 同 pattern：register → skip-score → filter-from-ui → sim-count。

設計選擇（保守路線）：
- **不 score way**：JP 用「skip in SlotEngine outer loop」策略（同 Scatter）。理由：Sprint 6 Track F 剛把 coin_rtp 校到 108.74% 落 SPEC，若 JP 也 score way 會推升 RTP，需另一輪 rebalance。j-03 設計階段再決定是否要讓 JP 同時 score + trigger。
- **Wild 不可代替 JP scoring**：因 JP 不 score way，這個問題不存在。Wild 取代 JP 在 j-03 5-of-a-kind 偵測時才生效（per ROADMAP「Wild assists per existing wild logic」）。
- **weight=1**：weakest weight，配合 SPEC「JP 觸發頻率 sim < 0.01/match」要求（5-of-a-kind 罕見事件）。

Source:
- SPEC §15.8 M12 Progressive Jackpot
- f-01 Scatter PR #121 / k-01 Curse / m-05 Wild 是同 pattern 範本
- `src/config/SymbolsConfig.ts` 目前 SYMBOLS 含 id 0-7 spirits + id:8 Wild + id:9 Curse + id:10 Scatter
- `src/screens/BattleScreen.ts` JP marquee 既有（PR #75 / #76），但目前是 hardcoded NT$ 50k/500k/5M，j-05 才接 live counter

Base: master HEAD（Sprint 6 Track F closed via PR #125 2026-04-27）
Target: `feat/sprint6-j-01-jackpot-symbol`

---

## Skills suggested for this PR

- **`incremental-implementation`** — pattern 跟 f-01 / k-01 / m-05 完全相同（5 個檔同樣的改動點），thin slice 直接套即可。**禁止偏離既有 pattern 加額外功能**（例如不要順手做 j-02 pool 邏輯）。
- **`source-driven-development`** — Pixi.js 8 / Vite import pattern 沿用既有 SymbolsConfig.ts、GemMapping.ts 的 export 形式，不要憑記憶寫新 idiom。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Jackpot M12 5-of-a-kind isJackpot weight 1 JP symbol"`
2. 確認 SYMBOLS 目前 length=11（id 0-10），預計加 id:11 為第 12 個
3. 確認 m-05 Wild + k-01 Curse + f-01 Scatter 的 isWild / isCurse / isScatter 判旗都已在 SymbolDef interface（j-01 加第 4 個 boolean flag isJackpot）

## 3. Task

### 3a. SymbolsConfig.ts — 加 isJackpot + 新 entry

```ts
export interface SymbolDef {
  // ... existing fields ...
  isWild?:    boolean;
  isCurse?:   boolean;
  isScatter?: boolean;
  isJackpot?: boolean;    // NEW — JP never scores way; 5-of-a-kind triggers JP draw (j-03)
}

// extend shape union
shape: 'triangle'|'hexagon'|'square'|'cross'|'circle'|'heart'|'diamond'|'star'|'wild'|'curse'|'scatter'|'jackpot';

// SYMBOLS array — append after Scatter (id:10):
{ id:11, name:'Jackpot', shape:'jackpot', color:0xffd700, weight:1,
  spiritKey:'jackpot', spiritName:'天地人獎', clan:'azure', isJackpot:true },
```

`clan:'azure'` 是 placeholder（JP 不在 clan 系統內），`spiritKey:'jackpot'` 不會載入（filter 會擋），`color:0xffd700` 是純金色。

### 3b. SlotEngine.ts — outer loop 跳過 JP

`_evalSide()` 既有 Wild/Curse/Scatter skip pattern：

```ts
for (let symId = 0; symId < SYMBOLS.length; symId++) {
  if (SYMBOLS[symId].isWild)    continue;
  if (SYMBOLS[symId].isCurse)   continue;
  if (SYMBOLS[symId].isScatter) continue;
  if (SYMBOLS[symId].isJackpot) continue;   // NEW
  // ... existing scoring logic ...
}
```

**注意**：JP cells 也**不應該**像 Wild 那樣被當成 substitute（保留現狀 — inner loop `cellId === wildId` check 不要包含 isJackpot）。Wild → JP substitute 是 j-03 的事，本 PR 不做。

### 3c. GemMapping.ts — 加 id:11 對應

```ts
// MVP visual: gem-pentagon 配純金色（區別於 Scatter 的粉紅 0xff3b6b）
// SPEC: 'majestic golden orb'
11: { assetKey: 'gem-pentagon', tint: 0xffd700 },
```

未來 Sprint 6 後期可換 Symbol_10 JACKPOT asset（SOS2 import 含 JACKPOT 圖），本 PR MVP 用 tint 區分即可。

### 3d. DraftScreen + LoadingScreen filter

兩處既有 `filter(s => !s.isWild && !s.isCurse && !s.isScatter)` 擴充為：

```ts
.filter(s => !s.isWild && !s.isCurse && !s.isScatter && !s.isJackpot)
```

DraftScreen 不顯示 JP、LoadingScreen 不嘗試載 `jackpot.webp`。

### 3e. sim-rtp.mjs — JP cell counting

加新統計（**模仿 f-01 scatter counting block 的形式**）：

```ts
let totalJackpotCells = 0;
let jackpotFiveOfAKindCount = 0;     // spins where all 5 reels contain >=1 JP (preview for j-03)

const JACKPOT_ID = SYMBOLS.findIndex(s => s.isJackpot);

// Inside per-spin loop:
let jackpotThisSpin = 0;
const reelsWithJackpot = new Set<number>();   // which columns have ≥1 JP
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 5; c++) {
    if (spin.grid[r][c] === JACKPOT_ID) {
      jackpotThisSpin++;
      reelsWithJackpot.add(c);
    }
  }
}
totalJackpotCells += jackpotThisSpin;
if (reelsWithJackpot.size === 5) jackpotFiveOfAKindCount++;
```

新 output 區塊：

```ts
jackpot: {
  total_cells: totalJackpotCells,
  avg_per_spin: totalJackpotCells / ROUNDS,
  five_of_a_kind_count: jackpotFiveOfAKindCount,
  five_of_a_kind_rate: jackpotFiveOfAKindCount / ROUNDS,
  per_match_estimate: jackpotFiveOfAKindCount / totalMatches,    // ← key SPEC target < 0.01
}
```

**注意**：本 PR sim 不模擬 JP 觸發效果（不付獎金、不算 jackpot pool），純粹計數 — 5-of-a-kind 機率本身。

### 3f. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（+1 interface field + 1 SYMBOLS entry + shape union）
- `src/systems/SlotEngine.ts`（+1 行 isJackpot skip）
- `src/config/GemMapping.ts`（+1 entry id:11）
- `src/screens/DraftScreen.ts`（filter 加 isJackpot）
- `src/screens/LoadingScreen.ts`（filter 加 isJackpot）
- `scripts/sim-rtp.mjs`（+jackpot tracking + output）

**禁止**：
- BattleScreen.ts（j-02 pool / j-03 trigger / j-04 ceremony / j-05 marquee 才碰）
- Resonance / Curse / Free Spin
- Wild substitute 邏輯（j-03 工作）
- SPEC.md
- 任何 JP pool / accrual / draw 邏輯（純 symbol registration + sim 統計）
- 改 f-track 任何邏輯

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON
4. 4 numbers：
   - `jackpot.avg_per_spin`（期望 ~0.176 — 5×3 cells × 1/85 totalW ≈ 15/85）
   - `jackpot.five_of_a_kind_rate`（期望 < 0.001 — 罕見事件，weight=1 對應）
   - `jackpot.per_match_estimate`（期望 < 0.01，SPEC 目標）
   - `coin_rtp`（**不該變太多** — JP 不 score way；期望與 PR #125 的 108.74% 相差 ≤ 1pp）

## 5. Handoff

- PR URL
- 1 行摘要
- 4 numbers + 是否落 SPEC 範圍
- 若 5-of-a-kind rate 偏離 < 0.01/match 過大（例如 > 0.005），flag weight 是否要再降（SPEC 寫 weight=1，可能後期 j-03 sim 後再調）
- coin_rtp 若 >110% 或 <95%，flag — 表示 JP 加入 pool 意外影響到 base RTP（可能是 SlotEngine skip 沒到位）
- Spec deviations：預期 0
