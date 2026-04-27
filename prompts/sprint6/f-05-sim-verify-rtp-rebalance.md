# Sprint 6 · f-05 — Sim verify Free Spin trigger rate + **RTP rebalance**（Sprint 6 exit gate Track F）

## 1. Context

PR: **f-03 sim 量到 `coin_rtp=133.45%` 超過 130% threshold（Sprint 6 exit gate 要求 95-110%）。本 PR 透過 sim-driven 迭代調整 `DEFAULT_TARGET_RTP`，必要時加 `FREE_SPIN_COIN_SCALE` 微調，把 base + free spin 結合 RTP 帶到 95-110%。同時收 Track F 整體 sim 報告作為 Sprint 6 exit verification。**

Why: Sprint 6 ROADMAP 驗收標準 §6 要求「Coin RTP 整體 sim 結果 95-110%」。f-04 UI 已完成、Track F 機制全部接通，剩這條 RTP 校正後 Track F 才能宣告 closed。

設計約束（不可違反）：
- `FREE_SPIN_WIN_MULT = 2` LOCKED（SPEC §15.7「win ×2」）
- `FREE_SPIN_COUNT = 5` LOCKED（SPEC §15.7「5 free spins」）
- Scatter `weight = 4` LOCKED（per_match_estimate=0.2586 命中 SPEC 0.15-0.30）
- `coinScale / dmgScale` 來自 ScaleCalculator 解析計算（m-02 之後的設計），**不直接改 ScaleCalculator**
- 唯一可調 dial：`DEFAULT_TARGET_RTP`（目前 16）+ 新增 `FREE_SPIN_COIN_SCALE`（預設 1.0）

調整策略：
1. **第一輪**：只調 `DEFAULT_TARGET_RTP` 16 → 12 → 10 → 試 sim，看能否單刀帶到 95-110%
2. **若 base 過低（<60%）才變這麼多**：表示 free spin 貢獻不對稱，需第二輪
3. **第二輪**：加 `FREE_SPIN_COIN_SCALE` knob（0.7-0.8 區間），只縮 free spin coin（不縮 dmg — 維持戰鬥手感）
4. 每輪 commit 一次（incremental commits 留 audit trail）

---

## Skills suggested for this PR

- **`test-driven-development`** — sim is the test。每輪改一個 dial → 跑 `npm run sim` → 看 4 個 acceptance metric → commit。Red-Green-Refactor 對應「不過 → 改 → 過」。
- **`performance-optimization`** — 10k×50 sim 目前 ~13s。每輪迭代要跑數次，避免改動 sim 邏輯讓 runtime 暴漲。若每輪 sim >30s 即時 stop。
- **`incremental-implementation`** — 每個 dial 改動是一個獨立 commit，方便 git log 看「哪個 dial 動了多少」。**禁止單一 commit 改多個 dial**。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Free Spin RTP rebalance Sprint 6 exit gate FREE_SPIN_WIN_MULT"`
2. 確認 SPEC §15.7 沒寫「coin scale」這字 — 表示我們新加 `FREE_SPIN_COIN_SCALE` 是 implementation detail，不是 spec drift
3. 確認 ROADMAP §6 驗收 line：「Coin RTP 整體 sim 結果 95-110%（最終目標）」
4. 確認 SymbolsConfig.ts 目前 `DEFAULT_TARGET_RTP = 16`、`DEFAULT_TARGET_DMG = 210`（m-08 final）

## 3. Task

### 3a. 第一輪 — 純 `DEFAULT_TARGET_RTP` retune

**Try sequence**（每個都跑 sim 一次，記錄 coin_rtp）：

| Trial | DEFAULT_TARGET_RTP | Expected base RTP | Expected total |
|---|---|---|---|
| baseline | 16 | 106.75% | 133.45% (current) |
| t1 | 12 | ~80% | ~100% |
| t2 | 10 | ~67% | ~83% |
| t3 | 14 | ~93% | ~117% |

**Stop rule**：第一個讓 `coin_rtp` 落在 [95, 110] 區間的 trial 即停。每個 trial commit 一次：

```
git commit -m "tune(f-05): DEFAULT_TARGET_RTP 16->12 -> coin_rtp X.XX% (try 1)"
```

若 trial 1-3 都未進區間，**進第二輪**。

### 3b. 第二輪（若需要）— 加 `FREE_SPIN_COIN_SCALE` knob

`SymbolsConfig.ts`：

```ts
/**
 * f-05: scales coin output during Free Spin only (does NOT affect dmg).
 * Default 1.0 means SPEC ×2 multiplier acts at full strength.
 * Lower (e.g. 0.75) reduces free-spin coin contribution if base RTP
 * tune alone cannot bring combined RTP to 95-110%.
 */
export const FREE_SPIN_COIN_SCALE = 1.0;
```

`BattleScreen.ts` — 在 free spin ×2 application block：

```ts
// 既有：
if (this.inFreeSpin) {
  coinA = Math.floor(coinA * BattleScreen.FREE_SPIN_WIN_MULT);
  coinB = Math.floor(coinB * BattleScreen.FREE_SPIN_WIN_MULT);
  // ...
}

// 改為：
if (this.inFreeSpin) {
  coinA = Math.floor(coinA * BattleScreen.FREE_SPIN_WIN_MULT * FREE_SPIN_COIN_SCALE);
  coinB = Math.floor(coinB * BattleScreen.FREE_SPIN_WIN_MULT * FREE_SPIN_COIN_SCALE);
  // dmg unchanged — keep combat feel
  if (dmgA > 0) dmgA = Math.floor(dmgA * BattleScreen.FREE_SPIN_WIN_MULT);
  if (dmgB > 0) dmgB = Math.floor(dmgB * BattleScreen.FREE_SPIN_WIN_MULT);
}
```

`scripts/sim-rtp.mjs` — 同步加：

```ts
import { FREE_SPIN_COIN_SCALE } from '../src/config/SymbolsConfig.ts';

// 在 sim free spin block：
coinThisSpinA *= FREE_SPIN_WIN_MULT * FREE_SPIN_COIN_SCALE;
coinThisSpinB *= FREE_SPIN_WIN_MULT * FREE_SPIN_COIN_SCALE;
// dmg 維持 ×FREE_SPIN_WIN_MULT only
```

**Try sequence**（在第一輪終止值上往下 sweep）：

| Trial | FREE_SPIN_COIN_SCALE | Notes |
|---|---|---|
| t4 | 0.85 | mild attenuation |
| t5 | 0.75 | moderate |
| t6 | 0.65 | aggressive — flag if needed |

每 trial 跑 sim + commit。

### 3c. 最終驗收 sim run

選定參數後跑**最終一次 10k×50** 並確認下列 4 指標**全部**達標：

| Metric | Target | f-03 baseline |
|---|---|---|
| `coin_rtp` | 95-110% | 133.45% |
| `free_spin.trigger_rate_per_match` | 0.15-0.30 | 0.2152 ✓ |
| `free_spin.pct_of_total_coin_from_freespin` | 10-25% | 16.51% ✓ |
| `dmg_per_round_avg`（既有 metric）| 不大幅偏離 m-08 baseline 210 | — |

**注意**：trigger_rate 跟 pct 兩個指標**不應**因為調 RTP target 而偏移（trigger 是計數、pct 是比例），若有偏移表示動到不該動的東西。

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（DEFAULT_TARGET_RTP 數值 + 必要時加 FREE_SPIN_COIN_SCALE）
- `src/screens/BattleScreen.ts`（必要時 wire FREE_SPIN_COIN_SCALE）
- `scripts/sim-rtp.mjs`（必要時 wire FREE_SPIN_COIN_SCALE）

**禁止**：
- ScaleCalculator.ts（解析公式 m-02 後 LOCKED，這個改動會破壞 RTP 模型）
- SlotEngine.ts / DamageDistributor.ts / Resonance.ts
- DEFAULT_TARGET_DMG（這是傷害校正，與 RTP 無關）
- FREE_SPIN_WIN_MULT / FREE_SPIN_COUNT（SPEC LOCKED）
- Scatter weight（LOCKED at 4）
- DraftScreen / LoadingScreen / GemMapping / 任何 UI
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. 多個 commits（每個 trial 一個 commit），final commit 標記「f-05 final: total coin_rtp X.XX% in 95-110% target」
3. push + PR URL
4. PR body 包含 trial table（哪個 dial 動到多少 → 該 trial 的 coin_rtp）
5. **最終 sim JSON 完整貼進 PR body**（4 個 acceptance metric 一目了然）
6. **若無法在第一輪達標**，PR body 解釋為何加 FREE_SPIN_COIN_SCALE knob

## 5. Handoff

- PR URL
- 1 行摘要 + 最終 4 個 acceptance metric 數字
- 用了第一輪、第二輪、還是兩輪都用
- 最終 `DEFAULT_TARGET_RTP` 跟 `FREE_SPIN_COIN_SCALE` 的值
- 任何 sim runtime 變慢的觀察（performance-optimization skill 若觸發）
- Spec deviations：預期 0
- **Sprint 6 Track F closure flag**：若全部達標，PR body 結尾寫一行「Sprint 6 Track F 5/5 COMPLETE — ready for Track J kickoff」
