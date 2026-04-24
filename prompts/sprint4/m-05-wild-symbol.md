# Sprint 4 · m-05 — 加入 Wild symbol（神獸化身 id:8，weight 3，任意代替 + way ×2）

## 1. Context

PR: **SPEC §15 M1 Wild symbol 上線**

Why: 目前 hit miss = 57.9%，遠高於 SPEC 40% 目標。根因是 8 symbols × 77 pool weight 下，單 symbol 連 3 col 機率低。Wild 加入 pool 後：
- 自身**不 score way**，但在任何 symbol 的 wayHit 檢查中**當任意匹配**
- 若 wayHit 命中的 cells 裡**至少 1 格是 Wild**，該 wayHit rawCoin/rawDmg **×2**
- 降低 miss 率（因 Wild 幫其他 symbol 湊配對），提升 4+ matchCount 機率
- 貢獻 ~10% 額外 RTP（SPEC §15.3）

Source:
- SPEC §15 locked spec：Wild weight 3, substitute + ×2 mult
- `src/config/SymbolsConfig.ts` `SYMBOLS` array（目前 8 個 id 0-7）
- `src/systems/SlotEngine.ts` line 118-147 `_evalSide()` wayHit loop（主要改點）
- `src/config/GemMapping.ts` 新 id:8 對應
- `scripts/sim-rtp.mjs` 量新 Wild 貢獻
- `src/systems/SymbolPool.ts` `buildFullPool()` 自動跟進（從 SYMBOLS array 建 pool）

Base: master HEAD（m-04 merged）
Target: `feat/sprint4-m-05-wild-symbol`

## 2. Spec drift check (P6)

1. `mempalace_search "Wild symbol M1 spec §15 substitute ×2"`
2. 確認 `src/config/SymbolsConfig.ts` 當前 SYMBOLS 有 8 entries (id 0-7)
3. 確認 `GemMapping.ts` 只有 id 0-7 mapping
4. `grep -rn "SYMBOLS.length" src/` — 若有地方 hardcode 8，需一起改
5. 若發現某處已有 `isWild` 或 wild 相關程式碼，STOP 回報

## 3. Task

### 3a. `src/config/SymbolsConfig.ts` — 擴充 SymbolDef + 加 Wild entry

```ts
// SymbolDef interface — add optional isWild flag
export interface SymbolDef {
  id:          number;
  name:        string;
  shape:       'triangle'|'hexagon'|'square'|'cross'|'circle'|'heart'|'diamond'|'star'|'wild';
  color:       number;
  weight:      number;
  spiritKey:   string;
  spiritName:  string;
  clan:        Clan;
  isWild?:     boolean;    // Wild substitutes for any spirit; does not score its own ways
}

// Add to SYMBOLS array (after id:7 xuanmo):
  { id:8, name:'Wild',   shape:'wild',     color:0xffd700, weight:3,
    spiritKey:'wild',         spiritName:'神獸化身', clan:'azure',  isWild:true },
```

Wild 的 `clan: 'azure'` 是 placeholder（任意選一個）— 它自己不 score way，clan 不會實際影響 passive。`spiritKey: 'wild'` 對應之後加的 wild asset，本 PR 先不創新圖（GemMapping 會 reuse gem-pentagon + gold tint）。

### 3b. `src/systems/SlotEngine.ts` — `_evalSide()` 加 Wild 邏輯

line 118-147 改為：

```ts
for (let symId = 0; symId < SYMBOLS.length; symId++) {
  // Wild is a substitute only — does not score its own way
  if (SYMBOLS[symId].isWild) continue;

  let matchCount = 0;
  let numWays    = 1;
  const hitCells: number[][] = [];
  let wildUsed   = false;

  for (let offset = 0; offset < COLS; offset++) {
    const actualCol = anchorCol + offset * dir;
    const rowsWithSym: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      const cellId = grid[r][actualCol];
      if (cellId === symId) {
        rowsWithSym.push(r);
      } else if (SYMBOLS[cellId]?.isWild) {
        rowsWithSym.push(r);
        wildUsed = true;
      }
    }
    if (rowsWithSym.length === 0) break;
    matchCount++;
    numWays *= rowsWithSym.length;
    hitCells.push(rowsWithSym);
  }

  if (matchCount < 3) continue;

  const base            = PAYOUT_BASE[matchCount] ?? 0;
  const mult            = SlotEngine.scaledMult(symId, poolTotalW, coinScale, dmgScale, fairnessExp);
  const isMercenary     = !isDrafted.has(symId);
  const mercenaryMult   = isMercenary ? 0.30 : 1.0;
  const wildMult        = wildUsed ? 2.0 : 1.0;        // SPEC §15 M1 — way with wild ×2
  const rawCoin         = base * numWays * mult.coinMult * mercenaryMult * wildMult;
  const rawDmg          = base * numWays * mult.dmgMult  * mercenaryMult * wildMult;

  wayHits.push({ symbolId: symId, matchCount, numWays, hitCells, rawCoin, rawDmg, isMercenary });
  totalCoin += rawCoin;
  totalDmg  += rawDmg;
}
```

同時在 `WayHit` interface（line 19 附近）加選填欄位：

```ts
interface WayHit {
  symbolId:    number;
  matchCount:  number;
  numWays:     number;
  hitCells:    number[][];
  rawCoin:     number;
  rawDmg:      number;
  isMercenary: boolean;
  wildUsed?:   boolean;   // true if any hit cell was a wild substitute
}
```

push 時加 `wildUsed,`。

### 3c. `src/config/GemMapping.ts` — 加 id:8 Wild 對應

```ts
// ...existing mapping...
// Wild uses gem-pentagon with GOLD tint for visual distinction (MVP — later PR can add animated sprite)
8: { assetKey: 'gem-pentagon', tint: 0xffd700 },
```

（GOLD.base = 0xf5b82a，GOLD.glow = 0xffc94d；0xffd700 比 gold 更亮突顯 Wild）

### 3d. `src/screens/DraftScreen.ts` — 排除 Wild 不可選

DraftScreen 現在顯示 `SYMBOLS` 全部 8 個 tile 讓玩家挑 5 隻 drafted spirit。Wild 是機率符號**不該讓玩家選**。找 DraftScreen 裡 iterate SYMBOLS 的地方（`spiritsByClan()` 或 tile 建立），過濾掉 `isWild`：

```ts
const ELIGIBLE = SYMBOLS.filter(s => !s.isWild);
// use ELIGIBLE instead of SYMBOLS for tile grid + clan grouping
```

或在 `spiritsByClan()` helper 忽略 wild symbols。Wild 仍會出現在 reel（pool 有它）但**不在 draft 界面上**。

### 3e. `scripts/sim-rtp.mjs` — sim 支援 Wild

現有 sim loop 不需大改（SlotEngine.spin 會自動處理 Wild）。建議**加一個統計**：

```ts
let wildBoostedWayHits = 0;
// in spin result processing:
for (const wh of spin.sideA.wayHits) {
  if (wh.wildUsed) wildBoostedWayHits++;
}
// (same for B)
```

在 output JSON `passives` 區塊旁邊新 `wild` 區塊：

```ts
wild: {
  boosted_way_hits: wildBoostedWayHits,
  boosted_pct_of_all_hits: wildBoostedWayHits / totalWayHits,
}
```

### 3f. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（+1 interface field + 1 SYMBOLS entry + shape type union）
- `src/systems/SlotEngine.ts`（~10 行 wild logic in _evalSide + WayHit interface）
- `src/config/GemMapping.ts`（+1 entry for id:8）
- `src/screens/DraftScreen.ts`（filter isWild 從 tile / spiritsByClan）
- `scripts/sim-rtp.mjs`（+wild metric）

**禁止**：
- `src/systems/Formation.ts` / `DamageDistributor.ts`
- 其他 clan passive（tiger/tortoise/dragon/phoenix 邏輯不動）
- SPEC.md
- 新 asset 匯入（Wild 視覺 MVP 用既有 gem-pentagon + gold tint）
- `DEFAULT_TARGET_*` 常數

### 3g. 執行 sim 驗證

```bash
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 1234 --runs 50 --config symmetric
```

貼 JSON + 3 key numbers：
- coin_rtp（期望 85-105% — Wild 加 ~10% 在 m-04 的 83.8 上）
- hitFreq.miss（期望 50% ↓ — Wild 幫其他 symbol 匹配降低 miss）
- hitFreq.ways_4_10（期望 **非 0** — 這是 Wild 主要目標）

## 4. DoD

1. `npm run build` 過
2. No console.log / debugger in src/
3. commit + push
4. PR URL + sim JSON + 3 key numbers

特別提醒：
- Wild 自身**不 score way** — for loop 第一行 `if (isWild) continue`
- `WayHit.wildUsed` 是選填，現有 Phoenix/Dragon 讀者不會受影響
- DraftScreen 要過濾 Wild，否則玩家會看到 9 個 tile（壞版面）
- 編輯 SlotEngine ≥ 3 次不過 build → STOP 回報
- sim 跑出來若 hitFreq.miss 沒降反升，STOP 回報（邏輯錯）

## 5. Handoff

- PR URL
- 1 行摘要
- 3 key numbers + 判斷是否達標
- Spec deviations：預期 0
- Wild 視覺是否看得出來（preview 截圖）
- 是否有碰到 Shape union 或 SymbolPool.buildFullPool 相容性問題
