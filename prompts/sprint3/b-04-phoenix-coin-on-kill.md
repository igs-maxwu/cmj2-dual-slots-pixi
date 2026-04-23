# Sprint 3 B · 04 — Vermilion Phoenix passive: coin-on-kill

## 1. Context

PR: **Sprint 3 B · 朱雀 passive · phoenix-clan alive on attacker side grants coin bonus per enemy unit killed this spin**

Why: SPEC §8 「phoenix coin-on-kill」。當**攻擊方**陣中有朱雀系雀靈（Zhuluan 朱鸞 id:1 OR Lingyu 凌羽 id:6，`clan === 'vermilion'`）活著，且該 spin 的傷害在對方陣中**擊殺了 N 隻 unit**（`DmgEvent.died === true`）時，攻擊方 wallet 額外獲得 `N × 500 × (bet / 100)` coin。

設計理由：固定 500 × bet 比例（對齊 §15 M6 Curse 的 500 HP flat damage 設計語感），比起比例公式對 F2P 玩家更易理解；每擊殺獨立累加，鼓勵連殺節奏。朱雀系 2 隻 drafted 時生效更頻繁符合「草藥/復燃」主題。

Source:
- SPEC §8 spirit passives
- SPEC §4 clan groupings：朱雀 = `'vermilion'` clan（id:1 朱鸞 + id:6 凌羽）
- PR #51 b-01 確立的 `hasAliveOfClan` helper（Formation.ts）— 本 PR 要用
- PR #55 b-03 確立的 BattleScreen.loop() post-engine 後處理位置 pattern
- `DmgEvent.died: boolean` 已存在於 `src/systems/DamageDistributor.ts` 第 9 行

Base: `master` (HEAD `c99e543`，b-01 + b-03 已合併；b-02 玄武仍待合併，與本 PR 檔案無重疊)
Target: `feat/sprint3b-phoenix-coin-on-kill`

**⚠️ 本 PR 可與 b-02 並行**（b-02 改 Formation.ts + DamageDistributor.ts；本 PR 改 BattleScreen.ts）。若 b-02 先合併，rebase 應無事。

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "Sprint 3 spirit passive phoenix vermilion coin kill"` + `"SPEC §8 spirit passives"` + `"DmgEvent died flag"`.

Known facts to verify:
- 朱雀 clan 字串 `'vermilion'`（非 `'red'`、非 `'phoenix'`）
- 朱雀 spirits：id:1 朱鸞 (zhuluan) + id:6 凌羽 (lingyu)
- `DmgEvent { slotIndex, damageTaken, died }` 已定義，`died` = `u.hp <= 0` 的結果
- `distributeDamage` 在 BattleScreen.ts 第 612–613 行呼叫；`eventsOnB` / `eventsOnA` 分別代表 A 打 B 與 B 打 A 的擊殺結果
- Wallet cascade 在 spin result 時已執行一次（line 552–555），本 PR 的 coin bonus 需在 events 產生後**再加一次**並重新 cascade（或在 cascade 之前延後加）

## 3. Task

### 3a. `src/screens/BattleScreen.ts` — loop() 內 post-distributeDamage 階段

在 `distributeDamage` 回傳 `eventsOnB` / `eventsOnA` 之後（約 line 613 之後），新增一段朱雀 coin-on-kill 後處理：

```ts
// ── Vermilion Phoenix passive: +500 coin per enemy kill when own side has alive phoenix ──
const PHOENIX_COIN_PER_KILL = 500;
if (hasAliveOfClan(this.formationA, 'vermilion')) {
  const killsByA = eventsOnB.filter(e => e.died).length;
  if (killsByA > 0) {
    const bonus = killsByA * PHOENIX_COIN_PER_KILL * (this.cfg.betA / 100);
    this.walletA += bonus;
    this.cascadeWallet('A');
  }
}
if (hasAliveOfClan(this.formationB, 'vermilion')) {
  const killsByB = eventsOnA.filter(e => e.died).length;
  if (killsByB > 0) {
    const bonus = killsByB * PHOENIX_COIN_PER_KILL * (this.cfg.betB / 100);
    this.walletB += bonus;
    this.cascadeWallet('B');
  }
}
```

**放置位置**：line 613 的 `const eventsOnA = ...` 之後、line 615 的 `const newHpA = teamHpTotal(...)` 之前。

**注意**：
- `cascadeWallet(side)` 會自動 tween 到新 wallet 數字；呼叫兩次沒問題（第一次是 spin 贏的基本 coin，第二次疊 kill bonus），UX 看起來是 wallet 連漲兩次，符合「主動擊殺再爆幣」體感
- 不動 SlotEngine.ts（純算法層）
- 不動 DamageDistributor.ts（b-02 改，本 PR 不重疊）
- 不動 `spin.sideA.coinWon` / `spin.sideB.coinWon`（保留 SlotEngine 輸出乾淨）

### 3b. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts`（loop() 內約 +17 行，含兩個 if 區塊 + 常數）

**新 import**：已有 `hasAliveOfClan`（b-03 已加），無需重複 import

**禁止**：
- SlotEngine.ts
- Formation.ts（b-02 會動）
- DamageDistributor.ts（b-02 會動）
- SPEC.md
- SymbolsConfig.ts / DesignTokens.ts
- 調整 `PHOENIX_COIN_PER_KILL = 500` 以外的參數

**若發現其他檔案 bug，STOP 回報，不要自己改**（Executor Rule P2 明令）。

### 3c. 視覺回饋（選配）

若時間允許，擊殺當下可播 `AudioManager.playSfx('win-big')` 或在被擊殺 unit 位置飄一個 `+500` 金色 popup。**非必要**，若超過 10 行請跳過，留給後續 polish PR。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- Bonus 公式必須是 `kills × 500 × (bet / 100)`，不是 `× 500` 也不是 `× coinScale`
- 只在 `hasAliveOfClan(attackerFormation, 'vermilion')` 為 true 時觸發（朱雀死光則不生效）
- 用 `eventsOnB.filter(e => e.died).length` 計算 A 方擊殺數，不是 `eventsOnB.length`（非致命傷害不算）
- Cascade 呼叫兩次（一次 spin base、一次 kill bonus）是預期行為，不要嘗試合併
- `BattleScreen.ts` 編輯 ≥ 3 次未收斂 → STOP 回報

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：預期 0
- Dependencies：b-01 `hasAliveOfClan` helper、b-03 不衝突（同一檔案 BattleScreen.ts 但不同區塊）
- 與 b-02 無檔案衝突（若 b-02 已合併則 rebase 應無事）
- 是否有做 §3c 視覺回饋
- 確認 damage 順序無動：dragon → underdog → floor → distribute → **phoenix bonus (new)** → HP tween
