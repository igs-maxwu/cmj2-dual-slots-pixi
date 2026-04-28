# Sprint 12 · s12-ui-05 — SlotReel slot-frame + BattleScreen win-burst → Pixi.Graphics

## 1. Context

PR: **最後 2 個還在用 webp 的元素：(1) `SlotReel.buildFrame()` 既有 slot-frame.webp Sprite 路徑（已有 Graphics fallback 在 line 98-103，promote 為 primary）+ (2) `BattleScreen.spawnWinBurst()` win-burst.webp Sprite → Graphics radial burst 程式化。**

Why: Sprint 12 第五步。完成這 2 個後 `UI_ASSET_KEYS` 只剩 0 entries，s12-ui-06 final cleanup 把整個 UI preload 拿掉。

兩元素分析：

### slot-frame
- 既有 fallback (line 98-103) 是「純 1-line 金邊 roundRect」— 簡陋
- 升級成更接近 mockup 風格：金色 ornate frame with **inner glow + corner accent**（補回 sprite 視覺豐富感）

### win-burst
- 既有 line 2099-2120 用 single Sprite 旋轉 + scale + alpha
- 改成 Pixi.Graphics 純程式化 radial burst：
  - Multiple concentric circles（gold tint，alpha 隨距離遞減）
  - 12 條放射狀光線（gold stroke）
  - 同樣 700ms tween 動畫，scale + rotation + alpha 全保留

---

## Skills suggested for this PR

- **`code-simplification`** — 兩處都廢 if-asset/else-fallback 結構 → 直接 programmatic primary path。
- **`incremental-implementation`** — 2 atomic commits: (1) slot-frame programmatic + 升級視覺，(2) win-burst Sprite → Graphics radial burst。
- **`source-driven-development`** — Pixi 8 Graphics radial pattern + multi-circle concentric stack（既有 v-03 vignette pattern 可 reuse）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 12 SlotReel slot-frame win-burst programmatic"`
2. 確認 `SlotReel.buildFrame()` line 86-104 既有 Sprite + fallback structure
3. 確認 `BattleScreen.spawnWinBurst()` line 2099-2121
4. 確認 `T.GOLD.base / glow / shadow / deep` 存在
5. 確認 既有 win-burst 是 fxLayer.addChild（非 container）+ blendMode 'add' — 本 PR 維持

## 3. Task

### 3a. Commit 1 — SlotReel slot-frame programmatic

`src/screens/SlotReel.ts` `buildFrame()` (line 85-104) 改寫：

**移除** Sprite path + 簡陋 fallback：

既有：
```ts
const frameTex = Assets.get<Texture>('slot-frame');
if (frameTex) {
  // ... Sprite path ...
} else {
  const border = new Graphics()
    .roundRect(0, 0, REEL_W, REEL_H, T.RADIUS.md)
    .stroke({ width: 2, color: T.GOLD.deep, alpha: 0.85 });
  this.addChild(border);
}
```

**改成** mockup-aligned ornate Graphics frame：

```ts
// s12-ui-05: programmatic ornate gold frame replaces slot-frame.webp
// 4-layer stack: outer gold border + inner gold border + corner accent emboss
const outerBorder = new Graphics()
  .roundRect(0, 0, REEL_W, REEL_H, T.RADIUS.md)
  .stroke({ width: 3, color: T.GOLD.shadow, alpha: 0.95 });
this.addChild(outerBorder);

const midBorder = new Graphics()
  .roundRect(2, 2, REEL_W - 4, REEL_H - 4, T.RADIUS.md - 1)
  .stroke({ width: 2, color: T.GOLD.base, alpha: 1.0 });
this.addChild(midBorder);

const innerBorder = new Graphics()
  .roundRect(5, 5, REEL_W - 10, REEL_H - 10, T.RADIUS.md - 2)
  .stroke({ width: 1, color: T.GOLD.glow, alpha: 0.7 });
this.addChild(innerBorder);

// Corner accent emboss (small gold dots at 4 corners)
const cornerDots = [
  [4, 4], [REEL_W - 4, 4], [4, REEL_H - 4], [REEL_W - 4, REEL_H - 4],
];
const corners = new Graphics();
for (const [x, y] of cornerDots) {
  corners.circle(x, y, 2).fill({ color: T.GOLD.glow, alpha: 0.9 });
}
this.addChild(corners);
```

**Commit 1**: `feat(s12-ui-05a): SlotReel slot-frame programmatic ornate (3-stroke + corner dots)`

### 3b. Commit 2 — BattleScreen win-burst Graphics radial burst

`BattleScreen.spawnWinBurst()` (line 2099-2121) 改寫：

既有：
```ts
private async spawnWinBurst(): Promise<void> {
  const tex = Assets.get<Texture>('win-burst');
  if (!tex) return;
  const burst = new Sprite(tex);
  // ... Sprite scale + rotate + alpha tween ...
}
```

**改成** Graphics radial burst：

```ts
private async spawnWinBurst(): Promise<void> {
  // s12-ui-05: programmatic radial burst replaces win-burst.webp Sprite
  const burst = new Container();
  const cx = SLOT_X + REEL_W / 2;
  const cy = REEL_ZONE_Y + REEL_H / 2;
  burst.x = cx;
  burst.y = cy;
  burst.alpha = 0;
  burst.blendMode = 'add';
  this.fxLayer.addChild(burst);

  // Layer 1: Concentric circles (3 rings, alpha decreasing outward)
  const baseR = Math.max(REEL_W, REEL_H) * 0.6;
  const ring1 = new Graphics()
    .circle(0, 0, baseR * 0.4)
    .fill({ color: T.GOLD.glow, alpha: 0.5 });
  const ring2 = new Graphics()
    .circle(0, 0, baseR * 0.7)
    .fill({ color: T.GOLD.base, alpha: 0.30 });
  const ring3 = new Graphics()
    .circle(0, 0, baseR)
    .fill({ color: T.GOLD.shadow, alpha: 0.15 });
  burst.addChild(ring3);
  burst.addChild(ring2);
  burst.addChild(ring1);

  // Layer 2: 12 radial rays
  const rays = new Graphics();
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const inner = baseR * 0.3;
    const outer = baseR * 1.1;
    rays.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    rays.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
  }
  rays.stroke({ width: 3, color: T.GOLD.glow, alpha: 0.8 });
  burst.addChild(rays);

  // Tween: 700ms — flash up + fade + expand + slight rotation
  await tween(700, p => {
    // Alpha envelope: rapid in (0-20%), slow out (20-100%)
    if (p < 0.2) burst.alpha = p / 0.2 * 0.85;
    else          burst.alpha = 0.85 * (1 - (p - 0.2) / 0.8);
    // Scale expand 1.0 → 1.3
    burst.scale.set(1 + p * 0.3);
    // Slight rotation
    burst.rotation = p * 0.35;
  });
  burst.destroy({ children: true });
}
```

**注意**：
- 從 `Sprite + tex.width 算 scale` 改成 `Container + 直接 scale.set` — 邏輯更直接
- `blendMode = 'add'` 設在 Container 而非 children — Pixi 8 應 propagate
- `destroy({ children: true })` 清掉所有 layered Graphics

**Commit 2**: `feat(s12-ui-05b): win-burst Sprite → Graphics radial burst (concentric + 12 rays)`

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts` (`buildFrame` 內 slot-frame block)
- `src/screens/BattleScreen.ts` (`spawnWinBurst` 整 method)

**禁止**：
- 改其他 components / screens
- 加新 asset
- 改 Audio / FX 系統
- 改 cell logic / formation logic
- 改 既有 fxLayer / SLOT_X / REEL_ZONE_Y 等 const
- DesignTokens
- scripts/sim-rtp.mjs
- SPEC.md
- **本 PR 不刪 webp**（slot-frame.webp + win-burst.webp 留 s12-ui-06 一併 cleanup）

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證**：
   - SlotReel 4 邊有 3-stroke 金色 frame + 4 corner gold dot accent（比之前簡陋的 1-stroke 視覺豐富）
   - 點 SPIN 觸發 win-burst — 看到 concentric 金色 ring + 12 條 radial ray 從 reel 中央散出 + 旋轉 + 淡出（700ms）
   - 無 console warning
5. 截圖 1-2 張：
   - 1 張 reel frame 對比
   - 1 張 win-burst peak（alpha 0.85 中段）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- slot-frame programmatic 視覺感（vs 既有 Sprite ornate）
- win-burst 12 ray 視覺感（vs 既有 PNG burst 是否相當華麗）
- 既有 fxLayer + blendMode 'add' 配合是否正常（Container blendMode propagation）
- **不刪 webp**（留 s12-ui-06）— UI_ASSET_KEYS 仍 length 2
- Spec deviations：預期 0
