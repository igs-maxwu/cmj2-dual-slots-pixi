# Chore — LoadingScreen 中央區域不該存在的細線（owner 試玩 bug report）

## 1. Context

PR: **LoadingScreen 在「Loading spirits N/8」progress bar 上方、logo 下方有一條不該存在的細線（owner 截圖紅箭頭指出）。**修掉它。**

Why: Owner Sprint 9 結束後試玩看到 visual bug — 一條從畫面左邊延伸的細線穿過 loading 區段，明顯不該在那。

Bug 視覺特徵：
- Y 位置：約 `CANVAS_HEIGHT/2` 中段（logo 下緣 / progress bar 上緣之間）
- X 範圍：從畫面左邊延伸到中央（約半個 canvas 寬度）
- 顏色：暗色細線（不像 progress bar 的金色）
- 出現時機：preload 後 `upgradeToDecoratedLoadingScreen` 觸發後可見

---

## 兩個主要嫌疑（按可能性排序）

### 嫌疑 1：subtitle「DUAL SLOTS BATTLE」沒被 hide

`drawTitle()` (line 57-82) 創建兩個 Text：
- `this.titleText`（中文「雀靈戰記」）
- `sub`（英文「DUAL SLOTS BATTLE」）— **無 class field reference，不能後續 hide**

`upgradeToDecoratedLoadingScreen()` line 127：
```ts
if (this.titleText) this.titleText.visible = false;
```
只 hide 中文 title。英文 sub 跟 logo 重疊，但 logo 通常不含英文字 → 殘留 sub 可見。

`sub` 配色 `fill: T.FG.muted` + `letterSpacing: 12` — 灰色字距 12 看起來可能像細點線/虛線。

### 嫌疑 2：divider sprite

line 131-141 載入 `divider` asset，scaled to width 560px。
- 若 divider asset 是單純細線（無裝飾）→ 看起來就是條線
- alpha 0.85 還算明顯

Owner 截圖中的線比 divider 寬度更長嗎？不確定 — executor live 確認。

### 嫌疑 3（次要）：progress bar track 的 stroke 渲染外溢

line 88-92：
```ts
const track = new Graphics()
  .roundRect(this.trackX, this.trackY, TRACK_W, TRACK_H, TRACK_H / 2)
  .fill(T.HP.track)
  .stroke({ width: 1, color: T.GOLD.deep, alpha: 0.7 });
```
Pixi 8 `.stroke()` 在 `.fill()` 後 apply 到同 path — 應該只描 rounded rect 邊。**但若 stroke alpha + width 渲染 artifact 在某些 GPU 上溢出，可能有 1-2px ghost 線**（low probability）。

---

## Skills suggested for this PR

- **`debugging-and-error-recovery`** — 5-step triage：reproduce → localize → reduce → fix → guard。先在 preview reproduce，open DevTools 用 Pixi Inspector（若有）或 console.log container.children 找到具體 source。
- **`code-simplification`** — 修 fix 後不該破壞 LoadingScreen 既有 fade-in / decorated-upgrade flow。
- **`source-driven-development`** — 不憑感覺刪東西，先確認到底是哪個物件造成。

---

## 2. Spec drift check (P6)

1. `mempalace_search "LoadingScreen subtitle divider stray line bug visual"`
2. 確認 LoadingScreen.ts line 57-141（drawTitle / drawProgress / upgradeToDecoratedLoadingScreen）
3. 確認 owner 截圖 bug 在 `?demo=1` 模式或正常模式都會出現（**預期：兩種都出現** — bug 在 LoadingScreen 階段，與 demo flag 無關）

## 3. Task

### 3a. 先 reproduce + localize（debugging-and-error-recovery）

進 preview（local 或 GitHub Pages 都行）— 走到 LoadingScreen 看到問題。

打開 DevTools console，**暫時**在 `upgradeToDecoratedLoadingScreen()` 末尾加：

```ts
if (import.meta.env.DEV) {
  console.log('[LoadingScreen] container children after decorated:',
    this.container.children.map(c => ({ type: c.constructor.name, x: c.x, y: c.y, w: (c as any).width, h: (c as any).height, alpha: c.alpha, visible: c.visible })));
}
```

打開 console 看完整 children list。對照 y 座標找出可疑物件。

**或**更直接：用 Pixi DevTools Chrome extension（若已裝）— 樹狀檢查每個 Sprite/Text/Graphics。

### 3b. 修復路徑（按嫌疑順序試）

#### Fix 1：hide subtitle when logo loads

加 class field：

```ts
private subText: Text | null = null;
```

drawTitle 末段：

```ts
// 既有:
const sub = new Text({ ... });
// 改成:
this.subText = new Text({ ... });
this.subText.anchor.set(0.5, 0.5);
this.subText.x = CANVAS_WIDTH / 2;
this.subText.y = CANVAS_HEIGHT / 2 - 10;
this.container.addChild(this.subText);
```

`upgradeToDecoratedLoadingScreen` 在 `if (this.titleText) this.titleText.visible = false;` 同處加：

```ts
if (this.subText) this.subText.visible = false;
```

跑一次 preview 看 bug 是否消失 — 若是，**Fix 1 已足**，commit + push。

#### Fix 2：移除或微調 divider（若 Fix 1 後線還在）

option A：完全拿掉 divider

line 131-141 整段 `if (divTex) {...}` 註解或刪除。

option B：只移除 alpha（讓它透明但不刪除架構）

```ts
div.alpha = 0;   // 0.85 -> 0
```

option C：縮短 divider width（若它真的太寬）

```ts
const w = 280;   // 560 -> 280
```

執行 reproduce 看哪個方向最好。**executor 自選 A/B/C**，A 最乾淨。

#### Fix 3：track stroke 修正（若 Fix 1 + 2 後仍可見）

line 88-92：

```ts
const track = new Graphics()
  .roundRect(this.trackX, this.trackY, TRACK_W, TRACK_H, TRACK_H / 2)
  .fill(T.HP.track);
// 把 .stroke() 改放到獨立 Graphics 上避免 path 融合 bug:
const trackBorder = new Graphics()
  .roundRect(this.trackX, this.trackY, TRACK_W, TRACK_H, TRACK_H / 2)
  .stroke({ width: 1, color: T.GOLD.deep, alpha: 0.7 });
this.container.addChild(track);
this.container.addChild(trackBorder);
```

### 3c. Cleanup（commit 之前必做）

1. **刪掉**任何 console.log debug instrumentation（§3a 加的暫時 log）
2. **若加了新 class field（subText），onUnmount 不需特別清** — `this.container.destroy({children:true})` 已涵蓋
3. **驗證** Loading 期間進度條動畫 + status text 仍正常更新

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/LoadingScreen.ts` 唯一檔（修 bug + 可能加 1 個 class field）

**禁止**：
- DesignTokens / SymbolsConfig / SlotEngine 等任何 system
- DraftScreen / BattleScreen / ResultScreen
- main.ts
- 加新 asset
- scripts/sim-rtp.mjs
- LoadingScreen 既有 preload 流程（preloadUi / preloadGems / preloadSpirits / preloadFx）— **完全不動**
- LoadingScreen 既有 layout y 座標（保留 visual hierarchy）

## 4. DoD

1. `npm run build` 過
2. **1 commit**（小修 bug，不該超過）
3. push + PR URL
4. **Preview 驗證 critical**：
   - 重整 page → 看到 LoadingScreen → owner 截圖那條線**不再出現**
   - 進度條 + status text 正常運作（preload 流程沒破壞）
   - Logo + 雀靈戰記 字樣顯示正常（中文 title 正確 hide 不重疊）
5. 截圖 1 張 LoadingScreen（bug 已修復後）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（修復後）
- 哪個 Fix 路徑解決了 bug（Fix 1 / Fix 2A/B/C / Fix 3）
- 加了哪個 class field（若有）
- 任何意外發現（例如「subtitle 字其實是另一個原因」）
- Spec deviations：預期 0
