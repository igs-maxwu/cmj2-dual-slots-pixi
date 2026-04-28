# Chore — MAJOR/MINOR 出框修正 + Spirit 5v5 第二輪 debug + SLOT 全 ball 深色文字 + 咒紫珠調淡

## 1. Context

Owner 試玩 chore #160 後再回報 3 issue（截圖佐證 https://igs-maxwu.github.io/cmj2-dual-slots-pixi/）：

1. **MAJOR/MINOR 字級 22pt OK 但「數字出框」** — value text 撞 panel 下邊界，數字底部跑出金色 border 之外
2. **5v5 spirit 又少了 — 看到 4v1 (or 2v3)** — chore #160 NINE_GAP 4→24 後仍然不對。截圖顯示 A 側 4 個 spirit + B 側 1 個 spirit visible（總共 5/10）。**可見 #160 的 Case D「視覺 overlap」假設不完整**，需重新 console-instrument 找真實 root cause
3. **SLOT 珠子文字色不一致 + 咒(紫)珠太深** — chore #160 只把白虎 (id 2,3) 改深色，其他仍白字。Owner 要求**全部 ball 統一深色文字**。另外 curse 「咒」symbol color `0x8b3aaa`（深紫）+ 深色文字 = 不可讀，需把紫色調淡

3 個 issue 一起 single PR 處理（皆視覺 / decoration 層，不動機制）。

---

## Skills suggested for this PR

- **`debugging-and-error-recovery`** — Issue 2 **絕對必走 5-step**（reproduce / instrument / localize / fix / guard）。**禁止再用「假設 + 改 const」hypothesis-first**。chore #160 已證明猜 Case D 不完整 → 這次必須先 console.log 完整 dump 再定位
- **`incremental-implementation`** — 3 atomic commits per issue
- **`source-driven-development`** — Issue 1/3 都用 contrast checker / 實際數值確認

---

## 2. Spec drift check (P6)

1. `mempalace_search "chore 160 NINE_GAP 24 spirit 5v5 overlap CaseD"`
2. `mempalace_search "drawJackpotMarquee panel height MAJOR MINOR 22pt"`
3. 確認 既有 chore #160 的 NINE_GAP=24 / NINE_STEP=104 / NINE_GRID_TOTAL=288 仍成立
4. 確認 既有 SYMBOL_VISUAL map（SlotReel.ts L13-26）curse `0x8b3aaa` / scatter `0xff3b6b` / wild `T.GOLD.glow` / jp `T.GOLD.base`
5. 確認 既有 chore #160 setCellSymbol 的 `isWhiteClan` 條件 fill

---

## 3. Task

### 3a. Commit 1 — MAJOR/MINOR 不出框

`BattleScreen.ts` `drawJackpotMarquee()` L802-824（既 chore #160 22pt fix 後狀態）：

當前狀態：
```ts
this.jpMajorText = goldText('500,000', { fontSize: 22, withShadow: false });
this.jpMajorText.anchor.set(0.5, 0);                  // 0 = top
this.jpMajorText.x = halfX1;
this.jpMajorText.y = bottomRowY + 2;                  // bottomRowY = panelY + panelH - 24
```

問題分析：22pt fontSize line-height ≈ 28-30px，anchor 0.5,0 + y=panelY+panelH-22，文字底部 = panelY+panelH+6~8 → **out of panel by 6-8 px**。

**Fix（推薦 option A — bottom-anchor + 適度縮 fontSize）**：

```ts
// 維持顯著放大（原 16pt → 改成 20pt 而非 22pt，留出 padding）
// + bottom-anchor 讓文字緊貼 panel 內側 6px gap
this.jpMajorText = goldText('500,000', { fontSize: 20, withShadow: false });
this.jpMajorText.anchor.set(0.5, 1);                  // 1 = bottom
this.jpMajorText.x = halfX1;
this.jpMajorText.y = panelY + panelH - 6;             // 6px inset from bottom

this.jpMinorText = goldText('50,000', { fontSize: 20, withShadow: false });
this.jpMinorText.anchor.set(0.5, 1);
this.jpMinorText.x = halfX2;
this.jpMinorText.y = panelY + panelH - 6;
```

對應 label 位置也需調 — `majorLbl.y / minorLbl.y` 從 `bottomRowY - 14` 改成 `panelY + panelH - 6 - 22 (value height) - 12 (label gap)` ≈ `panelY + panelH - 40`。具體 px 由 executor 用 dev tools 微調（label 不可撞 divider 也不可撞 value）。

**驗收**：DevTools 看 MAJOR "500,020" + MINOR "50,035" 文字底部完全在 panel border 內側（不超出金色框）。

**Commit 1**: `fix(chore): MAJOR/MINOR value bottom-anchor inside panel (20pt + 6px inset)`

---

### 3b. Commit 2 — Spirit 5v5 第二輪 mandatory debug

#### **CRITICAL**：禁止假設 root cause

chore #160 用 hypothesis「NINE_GAP 太小」改 const → 結果不完整。**這次必須 5-step 完整 console-instrument，禁止猜**。

#### Step 1: Instrument

`BattleScreen.onMount` 在 `this.gridPlacementA = this.computeGridPlacement(...)` 之後（既 L294-295 後面）加 DEV log（既有 L297-298 chore 殘留可保留）：

```ts
if (import.meta.env.DEV) {
  console.log('[Chore161] === SPIRIT COUNT DEBUG ===');
  console.log('[Chore161] cfg.selectedA:', this.cfg.selectedA, 'len:', this.cfg.selectedA.length);
  console.log('[Chore161] cfg.selectedB:', this.cfg.selectedB, 'len:', this.cfg.selectedB.length);
  console.log('[Chore161] formationA non-null:',
    this.formationA.filter(u => u !== null).length, '/', this.formationA.length);
  console.log('[Chore161] formationB non-null:',
    this.formationB.filter(u => u !== null).length, '/', this.formationB.length);
  console.log('[Chore161] gridPlacementA:', this.gridPlacementA, 'len:', this.gridPlacementA.length);
  console.log('[Chore161] gridPlacementB:', this.gridPlacementB, 'len:', this.gridPlacementB.length);
}
```

`drawFormation(side)` 開頭（既 L920 grid 取得後）加：

```ts
if (import.meta.env.DEV) {
  console.log(`[Chore161] drawFormation ${side} START`);
  const placement = side === 'A' ? this.gridPlacementA : this.gridPlacementB;
  console.log(`[Chore161]   placement:`, placement);
  console.log(`[Chore161]   grid len:`, grid.length);
}
```

`slotToArenaPos(side, slot)` 內（既 L1013-1021）加：

```ts
const cellX = gridLeftX + mirroredCol * NINE_STEP + NINE_CELL_SIZE / 2;
const cellY = NINE_GRID_TOP_Y + row * NINE_STEP + NINE_CELL_SIZE / 2;
if (import.meta.env.DEV) {
  console.log(`[Chore161]   ${side} slot=${slot} cellIdx=${cellIdx} row=${row} col=${col} mirroredCol=${mirroredCol} → x=${cellX} y=${cellY}`);
}
return { x: cellX, y: cellY, row };
```

每個 spirit container 創建後（找 drawFormation 內 spiritContainer / spiritSprite addChild 處）加：

```ts
if (import.meta.env.DEV) {
  console.log(`[Chore161]   ${side} spirit-${slot} placed at (${spirit.x}, ${spirit.y}) scale=${spirit.scale.x.toFixed(2)} visible=${spirit.visible}`);
}
```

#### Step 2: Reproduce

進 incognito browser → 選 5v5 → 按 START → 看 console。

**不要動代碼**，只看 console 輸出。

#### Step 3: Localize from evidence

可能 cause（按優先級）：

##### Case 1: formation 真的少
console 顯示 `formationA non-null: 4/9` → 真的少 1 個 spirit → DraftScreen → BattleScreen 傳遞 bug 或 createFormation bug。**先別改 createFormation**，flag 給 owner。

##### Case 2: gridPlacement 重複
console 顯示 `gridPlacementA: [0,1,2,2,4]` 有重複 cellIdx → Fisher-Yates collision。**檢查 computeGridPlacement 邏輯但不重寫**。

##### Case 3: B side gridLeftX 跑出畫面
console 顯示 B side cellX > CANVAS_WIDTH (>720) 或 < 0 → NINE_B_GRID_LEFT_X 計算錯。**修常數**（不改 NineGrid 邏輯）。

##### Case 4: spirit visible=false 或 z-index 互蓋
console 顯示 5 個 spirit 都 placed 但 visible=true 卻**被截圖看不到** → Container 被 mask / 被覆蓋 / scale 跑掉。檢查 sortableChildren / parent.mask / parent.alpha。

##### Case 5: spirit container x 真的相同
console 顯示某 2 個 spirit cellX 一模一樣 → **真實 collision**。檢查 row+col 邏輯。

##### Case 6: Spirit 視覺寬度 > NINE_STEP (104px) 還是 overlap（chore #160 殘留）
spirit container 顯示 scale=1.10 + base width 130 → 143px > 104px = **再次 overlap by 19.5px each side**。Fix: 縮 SPIRIT_H_BASE 從 130 → 90，OR 加大 NINE_GAP 24→44。

#### Step 4: Fix

依 Case 結果**單點修正**。**禁止「以防萬一順便改」**。

#### Step 5: Cleanup

修完**移除所有 [Chore161] DEV console.log**（保留 chore #160 既有 [NineGrid] log）。

**Commit 2**: `fix(chore): spirit 5v5 actual root cause — [從 console evidence 寫實際 case]`

**Handoff 必須回報**：
- console 輸出片段（前 20 行）
- 真實 root cause 屬於 Case 1-6 哪個
- 具體 fix 對應修了什麼數值 / 邏輯

---

### 3c. Commit 3 — SLOT 全 ball 深色文字 + 咒紫調淡

`SlotReel.ts` 兩處改：

#### Part A: SYMBOL_VISUAL — 咒紫調淡

L23：`9: { char: '咒', color: 0x8b3aaa }` 太深紫 → 改 `0xc77fe0` 較淺紫（**必驗對比**：淺紫 0xc77fe0 + 深棕文字 0x4a3a1a 對比 ~5:1 ✓ WCAG AA）。

L24：`10: { char: '散', color: 0xff3b6b }` (粉紅) — 對深棕文字對比 ~4.5:1 borderline，可保留**或**調成 `0xff7fa0` 較淺粉（對比 ~6:1）。Executor 用 contrast checker 決定，預設保留原色。

#### Part B: setCellSymbol — 全 ball 深色文字

找 `setCellSymbol()` 內 `charText` 創建處（chore #160 留下的 `isWhiteClan` 條件）：

當前：
```ts
const isWhiteClan = symId === 2 || symId === 3;
const charText = new Text({
  ...
  fill: isWhiteClan ? 0x4a3a1a : 0xFFFFFF,
  stroke: { color: visual.color, width: isWhiteClan ? 1 : 2 },
  ...
});
```

改成（**全部深色**）：
```ts
// chore #161: ALL ball use dark text for unified contrast on glossy ball
const charText = new Text({
  text: visual.char,
  style: {
    fontFamily: 'Noto Serif TC, "Ma Shan Zheng", serif',
    fontWeight: '700',
    fontSize: Math.round(r * 0.95),
    fill: 0x2a1a05,                                       // dark warm-brown for all
    stroke: { color: visual.color, width: 1.5 },          // clan stroke matches ball color
    dropShadow: {
      color: visual.color,
      alpha: 0.5,
      blur: 6,
      distance: 0,
    },
  },
});
```

**對比驗證**（depth text 0x2a1a05 對各 clan ball glow color）：
- azureGlow `0x7ae8ff` (亮天藍) vs `0x2a1a05`：~10:1 ✓ AAA
- whiteGlow `0xfff0b3` (米黃) vs `0x2a1a05`：~13:1 ✓ AAA
- vermilionGlow `0xffaa70` (橘) vs `0x2a1a05`：~8:1 ✓ AAA
- blackGlow `0xa8e8d0` (mint) vs `0x2a1a05`：~10:1 ✓ AAA
- GOLD.glow `0xfde08a` (亮金) vs `0x2a1a05`：~11:1 ✓ AAA
- 0xc77fe0 淺紫 vs `0x2a1a05`：~5:1 ✓ AA
- 0xff3b6b 粉紅 vs `0x2a1a05`：~4.5:1 ✓ AA

**Commit 3**: `tune(chore): unify SLOT ball dark text + lighten curse purple for AA contrast`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts` — drawJackpotMarquee MAJOR/MINOR anchor + spirit 5v5 debug log + 5-step fix
- `src/screens/SlotReel.ts` — SYMBOL_VISUAL curse color + setCellSymbol charText fill

**禁止**：
- 動機制（SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin / Streak）
- 動 createFormation logic（若 Case 1 真實 bug，flag 不重寫）
- 動 NineGrid Fisher-Yates 算法（若 Case 2 真實 bug，flag）
- 動 SYMBOL_VISUAL char mapping（只動 color）
- 動 DesignTokens CLAN colors（不動 clan glow palette）
- 加新 asset
- 改 res-01 / pace-01 / 既有 ceremony / fx
- 改 main.ts
- 改 SPEC.md
- 改 sim-rtp.mjs

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**（per `incremental-implementation`）
3. push + PR URL
4. **Issue 2 必須 console-instrument-first**（不准 hypothesis-first 改 const）
5. **Preview 驗證 critical**：
   - JP marquee MAJOR "500,020" + MINOR "50,035" 文字**底部完全在 panel 內**（不出框）
   - 進 Battle 5-pick draft 後 BattleScreen 看到**雙方各 5 spirit**（A 側 5 + B 側 5 = 10 全可見，無 overlap）
   - Reel 內所有 ball 文字統一深色清楚可讀（青/白/朱/玄/替/咒/散/寶 全部）
   - 咒（curse）紫色 ball 變淺紫 + 深色文字對比清楚（不再深紫底深字看不清）
   - 無 [Chore161] DEV console log 殘留（production cleanup 過）
6. 截圖 1 張（含 JP marquee 不出框 + 5v5 完整站位 + 全色 ball 深字 + 咒紫淺色）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- **Issue 2 真實 root cause（一句話從 console evidence 寫清楚 — Case 1-6 哪個）**
- console 輸出片段（前 20 行 [Chore161] log）
- 5v5 是否實際所有 10 個 spirit 都可見 + 不 overlap
- MAJOR/MINOR 20pt 是否仍夠大易讀（vs 22pt）
- 全 ball 深色文字統一感（owner 的需求達成？）
- 紫珠調淡程度（主觀）
- Spec deviations：預期 0
