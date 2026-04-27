# Sprint 6 · f-03 — Free Spin trigger detection（≥3 scatter → 進入 Free Spin mode）

## 1. Context

PR: **每 spin 計算 scatter cells；≥3 時設 `inFreeSpin=true` + `freeSpinsRemaining=5`。Retrigger 期間若再觸發，再加 5 spins（cap 50 防失控）。sim 同步加觸發統計。**

Why: f-01 已加 Scatter symbol（id:10, weight:4）、f-02 已加 mode state machine + ×2 multiplier。本 PR 把「≥3 scatter → 進入 mode」這條觸發路徑接通。SPEC §15.7「3+ scatters same spin」+ ROADMAP「Target freq: ~1 per 5 matches」。

設計：
- **計數位置**：BattleScreen.loop() 既有 Curse cell counting block（line ~580-600）正上方/正下方；同樣 `for (let r=0; r<3; r++) for (let c=0; c<5; c++)` pattern。
- **觸發判定**：`scatterThisSpin >= 3` → 若**未**在 free spin，設 `inFreeSpin=true, freeSpinsRemaining=5`，console log，可選 SFX；若**已**在 free spin（retrigger），`freeSpinsRemaining = Math.min(50, freeSpinsRemaining + 5)`，console log retrigger。
- **時序**：應在**本回合 ×2 multiplier 應用之前**觸發 — 即觸發當回合就吃 ×2（標準 slot 行為）。所以 trigger detection 要在 loop() Streak block 之前、coinA/dmgA 計算之後。
- **sim 同步**：sim-rtp.mjs 既有 scatter counting（f-01 加的），擴充成完整 free spin simulation：state field → 觸發 → bet=0 → win ×2 → decrement → retrigger 計數。新增三個 metric：`free_spin_triggers`、`free_spin_retriggers`、`free_spin_pct_of_total_coin`。
- **音效（選配）**：若 `AudioManager.playSfx('big-win')` 之類已存在，可加；否則跳過（f-04 UI banner 會配音）。

Source:
- SPEC §15.7 M10 Free Spin
- f-02 PR #122 加的 `inFreeSpin / freeSpinsRemaining / FREE_SPIN_COUNT / FREE_SPIN_WIN_MULT`
- BattleScreen.loop() 既有 Curse cell counting pattern（line ~580）

Base: master HEAD（f-02 PR #122 merged 2026-04-27）
Target: `feat/sprint6-f-03-trigger`

## 2. Spec drift check (P6)

1. `mempalace_search "Free Spin trigger 3 scatter retrigger M10"`
2. 確認 BattleScreen.ts 有 `inFreeSpin`、`freeSpinsRemaining`、`FREE_SPIN_COUNT`（f-02 加的）
3. 確認 SYMBOLS[10].isScatter === true 且 weight=4
4. 確認 sim-rtp.mjs 既有 scatter counting block（f-01 加的）

## 3. Task

### 3a. BattleScreen — 觸發檢測

在 loop() 既有 Curse counting block 之後（line ~600）、Resonance 之前（line ~620），新增 scatter counting + trigger：

```ts
// ── M10 Free Spin trigger: ≥3 scatter cells on shared 5×3 grid ──
const SCATTER_ID = SYMBOLS.findIndex(s => s.isScatter);
if (SCATTER_ID >= 0) {
  let scatterThisSpin = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      if (spin.grid[r][c] === SCATTER_ID) scatterThisSpin++;
    }
  }
  if (scatterThisSpin >= 3) {
    if (!this.inFreeSpin) {
      // Fresh trigger
      this.inFreeSpin = true;
      this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
      if (import.meta.env.DEV) console.log(`[FreeSpin] TRIGGERED — ${scatterThisSpin} scatters → 5 spins`);
    } else {
      // Retrigger — add 5 more, cap 50
      this.freeSpinsRemaining = Math.min(50, this.freeSpinsRemaining + BattleScreen.FREE_SPIN_COUNT);
      if (import.meta.env.DEV) console.log(`[FreeSpin] RETRIGGER — ${scatterThisSpin} scatters → +5 (now ${this.freeSpinsRemaining})`);
    }
  }
}
```

**注意**：放在 Curse counting block 後、Resonance 前，使**觸發當回合就吃 ×2**（×2 應用點在 Streak 之後，遠晚於此 trigger 點）。

### 3b. BattleScreen — DEV keypress 保留或移除

f-02 加的 'F' 鍵 DEV manual trigger 可**保留**（雙重入口方便測試），不必移除。

### 3c. sim-rtp.mjs — Free Spin simulation

f-01 已加 `totalScatterCells`、`scatterTriggerCount`、`scatter` output block。本 PR 擴充成完整 free spin sim：

加 sim state（per-run，每個 run 獨立）：

```ts
let inFreeSpin = false;
let freeSpinsRemaining = 0;
let freeSpinTriggerCount = 0;
let freeSpinRetriggerCount = 0;
let freeSpinCoinTotal = 0;     // coin won during free spin (raw, pre-multiplier)
let freeSpinCoinX2Bonus = 0;   // extra coin from ×2 multiplier
const FREE_SPIN_COUNT = 5;
const FREE_SPIN_WIN_MULT = 2;
const FREE_SPIN_CAP = 50;
```

per-spin 邏輯（在既有 spin loop 內）：

```ts
// Trigger detection (same logic as BattleScreen)
let scatterThisSpin = 0;
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 5; c++) {
    if (spin.grid[r][c] === SCATTER_ID) scatterThisSpin++;
  }
}
if (scatterThisSpin >= 3) {
  if (!inFreeSpin) {
    inFreeSpin = true;
    freeSpinsRemaining = FREE_SPIN_COUNT;
    freeSpinTriggerCount++;
  } else {
    freeSpinsRemaining = Math.min(FREE_SPIN_CAP, freeSpinsRemaining + FREE_SPIN_COUNT);
    freeSpinRetriggerCount++;
  }
}

// Apply ×2 to coin/dmg if in free spin
let coinThisSpinA = spin.sideA.coinWon;
let coinThisSpinB = spin.sideB.coinWon;
let dmgThisSpinA = spin.sideA.dmgDealt;
let dmgThisSpinB = spin.sideB.dmgDealt;
if (inFreeSpin) {
  freeSpinCoinTotal += coinThisSpinA + coinThisSpinB;
  freeSpinCoinX2Bonus += coinThisSpinA + coinThisSpinB; // x2 means +1× extra
  coinThisSpinA *= FREE_SPIN_WIN_MULT;
  coinThisSpinB *= FREE_SPIN_WIN_MULT;
  dmgThisSpinA *= FREE_SPIN_WIN_MULT;
  dmgThisSpinB *= FREE_SPIN_WIN_MULT;
}

// Bet handling: 0 during free spin
const betThisSpinA = inFreeSpin ? 0 : BET;
const betThisSpinB = inFreeSpin ? 0 : BET;

// Update RTP totals using above (replace existing accumulators if needed)
totalCoinIn  += betThisSpinA + betThisSpinB;
totalCoinOut += coinThisSpinA + coinThisSpinB;
// ... same for dmg if separately tracked

// Decrement at spin end
if (inFreeSpin) {
  freeSpinsRemaining--;
  if (freeSpinsRemaining <= 0) {
    inFreeSpin = false;
    freeSpinsRemaining = 0;
  }
}
```

**注意**：sim 既有的 RTP / coin accumulator 變數名請依照現有檔案調整（不要硬套上面的 `totalCoinIn` 等 — 用現存的 var）。

新增 output：

```ts
free_spin: {
  triggers: freeSpinTriggerCount,
  retriggers: freeSpinRetriggerCount,
  trigger_rate_per_spin: freeSpinTriggerCount / ROUNDS,
  trigger_rate_per_match: freeSpinTriggerCount / totalMatches,    // ← key SPEC metric ~0.2
  coin_in_freespin: freeSpinCoinTotal,
  coin_x2_bonus: freeSpinCoinX2Bonus,
  pct_of_total_coin_from_freespin: (freeSpinCoinTotal + freeSpinCoinX2Bonus) / totalCoinOut,
}
```

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（+~20 行 trigger detection block）
- `scripts/sim-rtp.mjs`（+free spin sim state + per-spin logic + output block）

**禁止**：
- SymbolsConfig（不再動 weight）
- SlotEngine / DamageDistributor / Resonance / Curse / Wild
- DraftScreen / LoadingScreen / GemMapping
- HUD / overlay banner（f-04 工作）
- AudioManager 改動（若想加 SFX，使用既有 playSfx，不新加 SFX 檔）
- SPEC.md
- 改 f-02 既有 DEV 'F' keypress（保留）

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON
4. **Sim 數字**：
   - `free_spin.trigger_rate_per_match`（期望 0.15-0.30，SPEC 目標）
   - `free_spin.triggers`（期望 ~ROUNDS × 0.025，weight=4 對應頻率）
   - `free_spin.retriggers`（期望比 triggers 少 1-2 個 order，confirm 不過多）
   - `free_spin.pct_of_total_coin_from_freespin`（期望 ~10-25%，視 RTP 影響）
   - `coin_rtp`（free spin 開始貢獻 — 期望比 #122 的 106.75% **上升** ~5-15pp，因 ×2 + bet=0 雙重加 RTP）
5. **Preview 驗證（自然觸發）**：
   - 進 Battle，跑 ~30-50 spins（看 marquee 動態），看是否自然出現 console `[FreeSpin] TRIGGERED — N scatters → 5 spins`
   - 觸發後 wallet 不扣 bet，win 變大 → 5 spins 後 console `[FreeSpin] mode ended`
   - 若耐心不夠湊不到自然觸發，按 'F' 鍵走 DEV 觸發路徑也接受

## 5. Handoff

- PR URL
- 1 行摘要
- 5 數字（trigger_rate_per_match / triggers / retriggers / pct_of_total_coin_from_freespin / coin_rtp）+ 是否落 SPEC 目標
- 自然觸發是否實測到（一句話）
- coin_rtp 若 >130%，flag — 表示 ×2 + bet=0 對 RTP 推太多，可能需 f-05 重新平衡 dmgScale/coinScale
- Spec deviations：預期 0
