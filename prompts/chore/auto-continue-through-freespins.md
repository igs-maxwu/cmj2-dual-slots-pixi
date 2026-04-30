# Chore — AUTO 進 Free Spin 後繼續跑（移除 chore #162 over-aggressive stop）

## 1. Context

Owner 試玩 chore #173/174 後反映：開 AUTO 25 → 觸發 free spin → **AUTO 第 1 個 free spin 跑完就停**，要手動點 SPIN 才繼續。

**期望行為**（業界標準 slot AUTO）：
- AUTO 進 free spin → **繼續自動跑完所有 free spins** → 回到正常 AUTO 倒數

**當前行為**（chore #162 設計失誤）：
- AUTO 觸發 free spin → 立刻 stopAutoMode → counter 變 0 → 玩家手動接管

### Root cause

`BattleScreen.ts` line 1831（chore #162 加的）：
```ts
// Fresh trigger — this spin and next 4 are free + ×2
this.inFreeSpin = true;
this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
if (import.meta.env.DEV) console.log(`[FreeSpin] TRIGGERED — ${scatterThisSpin} scatters → 5 spins`);
// Stop AUTO on FreeSpin so player notices the event   ← 這是 over-engineered
if (this.autoSpinsRemaining > 0) this.stopAutoMode();   ← 移除這行
```

當時 chore #162 設計理由「let player notice the event」是錯的 — FreeSpinEntryCeremony (#159) 已經有 2.3s 全螢幕 fire-text 視覺，玩家不會錯過。**AUTO 應該透過 ceremony，不應該停**。

JP win 仍保留 stop（line 2492）— JP 是真正的 wow moment + 動畫長。

純機制行為修正 — 不動視覺 / 不動 free spin state 邏輯本身。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 移除一行 + comment 更新解釋

---

## 2. Spec drift check (P6)

1. `mempalace_search "AUTO chore 162 stop conditions FreeSpin JP match-end"`
2. 確認 chore #162 stop 3 處：FreeSpin trigger (line 1831) / JP win (line 2492) / match end (line 2162) / unmount (line 473)
3. 本 PR 只移除 line 1831 — 其他 3 處全保留

---

## 3. Task

### Single commit — Remove FreeSpin AUTO stop

`BattleScreen.ts` line 1825-1836（FreeSpin trigger 區段）：

當前：
```ts
if (!this.inFreeSpin) {
  // Fresh trigger — this spin and next 4 are free + ×2
  this.inFreeSpin = true;
  this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
  if (import.meta.env.DEV) console.log(`[FreeSpin] TRIGGERED — ${scatterThisSpin} scatters → 5 spins`);
  // Stop AUTO on FreeSpin so player notices the event
  if (this.autoSpinsRemaining > 0) this.stopAutoMode();
} else {
  // Retrigger during free spin — add 5 more, cap 50
  this.freeSpinsRemaining = Math.min(50, this.freeSpinsRemaining + BattleScreen.FREE_SPIN_COUNT);
  if (import.meta.env.DEV) console.log(`[FreeSpin] RETRIGGER — ${scatterThisSpin} scatters → +5 (now ${this.freeSpinsRemaining})`);
}
```

改成：
```ts
if (!this.inFreeSpin) {
  // Fresh trigger — this spin and next 4 are free + ×2
  this.inFreeSpin = true;
  this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
  if (import.meta.env.DEV) console.log(`[FreeSpin] TRIGGERED — ${scatterThisSpin} scatters → 5 spins`);
  // chore: do NOT stop AUTO on FreeSpin — entry ceremony (s13-fx-01) already provides 2.3s
  // visual notification; AUTO should auto-play through free spins (industry-standard behavior)
} else {
  // Retrigger during free spin — add 5 more, cap 50
  this.freeSpinsRemaining = Math.min(50, this.freeSpinsRemaining + BattleScreen.FREE_SPIN_COUNT);
  if (import.meta.env.DEV) console.log(`[FreeSpin] RETRIGGER — ${scatterThisSpin} scatters → +5 (now ${this.freeSpinsRemaining})`);
}
```

> 移除 1 行（stopAutoMode call）+ 改 comment 解釋為何不停。

### 驗證

`npm run build` + 試玩：
- 開 AUTO 25 → 進 free spin
- 觀察：FreeSpin entry ceremony 跑完 2.3s → AUTO 應**繼續自動 spin** → free spin 5 輪跑完
- AUTO counter 應**繼續減**（25 → 24 → 23 → ... → 不被 free spin reset）
- 跑完 free spins → 仍是 AUTO 模式 → 跟正常 AUTO 接續
- JP win 觸發時仍應停 AUTO（line 2492 不動）

**Commit**: `tune(chore): AUTO does not stop on FreeSpin entry — let auto-play through free spins (industry standard)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（line 1831 移除 + comment 更新）

**禁止**：
- 動 chore #162 其他 stop conditions（JP / match-end / unmount 全保留）
- 動 FreeSpin state（inFreeSpin / freeSpinsRemaining 邏輯不動）
- 動 chore #169 FreeSpinEntryCeremony / FreeSpinRetriggerCeremony
- 動 SlotEngine / SymbolsConfig / scatter logic
- 動 AUTO 其他邏輯（waitForSpinClick / setAutoSpins / popup）
- 改 SPEC.md / DesignTokens / sim-rtp.mjs / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 開 AUTO 25 → 跑到觸發 free spin（demo mode 第 5 spin）
   - FreeSpin entry ceremony 跑 2.3s
   - AUTO 應**繼續自動 spin**（不需手動點）
   - Free spin 5 輪自動跑完
   - 回到正常 mode 後 AUTO 仍在倒數（counter 正確扣）
   - 觸發 JP（demo mode 第 4 spin）→ AUTO 仍應停（chore #162 JP stop 不動）
5. 截圖 1 張：free spin 中（顯示 AUTO 仍在 STOP N 狀態）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（free spin 跑動 + AUTO 仍 active）
- AUTO 跑完所有 free spin 後 counter 是否正確（vs 觸發前的 N + free spin 數）
- JP win 仍正確停 AUTO？
- Spec deviations：1 行（chore #162 stop on FreeSpin 反向修正，owner trial driven）
