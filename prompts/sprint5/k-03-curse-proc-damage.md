# Sprint 5 · k-03 — Curse 3-stack 500 HP Proc

## 1. Context

PR: **當 curseStack ≥ 3 時觸發 500 HP flat 傷害到 opponent，stack 歸零**

Why: k-02 已做 stack 累加，k-03 把 stack 變成傷害。SPEC §15.6 「At 3 stacks: opponent takes flat 500 HP, stacks reset to 0」。

時機（簡化版）：每回合 spin + dmg 結束後，檢查 stacks，若 ≥3 立刻 proc → distribute 500 HP 到該側 formation → stack 歸零。

Source:
- PR #113 k-02 stack tracking
- `src/screens/BattleScreen.ts` loop() 後段
- `src/systems/DamageDistributor.ts` `distributeDamage()` 直接 reuse
- `scripts/sim-rtp.mjs` 同步 mirror

Base: master HEAD（k-02 merged）
Target: `feat/sprint5-k-03-curse-proc`

## 2. Spec drift check (P6)

1. `mempalace_search "Curse 500 HP proc M6 SPEC §15.6"`
2. 確認 BattleScreen 有 `curseStackA/B` fields（k-02 加的）
3. 確認 distributeDamage(formation, totalDmg, attackerSide) 簽章

## 3. Task

### 3a. BattleScreen loop() 加 proc block

在 loop() 內，**playDamageEvents 後**、**round end / cascade 之前**插：

```ts
// ── M6 Curse proc: 3+ stack → 500 HP flat damage to that side ──
const CURSE_PROC_DMG = 500;
let curseEventsOnA: DmgEvent[] = [];
let curseEventsOnB: DmgEvent[] = [];

if (this.curseStackA >= 3) {
  // A's stack hit 3+ → A side takes 500 HP curse dmg
  // attackerSide = 'B' for proper col-priority distribution
  curseEventsOnA = distributeDamage(this.formationA, CURSE_PROC_DMG, 'B');
  this.curseStackA = 0;
}
if (this.curseStackB >= 3) {
  curseEventsOnB = distributeDamage(this.formationB, CURSE_PROC_DMG, 'A');
  this.curseStackB = 0;
}

// Update HP bars + play damage events for any curse-proc victims
if (curseEventsOnA.length > 0) {
  await this.playDamageEvents(curseEventsOnA, 'A');
}
if (curseEventsOnB.length > 0) {
  await this.playDamageEvents(curseEventsOnB, 'B');
}
```

**注意**：本 PR 不加新 FX；reuse 既有 `playDamageEvents` 顯示傷害數字。

### 3b. Curse proc log line

既有 log 系統，加一行 `R02 ⚡ Curse proc A -500 (3 stacks)`：

```ts
if (curseEventsOnA.length > 0) {
  this.logLines.push(`R${this.round.toString().padStart(2,'0')}  ⚡ Curse proc A −${CURSE_PROC_DMG}`);
}
if (curseEventsOnB.length > 0) {
  this.logLines.push(`R${this.round.toString().padStart(2,'0')}  ⚡ Curse proc B −${CURSE_PROC_DMG}`);
}
```

### 3c. sim-rtp.mjs mirror proc

```ts
// In per-round loop, after main combat resolution:
if (curseStackA >= 3) {
  // Apply 500 HP damage to A's formation (sim-only — no FX)
  // Use existing distributeDamage call pattern
  const events = distributeDamage(formationA, 500, 'B');
  // Track for stats (curse_proc_count)
  totalCurseProcsA++;
  totalCurseProcDmgDealt += 500;
  curseStackA = 0;
  // Update lastPreHpA etc as needed
}
// same for B
```

加新 output：

```ts
curse: {
  ...,                              // existing
  total_procs_A: totalCurseProcsA,
  total_procs_B: totalCurseProcsB,
  procs_per_match: (totalCurseProcsA + totalCurseProcsB) / totalMatches,
  curse_dmg_total: totalCurseProcDmgDealt,
  curse_dmg_pct_of_total_dmg: totalCurseProcDmgDealt / totalDmgDealt,
}
```

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（+~25 行 proc block + log）
- `scripts/sim-rtp.mjs`（+~15 行 proc + stats）

**禁止**：
- DamageDistributor / Formation（distributeDamage reuse 既有，不改）
- SymbolsConfig / SlotEngine
- 新 FX 或 visual（k-04 才碰 HUD/視覺）
- SPEC.md
- 其他 passive 數值（dragon/phoenix/tiger/tortoise）

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON
4. 4 numbers：
   - procs_per_match（期望 ~0.5-1.5；不要太罕見也不要每回合）
   - curse_dmg_pct_of_total_dmg（期望 < 15%）
   - coin_rtp（不該變太多 — Curse 是 dmg 不是 coin）
   - avgRoundsPerMatch（**會縮短**，因加了 dmg 來源；確認多少）

## 5. Handoff

- PR URL
- 1 行摘要
- 4 numbers + 判斷
- 若 procs_per_match >2 或 <0.3，flag 給 orchestrator 是否要調整 weight 或 proc threshold
- avgRoundsPerMatch 預期下降，若降太多（< 6 round）flag 一起調 retune
