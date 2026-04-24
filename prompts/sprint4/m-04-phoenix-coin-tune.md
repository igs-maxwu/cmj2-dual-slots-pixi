# Sprint 4 · m-04 — Phoenix coin-per-kill 500 → 200（把總 RTP 從 118% 收到 ~85%）

## 1. Context

PR: **砍 Phoenix coin-on-kill 金幣數 500 → 200**

Why: m-03 完成後 sim 顯示 base ways RTP ~60%（對齊 SPEC §15.3）但**總 Coin RTP = 118%** 超出 SPEC "~100%" 目標。Phoenix passive 貢獻 48%（~58M coin / 118M 總），數值拍腦袋訂太高。

Owner 決策 2026-04-24：選方案 A — 砍 Phoenix 500 → 200。**理由**：
- b-04 設 500 當時沒 sim 驗證
- SPEC §15.3 分配 60% base + 40% meta (Wild/Streak/Resonance/FreeSpin) = 100%，**Phoenix 不在清單內**
- Phoenix 屬額外層，應落在 ~20% 而非 48%
- 500→200（×0.4）後預期 Phoenix ~20%，總 RTP ~80-85%

Source:
- m-03 PR #87 sim report
- `src/screens/BattleScreen.ts` line 543 `const PHOENIX_COIN_PER_KILL = 500`
- `scripts/sim-rtp.mjs` line 79 同名常數

Base: master HEAD（m-03 merged）
Target: `fix/sprint4-m-04-phoenix-tune`

## 2. Spec drift check (P6)

1. `grep -n PHOENIX_COIN_PER_KILL src/ scripts/` 確認只 2 處引用（BattleScreen + sim）
2. 若發現其他地方（SPEC.md 文字、註解）也有 500，列出但本 PR 先只改 code

## 3. Task

### 3a. 改 `src/screens/BattleScreen.ts` line 543

```ts
// BEFORE:
const PHOENIX_COIN_PER_KILL = 500;

// AFTER:
const PHOENIX_COIN_PER_KILL = 200;   // m-04: tuned from 500 to bring total RTP under 100%
```

同時更新 line 542 註解 `+500` → `+200`。

### 3b. 改 `scripts/sim-rtp.mjs` line 79

```ts
// BEFORE:
const PHOENIX_COIN_PER_KILL = 500;

// AFTER:
const PHOENIX_COIN_PER_KILL = 200;
```

同時更新 line 14 註解 `+500` → `+200`。

### 3c. 重跑 sim 驗證

```bash
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 1234 --runs 50 --config symmetric
```

貼 JSON 前 40 行 + 3 key numbers：

- coin_rtp（期望 75-95%）
- avgRoundsPerMatch（期望維持 ~10-14，不該受影響太多）
- phoenix_pct_of_total_coin（期望 ~20-25%）

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（1 行 const + 1 行註解）
- `scripts/sim-rtp.mjs`（1 行 const + 1 行註解）

**禁止**：
- SymbolsConfig / ScaleCalculator / Formation / DamageDistributor
- SPEC.md
- 任何其他 Sprint 3B passive（tiger/tortoise/dragon 的數值不動）
- 其他 symbols weight

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + 貼 sim JSON 前 40 行
4. 列出 3 key numbers

## 5. Handoff

- PR URL
- 1 行摘要
- coin_rtp 是否落 75-95%？
- phoenix_pct_of_total_coin 是否落 ~20-25%？
- 若超出，列方向給 orchestrator 決策
