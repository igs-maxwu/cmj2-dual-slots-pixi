# Chore — AUTO 按鈕真正功能化（spin count selector + event-driven + stop conditions）

## 1. Context

當前 (post-#161) AUTO 按鈕是 placeholder：
- 點擊 toggle `autoMode` flag
- `setInterval(..., 2000)` 每 2 秒 fire `onSpinClick`（**timer-based**，不對齊 spin 動畫節奏）
- 沒次數選擇 — 跑到死或玩家手動點停
- 沒 stop conditions — FreeSpin / JP / 對局結束都不會自動停
- Visual 只 alpha 0.6 / 1.0 切換

Owner 要求「實作 SPIN 旁邊的 AUTO 按鈕功能」 → 升級成**真正可用的 AUTO spin** 體驗，比照標準 slot 機（IGS / Konami / Aristocrat 範例）：

1. AUTO 點一下 → 跳 spin count 選擇 popup（10 / 25 / 50 / 100）
2. 選完開始自動跑，按鈕變 "STOP 24"（顯示剩餘次數）
3. 跑完次數自動停 / 點 STOP 立刻取消 / 觸發特定事件自動停
4. 流程 event-driven — 跟 round loop 對齊，不再 setInterval

純視覺 + 流程控制層改動，**不動機制 / 不動 SlotEngine / 不動 round loop 結構**。

---

## Skills suggested for this PR

- **`incremental-implementation`** — 4 atomic commits
- **`source-driven-development`** — 用實際 Pixi Container popup pattern，不發明 framework
- **`debugging-and-error-recovery`** — 若中途 STOP 邏輯卡住（Promise 沒 resolve / round 沒結束）必走 5-step

---

## 2. Spec drift check (P6)

1. `mempalace_search "AUTO button manual spin loop waitForSpinClick autoMode"`
2. 確認 chore #150 manual SPIN 「`await waitForSpinClick()`」 in `loop()` 仍是當前架構（line ~1582-1584）
3. 確認 chore #151 `onAutoClick` setInterval 結構仍是當前 placeholder（line 1265-1280）
4. 確認 既有 `enableSpinButton` / `waitForSpinClick` / `onSpinClick` API（這次重構這 3 個 + onAutoClick）

---

## 3. Task

### 3a. Commit 1 — AUTO state machine refactor（移除 setInterval，改 event-driven）

**目標**：AUTO 變 round-loop 對齊 — 不依賴 wall-clock，只在 `waitForSpinClick` 被呼叫時檢查 autoMode。

#### 3a-1. State 重新定義

`BattleScreen.ts` 上方 private 區塊，把當前：
```ts
private autoMode = false;
private autoTimer?: number;
```

換成：
```ts
private autoSpinsRemaining = 0;       // 0 = AUTO off; >0 = active and counts down
private autoMenuOpen = false;
private autoMenuContainer?: Container;
```

刪掉 `autoTimer` 相關所有引用（onUnmount L466-468 + onAutoClick L1270-1278）。

#### 3a-2. `waitForSpinClick` 升級成 auto-aware

當前：
```ts
private waitForSpinClick(): Promise<void> {
  this.enableSpinButton();
  return new Promise(resolve => {
    this.spinClickResolve = resolve;
  });
}
```

改成：
```ts
private waitForSpinClick(): Promise<void> {
  this.enableSpinButton();

  // AUTO mode: skip click wait, resolve after short delay so player sees visual feedback
  if (this.autoSpinsRemaining > 0) {
    return new Promise(resolve => {
      this.spinClickResolve = resolve;
      // Brief delay (350 ms) so AUTO doesn't feel like a single mashed frame
      setTimeout(() => {
        if (this.spinClickResolve === resolve) {
          this.autoSpinsRemaining -= 1;
          this.refreshAutoButtonLabel();
          this.onSpinClick();              // existing path — sets eventMode=none, alpha 0.5, calls resolve
          if (this.autoSpinsRemaining <= 0) {
            this.stopAutoMode();           // auto-clear when count exhausted
          }
        }
      }, 350);
    });
  }

  return new Promise(resolve => {
    this.spinClickResolve = resolve;
  });
}
```

#### 3a-3. `stopAutoMode` helper

新方法：
```ts
private stopAutoMode(): void {
  this.autoSpinsRemaining = 0;
  this.refreshAutoButtonLabel();
}
```

#### 3a-4. `refreshAutoButtonLabel` helper

新方法（更新 AUTO 按鈕的 text/alpha 視 autoSpinsRemaining 狀態）：
```ts
private refreshAutoButtonLabel(): void {
  const label = this.autoButton.getChildAt(1) as Text;  // 假設 ghostButton 第 2 child 是 text
  if (this.autoSpinsRemaining > 0) {
    label.text = `STOP ${this.autoSpinsRemaining}`;
    this.autoButton.alpha = 0.85;
  } else {
    label.text = 'AUTO';
    this.autoButton.alpha = 1;
  }
}
```

> **注意**：drawGhostButton 內 child order 是 `[bg, text]`，所以 `getChildAt(1)` 拿到 text。若不可靠，改為儲存 `this.autoButtonText` reference 在 drawAutoButton 時。**推薦後者**更明確。

**Commit 1**: `refactor(chore): AUTO state machine — event-driven autoSpinsRemaining replaces setInterval`

---

### 3b. Commit 2 — Spin count selector popup

#### 3b-1. `onAutoClick` 改成「if running → stop / else → open menu」

```ts
private onAutoClick(): void {
  if (this.autoSpinsRemaining > 0) {
    this.stopAutoMode();         // running → cancel
    return;
  }
  if (this.autoMenuOpen) {
    this.closeAutoMenu();        // menu open → toggle close
    return;
  }
  this.openAutoMenu();           // idle → open menu
}
```

#### 3b-2. Popup container

新方法 `openAutoMenu()`：
- 建一個 Container `this.autoMenuContainer`，加到 `this.container` 最上層
- Background scrim：full-canvas 0x000000 alpha 0.5（半透明遮罩，點到遮罩 = close）
- 中央 popup panel：~280×260 px，圓角 dark warm-brown bg（match JP marquee 風格 `0x2a1a04`），金色 1.5px border
- Title text "AUTO SPINS" — 16pt T.GOLD.glow letterSpacing 4
- 4 個按鈕（10 / 25 / 50 / 100）— 用 drawGhostButton helper，120×40 px，2 列 × 2 排，gap 12px
- 點按鈕 → `setAutoSpins(n)` + closeAutoMenu
- panel x = (CANVAS_WIDTH - 280) / 2
- panel y = SPIN_BTN_Y - 280（剛好在 SPIN 按鈕上方彈出，不蓋住 reel）

```ts
private openAutoMenu(): void {
  this.autoMenuOpen = true;
  const menu = new Container();
  this.autoMenuContainer = menu;

  // Scrim (click closes)
  const scrim = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0x000000, alpha: 0.5 });
  scrim.eventMode = 'static';
  scrim.hitArea = new Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  scrim.cursor = 'pointer';
  scrim.on('pointertap', () => this.closeAutoMenu());
  menu.addChild(scrim);

  // Panel
  const panelW = 280, panelH = 260;
  const panelX = (CANVAS_WIDTH - panelW) / 2;
  const panelY = SPIN_BTN_Y - panelH - 20;
  const panelBg = new Graphics()
    .roundRect(panelX, panelY, panelW, panelH, 8)
    .fill({ color: 0x2a1a04, alpha: 1 })
    .stroke({ width: 1.5, color: T.GOLD.base, alpha: 1 });
  menu.addChild(panelBg);

  // Title
  const title = new Text({
    text: 'AUTO SPINS',
    style: { fontFamily: T.FONT.body, fontSize: 16, fill: T.GOLD.glow, letterSpacing: 4, fontWeight: '600' },
  });
  title.anchor.set(0.5, 0);
  title.x = panelX + panelW / 2;
  title.y = panelY + 24;
  menu.addChild(title);

  // 4 option buttons (2×2 grid)
  const counts = [10, 25, 50, 100];
  const btnW = 110, btnH = 44, gap = 12;
  const gridX0 = panelX + (panelW - 2 * btnW - gap) / 2;
  const gridY0 = panelY + 70;
  counts.forEach((n, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const btn = this.drawGhostButton(`${n}`, () => this.setAutoSpins(n));
    btn.x = gridX0 + col * (btnW + gap);
    btn.y = gridY0 + row * (btnH + gap);
    // Override size — drawGhostButton uses GHOST_BTN_W (110) GHOST_BTN_H (46), close enough
    menu.addChild(btn);
  });

  // CANCEL button at bottom
  const cancel = this.drawGhostButton('CANCEL', () => this.closeAutoMenu());
  cancel.x = panelX + (panelW - GHOST_BTN_W) / 2;
  cancel.y = panelY + panelH - GHOST_BTN_H - 16;
  menu.addChild(cancel);

  this.container.addChild(menu);
}

private closeAutoMenu(): void {
  this.autoMenuOpen = false;
  if (this.autoMenuContainer) {
    this.autoMenuContainer.destroy({ children: true });
    this.autoMenuContainer = undefined;
  }
}

private setAutoSpins(n: number): void {
  this.closeAutoMenu();
  this.autoSpinsRemaining = n;
  this.refreshAutoButtonLabel();
  // If currently waiting for click, fire immediately to start the auto chain
  if (this.spinClickResolve) {
    // Re-trigger waitForSpinClick path — simplest: resolve current promise so loop iterates,
    // next iteration's waitForSpinClick will see autoSpinsRemaining > 0 and self-resolve.
    // But the simpler path is: directly invoke onSpinClick() since autoSpinsRemaining is already set.
    this.autoSpinsRemaining -= 1;
    this.refreshAutoButtonLabel();
    this.onSpinClick();
  }
}
```

> **重要**：`drawGhostButton` 使用 const GHOST_BTN_W=110/GHOST_BTN_H=46。Popup 內按鈕用同 helper 即可，hitArea 自動正確。

**Commit 2**: `feat(chore): AUTO spin count selector popup (10/25/50/100 + CANCEL)`

---

### 3c. Commit 3 — Stop conditions

當以下任一發生 → 自動 `stopAutoMode()`：

1. **FreeSpin trigger** — 進入 free spin mode 時
2. **JP win** — Grand/Major/Minor 中獎（任一）
3. **Match end** — 對局結束（HP=0 / round 結束 / running=false）

#### 3c-1. 找 trigger 點

```bash
grep -n "freeSpinActive\|enterFreeSpin\|jackpotWon\|onJackpot\|paidJackpot\|matchEnd" src/screens/BattleScreen.ts
```

定位這些 hook 點後，每處加：
```ts
if (this.autoSpinsRemaining > 0) this.stopAutoMode();
```

具體位置由 executor grep 後決定。**不發明新 hook**，只在現有事件點加 `stopAutoMode()` call。

#### 3c-2. Match end 點

`loop()` while loop 結束處（既有 line ~1581 `while (this.running && isTeamAlive(...) && isTeamAlive(...))` 退出後）：
```ts
// chore: ensure AUTO mode clears when match ends
this.stopAutoMode();
```

#### 3c-3. onUnmount cleanup

`onUnmount` 內加：
```ts
this.stopAutoMode();
this.closeAutoMenu();
```

(取代 chore #151 的 `clearInterval(this.autoTimer)` block — autoTimer 已不存在)

**Commit 3**: `feat(chore): AUTO auto-stops on FreeSpin/JP/match-end + cleanup on unmount`

---

### 3d. Commit 4 — Visual polish + button hit area

#### 3d-1. AUTO button 視覺 active 狀態

當 `autoSpinsRemaining > 0`：
- text 顯示 `STOP 24`（剩餘次數）
- alpha 0.85（與 chore #151 0.6 不同，更可讀）
- 按鈕 bg border 改 T.GOLD.glow（活躍狀態 gold ring）

當 idle：
- text 顯示 `AUTO`
- alpha 1.0
- border T.FG.muted

`refreshAutoButtonLabel` 加上 border 重畫邏輯（需要 reference 到 button 的 bg Graphics — 同樣推薦 `this.autoButtonBg` 儲存）：

```ts
private refreshAutoButtonLabel(): void {
  if (!this.autoButtonText || !this.autoButtonBg) return;
  if (this.autoSpinsRemaining > 0) {
    this.autoButtonText.text = `STOP ${this.autoSpinsRemaining}`;
    this.autoButton.alpha = 0.85;
    this.autoButtonBg.clear()
      .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
      .stroke({ width: 1.5, color: T.GOLD.glow, alpha: 0.9 });
  } else {
    this.autoButtonText.text = 'AUTO';
    this.autoButton.alpha = 1;
    this.autoButtonBg.clear()
      .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
      .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
  }
}
```

→ 因此需把 AUTO button 從 `drawGhostButton` 改成 dedicated `drawAutoButton` 方法（保留 SKIP 用 drawGhostButton helper），並儲存 `this.autoButtonBg` + `this.autoButtonText`。

#### 3d-2. Popup 按鈕 hover 效果（可選）

每個 count 選項按鈕加 `pointerover` / `pointerout` 改 bg alpha 0.5 / 0 。**low priority**，executor 看時間決定。

**Commit 4**: `polish(chore): AUTO button active state (gold ring + STOP N count) + dedicated draw method`

---

### 3e. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（onMount / onUnmount / draw button area / waitForSpinClick / onAutoClick / 新方法 6 個 / find FreeSpin/JP triggers）

**禁止**：
- 動機制（SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin state / Streak）
- 動 round loop 結構（while 條件 / spin evaluation / damage distribution）
- 動 SPIN button 邏輯（除了讀 spinClickResolve）
- 動 SKIP button（保持 placeholder）
- 動 PAYLINES 顯示
- 加新 asset
- 改 SPEC.md / sim-rtp.mjs / DesignTokens
- 動 ResultScreen / DraftScreen
- 改 ScreenManager / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **4 atomic commits**（per `incremental-implementation`）
3. push + PR URL
4. **Preview 驗證 critical**：
   - 點 AUTO → 跳出 popup（10 / 25 / 50 / 100 + CANCEL）— scrim 半透明點擊可關
   - 選 10 → popup 關 + AUTO 按鈕變 "STOP 9" + 自動開始 spin（每 round 結束自動下一輪）
   - 觀察 round 跑動跟 spin animation 對齊（不會 spin 還沒結束就 fire 下一輪）
   - 倒數到 "STOP 1"... "STOP 0" → 自動停 → 按鈕回 "AUTO"
   - 中途點 STOP → 立刻取消 → 按鈕回 "AUTO"
   - 跑 AUTO 時觸發 FreeSpin（demo mode 第 5 spin）→ 自動 stop AUTO
   - 跑 AUTO 時觸發 JP（demo mode 第 4 spin）→ 自動 stop AUTO
   - 對局結束 → 自動 stop AUTO + 進 ResultScreen
   - 無 [Auto] / [Chore] DEV console.log 殘留
5. 截圖 2 張：popup 開啟狀態 + AUTO 跑動中（顯示 "STOP 23"）

## 5. Handoff

- PR URL
- 1 行摘要
- 2 張截圖
- AUTO event-driven 流程是否真的對齊 round（spin animation 跑完才下一輪？或還是會搶跑？）
- FreeSpin / JP / match-end 自動 stop 是否都驗到（demo mode 5 spin 跑一遍應可全測）
- popup UI 視覺是否 OK（vs JP marquee 風格一致？）
- Spec deviations：預期 0
