# Sprint 13 · s13-fx-01 — Free Spin 進場 Ceremony 升級（fire-text declaration 取代 simple banner）

## 1. Context

PR: **新檔 `src/fx/FreeSpinEntryCeremony.ts` — Free Spin 觸發瞬間（≥3 scatter 偵測後、進入 free spin mode 之前）播放戲劇性 fire-text ceremony，取代 f-04 既有 simple goldText banner + gold tint。**

Why: Sprint 13 第一步。f-04 既有 Free Spin entry 視覺是「`FREE SPINS  5/5` goldText banner pop-in 220ms + 全螢幕 gold tint alpha 0.08」— 對 SPEC §15.7「靈氣爆發」這種高潮機制來說**戲劇性嚴重不夠**。新版用 SOS2 declare-fire atlas Fire_1..7 region 加全螢幕大字「FREE SPIN」+ 火焰背景 + scale animation。

**注意**：本 PR 不替換 f-04 既有的 in-mode banner（`FREE SPINS  N/5` 上方提示是進去後 5 spin 期間持續顯示） — fx-01 只新加**進場那一刻**的 ceremony。設計上 ceremony 結束後 banner 才接管 in-mode UI。

Mockup reference: 無直接 mockup（Variant A 沒涵蓋 Free Spin 進場）— 自由發揮，但**參考 j-04 JackpotCeremony pattern**（duration / fade / cleanup 紀律）。

設計：

### 7-stage choreography（總 ~2.5s）

| Stage | Time | 內容 |
|---|---|---|
| 1. Dim BG | 0-300ms | 全螢幕 alpha 0→0.6 dim navy (0x0D1421) |
| 2. Fire bg | 300-500ms | sos2-declare-fire atlas Fire_1 + Fire_6（左右兩側）背景火焰 fade-in 至 alpha 0.85 |
| 3. Text scale | 500-1000ms | 「FREE SPIN」 goldText fontSize 80 從 scale 0.4 + alpha 0 → scale 1.05 + alpha 1（with overshoot） |
| 4. Sub text | 1000-1200ms | 「靈氣爆發 · 5 ROUNDS」副字 fontSize 22 fade-in |
| 5. Hold | 1200-2000ms | 800ms 全 alpha hold |
| 6. Fade out | 2000-2300ms | 全 root.alpha 1→0 |
| 7. Cleanup | 2300ms | root.destroy({children:true}) + ticker.remove |

### 引用 SOS2 atlas regions

- `sos2-declare-fire:FX/Fire_1` — 大火焰主體（左側）
- `sos2-declare-fire:FX/Fire_6` — 大火焰主體（右側，鏡像 scale.x = -1）
- `sos2-declare-fire:FX/Fire_2` 或 `FX/Fire_7` — 中央小火星

### 文字顏色

- Main「FREE SPIN」: `T.GOLD.glow` (0xFFD37A) + GlowFilter outerStrength 3.0 + dropShadow
- Sub「靈氣爆發 · 5 ROUNDS」: `T.GOLD.base` italic letterSpacing 6

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — 沿用 j-04 JackpotCeremony 既有 pattern（Container hierarchy / Ticker discipline / Promise-wrapped sequenced effect）。**特別注意**：ceremony 期間 game loop **必須 await**，否則下一 spin 會進來 race condition。
- **`incremental-implementation`** — **2 atomic commits**：(1) FreeSpinEntryCeremony.ts new module，(2) BattleScreen 接 trigger 呼叫 + 移既有 banner pop-in（既有 banner 改 free-spin-mode 期間 only，不 in entry moment）。
- **`source-driven-development`** — `sos2-declare-fire.atlas` 內 region name 確認（先 grep 或 read atlas file 看 `FX/Fire_*` 確切名稱）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 13 Free Spin entry ceremony fire declare s13-fx-01"`
2. 確認 `public/assets/fx/sos2-declare-fire.atlas` 存在（Sprint 12 後仍保留）
3. 確認 atlas 內 `FX/Fire_1..7` regions（grep atlas file head）
4. 確認 `src/fx/FXAtlas.ts` `FXAtlas.sprite('sos2-declare-fire:FX/Fire_1')` API 路徑（既 j-04 用過 sos2-bigwin atlas pattern 一樣）
5. 確認 BattleScreen `f-03` Free Spin trigger detection block (line ~593+)
6. 確認 既有 f-04 `refreshFreeSpinOverlay` / `drawFreeSpinOverlay` 邏輯 — 本 PR**不動**

## 3. Task

### 3a. 新檔 `src/fx/FreeSpinEntryCeremony.ts`

```ts
import { Container, Sprite, Graphics, Ticker } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { FXAtlas } from '@/fx/FXAtlas';
import { goldText } from '@/components/GoldText';
import * as T from '@/config/DesignTokens';
import { tween, delay, Easings } from '@/systems/tween';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/screen';

const TOTAL_DURATION = 2300;

/**
 * s13-fx-01: Free Spin entry ceremony — fire-text declaration.
 *
 * Caller awaits Promise; on resolve, ceremony Container is destroyed
 * + removed from parent. Caller then enters free spin mode (5 spins,
 * ×2 multiplier) with f-04 banner showing N/5.
 *
 * Stages: Dim BG → Fire bg → FREE SPIN scale-up → Sub text fade-in →
 *         Hold → Fade out → Cleanup
 */
export async function playFreeSpinEntryCeremony(parent: Container): Promise<void> {
  const root = new Container();
  root.zIndex = 2400;   // above HUD (1100), below JP ceremony (2500)
  parent.addChild(root);

  // ── Layer 1: Dim BG ──
  const bg = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0x0D1421, alpha: 0 });   // start invisible
  root.addChild(bg);

  // ── Layer 2: Fire backgrounds (left + right mirror) ──
  const fireL = FXAtlas.sprite('sos2-declare-fire:FX/Fire_1');
  fireL.anchor.set(0.5, 1);   // anchor bottom-center
  fireL.x = CANVAS_WIDTH * 0.25;
  fireL.y = CANVAS_HEIGHT * 0.85;
  fireL.alpha = 0;
  fireL.scale.set(1.5);
  root.addChild(fireL);

  const fireR = FXAtlas.sprite('sos2-declare-fire:FX/Fire_6');
  fireR.anchor.set(0.5, 1);
  fireR.x = CANVAS_WIDTH * 0.75;
  fireR.y = CANVAS_HEIGHT * 0.85;
  fireR.alpha = 0;
  fireR.scale.set(1.5, 1.5);
  fireR.scale.x *= -1;   // mirror horizontal
  root.addChild(fireR);

  // ── Layer 3: Main text ──
  const mainText = goldText('FREE SPIN', { fontSize: 80, withShadow: true });
  mainText.anchor.set(0.5, 0.5);
  mainText.x = CANVAS_WIDTH / 2;
  mainText.y = CANVAS_HEIGHT / 2 - 30;
  mainText.alpha = 0;
  mainText.scale.set(0.4);
  mainText.style.fill = T.GOLD.glow;
  mainText.filters = [new GlowFilter({
    color: T.GOLD.glow, distance: 24, outerStrength: 3, innerStrength: 0.6,
  })];
  root.addChild(mainText);

  // ── Layer 4: Sub text ──
  const subText = goldText('靈氣爆發 · 5 ROUNDS', { fontSize: 22, withShadow: true });
  subText.anchor.set(0.5, 0.5);
  subText.x = CANVAS_WIDTH / 2;
  subText.y = CANVAS_HEIGHT / 2 + 50;
  subText.alpha = 0;
  subText.style.fill = T.GOLD.base;
  subText.style.letterSpacing = 6;
  subText.style.fontStyle = 'italic';
  root.addChild(subText);

  // ── Stage 1: Dim BG fade-in (0-300ms) ──
  await tween(300, t => { bg.alpha = 0.6 * t; }, Easings.easeOut);

  // ── Stage 2: Fire bg fade-in (300-500ms, 200ms duration) ──
  void tween(200, t => {
    fireL.alpha = 0.85 * t;
    fireR.alpha = 0.85 * t;
  }, Easings.easeOut);

  // ── Stage 3: Main text scale-up + alpha (500-1000ms, 500ms duration) ──
  await delay(200);   // wait for fire bg to start
  await tween(500, t => {
    mainText.alpha = t;
    // Overshoot: 0.4 → 1.05 → 1.0
    const overshoot = 0.4 + 0.65 * t + 0.05 * Math.sin(Math.PI * t);
    mainText.scale.set(overshoot);
  }, Easings.easeOut);

  // ── Stage 4: Sub text fade-in (1000-1200ms, 200ms) ──
  void tween(200, t => { subText.alpha = t; }, Easings.easeOut);

  // ── Stage 5: Hold (1200-2000ms, 800ms) ──
  await delay(1000);

  // ── Stage 6: Fade out everything (2000-2300ms, 300ms) ──
  await tween(300, t => {
    root.alpha = 1 - t;
  }, Easings.easeIn);

  // ── Stage 7: Cleanup ──
  root.destroy({ children: true });
}
```

**Commit 1**: `feat(s13-fx-01a): FreeSpinEntryCeremony.ts new module — fire-text declaration`

### 3b. BattleScreen integration

`BattleScreen.ts` 找 Free Spin trigger detection block（chore #146 / Sprint 6 f-03 加的）— 在 `inFreeSpin = true` 設定**之前** await ceremony：

既有（Sprint 6 f-03 留下，line ~593 area，以下為示意非真實 line）：
```ts
if (scatterThisSpin >= 3) {
  if (!this.inFreeSpin) {
    // Fresh trigger
    this.inFreeSpin = true;
    this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
    if (import.meta.env.DEV) console.log(`[FreeSpin] TRIGGERED — ${scatterThisSpin} scatters → 5 spins`);
  } else {
    // Retrigger
    // ...
  }
}
```

改為：

```ts
if (scatterThisSpin >= 3) {
  if (!this.inFreeSpin) {
    // s13-fx-01: ceremony first, then enter mode
    await playFreeSpinEntryCeremony(this.container);

    this.inFreeSpin = true;
    this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
    if (import.meta.env.DEV) console.log(`[FreeSpin] TRIGGERED — ${scatterThisSpin} scatters → 5 spins`);
  } else {
    // Retrigger (留 s13-fx-03 處理)
    // ...
  }
}
```

加 import：
```ts
import { playFreeSpinEntryCeremony } from '@/fx/FreeSpinEntryCeremony';
```

**Commit 2**: `feat(s13-fx-01b): BattleScreen Free Spin trigger awaits entry ceremony`

### 3c. 檔案範圍（嚴格）

**新增**：
- `src/fx/FreeSpinEntryCeremony.ts`（new file ~110 lines）

**修改**：
- `src/screens/BattleScreen.ts`（+import + 1 await call before inFreeSpin=true）

**禁止**：
- 動 f-04 既有 `drawFreeSpinOverlay` / `refreshFreeSpinOverlay` 邏輯（保留 in-mode N/5 banner + tint）
- 動 f-03 既有 scatter detection（純加 await ceremony）
- 加新 asset（用既有 sos2-declare-fire.atlas）
- 動 SymbolsConfig / SlotEngine / FreeSpin state 機制
- DraftScreen / LoadingScreen / ResultScreen / FXPreviewScreen
- main.ts
- DesignTokens
- scripts/sim-rtp.mjs（純視覺，sim 不依賴 ceremony）
- SPEC.md
- 處理 retrigger ceremony（s13-fx-03 工作）

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle，跑到 ≥3 scatter spin（**自然觸發或 DEV 'F' key**）
   - 看到 ceremony 完整流程：
     - Dim navy 全螢幕背景出現（0.6 alpha）
     - 左右兩側火焰 fade-in
     - 中央「FREE SPIN」金字 scale-up overshoot 至 1.05 → 1.0
     - 副字「靈氣爆發 · 5 ROUNDS」淡入
     - 整體 hold 800ms
     - 全 fade out
   - Ceremony 結束後 f-04 既有 `FREE SPINS  5/5` banner 接管顯示
   - 接下來 5 spins ×2 mult 仍正常（mechanic 不變）
   - FPS 全程 ≥ 50
5. 截圖 1 張（mid-ceremony 中段，看 main text + fire bg）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- `sos2-declare-fire:FX/Fire_*` region name 是否拼字正確（grep atlas file 確認 actual region keys）
- ceremony 觸發到 f-04 banner 接管之間有無 visual gap / overlap
- 自然觸發頻率（依 Sprint 6 f-03 sim ~0.0049/spin = 約每 200 spin 1 次）— 若耐心不夠用 DEV 'F' key 強制觸發
- FPS 觀察（特別 Stage 2-3 同時 2 個 fire sprite + GlowFilter）
- Spec deviations：預期 0
