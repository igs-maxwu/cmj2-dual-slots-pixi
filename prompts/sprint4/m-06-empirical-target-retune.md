# Sprint 4 · m-06 — 實測校準 DEFAULT_TARGET_RTP / DEFAULT_TARGET_DMG（Wild 加入後的收斂）

## 1. Context

PR: **把兩個校準常數調到 sim 實測 ~100% RTP + ~10 round match**

Why: m-05 Wild 加入後 sim 顯示：
- Coin RTP 302%（target 60%） → ScaleCalculator 解算器不知 Wild 的 ×2 + substitute 效應，低估 EV ~3×，coinScale 膨脹 3×
- avgRoundsPerMatch 5.13（target 10） → dmgScale 同樣膨脹

Owner 決策（2026-04-24）：**Option A 實測校準** — 用 sim 實測值反推常數，保留 SPEC 60% 當「語意 target」但實作層用調整後的值。

比例推算：
- 302% / 100% ≈ 3× → `DEFAULT_TARGET_RTP = 60 / 3 = 20`
- avgRounds 5.13 → 10 需 dmgScale 減半 → `DEFAULT_TARGET_DMG = 600 / 2 = 300`

但以上是線性估算；實際可能因 Wild 比例 + Phoenix 比例交互作用略偏。**本 PR 先試 `RTP=20, DMG=300` 跑 sim**，若偏離再微調。

Source:
- m-05 PR #91 sim 結果
- `src/config/SymbolsConfig.ts` line 38-39

Base: master HEAD（m-05 merged）
Target: `fix/sprint4-m-06-empirical-retune`

## 2. Spec drift check (P6)

1. `mempalace_search "ScaleCalculator Wild ×2 empirical calibration DEFAULT_TARGET_RTP"`
2. 確認 m-05 Wild 已 merged（id:8 在 SYMBOLS）

## 3. Task

### 3a. 改 `src/config/SymbolsConfig.ts` 兩常數

```ts
// BEFORE:
export const DEFAULT_TARGET_RTP = 60;
export const DEFAULT_TARGET_DMG = 600;

// AFTER:
export const DEFAULT_TARGET_RTP = 20;    // m-06: empirical tune post-Wild (Wild×2 + substitute inflates realized EV ~3x)
export const DEFAULT_TARGET_DMG = 300;   // m-06: same inflation on dmg, halve back to SPEC ~10 round match
```

同步更新兩常數**上方註解**說明原因（「name: 語意 60%, 實作用 20 實測校準對齊 Wild ×2 substitute 效應」）。

### 3b. 跑 sim

```bash
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 1234 --runs 50 --config symmetric
```

貼 JSON 前 40 行 + 3 key numbers：

- coin_rtp（期望 85-115%）
- avgRoundsPerMatch（期望 8-14）
- hitFreq.miss（期望維持 m-05 的 47%，不該回升）

### 3c. 若偏離太大，列出方向但不再改

若 coin_rtp > 130% 或 < 70%，或 match 不在 8-14 區間，**貼結果即可**，不要自己再調常數。讓 orchestrator 判斷下一步（可能是 RTP=15 或 25、DMG=250 或 350）。

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（2 常數 + 註解）

**禁止**：
- ScaleCalculator / SlotEngine / BattleScreen / DraftScreen
- 任何 symbol weight
- Wild 本身的 ×2 multiplier（已 locked in m-05）
- Phoenix coin-per-kill（m-04 已 tune）
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON 前 40 行
4. 3 key numbers + 達標判斷

## 5. Handoff

- PR URL
- 3 key numbers 實測值
- 是否落在目標區間？若否，給 orchestrator 方向（調哪個常數往哪走多少）
