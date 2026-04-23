# Sprint 3 B · 02 — Black Tortoise passive: last-alive shield

## 1. Context

PR: **Sprint 3 B · 玄武 passive · last-alive tortoise absorbs lethal damage once**

Why: SPEC §8 「tortoise shield when last alive」。當玄武系雀靈（Xuanmo 玄墨 OR Zhaoyu 朝雨）**是陣中最後 1 隻**且受到**致命傷害**時，盾一次性抵擋 — 保留 1 HP 不死（而不是變 0 死亡）。每 unit 僅觸發 1 次。

Source:
- SPEC §8 spirit passives
- SPEC §4 clan groupings：玄武 = `'black'` clan
- PR #51 b-01 確立的 `hasAliveOfClan` pattern（Formation.ts）— 本 PR 不需新 helper，改用 per-unit 檢查

Base: `master` (HEAD 最新，b-01 已合併)
Target: `feat/sprint3b-tortoise-last-alive-shield`

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "Sprint 3 spirit passive tortoise shield"` + `"SPEC §8 spirit passives"`.

Known:
- 玄武 clan 字串 `'black'`
- 「shield when last alive」**每隻玄武 unit 僅觸發 1 次**（不是每局 1 次、不是每回合 1 次）
- 觸發條件：`damageThisUnit >= unit.hp`（致命或超量）+ `unit.clan === 'black'` + 該 formation 只剩這隻 alive（即扣傷前已是 1/5 alive）
- 效果：damage 被限制，unit 保留 **1 HP**，`shieldUsed` flag 設 true
- 視覺：SFX + 文字 popup（選配，見 §3c）

## 3. Task

### 3a. `src/systems/Formation.ts` — 擴充 unit 結構

`GridUnit` interface 加 optional field：

```ts
export interface GridUnit {
  symbolId: number;
  hp:       number;
  maxHp:    number;
  alive:    boolean;
  shieldUsed?: boolean;  // Black Tortoise passive (b-02) — consumed on fatal hit
}
```

`createFormation` 內**不**初始化（undefined = false 語義足夠），保留既有邏輯。

### 3b. `src/systems/DamageDistributor.ts` — 致命傷 hook

在 `distributeDamage()` 裡，**每當要把 `dmg` 扣到某個 `unit` 時**（找到該 unit 並計算該 unit 應受 `hit` 的地方），在實際扣血 **之前** 加以下判斷：

```ts
import { SYMBOLS } from '@/config/SymbolsConfig';

// Black Tortoise shield — last alive tortoise absorbs lethal damage once
const aliveCount = grid.filter(u => u !== null && u.alive).length;
const isTortoise = SYMBOLS[unit.symbolId]?.clan === 'black';
if (isTortoise && !unit.shieldUsed && aliveCount === 1 && hit >= unit.hp) {
  hit = unit.hp - 1;         // drop to 1 HP, not 0
  unit.shieldUsed = true;    // consume shield (one-time)
  // Record shield-saved event in output DmgEvent if format allows
}
```

**⚠️ 關鍵**：
- `aliveCount === 1` 意指**扣傷前**formation 已是「玄武那隻是唯一活著」— 不是扣完才剩 1
- `hit >= unit.hp` 涵蓋超量傷害（例如 unit.hp=50, hit=200 → hit 降為 49）
- 不死的結果是 `unit.hp -= hit` → 剩 1，不會觸發 `alive = false`
- shield 消耗後下次同 unit 致命傷就真的會死

**確認既有 `distributeDamage` 結構**：該函式目前是把 `totalDmg` 分配到 column 順序 + 內部各 unit。請把上述 check 放在找到 `unit` 後、**在對這個 unit 執行扣血前**，不是全域 damage 進入點。如果既有結構難插入，可以在 inner loop 內（queue 處理或 column iteration 內）加判斷 — **STOP 先描述現有結構**再改。

### 3c. 視覺回饋（選配）

若時間允許，在 `BattleScreen.ts` 的 `loop()` 的 `eventsOnA` / `eventsOnB` 處理後，檢查是否有某個 unit 剛剛 `shieldUsed = true`：

- 在該 unit 對應 formation cell 位置疊一個 `"SHIELD!"` goldText popup（2 字 `盾` 或英文皆可）
- 配 `AudioManager.playSfx('status-underdog')`（既有最接近的 SFX，或用 `ui-apply` 亦可）
- 畫一個半徑 80 的六角形光環快速淡出 100ms（參考 `_sigTortoiseHammerSmash` 的 hexHalo 模式）

**若要做**，請在 Handoff 說明。若會超過 20 行或觸發 P3 iteration 問題，**不要做**，留給後續 polish PR。

### 3d. 檔案範圍（嚴格）

**主要修改**：
- `src/systems/Formation.ts`（+1 optional field `shieldUsed`）
- `src/systems/DamageDistributor.ts`（+~6 行 tortoise check）

**Optional**：`src/screens/BattleScreen.ts`（視覺 popup，≤ 20 行）

**禁止**：
- SPEC.md（§8 已寫）
- SlotEngine.ts / SymbolsConfig.ts / tween.ts
- 既有 Formation API 的破壞性改動（只加 optional field）

**若發現其他檔案 bug，STOP 回報，不要自己改**。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- `shieldUsed` flag 是 per-unit 狀態，不是 per-formation。新回合重建 formation 時自然為 false
- 與 b-01 tiger 共存：順序是「先 tiger 減免整體 damage，再分配到 units，分配時遇到玄武 last-alive 再 shield」— **不衝突**
- `DamageDistributor.ts` 編輯 ≥ 3 次未收斂 → STOP 回報
- `src/systems/*` **不得** import Pixi

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：預期 0
- Dependencies：b-01 (hasAliveOfClan — 其實本 PR 沒用到，但若未來整合需要)
- 是否有做 §3c 視覺回饋
- 說明在 `distributeDamage()` **哪一行**加的 tortoise check（給我 review 時快速定位）
