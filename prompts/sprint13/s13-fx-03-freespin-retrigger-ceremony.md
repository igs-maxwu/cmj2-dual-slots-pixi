# Sprint 13 / fx-03 — Free Spin retrigger 「MORE SPINS!」全螢幕 ceremony

## 1. Context

Sprint 13 末段（s13-fx-01 ✓ #159 + s13-fx-02 ✓ #164）。本 PR 升級 Free Spin retrigger 的視覺戲劇性：

### 既有狀態（chore #150 期延伸）
- **M10 Free Spin retrigger** — Free spin mode 中再次 trigger（`freeSpinsRemaining` 回升到 5）→ console log + banner 短 scale pulse `1.0 → 1.25 → 1.0`（line 1639-1644 in BattleScreen.ts）
- **無 dramatic moment** — 玩家錯過時容易完全沒感覺到 retrigger

### 升級目標（純視覺）
全螢幕 ceremony，1.5-1.8s：
- Stage 1: rainbow halo 從中心 expand
- Stage 2: 「MORE SPINS!」金字 + 「+5 ROUNDS」副字 pop-in
- Stage 3: LightBall 粒子發散（borrow sos2-bigwin atlas region）
- Stage 4: fade out + restore 回原 banner

### Inventory（已驗）
- `public/assets/fx/sos2-rainbow-halo.webp` ✓ — 彩虹光環主視覺
- `public/assets/fx/sos2-bigwin.atlas` + `.webp` ✓ — 已被 j-04 用來借 LightBall / Coin region
- 既有 j-04 / s13-fx-01 ceremony pattern 可直接 follow

機制零改動 — 只是把現有 retrigger pulse 替換成完整 ceremony。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（新模組 / wire-up）
- **`source-driven-development`** — 沿用 j-04 + s13-fx-01 既有 ceremony pattern（Promise<void> + ticker + destroy children）
- **`debugging-and-error-recovery`** — ticker leak / Container destroy 雙保險

---

## 2. Spec drift check (P6)

1. `mempalace_search "Free Spin retrigger ceremony rainbow halo BigWin atlas LightBall"`
2. `mempalace_search "BattleScreen prevFreeSpinsRemaining refreshFreeSpinOverlay"`
3. 確認 既有 `refreshFreeSpinOverlay` line 1603-1649 結構（既有 enter / exit / retrigger pulse）
4. 確認 既有 j-04 `JackpotCeremony.ts` pattern + s13-fx-01 `FreeSpinEntryCeremony.ts` 結構作為參考（`playXxxCeremony(parent, ...args): Promise<void>`）
5. 確認 既有 chore #162 AUTO + s13-fx-02 stop conditions（FreeSpin retrigger 應該觸發 stopAutoMode 嗎？— **不需要**：本來就 in-FreeSpin，AUTO 已停）

---

## 3. Task

### 3a. Commit 1 — 新模組 FreeSpinRetriggerCeremony.ts

**新檔案**：`src/fx/FreeSpinRetriggerCeremony.ts`

API：
```ts
export async function playFreeSpinRetriggerCeremony(
  parent: Container,
  newRoundsCount: number,        // 新增多少 rounds (e.g. 5)
): Promise<void>
```

#### Implementation 流程（總長 1.6s）

```ts
import { Assets, Container, Graphics, Sprite, Text, Texture, Rectangle } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import * as T from '@/config/DesignTokens';
import { goldText } from '@/components/GoldText';
import { tween, delay, Easings } from '@/systems/tween';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';

export async function playFreeSpinRetriggerCeremony(
  parent: Container,
  newRoundsCount: number = 5,
): Promise<void> {
  const root = new Container();
  root.zIndex = 2000;     // above HUD + popups, just below JP ceremony
  parent.addChild(root);

  // ── Stage 1 (0.0-0.4s): rainbow halo expand from centre ────────────────────
  const haloTex = Assets.get<Texture>('sos2-rainbow-halo')
               ?? Texture.from('/cmj2-dual-slots-pixi/assets/fx/sos2-rainbow-halo.webp');
  const halo = new Sprite(haloTex);
  halo.anchor.set(0.5);
  halo.x = CANVAS_WIDTH / 2;
  halo.y = CANVAS_HEIGHT / 2;
  halo.alpha = 0;
  halo.scale.set(0.3);
  halo.blendMode = 'add';
  root.addChild(halo);

  await tween(400, t => {
    halo.alpha = t * 0.85;
    halo.scale.set(0.3 + 1.0 * t);   // 0.3 → 1.3
  }, Easings.easeOut);

  // ── Stage 2 (0.4-0.8s): MORE SPINS! gold text pop-in ───────────────────────
  const titleText = goldText('MORE SPINS!', { fontSize: 72, withShadow: true });
  titleText.anchor.set(0.5, 0.5);
  titleText.x = CANVAS_WIDTH / 2;
  titleText.y = CANVAS_HEIGHT / 2 - 30;
  titleText.alpha = 0;
  titleText.scale.set(0.5);
  titleText.filters = [new GlowFilter({
    color: T.GOLD.glow,
    distance: 22,
    outerStrength: 3.0,
    innerStrength: 0.6,
    quality: 0.5,
  })];
  root.addChild(titleText);

  const subText = new Text({
    text: `+${newRoundsCount} ROUNDS`,
    style: {
      fontFamily: T.FONT.body,
      fontWeight: '700',
      fontSize: 28,
      fill: T.GOLD.glow,
      letterSpacing: 6,
      stroke: { color: 0x000000, width: 3, alpha: 0.6 },
    },
  });
  subText.anchor.set(0.5, 0.5);
  subText.x = CANVAS_WIDTH / 2;
  subText.y = CANVAS_HEIGHT / 2 + 50;
  subText.alpha = 0;
  root.addChild(subText);

  await tween(400, t => {
    titleText.alpha = t;
    titleText.scale.set(0.5 + 0.7 * t);   // 0.5 → 1.2
    subText.alpha = t;
  }, Easings.easeOut);

  // ── Stage 3 (0.8-1.2s): LightBall particle burst (radial) ──────────────────
  const bigwinTex = Assets.get<Texture>('sos2-bigwin')
                 ?? Texture.from('/cmj2-dual-slots-pixi/assets/fx/sos2-bigwin.webp');
  // Borrow region from sos2-bigwin atlas — fallback: full sprite if atlas-region fail
  const PARTICLE_COUNT = 16;
  const particles: Sprite[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = new Sprite(bigwinTex);
    p.anchor.set(0.5);
    p.x = CANVAS_WIDTH / 2;
    p.y = CANVAS_HEIGHT / 2;
    p.scale.set(0.15);
    p.blendMode = 'add';
    p.alpha = 0;
    root.addChild(p);
    particles.push(p);
  }

  // Settle title text scale (1.2 → 1.0) + emit particles radially in parallel
  void tween(400, t => {
    titleText.scale.set(1.2 - 0.2 * t);
  }, Easings.easeOut);

  await Promise.all(particles.map((p, i) => {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    const dist = 280 + Math.random() * 80;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    return tween(400, t => {
      p.x = CANVAS_WIDTH / 2 + dx * t;
      p.y = CANVAS_HEIGHT / 2 + dy * t;
      p.alpha = (t < 0.5 ? t * 2 : (1 - t) * 2) * 0.9;
      p.rotation = t * Math.PI * 2;
    }, Easings.easeOut);
  }));

  // ── Stage 4 (1.2-1.6s): fade out everything ───────────────────────────────
  await tween(400, t => {
    titleText.alpha = 1 - t;
    subText.alpha = 1 - t;
    halo.alpha = 0.85 * (1 - t);
  }, Easings.easeIn);

  // Cleanup
  root.destroy({ children: true });
}
```

> **重要**：不註冊 ticker callback（用純 tween util）。所有 Sprite/Text/Graphics 都在 `root.destroy({ children: true })` 一次清掉，避免 leak。

> **Asset assertion**：sos2-rainbow-halo.webp + sos2-bigwin.webp 已 preloaded by LoadingScreen（chore #150+ inventory）— 若 Assets.get 失敗，Texture.from 會 lazy load。

**Commit 1**: `feat(fx): FreeSpinRetriggerCeremony module — rainbow halo + MORE SPINS + radial light burst (1.6s)`

---

### 3b. Commit 2 — Wire-up in BattleScreen.ts

#### 3b-1. Import 新模組

`BattleScreen.ts` 上方 import 區：
```ts
import { playFreeSpinRetriggerCeremony } from '@/fx/FreeSpinRetriggerCeremony';
```

#### 3b-2. 替換既有 retrigger pulse

當前 line 1639-1644：
```ts
// Retrigger pulse: freeSpinsRemaining jumped UP (not decremented)
if (isIn && this.freeSpinsRemaining > this.prevFreeSpinsRemaining) {
  void tween(250, t => {
    const s = 1 + 0.25 * Math.sin(Math.PI * t);   // 1.0 → 1.25 → 1.0
    this.freeSpinBanner!.scale.set(s);
  }, Easings.easeOut);
}
```

改成：
```ts
// chore: retrigger ceremony — full-screen 「MORE SPINS!」 ceremony
// 替代 simple scale pulse；how many added rounds = freeSpinsRemaining - prevFreeSpinsRemaining
if (isIn && this.freeSpinsRemaining > this.prevFreeSpinsRemaining) {
  const addedRounds = this.freeSpinsRemaining - this.prevFreeSpinsRemaining;
  // Fire-and-forget — 不阻塞 round flow（讓 banner 仍可 visible 期間 trigger ceremony 加層）
  // 但若 owner 偏好阻塞，改 await + 把 caller 改 async (refreshFreeSpinOverlay 已 sync — 需要 wrapper)
  void playFreeSpinRetriggerCeremony(this.fxLayer, addedRounds);

  // 保留既有 banner pulse (subtle bg pulse, ceremony main visual is the new fx)
  void tween(250, t => {
    const s = 1 + 0.10 * Math.sin(Math.PI * t);   // 1.0 → 1.10 → 1.0 (mild)
    this.freeSpinBanner!.scale.set(s);
  }, Easings.easeOut);
}
```

> **設計選擇**：fire-and-forget，因 `refreshFreeSpinOverlay` 是 sync 函數（不 await）。Ceremony 跑期間 round loop 繼續，但 ceremony zIndex=2000 在最上層 visible。
> **Mild banner pulse 保留**：full-screen ceremony 結束後 banner 仍有微 pulse 提示 retrigger 已發生 — 主視覺由 ceremony 處理。

**Commit 2**: `feat(fx): wire FreeSpinRetriggerCeremony in refreshFreeSpinOverlay retrigger branch`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/fx/FreeSpinRetriggerCeremony.ts`（NEW）
- `src/screens/BattleScreen.ts`（import + refreshFreeSpinOverlay retrigger pulse 替換）

**禁止**：
- 動 SPEC §15 機制（FreeSpin state / freeSpinsRemaining 累加邏輯 / FREE_SPIN_COUNT）
- 動 既有 j-04 JackpotCeremony / s13-fx-01 FreeSpinEntryCeremony / s13-fx-02 modules
- 動 SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool
- 動 createFormation / NineGrid / cellsA/cellsB
- 加新 asset（用既有 sos2-rainbow-halo + sos2-bigwin）
- 動 SPEC.md / DesignTokens / sim-rtp.mjs / main.ts
- 改 ResultScreen / DraftScreen / LoadingScreen
- 改 chore #162 AUTO 流程

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 進 Free Spin（demo mode 第 5 spin）→ 跑 5 個 free spins
   - 在 free spin 期間再 trigger 一次（demo 第 9 spin = 第 4 free spin？— 看 demo grid 設置）
   - 看到全螢幕「MORE SPINS!」金字 + rainbow halo 從中心擴張 + 「+5 ROUNDS」 副字 + 16 顆光球粒子發散
   - 1.6s 完整跑完無斷層
   - 無 console error / ticker leak
   - DevTools FPS ≥ 50 during ceremony
   - free spin banner 仍顯示 N/M 且仍正常工作
5. 截圖 1 張：retrigger ceremony mid-flight（含 halo + MORE SPINS + 粒子發散）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 1.6s 是否合適（or 太長？太短？）
- rainbow halo 視覺感受（vs s13-fx-01 fire-text 對比）
- 16 顆 LightBall 粒子數是否 OK（or 需 8 / 24？）
- DevTools FPS / listener count 觀察結果
- Spec deviations：預期 0
- Sprint 13 進度：fx-01 ✓ → fx-02 ✓ → fx-03 ✓ → closure 待
