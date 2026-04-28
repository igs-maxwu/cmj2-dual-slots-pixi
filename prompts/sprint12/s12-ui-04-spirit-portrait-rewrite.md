# Sprint 12 · s12-ui-04 — SpiritPortrait component rewrite（portrait-ring webp → Pixi.Graphics clan ring）

## 1. Context

PR: **`SpiritPortrait` component (`src/components/SpiritPortrait.ts`) 從 `Sprite + Assets.get<Texture>('portrait-ring')` 改成純 Pixi.Graphics clan-color ring（mockup `SpiritToken` 風格）。既有 fallback path 已存在（programmatic triple ring），本 PR 永久化並廢 webp 路徑。**

Why: Sprint 12 UI Asset Decommission 第四步。SpiritPortrait 既有 fallback 已是 programmatic（line 50-58），但**配色用通用 gold**沒考慮 clan。新版改用 mockup `SpiritToken` 風格 — 各 spirit 對應 clan-color ring：

| Symbol clan | Ring color |
|---|---|
| azure 青龍 | `T.CLAN.azureGlow` |
| white 白虎 | `T.CLAN.whiteGlow` |
| vermilion 朱雀 | `T.CLAN.vermilionGlow` |
| black 玄武 | `T.CLAN.blackGlow` |
| Special (Wild/Curse/Scatter/Jackpot) | `T.GOLD.glow` |

Mockup reference: `download_picture/Dual Slot Pixi/battle-shared.jsx` line 87-159 (`SpiritToken` component) — clan ring 樣式：
- Outer circular base disc with clan-color radial gradient (atmosphere)
- Inner clan-color stroke ring (1.5px thickness with box-shadow glow)
- Sprite layered above

---

## Skills suggested for this PR

- **`code-simplification`** — 既有 fallback path 已 programmatic，本 PR 把 webp 路徑刪除 + ring 配色升級成 clan-color。**禁止重寫整個 SpiritPortrait** — 只動 ring 部分跟廢 fallback if-else。
- **`incremental-implementation`** — 2 atomic commits: (1) ring 改 clan-color programmatic，(2) 刪 portrait-ring.webp + UI_ASSET_KEYS clean。
- **`source-driven-development`** — Pixi 8 GlowFilter clan-color ring + chained Graphics circle stroke + Symbol clan field lookup pattern。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 12 SpiritPortrait portrait-ring clan ring rewrite"`
2. 確認 `src/components/SpiritPortrait.ts` 既有結構（Sprite ring path + Graphics fallback path）
3. 確認 `T.CLAN.azureGlow / whiteGlow / vermilionGlow / blackGlow` 存在（p11-vA-03 grep-confirmed）
4. 確認 `SYMBOLS[id].clan` field（既有，per Sprint 1-2 SymbolsConfig）
5. 確認 caller（搜 `new SpiritPortrait`）— DraftScreen + 可能 DamageDistributor 動畫 等

## 3. Task

### 3a. Commit 1 — Ring 改 clan-color programmatic

`src/components/SpiritPortrait.ts` 改寫 ring 創建邏輯（line 42-58）：

**移除** 既有 if-else（Sprite path + Graphics fallback）：
```ts
// 廢:
const ringTex = Assets.get<Texture>('portrait-ring');
if (ringTex) {
  this.ring = new Sprite(ringTex);
  // ...
} else {
  // Fallback: programmatic triple ring
  const outer = new Graphics().circle(0, 0, r).fill(T.GOLD.shadow);
  const mid   = new Graphics().circle(0, 0, r - 2).fill(T.GOLD.light);
  const inner = new Graphics().circle(0, 0, r - 4).fill(T.GOLD.shadow);
  // ...
}
```

**改成** 純 Graphics clan-aware ring（mockup SpiritToken 風格）：

```ts
// s12-ui-04: programmatic clan-color ring (mockup SpiritToken style)
// Initial render with default — setSymbol() will call updateRing() with clan color
this.ringContainer = new Container();
this.addChildAt(this.ringContainer, 0);   // ringContainer at z=0 (behind sprite)
```

加 class field：
```ts
private ringContainer: Container;
```

加 method `private updateRing(clanColor: number)` — 在 setSymbol() 內呼叫：

```ts
private updateRing(clanColor: number): void {
  this.ringContainer.removeChildren();
  const r = this.diameter / 2;

  // Outer dim atmosphere disc
  const outerAtm = new Graphics()
    .circle(0, 0, r + 2)
    .fill({ color: clanColor, alpha: 0.20 });
  this.ringContainer.addChild(outerAtm);

  // Outer ring band (gold shadow)
  const outerBand = new Graphics()
    .circle(0, 0, r)
    .stroke({ width: 3, color: T.GOLD.shadow, alpha: 0.95 });
  this.ringContainer.addChild(outerBand);

  // Mid clan-color ring (the brand identity)
  const midRing = new Graphics()
    .circle(0, 0, r - 2)
    .stroke({ width: 2, color: clanColor, alpha: 1.0 });
  // Inner glow on clan ring (subtle)
  midRing.filters = [new GlowFilter({
    color: clanColor, distance: 8, outerStrength: 1.2, innerStrength: 0.3,
  })];
  this.ringContainer.addChild(midRing);

  // Inner gold highlight (keeps gold-plate feel)
  const innerHi = new Graphics()
    .circle(0, 0, r - 5)
    .stroke({ width: 1, color: T.GOLD.light, alpha: 0.7 });
  this.ringContainer.addChild(innerHi);
}
```

`setSymbol()` 內加：
```ts
setSymbol(symbolId: number): void {
  if (this.currentSymbol === symbolId) return;
  this.currentSymbol = symbolId;
  const sym = SYMBOLS[symbolId];

  // Update backdrop tint
  this.backdrop.clear()
    .circle(0, 0, this.innerR)
    .fill({ color: sym.color, alpha: 0.28 });

  // s12-ui-04: clan-aware ring color
  const clanColorMap: Record<string, number> = {
    azure:     T.CLAN.azureGlow,
    white:     T.CLAN.whiteGlow,
    vermilion: T.CLAN.vermilionGlow,
    black:     T.CLAN.blackGlow,
  };
  const ringColor = sym.isJackpot || sym.isWild
    ? T.GOLD.glow
    : sym.isCurse
      ? 0x8b3aaa
      : sym.isScatter
        ? 0xff3b6b
        : (clanColorMap[sym.clan as string] ?? T.GOLD.base);
  this.updateRing(ringColor);

  // ... existing texture swap ...
}
```

**注意 import update**：
```ts
import { Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
```

**廢 `private ring: Sprite | null` field**（不再用）。

### 3b. Commit 2 — Delete webp + UI_ASSET_KEYS clean

刪檔：
```bash
rm public/assets/ui/portrait-ring.webp
```

`src/config/UiAssets.ts`:
```ts
export const UI_ASSET_KEYS = [
  'slot-frame',
  // 'portrait-ring' removed
  'win-burst',
] as const;
```

從 3 → 2 entries。

**Commit 2**: `chore(s12-ui-04b): delete portrait-ring webp + UI_ASSET_KEYS -1`

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/components/SpiritPortrait.ts` (ring rewrite + ringContainer field + updateRing method)
- `src/config/UiAssets.ts` (-1 key)

**刪除**：
- `public/assets/ui/portrait-ring.webp`

**禁止**：
- 改 caller (DraftScreen / DamageDistributor / 任何 spirit 動畫) — API compat 保留
- 改 SpiritPortrait 其他結構（backdrop / clipMask / sprite / setAlive）
- 改 SymbolsConfig
- 改 DesignTokens
- 加新 asset
- 改其他 components（s12-ui-05 / 06 工作）
- scripts/sim-rtp.mjs
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證**：
   - DraftScreen 8 個 spirit tile 各自顯示 clan-color ring（青龍 azure / 白虎 white / 朱雀 vermilion / 玄武 black 各 2 個）
   - Ring 帶 clan-color GlowFilter 暈光感
   - 無 console warning「missing asset 'portrait-ring'」
   - Sprite 圖像 + clipMask 正常 render（spirit chibi 在 ring 內 clip 圓形）
   - 死亡 spirit alpha 0.22（既有 setAlive 邏輯保留）
5. 截圖 1 張（DraftScreen 含 4 種 clan ring 顏色）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 8 個 spirit clan ring 顏色是否清楚識別（每側 4 種 clan 各 2 個）
- GlowFilter 對 ring 視覺增益（vs 之前 portrait-ring webp 通用金）
- UI_ASSET_KEYS 最終 length（預期 2）
- public/assets/ui/ 剩餘 webp count（預期 2：slot-frame / win-burst + 2 PWA）
- Spec deviations：預期 0
