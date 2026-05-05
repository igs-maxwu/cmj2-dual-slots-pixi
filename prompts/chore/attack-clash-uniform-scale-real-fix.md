# Chore #210 — 攻擊到中央 clash 真正等大（chore #194 是 no-op，本 chore 真正修）

## 1. Context

Owner 試玩 2026-05-05 反映：「現在好像到中間打的又不一樣大了」。

### 為什麼 chore #194 沒效果（no-op 分析）

chore #194（commit ff6061a）目標：「無論下排或上排的角色移動到中央攻擊時都是一樣大的」。實作方式：
- 在 `SpiritAttackChoreographer.ts` 加 `CLASH_SCALE = 1.0`
- Phase 2/5 lerp `origAbsScale → CLASH_SCALE`
- Phase 3 hold 用 `CLASH_SCALE × 1.30`

**問題**：
1. `origAbsScale = Math.abs(avatar.scale.x) || 1.0` — `avatar` 是 formation cell **container**
2. `drawFormation` 從未設 `container.scale`（[BattleScreen.ts:955-959](src/screens/BattleScreen.ts#L955)）→ container.scale.x **永遠 = 1.0**
3. depth scale (0.85 / 0.91 / 0.97 / 1.04 / 1.10) 是設在 **sprite child**：`sprite.scale.set(baseScale * pos.scale)` ([BattleScreen.ts:979](src/screens/BattleScreen.ts#L979))
4. choreographer Phase 3 設 `avatar.scale = CLASH_SCALE × 1.30 = 1.30`，但 sprite child 仍是 `baseScale × pos.scale`
5. 最終視覺 = container.scale × sprite.scale = 1.30 × baseScale × **pos.scale**

→ 後排 (pos.scale 0.85): 1.30 × baseScale × 0.85 = 1.105 × baseScale
→ 前排 (pos.scale 1.10): 1.30 × baseScale × 1.10 = 1.430 × baseScale
→ **前排 clash 視覺仍比後排大 29%** ← 跟 chore #194 之前完全一樣

chore #194 的 `origAbsScale → CLASH_SCALE` lerp 在 container 層面 (1.0 → 1.0) 是 identity 變換，根本 no-op。

### Fix 思路

要在 clash 時讓 `effective scale = container.scale × sprite.scale = K`（常數），需要 container.scale 反向補償 sprite 的 pos.scale：
```
container.scale = K_target / pos.scale
```
這樣 effective = (K_target / pos.scale) × (baseScale × pos.scale) = **K_target × baseScale**（pos.scale 抵消）

baseScale 仍會有紋理長寬比 (max(tex.width, tex.height)) 的變化，但那是紋理本身差異，不在本 chore 範疇。本 chore 只解決 depth 5-row 0.85-1.10 帶來的 clash 大小差。

純視覺 fix — 不動 personality / signature / phase 4 fire / damage 結構。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 改 SpiritAttackChoreographer.AttackOptions + Phase 2/3/5 公式

---

## 2. Spec drift check (P6)

1. 確認 `drawFormation` line 955-985 — container.scale 未設 / sprite.scale = baseScale × pos.scale
2. 確認 `slotToArenaPos` line 1027-1038 回傳 `{ x, y, row, scale }` — `scale` 即 pos.scale (0.85-1.10)
3. 確認 `SpiritAttackChoreographer.attackTimeline` line 135 接 AttackOptions
4. 確認 line 156-163 origAbsScale + CLASH_SCALE 已存在
5. 確認 line 2318 BattleScreen call attackTimeline 的呼叫點

---

## 3. Task

### Single commit — Real clash uniform scale fix

#### 3a. AttackOptions 加 `posScale` param

`src/screens/SpiritAttackChoreographer.ts` AttackOptions interface (line 122)：

```ts
export interface AttackOptions {
  stage:           Container;
  spiritContainer: Container;
  symbolId:        number;
  spiritKey:       string;
  targetPositions: { x: number; y: number }[];
  particleColor?:  number;
  shakeIntensity?: number;
  side?: 'A' | 'B';
  /** chore #210: depth scale (0.85-1.10) of formation slot — used to compensate sprite child scale at clash */
  posScale?: number;
  onFireImpact?: () => void;
}
```

#### 3b. attackTimeline 用 posScale 計算補償

`src/screens/SpiritAttackChoreographer.ts` line 156-163 區塊：

當前：
```ts
const origScaleX = avatar.scale.x;
const origScaleY = avatar.scale.y;
const origZIndex = avatar.zIndex;
const origAbsScale = Math.abs(origScaleX) || 1.0;
const CLASH_SCALE = 1.0;
```

改成：
```ts
const origScaleX = avatar.scale.x;
const origScaleY = avatar.scale.y;
const origZIndex = avatar.zIndex;
const origAbsScale = Math.abs(origScaleX) || 1.0;

// chore #210 real fix: compensate for sprite child's depth pos.scale (0.85-1.10).
// drawFormation sets sprite.scale = baseScale × pos.scale on the SPRITE CHILD,
// while container.scale stays 1.0. To make effective visual size uniform at clash,
// container.scale must inversely compensate posScale so:
//   effective = container.scale × sprite.scale = (CLASH_SCALE / posScale) × (baseScale × posScale)
//             = CLASH_SCALE × baseScale  ← uniform across slots
// chore #194 was no-op because it operated on container scale (always 1.0).
const posScale = opts.posScale ?? 1.0;
const CLASH_SCALE = 1.0 / posScale;
```

#### 3c. Phase 2 leap — lerp 到補償後的 CLASH_SCALE

`src/screens/SpiritAttackChoreographer.ts` line 181-192：

當前邏輯保持不變（lerp `origAbsScale → CLASH_SCALE`）— 因為 CLASH_SCALE 已經 = 1.0/posScale，lerp 自動正確。**不需改 code**，只要 3b 的 const 改了，Phase 2 自動 work。

#### 3d. Phase 3 hold + Phase 5 return — 同上 自動 work

Phase 3 line 196-201：`CLASH_SCALE × 1.30` 自動變成 `(1.0/posScale) × 1.30`。
Phase 5 line 240-242：`CLASH_SCALE → origAbsScale` lerp 自動正確。

→ **Phase 2/3/5 的 code 不動**，只動 const 定義。

#### 3e. BattleScreen 呼叫處傳 posScale

`src/screens/BattleScreen.ts` line 2318 attackTimeline call：

當前 — 缺 posScale。先確認附近 code 取得 attacker pos：

```ts
animations.push(attackTimeline({
  stage:           this.container,
  spiritContainer: attackerCells[slot].container,
  symbolId:        bestDrafted.symbolId,
  spiritKey:       SYMBOLS[bestDrafted.symbolId].spiritKey,
  targetPositions: targets,
  // ... existing fields ...
}));
```

改成（加 posScale）：
```ts
const attackerPos = this.slotToArenaPos(side, slot);
animations.push(attackTimeline({
  stage:           this.container,
  spiritContainer: attackerCells[slot].container,
  symbolId:        bestDrafted.symbolId,
  spiritKey:       SYMBOLS[bestDrafted.symbolId].spiritKey,
  targetPositions: targets,
  posScale:        attackerPos.scale,   // chore #210: depth scale (0.85-1.10) for clash compensation
  // ... existing fields ...
}));
```

> **注意**：`slot` 是 dense index 0-4，對應 SLOT_TO_POS_SPEC 的 5 個 slot。slotToArenaPos 接受這個 dense index 沒問題（已有 spec）。

#### 3f. 移除 chore #194 的 misleading 註解

`src/screens/SpiritAttackChoreographer.ts` line 161-163 + line 187 + line 196 + line 240：

把 chore #194 的「back-row + front-row same size」註解更新成 chore #210 真正等大（補償 posScale），避免將來 reader 又被誤導。建議：

```ts
// chore #210: clash uniform scale — container.scale = CLASH_SCALE/posScale compensates
// sprite child's baseScale × posScale, so effective visual = CLASH_SCALE × baseScale (uniform).
// Replaces chore #194 which was no-op (operated on container scale that was always 1.0).
```

**Commit**: `fix(chore): clash uniform scale REAL fix — container.scale compensates sprite child posScale (chore #194 was no-op operating on always-1.0 container scale)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` —
  - AttackOptions 加 `posScale?: number`
  - `CLASH_SCALE = 1.0 / posScale` (was 1.0)
  - 註解更新為 chore #210
- `src/screens/BattleScreen.ts` —
  - attackTimeline call 處加 `posScale: attackerPos.scale`

**禁止**：
- 動 personality / signature / Phase 4 fire dispatch
- 動 sprite child scale 直接 — 補償邏輯放在 container 層
- 動 drawFormation sprite.scale 設定（baseScale × pos.scale 邏輯保留）
- 動 slotToArenaPos 邏輯
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "posScale\|CLASH_SCALE" src/screens/SpiritAttackChoreographer.ts` — 應有 AttackOptions field + const + 公式
   - `grep "posScale" src/screens/BattleScreen.ts` — attackTimeline call 應傳 posScale
   - `grep "chore #194" src/screens/SpiritAttackChoreographer.ts` — 註解應更新為 #210（保留歷史 reference）
5. **Preview 驗證**：
   - 觸發 spin 看 attack animation
   - 後排 (slot 0, scale 0.85) 攻擊到中央 clash 視覺大小 ≈ 前排 (slot 4, scale 1.10) 攻擊到中央視覺大小
   - 不同 slot 的 attacker 在 Phase 3 hold 時應視覺等大（baseScale 紋理長寬比殘留差異除外，那不是本 chore 範疇）
   - Phase 5 return 仍能正確 lerp 回原 slot scale（不殘留 clash scale）
6. **Audit per chore #203 lesson**：grep 全 codebase 確認沒其他 attackTimeline call 漏 posScale

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 截圖（後排 vs 前排 attacker 在中央 clash phase 的對比 — 應視覺等大）
- spec deviations: 1 (chore #194 → chore #210 真正修)
- Process check：`git log --oneline origin/master | head -3` 確認 commit on master
