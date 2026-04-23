# Sprint 3 B · 03 — Azure Dragon passive: +20% damage on 4+ match

## 1. Context

PR: **Sprint 3 B · 青龍 passive · dragon symbol 4+ match gives +20% damage on that way**

Why: SPEC §8 「dragon +20 % on 4+ match」。當**攻擊方**陣中有青龍系雀靈（Meng 孟辰璋 OR Canlan 蒼嵐）活著，且該 spin 有**青龍符號連線 4+ 格**（matchCount ≥ 4 且 symbol clan = `'azure'`）時，該條 way 的 rawDmg × 1.2 加成。**只對青龍 clan 的 wayHit 生效**，其他顏色不受影響。

Source:
- SPEC §8 spirit passives
- SPEC §4 clan groupings：青龍 = `'azure'` clan
- SPEC §5.1 Ways：`matchCount` 是 3–5 的整數
- PR #51 b-01 確立的 `hasAliveOfClan` helper（Formation.ts）— 本 PR 要用

Base: `master` (HEAD 最新，b-01 已合併)
Target: `feat/sprint3b-dragon-4match-bonus`

**⚠️ 本 PR 可與 b-02 並行開發**（b-02 改 Formation.ts + DamageDistributor.ts；b-03 改 BattleScreen.ts，檔案無重疊）。若 b-02 先合併，你 rebase 就行。

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "Sprint 3 spirit passive dragon azure 20% 4 match"` + `"SPEC §8 spirit passives"` + `"Ways matchCount wayHit rawDmg"`.

Known:
- 青龍 clan 字串 `'azure'`
- 觸發條件：`wayHit.matchCount >= 4` AND `SYMBOLS[wayHit.symbolId].clan === 'azure'` AND `hasAliveOfClan(attackerFormation, 'azure')`
- 效果：該 wayHit 的貢獻 dmg × 1.2（不是全域，是該 way）
- **SlotEngine.ts 保持 pure**（不要改），在 BattleScreen.ts 的 loop() post-engine 階段做後處理

## 3. Task

### 3a. 不動 SlotEngine.ts — BattleScreen post-process

在 `src/screens/BattleScreen.ts` 的 `loop()` 裡，`engine.spin(...)` 回傳 `spin` 之後、`distributeDamage` 之前，新增一段「聖獸 passive post-process」：

```ts
import { hasAliveOfClan } from '@/systems/Formation';
import { SYMBOLS } from '@/config/SymbolsConfig';

// Azure Dragon passive: +20% dmg on own-side 4+ match of dragon-clan symbols
let dmgA = spin.sideA.dmgDealt;
let dmgB = spin.sideB.dmgDealt;

if (hasAliveOfClan(this.formationA, 'azure')) {
  for (const wh of spin.sideA.wayHits) {
    if (wh.matchCount >= 4 && SYMBOLS[wh.symbolId]?.clan === 'azure') {
      dmgA += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betA / 100));
    }
  }
}
if (hasAliveOfClan(this.formationB, 'azure')) {
  for (const wh of spin.sideB.wayHits) {
    if (wh.matchCount >= 4 && SYMBOLS[wh.symbolId]?.clan === 'azure') {
      dmgB += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betB / 100));
    }
  }
}
```

**注意**：
- `rawDmg` 是 bet 轉換**前**的原始值（看 SlotEngine._evalSide 第 149 行附近的 `Math.floor(totalCoin * (bet / 100))` 邏輯），所以計算 bonus 要乘 `bet / 100`
- 既有程式碼結構可能已經用 `dmgA = spin.sideA.dmgDealt`，本 PR 在此變數上**累加** bonus，不改既有變數命名
- 保留既有的 **underdog buff** (`ratioA < 0.30` × 1.3) 邏輯**不變**，青龍 +20% **在 underdog buff 之前**計算（順序：passive bonus → underdog → chip damage floor）

### 3b. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts`（loop() 內 +~15 行）

**新 import**：`hasAliveOfClan` from `@/systems/Formation` + `SYMBOLS` from `@/config/SymbolsConfig`（若已 import 則不重複）

**禁止**：
- SlotEngine.ts（本 PR 刻意不動，保持 pure）
- Formation.ts / DamageDistributor.ts（b-02 動，本 PR 不重疊）
- SPEC.md
- SymbolsConfig.ts / DesignTokens.ts

**若發現其他檔案 bug，STOP 回報，不要自己改**。

### 3c. 視覺回饋（選配）

若時間允許，當青龍 bonus 觸發時，在該 wayHit 的 cell 上疊一個「+20%」文字 popup（`goldText`, fontSize 14, 金色, 120ms fade），或簡單播 `AudioManager.playSfx('status-underdog')`。**非必要**，若超過 10 行留給後續 polish PR。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- Bonus 必須乘 `bet / 100` 校正，否則 rawDmg 沒套 bet scale 算出來的 bonus 會不對
- 只加總到**青龍 clan 且 matchCount ≥ 4** 的 wayHit，其他不加
- 與 b-01 / b-02 並存：damage 順序 **attacker-side dragon bonus → defender-side tiger 減免 → per-unit tortoise shield → underdog → chip floor**，彼此不衝突
- `BattleScreen.ts` 編輯 ≥ 3 次未收斂 → STOP 回報

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：預期 0
- Dependencies：b-01 `hasAliveOfClan` helper
- 與 b-02 無檔案衝突（檢查若 b-02 已合併則 rebase 應無事）
- 是否有做 §3c 視覺回饋
- 確認 damage 順序：bonus → underdog → floor 與 SPEC §9.2 / §9.3 一致
