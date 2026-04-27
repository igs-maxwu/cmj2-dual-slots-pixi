# Sprint 8 · p-02 — Demo mode（`?demo=1` URL param + 腳本化 spin sequence 保證 5 種 ceremony / FX capture）

## 1. Context

PR: **`?demo=1` URL param 啟用 demo mode：BattleScreen 用預定義的 grid sequence 取代隨機 spin，保證 capture 到 NearWin → BigWin → MegaWin → JP → FreeSpin 各 1 次（順序固定）。**

Why: Sprint 8 hype video (p-04) + pptx (p-03) + 一頁式 (p-05) 都需要**確定可重現**的高光時刻截圖。一般 sim 機率：JP 0.00024/match → 想截 JP ceremony 截圖要等 4000+ spins，靠運氣不可行。Demo mode 解：用 scripted grid 餵給 reel，畫面跑出來跟正常 spin 沒差別（玩家視角無感），但**保證每個 ceremony 都跑得到**。

設計：
- URL: `https://igs-maxwu.github.io/cmj2-dual-slots-pixi/?demo=1`（GitHub Pages 直接吃 query param）
- 在 main.ts 或 BattleScreen.onMount 解析 `URLSearchParams`，set `this.demoMode = true`
- 加 `private demoSpinSequence: number[][][]` — 預定義 5 個 grid，按順序餵
- 改 loop() 內 `this.engine.spin(...)` 呼叫：if `demoMode`，直接用 sequence[index++] 取代真實 spin grid（**注意**：仍要算 wayHits / coinWon — 用既有 SlotEngine 評估，只 override grid）
- 每場跑完 5 spin（NearWin / BigWin / MegaWin / JP / FreeSpin），第 6 spin 起 fallback 真實 spin
- DEV / 正式 build 都生效（不靠 import.meta.env.DEV，因為 GitHub Pages 是 prod build）

設計原則：
1. **不污染 prod 路徑**：default `?demo=0` 或無 param = 一切照舊
2. **顯式 opt-in**：URL param + 進 Battle 後 console log `[Demo] mode active, spin 1/5: NEAR_WIN`
3. **可重現**：seed 不變，跑 demo mode 兩次得到視覺一樣的順序
4. **Capture-friendly**：每個 ceremony 完整播放結束才接下一 spin（既有 await playJackpotCeremony / playBigWinCeremony 已是這樣）

---

## Skills suggested for this PR

- **`incremental-implementation`** — 一個 PR 但分 2 commit：(1) URL param 解析 + demoMode field + scripted grid array，(2) loop() 整合 + spin override。每個 commit build 過 + console log 驗證。
- **`source-driven-development`** — `URLSearchParams` Web API 對照 MDN docs；確認 GitHub Pages 確實 propagate query string（沒有 SSR rewrite 吃掉）。
- **`frontend-ui-engineering`** — demoMode 不該動既有 UI elements / FX 觸發路徑。**只攔截 grid 來源、其他全部走正常 pipeline**。

---

## 2. Spec drift check (P6)

1. `mempalace_search "demo mode URL param scripted spin capture p-02"`
2. 確認 SlotEngine.spin() 接收 grid input vs internally 生成 — 看是否能 override
3. 確認 BattleScreen.loop() line ~570 spin() call 結構
4. 確認 GitHub Pages base URL 設定（vite.config.ts base="/cmj2-dual-slots-pixi/"）— query string 不受 base 影響

## 3. Task

### 3a. SlotEngine — 加 grid override 路徑

**先檢查** `src/systems/SlotEngine.ts` 既有 `spin(...)` API。若 spin 方法**內部生成 grid 然後評估**（典型作法），需新增 `evaluateGrid(grid, selectedA, selectedB, ...)` 函式或讓 spin 接受 optional `forcedGrid` 參數。

**最小改動方案**（推薦）：在 `SlotEngine` 新增**靜態** helper：

```ts
/**
 * p-02: Re-run scoring on a forced grid (demo mode path).
 * Same evaluation logic as spin() but skips RNG + uses caller-provided grid.
 */
static evaluateForcedGrid(
  grid: number[][],
  selectedA: number[], selectedB: number[],
  betA: number, betB: number,
  coinScaleA: number, dmgScaleA: number,
  coinScaleB: number, dmgScaleB: number,
  fairnessExp: number,
): SpinResult {
  // Reuse internal _evalSide() logic on grid
  // Return same shape as spin()
}
```

**Implementation note**：若既有 `spin()` 內部把 grid 生成邏輯跟 evaluation 寫死在一起，本 PR 需 refactor 抽出 grid generation。**這是最大不確定點 — executor 探勘 SlotEngine 後再決定**：
- 若分離容易：extract → 加 evaluateForcedGrid
- 若耦合嚴重：spin() 加 optional `forcedGrid?: number[][]` 第一個參數

### 3b. BattleScreen — demoMode field + URL param 解析

**class field**（near line ~80 region）：

```ts
/** p-02: demo mode for capture — scripted spin sequence */
private demoMode = false;
private demoSpinIndex = 0;
private static readonly DEMO_SPIN_COUNT = 5;
```

**onMount 開頭** 加：

```ts
const params = new URLSearchParams(window.location.search);
this.demoMode = params.get('demo') === '1';
if (this.demoMode && import.meta.env.DEV) {
  console.log('[Demo] mode active — scripted 5-spin capture sequence');
}
```

### 3c. BattleScreen — scripted grid sequence 定義

加 class 常數：

```ts
/**
 * p-02: 5 scripted grids for demo capture, in order:
 *   spin 0: NearWin (4-of-5 reels with same symbol id 0)
 *   spin 1: BigWin (force ~30x bet payout — 4-of-a-kind way)
 *   spin 2: MegaWin (force ~120x bet payout — 5-of-a-kind way)
 *   spin 3: JP (force 5-of-a-kind JP id 11)
 *   spin 4: FreeSpin (force 3+ scatter id 10 → enters free spin mode)
 *
 * Each grid is 3 rows × 5 cols. Symbol IDs:
 *   0-7: spirits / 8: Wild / 9: Curse / 10: Scatter / 11: Jackpot
 */
private static readonly DEMO_GRIDS: number[][][] = [
  // Spin 0: NearWin — symbol 0 in cols 0,1,2,4 (col 3 missing → near-win 5-of-5)
  [[0, 0, 0, 5, 0],
   [3, 1, 7, 6, 0],
   [0, 4, 0, 2, 0]],

  // Spin 1: BigWin — symbol 1 in all 5 cols (5-of-a-kind way ~10-30x payout)
  [[1, 1, 1, 1, 1],
   [3, 4, 5, 6, 7],
   [2, 0, 0, 0, 0]],

  // Spin 2: MegaWin — symbol 0 + Wild (id 8) in 5-of-a-kind way + ×2 multiplier
  [[0, 8, 0, 0, 0],
   [3, 4, 5, 6, 7],
   [2, 1, 1, 1, 1]],

  // Spin 3: JP — symbol 11 (Jackpot) in all 5 cols (5-of-a-kind triggers JP draw)
  [[11, 11, 11, 11, 11],
   [3,  4,  5,  6,  7],
   [2,  0,  1,  6,  3]],

  // Spin 4: FreeSpin — 3+ scatter (id 10) triggers entry, then ×2 multiplier visible
  [[10, 3, 10, 6, 10],
   [4,  5, 7,  1, 2],
   [3,  6, 4,  2, 5]],
];
```

**注意**：`DEMO_GRIDS[1]` 跟 `DEMO_GRIDS[2]` 的 BigWin / MegaWin 預期 payout 需要 sim 一遍確認（依 streakMult / dmgScale / coinScale 而定），若 spin 1 跑出來 < 25× bet 沒觸發 BigWin overlay，需微調 grid（更多匹配 cell / 調 row 配置）。**executor 跑時若沒觸發到，自己微調 grid 直到對應 ceremony 確實 fire**。

### 3d. BattleScreen — loop() 內接 demo override

在既有 `const spin = this.engine.spin(...)` 呼叫位置改：

```ts
let spin: SpinResult;
if (this.demoMode && this.demoSpinIndex < BattleScreen.DEMO_SPIN_COUNT) {
  // p-02: forced grid path
  const forcedGrid = BattleScreen.DEMO_GRIDS[this.demoSpinIndex];
  spin = SlotEngine.evaluateForcedGrid(
    forcedGrid,
    this.cfg.selectedA, this.cfg.selectedB,
    this.cfg.betA, this.cfg.betB,
    this.cfg.coinScaleA, this.cfg.dmgScaleA,
    this.cfg.coinScaleB, this.cfg.dmgScaleB,
    this.cfg.fairnessExp,
  );
  if (import.meta.env.DEV) {
    const labels = ['NEAR_WIN', 'BIG_WIN', 'MEGA_WIN', 'JACKPOT', 'FREE_SPIN'];
    console.log(`[Demo] spin ${this.demoSpinIndex + 1}/5: ${labels[this.demoSpinIndex]}`);
  }
  this.demoSpinIndex++;
} else {
  // Regular RNG path
  spin = this.engine.spin(
    pool,
    this.cfg.selectedA, this.cfg.selectedB,
    this.cfg.betA, this.cfg.betB,
    this.cfg.coinScaleA, this.cfg.dmgScaleA,
    this.cfg.coinScaleB, this.cfg.dmgScaleB,
    this.cfg.fairnessExp,
  );
}
```

### 3e. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（+demoMode field + DEMO_GRIDS const + onMount param parse + loop() override block）
- `src/systems/SlotEngine.ts`（+evaluateForcedGrid static method 或 spin signature 加 forcedGrid optional 參數）

**禁止**：
- DamageDistributor / JackpotPool / FreeSpin 邏輯（demo 用既有 ceremony 觸發路徑，**不繞過任何**）
- DraftScreen / LoadingScreen
- main.ts（demoMode 解析放 BattleScreen，**不污染 main.ts**）
- DesignTokens / GemMapping / SymbolsConfig
- scripts/sim-rtp.mjs（demo 是 runtime feature，不影響 sim）
- SPEC.md
- 加新 asset

## 4. DoD

1. `npm run build` 過
2. **2 個 commit**（per `incremental-implementation`）
3. push + PR URL
4. **Preview 驗證（local + GitHub Pages 兩處皆要驗）**：
   - **Local**：`npm run dev` 起來，瀏覽器 `localhost:5173/?demo=1` 進 BattleScreen，console 應印出 5 行 `[Demo] spin N/5: XXX`
   - **GitHub Pages**：merge 後等 deploy，瀏覽器 `https://igs-maxwu.github.io/cmj2-dual-slots-pixi/?demo=1`
   - 看到 5 個 ceremony 各 1 次：NearWin teaser → BigWin overlay → MegaWin overlay → JP ceremony → FreeSpin entry banner + ×2 multiplier
   - 第 6 spin 起回到 RNG（觀察與 demo grid 不同）
   - 不帶 `?demo=1` 開（GitHub Pages 主路徑）一切正常 RNG，無任何 demo log
5. **截圖 / 影片**（給 p-03 / p-04 用）：
   - 5 個 ceremony 各 1 張截圖（最佳時機 mid-FX）
   - **可選**：用 OBS 或瀏覽器 Performance recorder 錄一段 demo mode 跑 5 spin 的影片（給 p-04 hype video 後製用）

## 5. Handoff

- PR URL
- 1 行摘要
- demo mode 是否實測 5 個 ceremony 全部觸發到（一句話）
- 哪幾個 grid 需要微調過才觸發到對應 ceremony（incremental-implementation skill — sim verify 邏輯）
- 5 張 ceremony 截圖路徑（gist link 或 commit attached）
- GitHub Pages 是否 deploy 後 `?demo=1` 也正常觸發（non-DEV build 要驗）
- Spec deviations：預期 0
