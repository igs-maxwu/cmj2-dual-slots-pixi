# Sprint 3 C · 02 polish — JP area 背景填色 + HP label 可讀性修正

## 1. Context

PR: **BattleScreen 兩個視覺 bug 一起收**

1. **JP marquee 背景透明棋盤格**：jp-marquee.png 的 ornate 金框中間是透明設計，目前沒畫底色 panel → y=130-330 看到背景棋盤格，人/地/天 文字像漂浮空中
2. **HP label 不可見 (alive 時)**：雀靈頭頂 HP 數字應該在存活時顯示 `2000` 等字樣，實測幾乎看不到（FONT_SIZE.xs=11 + cream 色 + 無 stroke/shadow，在深色 arena 背景被吃掉）

Source:
- `src/screens/BattleScreen.ts`：
  - `drawJackpotMarquee()` line 325-349（加 bg panel 的位置）
  - `refreshFormation()` line 519-537（HP label 設定的位置）
  - `drawFormation()` line 380-410（label 建立的位置，style 要改）

Base: master HEAD
Target: `fix/sprint3c-02-polish-jp-hp`

## 2. Spec drift check (P6)

1. 確認 `drawJackpotMarquee()` 順序：目前先 `addChild(marquee)` 再加 3 個金色 tier 文字。加 bg panel 要在 marquee `addChild` **之前**（順序壓在 marquee Sprite 下面）
2. 確認 `JP_AREA_Y=138` / `JP_AREA_H=200` 常數存在（line 34-35）
3. 確認 `FormationCellRefs.label: Text` 結構存在（line 58 附近）

## 3. Task

### 3a. JP marquee 背景 panel（加在 drawJackpotMarquee() 最前面）

在 `drawJackpotMarquee()` line 326 `const tex = ...` **之前**插：

```ts
// Opaque ink-wash panel behind jp-marquee PNG (prevents transparent checkerboard bleed)
const bgPanel = new Graphics()
  .roundRect(16, JP_AREA_Y, CANVAS_WIDTH - 32, JP_AREA_H, T.RADIUS.lg)
  .fill({ color: T.SEA.deep, alpha: 0.85 })
  .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
this.container.addChild(bgPanel);
```

視覺：深海藍 panel + 金色 hairline 邊框，配合上層 jp-marquee 金框形成雙層裝飾感。

### 3b. HP label 可讀性（改 drawFormation() 裡 label 建立的區塊）

找 `drawFormation()` line 386-397 附近 label Text 建立處（原本 `fontSize: T.FONT_SIZE.xs`），改為：

```ts
const label = new Text({
  text: '',
  style: {
    fontFamily: T.FONT.num,
    fontWeight: '700',
    fontSize:    T.FONT_SIZE.md,           // 原 xs (11) → md (15)
    fill:        T.FG.cream,
    align:       'center',
    stroke:      { color: T.SEA.abyss, width: 3 },    // dark outline for contrast
    dropShadow:  { color: 0x000000, alpha: 0.6, blur: 4, distance: 1 },
  },
});
label.anchor.set(0.5, 1);
label.y = -SPIRIT_H - 4;                    // 原 -8 → -4（字大一點需要往下一點貼近頭頂）
```

關鍵：`stroke` + `dropShadow` 確保在任何戰場背景都可讀。

### 3c. 檢查 refreshFormation label 顯示邏輯

line 519-537 `refreshFormation()`：確認 alive 狀態下 `ref.label.text = '${unit.hp}'` 與 `ref.label.alpha = 1` 正確執行。若發現 `.visible` 屬性被某處設成 false 未還原，加回 `ref.label.visible = true` 在 alive 分支。

### 3d. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 只此一檔

**禁止**：
- jp-marquee.png 素材（不動）
- DesignTokens（不新增色票）
- AmbientBackground / SpiritPortrait / SlotReel（都不碰）
- SPEC.md

**若發現 refreshFormation label 有別的 bug（例如被 crossMark 覆蓋、z-order 錯），STOP 回報後再動**

## 4. DoD

1. `npm run build` 過
2. No `console.log` / `debugger`
3. commit + push `fix/sprint3c-02-polish-jp-hp`
4. PR URL

注意：
- bg panel 要加在 marquee 之前，不然會蓋掉 marquee 圖案
- HP label style 改動 **不要** 改 fontFamily（保持 Cinzel num 風格）
- `T.FONT_SIZE.md` = 15px（見 DesignTokens line 165）

## 5. Handoff

- PR URL
- 1 行摘要
- 若 HP label 原本其實有顯示只是太小，回報「視覺偏弱是主因」；若有 visible 邏輯 bug 也回報
- 附 1 張 preview 截圖（若方便）
