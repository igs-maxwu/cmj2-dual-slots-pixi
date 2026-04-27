# Sprint 5 · k-02 — Curse Stack Tracking（每 spin 累加對手 stack）

## 1. Context

PR: **每回合 spin 結束後，數雙方 grid 上的 curse cells，每個 curse cell 落在「自己」格 → 對手的 curseStack +1**

Why: SPEC §15.6 M6 Curse 的核心累積邏輯。本 PR k-02 只做 stack 累加，**不做 proc**（k-03 處理 3-stack 觸發 500 HP flat dmg）、不做 HUD（k-04）。

Curse cell 歸屬規則（per ROADMAP / k-01 sim 已定）：
- col 0-1：A 側格 → 落 curse cell 累 B 的 stack
- col 3-4：B 側格 → 落 curse cell 累 A 的 stack
- col 2：中央，**neutral**（不算任一方）

Source:
- PR #110 k-01 Curse symbol id:9
- `scripts/sim-rtp.mjs` 已有 curse cell counting 範例（k-01 加的）
- `src/screens/BattleScreen.ts` loop()
- `src/config/SymbolsConfig.ts` Curse symbol 定義

Base: master HEAD（r-03 merged）
Target: `feat/sprint5-k-02-curse-stack`

## 2. Spec drift check (P6)

1. `mempalace_search "Curse stack tracking 3-stack 500 HP M6"`
2. 確認 SYMBOLS 含 id:9 isCurse:true
3. 確認 BattleScreen.loop() 有 access spin.grid（5×3 array）

## 3. Task

### 3a. BattleScreen 加 curseStack fields

```ts
// New fields:
private curseStackA = 0;
private curseStackB = 0;
```

onMount() 初始化為 0（已是 default，可省）。

### 3b. loop() 加 curse counting block

在 `engine.spin(...)` 回傳 `spin` 之後、其他 passive 處理之前，加：

```ts
// ── M6 Curse cell counting per spin ─────────────────────────────────
const CURSE_ID = SYMBOLS.findIndex(s => s.isCurse);
if (CURSE_ID >= 0) {
  let curseLandingOnA = 0, curseLandingOnB = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      if (spin.grid[r][c] === CURSE_ID) {
        if (c < 2)      curseLandingOnA++;   // A's left half
        else if (c > 2) curseLandingOnB++;   // B's right half
        // c === 2 neutral, ignore
      }
    }
  }
  // Curse on YOUR grid charges OPPONENT's stack
  this.curseStackB += curseLandingOnA;       // curse on A side → B accumulates
  this.curseStackA += curseLandingOnB;       // curse on B side → A accumulates
}
```

**注意位置**：在 spin 取得後、`let dmgA = spin.sideA.dmgDealt` 之前。Stack 累加是純記帳，不影響本回合戰鬥數值（k-03 才會把 stack 變成傷害）。

### 3c. console output for debug（dev 模式）

選配：因 stack proc 還沒做，玩家看不到 stack 變化。**選配** 加 import.meta.env.DEV gated console.log 方便驗證：

```ts
if (import.meta.env.DEV && (curseLandingOnA + curseLandingOnB > 0)) {
  console.log(`[Curse] A side ${curseLandingOnA} → B stack=${this.curseStackB}, B side ${curseLandingOnB} → A stack=${this.curseStackA}`);
}
```

**生產 build 不包含**（vite tree-shake import.meta.env.DEV）。若不想加，跳過。

### 3d. sim-rtp.mjs 升級 — 改 stack tracking

sim 在 k-01 已有 curse cell counting，但只是純計數。本 PR 升級為**真正的 stack tracking**（mirror BattleScreen 行為）：

```ts
let curseStackA = 0, curseStackB = 0;
let totalCurseStackPeak = 0;     // for stats: max stack ever seen during sim

// Inside per-round loop:
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 5; c++) {
    if (spin.grid[r][c] === CURSE_ID) {
      if (c < 2)      curseStackB++;
      else if (c > 2) curseStackA++;
    }
  }
}
totalCurseStackPeak = Math.max(totalCurseStackPeak, curseStackA, curseStackB);

// Reset stacks at match end (when team dies):
// (find existing match-end logic, add curseStackA = curseStackB = 0)
```

加 output：

```ts
curse: {
  total_cells_on_A_side, total_cells_on_B_side, avg_cells_per_round,   // existing
  peak_stack_observed: totalCurseStackPeak,
  avg_stack_at_match_end_A: ...,    // average stack on A at end of each match
  avg_stack_at_match_end_B: ...,
}
```

### 3e. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（+2 fields + ~12 行 loop 內 counting block）
- `scripts/sim-rtp.mjs`（升級現有 curse counting block）

**禁止**：
- SymbolsConfig / SlotEngine（k-01 已定）
- Resonance / Formation / DamageDistributor
- DraftScreen（curse 不在 draft 階段）
- 任何視覺改動（HUD 是 k-04）
- SPEC.md
- 500 HP proc 邏輯（k-03 處理）

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL + sim JSON
4. 3 numbers：
   - peak_stack_observed（期望 ≥ 3，否則 sim run 太短沒累到 proc 門檻）
   - avg_stack_at_match_end（每側）
   - 確認 stack 在 match 結束時有歸零

## 5. Handoff

- PR URL
- 1 行摘要
- Stack 累加是否 work？peak_stack 是否到 3+？
- 是否有 console.log dev 訊息（§3c 選配）
- Spec deviations：預期 0
