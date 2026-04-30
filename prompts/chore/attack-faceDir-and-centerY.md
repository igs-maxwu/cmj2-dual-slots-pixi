# Chore — Attack 雙修：移除 faceDir double-flip + centerY 提高

## 1. Context

Owner 試玩 chore #182 後反映 2 issue：

### Issue 1：A side attacker 面向錯誤

A 在 clash 中央朝左（背對 B）/ B 朝左（面對 A 正確）。

**Root cause**：drawFormation line 967：
```ts
if (side === 'A') sprite.scale.x *= -1;   // sprite 子物件已 flip
```

drawFormation 只翻 **sprite 子物件**，container 本身 scale.x 仍正。

chore #182 attackTimeline line 167：
```ts
const faceDir = side === 'A' ? -1 : 1;
// ...
avatar.scale.set(faceDir * s, s);   // 翻 container
```

A 攻擊時：
- Container scale.x 從 +0.85 → -0.85（faceDir 翻）
- Sprite scale.x 仍 -1（drawFormation 留下）
- **Container × Sprite = (-) × (-) = (+)**  → sprite 渲染**取消翻轉** → 朝向左（native）→ A 朝左 ❌

B 攻擊時：
- Container scale.x = +0.85（faceDir = +1，無變）
- Sprite scale.x = +1（B 沒被 flip）
- **(+) × (+) = (+)** → sprite 朝左 → B 朝左 ✓

### Fix（issue 1）
移除 faceDir 邏輯。Container scale.x 維持 origScaleX sign（保留原 formation orientation）。Sprite child 的 flip（drawFormation 既有）會自然決定面向。

```ts
// 之前 (chore #179/182):
const faceDir = side === 'A' ? -1 : 1;
avatar.scale.set(faceDir * s, s);

// 之後 (chore #183):
const baseSign = Math.sign(origScaleX) || 1;
avatar.scale.set(baseSign * s, s);   // 保留 container 原 sign
```

### Issue 2：attacker 站位太低

當前 chore #178：
```ts
const centerY = Math.round(CANVAS_HEIGHT * 0.42);   // 1280×0.42 = 538
```

但 chore #181 formation 範圍：
- row 0 (back) y = 320
- row 4 (front) y = 520
- VS badge y = 415

centerY=538 比最前排 spirit 的 y=520 還低 → attacker 看起來在 floor 下方。

### Fix（issue 2）
調 centerY 到 formation 中間 / VS badge 同高度：
```ts
const centerY = 420;   // mid-formation, near VS badge (415)
```

機制零改動 — 純視覺 / 動畫修正。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit（兩個小 fix 合併，因為都在同 function）
- **`source-driven-development`** — 確認 drawFormation 既有 sprite.scale.x flip 邏輯保留

---

## 2. Spec drift check (P6) + Pre-merge audit checklist

### Spec drift
1. 確認 chore #182 spiritContainer animation pattern (saves+restores origScaleX/Y)
2. 確認 drawFormation L967 仍 flip A side sprite child（不變）
3. 確認 chore #181 SLOT_TO_POS_SPEC scales 0.85-1.10 仍套到 container.scale (positive)

### Pre-merge audit
- [ ] 移除 faceDir const + 替換為 baseSign = sign(origScaleX)
- [ ] 5 phases scale.set 全用 baseSign（不再 faceDir）
- [ ] centerY 從 538 → 420（比 VS badge 415 略低）
- [ ] origScaleX 仍正常 save/restore（chore #182 保留）
- [ ] 不動 drawFormation L967 sprite child flip 邏輯
- [ ] Single-side attack 也應正常（avatar 移到該側 clash zone）

---

## 3. Task

### Single commit — Fix faceDir + centerY

`src/screens/SpiritAttackChoreographer.ts`：

#### 3a. centerY 調整

當前 line 144（chore #178/179/182 區）：
```ts
const centerY = Math.round(CANVAS_HEIGHT * 0.42);   // 1280×0.42 = 538
```

改成：
```ts
// chore: raise centerY to mid-formation (near VS badge y=415, was 538 = below front row)
const centerY = 420;
```

#### 3b. faceDir → baseSign

當前 line ~167-168：
```ts
// NOTE: spirit .webp assets face LEFT natively (chibi art convention).
// A (centre-left)  needs scale.x=-1 to flip right (toward B).
// B (centre-right) keeps scale.x=+1 (native left-facing, toward A).
const faceDir = side === 'A' ? -1 : 1;
```

改成：
```ts
// chore: drawFormation already flips A side sprite child (BattleScreen L967 sprite.scale.x*=-1).
// Container scale.x is uniform positive; preserving its original sign during attack
// keeps formation's pre-oriented facing intact (A's sprite already faces right toward B).
// (Previous faceDir A:-1 caused double-flip with sprite child → A appeared facing left.)
const baseSign = Math.sign(origScaleX) || 1;
```

#### 3c. 5 phases scale.set 替換

全部 `faceDir * s` 改為 `baseSign * s`：

```ts
// Phase 1
avatar.scale.set(baseSign * s, s);

// Phase 2 (in tween)
avatar.scale.set(baseSign * s, s);

// Phase 3 (in tween)
avatar.scale.set(baseSign * s, s);

// Phase 3 settle
avatar.scale.set(baseSign * origAbsScale * 1.30, origAbsScale * 1.30);

// Phase 5 return (in tween)
avatar.scale.set(baseSign * s, s);
```

> **注意**：chore #182 結束時 `avatar.scale.set(origScaleX, origScaleY)` restore — origScaleX 保留 sign，所以 restore OK，**這行不變**。

#### 3d. 變數名替換

舊 `side` const 仍保留（給 centerX 計算用），但不再被 faceDir 用。檢查不會 break。

**Commit**: `fix(chore): attack baseSign replaces faceDir (drawFormation sprite child already flips A) + centerY 538→420`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts`（centerY const + faceDir→baseSign + 5 phase scale.set 替換）

**禁止**：
- 動 drawFormation L967 sprite child flip 邏輯
- 動 chore #181/#182 結構（SLOT_TO_POS_SPEC / spiritContainer pattern）
- 動 chore #178 Container wrap pattern（仍套用，spiritContainer 接續）
- 動 BattleScreen / FXPreviewScreen / FXDevHook（API 不變）
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "faceDir" src/screens/SpiritAttackChoreographer.ts` — 應 0 hits
   - `grep "baseSign" src/screens/SpiritAttackChoreographer.ts` — 應有 1 const + 5 phase use
5. **Preview 驗證 critical**：
   - A side attack：spirit 朝**右**（朝 B 方向）面向正確 ✓
   - B side attack：spirit 朝**左**（朝 A 方向）保持原向 ✓
   - 雙側 clash：兩 spirit **面對面**
   - centerY = 420 視覺上 attacker 在 formation 中段（不在 floor 下方）
   - chore #182 spirit-from-formation 流程仍正確（無 clone）
   - Spirit 攻擊完回原位 + scale 完整 restore
   - 8 signature fx 仍正常
5. 截圖 1 張：clash 中（A 朝右 / B 朝左 + 高度合適）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 雙側 clash 兩 spirit 面對面確認
- centerY=420 視覺感受（or 需要 410 / 430 微調）
- Spec deviations：預期 0
- **Audit lessons**：
  - 多重 scale.x flip 來源（container + child sprite）需審慎結合，不可 blind multiply
  - Pre-merge review process 第 3 次 saga（chore #177→#178→#179→#183 attack avatar 系列）
