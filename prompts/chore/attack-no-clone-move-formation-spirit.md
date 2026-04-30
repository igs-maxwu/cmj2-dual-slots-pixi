# Chore — Attack 動畫直接動 formation spirit（不再創 clone avatar）

## 1. Context

Owner 試玩 chore #181 後反映：attack 動畫像「分身」(clone) — 看到 formation 原 spirit + 飛出去攻擊的另一個 spirit 同時存在。

### Root cause

chore #177 設計 `attackTimeline` 創建**新 Sprite avatar**：
```ts
const avatarSprite = new Sprite(tex);
// ... animate from originX/Y to clash centerX ...
```

但 formation 原 spirit container（在 `cellsA[slot].container`）**仍 visible** → 視覺上有 2 隻 spirit（原位 + 飛出的 clone）。

### Owner 期望
- 攻擊時 **formation 的 spirit container 直接移動** 到 clash zone
- 攻擊期間 formation slot 暫時為空（spirit 在 clash 中）
- 攻擊完 spirit 回到原 slot
- 任何時刻畫面只有 1 隻 spirit

### Fix 方案

放棄「創新 Sprite avatar」pattern，改用「直接動 `cellsA[slot].container`」pattern。

`FormationCellRefs.container` 已存在於 `BattleScreen.ts` line 120-127：
```ts
interface FormationCellRefs {
  container: Container;       // ← 我們要動的
  sprite:    Sprite | null;   // spirit body
  hpTrack:   Graphics;        // HP bar bg
  hpFill:    Graphics;        // HP bar fill
  glowRing:  Graphics;
  crossMark: Graphics;
}
```

機制零改動 — 純 attackTimeline + AttackOptions API 重構。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（attackTimeline API 重構 / BattleScreen wire-up）
- **`debugging-and-error-recovery`** — 多 phase 內 scale 計算需考慮 base scale (slot 0 = 0.85, slot 4 = 1.10)
- **`source-driven-development`** — 用既有 FormationCellRefs.container，不發明新 ref 結構

---

## 2. Spec drift check (P6) + Pre-merge audit checklist

### Spec drift check
1. `mempalace_search "SpiritAttackChoreographer attackTimeline avatar Sprite formation container chore 177 178 179"`
2. 確認 `FormationCellRefs.container` 結構（line 120）
3. 確認 chore #181 SLOT_TO_POS_SPEC 5-slot zigzag scale gradient 0.85-1.10
4. 確認 chore #179 faceDir = `side === 'A' ? -1 : 1` 仍是 facing 邏輯

### Pre-merge audit
- [ ] `attackTimeline` API 簽名變化（移除 originX/originY/symbolId？）— breaking change，audit 所有 caller
- [ ] BattleScreen `addSide` 內 attackTimeline call 對應更新
- [ ] FXPreviewScreen / FXDevHook 若有 attackTimeline call 同步更新（grep 確認）
- [ ] spiritContainer animation 不破壞 chore #163 HP bar offset（HP bar 跟著 container 動，仍可見）
- [ ] zIndex 動畫期間提升 (e.g. 1500) 確保視覺在最上層
- [ ] 動畫結束 restore container 原 x/y/scale.x/scale.y/zIndex
- [ ] base scale (slot 0 = 0.85, slot 4 = 1.10) × phase scale (e.g. 1.30) 計算正確
- [ ] faceDir mirror via scale.x sign 不衝突 base scale

---

## 3. Task

### 3a. Commit 1 — attackTimeline 改用 spiritContainer

`src/screens/SpiritAttackChoreographer.ts`：

#### 3a-1. AttackOptions 介面更新

當前：
```ts
export interface AttackOptions {
  stage: Container;
  symbolId: number;
  spiritKey: string;
  originX: number;
  originY: number;
  targetPositions: { x: number; y: number }[];
  particleColor?: number;
  shakeIntensity?: number;
  side?: 'A' | 'B';
}
```

改成：
```ts
export interface AttackOptions {
  stage: Container;             // for fx layer (signature animations)
  spiritContainer: Container;   // chore #182: animate this directly (was: create new avatar)
  symbolId: number;             // for personality / signature dispatch
  spiritKey: string;            // for signature dispatch
  targetPositions: { x: number; y: number }[];
  particleColor?: number;
  shakeIntensity?: number;
  side?: 'A' | 'B';
}
```

> `originX/originY` removed — read from `spiritContainer.x/y` directly。

#### 3a-2. attackTimeline 重寫

當前 chore #178 + #179 結構（line 134+）：
```ts
export async function attackTimeline(opts: AttackOptions): Promise<void> {
  const personality = PERSONALITIES[opts.spiritKey] ?? DEFAULT_PERSONALITY;
  // ...
  const { stage, symbolId, originX, originY, targetPositions } = opts;

  // chore: full-body spirit sprite replaces SpiritPortrait round avatar
  const spiritKey = SYMBOLS[symbolId]?.spiritKey ?? opts.spiritKey;
  const tex = Assets.get<Texture>(...) ?? Texture.from(...);
  const avatarSprite = new Sprite(tex);
  // ... avatarSprite.height = 120, etc.
  const avatar = new Container();
  avatar.addChild(avatarSprite);
  avatar.x = originX;
  avatar.y = originYAdj;
  // ...
  const faceDir = side === 'A' ? -1 : 1;
  stage.addChild(avatar);
  // ... 5 phases ...
  avatar.destroy({ children: true });
}
```

改成：
```ts
export async function attackTimeline(opts: AttackOptions): Promise<void> {
  const personality    = PERSONALITIES[opts.spiritKey] ?? DEFAULT_PERSONALITY;
  const particleColor  = opts.particleColor  ?? personality.particleColor;
  const shakeIntensity = opts.shakeIntensity ?? personality.shakeIntensity;
  const D = personality.duration;

  const side = opts.side ?? 'A';
  const CLASH_OFFSET = 70;
  const centerX = side === 'A'
    ? Math.round(CANVAS_WIDTH / 2 - CLASH_OFFSET)
    : Math.round(CANVAS_WIDTH / 2 + CLASH_OFFSET);
  const centerY = Math.round(CANVAS_HEIGHT * 0.42);

  const { stage, spiritContainer, targetPositions } = opts;
  const avatar = spiritContainer;          // alias for clarity

  // chore #182: save container's original state to restore after attack
  const origX = avatar.x;
  const origY = avatar.y;
  const origScaleX = avatar.scale.x;
  const origScaleY = avatar.scale.y;
  const origZIndex = avatar.zIndex;
  const origAbsScale = Math.abs(origScaleX);   // base scale for current slot (e.g. 0.85 or 1.10)

  // Bring to top during attack
  avatar.zIndex = 1500;
  if (avatar.parent) avatar.parent.sortableChildren = true;

  // chore: spirit webp native left-facing; A flips to right (toward B), B keeps left (toward A)
  const faceDir = side === 'A' ? -1 : 1;

  // Phase 1: Prepare — scale up (multiplier vs original base scale)
  await tween(D.prepare, p => {
    const s = origAbsScale * (1.0 + Easings.easeOut(p) * 0.20);
    avatar.scale.set(faceDir * s, s);
  });

  // Phase 2: Leap from origin to clash centre
  await tween(D.leap, p => {
    const ep = Easings.easeInOut(p);
    avatar.x = origX + (centerX - origX) * ep;
    const arc = -personality.arcHeight * 4 * p * (1 - p);
    avatar.y = origY + (centerY - origY) * ep + arc;
    const s = origAbsScale * (1.20 + ep * 0.10);
    avatar.scale.set(faceDir * s, s);
  });
  avatar.x = centerX;
  avatar.y = centerY;

  // Phase 3: Hold (scale pulse)
  await tween(D.hold, p => {
    const s = origAbsScale * (1.30 + Math.sin(p * Math.PI * 5) * 0.04);
    avatar.scale.set(faceDir * s, s);
  });
  avatar.scale.set(faceDir * origAbsScale * 1.30, origAbsScale * 1.30);

  // Phase 4: Fire — dispatch on signature
  const ctx: Phase4Ctx = {
    stage, avatar, centerX, centerY,
    targets: targetPositions,
    color: particleColor,
    duration: D.fire,
    shakeIntensity,
  };
  switch (personality.signature) {
    // ... existing 8 signature cases unchanged ...
  }

  // Phase 5: Return to origin position
  await tween(D.return, p => {
    const ep = Easings.easeOut(p);
    avatar.x = centerX + (origX - centerX) * ep;
    avatar.y = centerY + (origY - centerY) * ep;
    const s = origAbsScale * (1.30 - ep * 0.30);   // 1.30 → 1.0
    avatar.scale.set(faceDir * s, s);
  });

  // chore #182: restore container's original state (no destroy — it's the formation container)
  avatar.x = origX;
  avatar.y = origY;
  avatar.scale.set(origScaleX, origScaleY);   // restores including original sign
  avatar.zIndex = origZIndex;
}
```

> **Critical**：`avatar.destroy({ children: true })` 移除 — 不能 destroy formation container（仍要繼續使用）。改為 restore 原 state。
> **Texture / Sprite import** 不再需要（不創新 Sprite）— 移除 `Sprite, Texture, Assets` import 若沒其他用途，否則保留。

#### 3a-3. 移除 SYMBOLS import 若已不用

當前 chore #177 import：
```ts
import { Sprite, Texture, Assets } from 'pixi.js';
import { SYMBOLS } from '@/config/SymbolsConfig';
```

若不再 reference Sprite/Texture/Assets/SYMBOLS（spiritKey 從 opts 拿）→ 可移除。Executor grep 確認：
```bash
grep "SYMBOLS\|Sprite\|Texture\|Assets" src/screens/SpiritAttackChoreographer.ts
```

**Commit 1**: `feat(chore): attackTimeline animates formation spiritContainer directly (no clone) — saves+restores x/y/scale/zIndex`

---

### 3b. Commit 2 — BattleScreen wire-up

`src/screens/BattleScreen.ts` `playAttackAnimations` `addSide` (around line 2240+)：

當前：
```ts
animations.push(attackTimeline({
  stage:    this.container,
  symbolId: bestDrafted.symbolId,
  spiritKey: SYMBOLS[bestDrafted.symbolId].spiritKey,
  originX: origin.x, originY: origin.y,
  targetPositions: targets,
  side: side,
}));
```

(`origin` 是 `attackerCells[slot].container`)

改成：
```ts
animations.push(attackTimeline({
  stage:    this.container,
  spiritContainer: attackerCells[slot].container,   // chore #182: animate formation spirit directly
  symbolId: bestDrafted.symbolId,
  spiritKey: SYMBOLS[bestDrafted.symbolId].spiritKey,
  targetPositions: targets,
  side: side,
}));
```

`origin` variable 可以 inline 或 remove（不再需要 `origin.x/origin.y` 因為 attackTimeline 從 spiritContainer 讀）。

#### 同樣套到 mercenaryHits 處理（既有）

BattleScreen.addSide 內 `mercenaryHits` 也用 `attackTimeline` 嗎？若是 → 同樣改 spiritContainer。Grep 確認：
```bash
grep "attackTimeline" src/screens/BattleScreen.ts
```

#### FXPreviewScreen / FXDevHook 同步

```bash
grep "attackTimeline" src/screens/FXPreviewScreen.ts src/systems/FXDevHook.ts
```

若這兩處 dev-only 也 call attackTimeline → 需提供 spiritContainer 參數。Dev tool 可 mock 一個臨時 Container（仍是 Container 即可）。Executor 視情況決定。

**Commit 2**: `feat(chore): BattleScreen pass cellsA[slot].container as spiritContainer to attackTimeline (no more clone avatar)`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts`（AttackOptions / attackTimeline 重寫 / removed Sprite creation）
- `src/screens/BattleScreen.ts`（addSide 改 attackTimeline call 簽名）
- `src/screens/FXPreviewScreen.ts`（若 attackTimeline 仍在 dev preview，需 dummy container）
- `src/systems/FXDevHook.ts`（同上）

**禁止**：
- 動 PERSONALITIES / 8 個 _sigXxx signatures
- 動 SlotEngine / WayHit / SymbolsConfig / DamageDistributor
- 動 chore #161/#165 activeUnits filter
- 動 chore #163 HP bar offset
- 動 chore #181 SLOT_TO_POS_SPEC formation layout
- 加新 asset
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Pre-merge audit (executor 自查)**：
   - `grep "attackTimeline" src/` — 確認所有 caller 都改了 API
   - `grep "originX\|originY" src/screens/SpiritAttackChoreographer.ts` — 應該全消失
   - `grep "new Sprite\|new Container" src/screens/SpiritAttackChoreographer.ts` — 應只剩 Phase 4 signature 內部 (e.g. ghost effect)，沒有 avatar 級別創建
5. **Preview 驗證 critical**：
   - 攻擊時 **formation 原位 spirit 消失**（move 到 clash 中央）— 不再看到分身
   - 攻擊完 spirit **回到 formation 原位** + scale 回原值（不被 phase scale 覆寫）
   - 雙側 clash：兩 spirit 從各自 formation 飛來中央面對面
   - 8 signature attack fx 仍正常射出（基於 ctx.avatar = spiritContainer）
   - chore #163 HP bar 跟 spirit 一起動（HP bar follows during attack — 視覺接受？）
   - DevTools FPS 不下降
   - 無 console error / TypeScript error
5. 截圖 1 張：clash 期間 — 確認**兩個 formation 的對應 slot 都空著**（spirit 在 clash 中）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（clash 期間 formation 缺位 + 中央對打）
- HP bar 跟 spirit 一起飛到 clash zone 視覺感受 OK 嗎（or 未來需獨立 hide）？
- Phase scale 計算 origAbsScale 1.30 倍是否合理（slot 4 originally 1.10 → peak 1.43，slot 0 originally 0.85 → peak 1.105）
- 原 spirit container restore 後位置/scale 完全正確嗎（不被前次攻擊污染）
- Spec deviations：預期 0 — 純視覺重構
- **Audit lessons applied**：
  - 不創 Sprite，避免 chore #178 size+scale 衝突
  - 沒新 hitArea button
  - chore #161/165 兼容（spiritContainer 從 cellsA[slot] 拿，不影響 activeUnits filter）
  - chore #181 base scale (0.85/0.91/0.97/1.04/1.10) 經 origAbsScale 保留 → restore 不丟
