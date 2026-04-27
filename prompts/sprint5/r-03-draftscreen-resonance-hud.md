# Sprint 5 · r-03 — DraftScreen Resonance 即時 HUD

## 1. Context

PR: **DraftScreen 4 個 clan banner 右側的 `◇ RESONANCE` 占位變成即時 pip 指示器，反映當前 draft 算出的 Resonance tier**

Why: Sprint 3C-01 c-01 在 ClanBanner 右側留了 `// RESONANCE_HOOK` 註解 + 灰色 `◇ RESONANCE` 占位。r-03 把它接到 r-01 `detectResonance()` 即時算結果，讓玩家**在 draft 階段就看到策略選擇的數值結果**（SPEC C4 「40% strategy weight」精神）。

UX 流程：
1. DraftScreen 進入時，4 個 banner 右側 = 灰色 `◇`（無 Resonance）
2. 玩家 toggle 選雀靈，每次更新時 `detectResonance(selectedA)` 重算
3. 該 tier 的 boostedClans 對應 banner 右側：`◇` → `✦ ×1.5`（金色亮起）
4. 未 boost 的 banner → 維持灰 `◇`

**注意**：只算 A 側（DraftScreen 主玩家視角）。B 側 Resonance 用 mirror/random 時即時看不見差異 — 那是 Sprint 5 後期 PvP differentiator HUD（Sprint 7 範疇）。本 PR **只顯示 A 側**。

Source:
- `src/screens/DraftScreen.ts` line 299-307 RESONANCE_HOOK 位置
- `src/systems/Resonance.ts` `detectResonance` + `ResonanceResult`
- Sprint 3C-01 ClanBanner pattern

Base: master HEAD（k-01 merged 後派）
Target: `feat/sprint5-r-03-draft-hud`

## 2. Spec drift check (P6)

1. `mempalace_search "RESONANCE_HOOK DraftScreen banner pip"`
2. 確認 `src/screens/DraftScreen.ts` line 299-307 的 rightHint Text 結構未被改過
3. 確認 r-01 已 merged（PR #105），`Resonance.ts` 存在

## 3. Task

### 3a. DraftScreen field 加 resonance 狀態 + per-clan rightHint refs

```ts
// New imports
import { detectResonance, type ResonanceResult } from '@/systems/Resonance';

// New fields:
private resonanceResult: ResonanceResult = { tier: 'NONE', boostedClans: [], clanCounts: { azure:0, white:0, vermilion:0, black:0 } };
private clanHints: Partial<Record<ClanId, Text>> = {};
```

### 3b. drawClanBanner 改為儲存 rightHint reference

line 299-307 附近，把 `rightHint` 存到 `this.clanHints`：

```ts
// Right: Sprint 5 Resonance hook placeholder
const rightHint = new Text({
  text: '◇ RESONANCE',
  style: { fontFamily: T.FONT.num, fontSize: 9, fill: T.FG.muted, letterSpacing: 2 },
});
rightHint.anchor.set(1, 0.5);
rightHint.x = CANVAS_WIDTH - 16; rightHint.y = BANNER_H / 2;
rightHint.alpha = 0.35;
banner.addChild(rightHint);

// NEW: store ref for r-03 dynamic update
this.clanHints[clanId] = rightHint;
```

### 3c. 新 `updateResonanceHud()` method

```ts
private updateResonanceHud(): void {
  this.resonanceResult = detectResonance(Array.from(this.selectedA));
  for (const clanId of CLAN_ORDER) {
    const hint = this.clanHints[clanId];
    if (!hint) continue;
    if (this.resonanceResult.boostedClans.includes(clanId)) {
      hint.text = '✦ ×1.5';
      hint.style.fill = T.GOLD.glow;
      hint.alpha = 1.0;
    } else {
      hint.text = '◇ RESONANCE';
      hint.style.fill = T.FG.muted;
      hint.alpha = 0.35;
    }
  }
}
```

### 3d. refresh() 末尾呼叫 updateResonanceHud

DraftScreen 既有 `refresh()` method（每次 toggle 後呼叫）。在末尾加：

```ts
private refresh(): void {
  // ... existing code ...
  this.updateClanCountReadout();
  this.updateResonanceHud();    // ← 新增
  // ... existing canGo / button update ...
}
```

### 3e. 視覺微調（選配）

若想讓 `✦ ×1.5` 更顯眼：加 dropShadow 或微亮 stroke。**若 >5 行請跳過**。

### 3f. 檔案範圍（嚴格）

**修改**：
- `src/screens/DraftScreen.ts`（+import + 2 fields + drawClanBanner 內 1 行 ref store + 新 method ~15 行 + refresh 加 1 行呼叫，淨變動約 +30 行）

**禁止**：
- `Resonance.ts`（不動）
- BattleScreen / SlotEngine / 任何 systems 檔
- SymbolsConfig / DesignTokens
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL
4. **Preview 驗證**：
   - 進 DraftScreen 4 banner 右側顯示灰 `◇ RESONANCE`
   - 選滿 5 隻形成 SOLO 配置 → 對應 1 條 banner 右側變金 `✦ ×1.5`
   - 選滿 5 隻形成 DUAL 配置 → 對應 2 條 banner 右側都變金
   - 退選變回灰
   - 附 1 張選滿狀態的截圖

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：預期 0
- 是否有做 §3e 微調
- 確認只動 DraftScreen 一個檔案
