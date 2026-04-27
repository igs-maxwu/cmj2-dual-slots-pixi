# Sprint 10 · p10-v01 — Layout hierarchy reset（套 Variant B 視覺架構，保留 1-reel shared 5×3 SPEC）

## 1. Context

PR: **依據 Owner 在 Claude Design 跑出來的 mockup `download_picture/battle-variant-b.jsx` 重排 BattleScreen layout — battle arena 升為 hero zone（510px）/ JP marquee 壓縮為 thin strip（64px）/ Header 緊縮 60px / 加 active spirit pulse ring + Variant B SVG-style perspective floor。**

**關鍵限制（Path 1）**：mockup 假設「2 個獨立 3×3 reel + SPIN/AUTO/SKIP 按鈕」，但**我們 SPEC 是 1 個共享 5×3 reel + auto-loop**。本 PR 採 **Variant B 的 layout 階層 + 視覺風格**，但**不改 SPEC** — reel 部分維持 1 個 shared 5×3，**移除 SPIN / AUTO / SKIP 按鈕**（auto-loop 不需要）。

Why: Sprint 10 the-stylist audit P1-B「無視覺 weight hierarchy」+ P1-D「perspective floor 太弱」+ P1-E「spirit 站位擁擠」一次解掉。**Pitch 訴求是「東方四聖獸 PvP 對戰」— battle 才是 hero**。

Mockup 預覽：
- File: `download_picture/Battle Screen Mockup.html`（owner 已跑 Claude Design 產出）
- Reference jsx: `download_picture/battle-variant-b.jsx`（line 18-282）+ `battle-shared.jsx`（PALETTE / SpiritToken / JPMarquee compact / PerspectiveFloor / BattleBg）

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — 大型 layout 重排、Container hierarchy 重構、SVG-style perspective floor → Pixi Graphics 翻譯（vanishing-point lines + eased horizontal bands）、active ring pulse animation、warm bed gradient panel。**特別**：mockup 用 React + CSS，本 PR 翻成 Pixi 8 等價（gradient 用兩 Graphics 疊或 single fill alpha approximation）。
- **`code-simplification`** — 既有 BattleScreen.ts 各 draw method（drawTopBar / drawHeader / drawWallets / drawJackpotMarquee / drawBackground 等）有些可合併成更清楚的 zone-based structure。但**禁止**全塞單一 method — 保 single-responsibility。
- **`source-driven-development`** — Variant B mockup 的 SVG perspective `Array.from({length:11})` map vanishing lines 跟 eased band `t*t` quadratic — 直接抄這個 pattern 到 Pixi Graphics chained API。

---

## 2. Spec drift check (P6)

1. `mempalace_search "p10-v01 Variant B layout hero arena thin JP strip"`
2. 確認 `BattleScreen.ts` p10-bug-01 後的狀態（drawHeader 已空 stub、UNIT_HP_BAR_Y_OFF=-(SPIRIT_H/2+8)、sortableChildren=true、SlotReel dragon-corner fallback）
3. 確認 `download_picture/battle-variant-b.jsx` + `battle-shared.jsx` mockup 內容（**executor 必讀**）— 像素值、配色、字距、字型全部 mockup 為準
4. 確認既有 SPEC §3「shared 5×3 grid」沒改 — 本 PR **不動 SlotEngine**

## 3. Task

### 3a. Layout 重新分區（從 mockup variant B 抓座標）

**新 layout 階層**（720×1280 portrait）：

```
y=0-60      Header (60px tall)
              ├─ y=18 RETREAT button left
              ├─ y=18 ROUND pill center
              └─ y=18 wallet A | wallet B right
y=70-134    JP thin strip (64px) — emphasis="low" 風格
y=150-660   Battle arena hero zone (510px)
              ├─ Arena warm bed bg panel
              ├─ Perspective floor SVG-style (vanishing y=150, 290px tall)
              ├─ Side banners: 「A · 我方陣營」(L) / 「對手陣營 · B」(R)
              ├─ VS shield centered at y=380 (80×80 hexagon)
              ├─ Spirit A formation: back row y=210 size=56, front row y=410 size=84
              ├─ Spirit B formation: mirrored
              └─ Active spirit ring (animated pulse)
y=685-1015  Reel zone (330px) — **1 shared 5×3** (NOT REEL A | B)
              └─ Cells ~120×100px (5 cols × 3 rows)
y=1030-1200 Battle log dedicated panel (170px)
y=1200-1280 (80px buffer / safe zone)
```

**注意**：mockup 有 action bar (SPIN/AUTO/SKIP) 在 y=1025 — **本 PR 不加**，那個區段給 battle log 多空間。

### 3b. Header（y=0-60，緊縮 → 全部塞單列）

替換既有 `drawTopBar()` + `drawHeader()` + `drawWallets()` 三個 method 改成 `drawCompactHeader()`：

```ts
private drawCompactHeader(): void {
  // RETREAT button (left)
  const retreatBtn = new Graphics()
    .roundRect(28, 18, 92, 36, 4)
    .stroke({ width: 1, color: T.FG.muted, alpha: 0.4 });
  retreatBtn.eventMode = 'static';
  retreatBtn.cursor = 'pointer';
  retreatBtn.on('pointertap', () => this.onMatchEnd());   // 既有 callback
  this.container.addChild(retreatBtn);

  const retreatLabel = new Text({
    text: '← RETREAT',
    style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 11,
             fill: T.FG.muted, letterSpacing: 2.4 },
  });
  retreatLabel.anchor.set(0.5, 0.5);
  retreatLabel.x = 28 + 46;  // button center
  retreatLabel.y = 18 + 18;
  this.container.addChild(retreatLabel);

  // ROUND pill (center) — 簡化既有 v-01 design
  // 加 R 字 muted + 數字 大字（per the-stylist P2-B 建議）
  this.roundPill = new Container();
  this.roundPill.x = CANVAS_WIDTH / 2;
  this.roundPill.y = 18 + 18;
  // ... pill bg + R + number — 從既有 drawTopBar 移過來改字級

  // Wallet A | B (right) — 緊縮顯示
  // 8pt 「A」azure label + 13pt Cinzel 數字
  // 8pt 「B」vermilion label + 13pt Cinzel 數字
  // 排列在 right side (x=CANVAS_WIDTH-28 起算往左)
  // ... 詳見 mockup variant-b.jsx line 53-63
}
```

**原既有的 PLAYER A/B label + walletText（v-01 加）廢除** — 改成 mockup variant 的 compact 8pt+13pt 排版。

### 3c. JP thin strip（y=70-134，64px）

**重寫 `drawJackpotMarquee()`** 改成 mockup `JPMarquee emphasis="low"` 等價（shared.jsx line 277-307）：

```
[JACKPOT POOL]                    [MAJOR]      [MINOR]
12,480,000  (gold 22pt + glow)    248,500      12,300
                                  (cream 12pt) (cream 12pt)
```

- Container 高 64px，y=70-134
- 左半：JACKPOT POOL label（8pt muted）+ GRAND 數字（22pt gold + GlowFilter outerStrength 0.8）
- 右半：MAJOR + MINOR side-by-side（8pt label muted + 12pt cream 數字）
- 背景：linear gradient 暗黃 + 暗藍混合（rgba(42,26,4,0.6) → rgba(13,37,71,0.6)）— 用 2-Graphics 疊
- 邊框：1px gold alpha 0.5

**保留 j-05 既有 `jpMinorText / jpMajorText / jpGrandText` class fields name**（**不可重命名** — j-05 `refreshJackpotMarquee` + `pulseJackpotText` 還靠它們）。

### 3d. Battle arena hero zone（y=150-660，510px）

**新 method `drawBattleArena()`**：

#### 3d-1. Arena warm bed bg panel
```ts
const bedY = 180, bedH = 470;  // y=180 起，470px 高
const bed = new Graphics()
  .roundRect(14, bedY, CANVAS_WIDTH - 28, bedH, 12)
  .fill({ color: 0x0d2547, alpha: 0.55 });   // panel + 0.4 alpha
// Add 1px gold border
const bedBorder = new Graphics()
  .roundRect(14, bedY, CANVAS_WIDTH - 28, bedH, 12)
  .stroke({ width: 1, color: T.GOLD.base, alpha: 0.2 });
```

#### 3d-2. Perspective floor SVG-style
依 mockup variant-b.jsx line 87-108 翻成 Pixi Graphics：

```ts
// Vanishing point at (CANVAS_WIDTH/2, 350) — 即 arena top + 200
// Lines extend from VP to bottom of arena (y=640)
const floor = new Graphics();
const vpX = CANVAS_WIDTH / 2;
const vpY = 350;
const floorBottomY = 640;
const floorWidth = CANVAS_WIDTH - 28;

// 11 radial lines (i=0..10)
for (let i = 0; i <= 10; i++) {
  const bottomX = 14 + (floorWidth / 10) * i;
  const isCenter = i === 5;
  floor.moveTo(vpX, vpY).lineTo(bottomX, floorBottomY);
}
floor.stroke({ width: 1, color: T.GOLD.base, alpha: 0.4 });

// Center line stronger
const centerLine = new Graphics()
  .moveTo(vpX, vpY).lineTo(vpX, floorBottomY)
  .stroke({ width: 1.5, color: T.GOLD.base, alpha: 0.55 });

// 4 horizontal eased bands at t=0.18, 0.36, 0.58, 0.82
const bandCt = [0.18, 0.36, 0.58, 0.82];
const bandsG = new Graphics();
for (const t of bandCt) {
  const y = vpY + (floorBottomY - vpY) * (t * t);  // quadratic ease
  const xL = vpX - (floorWidth / 2) * (t * t);
  const xR = vpX + (floorWidth / 2) * (t * t);
  bandsG.moveTo(xL, y).lineTo(xR, y);
}
bandsG.stroke({ width: 1, color: T.GOLD.base, alpha: 0.4 });

// Center vertical dashed divider (mockup line 105-106)
// Pixi 8 不支援 dashed — 自己迴圈畫短段
const dashG = new Graphics();
let dashY = vpY;
while (dashY < floorBottomY) {
  dashG.moveTo(vpX, dashY).lineTo(vpX, Math.min(dashY + 4, floorBottomY));
  dashY += 10;  // 4px line + 6px gap
}
dashG.stroke({ width: 1.5, color: T.GOLD.base, alpha: 0.45 });
```

#### 3d-3. Side banners「A · 我方陣營」「對手陣營 · B」
```ts
// Left banner (A side)
const bannerA = new Graphics()
  .rect(28, 160, 130, 28)
  .fill({ color: T.CLAN.azureGlow, alpha: 0.2 });  // gradient mockup 用 horizontal — Pixi 簡化純 alpha tint
const bannerABorder = new Graphics()
  .rect(28, 160, 2, 28)
  .fill({ color: T.CLAN.azureGlow });
const bannerAText = new Text({
  text: 'A · 我方陣營',
  style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: 14,
           fill: T.CLAN.azureGlow, letterSpacing: 3.5 },
});
bannerAText.anchor.set(0, 0.5);
bannerAText.x = 42;  bannerAText.y = 174;

// Mirror for B side at right
// ... bannerB similar，mirror x，文字「對手陣營 · B」
```

#### 3d-4. VS shield（80×80 六邊形）
```ts
const vsX = CANVAS_WIDTH / 2;
const vsY = 380;
const shieldR = 40;

// Hexagon outer + radial gradient bg (mockup line 138-146)
// 用 polygon vertices: (vsX, vsY-36), (vsX+32, vsY-20), (vsX+32, vsY+12),
//                     (vsX, vsY+36), (vsX-32, vsY+12), (vsX-32, vsY-20)
const vsShield = new Graphics()
  .poly([vsX, vsY-36, vsX+32, vsY-20, vsX+32, vsY+12,
         vsX, vsY+36, vsX-32, vsY+12, vsX-32, vsY-20])
  .fill({ color: 0x1a0f02 })
  .stroke({ width: 2, color: T.GOLD.base });
this.container.addChild(vsShield);

// VS text
const vsText = goldText('VS', { fontSize: 22, withShadow: true });
vsText.anchor.set(0.5, 0.5);
vsText.x = vsX;  vsText.y = vsY;
vsText.filters = [new GlowFilter({ color: T.GOLD.base, distance: 10, outerStrength: 1.5 })];
this.container.addChild(vsText);
```

zIndex 設 8（既有 sortableChildren=true 後生效）。

#### 3d-5. Spirit formations（已重排座標）

mockup variant B 用：
- Spirit A back row: y=210 (60+150) 起 size=56，3 個橫排
- Spirit A front row: y=410 起 size=84，2 個橫排
- Spirit B mirrored at right

**保留既有 `formationA / formationB` 邏輯**（5 unit 配置、HP bar、attack 動畫）— 只**改 ARENA_Y_FRONT / ARENA_Y_BACK + ARENA_*_CENTER_X / ARENA_SPACING_** 等 const：

```ts
// 從 (existing) ARENA_Y_FRONT=460, ARENA_Y_BACK=426 (34px depth gap)
// 改為:
const ARENA_Y_FRONT = 510;       // mockup front row y=410 + 100 (allowance)
const ARENA_Y_BACK  = 290;       // mockup back row y=210 + 80 (allowance)
const ARENA_A_CENTER_X = 184;    // mockup left cluster center
const ARENA_B_CENTER_X = CANVAS_WIDTH - 184;
const ARENA_SPACING_FRONT_X = 80;
const ARENA_SPACING_BACK_X  = 60;
const SPIRIT_H_FRONT = 110;      // 84 mockup + scale up for Pixi sprite
const SPIRIT_H_BACK  = 70;       // back row smaller
```

**注意**：既有 `SPIRIT_H` const 是固定 130 — 本 PR 改成 front/back 不同 size 兩 const。`drawFormation()` 內部依 row 取對應 size。

#### 3d-6. Active spirit ring (pulse animation)
mockup line 192-205：80×80 圓圈 + animated pulse box-shadow。Pixi 等價：

```ts
private activeRing!: Graphics;
private activeRingTickFn: ((tk: Ticker) => void) | null = null;

private drawActiveRing(): void {
  this.activeRing = new Graphics()
    .circle(0, 0, 50)
    .stroke({ width: 2, color: T.GOLD.glow, alpha: 0.9 });
  // Set position to first front-row spirit slot (initially)
  this.activeRing.x = ARENA_A_CENTER_X - ARENA_SPACING_FRONT_X / 2;
  this.activeRing.y = ARENA_Y_FRONT - 15;
  this.activeRing.zIndex = 6;
  this.activeRing.visible = false;  // show only when active
  this.container.addChild(this.activeRing);

  // Pulse: animate alpha + scale 1.6s loop
  let elapsed = 0;
  this.activeRingTickFn = (tk) => {
    elapsed += tk.deltaMS;
    const t = (elapsed % 1600) / 1600;
    const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * t);  // 0..1
    this.activeRing.alpha = 0.6 + wave * 0.4;  // 0.6 → 1.0
    this.activeRing.scale.set(1 + wave * 0.1);  // 1.0 → 1.1
  };
  Ticker.shared.add(this.activeRingTickFn);
}
```

`onUnmount` 清：`if (this.activeRingTickFn) Ticker.shared.remove(this.activeRingTickFn)`

**註**：active ring 何時 show / 移到哪個 spirit — 本 PR 簡化版**只在 attack 期間 show 在當前出招的 spirit**。可以在 `attackTimeline` 開始時 call `setActiveRing(spirit)`，結束時 `hideActiveRing()`。若實作太複雜可暫時**永久 hide**（Sprint 11 再接動態邏輯）— 本 PR 接受 placeholder。

### 3e. Reel zone（y=685-1015，**保留 1 shared 5×3 SPEC**）

**這是 Path 1 跟 mockup 不同的關鍵點**。

Mockup variant B 用「REEL A | REEL B 兩個 3×3」— 我們**不採用**，維持 1 個 shared 5×3。

新 reel zone（在 BattleScreen 內 reposition + SlotReel cell 改尺寸）：

```ts
// BattleScreen 內 reel container 位置:
const REEL_ZONE_Y = 685;
const REEL_ZONE_H = 330;
this.reel.container.x = (CANVAS_WIDTH - REEL_W) / 2;  // 既有 REEL_W 由 SlotReel 算
this.reel.container.y = REEL_ZONE_Y;
```

**SlotReel.ts 改 CELL 尺寸**：

```ts
// 既有 (line 19-20):
const CELL_W = 128;
const CELL_H = 150;
// 改為:
const CELL_W = 124;   // 5 cols × 124 + 4 gaps × 8 = 652px (留 ~34 margin)
const CELL_H = 100;   // 3 rows × 100 + 2 gaps × 8 = 316px
```

**REEL frame** 加 mockup 風格 inner glow + 漸層 bg（既有 dragon-corner 跟 ornate frame 保留，只調 panel bg gradient）：

```ts
// Reel frame inner: 
//   linear-gradient(180deg, rgba(42,26,4,0.5) 0%, rgba(13,37,71,0.7) 100%)
// Pixi 等價: 兩個 Graphics 上下半疊，alpha 0.5
```

**不加 REEL A / REEL B 標籤**（共享，無需）。**可選**：col 0 加 azure 微光、col 4 加 vermilion 微光暗示「A 從左讀、B 從右讀」（the-stylist 提過的好點子，但本 PR 不強制）。

### 3f. Battle log（y=1030-1200，170px）

新 method `drawBattleLog()`：

```ts
private drawBattleLog(): void {
  const logY = 1030;
  const logH = 170;
  const logBg = new Graphics()
    .roundRect(28, logY, CANVAS_WIDTH - 56, logH, 6)
    .fill({ color: 0x0d2547, alpha: 0.5 })
    .stroke({ width: 1, color: T.FG.muted, alpha: 0.2 });
  this.container.addChild(logBg);

  // Title 「BATTLE LOG」
  const logTitle = new Text({
    text: 'BATTLE LOG',
    style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 9,
             fill: T.FG.muted, letterSpacing: 2.7 },
  });
  logTitle.x = 44;  logTitle.y = logY + 12;
  this.container.addChild(logTitle);

  // Hairline below title
  // Then logText area below — 既有 logText 重新 reposition 到此 panel 內
  this.logText.x = 44;
  this.logText.y = logY + 36;
  this.logText.style.fontSize = T.FONT_SIZE.sm;
  this.logText.style.fill = T.FG.cream;   // P2-C 既有 audit 建議 cream not muted
}
```

**既有 logText 已存在** — 重新 reposition 到此 panel 內，調字級 + 顏色（per the-stylist P2-C）。

### 3g. 既有元素移除清單

本 PR 移除（不再需要）：
- 既有 `drawTopBar()` 整 method — 由 `drawCompactHeader()` 替換
- 既有 `drawHeader()` 空 stub（p10-bug-01 留的）— 可移除呼叫
- 既有 `drawWallets()` PLAYER A/B label + 大 wallet text — 改 compact 版進 header
- 既有 「BACK TO DRAFT」 button at bottom — 改 RETREAT in header
- 既有 `drawJackpotMarquee()` 2-row 大版本 — 改 64px thin strip
- 既有 `drawBackground()` 內 `drawPerspectiveFloor() / drawEdgeVignette() / drawSpiritShadows()` 全螢幕版 — perspective 限到 arena 區（v-03 sub-methods 部分保留作 helper）

**注意**：`onUnmount` 既有 destroy 自動清，新加的 active ring ticker 要 explicit remove。

### 3h. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（重排，**最大改動**）
- `src/screens/SlotReel.ts`（CELL_W / CELL_H 改 + 可能 reel frame bg gradient 微調）

**禁止**：
- SlotEngine / DamageDistributor / JackpotPool / FreeSpin（**SPEC 不動**）
- DraftScreen / LoadingScreen / ResultScreen / FXPreviewScreen
- main.ts callback chain
- 加新 asset
- 加 SPIN / AUTO / SKIP 按鈕（auto-loop SPEC 不適用）
- 改 SPEC.md
- 改 j-05 既有 refresh / pulse method（用既有 jpMinorText / jpMajorText / jpGrandText fields）
- scripts/sim-rtp.mjs（純視覺 PR）
- 改 MatchResult interface / ResultScreen
- 改 res-01 / pace-01 邏輯
- 改 dragon-corner fallback（p10-bug-01 已修）

## 4. DoD

1. `npm run build` 過
2. **2-3 個 commits**（per `incremental-implementation`）：
   - commit 1: header + JP thin strip 重排
   - commit 2: battle arena hero zone（warm bed + perspective + side banners + VS + spirit reposition）
   - commit 3: reel resize + battle log panel + active ring（選配）
3. push + PR URL
4. **Preview 驗證 critical**（對照 mockup 看視覺一致性）：
   - Header 60px 緊縮，RETREAT 左 / ROUND 中 / wallet A B 右並排
   - JP thin strip 64px，左 GRAND 大字 / 右 MAJOR MINOR 並列
   - Battle arena 510px 視覺感**明顯比 reel 區大**（hero）
   - VS shield hexagon at center y=380，不再被 header 切到
   - 5v5 spirit 站位寬鬆（不擠）+ 後排比前排小（depth）
   - Perspective floor 對比明顯（gold alpha 0.4-0.55）
   - Reel 為 1 個 shared 5×3（**不是 2 個 3×3**），cells ~124×100 landscape
   - Battle log 在底部獨立 panel，cream 字 13pt 看得到
   - 沒有 SPIN / AUTO / SKIP 按鈕
5. 截圖 1-2 張（一張完整 BattleScreen，一張中段 spin 動作）
6. 對照 mockup variant B 視覺**整體相似度**（不需 1:1，但 zone hierarchy 要對）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- Active ring 是否實作（dynamic follow attack OR placeholder hidden）
- ARENA_*_X / Y / SPACING / SPIRIT_H 最終值（多少跟 mockup 對齊）
- Reel cell 改 124×100 視覺感（gem 是否仍適合，可能需 v-02 微調 targetSize）
- 既有 j-05 marquee refresh / pulse 是否仍正常（jpMinorText/jpMajorText/jpGrandText 邏輯不破壞）
- 任何視覺與 mockup 顯著不同處（flag 給後續 v-02 / v-04 處理）
- Spec deviations：預期 0（**Path 1 嚴守 SPEC，僅視覺重排**）
