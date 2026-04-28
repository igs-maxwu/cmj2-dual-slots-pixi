# Sprint 12 · s12-ui-03 — UiButton component rewrite（Sprite + 2 webp → Pure Pixi.Graphics gradient + border）

## 1. Context

PR: **`UiButton` component (`src/components/UiButton.ts`) 從 `Sprite + Assets.get<Texture>('btn-normal' / 'btn-ornate')` 改成純 Pixi.Graphics gradient + border + Text。`variant: 'ornate'` 是 dead code path（無 caller 用），順手清掉。**

Why: Sprint 12 UI Asset Decommission Track 第三步。Audit 結果：
- 兩個 webp `btn-normal.webp` + `btn-ornate.webp` 都在用
- 但 `variant: 'ornate'` 從沒被任何 caller 設置（DraftScreen 兩處都用 default 'normal'）→ ornate code path 是 dead code

簡化策略：kill 'ornate' variant entirely → 單一 Graphics-based 按鈕風格。

Mockup reference: `download_picture/Dual Slot Pixi/battle-shared.jsx` line 573-625 (`PrimaryCTA` — 主按鈕風格 / `GhostBtn` — 次按鈕風格)。我們的 `UiButton` 只用 normal variant，採 PrimaryCTA-lite 風格（金色 gradient + border，不加 ornate glow）。

---

## Skills suggested for this PR

- **`code-simplification`** — 廢 dead code path（'ornate' variant + isOrnate field + glowFilter field + branching setState 邏輯）。簡化後 UiButton 變成 single-style component，邏輯更直接。
- **`incremental-implementation`** — **2 atomic commits**: (1) UiButton internal rewrite to Graphics，(2) delete webp + UI_ASSET_KEYS clean。
- **`source-driven-development`** — Pixi 8 chained Graphics + Pixi `eventMode='static'` + interaction state pattern (mockup `PrimaryCTA` line 573-602 reference)。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 12 UiButton rewrite Graphics btn-normal btn-ornate"`
2. 確認 `src/components/UiButton.ts` 既有結構（Sprite-based）
3. 確認 caller 只在 `DraftScreen.ts` line 496 + 504 — 兩處都 default 'normal'
4. 確認 `T.GOLD.base` / `T.GOLD.glow` / `T.GOLD.shadow` / `T.TINT.identity` / `T.TINT.pressed` 等 token 存在於 DesignTokens（grep 確認）

## 3. Task

### 3a. Commit 1 — UiButton internal rewrite

`src/components/UiButton.ts` 整檔重寫：

```ts
import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import * as T from '@/config/DesignTokens';
import { AudioManager } from '@/systems/AudioManager';

/**
 * Programmatic gold-plate button — pure Pixi.Graphics, no asset dependency.
 *
 * Three states via redrawing bg Graphics:
 *   normal   — gold gradient + border
 *   hover    — slightly brighter gold + scale 1.04
 *   pressed  — darker tint + scale 0.97
 *
 * Sound: ui-click on tap, ui-hover on pointerover.
 */
export interface UiButtonOpts {
  fontSize?: number;
  color?: number;
  stroke?: number;
}

export class UiButton extends Container {
  private bg: Graphics;
  private lbl: Text;
  private enabled = true;
  private readonly w: number;
  private readonly h: number;

  constructor(
    text: string,
    width: number,
    height: number,
    private onTap: () => void,
    opts: UiButtonOpts = {},
  ) {
    super();
    this.w = width;
    this.h = height;

    // Background — programmatic gradient + border
    this.bg = new Graphics();
    this.addChild(this.bg);
    this.drawBg('normal');

    // Label
    this.lbl = new Text({
      text,
      style: {
        fontFamily: T.FONT.title,
        fontWeight: '700',
        fontSize: opts.fontSize ?? Math.round(height * 0.42),
        fill: opts.color ?? T.FG.white,
        letterSpacing: 2,
        stroke: { color: 0x000, width: opts.stroke ?? 2 },
      },
    });
    this.lbl.anchor.set(0.5, 0.5);
    this.addChild(this.lbl);

    // Hit area for click events (Pixi 8 Container needs explicit hitArea)
    this.hitArea = new Rectangle(-width / 2, -height / 2, width, height);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap',  () => { if (this.enabled) { AudioManager.playSfx('ui-click', 0.7); this.onTap(); } });
    this.on('pointerover', () => { if (this.enabled) { AudioManager.playSfx('ui-hover', 0.5); this.setState('hover'); } });
    this.on('pointerout',  () => this.setState('normal'));
    this.on('pointerdown', () => this.setState('pressed'));
    this.on('pointerup',   () => this.setState('hover'));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.eventMode = enabled ? 'static' : 'none';
    this.cursor    = enabled ? 'pointer' : 'default';
    this.lbl.alpha = enabled ? 1 : 0.4;
    this.drawBg(enabled ? 'normal' : 'disabled');
  }

  setText(text: string): void { this.lbl.text = text; }

  private setState(state: 'normal' | 'hover' | 'pressed'): void {
    if (!this.enabled) return;
    this.drawBg(state);
    switch (state) {
      case 'normal':  this.scale.set(1);     break;
      case 'hover':   this.scale.set(1.04);  break;
      case 'pressed': this.scale.set(0.97);  break;
    }
  }

  /** Redraws background per state — gold gradient simulation + border. */
  private drawBg(state: 'normal' | 'hover' | 'pressed' | 'disabled'): void {
    this.bg.clear();
    const radius = 8;
    const halfW = this.w / 2;
    const halfH = this.h / 2;

    // Color per state
    let topColor: number, bottomColor: number, borderColor: number;
    switch (state) {
      case 'hover':
        topColor    = T.GOLD.glow;       // brighter top
        bottomColor = T.GOLD.base;
        borderColor = T.GOLD.glow;
        break;
      case 'pressed':
        topColor    = T.GOLD.shadow;     // darker (pressed)
        bottomColor = T.GOLD.shadow;
        borderColor = T.GOLD.base;
        break;
      case 'disabled':
        topColor    = 0x444444;
        bottomColor = 0x222222;
        borderColor = 0x666666;
        break;
      case 'normal':
      default:
        topColor    = T.GOLD.base;
        bottomColor = T.GOLD.shadow;
        borderColor = T.GOLD.base;
        break;
    }

    // 2-rect gradient simulation (Pixi 8 no native linear gradient)
    this.bg.roundRect(-halfW, -halfH, this.w, this.h * 0.5, radius)
      .fill({ color: topColor });
    this.bg.roundRect(-halfW, 0, this.w, this.h * 0.5, radius)
      .fill({ color: bottomColor });

    // Border
    this.bg.roundRect(-halfW, -halfH, this.w, this.h, radius)
      .stroke({ width: 2, color: borderColor, alpha: 0.9 });
  }
}
```

**注意**：
- 廢 `variant` / `isOrnate` / `glowFilter` 三個 field（dead code path）
- 加 `hitArea` per Pixi 8 Container click 要求（PR #151 + #152 已 establish）
- `bg` 從 `Sprite` 變 `Graphics`，state change 時 `clear()` + redraw
- API 對 caller 不變（constructor signature / setEnabled / setText 全保留）

### 3b. Commit 2 — Delete webp + UI_ASSET_KEYS clean

刪檔：
```bash
rm public/assets/ui/btn-normal.webp
rm public/assets/ui/btn-ornate.webp
```

`src/config/UiAssets.ts`:
```ts
export const UI_ASSET_KEYS = [
  'slot-frame',
  // 'btn-normal' removed
  // 'btn-ornate' removed
  'portrait-ring',
  'win-burst',
] as const;
```

從 5 → 3 entries。

**Commit 2**: `chore(s12-ui-03b): delete btn-normal + btn-ornate webp`

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/components/UiButton.ts`（整檔重寫）
- `src/config/UiAssets.ts` (-2 keys)

**刪除**：
- `public/assets/ui/btn-normal.webp`
- `public/assets/ui/btn-ornate.webp`

**禁止**：
- 改 caller (DraftScreen / 其他) — API compat 保留
- 改 SpiritPortrait / SlotReel / LoadingScreen / etc（其他 PR 工作）
- DesignTokens
- 加新 asset
- AudioManager 改動（既有 ui-click / ui-hover SFX 保留）
- scripts/sim-rtp.mjs
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證**：
   - DraftScreen 「SELECT 5 EACH」 button + 各 spirit tile 下方按鈕視覺正常
   - hover 時按鈕變亮（gold glow color）
   - pointerdown 時按鈕變暗 + 縮小（pressed state）
   - pointerout / pointerup 回 normal state
   - disabled 時按鈕灰 + label 變淡
   - 無 console warning 「missing asset 'btn-normal' / 'btn-ornate'」
   - 點擊聲 + hover 聲仍正常觸發
5. 截圖 1 張（含 normal / hover / pressed 一個 button 的狀態）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- DraftScreen 的兩個 UiButton 視覺差異感（dead variant 移除前後對比）
- UI_ASSET_KEYS 最終 length（預期 3）
- public/assets/ui/ 剩餘 webp count（預期 3：slot-frame / portrait-ring / win-burst + 2 PWA）
- Spec deviations：預期 0
