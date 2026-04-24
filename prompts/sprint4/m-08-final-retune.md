# Sprint 4 · m-08 — 最終 Target 常數 retune（收斂 Coin RTP ~100% + match ~10 round）

## 1. Context

PR: **Sprint 4 Track M 收官 — 把所有機制加完後的實測值調到 SPEC 目標**

Why: m-07 Streak merged 後 sim：
- coin_rtp 123.3%（SPEC target 100%，超 23%）
- match 長度（預計仍 ~7 round，Streak dmg boost 讓更短）
- miss 47%（Wild 結構限制，暫留）

把 `DEFAULT_TARGET_RTP` / `DEFAULT_TARGET_DMG` 再調一次收尾。

推算：
- RTP 因數 100/123.3 = 0.811 → `DEFAULT_TARGET_RTP = 20 × 0.811 ≈ 16`
- match 從 m-06 的 7.48 round，加 Streak 後估計 ~7.0 round。目標 10 round，因數 7/10 = 0.7 → `DEFAULT_TARGET_DMG = 300 × 0.7 = 210`

Source:
- m-06 sim (RTP 118%, match 7.48)
- m-07 sim (RTP 123.3%, +5.4pp from Streak, match not reported but est. ~7.0)
- `src/config/SymbolsConfig.ts`

Base: master HEAD（m-07 merged）
Target: `fix/sprint4-m-08-final-retune`

## 2. Spec drift check (P6)

1. 確認 DEFAULT_TARGET_RTP 當前 = 20
2. 確認 DEFAULT_TARGET_DMG 當前 = 300
3. 若有人先動過（不太可能），STOP 回報

## 2. Task

### 3a. 改兩常數

```ts
// BEFORE (m-06):
export const DEFAULT_TARGET_RTP = 20;
export const DEFAULT_TARGET_DMG = 300;

// AFTER (m-08):
export const DEFAULT_TARGET_RTP = 16;    // m-08 final: Wild×2 + Streak cap × Phoenix combined realized ~6.2× analytical
export const DEFAULT_TARGET_DMG = 210;   // m-08 final: lengthen match 7 → 10 round under current Wild+Streak dmg boost
```

### 3b. 重跑 sim

```bash
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 1234 --runs 50 --config symmetric
```

貼 JSON 前 60 行 + 4 key numbers：

- **coin_rtp**（期望 90-110% — Sprint 4 exit gate）
- **avgRoundsPerMatch**（期望 8-12 — SPEC ~10）
- **hitFreq.miss**（維持 ~47%）
- **phoenix_pct_of_total_coin**（觀察性指標，應 25-30%）

### 3c. 若仍偏離

若 coin_rtp 超 110% 或 < 90%，或 match 不在 8-12：**貼結果，列方向**：
- RTP 仍高 → 降 DEFAULT_TARGET_RTP 再 1-2 點
- RTP 太低 → 升 1-2 點
- match 太短 → 降 DEFAULT_TARGET_DMG
- match 太長 → 升

**不要自己再調超過 1 次**，讓 orchestrator 決定是否跑 m-09 或收 Sprint 4。

### 3d. 檔案範圍

**修改**：`src/config/SymbolsConfig.ts`（2 常數）

**禁止**：其他一切。

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON 前 60 行
4. 4 key numbers + 判斷是否達 Sprint 4 exit gate（coin_rtp 90-110% + match 8-12）

## 5. Handoff

- PR URL
- 4 key numbers 實測值
- 是否通過 Sprint 4 exit gate？
- 若通過，建議 orchestrator 宣告 Sprint 4 Track M 完成，進 Track L（audio 壓縮、lazy-load、PWA）或 Sprint 5（Resonance/Curse）
- 若不通過，明確列出偏差方向 + 建議調整量
