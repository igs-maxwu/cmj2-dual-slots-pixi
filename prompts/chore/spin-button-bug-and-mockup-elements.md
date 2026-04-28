# Chore — SPIN 按鈕點擊無效 + 加 mockup 還沒實作的 UI 元件（AUTO / SKIP / PAYLINES + reel header 文字）

## 1. Context

PR: **(1) Debug SPIN button — owner 試玩 #150 後反映「SPIN按鈕還是沒有用」，點擊無反應。(2) 補完 mockup variant-a.jsx 還沒實作的元素：AUTO 按鈕 / SKIP 按鈕 / PAYLINES 1-10 indicator / reel header 文字「A · YOUR TURN ◇ SHARED BOARD ◇ B · WAITING」。**

Why: Owner 拿 mockup 跟現狀對比，「遊戲還是長得不像這個示意圖」。Owner 明確要求：（a）SPIN 要能用，（b）視覺對齊 mockup variant-a.jsx 完整版（之前 Path 1 守則拒絕加的 AUTO/SKIP/PAYLINES 都加回來作為**裝飾性 UI** — 不真的改機制）。

Mockup reference:
- `download_picture/Dual Slot Pixi/battle-variant-a.jsx` line 158-222 (action bar SPIN/AUTO/SKIP + PAYLINES indicator + reel header)
- `download_picture/Dual Slot Pixi/battle-shared.jsx` line 573-625 (PrimaryCTA + GhostBtn 風格參考)

---

## Issue 1: SPIN button 點擊無效（**最 critical**）

PR #150 實作 SPIN button + `pointertap` listener，但 owner 反映無作用。最常見 Pixi 8 Container click 不 fire 的原因：

### Root cause hypothesis (按可能性排序)

#### (A) **Container 沒 hit area**（最可能）
Pixi 8 Container 預設**沒有 hit area** — 即使設了 `eventMode: 'static'` + `cursor: 'pointer'` + `on('pointertap', fn)`，沒 hit area 點擊不會 fire。`Graphics` 物件有自己 hit area（從 drawn shape 算），但 Container 不會繼承。

**Fix**：
```ts
import { Rectangle } from 'pixi.js';
this.spinButton.hitArea = new Rectangle(0, 0, SPIN_BTN_W, SPIN_BTN_H);
```

#### (B) `sortableChildren` 沒啟用 / zIndex 不夠高
SPIN button zIndex=200 但 container 若 sortableChildren=false（雖然 #142 應該已 set true），點擊會被前面 addChild 的東西擋。

**Verify**：preview console `console.log(this.container.sortableChildren)` → 必須 true。

#### (C) 被其他 eventMode='static' 元素擋
如果 reel container 或 battle log panel 也是 eventMode='static' 且 zIndex 比 SPIN button 大 → 攔截 click。

**Verify**：暫時把 spinButton zIndex 拉到 999 看是否可點。

#### (D) Promise 一直沒 resolve / loop 沒 await
loop() 或 waitForSpinClick 邏輯上沒銜接 — 點擊有 fire 但 promise resolve 後 while loop 沒接著跑。

**Verify**：onSpinClick 內加 `console.log('[SPIN] click fired, spinClickResolve=', this.spinClickResolve)`。

---

## Issue 2: Mockup 還沒實作的 UI 元件

### (a) AUTO + SKIP 按鈕

Mockup variant-a.jsx line 226-233：

```jsx
<GhostBtn label="AUTO" />
<PrimaryCTA label="SPIN" sub="-100 NTD" glow/>
<GhostBtn label="SKIP" />
```

3 button 並排：
- **AUTO** (left): ghost style (透明背景 + 邊框 + 灰字)
- **SPIN** (center): 已實作金色 primary
- **SKIP** (right): ghost style 同 AUTO

GhostBtn 風格（mockup line 603-625）：
- 110×46
- background: transparent
- border: 1px muted alpha 0.5
- text: 14pt body, muted color, letterSpacing 3

### (b) PAYLINES 1-10 indicator

Mockup variant-a.jsx line 204-222：

```
PAYLINES [1][2][3][4][5][6][7][8][9][10]
         ▓▓ ▓▓ ▓▓ ☐  ☐  ☐  ☐  ☐  ☐  ☐
        (前 N 個高亮 = 該 spin wayHit 數)
```

10 個小方格 14×14px：
- 前 N 個 (N = wayHit count, max 10) 金色 fill + 黑字
- 後 10-N 個 transparent + muted border

裝飾性 — 我們是 243-Ways 不是 paylines，但**視覺上對齊 mockup**。N 用 `min(spin.sideA.wayHits.length + spin.sideB.wayHits.length, 10)`。

### (c) Reel header 文字更新

當前 (PR #147)：
```
A · 我方           ◇ SHARED BOARD ◇           B · 對手
```

改成 (mockup variant-a.jsx line 158-191)：
```
● A · YOUR TURN     ◇ SHARED BOARD ◇     B · WAITING ○
```

差異：
- A 側加 solid dot indicator（azure 色，box shadow glow）
- B 側用 hollow circle indicator（muted 色，1.5px border）
- A 字串 "我方" → "YOUR TURN" + "● " prefix dot
- B 字串 "對手" → "WAITING" + " ○" suffix circle

**注意**：這是純 decorative UI，因為 SPIN button 是玩家手動點 (永遠是 A 在 turn)，所以 dot 不需狀態切換。

---

## Skills suggested for this PR

- **`debugging-and-error-recovery`** — Issue 1 走 5-step：reproduce（preview 點 SPIN）→ instrument (console.log onSpinClick fire 與否)→ localize（hitArea / zIndex / promise chain）→ fix → guard。**禁止憑感覺**改，要 console 看真實 fire 狀態。
- **`incremental-implementation`** — **3-4 atomic commits**：(1) SPIN debug + fix，(2) AUTO+SKIP buttons，(3) PAYLINES indicator，(4) reel header 文字。每個 commit build 過 + visual verify。
- **`source-driven-development`** — Pixi 8 Container interaction docs 確認 hitArea requirement（沒 hit area Container 不會 fire pointer events，這是 v8 行為，v7 較寬鬆）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "SPIN button bug AUTO SKIP PAYLINES Pixi 8 container hitArea"`
2. 確認 BattleScreen.ts `drawSpinButton` (PR #150 加的) + `onSpinClick` + `waitForSpinClick`
3. 確認 `this.container.sortableChildren = true` 已在 onMount 設（p10-bug-01 / p2-A 加的）
4. 確認 既有 `drawReelHeader` (p11-vA-01 加) 在 BattleScreen.ts
5. 確認 mockup variant-a.jsx + battle-shared.jsx 細節（**executor 必讀**，特別是 PrimaryCTA / GhostBtn 視覺）

## 3. Task

### 3a. Issue 1 SPIN debug + fix（**先做，commit 1**）

**Step 1 — Reproduce**：preview 進 Battle，點 SPIN 看是否任何反應。

**Step 2 — Instrument**：暫加 DEV log：

```ts
private onSpinClick(): void {
  if (import.meta.env.DEV) {
    console.log('[SPIN] click fired, spinClickResolve=', this.spinClickResolve);
  }
  if (this.spinClickResolve) {
    // ... existing ...
  }
}

// In drawSpinButton, after .on('pointertap', ...):
if (import.meta.env.DEV) {
  console.log('[SPIN] button created at', this.spinButton.x, this.spinButton.y, 'eventMode=', this.spinButton.eventMode);
}
```

**Step 3 — Localize**：點 SPIN 看 console — 是 fire 但 spinClickResolve null？還是根本沒 fire？

**Step 4 — Fix**：

#### Most likely fix: Add hitArea to Container

```ts
import { Rectangle } from 'pixi.js';

private drawSpinButton(): void {
  this.spinButton = new Container();
  // ... existing setup ...

  // chore: explicit hit area (Pixi 8 Container needs this)
  this.spinButton.hitArea = new Rectangle(0, 0, SPIN_BTN_W, SPIN_BTN_H);

  this.spinButton.eventMode = 'static';
  this.spinButton.cursor    = 'pointer';
  this.spinButton.on('pointertap', () => this.onSpinClick());

  this.container.addChild(this.spinButton);
}
```

**Step 5 — Guard**：fix 後**移除 DEV log**（不留 console pollution）。

**Commit 1**: `fix(chore): SPIN button hitArea — Pixi 8 Container click event requires explicit Rectangle hitArea`

### 3b. AUTO + SKIP 按鈕（commit 2）

加 const + class fields:

```ts
const SPIN_BTN_GAP   = 16;
const GHOST_BTN_W    = 110;
const GHOST_BTN_H    = 46;

private autoButton!: Container;
private skipButton!: Container;
```

新 helper method `drawGhostButton(label, onClick): Container`:

```ts
private drawGhostButton(label: string, onClick: () => void): Container {
  const btn = new Container();
  const bg = new Graphics()
    .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
    .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
  btn.addChild(bg);

  const text = new Text({
    text: label,
    style: {
      fontFamily: T.FONT.body, fontWeight: '600', fontSize: 14,
      fill: T.FG.muted, letterSpacing: 3,
    },
  });
  text.anchor.set(0.5, 0.5);
  text.x = GHOST_BTN_W / 2;
  text.y = GHOST_BTN_H / 2;
  btn.addChild(text);

  // chore: explicit hit area (per Issue 1 fix)
  btn.hitArea = new Rectangle(0, 0, GHOST_BTN_W, GHOST_BTN_H);
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.on('pointertap', onClick);

  return btn;
}
```

`drawSpinButton()` 後加：

```ts
// AUTO button (left of SPIN)
this.autoButton = this.drawGhostButton('AUTO', () => this.onAutoClick());
this.autoButton.x = (CANVAS_WIDTH - SPIN_BTN_W) / 2 - GHOST_BTN_W - SPIN_BTN_GAP;
this.autoButton.y = SPIN_BTN_Y + (SPIN_BTN_H - GHOST_BTN_H) / 2;   // vertical center align
this.container.addChild(this.autoButton);

// SKIP button (right of SPIN)
this.skipButton = this.drawGhostButton('SKIP', () => this.onSkipClick());
this.skipButton.x = (CANVAS_WIDTH + SPIN_BTN_W) / 2 + SPIN_BTN_GAP;
this.skipButton.y = SPIN_BTN_Y + (SPIN_BTN_H - GHOST_BTN_H) / 2;
this.container.addChild(this.skipButton);
```

### onAutoClick / onSkipClick 行為

```ts
private autoMode = false;
private autoTimer?: number;

private onAutoClick(): void {
  this.autoMode = !this.autoMode;
  if (this.autoMode) {
    this.autoButton.alpha = 0.6;   // active state visual
    // Auto-click SPIN every 2s if button is enabled
    this.autoTimer = window.setInterval(() => {
      if (this.spinClickResolve) this.onSpinClick();
    }, 2000);
  } else {
    this.autoButton.alpha = 1;
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = undefined;
    }
  }
}

private onSkipClick(): void {
  // chore: SKIP currently a placeholder — animations are pace-01 controlled
  // Future: could trigger Promise.race to skip current spin animation
  // For now, just visual feedback
  if (import.meta.env.DEV) console.log('[SKIP] (placeholder — animation skip not yet implemented)');
}
```

`onUnmount` 清 autoTimer:
```ts
if (this.autoTimer) clearInterval(this.autoTimer);
```

**Commit 2**: `feat(chore): AUTO + SKIP buttons (AUTO toggles 2s auto-spin loop, SKIP placeholder)`

### 3c. PAYLINES indicator（commit 3）

加 const:
```ts
const PAYLINES_Y = 935;   // just above SPIN_BTN_Y=970
const PAYLINES_CELL_W = 14;
const PAYLINES_CELL_H = 14;
const PAYLINES_GAP = 4;
```

加 class fields + method:

```ts
private paylinesContainer!: Container;
private paylinesCells: Graphics[] = [];

private drawPaylinesIndicator(): void {
  this.paylinesContainer = new Container();

  // Label "PAYLINES" left
  const label = new Text({
    text: 'PAYLINES',
    style: {
      fontFamily: T.FONT.body, fontWeight: '500', fontSize: 9,
      fill: T.FG.muted, letterSpacing: 3,
    },
  });
  label.anchor.set(0, 0.5);
  this.paylinesContainer.addChild(label);

  // 10 cells right of label
  let xOffset = label.width + 12;
  for (let i = 0; i < 10; i++) {
    const cell = new Graphics()
      .roundRect(xOffset, -PAYLINES_CELL_H / 2, PAYLINES_CELL_W, PAYLINES_CELL_H, 2)
      .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
    this.paylinesContainer.addChild(cell);

    const cellText = new Text({
      text: String(i + 1),
      style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 8,
               fill: T.FG.muted },
    });
    cellText.anchor.set(0.5, 0.5);
    cellText.x = xOffset + PAYLINES_CELL_W / 2;
    cellText.y = 0;
    this.paylinesContainer.addChild(cellText);

    this.paylinesCells.push(cell);
    xOffset += PAYLINES_CELL_W + PAYLINES_GAP;
  }

  this.paylinesContainer.x = (CANVAS_WIDTH - xOffset) / 2;   // center horizontally
  this.paylinesContainer.y = PAYLINES_Y;
  this.container.addChild(this.paylinesContainer);
}

private updatePaylinesIndicator(activeCount: number): void {
  const n = Math.min(Math.max(activeCount, 0), 10);
  this.paylinesCells.forEach((cell, i) => {
    cell.clear();
    if (i < n) {
      cell.roundRect(0, -PAYLINES_CELL_H / 2, PAYLINES_CELL_W, PAYLINES_CELL_H, 2)
          .fill({ color: T.GOLD.base })
          .stroke({ width: 1, color: T.GOLD.base });
    } else {
      cell.roundRect(0, -PAYLINES_CELL_H / 2, PAYLINES_CELL_W, PAYLINES_CELL_H, 2)
          .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
    }
  });
}
```

**注意**：`cell.clear()` 後 redraw — 但 cell 是用 `roundRect(xOffset, ...)` 創建的，xOffset 在 redraw 內不知道。**Fix**：改成把 `xOffset` 存進 cell（或調整創建時讓 cell relative position 在自己 origin）。

Refactor cleanly:

```ts
// Each cell at its own x position via container child x
const cellRoot = new Container();
cellRoot.x = xOffset;
const cell = new Graphics()
  .roundRect(0, -PAYLINES_CELL_H / 2, PAYLINES_CELL_W, PAYLINES_CELL_H, 2)
  .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
cellRoot.addChild(cell);
// ... cellText ...
this.paylinesContainer.addChild(cellRoot);
this.paylinesCells.push(cell);   // store the Graphics for redraw
```

呼叫 `updatePaylinesIndicator()` 在 loop() 每 spin reveal stage 之後：

```ts
// In loop() after Stage 2 REVEAL:
const totalHits = (spin.sideA.wayHits?.length ?? 0) + (spin.sideB.wayHits?.length ?? 0);
this.updatePaylinesIndicator(totalHits);
```

**Commit 3**: `feat(chore): PAYLINES 1-10 decorative indicator (lights up first N based on wayHit count)`

### 3d. Reel header 文字更新（commit 4）

既有 `drawReelHeader` (p11-vA-01) 改：

當前：
```ts
const aLabel = new Text({ text: 'A · 我方', ... });
const sbLabel = new Text({ text: '◇ SHARED BOARD ◇', ... });
const bLabel = new Text({ text: 'B · 對手', ... });
```

改成：

```ts
// Left: solid dot + "A · YOUR TURN"
const aDot = new Graphics()
  .circle(headerLeftX - 14, headerY + 6, 4)
  .fill({ color: T.CLAN.azureGlow });
// Add subtle glow filter for "active" state
aDot.filters = [new GlowFilter({ color: T.CLAN.azureGlow, distance: 8, outerStrength: 1.5 })];

const aLabel = new Text({
  text: 'A · YOUR TURN',
  style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 10,
           fill: T.CLAN.azureGlow, letterSpacing: 3 },
});

// Center: ◇ SHARED BOARD ◇ (不變)

// Right: "B · WAITING" + hollow circle
const bLabel = new Text({
  text: 'B · WAITING',
  style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 10,
           fill: T.FG.muted, letterSpacing: 3 },   // 改成 muted (waiting state)
});

const bDot = new Graphics()
  .circle(headerRightX + 14, headerY + 6, 4)
  .stroke({ width: 1.5, color: T.FG.muted, alpha: 0.8 });
// No fill (hollow circle)
```

B label 從 vermilion 改 muted 色，顯示「等待」狀態。

**Commit 4**: `feat(chore): reel header text update — A · YOUR TURN (active) / B · WAITING (idle)`

### 3e. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔
- SPIN button hitArea fix
- AUTO + SKIP button creation
- onAutoClick / onSkipClick handlers
- PAYLINES indicator + updatePaylinesIndicator
- Reel header label 改文字 + dot states

**禁止**：
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- DraftScreen / LoadingScreen / ResultScreen / FXPreviewScreen
- main.ts
- DesignTokens
- 加新 asset
- scripts/sim-rtp.mjs
- 改 res-01 / pace-01 / 既有 NineGrid 邏輯
- AUTO / SKIP 真實機制（AUTO 只是定時 click SPIN，SKIP 純 placeholder — 不真改 spin animation timing）
- 改 SPEC.md（auto-loop 已在 #150 改 manual SPIN，本 PR 加 AUTO 是再次 SPEC drift 但 owner 要求）

## 4. DoD

1. `npm run build` 過
2. **4 個 commits**（per `incremental-implementation`）
3. push + PR URL
4. **Preview 驗證 critical**：
   - 進 Battle，**點 SPIN 確實 trigger spin**（reel 旋轉 / 結果出現）
   - 點 AUTO → 進入 auto 模式（每 2s 自動點 SPIN），按鈕 alpha 0.6 表示 active；再點 AUTO → 退出
   - 點 SKIP → console DEV log 印 「[SKIP] placeholder」（純佔位）
   - PAYLINES 1-10 indicator 在 SPIN button 上方
   - 第一次 SPIN 後，前 N 個 cell 變金色高亮（N = wayHit count, max 10）
   - Reel header 改成「● A · YOUR TURN ◇ SHARED BOARD ◇ B · WAITING ○」
5. 截圖 1-2 張：
   - 1 張 mid-spin（AUTO/SPIN/SKIP 三按鈕 + PAYLINES indicator + 新 header）
   - 1 張 AUTO active state（auto button alpha 0.6）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- **SPIN button bug 真實 root cause**（hitArea / sortableChildren / zIndex / promise chain — 哪個）
- AUTO mode 是否實測 cycle 正確（連按 AUTO 開關幾次無 timer leak）
- PAYLINES indicator update 時機是否合理（reveal 後立刻 update / spin 開始時 reset）
- Reel header A 邊 dot glow / B 邊 hollow circle 視覺感
- Spec deviations：
  - 加 AUTO/SKIP/PAYLINES 是 owner-requested SPEC drift（mockup 對齊）
  - SKIP 是 placeholder（不真做 animation skip — 留 future PR）
- 任何意外發現
