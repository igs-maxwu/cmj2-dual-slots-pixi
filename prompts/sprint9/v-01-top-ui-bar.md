# Sprint 9 · v-01 — Top UI Bar（menu / status / store + Player A/B labels + ROUND 視覺升級）

## 1. Context

PR: **BattleScreen 加 top UI bar（高 ~45px gradient 條）+ Player A/B 標籤 + 既有 ROUND counter 視覺升級。Mockup `download_picture/high_quality_mockup.html` line 58-100 + `mockup_reference.jpg` 參考。**

Why: Sprint 8 試玩 + mockup review 後，owner feedback「視覺升級」第一條。當前 BattleScreen `drawHeader()` 只有「雀靈戰記·BATTLE」+「ROUND 00」，畫面太空 — mockup 顯示**top bar + player labels** 是 demo 必要視覺元素（讓人一眼看出「這是 PvP 對戰、A vs B」）。

設計（從 mockup 抽得進來的元素）：

### Top UI Bar (新加)
- 高度 45px，y=0，全寬 720px
- 背景 gradient：`linear-gradient(to bottom, rgba(0,50,100,0.95), rgba(0,30,60,0.7))`
- 底邊 border `rgba(0, 255, 255, 0.3)` 1.5px
- 三段式 layout：
  - **左**：menu icon（☰ 漢堡，純圖示，**本 PR 不接 onClick** — 後續 Phase 2 接 settings panel）
  - **中**：status pill — 「ROUND **N**」（pill-shape rounded rect + 內部黃字數字）
  - **右**：store icon（🎁 emoji 或 gem icon，**本 PR 不接 onClick** — Phase 2 後端依賴）

### Player A / B 標籤（新加）
- 「**PLAYER A**」+「**PLAYER B**」字串放在既有 wallet text **上方**（y = WALLET_Y - 16）
- 字級 11pt，charSpacing 3，semibold
- 配色：A 側 `T.CLAN.azureGlow`（青藍）/ B 側 `T.CLAN.vermilionGlow`（朱紅）
- 與既有 wallet text 中央對齊（同 x = WALLET_A_X / WALLET_B_X）

### ROUND counter 視覺升級
- 既有 `this.roundText = goldText('ROUND 00', { fontSize: 32 })` 在 header 中央偏下
- 改成 **top bar 內部 pill** （上述「中」位置），fontSize **保持 32**，加 GlowFilter pulse（既有 round 切換時可選 pulse — 本 PR**不**動 round-change animation，純 layout 改動）
- 既有 line 336-341 `this.roundText` 移到 top bar 內

### 既有「雀靈戰記 · BATTLE」title 處理
- mockup 沒這個 title；對 demo 訴求「**這是場對戰**」這個 title 反而幫助訴求
- **保留** title（line 325-334），只是 y 位置往**下移**到 top bar 之下（y = 50 之後）
- 字級 30 → **24**（top bar 已佔注意力，title 可降權）

### Mockup 不轉的元素
- 鑽石量「💎 25,786,780」+ Lv.4401 → 我們是 PvP wallet，不是個人 profile，**不顯示**
- store 點擊行為：純圖示 placeholder，無 onClick

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Container hierarchy（top bar 是 zIndex=100 layer），gradient fill 用 multiple Graphics 疊或 Pixi 8 `fill({ color, alpha })`，文字 charSpacing + semibold；icon emoji 先用 Text 占位（後續可換 atlas / SVG）。**特別注意**：top bar 要在既有 HUD（curse stack / freespin banner）**下方** zIndex 但**上方**於 reel/spirit。zIndex 50-1100 區間既有 occupant 對齊。
- **`code-simplification`** — 既有 `drawHeader()` 結構保留但內部物件移位 + 新增 top bar method `drawTopBar()`。**禁止**把所有東西都塞進 drawHeader（保留 single-responsibility）。
- **`source-driven-development`** — Pixi 8 Graphics gradient 不支援 native；用兩個 Graphics 半透明疊或 Pixi-extended sprite 處理。對照官方 docs（v8 已 deprecate `lineStyle` 改 `stroke()` API）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "top UI bar HUD player labels round counter mockup v-01"`
2. 確認 BattleScreen.ts 既有 `drawHeader()` line 324、`drawWallets()` line 345、`HEADER_Y` const、`T.CLAN.azureGlow / vermilionGlow` 在 DesignTokens
3. 確認既有 zIndex 排程：reel ~10、tint ~50、curse HUD ~100、freespin banner 1100、JP ceremony 2500 — top bar **建議 zIndex = 80**（介於 tint 跟 curse HUD 之間，永遠在 reel / spirit 之上但不蓋過 ceremony）
4. 確認 mockup HTML line 58-100 的 top-bar 樣式作為視覺參考（不需 1:1 還原顏色，但結構對齊）

## 3. Task

### 3a. 加 const + class fields

near 既有 const（line ~40 區）：

```ts
// ── v-01: Top UI bar ───────────────────────────────────────────────────────
const TOP_BAR_H = 45;
const TOP_BAR_Y = 0;
```

class fields：

```ts
/** v-01 top UI bar (menu / round pill / store) */
private topBar!: Container;
private menuIcon!: Text;
private storeIcon!: Text;
private roundPill!: Container;       // wraps roundText with bg pill
/** v-01 player labels above wallet text */
private playerLabelA!: Text;
private playerLabelB!: Text;
```

### 3b. 新 method `drawTopBar()` — 在 onMount 早期呼叫

```ts
private drawTopBar(): void {
  this.topBar = new Container();
  this.topBar.zIndex = 80;

  // Background gradient — 用兩個 Graphics 疊（Pixi 8 不支援 gradient fill native）
  // Top half: deeper blue
  const bgTop = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, TOP_BAR_H * 0.5)
    .fill({ color: 0x003264, alpha: 0.95 });
  // Bottom half: lighter blue
  const bgBot = new Graphics()
    .rect(0, TOP_BAR_H * 0.5, CANVAS_WIDTH, TOP_BAR_H * 0.5)
    .fill({ color: 0x001E3C, alpha: 0.7 });
  // Bottom border
  const border = new Graphics()
    .rect(0, TOP_BAR_H - 1.5, CANVAS_WIDTH, 1.5)
    .fill({ color: 0x00FFFF, alpha: 0.3 });

  this.topBar.addChild(bgTop);
  this.topBar.addChild(bgBot);
  this.topBar.addChild(border);

  // Left: menu icon
  this.menuIcon = new Text({
    text: '☰',
    style: { fontFamily: T.FONT.body, fontSize: 28, fill: 0xFFFFFF },
  });
  this.menuIcon.anchor.set(0, 0.5);
  this.menuIcon.x = 14;
  this.menuIcon.y = TOP_BAR_H / 2;
  this.topBar.addChild(this.menuIcon);

  // Center: ROUND pill (move existing roundText here)
  this.roundPill = new Container();
  this.roundPill.x = CANVAS_WIDTH / 2;
  this.roundPill.y = TOP_BAR_H / 2;

  // Pill bg
  const pillBg = new Graphics()
    .roundRect(-70, -16, 140, 32, 16)
    .fill({ color: 0x000000, alpha: 0.4 })
    .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
  this.roundPill.addChild(pillBg);

  // ROUND text (cache reference; existing roundText is moved here)
  this.roundText = goldText('ROUND 00', { fontSize: 16, withShadow: true });
  this.roundText.anchor.set(0.5, 0.5);
  this.roundText.style.letterSpacing = 3;
  this.roundPill.addChild(this.roundText);
  this.topBar.addChild(this.roundPill);

  // Right: store icon
  this.storeIcon = new Text({
    text: '🎁',
    style: { fontFamily: T.FONT.body, fontSize: 22 },
  });
  this.storeIcon.anchor.set(1, 0.5);
  this.storeIcon.x = CANVAS_WIDTH - 14;
  this.storeIcon.y = TOP_BAR_H / 2;
  this.topBar.addChild(this.storeIcon);

  this.container.addChild(this.topBar);
}
```

### 3c. 改 `drawHeader()` — 既有 title 下移、移除既有 roundText

既有 line 324-342 改寫：

```ts
private drawHeader(): void {
  const title = new Text({
    text: '雀靈戰記 · BATTLE',
    style: {
      fontFamily: T.FONT.title, fontWeight: '700',
      fontSize: 24,                    // 32 -> 24（top bar 已佔注意力）
      fill: T.GOLD.base,
      stroke: { color: T.GOLD.shadow, width: 2 },
      letterSpacing: 2,
    },
  });
  title.anchor.set(0.5, 0);
  title.x = CANVAS_WIDTH / 2;
  title.y = TOP_BAR_H + 4;             // 直接放在 top bar 之下
  this.container.addChild(title);

  // roundText 已移到 drawTopBar()，此處不再建
}
```

### 3d. 改 `drawWallets()` — 加 PLAYER A/B 標籤

在既有 `walletTextA` 之前加：

```ts
this.playerLabelA = new Text({
  text: 'PLAYER A',
  style: {
    fontFamily: T.FONT.body, fontWeight: '700',
    fontSize: 11, fill: T.CLAN.azureGlow,
    letterSpacing: 3,
  },
});
this.playerLabelA.anchor.set(0.5, 0);
this.playerLabelA.x = WALLET_A_X;
this.playerLabelA.y = WALLET_Y - 16;
this.container.addChild(this.playerLabelA);

// 同樣的 B 側
this.playerLabelB = new Text({
  text: 'PLAYER B',
  style: {
    fontFamily: T.FONT.body, fontWeight: '700',
    fontSize: 11, fill: T.CLAN.vermilionGlow,
    letterSpacing: 3,
  },
});
this.playerLabelB.anchor.set(0.5, 0);
this.playerLabelB.x = WALLET_B_X;
this.playerLabelB.y = WALLET_Y - 16;
this.container.addChild(this.playerLabelB);
```

**注意**：WALLET_Y 既有 = 52，TOP_BAR_H = 45，title 在 y=49。**y=52 + label y= 36 → 跟 title 衝突！** 需要調整：
- option A：把 wallet 整體下移（WALLET_Y 52 → 78）
- option B：縮小 title 字級或移除 title
- option C：label 放在 wallet 下方而非上方

**executor 視察既有畫面狀態決定**。建議 option A：WALLET_Y 52 → 78，title fontSize 24 → 22 也接受。

### 3e. onMount 順序

`onMount` 內呼叫順序確保：
```ts
this.drawTopBar();     // NEW first — 設定 zIndex 80
this.drawHeader();     // 既有 — title 在 top bar 下
this.drawWallets();    // 既有 — 加上 player labels
// ...其他既有 drawJackpotMarquee / drawCurseHud / drawFreeSpinOverlay 不動
```

### 3f. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔（+drawTopBar method ~50 行 + 改 drawHeader + 改 drawWallets + 6 個 class fields + 2 const）

**禁止**：
- DesignTokens（用既有 T.CLAN / T.GOLD / T.FONT — 0x00FFFF cyan border 跟 0x003264/0x001E3C 是 mockup 既有色，可硬寫不開新 token）
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- DraftScreen / LoadingScreen / SlotReel
- main.ts / DesignTokens
- scripts/sim-rtp.mjs（純 UI PR）
- 加新 asset
- v-02 / v-03 / pace-01 / res-01 範疇
- 加 onClick 行為到 menu / store icon（純 placeholder visual）
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. 1 個 commit（純視覺增量）
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle，看到 top bar：☰ 在左、ROUND pill 在中（顯示 N round 數字）、🎁 在右
   - title「雀靈戰記·BATTLE」在 top bar 下方稍小一點
   - 雙方 wallet 上方各有 PLAYER A（青色）/ PLAYER B（紅色）標籤
   - top bar 不蓋過任何既有 HUD（curse stack / freespin banner / JP ceremony 都正常播）
   - 跑幾 round，roundText pill 內的數字正常 update
5. 截圖 1 張（包含 top bar 全顯示 + 雙方 wallet/label + 至少 1 spirit 在戰場）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- WALLET_Y 是否調整過（若有，新值）
- 既有 HUD layer 是否任何 z-order 衝突（預期 0）
- emoji ☰ / 🎁 在你瀏覽器渲染狀況（部分中文系統 emoji 可能 fallback 文字 — 若可用 Pixi Graphics 畫漢堡更穩，但本 PR 先 emoji 占位）
- Spec deviations：預期 0
