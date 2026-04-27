# Sprint 6 · f-04 — Free Spin UI overlay（`FREE SPINS N/5` 頂部橫幅 + 金色 tint）

## 1. Context

PR: **進入 Free Spin 後顯示頂部金色橫幅 `FREE SPINS N/5`，每回合即時更新 N，全螢幕加微金色 tint。退出 mode 後橫幅淡出、tint 消失。**

Why: f-01/f-02/f-03 已把 Scatter symbol、mode state、trigger detection 全部接通（PR #121/#122/#123 merged）。但玩家進入 Free Spin 後**畫面沒任何提示** — 看 console log 才知道進入了。本 PR 補 UI 視覺反饋讓 player 知道「我在 Free Spin 中」。

設計：
- **頂部橫幅**：`FREE SPINS  N / 5`（N = `freeSpinsRemaining`），y=80（轉盤上方、雙方 wallet 之間正中）
- **配色**：goldText 大字 + 強 GlowFilter（比 Resonance banner r-04 更亮）
- **進入動畫**：scale 0.7→1.0 + alpha 0→1，220ms easeOut（彈性感）
- **退出動畫**：alpha 1→0，300ms easeIn（柔和淡出）
- **每回合更新**：在 freeSpinsRemaining decrement 之後，refresh banner text
- **Retrigger 視覺**：當 `freeSpinsRemaining` 因 retrigger 跳升時，做一個 1.0→1.25→1.0 的 250ms pulse + console retrigger log（已存在）
- **金色 tint overlay**：全螢幕 `Graphics().rect(0,0,W,H).fill({color:0xFFD37A, alpha:0.08})`，zIndex 介於 reel 跟 HUD 之間，在 Free Spin 期間可見

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — component architecture (Container 階層)、design tokens 引用、絕對座標常數化、tween 整合、`destroy({children:true})` cleanup
- **`incremental-implementation`** — thin slice：先過 build → 進 DEV 'F' 鍵驗證一輪 → commit → push。過程中若任何單一改動 >50 行 stop and reconsider。
- **`source-driven-development`** — Pixi.js 8 GlowFilter API + Container.zIndex 排序語意請對照官方 docs，不要憑記憶寫；官方 docs 連結見 https://pixijs.download/release/docs/

---

## 2. Spec drift check (P6)

1. `mempalace_search "Free Spin UI banner overlay HUD M10 gold tint"`
2. 確認 BattleScreen.ts 有 `inFreeSpin / freeSpinsRemaining`（f-02 加的）
3. 確認 BattleScreen.ts 有 `playResonanceBanner()` pattern 可參考（r-04 加的，line ~496）
4. 確認 DesignTokens 有 `T.GOLD.glow` / `T.FONT_SIZE.h1` 之類（c-01/c-03 加的）

## 3. Task

### 3a. 加 class fields

near 既有 curse HUD fields（line ~113）：

```ts
/** Free Spin overlay (f-04) */
private freeSpinBanner?: Container;          // banner Container (text + glow)
private freeSpinBannerText?: Text;           // text node, refreshed every spin
private freeSpinTint?: Graphics;             // full-screen gold tint
private wasInFreeSpin = false;               // edge detector: enter / exit transitions
private prevFreeSpinsRemaining = 0;          // detect retrigger jumps
```

### 3b. 新 method `drawFreeSpinOverlay()` — 在 onMount 呼叫（visibility 預設 false）

```ts
import { GlowFilter } from 'pixi-filters';   // 已 imported in r-04, confirm
import { tween, delay, Easings } from '@/systems/tween';

private drawFreeSpinOverlay(): void {
  // Full-screen gold tint (initially hidden)
  this.freeSpinTint = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0xFFD37A, alpha: 0.08 });
  this.freeSpinTint.visible = false;
  this.freeSpinTint.zIndex = 50;   // above reel (~10), below HUD (~1000)
  this.container.addChild(this.freeSpinTint);

  // Banner Container
  this.freeSpinBanner = new Container();
  this.freeSpinBanner.x = CANVAS_WIDTH / 2;
  this.freeSpinBanner.y = 80;
  this.freeSpinBanner.visible = false;
  this.freeSpinBanner.zIndex = 1100;   // above curse HUD
  this.freeSpinBanner.alpha = 0;

  this.freeSpinBannerText = goldText('FREE SPINS 0 / 5', {
    fontSize: T.FONT_SIZE.h1,
    withShadow: true,
  });
  this.freeSpinBannerText.anchor.set(0.5, 0.5);
  this.freeSpinBannerText.filters = [new GlowFilter({
    color: 0xFFD37A,
    distance: 14,
    outerStrength: 2.2,
    innerStrength: 0.4,
    quality: 0.4,
  })];
  this.freeSpinBanner.addChild(this.freeSpinBannerText);

  this.container.addChild(this.freeSpinBanner);
}
```

呼叫位置：onMount 內、drawCurseHud() 之後。

### 3c. 新 method `refreshFreeSpinOverlay()` — 在 loop() 內適當位置呼叫

每回合呼叫一次，內部處理進入 / 更新 / 退出 / retrigger pulse 四種狀態：

```ts
private refreshFreeSpinOverlay(): void {
  if (!this.freeSpinBanner || !this.freeSpinBannerText || !this.freeSpinTint) return;

  const isIn  = this.inFreeSpin;
  const wasIn = this.wasInFreeSpin;

  // Update text (only if currently in mode)
  if (isIn) {
    this.freeSpinBannerText.text = `FREE SPINS  ${this.freeSpinsRemaining} / ${BattleScreen.FREE_SPIN_COUNT}`;
  }

  // Transition: exit -> enter
  if (isIn && !wasIn) {
    this.freeSpinBanner.visible = true;
    this.freeSpinTint.visible   = true;
    this.freeSpinBanner.alpha   = 0;
    this.freeSpinBanner.scale.set(0.7);
    void tween(220, t => {
      this.freeSpinBanner!.alpha = t;
      this.freeSpinBanner!.scale.set(0.7 + 0.3 * t);
    }, Easings.easeOut);
  }

  // Transition: enter -> exit
  if (!isIn && wasIn) {
    void tween(300, t => {
      this.freeSpinBanner!.alpha = 1 - t;
      this.freeSpinTint!.alpha   = 0.08 * (1 - t);
    }, Easings.easeIn).then(() => {
      this.freeSpinBanner!.visible = false;
      this.freeSpinTint!.visible   = false;
      this.freeSpinTint!.alpha     = 0.08;   // restore for next entry
    });
  }

  // Retrigger pulse: freeSpinsRemaining JUMPED upward (not normal decrement)
  if (isIn && this.freeSpinsRemaining > this.prevFreeSpinsRemaining) {
    void tween(250, t => {
      const s = 1 + 0.25 * Math.sin(Math.PI * t);   // 1.0 → 1.25 → 1.0
      this.freeSpinBanner!.scale.set(s);
    }, Easings.easeOut);
  }

  // Update edge detectors
  this.wasInFreeSpin = isIn;
  this.prevFreeSpinsRemaining = this.freeSpinsRemaining;
}
```

呼叫位置：loop() 內，在 free spin trigger detection 之後（這樣進入 spin 顯示橫幅）+ 在 free spin decrement 之後（更新數字、觸發退出動畫）。**呼叫兩次** — 一次在 trigger block 之後、一次在 decrement block 之後。

### 3d. onUnmount 清理

既有 `this.container.destroy({ children: true })` 會自動清理 banner 跟 tint，**不需額外清理**。

### 3e. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔案。

**禁止**：
- DesignTokens（金色 0xFFD37A 沿用既有 r-04 pattern，不新加 token）
- SymbolsConfig / SlotEngine / sim-rtp.mjs
- 新增資產（純 Graphics + goldText + GlowFilter）
- 改 f-02/f-03 既有邏輯
- SPEC.md
- f-05 sim 工作（純 UI PR，不碰 sim）

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL
4. **Preview 驗證（DEV 'F' 鍵）**：
   - 進 Battle，按 'F'，看到頂部橫幅 `FREE SPINS  5 / 5` 彈出 + 全螢幕微金色 tint
   - spin 一次後變成 `4 / 5`、再 spin 變 `3 / 5`...
   - 5 spins 結束，banner 淡出 + tint 消失
   - 在 free spin 中再按 'F'（retrigger DEV 路徑），banner 做 1.0→1.25→1.0 pulse
5. **截圖**：1 張 mid-free-spin（最好 N=3 顯示中），1 張 fade-out 中（alpha ~0.5）

## 5. Handoff

- PR URL
- 1 行摘要
- 2 張截圖
- DEV 'F' rerigger pulse 是否實測到
- 任何 Pixi GlowFilter API 跟 docs 不一致的地方（source-driven-development skill 觸發）
- Spec deviations：預期 0
