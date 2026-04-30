# Chore — Attack 動畫：圓頭像 → 整隻全身 sprite + 雙側 clash 站位

## 1. Context

Owner 試玩反映（截圖佐證）：對戰中央仍出現「圓圈頭像」風格 attack avatar — 跟 chore #166-168 DraftScreen 全身立繪、formation 全身 spirit 風格不一致。

### 期望行為
1. **單側攻擊**：發動攻擊的 spirit **整隻** 從 formation 起點移到畫面中央偏己側 → 對對方發動攻擊 → 退回 formation
2. **雙側都攻擊**：A 側 spirit 移到中央偏左 / B 側 spirit 移到中央偏右 → **兩隻面對面 clash** → 各自退回

### Root cause
`SpiritAttackChoreographer.attackTimeline` line 146：
```ts
const avatar = new SpiritPortrait(symbolId, 64);   // ← 64px 圓頭像
```

`SpiritPortrait` 是 chore #166 之前 DraftScreen 用的 round-clipped portrait。Sprint 13/14 全身立繪統一後**漏了 attack avatar**，所以中央仍是舊圓頭。

另外當前 centerX = CANVAS_WIDTH/2 對 A 和 B 兩側相同 → 雙側攻擊時兩 avatar 重疊 → 視覺糊。

純視覺改動 — 不動 SlotEngine / damage / WayHit。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（avatar swap / 雙側 clash 站位）
- **`source-driven-development`** — 用既有 `public/assets/spirits/{spiritKey}.webp` 既有 Sprite 載入 pattern（chore #166 DraftScreen 已驗證可行）

---

## 2. Spec drift check (P6)

1. `mempalace_search "SpiritAttackChoreographer attackTimeline avatar SpiritPortrait round portrait"`
2. 確認 既 `attackTimeline(opts: AttackOptions)` 簽名 — opts 含 `spiritKey, originX, originY, targetPositions`（line 134-209）
3. 確認 既 PERSONALITIES（line 45+）+ signatures（_sigLightningXCross 等）都用 `centerX` reference 不動 attack 軌跡
4. 確認 BattleScreen `playAttackAnimations` 怎麼 call `attackTimeline`（line 2244-2257 in addSide closure）— 取得 side 資訊管道
5. 確認 既 chore #161 + #165 `addSide` closure 結構（activeAttackers 邏輯）

---

## 3. Task

### 3a. Commit 1 — Avatar 全身 sprite 取代 round portrait

`src/screens/SpiritAttackChoreographer.ts` 加 import + 重寫 avatar 創建：

加 import：
```ts
import { Assets, Sprite, Texture } from 'pixi.js';
import { SYMBOLS } from '@/config/SymbolsConfig';
```

當前 line 145-149：
```ts
// Ghost avatar
const avatar = new SpiritPortrait(symbolId, 64);
avatar.x = originX;
avatar.y = originY;
stage.addChild(avatar);
```

改成：
```ts
// chore: full-body spirit sprite replaces SpiritPortrait round avatar
const spiritKey = SYMBOLS[symbolId]?.spiritKey ?? opts.spiritKey;
const tex = Assets.get<Texture>(`spirit-${spiritKey}`)
         ?? Texture.from(`${import.meta.env.BASE_URL}assets/spirits/${spiritKey}.webp`);
const avatar = new Sprite(tex);
avatar.anchor.set(0.5, 1);                     // bottom-centre (feet at y reference)
const aspect = tex.height / tex.width || 1.6;
avatar.height = 120;                            // target height
avatar.width = 120 / aspect;                    // aspect-preserved
avatar.x = originX;
avatar.y = originY + 60;                        // shift y down so feet at original anchor (chibi feet ground feel)
stage.addChild(avatar);
```

> **重要**：sprite anchor (0.5, 1) feet at y=0 原點，跟 SpiritPortrait (anchor 0.5, 0.5 圓心) 不同。因此 avatar.y 需 +60（半個 sprite height）讓 feet 對齊原 anchor 視覺位置。具體 +N px by executor 微調讓視覺自然。

> **scale 階段調整**：既有 phase 1-5 用 `avatar.scale.set(1.55)` 等大倍率 — 因為 SpiritPortrait 64px 小，需要放大才看得到。換 sprite 120px 後**scale 應該降**：
> - Phase 1 prepare: `1.0 + 0.20 * Easings.easeOut(p)` (不用 +0.40)
> - Phase 2 leap: `1.20 + ep * 0.10`（不用 1.40 + 0.15）
> - Phase 3 hold: `1.30 + Math.sin(...) * 0.04`（不用 1.55 + 0.06）
> - Phase 4-5 對應縮減

### 3a-2. _sigXxx 信號特效保留

既有 `_sigLightningXCross / _sigTripleDash / _sigDualFireball / _sigPythonSummon / _sigDragonDualSlash / _sigTigerFistCombo / _sigTortoiseHammerSmash / _sigPhoenixFlameArrow` 共 8 個 signature 動畫**全保留** — 它們以 ctx.centerX/Y 為起點射特效，跟 avatar 切換無關。

**Commit 1**: `feat(chore): SpiritAttackChoreographer avatar Sprite full-body replaces SpiritPortrait + scale tuning`

---

### 3b. Commit 2 — 雙側 clash 站位（A 中央偏左 / B 中央偏右）

#### 3b-1. AttackOptions 加 side

`AttackOptions` 介面加 `side?: 'A' | 'B'`（既有 line 126+）：
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
  side?: 'A' | 'B';                              // chore: clash positioning
}
```

#### 3b-2. centerX 依 side 偏移

`attackTimeline` line 140：
```ts
const centerX = Math.round(CANVAS_WIDTH  / 2);
```

改成：
```ts
// chore: side-aware clash position — A leaps to centre-left, B to centre-right
const side = opts.side ?? 'A';
const CLASH_OFFSET = 70;
const centerX = side === 'A'
  ? Math.round(CANVAS_WIDTH / 2 - CLASH_OFFSET)
  : Math.round(CANVAS_WIDTH / 2 + CLASH_OFFSET);
const centerY = Math.round(CANVAS_HEIGHT * 0.42);
```

> 雙側都 attack 時：A 在 centerX-70 / B 在 centerX+70 → 140px gap 對峙站位 ✓
> 單側 attack 時：avatar 仍在 close-to-centre offset，視覺仍像「移到中央」 ✓

#### 3b-3. Sprite facing direction

`attackTimeline` 創 Sprite 後加 facing：
```ts
// chore: A side faces right (toward B), B side faces left (toward A)
avatar.scale.x = side === 'A' ? 1 : -1;
// Note: scale.x mirror flips horizontally (anchor 0.5,1 keeps feet centered after flip)
```

注意：phase 1/2/3/5 的 `avatar.scale.set(N)` 是設**兩軸 uniform scale**，會覆蓋 facing flip。需改成：
```ts
// Phase 1
await tween(D.prepare, p => {
  const s = 1.0 + Easings.easeOut(p) * 0.20;
  avatar.scale.set(side === 'A' ? s : -s, s);   // preserve facing
});

// Phase 2
await tween(D.leap, p => {
  const ep = Easings.easeInOut(p);
  avatar.x = originX + (centerX - originX) * ep;
  const arc = -personality.arcHeight * 4 * p * (1 - p);
  avatar.y = originY + (centerY - originY) * ep + arc;
  const s = 1.20 + ep * 0.10;
  avatar.scale.set(side === 'A' ? s : -s, s);
});

// ... 同樣 Phase 3, 5 加 side 條件 sign on scale.x
```

#### 3b-4. BattleScreen wire-up

`BattleScreen.ts` `addSide` closure（既 line ~2240+ playAttackAnimations 內）：

當前：
```ts
animations.push(attackTimeline({
  stage:    this.container,
  symbolId: bestDrafted.symbolId,
  spiritKey: SYMBOLS[bestDrafted.symbolId].spiritKey,
  originX: origin.x, originY: origin.y,
  targetPositions: targets,
}));
```

加 side：
```ts
animations.push(attackTimeline({
  stage:    this.container,
  symbolId: bestDrafted.symbolId,
  spiritKey: SYMBOLS[bestDrafted.symbolId].spiritKey,
  originX: origin.x, originY: origin.y,
  targetPositions: targets,
  side: side,                                   // chore: pass side 'A' or 'B'
}));
```

> `side` variable 已是 addSide closure parameter（既 line 2243）— 直接用。

**Commit 2**: `feat(chore): attack avatar side-aware clash position + facing flip (A centre-left right-facing, B centre-right left-facing)`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts`（imports + AttackOptions side + avatar Sprite + centerX 計算 + scale 加 facing flip）
- `src/screens/BattleScreen.ts`（addSide closure 內 attackTimeline call 加 side: side）

**禁止**：
- 動 PERSONALITIES table / DEFAULT_PERSONALITY
- 動 8 個 _sigXxx signature 內部邏輯（保留所有特效）
- 動 SpiritPortrait component（其他地方仍用）
- 動 SlotEngine / WayHit / hitCells / damage / coin
- 動 chore #161/#165 activeAttackers/activeDefenders filter 邏輯
- 加新 asset
- 改 SPEC.md / DesignTokens / sim-rtp.mjs / main.ts
- 動 ResultScreen / DraftScreen

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 單側 attack：發動攻擊的 spirit **整隻全身** sprite 從 formation 移到中央偏己側（A 偏左 / B 偏右）→ 信號攻擊射出 → 退回原位
   - 雙側都 attack：A 側 spirit 移到 centerX-70 + B 側 spirit 移到 centerX+70 → **兩隻面對面**（A 朝右 / B 朝左）→ 各自施展信號特效對對方 → 退回
   - 無圓頭像殘留（任何 attack 動畫都沒有圓圈）
   - 8 個 signature 特效仍 visible（lightning-xcross / triple-dash / dual-fireball 等）
   - DevTools FPS：attack 動畫期間 ≥ 50（兩隻 sprite 比一個 round portrait 重，但 quality 2 應 OK）
   - 無 console error
5. 截圖 1-2 張：單側 attack 中 + 雙側 clash 中（如果 demo 容易觸發）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- CLASH_OFFSET 70px 距離是否合適（or 100/50？）
- height 120px sprite 是否合適 vs formation spirit 大小
- 雙側 clash 視覺是否清楚（mirror flip 看得出 facing 差別嗎）
- 8 個 signature 在新 sprite 起點仍正常嗎
- Spec deviations：預期 0
