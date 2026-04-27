# Sprint 6 · j-03 — Jackpot 5-of-a-kind 偵測 + tier draw（3% Grand / 12% Major / 85% Minor）+ Wild substitute + 賠付 + pool reset

## 1. Context

PR: **BattleScreen.loop() 接 JP 觸發核心邏輯：**
- **偵測**：每 spin 檢查「5 個 reel column 是否每個都至少含 1 個 JP cell 或 Wild cell」（Wild 代替 JP，per ROADMAP）
- **抽獎**：觸發後 Math.random() 抽 tier（3% Grand / 12% Major / 85% Minor）
- **賠付**：當前該 tier pool 金額**對半**分給雙方（各 +pool/2 到 wallet）
- **Reset**：該 tier pool 重設回 seed
- **Persist**：savePools()
- **視覺 placeholder**：簡單 goldText 浮現「JACKPOT MINOR/MAJOR/GRAND！」+ 金額（j-04 才做完整 ceremony）
- **Sim 同步**：完整 JP simulation + RTP impact 統計

Why: SPEC §15.8 M12 全鏈路 — j-01 註冊 symbol、j-02 加 pool 持久化，本 PR 讓 JP 真的會觸發、會賠錢、會重置。後續 j-04 把 placeholder ceremony 換成全螢幕 SOS2 BigWin atlas FX、j-05 把 hardcoded marquee 接 live pool 數字。

設計選擇：

### 賠付對半分（避免 RTP 雙倍）

5×3 grid 是雙方共用，5-of-a-kind 觸發是 shared event。若 A 跟 B 都拿全額 pool → RTP 變雙倍。**選擇 split 50/50**：每側各得 `pool / 2`。Pool 被「掏空一次」後 reset 到 seed。

### Tier 抽獎策略

```
const r = Math.random();
let tier: 'grand' | 'major' | 'minor';
if (r < 0.03)        tier = 'grand';   // 3%
else if (r < 0.15)   tier = 'major';   // 12% (0.03 + 0.12)
else                 tier = 'minor';   // 85%
```

**注意**：使用 `Math.random()` 在 sim 內會被 m-01 的 seeded PRNG monkey-patch 覆蓋，所以 sim 跟 BattleScreen 共用同一抽獎邏輯，不必另寫 sim-only 版本。

### Wild substitute 邏輯

5-of-a-kind 偵測用 OR 條件：「每 column 含 ≥1 個 (JP cell OR Wild cell)」。**Wild 不是 reset target** — pool 對 Wild 沒概念，只有 JP / Major / Minor / Grand 有 pool。Wild 純粹是 substitute 旗標。

### 視覺 placeholder（最小可玩）

j-04 才做完整 ceremony，本 PR 保持 <30 行視覺：

```ts
private async showJackpotPlaceholder(tier: 'grand'|'major'|'minor', amount: number): Promise<void> {
  const tierLabel = { grand: '天獎 GRAND', major: '地獎 MAJOR', minor: '人獎 MINOR' }[tier];
  const text = goldText(`★ JACKPOT ${tierLabel} ★\nNT$${Math.floor(amount).toLocaleString()}`, {
    fontSize: T.FONT_SIZE.h1,
    withShadow: true,
  });
  text.anchor.set(0.5, 0.5);
  text.x = CANVAS_WIDTH / 2;
  text.y = CANVAS_HEIGHT / 2;
  text.zIndex = 2000;
  text.alpha = 0;
  this.container.addChild(text);

  await tween(300, t => { text.alpha = t; }, Easings.easeOut);
  await delay(1500);
  await tween(400, t => { text.alpha = 1 - t; }, Easings.easeIn);
  text.destroy();
}
```

j-04 會把這個 placeholder method 完整重寫成全螢幕 ceremony — 本 PR 保持簡單就好。

---

## Skills suggested for this PR

- **`test-driven-development`** — sim 是 truth source。每改一塊就跑 `npm run sim` 看 4 個 metric：trigger_rate / tier_counts / total_payout / coin_rtp 影響。期望 trigger_rate < 0.01/match；coin_rtp 變動 ≤ ±2pp。
- **`incremental-implementation`** — 5 個邏輯區塊（detect / draw / pay / reset / placeholder UI）做為**單一 PR**因為彼此緊耦合，但可內部分 commit：(1) detect+draw 純邏輯，(2) pay+reset 接 pool API，(3) placeholder UI，(4) sim 整合。
- **`source-driven-development`** — Math.random 機率分布語意（`<` vs `<=` 邊界，是否 inclusive 0/1）對照 MDN docs 確認。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Jackpot 5-of-a-kind tier draw 3 12 85 Wild substitute payout split"`
2. 確認 SPEC §15.8 寫的 tier 比例是 **3% Grand / 12% Major / 85% Minor**（與 ROADMAP 一致）
3. 確認 SPEC 沒指定「對半分」或「單側拿全額」— 本 PR 選 split 50/50 並列為 implementation decision（不算 spec drift）
4. 確認 j-02 PR #127 已 merge，`loadPools / savePools / accrueOnBet / resetPool` API 可用
5. 確認 sim-rtp.mjs 既有 `JACKPOT_ID` 跟 5-of-a-kind cell counter（j-01 加的）— 本 PR 改寫成「OR Wild」邏輯

## 3. Task

### 3a. BattleScreen — 偵測 + draw + 賠付 + reset

**imports** 加（near 既有 JackpotPool import）：

```ts
import { resetPool } from '@/systems/JackpotPool';
```

**新 method `detectAndAwardJackpot()`** — 在 BattleScreen class 內，邏輯如下：

```ts
/**
 * j-03: Detect 5-of-a-kind JP/Wild on shared grid. On hit:
 * (1) draw tier (3/12/85 weighted), (2) split pool 50/50 to both wallets,
 * (3) reset that pool to seed, (4) persist, (5) play placeholder visual.
 *
 * Returns the awarded tier (or null if no trigger), so loop() knows whether to await ceremony.
 */
private async detectAndAwardJackpot(grid: number[][]): Promise<'grand'|'major'|'minor'|null> {
  const JP_ID   = SYMBOLS.findIndex(s => s.isJackpot);
  const WILD_ID = SYMBOLS.findIndex(s => s.isWild);
  if (JP_ID < 0) return null;

  // Each of 5 reels must have ≥1 JP-or-Wild cell
  const reelsCovered = new Set<number>();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      const id = grid[r][c];
      if (id === JP_ID || id === WILD_ID) reelsCovered.add(c);
    }
  }
  if (reelsCovered.size < 5) return null;

  // Tier draw: 3% Grand / 12% Major / 85% Minor
  const r = Math.random();
  const tier: 'grand'|'major'|'minor' = r < 0.03 ? 'grand' : r < 0.15 ? 'major' : 'minor';

  // Read pool, split 50/50, reset, persist
  const award = this.jackpotPools[tier];
  const halfAward = Math.floor(award / 2);
  this.walletA += halfAward;
  this.walletB += halfAward;
  this.jackpotPools = resetPool(this.jackpotPools, tier);
  savePools(this.jackpotPools);

  if (import.meta.env.DEV) {
    console.log(`[Jackpot] TRIGGERED tier=${tier} award=${award} (each side +${halfAward})`);
  }

  // Placeholder visual (j-04 will replace with full ceremony)
  await this.showJackpotPlaceholder(tier, award);

  // Wallet text refresh
  this.cascadeWallet('A');
  this.cascadeWallet('B');

  return tier;
}
```

**呼叫位置 in loop()**：在 free spin trigger detection 之後、Resonance 之前；或者在 fx Promise.all 之後（賠付完才看到放動畫）。**建議放在 `await Promise.all(fx)` 之後**，跟 free spin decrement 同階段：

```ts
// After: await Promise.all(fx);
// Before: free spin decrement
const jpTier = await this.detectAndAwardJackpot(spin.grid);
// (jpTier is for future logic; not used in j-03)
```

**注意**：`await` 會讓 placeholder 動畫播放完才繼續 — 確保下一回合 spin 不會打斷 ceremony。

### 3b. BattleScreen — placeholder visual method

加 `showJackpotPlaceholder()`（見 §1 設計選擇區塊內 code），class 內 private method。

### 3c. sim-rtp.mjs — JP simulation full integration

**imports** 在 sim 開頭：

```ts
import { JACKPOT_SEEDS, JACKPOT_POOL_WEIGHTS, JACKPOT_ACCRUAL_RATE } from '../src/systems/JackpotPool.ts';
```

（注意：sim 是 `.mjs`，TS imports 透過 tsx — 確認既有檔有相同 pattern import .ts，若不行則用本地 mirror constants）

**per-run init**：

```ts
let jpPools = { ...JACKPOT_SEEDS };
let jpTriggers = 0;
const jpTierCounts = { grand: 0, major: 0, minor: 0 };
const jpTierPayouts = { grand: 0, major: 0, minor: 0 };
let jpTotalPayout = 0;
```

**per-spin** （在既有 jackpot block 改寫）：

```ts
// Accrual (sim-side replication of BattleScreen)
const totalBet = betThisSpinA + betThisSpinB;
if (totalBet > 0) {
  jpPools.minor += totalBet * JACKPOT_ACCRUAL_RATE * JACKPOT_POOL_WEIGHTS.minor;
  jpPools.major += totalBet * JACKPOT_ACCRUAL_RATE * JACKPOT_POOL_WEIGHTS.major;
  jpPools.grand += totalBet * JACKPOT_ACCRUAL_RATE * JACKPOT_POOL_WEIGHTS.grand;
}

// Detection: 5-of-a-kind JP OR Wild
const reelsCovered = new Set();
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 5; c++) {
    if (spin.grid[r][c] === JACKPOT_ID || spin.grid[r][c] === WILD_ID) {
      reelsCovered.add(c);
    }
  }
}
if (reelsCovered.size === 5) {
  jpTriggers++;
  // Tier draw (same as BattleScreen)
  const draw = Math.random();
  const tier = draw < 0.03 ? 'grand' : draw < 0.15 ? 'major' : 'minor';
  jpTierCounts[tier]++;
  const award = jpPools[tier];
  jpTierPayouts[tier] += award;
  jpTotalPayout += award;
  // Both sides win half (sim tracks combined for RTP impact)
  totalCoinOut += award;   // <-- adjust to match existing var name in sim
  // Reset that pool
  jpPools[tier] = JACKPOT_SEEDS[tier];
}
```

**注意**：`totalCoinOut` 是 placeholder — 確認 sim 既存的 RTP accumulator 名字（可能是 `totalCoinWon` 或類似），不要硬套。

**output 區塊** 擴充原 jackpot block：

```ts
jackpot: {
  // existing fields from j-01:
  total_cells: totalJackpotCells,
  avg_per_spin: totalJackpotCells / ROUNDS,
  five_of_a_kind_count: jackpotFiveOfAKindCount,
  // new in j-03:
  triggers: jpTriggers,
  trigger_rate_per_spin: jpTriggers / ROUNDS,
  trigger_rate_per_match: jpTriggers / totalMatches,
  tier_counts: jpTierCounts,
  tier_payouts: jpTierPayouts,
  total_payout: jpTotalPayout,
  rtp_contribution: jpTotalPayout / totalCoinIn,    // adjust var name
  // pool steady-state (last run's final values)
  final_pool_minor: jpPools.minor,
  final_pool_major: jpPools.major,
  final_pool_grand: jpPools.grand,
},
```

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（+detectAndAwardJackpot method ~30 行 + showJackpotPlaceholder method ~20 行 + loop() 1 行 await call）
- `scripts/sim-rtp.mjs`（per-run init + per-spin accrual+detect+draw+payout + extended jackpot output ~30 行）

**禁止**：
- JackpotPool.ts（j-02 已穩定，本 PR 不動）
- SymbolsConfig / SlotEngine / GemMapping
- DraftScreen / LoadingScreen
- 完整 ceremony FX（j-04 工作 — 本 PR 用 goldText placeholder）
- JP marquee live counter（j-05 工作 — 本 PR 不接 marquee 顯示）
- 改 j-01 / j-02 / f-track 邏輯
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. 4 個 commit（detect+draw / pay+reset / placeholder UI / sim 整合）— 或合併成 2-3 個也接受，視 executor 判斷
3. push + PR URL + sim JSON
4. **Sim 數字**：
   - `jackpot.trigger_rate_per_match`（期望 < 0.01；Wild 加入後可能稍高，**需確認**）
   - `jackpot.tier_counts.grand / major / minor`（比例應接近 3 / 12 / 85，足夠 sample size 才信得過）
   - `jackpot.total_payout`（看 ratio 多少 NTD 出去）
   - `jackpot.rtp_contribution`（期望 < 5%）
   - `coin_rtp` total（期望維持 95-110% — 若 push 過 110% 表示 JP RTP 加得太多，flag）
   - `jackpot.final_pool_*`（看 pool 在 sim 結束時長到多大，sanity check）
5. **Preview 驗證（DEV manual）**：
   - 自然觸發**極罕見**（< 0.01/match），所以視覺驗證可加 DEV 'J' keypress 強制觸發（**選配**，prompt 不強制）
   - 若加，按 'J' 看 console `[Jackpot] TRIGGERED tier=minor award=50000 (each side +25000)` + 中央浮現「JACKPOT 人獎 MINOR NT$50,000」

## 5. Handoff

- PR URL
- 1 行摘要
- 5-6 個 sim 數字 + 是否落 SPEC 範圍
- 是否加了 DEV 'J' 鍵手動觸發
- 自然觸發是否實測到（多半沒有，正常）
- coin_rtp 若超過 110%，flag — 表示 JP RTP 太大，可能要 j-05 sim closure 一併 rebalance
- Spec deviations：
  - **明確列**：對半分賠付 (split 50/50)，避免 RTP 雙倍 — 是 implementation decision，不算 spec drift
  - 其他預期 0
