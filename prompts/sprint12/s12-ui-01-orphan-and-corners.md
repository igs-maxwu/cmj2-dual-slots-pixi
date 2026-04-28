# Sprint 12 · s12-ui-01 — Orphan webp 刪 + corner-ornament + dragon-corner 全 programmatic

## 1. Context

PR: **Sprint 12 第一張 PR — UI Asset Decommission Track。刪 4 個 orphan Gemini webp + corner-ornament 改 Pixi.Graphics L-bracket + dragon-corner 永久走 fallback path（既有 #142 已實作）。**

Why: Owner 要求「之前用 gemini 產的邊框都不要了」。Audit 發現 4 個 webp 沒人用（vs-badge / jp-marquee / hp-frame / draft-tile-frame），可直接刪。corner-ornament 跟 dragon-corner 還在用但兩個都已有 programmatic 替代路徑（dragon-corner 從 #142 起就有 fallback）— 本 PR 把它們**永久化**。

Mockup reference: `download_picture/Dual Slot Pixi/battle-shared.jsx` line 52-61 (`CornerOrnament` SVG component as visual reference)。

---

## Skills suggested for this PR

- **`incremental-implementation`** — 3 atomic commits：(1) orphan delete + UI_ASSET_KEYS clean，(2) corner-ornament programmatic 替換，(3) dragon-corner asset 路徑移除。
- **`code-simplification`** — `Decorations.ts` 改寫 `addCornerOrnaments`：從 `Assets.get` Sprite path 改 pure Graphics 畫 L-bracket。Removes asset dependency。
- **`source-driven-development`** — Pixi 8 chained Graphics `.moveTo().lineTo().stroke()` API 對照官方 docs；mockup `CornerOrnament` SVG path `M2 2 L20 2 M2 2 L2 20 M2 2 L12 12` 翻成 Pixi Graphics call。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 12 UI asset decommission orphan corner ornament Gemini"`
2. 確認 `public/assets/ui/` 內 4 orphan 檔案存在：vs-badge.webp / jp-marquee.webp / hp-frame.webp / draft-tile-frame.webp
3. 確認 `src/config/UiAssets.ts` 含這 4 個 key
4. 確認 `src/components/Decorations.ts` `addCornerOrnaments` 用 `Assets.get<Texture>('corner-ornament')`
5. 確認 `src/screens/SlotReel.ts` `buildFrame()` 已有 dragon-corner Sprite path + Graphics fallback (PR #142)

## 3. Task

### 3a. Commit 1 — Orphan webp delete + UI_ASSET_KEYS clean

**刪 4 個 webp 檔案**：

```bash
rm public/assets/ui/vs-badge.webp
rm public/assets/ui/jp-marquee.webp
rm public/assets/ui/hp-frame.webp
rm public/assets/ui/draft-tile-frame.webp
```

**UI_ASSET_KEYS** (`src/config/UiAssets.ts`) 刪 4 條目：

既有：
```ts
export const UI_ASSET_KEYS = [
  'slot-frame',
  'draft-tile-frame',     // ← 刪
  'btn-normal',
  'btn-ornate',
  'hp-frame',             // ← 刪
  'portrait-ring',
  'corner-ornament',
  'dragon-corner',
  'win-burst',
  'divider',
  'vs-badge',             // ← 刪
  'jp-marquee',           // ← 刪
  'logo-mark',
] as const;
```

改為（剩 9 個）：
```ts
export const UI_ASSET_KEYS = [
  'slot-frame',
  'btn-normal',
  'btn-ornate',
  'portrait-ring',
  'corner-ornament',
  'dragon-corner',
  'win-burst',
  'divider',
  'logo-mark',
] as const;
```

**Verify**：`npm run build` 過。Preview 進 Battle 跟 Draft，無 Asset.get warning（因為 LoadingScreen preload 自動跟 UI_ASSET_KEYS array — 自動少 preload 4 個）。

**Commit 1**: `chore(s12-ui-01a): delete 4 orphan UI webp + remove from UI_ASSET_KEYS`

### 3b. Commit 2 — Corner ornament programmatic L-bracket

`src/components/Decorations.ts` 重寫 `addCornerOrnaments`：

既有：
```ts
import { Assets, Container, Sprite, Texture } from 'pixi.js';

export function addCornerOrnaments(
  container: Container,
  regionW: number,
  regionH: number,
  size = 180,
  alpha = 0.45,
): void {
  const tex = Assets.get<Texture>('corner-ornament');
  if (!tex) return;
  const k = size / tex.width;
  const places = [
    { sx:  1, sy:  1, x: 0,       y: 0       },
    { sx: -1, sy:  1, x: regionW, y: 0       },
    { sx:  1, sy: -1, x: 0,       y: regionH },
    { sx: -1, sy: -1, x: regionW, y: regionH },
  ];
  for (const p of places) {
    const s = new Sprite(tex);
    s.anchor.set(0, 0);
    s.scale.set(p.sx * k, p.sy * k);
    s.x = p.x; s.y = p.y;
    s.alpha = alpha;
    container.addChild(s);
  }
}
```

改為（純 Graphics L-bracket，從 mockup `CornerOrnament` SVG 翻譯）：

```ts
import { Container, Graphics } from 'pixi.js';
import * as T from '@/config/DesignTokens';

/**
 * Place programmatic L-bracket corner ornaments at all 4 corners of a
 * rectangular region. Mirrored via negative scale for top-right /
 * bottom-left / bottom-right.
 *
 * Style: 2-stroke gold L-bracket (long horizontal + vertical lines),
 * inner short stroke for layered effect (mockup CornerOrnament 樣式).
 *
 * No asset dependency — all Pixi.Graphics.
 */
export function addCornerOrnaments(
  container: Container,
  regionW: number,
  regionH: number,
  size = 180,
  alpha = 0.45,
): void {
  // Each corner: 4 Graphics calls (outer L + inner short L) all in one Graphics
  const places: Array<{ sx: number; sy: number; x: number; y: number }> = [
    { sx:  1, sy:  1, x: 0,       y: 0       },   // top-left
    { sx: -1, sy:  1, x: regionW, y: 0       },   // top-right
    { sx:  1, sy: -1, x: 0,       y: regionH },   // bottom-left
    { sx: -1, sy: -1, x: regionW, y: regionH },   // bottom-right
  ];
  for (const p of places) {
    const corner = new Graphics();

    // Mockup CornerOrnament path (relative scale 0-40, scale up to size)
    // SVG: M2 2 L20 2 M2 2 L2 20 M2 2 L12 12
    // Translated to Graphics with size-scaled coords:
    const s = size / 40;          // base scale factor

    // Outer L bracket (long edges + diagonal accent)
    corner.moveTo(2 * s, 2 * s).lineTo(20 * s, 2 * s);   // horizontal
    corner.moveTo(2 * s, 2 * s).lineTo(2 * s, 20 * s);   // vertical
    corner.moveTo(2 * s, 2 * s).lineTo(12 * s, 12 * s);  // diagonal accent
    corner.stroke({ width: 1.5, color: T.GOLD.base, alpha: 0.9 });

    // Inner short L (highlight)
    const inner = new Graphics();
    inner.moveTo(6 * s, 6 * s).lineTo(14 * s, 6 * s);
    inner.moveTo(6 * s, 6 * s).lineTo(6 * s, 14 * s);
    inner.stroke({ width: 1, color: T.GOLD.glow, alpha: 0.6 });
    corner.addChild(inner);

    // Corner dot at origin
    const dot = new Graphics()
      .circle(2 * s, 2 * s, 1.5 * s)
      .fill({ color: T.GOLD.base });
    corner.addChild(dot);

    // Mirror via negative scale (mockup pattern)
    corner.scale.set(p.sx, p.sy);
    corner.x = p.x;
    corner.y = p.y;
    corner.alpha = alpha;
    container.addChild(corner);
  }
}
```

**Verify**：preview 4 corners 顯示金色 L-bracket，與既有 webp 視覺類似但純 Graphics（無 asset 依賴）。

**Commit 2**: `feat(s12-ui-01b): corner ornament programmatic L-bracket replaces webp`

### 3c. Commit 3 — Dragon-corner force fallback path

`src/screens/SlotReel.ts` 既有 `buildFrame()` (line ~107)：

```ts
const cornerTex = Assets.get<Texture>('dragon-corner');
if (cornerTex) {
  // ... Sprite path ...
} else {
  // p10-bug-01: programmatic L-bracket fallback
  // ...
}
```

**Force fallback** — 移除 Sprite path，永遠走 Graphics fallback：

```ts
// p10-bug-01 + s12-ui-01: programmatic L-bracket (no asset dependency)
const positions: Array<[number, number, number, number]> = [
  [-8,          -8,          1,  1],
  [REEL_W + 8,  -8,         -1,  1],
  [-8,          REEL_H + 8,  1, -1],
  [REEL_W + 8,  REEL_H + 8, -1, -1],
];
for (const [x, y, sx, sy] of positions) {
  const bracket = new Graphics()
    .moveTo(0, 24).lineTo(0, 0).lineTo(24, 0)
    .stroke({ width: 3, color: T.GOLD.shadow, alpha: 0.7 });
  bracket.x = x;
  bracket.y = y;
  bracket.scale.set(sx, sy);
  this.addChild(bracket);
}
```

刪 dragon-corner.webp 檔案 + 從 UI_ASSET_KEYS 移除：

```bash
rm public/assets/ui/dragon-corner.webp
rm public/assets/ui/corner-ornament.webp
```

UI_ASSET_KEYS 再 -2:

```ts
export const UI_ASSET_KEYS = [
  'slot-frame',
  'btn-normal',
  'btn-ornate',
  'portrait-ring',
  // 'corner-ornament' 移除
  // 'dragon-corner' 移除
  'win-burst',
  'divider',
  'logo-mark',
] as const;
```

**Verify**：preview reel 4 角顯示 L-bracket，視覺與既有 dragon-corner 相似（但純 Graphics）。

**Commit 3**: `chore(s12-ui-01c): remove dragon-corner + corner-ornament webp (force programmatic)`

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/components/Decorations.ts`（rewrite addCornerOrnaments）
- `src/screens/SlotReel.ts`（remove cornerTex Sprite path）
- `src/config/UiAssets.ts`（remove 6 keys: 4 orphan + corner-ornament + dragon-corner）

**刪除（檔案）**：
- `public/assets/ui/vs-badge.webp`
- `public/assets/ui/jp-marquee.webp`
- `public/assets/ui/hp-frame.webp`
- `public/assets/ui/draft-tile-frame.webp`
- `public/assets/ui/corner-ornament.webp`
- `public/assets/ui/dragon-corner.webp`

**禁止**：
- 改其他 UI components（UiButton / SpiritPortrait — s12-ui-03/04 工作）
- 改 LoadingScreen logo / divider 路徑（s12-ui-02 工作）
- 改 SlotReel slot-frame（s12-ui-05 工作）
- 改 win-burst（s12-ui-05 工作）
- 改機制（SymbolsConfig / SlotEngine / etc）
- 加新 asset
- DesignTokens
- scripts/sim-rtp.mjs
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**（per `incremental-implementation`）
3. push + PR URL
4. **Preview 驗證**：
   - LoadingScreen 跑完進 Draft / Battle，無 console 報「missing asset 'corner-ornament'」 等 warning
   - DraftScreen 4 corner ornament 仍可見（programmatic L-bracket）
   - BattleScreen 4 corner ornament 仍可見
   - SlotReel 4 dragon-corner 仍可見（programmatic L-bracket from #142 fallback）
   - 視覺與 Sprint 11 後**幾乎一樣**（只是純 Graphics 不再走 webp）
5. 截圖 1 張（含 corner ornament 跟 reel corner）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 6 個 webp 檔案是否確實刪除（`ls public/assets/ui/` 列出剩餘 = 7 個 webp + 2 png）
- UI_ASSET_KEYS 最終 length（預期 7）
- LoadingScreen preload 是否仍正常（preload UI 7 個 + 8 spirit + gem 5 + 3 SOS2 webp）
- 任何 corner ornament 視覺差異（與 webp 版本對比）
- Spec deviations：預期 0
