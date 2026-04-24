# Sprint 4 · m-00 — HP 綁到角色（拿掉團隊 HP bar + 每角色血量獨立）

## 1. Context

PR: **把 HP 從「團隊總量 10000」改為「每角色 1000」，頂部 Team HP bar 整組拿掉，改為每個雀靈頭頂自己的 HP bar**

Why: Owner 2026-04-24 決定：
- **A 數值**：HP 綁 per-unit，team HP 這個概念不存在（SPEC §15.3 本來就寫 「Unit HP = 1000 per spirit」）— 解掉 the-actuary 旗標的 #2 不一致
- **B 視覺**：頂部那條 team HP bar 拿掉，只留每角色頭頂血條
- 原本 `DEFAULT_TEAM_HP = 10000` 除以 5 單位 = 每隻 2000 HP 很厚實；改成 per-unit 1000 HP 後 match 長度會往 SPEC「~10 round」目標收斂

Source:
- `prompts/sprint4/MATH-BASELINE.md` #2 SPEC inconsistency
- `src/config/SymbolsConfig.ts` line 36 `DEFAULT_TEAM_HP = 10000`
- `src/systems/Formation.ts` — `GridUnit.hp/maxHp` 已是 per-unit，data model 不用改，只改 config 常數
- `src/screens/BattleScreen.ts` 大量 HP bar UI code（~56 refs）要清
- `src/screens/DraftScreen.ts` `DraftResult.teamHpA/B` 要 rename
- `src/systems/ScaleCalculator.ts` `teamHpA/B` params — **內部仍用 team HP 做數學**，保持簽章不動（外部 caller 傳 `unitHp * 5`）

Base: master HEAD（PR #79 Sprint 4 docs merged 之後）
Target: `feat/sprint4-m-00-hp-per-unit`

## 2. Spec drift check (P6 — mandatory)

1. `mempalace_search "unit HP spirit 1000 team HP 10000 SPEC drift"`
2. Read `prompts/sprint4/MATH-BASELINE.md` 確認 flag #2
3. `grep -n teamHp src/` 確認影響範圍（~56 處 BattleScreen + 數處 DraftScreen + ScaleCalculator）
4. 若發現某個 caller 我沒列（例如 FXPreviewScreen 也用 teamHp），STOP 回報

## 3. Task

### 3a. Config 常數 rename（`src/config/SymbolsConfig.ts`）

```ts
// BEFORE:
export const DEFAULT_TEAM_HP    = 10000;

// AFTER:
export const DEFAULT_UNIT_HP    = 1000;     // per-spirit HP (SPEC §15.3)
```

### 3b. Formation 建構（`src/systems/Formation.ts`）

`createFormation(selected, teamHp)` → 改簽章：

```ts
// BEFORE:
export function createFormation(selected: number[], teamHp: number): FormationGrid {
  const unitHp = Math.floor(teamHp / selected.length);  // 10000 / 5 = 2000
  // each unit.hp = unitHp
}

// AFTER:
export function createFormation(selected: number[], unitHp: number): FormationGrid {
  // each unit.hp = unitHp directly
}
```

不動 `FormationGrid` / `GridUnit` interface。不動 `teamHpTotal()` helper（仍用於 underdog buff ratio 計算）。

### 3c. DraftScreen 輸出（`src/screens/DraftScreen.ts`）

`DraftResult` interface 改：

```ts
// BEFORE:
teamHpA: number;
teamHpB: number;

// AFTER:
unitHpA: number;
unitHpB: number;
```

`launch()` 裡 `teamHpA: DEFAULT_TEAM_HP` → `unitHpA: DEFAULT_UNIT_HP`（同理 B 側）。

### 3d. BattleScreen 大清洗（`src/screens/BattleScreen.ts`）

**移除**（6 組常數、6 個 field、3 個 method、1 組 ticker pulse 分支）：

- 常數：`HP_Y`, `HP_BAR_W`, `HP_BAR_H`, `HP_A_X`, `HP_B_X`
- Fields：`hpBarA`, `hpBarB`, `hpEdgeA`, `hpEdgeB`, `hpTextA`, `hpTextB`, `displayedHpA`, `displayedHpB`
- Methods：`drawHpBars()`, `drawHpFill()`, `makeHpLabel()`, `buildHpStack()`
- 在 HP edge pulse ticker 分支（約 line 145-155）整個拿掉
- onMount() 裡 `this.drawHpBars()` 呼叫移除
- 所有 `this.cfg.teamHpA` / `this.cfg.teamHpB` 引用改為 `this.cfg.unitHpA` / `this.cfg.unitHpB`

**Underdog buff 改算法**（line 623-624 附近）：

```ts
// BEFORE:
const ratioA = teamHpTotal(this.formationA) / this.cfg.teamHpA;

// AFTER:
const ratioA = teamHpTotal(this.formationA) / (this.cfg.unitHpA * this.cfg.selectedA.length);
```

（`selectedA.length` 一定是 5 — 不硬寫 5，讓 unit count 可擴展）

**drawHpFill + HP tween 區塊**（line 676-688 附近 `fx.push(tweenValue(this.displayedHpA, ...))` 整組拿掉。改由下面 3e 的 per-unit HP bar 自行處理。

### 3e. 新增 per-unit HP bar（在 `drawFormation()` 內）

每隻角色加一個小 HP bar container，放在頭頂（既有 label 那層附近），規格：

```ts
// per-unit HP bar geometry
const HP_BAR_W = 64;
const HP_BAR_H = 6;
const HP_BAR_Y_OFFSET = -SPIRIT_H - 22;  // 高於 HP 數字 label

// In drawFormation() per unit:
const hpTrack = new Graphics()
  .roundRect(-HP_BAR_W/2, HP_BAR_Y_OFFSET, HP_BAR_W, HP_BAR_H, HP_BAR_H/2)
  .fill({ color: T.HP.track, alpha: 0.8 })
  .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
const hpFill = new Graphics();  // drawn dynamically in refreshFormation
container.addChild(hpTrack);
container.addChild(hpFill);
```

然後在 `refreshFormation()` 裡每個 alive unit 重畫 fill：

```ts
ref.hpFill.clear();
if (unit && unit.alive) {
  const ratio = unit.hp / unit.maxHp;
  const w = HP_BAR_W * ratio;
  const color = ratio > 0.6 ? T.HP.high : ratio > 0.3 ? T.HP.mid : T.HP.low;
  ref.hpFill.roundRect(-HP_BAR_W/2, HP_BAR_Y_OFFSET, w, HP_BAR_H, HP_BAR_H/2)
    .fill(color);
}
```

`FormationCellRefs` 加 `hpTrack` + `hpFill` 兩欄位。

**HP bar 平滑動畫（選配 §3f）**：若時間允許，在 `playDamageEvents()` 裡對每個受傷 unit 的 hpFill 用 tween 從舊 ratio 補到新 ratio。若 >15 行跳過，接受立即跳變。

### 3f. 移除現有「HP 數字 label」

既有 `label.text = '${unit.hp}'`（頭頂 15px 數字，Sprint 3 polish 加的）— **移除**，因為現在有 HP bar 視覺化就不需要數字。`label` field + 建立 + refresh 裡的 text 設定全拿掉。

Death cross `crossMark` 保留（死亡指示）。

### 3g. ScaleCalculator 不動

`src/systems/ScaleCalculator.ts` 的 `teamHpA/B` 參數保持原樣（內部數學算死亡輪數靠 team HP aggregation）。caller（DraftScreen.launch）改呼叫方式：

```ts
// BEFORE:
const sa = calculateScales(DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG, selectedA, tw, DEFAULT_FAIRNESS_EXP);

// AFTER (no change — calculateScales signature unchanged; only its usage context changed)
```

實際 ScaleCalculator 內 teamHpA/B 若有用到，由 caller 傳 `unitHp * selected.length` 給它。grep `calculateScales` 看它要不要。

### 3h. 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts`（1 行 const rename）
- `src/systems/Formation.ts`（createFormation 簽章 + 內部用法，~5 行）
- `src/screens/DraftScreen.ts`（DraftResult type + launch() 的 HP 鍵名，~3 處）
- `src/screens/BattleScreen.ts`（大規模移除 HP bar UI + 加 per-unit HP bar，淨變動約 -80 / +40 行）

**可能需要改**（若 ScaleCalculator 內部還引用 teamHp 概念）：
- `src/systems/ScaleCalculator.ts`（如果簽章要調）

**禁止**：
- SPEC.md
- DesignTokens.ts（HP 色票已存在 `T.HP.high/mid/low/track`）
- 任何 Sprint 3 剛 merge 的 FXAtlas / SlotReel 相關檔案

**若發現其他 screen（FXPreviewScreen / LoadingScreen）引用 teamHp，STOP 回報**。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- 每隻角色 HP 預設 **1000**（從 team 10000 / 5 = 2000 砍半）— 戰鬥會變快，這是 owner 明確目標
- 頂部 HP bar 整個拿掉，視覺上騰出 y=70-110 這條空間 — 可能改成放 BGM / wallet 或讓畫面呼吸，本 PR 先留空
- Underdog buff 用 `teamHpTotal(form) / (unitHp * selected.length)` 確保 ratio 正確
- `BattleScreen.ts` 編輯 ≥ 3 次無法過 build → STOP 回報
- **視覺驗證**：preview 起來要看到每隻角色頭頂有自己的血條 + 戰鬥中血條會掉（不一定要平滑動畫）

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：如果 ScaleCalculator 簽章需要改，列出來
- Dependencies：無（Sprint 3 全 merged）
- 是否有做 §3e 平滑 HP tween 動畫
- 確認 preview：per-unit HP bar 可見，戰鬥會掉血，死亡出 ✕，underdog buff 仍觸發（HP < 30% 時 log 顯示 `↑` 標記）
