# Sprint 3 B · 01 — White Tiger passive: −10% damage taken

## 1. Context

PR: **Sprint 3 B · 白虎 passive · own-side damage taken reduced 10%**

Why: Sprint 3 A 完成 8 雀靈 signature FX（純視覺）。Sprint 3 B 開始做**真正的 skill / 數值層**：SPEC §8 Spirit passives 四聖獸 passive。本 PR 是 4 支中**最單純的一支**，先立 clan-aware 判斷架構 + 做白虎 −10% 傷害減免，之後 3 支（玄武 / 青龍 / 朱雀）套同一模式。

Source:
- SPEC §8 原文：「Spirit passives (Sprint 3): tiger –10 % damage taken, tortoise shield when last alive, dragon +20 % on 4+ match, phoenix coin-on-kill」
- SPEC §4 clan 分組（已正名 2026-04-23）：白虎 = Yin（寅）+ Luoluo（珞洛）
- 現有 `DamageDistributor.ts` 是入傷的單一漏斗，所有修改都在這裡

Base: `master` (HEAD `76bd10e`)
Target: `feat/sprint3b-tiger-passive-dmg-reduction`

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "Sprint 3 spirit passive tiger white 10% damage"` + `"SPEC §8 spirit passives"`.

Known locked values:
- **Tiger −10% damage taken** (SPEC §8) — 乘 0.9 (不是減 10 flat)
- 觸發條件必須是「自己這邊**至少有一隻**白虎系（寅 或 珞洛）還活著」才啟用
- 白虎 clan 字串 = `'white'`（SPEC §4 beast groupings + SymbolsConfig.ts 資料）
- passive 是**被動 always-on**，不是觸發式技能

## 3. Task

### 3a. `src/systems/Formation.ts` — 新增 clan-aware helper

匯出新 function（放在 `teamHpTotal` 附近）：

```ts
import type { Clan } from '@/config/SymbolsConfig';
import { SYMBOLS } from '@/config/SymbolsConfig';

/** Returns true if the formation has at least one alive spirit of the given clan. */
export function hasAliveOfClan(formation: FormationGrid, clan: Clan): boolean {
  for (const unit of formation) {
    if (unit && unit.alive && SYMBOLS[unit.symbolId]?.clan === clan) return true;
  }
  return false;
}
```

**注意**：`FormationGrid` 與 unit 結構已存在，若 `unit.symbolId` 欄名不同請沿用既有（可能叫 `symId`）。

### 3b. `src/systems/DamageDistributor.ts` — 接入 passive

`distributeDamage()` 現在簽章大致是：

```ts
export function distributeDamage(formation: FormationGrid, damage: number, attacker: 'A' | 'B'): DmgEvent[]
```

新增 optional 參數 `defenderFormation` （其實就是 `formation` 本身，但語義清楚）— 不，更好的是**直接用既有 `formation`** 判斷 passive（因為 `formation` 就是防守方）。

**修改邏輯**：在 `distributeDamage()` 進入點、分配到各 unit **之前**，先做：

```ts
import { hasAliveOfClan } from './Formation';

// Passive: White Tiger clan — incoming damage × 0.9 if any tiger alive
if (hasAliveOfClan(formation, 'white')) {
  damage = Math.ceil(damage * 0.9);
}
```

**放在 `distributeDamage` 函式最上面**（所有 distribution logic 之前）。`Math.ceil` 避免 0 damage 邊緣（若 damage=1，減 10% = 0.9 → ceil = 1，最小 1 dmg 仍保留）。

### 3c. 視覺回饋（選配，可選不做）

若時間允許可在 `BattleScreen.ts` 的 `loop()` 裡，在 distributeDamage 呼叫點前後檢查是否觸發 tiger passive，加個小的文字 popup「-10% TIGER」在對應 side HP bar 上方。**但本 PR 主軸是數值，不是 FX**；如果視覺實作會讓 scope 超過單檔 10 行，**不要做**，留給後續 polish PR。

### 3d. 檔案範圍（嚴格）

**主要修改**：
- `src/systems/Formation.ts`（+1 export `hasAliveOfClan`）
- `src/systems/DamageDistributor.ts`（+3 行 passive check）

**Optional**：`src/screens/BattleScreen.ts`（若做視覺 popup，≤ 10 行）

**禁止**：
- SPEC.md（§8 已寫，不改）
- SlotEngine.ts（跟本 passive 無關）
- Formation.ts 的現有 API / 資料結構（只加新 export，不改既有）
- SymbolsConfig.ts（clan 資料已正確，不動）

**若發現其他檔案 bug，STOP 回報，不要自己改**。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- `hasAliveOfClan` 只讀 formation，**零 side-effect**。不要在這裡 mutate 任何 unit 狀態。
- `distributeDamage` 內 passive check **在 damage 分配前**，整體 damage 數字改變，不是每 unit 各自打折。
- `Math.ceil(damage * 0.9)` 避免 tiny damage 變 0。
- `DamageDistributor.ts` 編輯 ≥ 3 次未收斂 → STOP 回報。
- `src/systems/*` **純 TypeScript 不得 import Pixi**（CLAUDE.md architecture rule）— `hasAliveOfClan` 放 Formation.ts 時留意別不小心引入 Pixi 依賴。

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：預期 0
- Dependencies：無（純 gameplay math，零資產 / FX / 外部 lib）
- 是否有做 §3c 視覺 popup（可選）
- **重要**：說明 `distributeDamage()` 既有簽章，確認 passive check 加的位置與其他 multiplier / priority 流程不衝突（例如 SPEC §9.2 underdog buff 是 attacker-side 放大，跟 tiger defender-side 減免是獨立兩件事，**不得**混在一起）
