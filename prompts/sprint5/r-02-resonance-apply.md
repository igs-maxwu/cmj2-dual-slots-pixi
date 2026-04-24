# Sprint 5 · r-02 — Resonance ×1.5 套用到 BattleScreen + sim

## 1. Context

PR: **BattleScreen 開戰時偵測 draft 兩側 Resonance，per-round 套 ×1.5 到 boosted clan 的 wayHits (coin + dmg)**

Why: r-01 已加好 `detectResonance` / `resonanceMultForClan`。r-02 把 ×1.5 接到戰鬥數值 + sim harness，之後 r-03/r-04 加 HUD 呈現，r-05 量 RTP。

Source:
- PR #105 r-01 `src/systems/Resonance.ts`
- `src/screens/BattleScreen.ts` loop()
- `scripts/sim-rtp.mjs`

Base: master HEAD（r-01 merged）
Target: `feat/sprint5-r-02-resonance-apply`

## 2. Spec drift check (P6)

1. `grep -n "Resonance\|dragonBonus\|Streak" src/screens/BattleScreen.ts` 確認插入點
2. 現行 BattleScreen.loop() passive 順序：spin → **dragon bonus** → Streak mult → underdog → chip floor → distribute → phoenix coin
3. r-02 在 dragon bonus **之前** 插 Resonance（都是 per-wayHit clan-specific boost，Resonance 先，Dragon 再加在 resonance 後）

## 3. Task

### 3a. BattleScreen 新增 class fields + onMount 預算

```ts
import { detectResonance, resonanceMultForClan, type ResonanceResult } from '@/systems/Resonance';

// Fields:
private resonanceA!: ResonanceResult;
private resonanceB!: ResonanceResult;

// In onMount after createFormation:
this.resonanceA = detectResonance(this.cfg.selectedA);
this.resonanceB = detectResonance(this.cfg.selectedB);
```

### 3b. loop() 插 Resonance 後處理

找 `let dmgA = spin.sideA.dmgDealt; let dmgB = spin.sideB.dmgDealt;` 那兩行（在 dragon bonus 之前）。改為：

```ts
let dmgA = spin.sideA.dmgDealt;
let dmgB = spin.sideB.dmgDealt;
let coinA = spin.sideA.coinWon;
let coinB = spin.sideB.coinWon;

// ── M5 Resonance: ×1.5 on wayHits whose symbol clan is in boostedClans ──
if (this.resonanceA.tier !== 'NONE') {
  for (const wh of spin.sideA.wayHits) {
    const mult = resonanceMultForClan(this.resonanceA, SYMBOLS[wh.symbolId].clan as any);
    if (mult > 1) {
      // Resonance adds 50% extra on top of existing coinWon/dmgDealt for this wayHit
      const extraCoin = Math.floor(wh.rawCoin * 0.5 * (this.cfg.betA / 100));
      const extraDmg  = Math.floor(wh.rawDmg  * 0.5 * (this.cfg.betA / 100));
      coinA += extraCoin;
      dmgA  += extraDmg;
    }
  }
}
if (this.resonanceB.tier !== 'NONE') {
  for (const wh of spin.sideB.wayHits) {
    const mult = resonanceMultForClan(this.resonanceB, SYMBOLS[wh.symbolId].clan as any);
    if (mult > 1) {
      const extraCoin = Math.floor(wh.rawCoin * 0.5 * (this.cfg.betB / 100));
      const extraDmg  = Math.floor(wh.rawDmg  * 0.5 * (this.cfg.betB / 100));
      coinB += extraCoin;
      dmgB  += extraDmg;
    }
  }
}
```

**注意 `clan as any`**：`SymbolDef.clan` 型別是 `Clan` 但 `resonanceMultForClan` 收 `ClanId`（同義但 TS 可能判不出）。若編譯 error，改成 `clan as ClanId`。

### 3c. Wallet 使用 coinA/coinB

找 `this.walletA = this.walletA - this.cfg.betA + spin.sideA.coinWon;`（大約 line 552）改為：

```ts
this.walletA = this.walletA - this.cfg.betA + coinA;
this.walletB = this.walletB - this.cfg.betB + coinB;
```

（若 Streak Multiplier 已在 coinA/coinB 之後套，注意順序：Resonance 先做 → 更新 coinA/coinB → Streak 再套 × streakMult。不重複乘）

### 3d. sim-rtp.mjs 加 Resonance

`scripts/sim-rtp.mjs`：

```ts
import { detectResonance, resonanceMultForClan } from '@/systems/Resonance';

// After 'const selected = ...':
const resonance = detectResonance(selected);
process.stderr.write(`Resonance: ${resonance.tier} boosted=${resonance.boostedClans.join('/')}\n`);

// In sim loop (same as BattleScreen):
if (resonance.tier !== 'NONE') {
  for (const wh of spin.sideA.wayHits) {
    const mult = resonanceMultForClan(resonance, SYMBOLS[wh.symbolId].clan);
    if (mult > 1) {
      const extraCoin = Math.floor(wh.rawCoin * 0.5 * (BET / 100));
      const extraDmg  = Math.floor(wh.rawDmg  * 0.5 * (BET / 100));
      coinA += extraCoin;
      dmgA  += extraDmg;
      resonanceBoostedCoin += extraCoin;
    }
  }
  // same for B
}
```

加新 output 區塊：

```ts
resonance: {
  tier: resonance.tier,
  boostedClans: resonance.boostedClans,
  boosted_coin_total: resonanceBoostedCoin,
  boosted_pct_of_total_coin: resonanceBoostedCoin / totalWon,
}
```

### 3e. 執行 sim 驗證

兩組 config：
```bash
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 1234 --runs 50 --config symmetric
# 預設 selected=[0,1,2,3,4] → SOLO (white clan paired via Yin + Zhaoyu... 等等，檢查分布)
```

```bash
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 1234 --runs 50 --config white
# 預設 selected=[0, 5, 1, 2, 3] = {white:2, vermilion:1, black:1, azure:1} → SOLO[white]
```

貼兩組 JSON 的 `coin_rtp` / `resonance.tier` / `resonance.boosted_pct` 到 PR summary。

**預期**：
- symmetric (1-1-1-1+1 → 需驗證 selected[0,1,2,3,4] 分布是什麼)
- Coin RTP 從 m-08 的 101.6% 升到 ~110-115%（+8-15% per SPEC §15.3 Resonance allocation）

若超過 120%，flag 給 orchestrator 下 m-08 似的 retune。

### 3f. 檔案範圍

**修改**：
- `src/screens/BattleScreen.ts`（+Resonance field + onMount detect + loop apply, ~25 行）
- `scripts/sim-rtp.mjs`（+import + detect + apply + output, ~25 行）

**禁止**：
- `src/systems/Resonance.ts`（r-01 已 merge，不動）
- SlotEngine / Formation / DamageDistributor
- SymbolsConfig / DesignTokens
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON 兩組（symmetric + white）前 40 行
4. 3 key numbers：coin_rtp / resonance.tier / boosted_pct

## 5. Handoff

- PR URL
- 兩組 sim 的 tier + RTP 變化
- 是否超過 120% RTP？若是給 orchestrator retune 方向
- 確認 Streak 在 Resonance 之後套（順序正確）— 若發現 Streak 先作用再 Resonance，flag
