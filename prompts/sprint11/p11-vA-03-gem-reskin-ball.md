# Sprint 11 · p11-vA-03 — Reel Gem Reskin（glossy 圓球 + 青/白/朱/玄 中文字）

## 1. Context

PR: **既有 SlotReel 用 gem-shape PNG（5 shapes × 8 tints from `gemForSymbol(sym)`）渲染 cell — 改成 mockup Variant A 的「glossy 圓球 + 中文字」純 Pixi.Graphics 風格。Owner 已確認接受 d-02 5-shape lineage 廢棄。**

Why: Sprint 11 Variant A migration 最後一塊。每 cell 顯示「青/白/朱/玄」對應 4 聖獸 clan 的中文字 + 配色發光球，**讓玩家一眼看出每 cell 是哪 clan**。比 5 種 shape 區分更清楚。

Mockup reference: `download_picture/Dual Slot Pixi/battle-shared.jsx` line 161-210 (`ReelCell` component)。

設計：

### Cell 內視覺架構（已加 p10-v02 inner ring + tier pip 不動）

```
container
├── cellBg (既有 roundRect 暗藍底)
├── innerRing (p10-v02 dashed teal inner border)
├── gemBall Container (NEW — 取代 gemSprite)
│   ├── ballShadow (slightly larger dark circle 在後)
│   ├── ballMain (clan color circle，gradient 模擬)
│   ├── ballHighlight (左上白色 ellipse，glossy 高光)
│   └── ballText (Chinese character, Ma Shan Zheng or fallback)
├── pipsContainer (p10-v02 tier pip)
└── overlay (既有 wayhit highlight)
```

### Symbol → 中文字 + 顏色 mapping

| Symbol ID | clan / type | 中文字 | Ball color |
|---|---|---|---|
| 0, 1 | azure 青龍 | **青** | T.CLAN.azureGlow (0x4a90e2) |
| 2, 3 | white 白虎 | **白** | T.CLAN.whiteGlow (0xe8c87a 偏暖白)|
| 4, 5 | vermilion 朱雀 | **朱** | T.CLAN.vermilionGlow (0xff5722) |
| 6, 7 | black 玄武 | **玄** | T.CLAN.blackGlow (0x6b9e8a 偏綠墨)|
| 8 (Wild) | — | **替** | T.GOLD.glow（substitute 替代）|
| 9 (Curse) | — | **咒** | 0x8b3aaa（紫，k-01 既有）|
| 10 (Scatter) | — | **散** | 0xff3b6b（粉紅）|
| 11 (Jackpot) | — | **寶** | T.GOLD.base（純金，最亮）|

### Glossy ball 視覺實作（Pixi 8 沒 native radial gradient）

Pure Graphics 模擬：

```ts
// Approach: 3-layer stack
// 1. ballShadow: slightly larger dark circle (drop shadow)
// 2. ballMain:   solid clan color circle
// 3. ballHighlight: small white ellipse upper-left (glossy spot)
// 4. ballText:   Chinese character bold, color white + clan color stroke

const r = Math.min(CELL_W, CELL_H) * 0.40;   // ball radius

// Shadow base
const shadow = new Graphics()
  .circle(0, 2, r + 1)
  .fill({ color: 0x000000, alpha: 0.5 });

// Main ball
const main = new Graphics()
  .circle(0, 0, r)
  .fill({ color: clanColor, alpha: 1 })
  .stroke({ width: 2, color: clanColor, alpha: 1 });

// Glossy highlight (smaller white ellipse, upper-left, alpha)
const highlight = new Graphics()
  .ellipse(-r * 0.35, -r * 0.35, r * 0.45, r * 0.30)
  .fill({ color: 0xFFFFFF, alpha: 0.55 });

// Chinese character text
const charText = new Text({
  text: charMap[symId],
  style: {
    fontFamily: T.FONT.title,    // Noto Serif TC / 思源宋體
    fontWeight: '700',
    fontSize: Math.round(r * 0.95),    // ~32-38px for r ≈ 36
    fill: 0xFFFFFF,
    stroke: { color: clanColor, width: 2 },
  },
});
charText.anchor.set(0.5, 0.5);
```

### GlowFilter for ball

加 `outerStrength: 0.8 + tier×0.2` 對應 tier 強弱（low tier 較 subtle / high tier 更發光）。

```ts
ball.filters = [new GlowFilter({
  color: clanColor,
  distance: 14,
  outerStrength: 1.0,    // base value
  innerStrength: 0.2,
  quality: 0.4,
})];
```

### 重要：保留既有 d-02 廢棄 cleanup

- 既有 `gemForSymbol(sym)` lookup table 廢棄（**不再 import / 不再 call**）
- 既有 `cell.gemSprite` field 廢棄（移除 from Cell interface）
- 既有 `Assets.get<Texture>(gemInfo.assetKey)` 廢棄（程式化生成）
- `public/assets/symbols/gems/*.webp` **暫保留 as orphan**（不在 LoadingScreen preload list 也不影響 — 後續 chore PR 可清）
- `GemMapping.ts` const **暫保留**（id 11 Jackpot mapping 還在，但運行時不查）

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Cell 是 hot path（每 spin 5×3 cells 都重 render gem）。**Container reuse pattern**：每 cell 一個 `gemBall: Container`，setCellSymbol 內 `removeChildren()` + 重建（4 Graphics + 1 Text 物件約 ~75 ops per spin，可接受）。
- **`code-simplification`** — 廢 gemForSymbol / Assets.get path，整合進 setCellSymbol。**禁止**動 cell wayhit highlight 邏輯（既有 overlay 機制 d-06）。
- **`source-driven-development`** — Pixi 8 `circle().fill().stroke()` chained API + `ellipse()` Graphics API 對照官方 docs。Chinese font fallback chain （Noto Serif TC → Ma Shan Zheng → system fallback）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 11 gem reskin glossy ball Chinese character p11-vA-03"`
2. 確認 SlotReel.ts 既有 setCellSymbol（line 167-180）+ buildCells（line 128-165）+ Cell interface
3. 確認 SYMBOLS array clan mapping（id 0-7 各自 clan，id 8-11 special flag）
4. 確認 T.CLAN.azureGlow / whiteGlow / vermilionGlow / blackGlow 存在於 DesignTokens
5. 確認 既有 p10-v02 加的 innerRing + pipsContainer + refreshCellPips method 不要動
6. 確認 既有 d-06 wayhit highlight `pulseWay()` 用 cell.overlay alpha — 不能破壞

## 3. Task

### 3a. Cell interface 改動

```ts
interface Cell {
  container: Container;
  // gemSprite: Sprite;     ← 廢除
  gemBall: Container;       // NEW — 內含 shadow + main + highlight + text
  overlay: Graphics;
  currentSymbol: number;
  pipsContainer: Container;
}
```

### 3b. buildCells 改 — 取代 gemSprite 為 gemBall Container

既有 line 149-152：
```ts
const gemSprite = new Sprite(Texture.WHITE);
gemSprite.anchor.set(0.5);
gemSprite.y = 0;
container.addChild(gemSprite);
```

改成：
```ts
const gemBall = new Container();
gemBall.x = 0;
gemBall.y = 0;
container.addChild(gemBall);
```

`colCells.push` 改成包 gemBall 而非 gemSprite。

### 3c. 加 SYMBOL_VISUAL map（const at top of SlotReel.ts）

```ts
import { SYMBOLS } from '@/config/SymbolsConfig';

const SYMBOL_VISUAL: Record<number, { char: string; color: number }> = {
  // Spirits — by clan
  0: { char: '青', color: T.CLAN.azureGlow },
  1: { char: '青', color: T.CLAN.azureGlow },
  2: { char: '白', color: T.CLAN.whiteGlow ?? 0xe8c87a },
  3: { char: '白', color: T.CLAN.whiteGlow ?? 0xe8c87a },
  4: { char: '朱', color: T.CLAN.vermilionGlow },
  5: { char: '朱', color: T.CLAN.vermilionGlow },
  6: { char: '玄', color: T.CLAN.blackGlow ?? 0x6b9e8a },
  7: { char: '玄', color: T.CLAN.blackGlow ?? 0x6b9e8a },
  // Special symbols
  8:  { char: '替', color: T.GOLD.glow },           // Wild
  9:  { char: '咒', color: 0x8b3aaa },              // Curse
  10: { char: '散', color: 0xff3b6b },              // Scatter
  11: { char: '寶', color: T.GOLD.base },           // Jackpot
};
```

**注意**：若 `T.CLAN.whiteGlow` / `T.CLAN.blackGlow` 不存在於 DesignTokens（**先 grep 確認**），用 `?? fallback` 處理。

### 3d. setCellSymbol 重寫 — 程式化 ball 生成

```ts
private setCellSymbol(cell: Cell, symId: number): void {
  if (cell.currentSymbol === symId) return;
  cell.currentSymbol = symId;

  const visual = SYMBOL_VISUAL[symId] ?? SYMBOL_VISUAL[0];
  const r = Math.min(CELL_W, CELL_H) * 0.40;   // ball radius

  // Clear existing ball children
  cell.gemBall.removeChildren();

  // Layer 1: Drop shadow
  const shadow = new Graphics()
    .circle(0, 2, r + 1)
    .fill({ color: 0x000000, alpha: 0.5 });
  cell.gemBall.addChild(shadow);

  // Layer 2: Main ball
  const main = new Graphics()
    .circle(0, 0, r)
    .fill({ color: visual.color, alpha: 1 })
    .stroke({ width: 2, color: visual.color, alpha: 1 });
  cell.gemBall.addChild(main);

  // Layer 3: Glossy highlight (upper-left ellipse)
  const highlight = new Graphics()
    .ellipse(-r * 0.35, -r * 0.35, r * 0.45, r * 0.30)
    .fill({ color: 0xFFFFFF, alpha: 0.55 });
  cell.gemBall.addChild(highlight);

  // Layer 4: Chinese character text
  const charText = new Text({
    text: visual.char,
    style: {
      fontFamily: 'Noto Serif TC, "Ma Shan Zheng", serif',
      fontWeight: '700',
      fontSize: Math.round(r * 0.95),
      fill: 0xFFFFFF,
      stroke: { color: visual.color, width: 2 },
      dropShadow: {
        color: visual.color,
        alpha: 0.6,
        blur: 6,
        distance: 0,
      },
    },
  });
  charText.anchor.set(0.5, 0.5);
  cell.gemBall.addChild(charText);

  // Subtle GlowFilter on the ball for depth
  cell.gemBall.filters = [new GlowFilter({
    color: visual.color,
    distance: 12,
    outerStrength: 1.0,
    innerStrength: 0.2,
    quality: 0.4,
  })];

  // Refresh tier pips (既有 p10-v02 logic)
  this.refreshCellPips(cell, symId);
}
```

**注意**：每次 setCellSymbol（每 spin 5×3=15 cells）都會 removeChildren+rebuild。Cost: ~75 Graphics 創建 per spin。可接受（spin 頻率 ~0.3 Hz）。

### 3e. 廢除 gemForSymbol / GemMapping import（從 SlotReel）

```ts
// 既有:
// import { gemForSymbol } from '@/config/GemMapping';

// 廢除 — 不再使用
```

GemMapping.ts 檔案保留（不刪），以防未來想 revert，但 SlotReel 不 import 了。

### 3f. 檔案範圍（嚴格）

**修改**：`src/screens/SlotReel.ts` 唯一檔
- Cell interface（gemSprite → gemBall）
- buildCells（取代 gemSprite addChild）
- setCellSymbol 整段重寫
- 新加 SYMBOL_VISUAL const map
- 移除 gemForSymbol import

**禁止**：
- DesignTokens（用既有 T.CLAN / T.GOLD — 若 whiteGlow/blackGlow 不存在用 fallback）
- SymbolsConfig（**不動**）
- GemMapping.ts（保留 dead code，不本 PR 清）
- LoadingScreen（gem webp preload 仍存在但不 hurt — 後續 chore 可清）
- BattleScreen.ts
- 其他 system / screen / fx
- `public/assets/symbols/gems/*.webp`（保留為 orphan，後續 chore PR 清）
- 改 d-06 wayhit highlight (pulseWay) 邏輯
- 改 p10-v02 innerRing / pipsContainer / refreshCellPips
- 加新 asset
- scripts/sim-rtp.mjs
- SPEC.md
- SlotEngine
- main.ts

## 4. DoD

1. `npm run build` 過
2. **1-2 個 commits**（per `incremental-implementation`）：
   - commit 1: Cell interface + buildCells + SYMBOL_VISUAL map
   - commit 2: setCellSymbol 重寫 + 移 gemForSymbol import
3. push + PR URL
4. **Preview 驗證**（對照 mockup screenshot）：
   - 每 cell 內看到一個發光的圓球（depth shadow + clan color + 左上白光 highlight + 中文字）
   - 4 clan 各自 4 顆 spirit 對應同色 + 同字（青×2 / 白×2 / 朱×2 / 玄×2）
   - Wild 替 / Curse 咒 / Scatter 散 / Jackpot 寶 在罕見 spin 時看到（自然出現或 demo mode）
   - GlowFilter 讓球有發光感（不過淡也不過強）
   - **既有 p10-v02 inner ring + tier pip 仍可見**（pip 在 cell 底部右下，ring 在 cell 邊緣）
   - **既有 d-06 wayhit highlight** 仍可觸發（hit cell overlay alpha pulse 蓋上 ball + pip）
   - Spin 動畫期間 ball 跟著 column 移動（因 gemBall 在 cell container 內）
   - 5×3 grid 看起來符合 mockup style
5. 截圖 1-2 張：
   - mid-spin stopped grid（多 clan 球並列，看 4 種顏色 + 中文字）
   - wayhit highlight 觸發瞬間（看 overlay 不被 ball 蓋）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- T.CLAN.whiteGlow / blackGlow 是否存在於 DesignTokens（grep 結果）
- 中文字渲染品質（fontFamily fallback chain 是否成功 — Noto Serif TC 在不同瀏覽器表現）
- GlowFilter 對 hot path 性能影響（每 cell 一個 filter instance × 15 cells × spin 頻率，可能 redraw 重）— 若 FPS 掉 flag
- d-06 wayhit highlight 是否仍正常（ball 不擋 overlay alpha pulse）
- pip 跟 ball 視覺層次是否清楚（pip 不被 ball 邊緣壓住）
- Spec deviations：預期 0
