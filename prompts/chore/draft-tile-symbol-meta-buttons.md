# Chore — DraftScreen tile 加 SYMBOL 圖標 + meta 加大 + A/B 按鈕水平並排

## 1. Context

Owner 試玩 chore #166-168 + #197-199 後 3 改動需求：

### Issue 1: tile 缺 SYMBOL 圖標
DraftScreen tile 沒顯示 reel 上對應的 gem 形狀（chore #199 4-shape: ◇⬠⬢⬤）。玩家在 draft 階段看不到此 spirit 對應的 reel symbol。

### Issue 2: W:N N% meta 太小
當前 meta `T.FONT_SIZE.xs`（~9pt）— 看不清。

### Issue 3: A/B 按鈕浪費垂直空間
當前（chore #168）A/B 按鈕**垂直堆疊**（A 上 / B 下），各 32px 高 + 4px gap = 68px。改**水平並排**節省 36px → 騰出空間給 SYMBOL 圖標。

純視覺布局重排 — 不動 draft 邏輯 / SymbolsConfig / button 行為。

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（1 helper / 2 button / 3 wire-up）
- **`source-driven-development`** — 抽 SlotReel.shapeFor + polygonPoints 共用 helper

---

## 2. Spec drift check (P6)

1. 確認 chore #168 DraftScreen tile layout (TILE_W 296, TILE_H 185, INFO_COL_W 100, SPRITE_COL_W 172, A/B vertical stack)
2. 確認 chore #198/#199 SlotReel `shapeFor()` + `polygonPoints()` + `SYMBOL_VISUAL` map
3. 確認 chore #173 末字 char per spirit

---

## 3. Task

### 3a. Commit 1 — 抽 GemSymbol component (共用 SlotReel + DraftScreen)

新檔案 `src/components/GemSymbol.ts`：

```ts
import { Container, Graphics, Text } from 'pixi.js';
import * as T from '@/config/DesignTokens';

/** chore #200: shared gem drawer (was inline in SlotReel.setCellSymbol).
 *  Used by SlotReel + DraftScreen tile.
 *
 *  Tier mapping (matches SlotReel chore #199):
 *    id 0-2 (low):     square ◇ (4-sided)
 *    id 3-5 (mid):     pentagon ⬠ (5-sided)
 *    id 6-7 (high):    hexagon ⬢ (6-sided)
 *    id 8/10/11 (W/S/JP): circle ⬤
 *    id 9 (Curse):     pentagon (fallback, weight=0)
 */

export function shapeFor(symId: number): { sides: number } {
  // (移動 SlotReel 既有 shapeFor 過來)
  // ... same logic ...
}

export function polygonPoints(cx: number, cy: number, r: number, sides: number): number[] {
  // (移動 SlotReel 既有 polygonPoints 過來)
}

/** chore #200: SYMBOL_VISUAL map (chore #173 char + chore #198 8 unique colors)
 *  exported so DraftScreen can use same colors */
export const SYMBOL_VISUAL: Record<number, { char: string; color: number }> = {
  // ... move from SlotReel.ts ...
};

/**
 * Draw a gem symbol icon at position (0,0) of returned Container.
 * Used by SlotReel reel cells (large) + DraftScreen tile (small).
 *
 * @param symId Symbol ID (0-11)
 * @param r Radius (pentagon outer radius). Square/Hexagon match.
 * @param charScale Char fontSize multiplier (default 0.95 of r). 0 = no char.
 */
export function drawGemSymbol(symId: number, r: number, charScale = 0.95): Container {
  const c = new Container();
  const visual = SYMBOL_VISUAL[symId];
  if (!visual) return c;
  const shape = shapeFor(symId);

  // Shadow
  const shadow = new Graphics();
  if (shape.sides === 0) {
    shadow.circle(0, r * 0.05, r + 1).fill({ color: 0x000000, alpha: 0.5 });
  } else {
    shadow.poly(polygonPoints(0, r * 0.05, r + 1, shape.sides))
      .fill({ color: 0x000000, alpha: 0.5 });
  }
  c.addChild(shadow);

  // Main gem (color fill + dark stroke)
  const main = new Graphics();
  if (shape.sides === 0) {
    main.circle(0, 0, r).fill({ color: visual.color, alpha: 1 });
    main.circle(0, 0, r).stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });
  } else {
    main.poly(polygonPoints(0, 0, r, shape.sides)).fill({ color: visual.color, alpha: 1 });
    main.poly(polygonPoints(0, 0, r, shape.sides)).stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });
  }
  c.addChild(main);

  // Highlight (small upper-left ellipse for gloss)
  const hl = new Graphics()
    .ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.15)
    .fill({ color: 0xffffff, alpha: 0.5 });
  c.addChild(hl);

  // Char overlay
  if (charScale > 0) {
    const isMultiChar = visual.char.length > 1;
    const charText = new Text({
      text: visual.char,
      style: {
        fontFamily: 'Noto Serif TC, "Ma Shan Zheng", serif',
        fontWeight: '700',
        fontSize: Math.round(r * (isMultiChar ? 0.65 : charScale)),
        fill: 0x2a1a05,
        stroke: { color: visual.color, width: 1.5 },
        dropShadow: { color: visual.color, alpha: 0.5, blur: 6, distance: 0 },
      },
    });
    charText.anchor.set(0.5, 0.5);
    charText.x = 0;
    charText.y = 0;
    c.addChild(charText);
  }

  return c;
}
```

#### SlotReel 改用 shared helper

`src/screens/SlotReel.ts`：
- 移除 inline `shapeFor` / `polygonPoints` / `SYMBOL_VISUAL`
- import from `@/components/GemSymbol`
- `setCellSymbol` 改 call `drawGemSymbol` (or 保留 inline 但 import 共用 helper for shape/colors)

> **權衡**：完全 refactor SlotReel 用 drawGemSymbol 是大重構；保守作法是 SlotReel 仍 inline drawing 但**從 GemSymbol module import** shapeFor/polygonPoints/SYMBOL_VISUAL constants。Executor 視動工量決定。**最小 diff** = export 既有 helper + DraftScreen import 用。

**Commit 1**: `feat(chore): GemSymbol component — shared gem drawer (shape + color + char) for SlotReel + DraftScreen`

---

### 3b. Commit 2 — DraftScreen tile 重排 SYMBOL + meta + A/B 並排

`src/screens/DraftScreen.ts`：

#### 3b-1. Layout const 調整

當前 line 47-58：
```ts
const INFO_NAME_Y   = TILE_PAD + 6;     // 14
const INFO_NAME_H   = 32;
const INFO_META_Y   = INFO_NAME_Y + INFO_NAME_H + 4;  // 50

const BTN_ZONE_H    = 32;
const BTN_GAP_VERT  = 4;
const BTN_A_Y       = TILE_H - TILE_PAD - 2 * BTN_ZONE_H - BTN_GAP_VERT;  // 109
const BTN_B_Y       = TILE_H - TILE_PAD - BTN_ZONE_H;                      // 145
const BTN_W         = INFO_COL_W - 8;   // 92
const BTN_X         = TILE_PAD + 4;     // 12
```

改成（horizontal A/B + GemSymbol slot）：
```ts
const INFO_NAME_Y   = TILE_PAD + 6;          // 14
const INFO_NAME_H   = 32;

const INFO_META_Y   = INFO_NAME_Y + INFO_NAME_H + 4;  // 50
// chore #200: meta size bump 9pt → 12pt
const INFO_META_H   = 18;

// chore #200: SYMBOL gem icon zone (centered in info col)
const INFO_GEM_Y    = INFO_META_Y + INFO_META_H + 6;  // 74
const INFO_GEM_R    = 18;                              // gem radius (small icon)
const INFO_GEM_CY   = INFO_GEM_Y + INFO_GEM_R;        // 92

// chore #200: A/B buttons horizontal side-by-side (was vertical stack)
const BTN_ZONE_H    = 30;
const BTN_GAP_HORZ  = 4;
const BTN_W         = (INFO_COL_W - 8 - BTN_GAP_HORZ) / 2;   // 44
const BTN_A_X       = TILE_PAD + 4;                            // 12
const BTN_B_X       = BTN_A_X + BTN_W + BTN_GAP_HORZ;          // 60
const BTN_Y         = TILE_H - TILE_PAD - BTN_ZONE_H - 4;      // 143
```

#### 3b-2. drawSpiritTile 內加 SYMBOL gem + meta 加大 + A/B 並排

當前 metaTxt fontSize line ~395 area：
```ts
const metaTxt = new Text({
  text: `W:${sym.weight}\n${prob}%`,
  style: { fontFamily: T.FONT.num, fontSize: 9, fill: T.FG.muted, ... },
});
```

改成：
```ts
const metaTxt = new Text({
  text: `W:${sym.weight}  ${prob}%`,    // chore #200: single line (was 2 lines for narrow col)
  style: {
    fontFamily: T.FONT.num,
    fontSize: 12,                        // chore #200: 9 → 12 (more visible)
    fill: T.FG.cream,
    letterSpacing: 1,
    align: 'center',
  },
});
metaTxt.anchor.set(0.5, 0);
metaTxt.x = TILE_PAD + INFO_COL_W / 2;
metaTxt.y = INFO_META_Y;
tile.addChild(metaTxt);

// chore #200: SYMBOL gem icon — visual link to reel
import { drawGemSymbol } from '@/components/GemSymbol';
const gem = drawGemSymbol(idx, INFO_GEM_R, 0.95);
gem.x = TILE_PAD + INFO_COL_W / 2;
gem.y = INFO_GEM_CY;
tile.addChild(gem);

// A button (chore #200: horizontal — was vertical y=109)
btnA.x = BTN_A_X;
btnA.y = BTN_Y;
// B button
btnB.x = BTN_B_X;
btnB.y = BTN_Y;
```

> **Caveat**：`drawGemSymbol` 內部含 char overlay（小寶石上有 spiritChar）。可能 r=18 太小看不清字 — executor 試後決定 charScale。若太密 → 改 charScale=0 (no char) or r 加大到 22。

#### 3b-3. badgeA / badgeB（角落 indicator）保留不動

既有 line 423-431（chore #166-168）的角落 A/B badge **不變**（仍在 corner）。

**Commit 2**: `feat(chore): DraftScreen tile — gem icon + bigger meta (9→12pt) + A|B horizontal buttons`

---

### 3c. Commit 3 — 整體微調 + 視覺平衡

Tile 內 layout 重新確認順序（從上到下）：
1. y=8-36: Name strip (clan-glow bg, name 22pt)
2. y=50-68: Meta 12pt（W:N N.N%）
3. y=74-110: SYMBOL gem icon (r=18 → 36 wide centered)
4. y=143-173: A | B 並排 buttons（W=44 each）

可能還有空隙 — executor preview 決定要不要 fine-tune（gem r 加大到 22 or meta y 移）。

**Commit 3**: `polish(chore): DraftScreen tile spacing fine-tune (visual balance per preview)`

> Commit 3 為 optional — 若視覺平衡 OK 可省。

---

### 3d. 檔案範圍（嚴格）

**修改/新增**：
- `src/components/GemSymbol.ts` (NEW — shared gem drawer)
- `src/screens/SlotReel.ts` (refactor: import shared helpers)
- `src/screens/DraftScreen.ts` (drawSpiritTile + const layout)

**禁止**：
- 動 chore #166-168 spirit sprite full-body / TILE_W 296 / SPRITE_COL_W 172
- 動 chore #197-199 SlotReel pip / pentagon / 8 colors
- 動 SlotEngine / SymbolsConfig / draft mechanic
- 動 BattleScreen / ResultScreen
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **2-3 atomic commits**
3. push + commit URL（PR or direct master + verify origin/master）
4. **Pre-merge audit**：
   - `grep "drawGemSymbol\|GemSymbol" src/components/GemSymbol.ts src/screens/DraftScreen.ts` — 確認新 component 共用
   - `grep "BTN_A_X\|BTN_B_X" src/screens/DraftScreen.ts` — 確認 A/B 並排
5. **Preview 驗證**：
   - DraftScreen 8 個 tile 各顯示對應 GEM symbol（◇⬠⬢ 形狀 + 寶石色 + 小末字）
   - W:N N.N% meta 12pt 清楚（vs 之前 9pt）
   - A | B 按鈕**水平並排**（不再上下堆）
   - 整體 tile 視覺平衡（gem icon 跟 sprite 不撞）
   - SlotReel reel cells 視覺零變化（chore #197-199 全保留）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（DraftScreen 完整 + 含 GEM + meta + A/B 並排）
- gem r=18 大小是否合適（or 22 較顯著）
- gem 上的 spirit char 是否可讀（小字 + char overlay）
- meta 12pt 比 9pt 改善程度
- A/B 並排 vs 上下堆 操作感（owner subjective）
- Spec deviations：1（DraftScreen tile 從 chore #168 vertical-stack → horizontal A/B + GEM icon，owner-approved 2026-05-05）
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3` 確認 source on master
