# Sprint 4 · m-07 — Streak Multiplier（氣勢連擊 ×1 → ×2 cap）

## 1. Context

PR: **SPEC §15 M3 Streak Multiplier 上線**

Why: 連續 non-miss spin 累積倍率，miss 歸零。同時套用到 coin 與 dmg，SPEC §15.3 預期 +8% RTP。與 Wild ×2 為 **multiplicative stacking**（the-actuary 2026-04-23 建議，owner 尚未明確拒絕）。

Source:
- SPEC §15 M3：Streak 1=×1.0 / 2=×1.2 / 3=×1.5 / 4+=×2.0 cap
- Miss (0 wayHits) → 歸零 ×1.0
- 套用到 **coin + dmg** 雙邊（dual-scale consistent）
- Per-side state（A 連擊與 B 連擊分開計數）

Base: master HEAD（m-06 merged）
Target: `feat/sprint4-m-07-streak-multiplier`

## 2. Spec drift check (P6)

1. `mempalace_search "Streak Multiplier M3 SPEC §15 x2 cap"`
2. 確認 `src/screens/BattleScreen.ts` 目前 game-loop 順序：spin → dragon bonus → underdog → chip floor → distribute → phoenix coin → HP tween
3. Streak 應該插在**哪個位置**？建議 **spin 回傳後、dragon bonus 之前**（最原始 coin/dmg 上套倍率）；或 **dragon bonus 之後**（dragon +20% 先加再套 streak）— 選後者更直覺（dragon 是 per-wayHit 的局部加成，streak 是整輪全域）

## 3. Task

### 3a. 加常數表（`src/config/SymbolsConfig.ts` 末尾）

```ts
/** SPEC §15 M3 — Streak Multiplier table (consecutive non-miss spins build, miss resets). */
export const STREAK_MULT_TABLE = [1.0, 1.0, 1.2, 1.5, 2.0] as const;
// index 0: impossible (streak starts at 1 on first win)
// index 1: streak=1 → ×1.0 baseline
// index 2: streak=2 → ×1.2
// index 3: streak=3 → ×1.5
// index 4+: cap at 2.0

/** Look up multiplier for given streak count (0-based). Caps at 2.0. */
export function streakMult(streak: number): number {
  const capped = Math.min(streak, STREAK_MULT_TABLE.length - 1);
  return STREAK_MULT_TABLE[Math.max(1, capped)];
}
```

### 3b. BattleScreen state + 套用

`src/screens/BattleScreen.ts`：

```ts
// Add class fields near existing state (similar to consecutiveMissA/B):
private streakA = 0;
private streakB = 0;

// onMount() / reset logic: both initialise 0
```

在 `loop()` 內 spin 回傳後、dragon passive 之後、underdog 之前插入：

```ts
// ── M3 Streak Multiplier: consecutive wins build ×1 → ×2 cap; miss resets ──
const streakMultA = streakMult(this.streakA);
const streakMultB = streakMult(this.streakB);
if (streakMultA !== 1.0) {
  dmgA = Math.floor(dmgA * streakMultA);
  // coin is in spin.sideA.coinWon (not dmgA); apply separately to wallet addition
}
if (streakMultB !== 1.0) {
  dmgB = Math.floor(dmgB * streakMultB);
}

// Apply streak to coin winning (wallet addition):
const coinA = Math.floor(spin.sideA.coinWon * streakMultA);
const coinB = Math.floor(spin.sideB.coinWon * streakMultB);
this.walletA = this.walletA - this.cfg.betA + coinA;
this.walletB = this.walletB - this.cfg.betB + coinB;
```

**注意**：現有 line 552-553 直接用 `spin.sideA.coinWon`：

```ts
this.walletA = this.walletA - this.cfg.betA + spin.sideA.coinWon;
this.walletB = this.walletB - this.cfg.betB + spin.sideB.coinWon;
```

要改為套上 streakMult 的版本。

### 3c. Streak 更新（同一 round 末尾）

在 chip miss counter 之後（約 line 593-596）加：

```ts
// ── Update streak (for NEXT round) ──
if (spin.sideA.wayHits.length === 0) this.streakA = 0;
else                                  this.streakA++;
if (spin.sideB.wayHits.length === 0) this.streakB = 0;
else                                  this.streakB++;
```

### 3d. sim-rtp.mjs 套用

同樣邏輯：per-run state `streakA`, `streakB`，每 round 更新、回 spin 時套用。在 output JSON `passives` 或新 `streak` 區塊加統計：

```ts
streak: {
  avg_streak_A: totalStreakSumA / ROUNDS,
  avg_streak_B: totalStreakSumB / ROUNDS,
  max_streak: maxStreakObserved,
  streak_boosted_coin_pct: streakBoostedCoin / totalWon,
}
```

### 3e. 視覺 HUD（選配 §3f，超過 15 行跳過）

BattleScreen 可在頂部加小 `氣勢 LV.N` text（per-side），顏色 cream / gold / warm-gold / red-hot 漸層。本 PR **不強制**，留 polish PR。

### 3f. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（+10 行 STREAK_MULT_TABLE + streakMult helper）
- `src/screens/BattleScreen.ts`（+15 ~ +20 行 state + loop 邏輯）
- `scripts/sim-rtp.mjs`（+15 行 state + stats）

**禁止**：
- SlotEngine（Streak 屬 game-loop 後處理，不進算法層）
- Formation / DamageDistributor
- SPEC.md
- 其他 passive（dragon/phoenix/tiger/tortoise）數值不動

## 4. DoD

1. `npm run build` 過
2. No console.log
3. commit + push
4. PR URL + sim JSON 前 50 行 + key numbers：
   - coin_rtp（期望 m-06 的 118% × 1.08 ≈ 127%，SPEC target ~100%）
   - avg_streak_A（期望 ~1-2）
   - hitFreq.miss（期望 ~47% 不變）

## 5. Handoff

- PR URL
- 1 行摘要
- Streak 是否 ×1.2/1.5/2 cap 有實際觸發（給 max_streak 數）
- coin_rtp 是否符合 +8% 預期？或更多/更少？
- 若 coin_rtp 超 130%，flag 給 orchestrator 下 m-08 retune
