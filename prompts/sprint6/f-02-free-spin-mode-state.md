# Sprint 6 · f-02 — Free Spin mode state（`inFreeSpin` / `freeSpinsRemaining` / win ×2 multiplier）

## 1. Context

PR: **加 Free Spin 模式狀態機 — `inFreeSpin` 旗、`freeSpinsRemaining` 計數、win ×2 multiplier。本 PR 只做 state + multiplier wiring，trigger detection（≥3 scatter）留 f-03。**

Why: SPEC §15.7 M10 Free Spin「5 free spins, bet=0, win ×2」需要在 BattleScreen.loop() 內掛 state machine。f-01 已 merge（PR #121），Scatter symbol 已存在於 pool。本 PR 把 mode 機制做出來，f-03 再接觸發條件。

設計（f-01 sim flag 修正 + 共享 grid 處理）：
- **Scatter weight 2→4**（preflight）：f-01 sim 量到 `per_match_estimate=0.043`，遠低於 SPEC 目標 0.15-0.30。executor 數學分析 weight=4 → 0.21/match 命中目標。本 PR 順手 1 字符改動。
- **共享狀態**：5×3 grid 共享，所以 free spin 是**雙方同時進入**（不是各自獨立）。`inFreeSpin: boolean` + `freeSpinsRemaining: number` 單一狀態。
- **bet=0**：free spin 期間雙方都不扣 bet（既不扣 walletA 也不扣 walletB）。對手照常 spin，照常造成傷害（SPEC：「對手照常 spin，仍可造成傷害」）。
- **×2 multiplier**：在 Streak 之後、wallet credit 之前，對 `coinA / coinB / dmgA / dmgB` 各 ×2。
- **計數**：每回合**末尾** `freeSpinsRemaining--`；歸 0 時 `inFreeSpin=false`。
- **DEV 手動觸發**：`import.meta.env.DEV` gate 鍵盤 'F' 進入 free spin（測試用，f-03 接真正觸發後可保留也可拿掉）。

Source:
- SPEC §15.7 M10 Free Spin
- BattleScreen.loop() 既有 Streak/Wallet/Phoenix 順序（line 655-720）
- Resonance/Curse stack 是同 pattern（state field + loop 整合）

Base: master HEAD（PR #121 f-01 merged 2026-04-27）
Target: `feat/sprint6-f-02-free-spin-mode`

## 2. Spec drift check (P6)

1. `mempalace_search "Free Spin M10 win multiplier 5 spins bet zero"`
2. 確認 BattleScreen.ts 有 `loop()` method 且有 Streak block 在 line ~655
3. 確認 SYMBOLS[10] 是 Scatter（f-01 已加），weight 目前是 2
4. 確認沒有其他 PR 已 merge 過 `inFreeSpin` field（防重複）

## 3. Task

### 3a. Preflight — Scatter weight 2→4

`src/config/SymbolsConfig.ts` SYMBOLS[10]：

```ts
{ id:10, name:'Scatter', shape:'scatter', color:0xff3b6b, weight:4,    // 2 → 4 (f-01 sim 修正)
  spiritKey:'scatter', spiritName:'靈脈晶', clan:'azure', isScatter:true },
```

理由：f-01 sim 量到 `per_match_estimate=0.043` < SPEC 目標 0.15-0.30。weight=4 → ~0.21/match 命中目標。

### 3b. BattleScreen 加 fields

在 class fields 區（curseStackA/B 附近）：

```ts
// ── M10 Free Spin state (shared — both sides enter together via shared 5×3 grid) ──
private inFreeSpin = false;
private freeSpinsRemaining = 0;
private static readonly FREE_SPIN_COUNT = 5;
private static readonly FREE_SPIN_WIN_MULT = 2;
```

### 3c. loop() 整合 — bet=0、×2、decrement

**A. bet 扣款處（line ~661）**：

```ts
// 既有：
// this.walletA = this.walletA - this.cfg.betA + coinA;
// this.walletB = this.walletB - this.cfg.betB + coinB;

// 改為：
const betA = this.inFreeSpin ? 0 : this.cfg.betA;
const betB = this.inFreeSpin ? 0 : this.cfg.betB;
this.walletA = this.walletA - betA + coinA;
this.walletB = this.walletB - betB + coinB;
```

**B. ×2 multiplier 應用點**：在 **Streak 計算之後、wallet 扣款之前**（即 line 657-660 之後、661 之前）插入：

```ts
// ── M10 Free Spin: ×2 win multiplier (after Streak, before wallet credit) ──
if (this.inFreeSpin) {
  coinA = Math.floor(coinA * BattleScreen.FREE_SPIN_WIN_MULT);
  coinB = Math.floor(coinB * BattleScreen.FREE_SPIN_WIN_MULT);
  if (dmgA > 0) dmgA = Math.floor(dmgA * BattleScreen.FREE_SPIN_WIN_MULT);
  if (dmgB > 0) dmgB = Math.floor(dmgB * BattleScreen.FREE_SPIN_WIN_MULT);
}
```

**C. Free spin decrement**：在 loop() 回合末尾（HP tween 之後、while 迴圈下次 iteration 之前）加：

```ts
// ── M10 Free Spin decrement at round end ──
if (this.inFreeSpin) {
  this.freeSpinsRemaining--;
  if (this.freeSpinsRemaining <= 0) {
    this.inFreeSpin = false;
    this.freeSpinsRemaining = 0;
    if (import.meta.env.DEV) console.log('[FreeSpin] mode ended');
  }
}
```

選一個明確錨點：在 `await Promise.all(fx);`（line ~725）之後、Curse proc block（line ~727）之前；或者最後 HP tween 之後。**請放在迴圈 body 最末尾**（即 while 主體最後一行），確保 Curse / Phoenix 等所有效果結算完畢才減。

### 3d. DEV 手動觸發（測試用）

在 onMount 末尾加：

```ts
if (import.meta.env.DEV) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'f' || e.key === 'F') {
      this.inFreeSpin = true;
      this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
      console.log('[FreeSpin] DEV manual trigger — 5 spins, ×2 multiplier');
    }
  };
  window.addEventListener('keydown', onKey);
  this._devKeyHandler = onKey;
}
```

class field：
```ts
private _devKeyHandler?: (e: KeyboardEvent) => void;
```

onUnmount 清理：
```ts
if (this._devKeyHandler) {
  window.removeEventListener('keydown', this._devKeyHandler);
  this._devKeyHandler = undefined;
}
```

### 3e. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（1 字符 weight 2→4）
- `src/screens/BattleScreen.ts`（fields + loop 三段插入 + DEV keypress）

**禁止**：
- SlotEngine / DamageDistributor / Resonance / Curse 系統
- DraftScreen / LoadingScreen
- scripts/sim-rtp.mjs（free spin sim 是 f-05 工作）
- HUD / overlay banner（f-04 工作）
- f-03 觸發邏輯（≥3 scatter 計數，本 PR 不做）
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL
4. **Preview 驗證（DEV manual trigger）**：
   - 進 Battle，按 'F' 鍵，看 console 有 `[FreeSpin] DEV manual trigger`
   - 接下來 5 spins：
     - wallet 不扣 bet（觀察 walletA / walletB 不下降，只增不減）
     - 任何 win 數值看起來像 ×2（與平常比較）
   - 第 5 spin 結束後 console `[FreeSpin] mode ended`，後續 spin 恢復扣 bet
5. **Sim sanity（不需新統計，只需確認 RTP 沒爆）**：
   - `npm run sim` 跑 10k × 50，coin_rtp 應該與 PR #121（107.6%）相差 ≤ 1%
   - 因為本 PR 沒 trigger 觸發，free spin 永遠不會被 sim 跑到，所以 RTP 不應變
   - 若 RTP 大幅偏移，flag — 表示無觸發狀況下意外影響到 base game

## 5. Handoff

- PR URL
- 1 行摘要
- DEV 'F' 鍵手動觸發是否實測成功（一句話即可）
- coin_rtp 是否與 PR #121 一致（差距 < 1%）
- Spec deviations：預期 0
- 若 free spin decrement 放置點選擇與 §3c 描述不同，flag 並說理由
