# Sprint 7 · d-04 — 4 男性靈簽名招式 FX 升級（加 SOS2 atlas + webp 視覺層，不動 timing/邏輯）

## 1. Context

PR: **`SpiritAttackChoreographer.ts` 內既有 4 個男性靈 signature 函式（`_sigDragonDualSlash` / `_sigTigerFistCombo` / `_sigTortoiseHammerSmash` / `_sigPhoenixFlameArrow`，line 452-820）各加一層 SOS2 atlas / webp FX，讓視覺從「Pixi Graphics 線條 + 簡單粒子」升級到「fire wave + 粒子 + 光暈疊加」效果。Timing / Phase / 傷害觸發完全不動，純加視覺層。**

Why: Sprint 6 已 ship 全部 SPEC §15 機制，Sprint 7 demo polish 為 IGS RD5 pitch 衝視覺品質。4 個男性靈是玩家直視最多的招式 — 視覺升級對 demo 截圖跟 60s hype video CP 值最高。

可用 SOS2 資源（皆已 preload 完畢）：

| Asset | 路徑 | 用途 |
|---|---|---|
| `sos2-fire-wave.webp` | single Sprite | 火焰扇 / 火浪（dragon、phoenix） |
| `sos2-particles.webp` | single Sprite（spritesheet 切片或單張） | 粒子 / 火星 / 沙塵 |
| `sos2-radial-lights.webp` | single Sprite | 放射狀光線（impact flash） |
| `sos2-bigwin atlas` | atlas（已 preload）— `FX/Shine_02`, `FX/LightBall_02` | shine / lightball |
| `sos2-coins.webp` | single Sprite | 不在本 PR 用 |

Source:
- SpiritAttackChoreographer.ts line 452 / 548 / 634 / 745 — 4 signature functions
- main.ts line 34-37 — sos2-bigwin atlas 已 preload
- LoadingScreen — sos2-fire-wave / sos2-particles / sos2-radial-lights webp 已 preload（**先確認**，若 Loading 沒 preload 需在 Loading 補一行）
- BLEND_MODES.ADD pattern 用於 fire / light 疊加 — 對照 Pixi 8 docs

Base: master HEAD（Sprint 6 closed via PR #130 2026-04-27）
Target: `feat/sprint7-d-04-signature-fx-upgrade`

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Container 階層、`BLEND_MODES.ADD` 加法混合用在 fire / light，cleanup 紀律（每個 sprite 在 phase fire 結束時 destroy，不殘留進 phase 5 return）。
- **`incremental-implementation`** — **4 個 commit 一張 PR**：(1) Dragon、(2) Tiger、(3) Tortoise、(4) Phoenix，**每個 commit 自包含 + build 過 + 視覺可單獨驗證**。任何一個 layer 視覺出錯，可單獨 revert 不影響其他 3 個。
- **`source-driven-development`** — Pixi 8 `BlendMode` API（v7 是 `BLEND_MODES.ADD`，v8 變 `'add'` 字串 enum）對照官方 docs；webp 載入用 `Assets.get<Texture>('asset-key')` pattern 對照既有 BattleScreen line 1155 `FXAtlas.sprite()` 用法（single webp 用 Assets.get，atlas 用 FXAtlas.sprite）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Signature FX upgrade SOS2 fire wave dragon phoenix tortoise tiger d-04"`
2. 確認 `SpiritAttackChoreographer.ts` 4 個 signature 函式在 line 452-820 區段 + line 170-173 case dispatcher
3. 確認 `LoadingScreen.ts` 有 preload 下列 webp（若沒有，本 PR §3a 加 preload）：
   - `assets/fx/sos2-fire-wave.webp`
   - `assets/fx/sos2-particles.webp`
   - `assets/fx/sos2-radial-lights.webp`
4. 確認 main.ts line 34-37 sos2-bigwin atlas 已 preload — 提供 `FX/Shine_02` / `FX/LightBall_02` region

## 3. Task

### 3a. Preflight — 確保 webp 已 preload（若需）

`LoadingScreen.ts` 既有 webp preload list（搜尋 `sos2-` 或 `Assets.add`）。若上述 3 個 webp 已在 list，跳過此步。**若沒有**，加進 preload，否則 `Assets.get` 會回 undefined。

### 3b. Helper — 通用 fire-wave sprite 工廠

在 `SpiritAttackChoreographer.ts` 檔案上方（imports 之後、PERSONALITIES 之前）加：

```ts
import { Assets, Texture, Sprite, BLEND_MODES } from 'pixi.js';

/**
 * d-04 helper: build a SOS2 fire-wave sprite, additive-blended, anchor centered.
 * Returns null if asset not loaded (caller should null-check + skip layer).
 */
function _makeFxSprite(assetKey: string, tint: number = 0xffffff): Sprite | null {
  const tex = Assets.get<Texture>(assetKey);
  if (!tex || tex === Texture.EMPTY) return null;
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.tint = tint;
  s.blendMode = 'add';   // Pixi 8 string enum (v7 was BLEND_MODES.ADD)
  return s;
}
```

**注意**：Pixi 8 `blendMode = 'add'` 是 v8 syntax。若 build 報錯 type 不接受 string，fallback 到 `BLEND_MODES.ADD`。**source-driven-development skill：先查 Pixi 8 docs 再寫**。

### 3c. Dragon (`_sigDragonDualSlash`) — 加 fire-wave + 雙刃殘影 layer

line 452 起既有函式。Phase 4 fire 開始時加：

```ts
// d-04: add SOS2 fire-wave layer (azure-tinted, additive)
const fireA = _makeFxSprite('sos2-fire-wave', 0x6ad8ff);   // azure cyan
const fireB = _makeFxSprite('sos2-fire-wave', 0x6ad8ff);
if (fireA && fireB) {
  fireA.x = ctx.centerX - 60;  fireA.y = ctx.centerY;
  fireB.x = ctx.centerX + 60;  fireB.y = ctx.centerY;
  fireA.scale.set(0.5);
  fireB.scale.set(0.5);
  fireA.alpha = 0;
  fireB.alpha = 0;
  ctx.stage.addChild(fireA);
  ctx.stage.addChild(fireB);

  // Fade in + scale up over slash duration
  void tween(ctx.duration, t => {
    const a = Easings.easeOut(t);
    fireA.alpha = (1 - t) * 0.9;   // burst then fade
    fireB.alpha = (1 - t) * 0.9;
    fireA.scale.set(0.5 + a * 1.3);
    fireB.scale.set(0.5 + a * 1.3);
    fireA.rotation = -t * 0.4;     // slight CCW rotation
    fireB.rotation = +t * 0.4;     // slight CW rotation
  });

  // Cleanup at function end
  setTimeout(() => { fireA.destroy(); fireB.destroy(); }, ctx.duration + 50);
}
```

**Commit 1**: `feat(d-04a): Dragon signature — SOS2 fire-wave additive layer`

### 3d. Tiger (`_sigTigerFistCombo`) — 加 dust burst + radial flash

line 548 起既有函式。Phase 4 每次 punch impact 時（既有 3 連擊）加 radial-lights flash + dust particles：

```ts
// d-04: per-punch radial flash (3 hits)
for (let i = 0; i < 3; i++) {
  const punchT = i * (ctx.duration / 3);   // approx hit timing
  setTimeout(() => {
    const flash = _makeFxSprite('sos2-radial-lights', 0xffaa44);   // orange-tiger
    if (!flash) return;
    flash.x = ctx.centerX + (Math.random() - 0.5) * 80;
    flash.y = ctx.centerY + (Math.random() - 0.5) * 60;
    flash.scale.set(0.3);
    flash.alpha = 0.95;
    ctx.stage.addChild(flash);

    void tween(180, t => {
      flash.alpha = 0.95 * (1 - t);
      flash.scale.set(0.3 + t * 0.8);
      flash.rotation = t * 0.5;
    }, Easings.easeOut).then(() => flash.destroy());
  }, punchT);
}
```

**Commit 2**: `feat(d-04b): Tiger signature — SOS2 radial-lights per-punch flash`

### 3e. Tortoise (`_sigTortoiseHammerSmash`) — 加 smoke plume + ground crack glow

line 634 起既有函式。Phase 4 hammer-down 衝擊瞬間：

```ts
// d-04: ground impact — smoke plume (grey particles) + radial glow
const smoke = _makeFxSprite('sos2-particles', 0xc0c0d0);   // grey
const glow  = _makeFxSprite('sos2-radial-lights', 0xffaa44);
if (smoke) {
  smoke.x = ctx.centerX;
  smoke.y = ctx.centerY + 40;
  smoke.scale.set(0.4);
  smoke.alpha = 0.85;
  ctx.stage.addChild(smoke);
  void tween(700, t => {
    smoke.alpha = 0.85 * (1 - t);
    smoke.scale.set(0.4 + t * 1.4);
    smoke.y = ctx.centerY + 40 - t * 60;   // rise upward
  }, Easings.easeOut).then(() => smoke.destroy());
}
if (glow) {
  glow.x = ctx.centerX;
  glow.y = ctx.centerY + 60;
  glow.scale.set(0.2);
  glow.alpha = 1;
  ctx.stage.addChild(glow);
  void tween(450, t => {
    glow.alpha = 1 - t;
    glow.scale.set(0.2 + t * 1.6);
  }, Easings.easeOut).then(() => glow.destroy());
}
```

**Commit 3**: `feat(d-04c): Tortoise signature — SOS2 smoke plume + ground glow`

### 3f. Phoenix (`_sigPhoenixFlameArrow`) — 加 fire trail + ember scatter

line 745 起既有函式。Phase 4 arrow 飛行 + 命中：

```ts
// d-04: arrow flame trail (single fire-wave following arrow path) + ember burst on impact
const trail = _makeFxSprite('sos2-fire-wave', 0xff5722);   // red-phoenix
if (trail) {
  trail.scale.set(0.35);
  trail.alpha = 0;
  ctx.stage.addChild(trail);
  // Trail follows arrow's x interp from origin to center
  void tween(ctx.duration * 0.7, t => {
    trail.x = ctx.centerX + (-60 + t * 120);
    trail.y = ctx.centerY - 20 + Math.sin(t * Math.PI) * 10;
    trail.alpha = Math.min(1, t * 3) * (1 - Math.max(0, t - 0.7) * 3);   // fade in fast, fade out near end
    trail.rotation = t * 0.3;
  });
  setTimeout(() => trail.destroy(), ctx.duration);
}

// Ember burst on impact (~70% through fire phase)
setTimeout(() => {
  const ember = _makeFxSprite('sos2-particles', 0xffaa00);
  if (!ember) return;
  ember.x = ctx.centerX + 60;
  ember.y = ctx.centerY - 20;
  ember.scale.set(0.3);
  ember.alpha = 1;
  ctx.stage.addChild(ember);
  void tween(380, t => {
    ember.alpha = 1 - t;
    ember.scale.set(0.3 + t * 1.0);
  }, Easings.easeOut).then(() => ember.destroy());
}, ctx.duration * 0.7);
```

**Commit 4**: `feat(d-04d): Phoenix signature — SOS2 fire trail + ember impact`

### 3g. 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` 唯一檔（4 signature 函式 + 1 helper + imports）
- `src/screens/LoadingScreen.ts`（**僅當** 3 個 webp 還沒 preload，加 preload list 1-3 行）

**禁止**：
- 改 personality 的 timing / arcHeight / shakeIntensity（純 Phase 4 視覺加層，不動 timing）
- BattleScreen.ts / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- main.ts atlas preload（已 OK）
- DesignTokens（tint hex 直寫，本 PR scope 不開新 token）
- 加新 asset 檔（用 SOS2 既有素材）
- scripts/sim-rtp.mjs（純視覺）
- SPEC.md
- 改 4 個 female signatures（不在本 sprint scope）
- 改 generic _fireShot fallback（不在 scope）

## 4. DoD

1. `npm run build` 過
2. **4 個 commit**（per `incremental-implementation`，每 spirit 一個 commit）
3. push + PR URL
4. **Preview 驗證**：
   - 4 男性靈在隊伍中（手動湊 draft selection 包含 meng / yin / xuanmo / lingyu），各觸發 signature 一次
   - 截圖 4 張：每 spirit 在 phase 4 fire 中段 mid-FX 截圖
   - 觀察沒有 leak（5 spin 之後 stage 內 sprite count 應該 stable，可用 `console.log(this.container.children.length)` 在 BattleScreen.refresh DEV gate 看）
5. **效能**：FPS 全程 ≥ 50（DevTools Performance tab，特別 hammer-down 衝擊瞬間是壓力測試點）

## 5. Handoff

- PR URL
- 1 行摘要
- 4 張截圖（dragon / tiger / tortoise / phoenix 各一）
- 是否有 webp asset 沒 preload 需要補在 LoadingScreen
- Pixi 8 `blendMode = 'add'` syntax 是否就用了字串 enum 還是 fallback BLEND_MODES.ADD（source-driven-development skill 結果）
- 任何 sprite leak 觀察
- FPS 觀察（特別 d-04c tortoise hammer-down）
- Spec deviations：預期 0
