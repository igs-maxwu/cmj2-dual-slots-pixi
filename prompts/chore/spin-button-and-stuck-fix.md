# Chore — 加 SPIN 按鈕（auto-loop → 手動 spin）+ 修「進場卡在初始畫面」+ 修 B 側 spirit 站位

## 1. Context

PR: **3 個關聯問題一次處理**：
1. **Owner 想加 SPIN 按鈕**：「按一下老虎機轉動一次」— 從 auto-loop 改 manual spin
2. **「卡在初始畫面」現象**：Owner 截圖顯示 Round 00 reel 顯示初始固定 pattern (5 青 / 5 青 / 5 白)，戰鬥沒進行
3. **B 側 spirit 站位 bug**：截圖顯示所有 spirit 擠在畫面**左半 / 中段**，「對手 · B」label 在右邊但 B 側 spirit 沒在右側 grid (x=440-688)

Why: Owner 試玩 Variant A 後反饋。Path 1 SPEC 守則本來抗拒 SPIN button（auto-loop SPEC），但**owner 明確要求改手動**。同時截圖揭示 B-side spirit placement 問題與 auto-loop 行為都需修。

設計：

### Issue 1: SPIN 按鈕（手動 spin，廢 auto-loop）

**位置**：reel 結束（y=955）跟 battle log 開始（y=1055）之間，有 100px 空間。SPIN button 放 y=970, 高 60-70px：

```
y=615-955    Reel (340px)
y=970-1035   SPIN button area (NEW, 65px)
y=1055-1240  Battle log (185px)
```

**SPIN button 視覺**（mockup variant-a.jsx line 226-233 + PrimaryCTA component）：
- 中央 centered, width 200, height 60
- 背景 gradient gold + glow shadow
- 中文「轉 動」+ 副字「-100 NTD」
- click → 觸發單次 spin
- spin 動畫期間 button **disabled**（visually dimmed, no click）
- match 結束（一方全死）→ button **changes to「再戰一場」or 改 ResultScreen 接管**

**Loop refactor**：

既有 line 1311-1313:
```ts
while (this.running && isTeamAlive(this.formationA) && isTeamAlive(this.formationB)) {
  this.round++;
  ...
}
```

改成 wait-for-click model：
```ts
async loop(): Promise<void> {
  this.running = true;
  while (this.running && isTeamAlive(this.formationA) && isTeamAlive(this.formationB)) {
    // Wait for user to click SPIN button
    await this.waitForSpinClick();
    if (!this.running) return;
    
    this.round++;
    // ... existing per-round logic ...
  }
  // ... existing endgame / winner determination ...
}

private spinClickPromise: Promise<void> | null = null;
private spinClickResolve: (() => void) | null = null;

private waitForSpinClick(): Promise<void> {
  this.spinButton.eventMode = 'static';
  this.spinButton.cursor = 'pointer';
  this.spinButtonText.text = '轉 動';
  this.spinButton.alpha = 1;
  return new Promise(resolve => {
    this.spinClickResolve = resolve;
  });
}

// onMount setup:
this.spinButton.on('pointertap', () => {
  if (this.spinClickResolve) {
    const resolve = this.spinClickResolve;
    this.spinClickResolve = null;
    // Disable button during spin
    this.spinButton.eventMode = 'none';
    this.spinButton.alpha = 0.6;
    this.spinButtonText.text = '...';
    resolve();
  }
});
```

### Issue 2: 「卡在初始畫面」根因 + 解決

當前 loop() 是 auto-loop（line 1311 while + 311 `void this.loop()`）— 應該自動跑。Owner 看到 stuck 可能是：
- (a) loop 真的跑但等 ROUND_GAP_MS 等太久（400ms × N round）— 不像，pace-01 後 1.7s/round 不該 stuck
- (b) loop 內某個 `await` hang（reel.spin / playAttackAnimations / playDamageEvents）
- (c) 第一次 spin 還沒完成 — 截圖時間點太早

**改成 manual spin 後，Issue 2 自動解** — 不再 auto-loop，玩家點 SPIN 才動。

**但若 Issue 2 是真 bug**（reel.spin hang 或 onMount error），需 executor preview 時 console 看 stack trace。

### Issue 3: B 側 spirit 站位 bug

截圖顯示 B 側 spirits 沒有在右側 grid（x=440-688）。需 executor 進 preview 確認：

可能原因：
- (a) `gridPlacementB` 跟 `gridPlacementA` 用同 seed → 放同位置（但 mirror 應該讓他們在右邊）
- (b) NineGrid mirror 邏輯錯：`mirroredCol = 2 - col` 有問題？實際應該 col 直接套到 B grid（B grid 已在右邊 x=440），mirror 是 within B grid 反轉
- (c) `NINE_B_GRID_LEFT_X` 計算錯：`CANVAS_WIDTH - NINE_GRID_TOTAL - 32 = 720 - 248 - 32 = 440` 對

**Executor 在 preview 用 console 印每個 spirit world position 看是不是 B 側全部 x < 360**：

```ts
if (import.meta.env.DEV && side === 'B') {
  console.log(`[NineGrid] B slot ${slot} → cellIdx=${cellIdx} row=${row} col=${col} mirroredCol=${mirroredCol} → x=${cellX}, y=${cellY}`);
}
```

Expected: B-side x ∈ [440, 688]. 若實際 x < 440 → 有 bug。

可能 fix 方向：
- 若 mirror 邏輯誤把 B 也放到 A grid → 確認 `NINE_B_GRID_LEFT_X` 真的傳進去
- 若 placement 兩側相同 → seed 算法 collision，B suffix 沒生效

---

## Skills suggested for this PR

- **`debugging-and-error-recovery`** — 5-step triage on Issue 2 + 3：reproduce in preview / instrument with console.log / localize / fix / guard。**禁止憑感覺修** — executor 進 preview 看實際 console 輸出。
- **`incremental-implementation`** — **3 atomic commits** 對應 3 issues：(1) B-side placement fix，(2) SPIN button 加，(3) loop refactor wait-for-click。每個都 build 過 + visual verify。
- **`code-simplification`** — auto-loop while → wait-for-click event-driven 是大改。考慮把「spin one round」抽成 helper method `runOneRound()`，loop 跟 manual spin 都 reuse。

---

## 2. Spec drift check (P6)

1. `mempalace_search "auto-loop manual spin button stuck B-side placement chore"`
2. 確認 BattleScreen.ts line 311 `void this.loop()` + line 1311 while loop
3. 確認 NineGrid 邏輯（line 860+ slotToArenaPos 含 mirror、NINE_B_GRID_LEFT_X 計算）
4. 確認 res-01 ResultScreen onMatchEnd callback：對戰結束 → 跳 ResultScreen。本 PR loop 結束仍走此 callback，不變。
5. 確認 既有 SPIN/AUTO/SKIP 是 Path 1 守則禁止項 — **本 PR 為 owner 明確改 SPEC，可違反**。但只加 SPIN（不加 AUTO / SKIP，保簡單）。

## 3. Task

### 3a. Issue 3 fix — debug B-side placement first（commit 1）

**先進 preview reproduce**。在 slotToArenaPos 暫加 DEV log（commit 之前 cleanup）：

```ts
if (import.meta.env.DEV) {
  console.log(`[NineGrid] ${side} slot=${slot} cellIdx=${cellIdx} row=${row} col=${col} mirroredCol=${mirroredCol} gridLeftX=${gridLeftX} → x=${cellX}, y=${cellY}`);
}
```

進 Battle，console 印 10 行（A 5 + B 5）。Verify B 側 x ∈ [440+40, 688-40] = [480, 648]。

**若 B x < 440**，可能 fix:
- (a) 確認 `NINE_B_GRID_LEFT_X = CANVAS_WIDTH - NINE_GRID_TOTAL - 32 = 440` 傳進 slotToArenaPos
- (b) 確認 mirror 用 mirroredCol（已 reverse col 0↔2）算 cellX
- (c) 若 placementB 跟 A 同 array → seed 算法的 'A'/'B' suffix 沒效，可改 seed strategy

**修完 commit 1 + 拿掉 DEV log**：`fix(chore): NineGrid B-side placement uses correct grid origin`

### 3b. Issue 1 — 加 SPIN button（commit 2）

加 const + class fields:

```ts
const SPIN_BTN_Y = 970;
const SPIN_BTN_W = 200;
const SPIN_BTN_H = 60;

private spinButton!: Container;
private spinButtonBg!: Graphics;
private spinButtonText!: Text;
private spinButtonSubText!: Text;
```

新 method `drawSpinButton()`:

```ts
private drawSpinButton(): void {
  this.spinButton = new Container();
  const btnX = (CANVAS_WIDTH - SPIN_BTN_W) / 2;
  this.spinButton.x = btnX;
  this.spinButton.y = SPIN_BTN_Y;
  this.spinButton.zIndex = 200;

  // Gold gradient bg (2-rect simulation)
  this.spinButtonBg = new Graphics()
    .roundRect(0, 0, SPIN_BTN_W, SPIN_BTN_H, 12)
    .fill({ color: T.GOLD.base })
    .stroke({ width: 2, color: T.GOLD.shadow });
  this.spinButton.addChild(this.spinButtonBg);

  // Gold glow filter
  this.spinButton.filters = [new GlowFilter({
    color: T.GOLD.glow, distance: 12, outerStrength: 1.5, innerStrength: 0.3,
  })];

  // Main text 「轉 動」
  this.spinButtonText = new Text({
    text: '轉 動',
    style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: 24,
             fill: 0x0D1421, letterSpacing: 8 },
  });
  this.spinButtonText.anchor.set(0.5, 0.5);
  this.spinButtonText.x = SPIN_BTN_W / 2;
  this.spinButtonText.y = SPIN_BTN_H / 2 - 6;
  this.spinButton.addChild(this.spinButtonText);

  // Sub text 「-100 NTD」
  this.spinButtonSubText = new Text({
    text: `-${this.cfg.betA} NTD`,
    style: { fontFamily: T.FONT.body, fontWeight: '500', fontSize: 11,
             fill: 0x0D1421, fontStyle: 'italic' },
  });
  this.spinButtonSubText.anchor.set(0.5, 0.5);
  this.spinButtonSubText.x = SPIN_BTN_W / 2;
  this.spinButtonSubText.y = SPIN_BTN_H / 2 + 14;
  this.spinButton.addChild(this.spinButtonSubText);

  // Click handler
  this.spinButton.eventMode = 'static';
  this.spinButton.cursor    = 'pointer';
  this.spinButton.on('pointertap', () => this.onSpinClick());

  this.container.addChild(this.spinButton);
}

private onSpinClick(): void {
  if (this.spinClickResolve) {
    const resolve = this.spinClickResolve;
    this.spinClickResolve = null;
    // Disable button during spin
    this.spinButton.eventMode = 'none';
    this.spinButton.alpha = 0.5;
    this.spinButtonText.text = '...';
    resolve();
  }
}

private enableSpinButton(): void {
  this.spinButton.eventMode = 'static';
  this.spinButton.alpha = 1;
  this.spinButtonText.text = '轉 動';
}
```

**onMount** 呼叫 `this.drawSpinButton()`。

**Commit 2**: `feat(chore): add SPIN button + click handler`

### 3c. Issue 1 — Loop refactor wait-for-click（commit 3）

加 promise pair fields:

```ts
private spinClickPromise: Promise<void> | null = null;
private spinClickResolve: (() => void) | null = null;

private waitForSpinClick(): Promise<void> {
  this.enableSpinButton();
  return new Promise(resolve => {
    this.spinClickResolve = resolve;
  });
}
```

改 `loop()` （line 1308 area）：

```ts
private async loop(): Promise<void> {
  this.running = true;
  const pool = buildFullPool(SYMBOLS);
  let lastDmgA = 0, lastDmgB = 0;
  let lastPreHpA = 0, lastPreHpB = 0;

  while (this.running && isTeamAlive(this.formationA) && isTeamAlive(this.formationB)) {
    // chore: wait for SPIN click before each spin (was auto-loop)
    await this.waitForSpinClick();
    if (!this.running) return;

    this.round++;
    this.vsBadge?.pulse();
    this.refresh();

    // ... existing per-round logic from current line ~1314 onwards ...
    // (spin / Resonance / Streak / damage / Curse / etc — all unchanged)
  }

  // ... existing winner determination + onMatchEnd ...
}
```

**注意**：
- 按鈕在 `waitForSpinClick` 觸發時 enable（再次可點）
- `onSpinClick` 觸發時 disable（spin 動畫期間不能 click）
- match 結束（while 退出）後跳 ResultScreen，按鈕 visible 但無作用（match 已結束）

**Commit 3**: `refactor(chore): loop awaits SPIN click instead of auto-running`

### 3d. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔
- B-side placement debug + fix
- 加 SPIN button method + class fields + const
- loop refactor wait-for-click pattern

**禁止**：
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin（純 UI / event 改）
- DraftScreen / LoadingScreen / ResultScreen / FXPreviewScreen
- main.ts
- DesignTokens
- 加新 asset
- scripts/sim-rtp.mjs（純前端 PR，sim 不影響 — sim 走 SlotEngine 直接 spin，不依賴 SPIN button）
- 加 AUTO / SKIP 按鈕（保留簡單）
- SPEC.md（**but** owner request 改 auto-loop → manual 是 SPEC drift — 在 handoff 明確 flag**）
- 改 res-01 / pace-01 邏輯
- 改 SlotReel / NineGrid 結構（只 fix B-side bug，不重寫）

## 4. DoD

1. `npm run build` 過
2. **3 個 commits**（per `incremental-implementation`，每 issue 一個 commit）
3. push + PR URL
4. **Preview 驗證 critical**：
   - 進 Battle：reel 顯示初始 pattern，**不再自動跑**（這是新行為）
   - 看到 SPIN 按鈕在 reel 下方，金色 gradient + 「轉 動」 + 「-100 NTD」 副字
   - **B 側 spirit 出現在畫面右半**（x=440-688 區段）— 不再擠在中央
   - 點 SPIN → reel 旋轉 → 結果出現 → wayhit highlight → 出招 → 扣 HP → SPIN button 重新可點
   - 按多次 SPIN，wallet / HP / round counter 變化
   - 一方 HP 全光 → 跳 ResultScreen（既有邏輯不變）
   - 中途按 BACK / RETREAT → goToDraft（既有邏輯不變）
5. 截圖：
   - 1 張 mid-battle（看 B-side spirits 在右、SPIN button 在底）
   - 1 張 SPIN 按下瞬間（button disabled state alpha 0.5 「...」）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- B-side placement bug 真實 root cause（NINE_B_GRID_LEFT_X 沒傳進去 / mirroredCol 邏輯錯 / placement seed 同步 / etc）
- SPIN button click → spin → enable cycle 是否順暢（無 race condition / stuck 在 disabled state）
- match 結束後 SPIN button 行為（截圖時還在 / 變透明 / 消失 — 哪個最合理？建議自然消失因為 ResultScreen 立刻接管）
- **Spec deviations**：
  - 加 SPIN button = 從 auto-loop 改 manual SPEC drift — owner 明確要求，已記錄
  - sim 路徑不變（sim 不依賴 SPIN button，仍 auto-spin）
- 任何意外發現
