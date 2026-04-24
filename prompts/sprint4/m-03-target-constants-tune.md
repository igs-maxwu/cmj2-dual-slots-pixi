# Sprint 4 · m-03 — 校準 DEFAULT_TARGET_RTP + DEFAULT_TARGET_DMG（對齊 SPEC 60% RTP / 10 round match）

## 1. Context

PR: **把 SymbolsConfig 的兩個校準常數調到 SPEC §15 locked 目標，重跑 sim 驗證**

Why: Sprint 4 m-02 修好 EV 公式後，sim 顯示「數學現在對準 `DEFAULT_TARGET_RTP=97`」，但 SPEC §15.3 目標是 **Base Ways 60%**，兩個數字不同。同理 match 長度 20.9 round 也該向 SPEC **~10 round** 收。

Source:
- `src/config/SymbolsConfig.ts` line 37-38 `DEFAULT_TARGET_RTP=97` / `DEFAULT_TARGET_DMG=300`
- m-02 合併後的 sim baseline：Coin RTP 137% / avgRoundsPerMatch 20.9 / Phoenix 29%
- SPEC §15.3 Base Ways 60% coin + 其他 meta (Wild/Streak/Resonance/FreeSpin) 加起來 100% 總 RTP
- SPEC §15 Dmg target "4000 HP formation killed in ~10 rounds" 對應 Unit HP × Unit count = 5 × 1000 = 5000 / 10 = 500 HP/round target

Base: master HEAD（PR #85 sim 修正 merged）
Target: `fix/sprint4-m-03-target-constants`

## 2. Spec drift check (P6)

1. `Read prompts/sprint4/MATH-BASELINE.md` §4 Scenario B / D 校準路徑
2. 確認 `DEFAULT_TARGET_RTP` / `DEFAULT_TARGET_DMG` 在 SymbolsConfig.ts 現值
3. 確認 `scripts/sim-rtp.mjs` 工作正常（PR #85 後）

## 3. Task

### 3a. 修 `src/config/SymbolsConfig.ts` 兩個常數

```ts
// BEFORE:
export const DEFAULT_TARGET_RTP = 97;
export const DEFAULT_TARGET_DMG = 300;

// AFTER:
export const DEFAULT_TARGET_RTP = 60;    // SPEC §15.3 Base Ways coin RTP
export const DEFAULT_TARGET_DMG = 600;   // halve match length: 20 round → ~10
```

### 3b. 重跑 sim 驗證

```bash
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 1234 --runs 50 --config symmetric
```

把 JSON 前 40 行貼到 PR summary。

**預期結果**：
- **Coin RTP**: 137% → 預期落 ~95% ± 15%（base ways 60 + Phoenix 29% 約 89%，但 match 縮短後 Phoenix 比例可能再漲）
- **avgRoundsPerMatch**: 20.9 → 預期 ~10-12
- **Hit miss**: 57.9% 不會變（結構性，和這兩常數無關；m-04/05 Wild/Scatter 再處理）

**可接受範圍**（若達到則收本 PR，否則列出調整方向）：
- Coin RTP 80-110%（包含 Phoenix 貢獻）
- avgRoundsPerMatch 8-14
- 其他不變

若偏離過大，**貼真實數字，不要繼續微調 try-and-error**，讓 orchestrator 下一步決策。

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（2 個 const 值）

**禁止**：
- `ScaleCalculator.ts` / `SlotEngine.ts` / `Formation.ts` / `DamageDistributor.ts`
- `scripts/sim-rtp.mjs`
- SPEC.md
- 任何 symbol weight（hit miss 留給 m-04/05）
- `DEFAULT_UNIT_HP` / `DEFAULT_BET` / `DEFAULT_FAIRNESS_EXP` 等其他常數
- `COIN_EXP`

**若發現 `DEFAULT_TARGET_RTP` 被其他檔案參考（非 ScaleCalculator），列出但別改**。

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + 貼 sim JSON 前 40 行
4. **PR summary 給出 3 個關鍵數字**：coin_rtp, avgRoundsPerMatch, phoenix_pct_of_total_coin

## 5. Handoff

- PR URL
- 1 行摘要
- 判斷：Coin RTP 是否落 80-110% 區間？avgRoundsPerMatch 是否落 8-14 區間？
- 若超出，列出偏差方向 + 猜測是哪個常數要再調（例如 "RTP 仍偏高 → 可能要把 DEFAULT_TARGET_RTP 再降到 45"）
- Spec deviations：預期 0（SPEC §15.3 就是 60% target）
