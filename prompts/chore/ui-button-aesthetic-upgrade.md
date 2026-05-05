# Chore — UiButton 美化升級（多層 gradient + double border + corner dots + drop shadow）

## 1. Context

Owner 試玩反映 DraftScreen 底部 4 button (CLEAR / MIRROR A→B / RANDOM 5+5 / START BATTLE) **太陽春**。

當前 `UiButton` (chore s12-ui-03)：
- 2-rect gradient simulation（粗）
- 單一 gold stroke 2px
- 無 highlight / shadow / 修飾

升級成**JP marquee 風格**：
- FillGradient (3-stop) — 平滑 gradient
- **Double border**：outer dark warm-brown + inner gold hairline
- **Top inner highlight** — 細白光帶
- **Drop shadow** — 立體感
- **4 corner dots** — gold accent
- Hover/pressed 對應 state 的 visual feedback 加強

純視覺升級 — 不動 button 邏輯 / API / DraftScreen call sites。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用 Pixi `FillGradient` (already imported in goldText) + DropShadowFilter

---

## 2. Spec drift check (P6)

1. 確認 `UiButton` (chore s12-ui-03) constructor + 4 state drawBg 結構
2. 確認 callers：DraftScreen line 535 (toolbar) + line 543 (START BATTLE) — API 不改
3. 確認 `T.GOLD.glow / .base / .shadow` palette + JP marquee 視覺風格

---

## 3. Task

### Single commit — UiButton aesthetic upgrade

`src/components/UiButton.ts` `drawBg` 重寫：

```ts
import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import { DropShadowFilter } from 'pixi-filters';
import * as T from '@/config/DesignTokens';

private drawBg(state: 'normal' | 'hover' | 'pressed' | 'disabled'): void {
  this.bg.clear();
  const radius = 10;
  const halfW = this.w / 2;
  const halfH = this.h / 2;

  // Color stops per state
  let stops: Array<{ offset: number; color: string }>;
  let outerStroke: number;
  let innerStroke: number;
  let topHighlight: number;

  switch (state) {
    case 'hover':
      stops = [
        { offset: 0.00, color: '#fff5b8' },   // bright top
        { offset: 0.45, color: '#ffd700' },   // mid gold
        { offset: 1.00, color: '#a07810' },   // dark bottom
      ];
      outerStroke  = 0x4a2a04;   // dark warm-brown
      innerStroke  = T.GOLD.glow;
      topHighlight = 0xfff8c8;
      break;

    case 'pressed':
      stops = [
        { offset: 0.00, color: '#806020' },   // darker top
        { offset: 0.50, color: '#a07810' },
        { offset: 1.00, color: '#604010' },   // very dark bottom
      ];
      outerStroke  = 0x2a1a04;
      innerStroke  = T.GOLD.shadow;
      topHighlight = 0xa07810;
      break;

    case 'disabled':
      stops = [
        { offset: 0.00, color: '#555555' },
        { offset: 1.00, color: '#222222' },
      ];
      outerStroke  = 0x111111;
      innerStroke  = 0x444444;
      topHighlight = 0x666666;
      break;

    case 'normal':
    default:
      stops = [
        { offset: 0.00, color: '#ffe488' },   // bright top
        { offset: 0.50, color: '#d4a020' },   // mid gold
        { offset: 1.00, color: '#7a5408' },   // dark bottom
      ];
      outerStroke  = 0x2a1a04;
      innerStroke  = T.GOLD.base;
      topHighlight = 0xffe488;
      break;
  }

  // chore #204: Layer 1 — multi-stop vertical gradient (smoother than 2-rect simulation)
  const grad = new FillGradient({
    type:         'linear',
    start:        { x: 0, y: 0 },
    end:          { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops:   stops,
  });
  this.bg.roundRect(-halfW, -halfH, this.w, this.h, radius).fill(grad);

  // chore #204: Layer 2 — outer dark stroke (frame)
  this.bg.roundRect(-halfW, -halfH, this.w, this.h, radius)
    .stroke({ width: 2, color: outerStroke, alpha: 1 });

  // chore #204: Layer 3 — inner gold hairline (1px, JP marquee style)
  this.bg.roundRect(-halfW + 2, -halfH + 2, this.w - 4, this.h - 4, radius - 2)
    .stroke({ width: 1, color: innerStroke, alpha: 0.85 });

  // chore #204: Layer 4 — top inner highlight (thin bright line just inside top edge)
  this.bg.roundRect(-halfW + 4, -halfH + 3, this.w - 8, 1, 0)
    .fill({ color: topHighlight, alpha: 0.6 });

  // chore #204: Layer 5 — 4 corner accent dots (decorative, JP marquee style)
  if (state !== 'disabled') {
    const dotR = 1.5;
    const dotMargin = 5;
    const dots = [
      [-halfW + dotMargin, -halfH + dotMargin],
      [ halfW - dotMargin, -halfH + dotMargin],
      [-halfW + dotMargin,  halfH - dotMargin],
      [ halfW - dotMargin,  halfH - dotMargin],
    ];
    for (const [dx, dy] of dots) {
      this.bg.circle(dx, dy, dotR).fill({ color: T.GOLD.glow, alpha: 0.8 });
    }
  }

  // chore #204: Drop shadow on the whole button (set once in constructor)
  if (!this.bg.filters || (Array.isArray(this.bg.filters) && this.bg.filters.length === 0)) {
    this.bg.filters = [new DropShadowFilter({
      color:    0x000000,
      alpha:    0.5,
      blur:     4,
      offset:   { x: 0, y: 3 },
      quality:  3,
    })];
  }
}
```

> **Constructor 不需動** — `bg = new Graphics()` + `drawBg('normal')` 仍同 entry。
>
> **DropShadowFilter 一次性 set** in first drawBg call（後續 redraw 不重設）。

### Hover state 加 glow filter（option）

可選擇加 GlowFilter on hover 增加質感（or 略過保簡潔）。Executor 看視覺結果決定。

**Commit**: `feat(chore): UiButton aesthetic upgrade — FillGradient 3-stop + double border + top highlight + corner dots + drop shadow`

---

### 檔案範圍（嚴格）

**修改**：
- `src/components/UiButton.ts`（drawBg 重寫 + import FillGradient + DropShadowFilter）

**禁止**：
- 動 UiButton constructor / API / event listener
- 動 caller：DraftScreen toolbar buttons + START BATTLE 不變
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "FillGradient\|DropShadowFilter" src/components/UiButton.ts` — 確認新 import + use
   - `grep "topHighlight\|innerStroke\|corner.*dot" src/components/UiButton.ts` — 確認多層
5. **Preview 驗證**：
   - DraftScreen 底部 4 button 視覺**升級到 JP marquee 風格**：
     - Smooth gradient（不再 2-rect 切割）
     - Double border（深 outer + 金 inner）
     - 頂部細白光帶（質感）
     - 4 角金色裝飾點
     - 立體 drop shadow
   - Hover 變更亮（brighter gradient）
   - Pressed 變暗（深 gradient + ）
   - Disabled 灰色（既有功能不變）
   - Click 行為仍正常（callbacks 不影響）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（DraftScreen 底部 4 button + START BATTLE）
- gradient 3-stop 顏色 OK 嗎（or 試 4-stop 更平滑）
- corner dots 1.5px 是否合適（可省 if 視覺太忙）
- DropShadow 視覺感受 (or 可關 if 不喜歡)
- Spec deviations：預期 0
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3`
- **Audit check (per chore #203 lesson)**：grep 全 codebase 確認沒其他地方有相同 button drawing pattern need sync
