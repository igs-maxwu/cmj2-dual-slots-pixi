# Sprint 12 · s12-ui-02 — LoadingScreen logo-mark + divider 全 programmatic

## 1. Context

PR: **`logo-mark.webp` 跟 `divider.webp` 兩個 Gemini UI asset 替換成純 Pixi.Graphics + Text。LoadingScreen 已經有 fallback 路徑（goldText title），只需 force-permanent。BattleScreen 也用 divider — 也順手清。**

Why: Sprint 12 第二步。LoadingScreen 跟 BattleScreen 是還在 import `logo-mark` 跟 `divider` 的兩處，每個都有 simple Graphics 替代。

Mockup reference 不直接適用（mockup 是 BattleScreen 視覺，LoadingScreen 沒 mockup）— 用 既有 LoadingScreen titleText fallback 樣式即可。BattleScreen 的 divider 已被 v-01 的「戰」字 separator 取代主要 separator 角色，logPanel 內的 divider 是次要 — 改成簡單 Graphics 線即可。

---

## Skills suggested for this PR

- **`code-simplification`** — Both replacements simply collapse `if (asset) { Sprite path } else { fallback }` → just keep fallback path always. **Pure simplification**, no new logic.
- **`incremental-implementation`** — 2 atomic commits: (1) LoadingScreen logo-mark + divider，(2) BattleScreen divider in drawLog。每個都 build pass + visual verify。
- **`source-driven-development`** — Pixi 8 chained Graphics line drawing pattern (already used multiple times)。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 12 LoadingScreen logo-mark divider programmatic webp"`
2. 確認 LoadingScreen line 118 `Assets.get<Texture>('logo-mark')`
3. 確認 LoadingScreen line 133 `Assets.get<Texture>('divider')`
4. 確認 BattleScreen line 1115 `Assets.get<Texture>('divider')`
5. 確認 既有 LoadingScreen `titleText` 是 fallback 路徑（line 58-69），可作為 logo 永久替代

## 3. Task

### 3a. Commit 1 — LoadingScreen logo-mark + divider 移除

`src/screens/LoadingScreen.ts` `upgradeToDecoratedLoadingScreen()` (line 112-142) — 整段 logo + divider Sprite 載入路徑**移除**。

既有 (line 116-141)：
```ts
// Logo mark — replace the plain title if texture is available
const logoTex = Assets.get<Texture>('logo-mark');
if (logoTex) {
  this.logo = new Sprite(logoTex);
  this.logo.anchor.set(0.5, 0.5);
  const maxW = 720;
  const scale = maxW / logoTex.width;
  this.logo.scale.set(scale);
  this.logo.x = CANVAS_WIDTH / 2;
  this.logo.y = CANVAS_HEIGHT / 2 - 90;
  this.container.addChild(this.logo);
  if (this.titleText) this.titleText.visible = false;
}

// Divider under subtitle
const divTex = Assets.get<Texture>('divider');
if (divTex) {
  const div = new Sprite(divTex);
  div.anchor.set(0.5, 0.5);
  const w = 560;
  div.scale.set(w / divTex.width);
  div.x = CANVAS_WIDTH / 2;
  div.y = CANVAS_HEIGHT / 2 + 30;
  div.alpha = 0.85;
  this.container.addChild(div);
}
```

替換為：

```ts
// s12-ui-02: replace logo-mark sprite with stylized programmatic title
// (titleText already drawn by drawTitle() — keep visible, just upgrade visual)
if (this.titleText) {
  // Enhance existing titleText with stronger glow + slightly larger scale
  this.titleText.style.dropShadow = {
    color: T.GOLD.glow,
    alpha: 0.8,
    blur: 12,
    distance: 0,
  };
  this.titleText.scale.set(1.2);
}

// s12-ui-02: programmatic divider line replaces divider.webp Sprite
const dividerY = CANVAS_HEIGHT / 2 + 30;
const dividerW = 560;
const dividerX = (CANVAS_WIDTH - dividerW) / 2;
const dividerLine = new Graphics()
  .moveTo(dividerX, dividerY).lineTo(dividerX + dividerW, dividerY)
  .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.85 });
this.container.addChild(dividerLine);

// Decorative dot in center of divider (visual interest)
const dividerDot = new Graphics()
  .circle(CANVAS_WIDTH / 2, dividerY, 3)
  .fill({ color: T.GOLD.base });
this.container.addChild(dividerDot);
```

**移除** `this.logo` field（不再需要）。

刪檔案：
```bash
rm public/assets/ui/logo-mark.webp
rm public/assets/ui/divider.webp
```

`UI_ASSET_KEYS` 再 -2:
```ts
export const UI_ASSET_KEYS = [
  'slot-frame',
  'btn-normal',
  'btn-ornate',
  'portrait-ring',
  'win-burst',
  // 'divider' removed
  // 'logo-mark' removed
] as const;
```

**Commit 1**: `chore(s12-ui-02a): remove logo-mark + divider webp; LoadingScreen pure programmatic`

### 3b. Commit 2 — BattleScreen drawLog divider 移除

`src/screens/BattleScreen.ts` line 1114-1125 `drawLog()` 內 divider Sprite block：

```ts
// Decorative divider sprite (optional — if asset loaded)
const divTex = Assets.get<Texture>('divider');
if (divTex) {
  const div = new Sprite(divTex);
  // ...
}
```

替換為：

```ts
// s12-ui-02: programmatic hairline replaces divider.webp Sprite
const dividerW = (CANVAS_WIDTH - LOG_PAD_X * 2 - 24) * 0.9;
const dividerX = (CANVAS_WIDTH - dividerW) / 2;
const dividerY = LOG_Y + 24;
const logDivider = new Graphics()
  .moveTo(dividerX, dividerY).lineTo(dividerX + dividerW, dividerY)
  .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.5 });
this.container.addChild(logDivider);
```

**Commit 2**: `chore(s12-ui-02b): BattleScreen drawLog divider sprite → Graphics line`

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/LoadingScreen.ts`
- `src/screens/BattleScreen.ts` (drawLog method only)
- `src/config/UiAssets.ts` (-2 keys)

**刪除**：
- `public/assets/ui/logo-mark.webp`
- `public/assets/ui/divider.webp`

**禁止**：
- 改其他 UI components / screens 不在 scope（s12-ui-03/04/05/06 工作）
- 改 LoadingScreen 其他結構（preloadUi / preloadGems / preloadSpirits / preloadFx 全保留）
- 改 BattleScreen 其他 method
- DesignTokens
- 加新 asset
- scripts/sim-rtp.mjs
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證**：
   - LoadingScreen 跑：「雀靈戰記」title 用既有 goldText 路徑顯示（with enhanced glow），下方有 divider 線 + 中央金點
   - 進 Battle，點 SPIN 後 battle log panel 內的 hairline divider 仍可見（pure Graphics）
   - 無 Asset.get 'logo-mark' / 'divider' warning
5. 截圖 1 張（LoadingScreen 在跑 + BattleScreen log panel）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- LoadingScreen titleText scale 1.2× + glow 視覺感（替代 logo Sprite OK 嗎）
- UI_ASSET_KEYS 最終 length（預期 5）
- public/assets/ui/ 剩餘 webp count（預期 5：slot-frame / btn-normal / btn-ornate / portrait-ring / win-burst + 2 PWA icon = 5 webp + 2 png）
- Spec deviations：預期 0
