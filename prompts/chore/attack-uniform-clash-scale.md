# Chore — Attack 中央統一大小（無論上下排，clash 時 spirit 一樣大）

## 1. Context

當前 chore #182/#183 attack 動畫從 formation 的 base scale 出發（chore #181 SLOT_TO_POS_SPEC 漸層 0.85-1.10），攻擊期間直接 multiply phase factor。

問題：
- Slot 0 (back, scale 0.85) 攻擊：center peak = 0.85 × 1.30 = **1.105**
- Slot 4 (front, scale 1.10) 攻擊：center peak = 1.10 × 1.30 = **1.430**

→ 後排 spirit 攻擊看起來明顯比前排小，視覺不一致。

### Owner spec 2026-05-04
> 「無論下排或上排的角色移動到中央攻擊的時候都是一樣大的」

→ **中央 clash 時統一大小**（如 CLASH_SCALE = 1.0），不論來自哪個 slot。Phase 5 return 時再 scale 回原 slot 大小。

實作：
- Phase 1 (prepare at origin): 用 origAbsScale (slot base) — 不變
- Phase 2 (leap to centre): scale **lerp** from origAbsScale → CLASH_SCALE
- Phase 3-4 (hold + fire at centre): 用 CLASH_SCALE × phase factor
- Phase 5 (return): scale **lerp** from CLASH_SCALE → origAbsScale
- 結束 restore origScaleX/Y（不變）

純視覺改動 — 不動 chore #181 formation scale / chore #182 spiritContainer pattern / chore #183 baseSign 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 沿用既有 baseSign + origScaleX/Y restore pattern

---

## 2. Spec drift check (P6)

1. 確認 chore #181 SLOT_TO_POS_SPEC scale gradient 0.85-1.10 仍存在（formation 視覺保留）
2. 確認 chore #182 spiritContainer pattern + origScaleX/Y restore 仍正確
3. 確認 chore #183 baseSign = Math.sign(origScaleX) 仍是 facing 控制

---

## 3. Task

### Single commit — Uniform clash scale

`src/screens/SpiritAttackChoreographer.ts` `attackTimeline` 內 Phase 2-5 改用 CLASH_SCALE：

#### 3a. 加新 const

attackTimeline 開頭（既有 `const origAbsScale` 之後）加：
```ts
// chore #194: uniform scale at clash centre (was multiplied with origAbsScale 0.85-1.10
// so back-row attacks looked smaller than front-row)
const CLASH_SCALE = 1.0;
```

#### 3b. Phase 1 prepare — 不變

```ts
// Phase 1: scale up from base (origin position, slot's base scale)
await tween(D.prepare, p => {
  const s = origAbsScale * (1.0 + Easings.easeOut(p) * 0.20);
  avatar.scale.set(baseSign * s, s);
});
```

#### 3c. Phase 2 leap — lerp scale from origAbsScale → CLASH_SCALE

當前：
```ts
await tween(D.leap, p => {
  const ep = Easings.easeInOut(p);
  avatar.x = origX + (centerX - origX) * ep;
  // ...
  const s = origAbsScale * (1.20 + ep * 0.10);
  avatar.scale.set(baseSign * s, s);
});
```

改成：
```ts
await tween(D.leap, p => {
  const ep = Easings.easeInOut(p);
  avatar.x = origX + (centerX - origX) * ep;
  // ...
  // chore #194: scale lerps from origAbsScale (origin) → CLASH_SCALE (centre) during leap
  const factor = 1.20 + ep * 0.10;   // existing phase factor
  const sBase = origAbsScale + (CLASH_SCALE - origAbsScale) * ep;
  const s = sBase * factor;
  avatar.scale.set(baseSign * s, s);
});
```

#### 3d. Phase 3 hold — uniform CLASH_SCALE

當前：
```ts
await tween(D.hold, p => {
  const s = origAbsScale * (1.30 + Math.sin(p * Math.PI * 5) * 0.04);
  avatar.scale.set(baseSign * s, s);
});
avatar.scale.set(baseSign * origAbsScale * 1.30, origAbsScale * 1.30);
```

改成：
```ts
await tween(D.hold, p => {
  // chore #194: CLASH_SCALE base (uniform across all slots)
  const s = CLASH_SCALE * (1.30 + Math.sin(p * Math.PI * 5) * 0.04);
  avatar.scale.set(baseSign * s, s);
});
avatar.scale.set(baseSign * CLASH_SCALE * 1.30, CLASH_SCALE * 1.30);
```

#### 3e. Phase 4 fire — 不變（內部 ctx.avatar 已是 CLASH_SCALE 狀態）

Phase 4 signature fx 從 `ctx.avatar` 取座標，scale 由 Phase 3 settle 設過，不改。

#### 3f. Phase 5 return — lerp scale from CLASH_SCALE → origAbsScale

當前：
```ts
await tween(D.return, p => {
  const ep = Easings.easeOut(p);
  avatar.x = centerX + (origX - centerX) * ep;
  avatar.y = centerY + (origY - centerY) * ep;
  const s = origAbsScale * (1.30 - ep * 0.30);   // 1.30 → 1.0 multiplier
  avatar.scale.set(baseSign * s, s);
});
```

改成：
```ts
await tween(D.return, p => {
  const ep = Easings.easeOut(p);
  avatar.x = centerX + (origX - centerX) * ep;
  avatar.y = centerY + (origY - centerY) * ep;
  // chore #194: scale lerp from CLASH_SCALE (centre) → origAbsScale (origin slot)
  const factor = 1.30 - ep * 0.30;   // 1.30 → 1.0
  const sBase = CLASH_SCALE + (origAbsScale - CLASH_SCALE) * ep;
  const s = sBase * factor;
  avatar.scale.set(baseSign * s, s);
});
```

#### 3g. Restore — 不變

最後 `avatar.scale.set(origScaleX, origScaleY)` 仍 restore 原 sign + base scale。chore #182 邏輯保留。

**Commit**: `feat(chore): attack uniform clash scale — back-row + front-row spirits same size at centre (lerp via Phase 2 + Phase 5)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts`（attackTimeline Phase 2/3/5 scale 計算 + new CLASH_SCALE const）

**禁止**：
- 動 chore #181 SLOT_TO_POS_SPEC formation scale
- 動 chore #182 spiritContainer / origScaleX-Y save-restore
- 動 chore #183 baseSign facing 邏輯
- 動 chore #185 onFireImpact / spawnHitBurst / defenderHitReact
- 動 PERSONALITIES / 8 signatures
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL（PR or direct master）
4. **Pre-merge audit**：
   - `grep "CLASH_SCALE" src/screens/SpiritAttackChoreographer.ts` — 應有 1 const + 4-5 use
   - 確認 origScaleX/Y restore 仍在 attackTimeline 結尾
5. **Preview 驗證 critical**：
   - 後排 spirit (slot 0/2/4 outer or 1/3 inner) 攻擊：移到中央時**大小跟前排攻擊時一樣**
   - Phase 1 prepare 仍用 slot base scale (back smaller / front larger) — 還沒移動
   - Phase 5 return 動畫過程中 spirit 縮回 slot base size
   - 結束後 spirit 在 formation 仍是原 base size
   - 8 signature fx 視覺仍正常
   - chore #185 hit reaction (burst + popDamage) 不受影響

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（後排 + 前排攻擊時中央大小對比）
- CLASH_SCALE 1.0 是否合適（or 1.1 較大 / 0.95 較含蓄）
- Phase 2 leap 過程 lerp 視覺是否自然（or 突兀）
- Spec deviations：預期 0
