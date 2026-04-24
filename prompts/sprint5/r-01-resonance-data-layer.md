# Sprint 5 · r-01 — Resonance 資料層（detectResonance + ResonanceTier）

## 1. Context

PR: **新建 `src/systems/Resonance.ts` — 依 drafted 5 隻雀靈算出 Resonance tier（SOLO / DUAL / NONE）**

Why: Sprint 5 M5 Resonance 核心邏輯。之後 r-02 在 BattleScreen 套 ×1.5、r-03/r-04 顯示 HUD、r-05 sim 驗證都會 reuse 本 PR 的函式。本 PR **只做算法**，不接上戰鬥數值。

5 抽 × 每 clan 2 隻，config 只有兩種：

| 分布 | tier 代號 | 效果定義（r-02 用）|
|---|---|---|
| (2,1,1,1) 全 4 clan 覆蓋 + 1 對 | `'SOLO'` | 該對的 clan ID → ×1.5 |
| (2,2,1,0) 2 對 + 1 孤 + 1 缺 | `'DUAL'` | 兩對 clan IDs → 各 ×1.5 |
| other（理論上不該出現，含 Wild）| `'NONE'` | 無加成 |

Source:
- `prompts/sprint5/ROADMAP.md`
- `src/config/SymbolsConfig.ts` `SYMBOLS` array + `ClanId` type
- SPEC §15.5（原 4-pick table，本 PR 是 5-pick 的 adapted 版）

Base: master HEAD（Sprint 4 closed post PR #102）
Target: `feat/sprint5-r-01-resonance-data`

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 5 Resonance data layer SOLO DUAL"`
2. Read `prompts/sprint5/ROADMAP.md` 確認 SPEC 差異校正
3. 確認 `SymbolsConfig.ts` 有 8 個 drafted spirits + 1 Wild（id:8 isWild）
4. 若發現 Wild 被當 clan member（邏輯錯），STOP 回報

## 3. Task

### 3a. 新檔 `src/systems/Resonance.ts`

```ts
import { SYMBOLS } from '@/config/SymbolsConfig';
import type { ClanId } from '@/config/DesignTokens';

export type ResonanceTier = 'SOLO' | 'DUAL' | 'NONE';

export interface ResonanceResult {
  tier:           ResonanceTier;
  boostedClans:   ClanId[];    // clans with ×1.5 active; length: SOLO=1, DUAL=2, NONE=0
  clanCounts:     Record<ClanId, number>;  // for HUD readout
}

/**
 * Analyse a 5-spirit draft and determine Resonance tier.
 *
 *   SOLO  = (2,1,1,1) — all 4 clans covered, 1 pair   → boostedClans = [pairedClan]
 *   DUAL  = (2,2,1,0) — 2 pairs, 1 solo, 1 missing    → boostedClans = [bothPairedClans]
 *   NONE  = other (shouldn't occur with MAX_PICKS=5 + 2-per-clan roster,
 *           but safe fallback for edge cases like Wild in draft)
 *
 * Wild (isWild) symbols are excluded from clan counts — Resonance only
 * measures actual spirit coverage, not substitutes.
 */
export function detectResonance(selected: number[]): ResonanceResult {
  const clanCounts: Record<ClanId, number> = {
    azure: 0, white: 0, vermilion: 0, black: 0,
  };

  for (const id of selected) {
    const sym = SYMBOLS[id];
    if (!sym || sym.isWild) continue;
    clanCounts[sym.clan as ClanId]++;
  }

  const counts = Object.values(clanCounts).sort((a, b) => b - a);
  const pairs  = (Object.entries(clanCounts) as [ClanId, number][])
    .filter(([, c]) => c === 2)
    .map(([clan]) => clan);

  // Pattern detection (sorted desc counts)
  if (counts[0] === 2 && counts[1] === 2 && counts[2] === 1 && counts[3] === 0) {
    return { tier: 'DUAL', boostedClans: pairs, clanCounts };
  }
  if (counts[0] === 2 && counts[1] === 1 && counts[2] === 1 && counts[3] === 1) {
    return { tier: 'SOLO', boostedClans: pairs, clanCounts };
  }
  return { tier: 'NONE', boostedClans: [], clanCounts };
}

/** Get the ×1.5 multiplier for a given wayHit's symbol clan, or 1.0 if not boosted. */
export function resonanceMultForClan(result: ResonanceResult, clan: ClanId): number {
  return result.boostedClans.includes(clan) ? 1.5 : 1.0;
}
```

### 3b. 單元測試（手動，建議 executor 在 PR summary 用 inline 驗證）

本 repo 無 vitest 設置（依 CLAUDE.md），所以**不要新增 test framework**。改為在 PR summary 貼幾組輸入 + 手算輸出：

```
Input: [0, 5, 1, 2, 3]  // Yin/Luoluo(white) + Zhuluan(vermilion) + Zhaoyu(black) + Meng(azure)
Expected: { tier: 'SOLO', boostedClans: ['white'], counts: {white:2, vermilion:1, black:1, azure:1} }

Input: [0, 5, 1, 6, 2]  // Yin+Luoluo(white) + Zhuluan+Lingyu(vermilion) + Zhaoyu(black)
Expected: { tier: 'DUAL', boostedClans: ['white', 'vermilion'], counts: {white:2, vermilion:2, black:1, azure:0} }

Input: [0, 1, 2, 3, 8]  // Yin(white) + Zhuluan(vermilion) + Zhaoyu(black) + Meng(azure) + Wild
Expected: { tier: 'NONE', boostedClans: [], counts: {white:1, vermilion:1, black:1, azure:1} }  // Only 4 non-wild spirits, no pair possible
```

### 3c. 檔案範圍（嚴格）

**新增**：`src/systems/Resonance.ts`（~50 行）

**修改**：無其他檔案。本 PR **只** 加 data layer，不接戰鬥數值、不改 UI。

**禁止**：
- `src/screens/` 任何檔案
- `src/systems/SlotEngine.ts` / `Formation.ts` / `DamageDistributor.ts`
- `src/config/SymbolsConfig.ts` / `DesignTokens.ts`
- `scripts/` 任何檔案
- SPEC.md

**若發現 Resonance 邏輯需要 SYMBOLS 以外欄位（我漏想），STOP 回報**。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No `console.log` / `debugger` in src/
3. `git commit` + `git push`
4. PR URL
5. **PR summary 貼 3 組手算輸入/輸出驗證**（證明 SOLO / DUAL / NONE 三情況都判對）

## 5. Handoff

- PR URL
- 1 行摘要
- 3 組驗證表格
- Spec deviations：預期 0
- Dependencies：無（r-02 會 import detectResonance + resonanceMultForClan）
- 實現 `ResonanceTier` / `ResonanceResult` types 是否 export 正確供下游使用
