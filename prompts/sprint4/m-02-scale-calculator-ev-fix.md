# Sprint 4 · m-02 — ScaleCalculator EV 公式修正（RTP 1990% → ~100%）

## 1. Context

PR: **修 `src/systems/ScaleCalculator.ts` 的 EV 公式多出的 `p_any^k` 因子**

Why: Sprint 4 m-01 sim（PR #81）跑 500k rounds 量到 **Coin RTP = 1990%**，比 SPEC 60% 目標大 33×。executor 精準定位：`calculateScales()` 的 EV 公式第 55-57 行多乘了 `p_any^k`，導致 `coinScale` 被放大約 20× → 每次贏分多給 20×。

根因數學推導：

- 某 symbol matchCount = k（3 或 4）時：
  - `P(matchCount = k) = p_any^k × (1 - p_any)`
  - `E[numWays | matchCount = k] ≈ (p × ROWS / p_any)^k`
  - 乘起來：`(1 - p_any) × (p × ROWS)^k × BASE[k]` ← **p_any^k 被抵消**

- matchCount = 5（全 5 column）：
  - `P(matchCount = 5) = p_any^5`
  - `E[numWays | =5] = (p × ROWS / p_any)^5`
  - 乘起來：`(p × ROWS)^5 × BASE[5]` ← **p_any 也被抵消**

**現狀 bug 公式**（第 55-57 行）多餘的 `p_any^k` 因子（值 ~0.5-0.7）讓 EV 被低估 ~6-20×，反向放大 coinScale。

Source:
- `src/systems/ScaleCalculator.ts` line 55-57
- m-01 sim report（PR #81 summary）
- `prompts/sprint4/MATH-BASELINE.md` 整體背景

Base: master HEAD（m-01 merged）
Target: `fix/sprint4-m-02-scale-calculator-ev`

## 2. Spec drift check (P6)

1. `mempalace_search "ScaleCalculator EV formula bug 1990% RTP"`
2. Read `src/systems/ScaleCalculator.ts` 全檔（只 150 行）
3. 確認 PR #81 已 merged 到 master 且 `scripts/sim-rtp.mjs` 存在
4. 若發現有人已先修過（比如 line 55-57 已不一樣），STOP 回報

## 3. Task

### 3a. 修 `src/systems/ScaleCalculator.ts` EV 公式（line 55-57）

```ts
// BEFORE (buggy — extra p_any^k factor):
const ev = p_any ** 3 * (1 - p_any) * eWays3 * (PAYOUT_BASE[3] ?? 0)
         + p_any ** 4 * (1 - p_any) * eWays4 * (PAYOUT_BASE[4] ?? 0)
         + p_any ** 5               * eWays5 * (PAYOUT_BASE[5] ?? 0);

// AFTER (correct):
const ev = (1 - p_any) * eWays3 * (PAYOUT_BASE[3] ?? 0)
         + (1 - p_any) * eWays4 * (PAYOUT_BASE[4] ?? 0)
         +              eWays5 * (PAYOUT_BASE[5] ?? 0);
```

### 3b. 更新 doc-comment block（line 21-29）

同步把錯誤公式註解修正：

```ts
// BEFORE:
/**
 * Ways EV per round per symbol:
 *   p        = symbol weight / poolTotalW  (per-cell probability)
 *   p_any    = 1 - (1 - p)^ROWS            (prob ≥1 in a column)
 *   E[ways]_k ≈ (ROWS × p)^k              (expected product over k cols)
 *   EV_3 = p_any^3 × (1 - p_any) × (ROWS×p)^3 × BASE[3]
 *   EV_4 = p_any^4 × (1 - p_any) × (ROWS×p)^4 × BASE[4]
 *   EV_5 = p_any^5              × (ROWS×p)^5 × BASE[5]
 *   No LINES_COUNT factor — Ways EV is absolute per round.
 */

// AFTER:
/**
 * Ways EV per round per symbol:
 *   p        = symbol weight / poolTotalW  (per-cell probability)
 *   p_any    = 1 - (1 - p)^ROWS            (prob ≥1 in a column)
 *
 *   P(matchCount = k)            = p_any^k × (1 - p_any)   for k < COLS
 *   P(matchCount = 5)            = p_any^5                  for k = 5
 *   E[numWays | matchCount = k]  ≈ (p × ROWS / p_any)^k
 *
 *   Combining (p_any^k cancels with 1/p_any^k from E[numWays|k]):
 *   EV_3 = (1 - p_any) × (ROWS × p)^3 × BASE[3]
 *   EV_4 = (1 - p_any) × (ROWS × p)^4 × BASE[4]
 *   EV_5 =              (ROWS × p)^5 × BASE[5]
 *   Total EV per symbol = EV_3 + EV_4 + EV_5.
 */
```

### 3c. 重跑 sim 驗證

執行：

```bash
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 1234 --runs 50 --config symmetric
```

把新的 JSON 輸出（前 50 行）貼到 PR summary。

**預期結果**：
- Coin RTP 從 1990% → 落入 ~60% ± 15% 區間（可能仍略偏離 SPEC 但接近）
- avgRoundsPerMatch 從 5.04 → 可能回升到 ~20-30（因 dmg 也變小）
- 其他 metric（passive rate / hit freq）應該不變（不依賴 coinScale）

**不需要**在本 PR 調整 `DEFAULT_TARGET_RTP` / `DEFAULT_TARGET_DMG` / 符號權重等其他參數。那些 m-02 之後再看 sim 結果決定。

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/systems/ScaleCalculator.ts`（3 行公式 + 註解塊）

**禁止**：
- `DEFAULT_TARGET_RTP` / `DEFAULT_TARGET_DMG` / `COIN_EXP` / `DEFAULT_FAIRNESS_EXP` 等常數
- 任何 symbol weight
- `scripts/sim-rtp.mjs`（已 merge，不動）
- BattleScreen / Formation / SlotEngine
- SPEC.md

**若跑 sim 後發現新 RTP 不在 ~60% ± 15%，貼結果，不要改其他東西嘗試湊數字**。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push`
4. PR URL
5. **PR summary 貼 sim 新 JSON 前 50 行**（用 code block）

特別提醒：
- 修完後 `simulateWinRate()` 與 `autoBalance()` 仍會 work（它們呼叫 calculateScales，不直接做 EV 公式）
- 編輯 ScaleCalculator.ts ≥ 3 次不過 build → STOP 回報

## 5. Handoff

- PR URL
- 1 行摘要
- Sim 新 Coin RTP / avgRoundsPerMatch / hitFreq.miss 三個數字
- Spec deviations：預期 0
- 判斷：新 RTP 是否在 SPEC 60% ± 15% 內？若否，列出偏差方向給 orchestrator 決策 m-03 策略
