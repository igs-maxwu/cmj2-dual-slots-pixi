# Sprint 9 · v-03 — 戰場背景深度感（perspective floor + vignette + spirit ground shadow）

## 1. Context

PR: **`drawBackground()` (line 331-338) 既有「平面 40px grid」改成 mockup 風格的「**透視地板** + edge vignette + spirit 腳下陰影」**。Mockup `download_picture/high_quality_mockup.html` line ~22-30 引用 `MG_Background_P.jpg` 帶 perspective floor。

Why: Sprint 8 試玩 + mockup review，owner feedback 第 1 條「視覺升級」第三項 — 當前 BattleScreen 戰場是純水墨 grid，**畫面感平**。mockup 暗示 perspective floor 給戰場深度感（讓 spirit 對立更像「在地板上對峙」非懸空）。

設計選擇：

### 用 Graphics 自繪 vs 引入 PNG asset

**選 Graphics 自繪**（不引入 MG_Background_P.jpg）。理由：
- 引入 PNG 會讓 bundle 從 5.9MB 漲到 ~7-8MB（背景圖通常 ~1MB）
- Asset compression 已是 Sprint 4 l-01 的優化成果，不破壞
- Graphics 自繪可動態 tint 配合 4 clan formation 主色（未來擴展）
- 風格一致：與既有 SOS2 atlas + 水墨 motif 較融合

### 三層視覺結構

```
zIndex layers:
─────────────────────────────────
1. Existing 40px grid (line 333-337) — 保留作底層紋理
2. Perspective floor — NEW 8 條收束線從 ARENA_Y_FRONT+50 往下延展到底部
3. Edge vignette — NEW 4 corner radial dim
4. Spirit ground shadow — NEW 在 ARENA_Y_FRONT/BACK 線上每 spirit 一個 ellipse
─────────────────────────────────
```

### Perspective floor 細節

- 起點 Y：`ARENA_Y_FRONT - 30`（spirit 腳前一點點，視為「地平線」）
- 終點 Y：`CANVAS_HEIGHT`（畫面最底）
- 8 條收束線從中心 X = `CANVAS_WIDTH / 2`（消失點）放射到底部 8 個分位點
- 額外 3 條水平線在 floor 區段做 horizontal grid（給「深度感」）
- 配色：`T.GOLD.shadow` alpha 0.15（極淡，不喧賓奪主）
- 線條 width 1px + 些微 alpha 漸層（線越遠（高 y）越亮：alpha 0.05 → 0.2）

### Edge vignette（4 corner）

- 4 個 RadialGradient-style overlay（用 Graphics 同心圓 stack 模擬）
- 內 alpha 0、外 alpha 0.4（深 ink dark `#0D1421`）
- 每 corner ~150x150 px 區域
- zIndex 介於 perspective floor 跟 spirit container 之間

### Spirit ground shadow

- 每 spirit 腳下一個 ellipse Graphics
- 大小 ~64×16 px（橢圓形）
- 配色：黑 alpha 0.4
- 位置：`spirit.x, ARENA_Y_FRONT + 8` 或 `ARENA_Y_BACK + 8` 視 row
- **執行時機**：在既有 `addSpirit` / spirit container 創建時加 — 但這較複雜，**簡化版**：drawBackground() 跑迴圈為 5×2=10 個 spirit slot 各畫一個 shadow（依 formation 5 unit per side × 2 row 計 10 個 shadow）
- 若 spirit 死亡時 shadow 不刪除（僅是地板紋理）— 接受

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Graphics 多 layer 疊加、zIndex 排程（不蓋過 reel / spirit / HUD）、純 Graphics 模擬 radial gradient 的 stack 技巧。**特別**：vignette 用 `concentric ellipses` stack（每層 alpha 漸減）非真 radial — Pixi 8 不支援 radial fill。
- **`code-simplification`** — 既有 drawBackground 線性繪 grid → 重構為 4 個子 method（drawGridOverlay / drawPerspectiveFloor / drawEdgeVignette / drawSpiritShadows）方便 future tune。**禁止**全塞回單一 method 100+ 行。
- **`source-driven-development`** — Pixi 8 Graphics chained API 對照官方 docs（`moveTo / lineTo / stroke / fill` v8 已嚴格 immutable，差別於 v7 的 `lineStyle`）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "battle background depth perspective floor vignette v-03"`
2. 確認 BattleScreen.ts line 331-338 現行 drawBackground
3. 確認 ARENA_Y_FRONT = 460、ARENA_Y_BACK = 426 const（line 69-70）
4. 確認 AmbientBackground 在 main.ts 或 LoadingScreen 提供 base color（既有，本 PR drawBackground 註解第一句確認）
5. 確認 5 unit × 2 row formation 結構 — `selectedA` array length 5、formation row 'front' / 'back' 有此 split

## 3. Task

### 3a. 重構 drawBackground 拆 4 子 method

```ts
private drawBackground(): void {
  this.drawGridOverlay();
  this.drawPerspectiveFloor();
  this.drawEdgeVignette();
  this.drawSpiritShadows();
}

// 既有保留改名為 drawGridOverlay
private drawGridOverlay(): void {
  const grid = new Graphics();
  for (let x = 0; x < CANVAS_WIDTH; x += 40) grid.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT);
  for (let y = 0; y < CANVAS_HEIGHT; y += 40) grid.moveTo(0, y).lineTo(CANVAS_WIDTH, y);
  grid.stroke({ width: 1, color: T.SEA.deep, alpha: 0.25 });
  this.container.addChild(grid);
}
```

### 3b. drawPerspectiveFloor

```ts
private drawPerspectiveFloor(): void {
  const floor = new Graphics();
  const horizonY = ARENA_Y_FRONT - 30;     // 地平線 y
  const vanishX  = CANVAS_WIDTH / 2;       // 消失點 x
  const bottomY  = CANVAS_HEIGHT;
  const goldShadow = T.GOLD.shadow;

  // 8 條收束線從消失點放射到底部 8 個分位
  for (let i = 0; i <= 8; i++) {
    const bottomX = (CANVAS_WIDTH / 8) * i;
    floor.moveTo(vanishX, horizonY).lineTo(bottomX, bottomY);
  }
  floor.stroke({ width: 1, color: goldShadow, alpha: 0.15 });

  // 3 條水平 grid 給「深度感」
  const horizSeparator = new Graphics();
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;                         // 0.25, 0.5, 0.75
    const y = horizonY + (bottomY - horizonY) * t;
    // 用 lerp 縮短：越深越短
    const widthHalf = (CANVAS_WIDTH / 2) * (0.4 + t * 0.6);   // 0.55x → 1.0x
    horizSeparator.moveTo(vanishX - widthHalf, y).lineTo(vanishX + widthHalf, y);
  }
  horizSeparator.stroke({ width: 1, color: goldShadow, alpha: 0.2 });

  this.container.addChild(floor);
  this.container.addChild(horizSeparator);
}
```

### 3c. drawEdgeVignette

```ts
private drawEdgeVignette(): void {
  // 4 corner concentric ellipses simulate radial dim
  const cornerSize = 180;
  const corners: Array<[number, number]> = [
    [0, 0],                                     // top-left
    [CANVAS_WIDTH, 0],                          // top-right
    [0, CANVAS_HEIGHT],                         // bottom-left
    [CANVAS_WIDTH, CANVAS_HEIGHT],              // bottom-right
  ];

  for (const [cx, cy] of corners) {
    const v = new Graphics();
    // 6 同心圓 stack 模擬 radial gradient
    for (let i = 0; i < 6; i++) {
      const r = cornerSize * (i + 1) / 6;
      const alpha = 0.06 * (6 - i);          // outer 0.06 × 6 = 0.36 → inner ~0
      v.circle(cx, cy, r).fill({ color: 0x0D1421, alpha });
    }
    this.container.addChild(v);
  }
}
```

### 3d. drawSpiritShadows

```ts
private drawSpiritShadows(): void {
  // 5 unit × 2 side = 10 ground shadows
  // 假設 formation 已 mounted 後 spirit 位置可從 this.formationA / formationB 訪問
  // 但 drawBackground 在 spirit mount 之前 — 用 hardcoded slot positions
  const A_FRONT_X = [110, 175, 240];   // 3 front-row x positions per side
  const A_BACK_X  = [142, 207];         // 2 back-row x positions per side
  const B_FRONT_X = [CANVAS_WIDTH - 110, CANVAS_WIDTH - 175, CANVAS_WIDTH - 240];
  const B_BACK_X  = [CANVAS_WIDTH - 142, CANVAS_WIDTH - 207];

  const shadow = new Graphics();
  // 注意：v-03 假設 formation 用此布局；若不對，executor 從 formationA/B 動態取 spirit world position
  for (const x of A_FRONT_X) {
    shadow.ellipse(x, ARENA_Y_FRONT + 8, 32, 8).fill({ color: 0x000000, alpha: 0.4 });
  }
  for (const x of A_BACK_X) {
    shadow.ellipse(x, ARENA_Y_BACK + 8, 32, 8).fill({ color: 0x000000, alpha: 0.4 });
  }
  for (const x of B_FRONT_X) {
    shadow.ellipse(x, ARENA_Y_FRONT + 8, 32, 8).fill({ color: 0x000000, alpha: 0.4 });
  }
  for (const x of B_BACK_X) {
    shadow.ellipse(x, ARENA_Y_BACK + 8, 32, 8).fill({ color: 0x000000, alpha: 0.4 });
  }
  this.container.addChild(shadow);
}
```

**注意**：A_FRONT_X / A_BACK_X 等 hardcoded position 需對齊既有 formation drawing 邏輯。**executor 探查 formation 實際 spirit x 座標** — 若有 helper 如 `this.formationA.getUnitPosition(slotIndex)` 可動態取，更準。若無，hardcoded 5 × 2 = 10 位置作為近似（陰影偏一點點 OK，不嚴重）。

### 3e. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔（drawBackground 重構 + 4 個新 sub-method）

**禁止**：
- AmbientBackground.ts（base color 提供，本 PR 不動）
- DesignTokens（`0x0D1421` ink dark 是 deck p-03 已用色票，可硬寫）
- LoadingScreen / main.ts
- formation 系統 / SpiritFormation logic
- 加新 asset（**特別禁止** — 不引入 MG_Background_P 等 PNG，bundle bloat）
- SymbolsConfig / SlotEngine 等
- scripts/sim-rtp.mjs
- v-01 / v-02 / pace-01 / res-01 範疇
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. 1 個 commit（純視覺）
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle，看到戰場有**透視地板感**（8 條收束線從畫面中央 ~y=430 放射到底部）
   - 4 角落有暗化 vignette（不蓋過 spirit / reel）
   - 每個 spirit 腳下有橢圓陰影（前排 vs 後排深度不同）
   - 既有 grid 還在（背景紋理）
   - HUD（top bar / JP marquee / wallet / curse hud）全部正常顯示，不被遮
5. 截圖 1 張（俯瞰整個 BattleScreen，需見到 4 個視覺新元素）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- Spirit ground shadow x 座標是用 hardcoded 還是 formation helper 動態取
- 4 角 vignette 視覺強度評（OK / 太強蓋臉 / 太弱看不到）
- 透視線是否影響 reel / wayHit highlight 視覺（預期 0 — perspective floor 在 ARENA 區段、reel 在更上面）
- Spec deviations：預期 0
