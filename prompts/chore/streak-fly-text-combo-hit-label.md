# Chore #212 — Streak fly text label `×N.N` → `Combo HIT!!`

## 1. Context

Owner 試玩 2026-05-05 反映：「我想將連勝獎勵直接寫出文字來，寫成 `Combo HIT!!`」

當前 streak ≥ 2 觸發 [StreakFlyText.ts:61](src/fx/StreakFlyText.ts#L61) 顯示金色 `×N.N`（例如 `×1.5`），從 reel 中央飛到 wallet。Owner 認為純倍數不夠 punchy / 不夠語義化，想改成更明確的「Combo HIT!!」字樣。

純文字 swap — 不動 fly 軌跡 / 三段動畫 / trail particle / call site / 觸發條件。倍率 `multiplier` 參數保留（chore #209 不破壞 signature），只是不再顯示在 label 上。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 直接改 label text 字串

---

## 2. Spec drift check (P6)

1. 確認 [`src/fx/StreakFlyText.ts:61`](src/fx/StreakFlyText.ts#L61) — `goldText(\`×${multiplier.toFixed(1)}\`, { fontSize: 36, withShadow: true })`
2. 確認 [BattleScreen.ts:1971](src/screens/BattleScreen.ts#L1971) + 1981 兩個 call site 仍傳 multiplier
3. 確認 streakMult 邏輯 (s13-fx-02) 不變

---

## 3. Task

### Single commit — Replace label text

`src/fx/StreakFlyText.ts` line 61：

當前：
```ts
const label = goldText(`×${multiplier.toFixed(1)}`, { fontSize: 36, withShadow: true });
```

改成：
```ts
// chore #212: was `×${multiplier.toFixed(1)}` (e.g. "×1.5") — owner wants explicit combo text
const label = goldText('Combo HIT!!', { fontSize: 32, withShadow: true });
```

> **fontSize 36 → 32**：因為 `Combo HIT!!` 字串長很多（11 字 vs `×1.5` 4 字），縮小避免 overflow reel zone 寬度。
>
> **保留**：`multiplier` 參數仍接收（call site 兩處都傳），只是 label 不顯示它。倍率本身仍 apply 在 coinA/coinB/dmgA/dmgB（[BattleScreen.ts:1963-1966](src/screens/BattleScreen.ts#L1963)），純視覺 swap。

#### Optional 字體 tweak（executor 視覺自由度）

如果 `Combo HIT!!` 在 GoldText gradient 看起來不夠 punchy，可考慮：
- letterSpacing: 1-2 加寬字距
- fontWeight 已是 GoldText 默認 900，不需改

但**禁止**動 anchor / x / y / scale 軌跡邏輯（Stage 1 pop-in / Stage 2 fly / Stage 3 absorb 三段時序）。

**Commit**: `tune(chore): streak fly text label '×N.N' → 'Combo HIT!!' (fontSize 36→32 to fit longer string)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/fx/StreakFlyText.ts` line 61（label text + fontSize）

**禁止**：
- 動 `playStreakFlyText` signature（multiplier 參數保留）
- 動 BattleScreen call site
- 動 streakMult 邏輯 / streak 累積條件
- 動 fly 軌跡 / Stage 1/2/3 timing
- 動 trail particle
- 動 GoldText / DesignTokens
- 改 SPEC.md

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "Combo HIT" src/fx/StreakFlyText.ts` — 應有 1 次
   - `grep "×\${multiplier" src/fx/StreakFlyText.ts` — 應為空（已 replace）
   - `grep "playStreakFlyText" src/screens/BattleScreen.ts` — call site 仍 2 處不動
5. **Preview 驗證**：
   - 進 BattleScreen，AUTO 25 spins 製造連勝
   - streak ≥ 2 時應看到金色「Combo HIT!!」從 reel 區飛到 wallet（取代之前 `×1.5` 字樣）
   - 三段動畫（pop / fly / absorb）正常
   - trail particle 仍噴
   - coin/dmg 倍率仍 apply（log 看 wallet 增量）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（Combo HIT!! 飛行中）
- spec deviations: 1 (label 從顯示倍率 → 顯示 generic combo text — owner-approved 2026-05-05)
- Process check：`git log --oneline origin/master | head -3` 確認 commit on master
