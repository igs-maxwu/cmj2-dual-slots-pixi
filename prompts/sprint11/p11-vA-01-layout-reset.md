# Sprint 11 · p11-vA-01 — Layout Reset 切換到 Variant A（JP HERO 178px + 「戰」 separator + Arena 310px + Reel zone 重排 + 移除 SPIN/PAYLINES）

## 1. Context

PR: **Sprint 10 已實作 Variant B（battle arena hero 520px + JP thin 64px）。Owner 改採新 Claude Design Variant A — 把 JP marquee 升為 hero 178px、battle arena 縮成 310px、reel 加 SHARED BOARD header、加「戰」字 zone separator。本 PR 只動 layout / container 位置，**不動** formation 結構（p11-vA-02 才動）+ **不動** gem 視覺（p11-vA-03 才動）。**

Why: Owner 試玩 Sprint 10 後決定 Variant A 視覺架構更符合 pitch 訴求 — JP 大池子 + 9-grid formation + SHARED BOARD 統一 reel。

Mockup reference: `download_picture/Dual Slot Pixi/battle-variant-a.jsx`（line 18-256）+ `battle-shared.jsx`（JPMarquee high emphasis line 232-310）。

新 Variant A 5 個 zones 的精確 y 座標：

```
y=0-60      Header (既有 v-01 compact, 不動)
y=70-220    JP HERO zone (NEW 178px — label 18 + marquee 132 + padding)
              ├─ y=70 「— THE POOL OF EIGHT SEAS —」label 9pt
              └─ y=88-220 JP marquee high emphasis 132px
y=255-275   「戰」 zone separator (NEW)
              ├─ horizontal hairline gradient
              └─ 「戰」 字 14pt gold over hairline
y=285-595   Battle Arena 310px (NEW size, was 520px)
              ├─ Side labels (既有，y=8 of arena)
              ├─ VS shield 50×50 circle (NEW, was 80×80 hexagon at y=380)
              │     position: arena top + 130 = absolute y=415
              └─ Spirit formations (本 PR 不動，p11-vA-02 才改 NineGrid)
y=615-955   Reel zone 340px (NEW size, was 330px)
              ├─ Header strip y=625: A · 我方 dot │ ◇ SHARED BOARD ◇ │ B · 對手 dot
              └─ 5×3 grid below header (本 PR 不動 cells，p11-vA-03 才改 gems)
y=1055-1240 Battle log 185px (NEW size, was 140px)
```

**注意**：
- 既有 SPIN/AUTO/SKIP action bar（mockup 有，我們不要）→ 不出現
- 既有 PAYLINES indicator（mockup 有，我們不要）→ 不出現
- 「A · YOUR TURN / B · WAITING」 mockup 是 turn-based UI label → 改成「A · 我方 / B · 對手」靜態 label（auto-loop 不需 turn 概念）

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — JPMarquee 從 64px thin 改成 178px hero 是大改，需重寫 drawJackpotMarquee。Container y 重排要連動 reel.x/y、battle log 位置。**保持** existing j-05 既有 `jpMinorText / jpMajorText / jpGrandText` class fields（refresh / pulse 邏輯不破壞）。
- **`code-simplification`** — 既有 v-01 寫的 drawJackpotMarquee thin strip 整段改寫；可以保留 method shell + 替換內部 children。**禁止**重命名 class fields。
- **`source-driven-development`** — JP HERO mockup line 232-310 是 React/CSS，翻成 Pixi.Graphics + Text 等價：linear gradient 用兩 Graphics 疊、bulbs 裝飾性 dot pattern 用迴圈畫小圓、text-shadow 用 GlowFilter。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 11 Variant A layout reset JP hero 戰 separator p11-vA-01"`
2. 確認 BattleScreen.ts 既有 v-01 後狀態：drawCompactHeader / drawJackpotMarquee thin / drawBattleArena hero 520px / drawSlot at REEL_ZONE_Y=700 / drawBattleLog 140px
3. 確認 mockup `download_picture/Dual Slot Pixi/battle-variant-a.jsx` 跟 `battle-shared.jsx` 內容（**executor 必讀**）
4. 確認 `j-05` 既有 `refreshJackpotMarquee()` / `pulseJackpotText()` 用 `jpMinorText / jpMajorText / jpGrandText` 三個 fields — 本 PR 不可重命名
5. 確認 既有 ARENA_Y_FRONT / ARENA_Y_BACK / ARENA_Y_MID（chore #146 加的 3-row）— 本 PR 重設這些常數（arena 縮 310px，formation 結構之後 p11-vA-02 才改）

## 3. Task

### 3a. const 重設

```ts
// 既有（p10-v01 + chore #146）:
const JP_STRIP_Y = 70;
const JP_STRIP_H = 64;
const ARENA_Y_FRONT = 540;
const ARENA_Y_MID   = 380;
const ARENA_Y_BACK  = 260;
const REEL_ZONE_Y   = 700;
const LOG_Y         = 1100;

// 本 PR 改為:
const JP_LABEL_Y    = 70;        // 「— THE POOL OF EIGHT SEAS —」label position
const JP_MARQUEE_Y  = 88;        // marquee container start (after label)
const JP_MARQUEE_H  = 132;       // hero emphasis full height
// JP_STRIP_Y / JP_STRIP_H 廢除

const ZONE_SEP_Y    = 262;       // 「戰」 separator y center
const ARENA_TOP_Y   = 285;       // arena container start (was implicit from ARENA_Y_BACK 260)
const ARENA_HEIGHT  = 310;       // 285 to 595

// p11-vA-02 才會改 ARENA_Y_FRONT/MID/BACK — 本 PR 暫保留現有但 confine to 285-595 range
// formation 仍是 1-2-2 三排（chore #146）

const REEL_ZONE_Y   = 615;       // was 700
const REEL_ZONE_H   = 340;       // 615 to 955

const LOG_Y         = 1055;      // was 1100
const LOG_H         = 185;       // was 140
```

### 3b. drawJackpotMarquee 重寫成 hero 178px

**整段替換**（既有 line 670-757 thin strip 邏輯）：

```ts
private drawJackpotMarquee(): void {
  // ── Label above hero panel: 「— THE POOL OF EIGHT SEAS —」──
  const label = new Text({
    text: '— THE POOL OF EIGHT SEAS —',
    style: {
      fontFamily: T.FONT.body, fontSize: 9,
      fill: T.FG.muted, letterSpacing: 4,
    },
  });
  label.anchor.set(0.5, 0);
  label.x = CANVAS_WIDTH / 2;
  label.y = JP_LABEL_Y;
  this.container.addChild(label);

  // ── HERO panel container: y=88, h=132, full width minus 28 margin ──
  const panelX = 28;
  const panelW = CANVAS_WIDTH - 56;
  const panelY = JP_MARQUEE_Y;
  const panelH = JP_MARQUEE_H;

  // Dark warm brown gradient bg (two-graphics simulation)
  const bgTop = new Graphics()
    .rect(panelX, panelY, panelW, panelH * 0.5)
    .fill({ color: 0x2a1a04, alpha: 1 });
  const bgBot = new Graphics()
    .rect(panelX, panelY + panelH * 0.5, panelW, panelH * 0.5)
    .fill({ color: 0x1a0f02, alpha: 1 });
  bgTop.zIndex = 5; bgBot.zIndex = 5;
  this.container.addChild(bgTop);
  this.container.addChild(bgBot);

  // Gold border + rounded corners (clip mask not needed, just stroke)
  const border = new Graphics()
    .roundRect(panelX, panelY, panelW, panelH, 6)
    .stroke({ width: 1.5, color: T.GOLD.base, alpha: 1 });
  border.zIndex = 6;
  this.container.addChild(border);

  // Inset gold glow shadow (approximate via inner stroke)
  const innerGlow = new Graphics()
    .roundRect(panelX + 2, panelY + 2, panelW - 4, panelH - 4, 5)
    .stroke({ width: 6, color: T.GOLD.base, alpha: 0.15 });
  innerGlow.zIndex = 7;
  this.container.addChild(innerGlow);

  // Marquee bulbs decoration (dotted gold pattern at top + bottom edges)
  const bulbs = new Graphics();
  const bulbY1 = panelY + 6;
  const bulbY2 = panelY + panelH - 6;
  for (let bx = panelX + 6; bx < panelX + panelW - 6; bx += 14) {
    bulbs.circle(bx, bulbY1, 1.5).circle(bx, bulbY2, 1.5);
  }
  bulbs.fill({ color: T.GOLD.glow, alpha: 0.6 });
  bulbs.zIndex = 8;
  this.container.addChild(bulbs);

  // ── Top row: ★ GRAND JACKPOT ★ label + POOL · NTD label ──
  const topRowY = panelY + 14;
  const grandLabel = new Text({
    text: '★ GRAND JACKPOT ★',
    style: {
      fontFamily: T.FONT.body, fontSize: 10,
      fill: T.GOLD.pale ?? T.GOLD.glow, letterSpacing: 4,
    },
  });
  grandLabel.x = panelX + 20;
  grandLabel.y = topRowY;
  grandLabel.zIndex = 10;
  this.container.addChild(grandLabel);

  const poolLabel = new Text({
    text: 'POOL · NTD',
    style: {
      fontFamily: T.FONT.body, fontSize: 10,
      fill: T.FG.muted, letterSpacing: 2,
    },
  });
  poolLabel.anchor.set(1, 0);
  poolLabel.x = panelX + panelW - 20;
  poolLabel.y = topRowY;
  poolLabel.zIndex = 10;
  this.container.addChild(poolLabel);

  // ── Center: GRAND value 42pt Cinzel gold + glow ──
  this.jpGrandText = goldText('5,000,000', { fontSize: 42, withShadow: true });
  this.jpGrandText.anchor.set(0.5, 0.5);
  this.jpGrandText.x = panelX + panelW / 2;
  this.jpGrandText.y = panelY + panelH * 0.5;
  this.jpGrandText.filters = [new GlowFilter({
    color: T.GOLD.base, distance: 18, outerStrength: 2.5, innerStrength: 0.5, quality: 0.4,
  })];
  this.jpGrandText.zIndex = 11;
  this.container.addChild(this.jpGrandText);

  // ── Bottom row: MAJOR + MINOR side by side with vertical divider ──
  const bottomRowY = panelY + panelH - 24;
  const dividerLine = new Graphics()
    .rect(panelX + 20, panelY + panelH - 40, panelW - 40, 1)
    .fill({ color: T.GOLD.base, alpha: 0.25 });
  dividerLine.zIndex = 9;
  this.container.addChild(dividerLine);

  const halfX1 = panelX + panelW * 0.30;
  const halfX2 = panelX + panelW * 0.70;

  const majorLbl = new Text({
    text: 'MAJOR',
    style: { fontFamily: T.FONT.body, fontSize: 9, fill: T.FG.muted, letterSpacing: 2 },
  });
  majorLbl.anchor.set(0.5, 0);
  majorLbl.x = halfX1;
  majorLbl.y = bottomRowY - 10;
  majorLbl.zIndex = 10;
  this.container.addChild(majorLbl);

  this.jpMajorText = goldText('500,000', { fontSize: 16, withShadow: false });
  this.jpMajorText.anchor.set(0.5, 0);
  this.jpMajorText.x = halfX1;
  this.jpMajorText.y = bottomRowY + 4;
  this.jpMajorText.zIndex = 10;
  this.container.addChild(this.jpMajorText);

  const minorLbl = new Text({
    text: 'MINOR',
    style: { fontFamily: T.FONT.body, fontSize: 9, fill: T.FG.muted, letterSpacing: 2 },
  });
  minorLbl.anchor.set(0.5, 0);
  minorLbl.x = halfX2;
  minorLbl.y = bottomRowY - 10;
  minorLbl.zIndex = 10;
  this.container.addChild(minorLbl);

  this.jpMinorText = goldText('50,000', { fontSize: 16, withShadow: false });
  this.jpMinorText.anchor.set(0.5, 0);
  this.jpMinorText.x = halfX2;
  this.jpMinorText.y = bottomRowY + 4;
  this.jpMinorText.zIndex = 10;
  this.container.addChild(this.jpMinorText);

  // Vertical divider between major / minor
  const vDivider = new Graphics()
    .rect(panelX + panelW * 0.5, bottomRowY - 10, 1, 30)
    .fill({ color: T.GOLD.base, alpha: 0.2 });
  vDivider.zIndex = 9;
  this.container.addChild(vDivider);
}
```

**保留 jpGrandText / jpMajorText / jpMinorText 三個 class fields** — j-05 既有 `refreshJackpotMarquee()` + `pulseJackpotText()` 邏輯不動。

### 3c. 加「戰」字 zone separator method

```ts
private drawZoneSeparator(): void {
  // Horizontal hairline gradient (transparent → gold → transparent)
  // Pixi 8 沒 native gradient line — 用 3 段 stroke 模擬
  const lineY = ZONE_SEP_Y;
  const lineW = CANVAS_WIDTH - 160;   // narrower than full width
  const lineX = 80;

  // Single thin gold line (simplification — gradient skipped)
  const line = new Graphics()
    .rect(lineX, lineY, lineW, 1)
    .fill({ color: T.GOLD.base, alpha: 0.4 });
  this.container.addChild(line);

  // 「戰」 character centered on line, gold with subtle glow
  const zhanChar = new Text({
    text: '戰',
    style: {
      fontFamily: T.FONT.title, fontWeight: '700', fontSize: 14,
      fill: T.GOLD.base, stroke: { color: T.GOLD.shadow, width: 1 },
    },
  });
  zhanChar.anchor.set(0.5, 0.5);
  zhanChar.x = CANVAS_WIDTH / 2;
  zhanChar.y = lineY;
  // Bg behind 戰 to break the line
  const charBg = new Graphics()
    .rect(zhanChar.x - 12, zhanChar.y - 10, 24, 20)
    .fill({ color: 0x02101f, alpha: 1 });
  this.container.addChild(charBg);
  this.container.addChild(zhanChar);
}
```

`onMount` 加：

```ts
this.drawJackpotMarquee();   // 既有 call 不動，但 method 內部已重寫
this.drawZoneSeparator();    // NEW
this.drawBattleArena();      // 既有
this.drawSlot();             // 既有 — 但用新 REEL_ZONE_Y=615
this.drawLog();              // 既有 — 但用新 LOG_Y=1055
```

### 3d. drawBattleArena 縮 310px + VS 改 50px circle

既有 v-01 drawBattleArena 含 warm bed + perspective + side banners + VS hexagon。

**縮 arena 高度** 從 520px (y=150-670) → 310px (y=285-595)。
**Warm bed bg** 改 panelY=285, panelH=310。
**Perspective floor** vanishing point y from 350 → 415 (arena center)。
**Side banners** y=290 (相對改動)。
**VS shield 改成簡單 50×50 circle**：

```ts
// 既有 hexagon 替換成:
const vsX = CANVAS_WIDTH / 2;
const vsY = 415;     // arena top 285 + 130
const vsR = 25;

const vsBg = new Graphics()
  .circle(vsX, vsY, vsR)
  .fill({ color: 0x2a1a04 })
  .stroke({ width: 1.5, color: T.GOLD.base });
this.container.addChild(vsBg);

const vsText = goldText('VS', { fontSize: 16, withShadow: true });
vsText.anchor.set(0.5, 0.5);
vsText.x = vsX;  vsText.y = vsY;
vsText.filters = [new GlowFilter({ color: T.GOLD.base, distance: 8, outerStrength: 1.5 })];
this.container.addChild(vsText);
```

**注意**：Spirit formation 內部結構（slotToArenaPos / drawFormation / 1-2-2 LAYOUT）**不動** — p11-vA-02 才改 NineGrid。但 ARENA_Y_FRONT/MID/BACK 數值要 confine 在 285-595 範圍：

```ts
// 暫時 (p11-vA-01) — formation 仍是 1-2-2 但壓縮 y range:
const ARENA_Y_FRONT = 540;    // 不動
const ARENA_Y_MID   = 430;    // was 380, 提高 50px (留 arena bottom 595 內)
const ARENA_Y_BACK  = 320;    // was 260, 提高 60px (避開新 separator y=262)
```

p11-vA-02 會把 1-2-2 改成 3×3 NineGrid，重新校準。

### 3e. Reel zone reposition + header strip

`drawSlot()` 內：

```ts
this.reel = new SlotReel();
this.reel.x = SLOT_X;
this.reel.y = REEL_ZONE_Y;     // 615 (was 700)
this.container.addChild(this.reel);
```

加 reel header strip 在 reel 上方（y=615-635 區段）：

```ts
private drawReelHeader(): void {
  const headerY = REEL_ZONE_Y - 5;   // 610
  const headerLeftX = 50;
  const headerRightX = CANVAS_WIDTH - 50;

  // A · 我方 (left, azure)
  const aDot = new Graphics()
    .circle(headerLeftX - 12, headerY + 6, 4)
    .fill({ color: T.CLAN.azureGlow });
  this.container.addChild(aDot);
  const aLabel = new Text({
    text: 'A · 我方',
    style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 10,
             fill: T.CLAN.azureGlow, letterSpacing: 3 },
  });
  aLabel.anchor.set(0, 0.5);
  aLabel.x = headerLeftX;  aLabel.y = headerY + 6;
  this.container.addChild(aLabel);

  // ◇ SHARED BOARD ◇ (center, gold)
  const sbLabel = new Text({
    text: '◇ SHARED BOARD ◇',
    style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 10,
             fill: T.GOLD.base, letterSpacing: 4 },
  });
  sbLabel.anchor.set(0.5, 0.5);
  sbLabel.x = CANVAS_WIDTH / 2;  sbLabel.y = headerY + 6;
  this.container.addChild(sbLabel);

  // B · 對手 (right, vermilion)
  const bLabel = new Text({
    text: 'B · 對手',
    style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 10,
             fill: T.CLAN.vermilionGlow, letterSpacing: 3 },
  });
  bLabel.anchor.set(1, 0.5);
  bLabel.x = headerRightX;  bLabel.y = headerY + 6;
  this.container.addChild(bLabel);

  const bDot = new Graphics()
    .circle(headerRightX + 12, headerY + 6, 4)
    .fill({ color: T.CLAN.vermilionGlow });
  this.container.addChild(bDot);
}
```

**onMount** 加 `this.drawReelHeader()` 在 `this.drawSlot()` 之前 or 之後。

### 3f. drawLog reposition + 加長

`drawLog()` 內 LOG_Y 改 1055，LOG_H 改 185。其他結構保持（既有 v-01 已是好的 panel + BATTLE LOG 標題 + cream text）。

### 3g. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔
- const 區重排（JP / arena / reel / log Y 座標）
- drawJackpotMarquee 整段重寫（thin → hero）
- drawZoneSeparator 新 method
- drawBattleArena 縮 310px + VS 改 circle
- drawReelHeader 新 method
- drawLog Y/H 改

**禁止**：
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- DraftScreen / LoadingScreen / ResultScreen / FXPreviewScreen
- main.ts
- DesignTokens（用既有 T.GOLD / T.SEA / T.CLAN / T.FONT — 0x2a1a04 / 0x1a0f02 / 0x02101f 是 mockup 既有色，可硬寫）
- 加新 asset
- scripts/sim-rtp.mjs
- 改 j-05 既有 refreshJackpotMarquee / pulseJackpotText（**保留 jpGrandText/jpMajorText/jpMinorText 三 class fields name**）
- 改 formation slotToArenaPos / drawFormation 內部（p11-vA-02 工作）
- 改 SlotReel cell 內部（p11-vA-03 工作）
- 加 SPIN/AUTO/SKIP 按鈕（auto-loop SPEC）
- 加 PAYLINES indicator（243-Ways SPEC）
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **2 個 commits**（per `incremental-implementation`）：
   - commit 1: const 重排 + JP marquee hero rewrite + 「戰」 separator
   - commit 2: arena 310px + VS circle + reel reposition + header strip + log reposition
3. push + PR URL
4. **Preview 驗證**（對照 mockup variant-a screenshot）：
   - JP marquee 變成 hero 178px 大金邊 + GRAND 中央 42pt 大字 + bulbs decoration + MAJOR/MINOR 並列底部
   - 「— THE POOL OF EIGHT SEAS —」label 在 marquee 上方
   - 「戰」字 separator 在 JP 與 arena 之間
   - Battle arena 變窄（從 520→310px），VS 變成小圓 50px
   - Reel zone 上方有「A · 我方 ◇ SHARED BOARD ◇ B · 對手」 header strip
   - Battle log panel 變高（140→185px）
   - **Spirit formation 仍是現有 1-2-2 三排**（p11-vA-02 才會改 NineGrid）
   - **Reel cells 仍是現有 gem-shape**（p11-vA-03 才會改 glossy ball）
   - 沒有 SPIN/AUTO/SKIP 按鈕、沒有 PAYLINES indicator
5. 截圖 1 張（含全部新 layout）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- JP marquee hero 178px 視覺感（夠不夠 hero、bulbs 是否好看、GRAND 數字 42pt 是否震撼）
- 「戰」字 separator 是否清楚（line breaks-by-character 視覺 OK）
- VS circle 50px 是否太小（之前 hexagon 80px 較有 weight）
- Reel header「A · 我方 ◇ SHARED BOARD ◇ B · 對手」 是否視覺平衡
- Spirit formation 在 arena 縮 310px 下是否擁擠（chore #146 1-2-2 vs 新 ARENA_Y 範圍 — 預期 p11-vA-02 改 NineGrid 後才完美對齊）
- 任何 j-05 refreshJackpotMarquee 或 pulseJackpotText 異常（預期 0）
- Spec deviations：預期 0
