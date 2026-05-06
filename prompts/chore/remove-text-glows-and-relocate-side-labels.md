# Chore #218 — 移除三處文字光暈 + 側邊 label 移到 formation 上方

## 1. Context

Owner 試玩 2026-05-06 反饋兩件事：

### Issue 1 — 文字光暈不好看
三處 GlowFilter 文字光暈，owner 覺得視覺過設計：
1. **Victory banner**「PLAYER B 完勝！」（[ResultScreen.ts:87-92](src/screens/ResultScreen.ts#L87)）— 56pt goldText + GlowFilter outerStrength=3
2. **JP marquee GRAND**「5,000,043」（[BattleScreen.ts:802-808](src/screens/BattleScreen.ts#L802)）— 42pt goldText + GlowFilter outerStrength=2.5
3. **VS 圓徽**「VS」（[BattleScreen.ts:474-480](src/screens/BattleScreen.ts#L474)）— 16pt goldText + GlowFilter outerStrength=1.8

### Issue 2 — 側邊 label 被角色擋住
[BattleScreen.ts:421-459](src/screens/BattleScreen.ts#L421) `A · 我方` / `對手 · B` 標籤：
- 當前位置 y=295-319（ARENA_TOP_Y=285 + 10）
- A label x 範圍 28-188，formation slot 0/2 (outer A at COL_X_OUTER_A=60) sprite 也在 x 30-90 → **重疊**
- B side mirror 同樣問題
- screenshot 顯示後排角色覆蓋 label 文字

### Fix
- **Issue 1**：3 處移除 `GlowFilter`，**保留 `goldText` gradient + `withShadow` dropShadow**（基礎 polish 仍在）
- **Issue 2**：side labels y 295 → 230（移到 JP marquee 下緣 220 與 ZONE_SEP_Y 262 之間 42px 空檔），跟 formation 完全不重疊

純視覺 — 不動 layout 結構 / outcome 邏輯 / win 判定。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 移除 4 處 GlowFilter + 改 1 個 y 值

---

## 2. Spec drift check (P6)

1. 確認 [ResultScreen.ts:87-92](src/screens/ResultScreen.ts#L87) `mainText.filters = [new GlowFilter(...)]` 仍存
2. 確認 [BattleScreen.ts:802-808](src/screens/BattleScreen.ts#L802) `this.jpGrandText.filters = [new GlowFilter(...)]` 仍存
3. 確認 [BattleScreen.ts:474-480](src/screens/BattleScreen.ts#L474) `vsText.filters = [new GlowFilter(...)]` 仍存
4. 確認 [BattleScreen.ts:421-459](src/screens/BattleScreen.ts#L421) side labels 仍 `labelY = ARENA_TOP_Y + 10 = 295`
5. 確認 [BattleScreen.ts:48-52](src/screens/BattleScreen.ts#L48) JP_MARQUEE_Y=88 / JP_MARQUEE_H=132 / ZONE_SEP_Y=262 — 計算 220-262 空檔正確

---

## 3. Task

### Single commit — Remove 3 glows + relocate labels

#### 3a. ResultScreen victory banner — remove GlowFilter

`src/screens/ResultScreen.ts` line 87-93：

當前：
```ts
const mainText = goldText(cfg.中, { fontSize: 56, withShadow: true });
mainText.anchor.set(0.5, 0.5);
mainText.style.fill = cfg.color;
mainText.filters = [new GlowFilter({
  color: cfg.color, distance: 18, outerStrength: 3, innerStrength: 0.5, quality: 0.4,
})];
banner.addChild(mainText);
```

改成：
```ts
// chore #218: remove GlowFilter (owner trial 2026-05-06: 文字光暈不好看). Keep goldText gradient + withShadow dropShadow as base polish.
const mainText = goldText(cfg.中, { fontSize: 56, withShadow: true });
mainText.anchor.set(0.5, 0.5);
mainText.style.fill = cfg.color;
banner.addChild(mainText);
```

> 直接刪 `mainText.filters = [new GlowFilter(...)]` 4 行。

#### 3b. JP marquee GRAND value — remove GlowFilter

`src/screens/BattleScreen.ts` line 802-810：

當前：
```ts
this.jpGrandText = goldText('5,000,000', { fontSize: 42, withShadow: true });
this.jpGrandText.anchor.set(0.5, 0.5);
this.jpGrandText.x = panelX + panelW / 2;
this.jpGrandText.y = panelY + panelH * 0.50;
this.jpGrandText.filters = [new GlowFilter({
  color: T.GOLD.base, distance: 18, outerStrength: 2.5, innerStrength: 0.5, quality: 0.4,
})];
this.jpGrandText.zIndex = 11;
this.container.addChild(this.jpGrandText);
```

改成：
```ts
// chore #218: remove GlowFilter (owner trial 2026-05-06)
this.jpGrandText = goldText('5,000,000', { fontSize: 42, withShadow: true });
this.jpGrandText.anchor.set(0.5, 0.5);
this.jpGrandText.x = panelX + panelW / 2;
this.jpGrandText.y = panelY + panelH * 0.50;
this.jpGrandText.zIndex = 11;
this.container.addChild(this.jpGrandText);
```

> 刪 `filters = [new GlowFilter(...)]` 3 行。

#### 3c. VS badge — remove GlowFilter

`src/screens/BattleScreen.ts` line 474-481：

當前：
```ts
const vsText = goldText('VS', { fontSize: 16, withShadow: true });
vsText.anchor.set(0.5, 0.5);
vsText.x = vsCenterX;
vsText.y = vsCenterY;
vsText.filters = [new GlowFilter({
  color: 0xFFD37A, distance: 8, outerStrength: 1.8, innerStrength: 0.3, quality: 0.4,
})];
this.container.addChild(vsText);
```

改成：
```ts
// chore #218: remove GlowFilter (owner trial 2026-05-06)
const vsText = goldText('VS', { fontSize: 16, withShadow: true });
vsText.anchor.set(0.5, 0.5);
vsText.x = vsCenterX;
vsText.y = vsCenterY;
this.container.addChild(vsText);
```

> 刪 `filters = [new GlowFilter(...)]` 3 行。

#### 3d. Side labels — relocate y 295 → 230

`src/screens/BattleScreen.ts` line 422：

當前：
```ts
// ── Side labels (A · 我方 / 對手 · B) ────────────────────────────────
const labelY  = ARENA_TOP_Y + 10;
const labelH  = 24;
```

改成：
```ts
// ── Side labels (A · 我方 / 對手 · B) — chore #218: relocated from ARENA_TOP_Y+10=295 (overlapped formation slot 0/2)
// to y=230 (in 42px gap between JP marquee bottom 220 and ZONE_SEP_Y 262). Above formation = no overlap.
const labelY  = 230;
const labelH  = 24;
```

> 只改 `labelY` 值 — bannerABg / bannerAAccent / bannerAText / B 鏡像 4 個 element 內部用 `labelY` reference，自動跟著移。

> **不動** label 高度 / x 位置 / 字體 / colors。

#### 3e. 不動 imports

`GlowFilter` import 在 BattleScreen 仍會被其他地方用（chore #185 / chore #214 等留下的 reference），保留 import。

ResultScreen 內 GlowFilter 是否還有其他用法？— executor 確認 grep `GlowFilter` 在 ResultScreen 是否只有 banner 一處；如果是唯一一處，刪 import；若不是，保留 import。

**Commit**: `tune(chore): remove glow on victory banner + JP grand + VS + relocate side labels above formation (chore #218 owner trial 2026-05-06)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/ResultScreen.ts` line 87-93 (banner GlowFilter) + 確認 import GlowFilter 是否還用
- `src/screens/BattleScreen.ts` —
  - line 474-481 (VS badge GlowFilter)
  - line 802-810 (JP grand GlowFilter)
  - line 422 (labelY 295 → 230)

**禁止**：
- 動 `goldText` 函式 / DesignTokens
- 動 banner scale / fade animation
- 動 JP marquee 其他元素 (label / divider / MAJOR / MINOR)
- 動 VS circle bg / stroke
- 動 side labels 寬度 / 字體 / 顏色 / `labelH`
- 動 ARENA_TOP_Y / JP_MARQUEE_Y / ZONE_SEP_Y 常數
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "filters = \[new GlowFilter" src/screens/ResultScreen.ts` — 應無
   - `grep "filters = \[new GlowFilter" src/screens/BattleScreen.ts | head -5` — VS / JP grand 應無；其他 chore (#185 等) 仍在，flag 給 reporter 不在本 chore 修
   - `grep "labelY" src/screens/BattleScreen.ts | head -5` — 應有 `labelY = 230` 或類似
   - `grep "ARENA_TOP_Y + 10" src/screens/BattleScreen.ts` — 應無 (label 不再用此 offset)
5. **Preview 驗證**：
   - 進 BattleScreen — `A · 我方` / `對手 · B` 在 formation 上方（y=230 區）+ 不被角色擋
   - JP marquee `5,000,043` 字仍金色 + 漸變 + dropShadow 但**沒外光暈**
   - VS 圓徽中央 `VS` 字仍金色但**沒外光暈**
   - 跑一場 match 到 ResultScreen — `PLAYER X 勝利！` / `完勝！` 字仍金色但**沒外光暈**
   - chore #185 win pulse / chore #214 popCell / chore #209 詛咒發動 banner 不破

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 2 張對比截圖（before/after — 光暈 + label 位置）
- spec deviations: 0（純視覺移除/搬移）
- Process check：照新 pattern 把 git 操作串在**單一 Bash call**
