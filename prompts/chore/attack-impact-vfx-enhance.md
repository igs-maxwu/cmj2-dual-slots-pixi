# Chore — Attack 衝擊感 4 大強化（A 受擊反應 + B 命中爆炸 + C 傷害數字升級 + G 同步 timing）

## 1. Context

Owner 試玩 chore #183 後反映：attack「中間後表演不夠明顯」。

當前流程：
1. Spirit 飛中央
2. Phase 4 signature fx (slash / lightning / etc)
3. Spirit 返回 formation
4. **完成後** popDamage 紅字浮起、HP bar 更新

問題：受擊跟攻擊**串聯**，視覺上分離 → 「打中」感弱。

### 4 個強化（owner 確認 ABCG）

| 代號 | 增強 | 視覺 |
|---|---|---|
| **A** | Defender 受擊反應 | 被擊 spirit container shake ±6px + 紅色 tint flash 250ms |
| **B** | Hit-impact burst | 每 target 中心放射狀爆炸（中心圓 + 12 條 ray + scale 0→1.5 + fade 180ms）|
| **C** | Damage number 升級 | 26→34pt + 雙描邊 + scale punch 1.0→1.5→1.0 + 動畫 600→800ms |
| **G** | 同步 timing | popDamage + B + A 全在 **Phase 4 fire 開始瞬間並行**（不再等 attackTimeline 結束）|

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（API + helpers / popDamage upgrade / wire-up sync timing）
- **`source-driven-development`** — 沿用既有 `popDamage` / `spawnWinBurst` / `fxLayer` 結構，不發明新 layer

---

## 2. Spec drift check (P6) + Pre-merge audit checklist

### Spec drift
1. 確認 `attackTimeline` AttackOptions 結構 (chore #182 後 spiritContainer pattern)
2. 確認 BattleScreen `popDamage(side, slotIndex, amount)` line ~2501
3. 確認 BattleScreen `playAttackAnimations.addSide` 內部 `events` 流程（grep `events.map(e => this.popDamage` 找）
4. 確認 chore #181 SLOT_TO_POS_SPEC scale gradient 仍套（target position via slotToArenaPos）

### Pre-merge audit
- [ ] AttackOptions 加 `onFireImpact?: () => void` 不破壞既有 caller（FXPreviewScreen / FXDevHook 不傳 = optional）
- [ ] attackTimeline Phase 4 開始 invoke onFireImpact 一次
- [ ] BattleScreen onFireImpact callback 內部不 throw（保護 attackTimeline 不被打斷）
- [ ] popDamage 改 34pt + scale punch — chore 紅字仍顯示在 target slot 中心
- [ ] defenderHitReact 結束 restore container x + tint clear（不影響 chore #163 HP bar / chore #181 zigzag scale）
- [ ] B hit burst 用 `this.fxLayer` 不污染其他 container

---

## 3. Task

### 3a. Commit 1 — AttackOptions 加 onFireImpact + 新 helper spawnHitBurst

#### 3a-1. AttackOptions

`src/screens/SpiritAttackChoreographer.ts`：

當前：
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
}
```

加：
```ts
export interface AttackOptions {
  // ... existing fields ...
  /** chore: called once at the start of Phase 4 (fire) — caller spawns hit reactions */
  onFireImpact?: () => void;
}
```

#### 3a-2. attackTimeline Phase 4 invoke callback

當前 line ~196-218（Phase 4 dispatch）：
```ts
// Phase 4: Fire — dispatch on signature
const ctx: Phase4Ctx = {
  stage, avatar, centerX, centerY,
  targets: targetPositions,
  color: particleColor,
  duration: D.fire,
  shakeIntensity,
};

switch (personality.signature) {
  // 8 signature cases...
}
```

改成：
```ts
// chore: notify caller to spawn hit reactions concurrent with signature fx
try {
  opts.onFireImpact?.();
} catch (err) {
  if (import.meta.env.DEV) console.warn('[attackTimeline] onFireImpact threw', err);
}

// Phase 4: Fire — dispatch on signature
const ctx: Phase4Ctx = { ... };
switch (personality.signature) { ... }
```

#### 3a-3. spawnHitBurst helper

新 helper（在 SpiritAttackChoreographer.ts 內或 BattleScreen — 推薦 BattleScreen 跟 popDamage 同位置）：

```ts
/**
 * chore #185-B: Radial impact burst at target position (centre circle + 12 rays).
 * 180ms scale 0→1.5 + alpha 1→0. Uses fxLayer.
 */
private spawnHitBurst(x: number, y: number, color: number): void {
  const burst = new Graphics();
  // Centre filled circle
  burst.circle(0, 0, 16).fill({ color, alpha: 0.9 });
  // 12 radial rays
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    burst.moveTo(0, 0)
      .lineTo(Math.cos(a) * 32, Math.sin(a) * 32)
      .stroke({ width: 4, color, alpha: 0.85 });
  }
  burst.x = x;
  burst.y = y;
  burst.alpha = 1;
  burst.scale.set(0);
  this.fxLayer.addChild(burst);

  void tween(180, p => {
    burst.alpha = 1 - p;
    burst.scale.set(p * 1.5);
  }, Easings.easeOut).then(() => burst.destroy());
}
```

#### 3a-4. defenderHitReact helper

```ts
/**
 * chore #185-A: Defender shake + red tint flash 250ms.
 * Shake container x by ±6px sine; tint via temp red overlay Graphics.
 */
private defenderHitReact(side: 'A' | 'B', slotIndex: number): void {
  const cells = side === 'A' ? this.cellsA : this.cellsB;
  const ref = cells[slotIndex];
  if (!ref) return;
  const c = ref.container;
  const origX = c.x;

  // Red overlay (sized to cover sprite area, anchored at sprite feet)
  const overlay = new Graphics()
    .rect(-CELL_SIZE_FOR_OVERLAY / 2, -SPIRIT_H, CELL_SIZE_FOR_OVERLAY, SPIRIT_H)
    .fill({ color: 0xff3030, alpha: 0.55 });
  // Match container's child sprite if exists for proper scale
  c.addChild(overlay);

  // Shake + tint fade in parallel
  void tween(250, p => {
    // Shake decay sine
    const shakeAmp = 6 * (1 - p);
    c.x = origX + Math.sin(p * Math.PI * 6) * shakeAmp;
    overlay.alpha = 0.55 * (1 - p);
  }, Easings.easeOut).then(() => {
    c.x = origX;
    overlay.destroy();
  });
}
```

> **Note**：`CELL_SIZE_FOR_OVERLAY` 數值看 chore #181 各 slot scale，建議用 80（NINE_CELL_SIZE）* SPIRIT_H 涵蓋大多 case。Executor 視覺微調。

> **Caveat**：tint 用 overlay Graphics 實作（不用 sprite.tint）— 因為 spiritContainer 內的 sprite 可能 scale.x 是負值（chore drawFormation A flip），sprite.tint 不會看起來奇怪，但 overlay 跟著 container scale 自動 OK。

**Commit 1**: `feat(chore): attackTimeline onFireImpact callback + spawnHitBurst + defenderHitReact helpers`

---

### 3b. Commit 2 — popDamage 升級（C）

`BattleScreen.ts` `popDamage` (line ~2501-2526)：

當前：
```ts
private async popDamage(side: 'A' | 'B', slotIndex: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  const pos = this.slotToArenaPos(side, slotIndex);
  const cx = pos.x;
  const cy = pos.y - SPIRIT_H / 2;

  const txt = new Text({
    text: `-${amount}`,
    style: {
      fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.xl,
      fill: T.CTA.red, stroke: { color: 0x000, width: 4 },
    },
  });
  txt.anchor.set(0.5, 0.5);
  txt.x = cx; txt.y = cy;
  this.fxLayer.addChild(txt);

  await tween(600, p => {
    txt.y = cy - p * 60;
    txt.alpha = 1 - Math.max(0, (p - 0.4) / 0.6);
    txt.scale.set(1 + p * 0.2);
  }, Easings.easeOut);

  txt.destroy();
}
```

改成：
```ts
private async popDamage(side: 'A' | 'B', slotIndex: number, amount: number): Promise<void> {
  if (amount <= 0) return;
  const pos = this.slotToArenaPos(side, slotIndex);
  const cx = pos.x;
  const cy = pos.y - SPIRIT_H / 2;

  // chore #185-C: bigger + double-stroke + scale punch
  const txt = new Text({
    text: `-${amount}`,
    style: {
      fontFamily: T.FONT.num, fontWeight: '700',
      fontSize: 34,                                              // was T.FONT_SIZE.xl ~22-26
      fill: T.CTA.red,
      stroke: { color: 0x000, width: 5 },                        // thicker outline
      dropShadow: {
        color: 0x000000, alpha: 0.7, blur: 6, distance: 2,       // dropshadow for legibility
      },
    },
  });
  txt.anchor.set(0.5, 0.5);
  txt.x = cx; txt.y = cy;
  txt.scale.set(0);                                              // start scale 0
  this.fxLayer.addChild(txt);

  // Stage 1 (0-200ms): scale punch 0 → 1.5 (overshoot)
  await tween(200, p => {
    txt.scale.set(p * 1.5);
    txt.y = cy - p * 12;                                         // small initial rise
  }, Easings.easeOut);

  // Stage 2 (200-400ms): scale 1.5 → 1.0 (settle)
  await tween(200, p => {
    txt.scale.set(1.5 - p * 0.5);
  }, Easings.easeOut);

  // Stage 3 (400-800ms): float up + fade
  await tween(400, p => {
    txt.y = (cy - 12) - p * 60;                                  // continued rise
    txt.alpha = 1 - p;
  }, Easings.easeIn);

  txt.destroy();
}
```

> 總長 800ms (was 600ms)。視覺上更顯眼 + scale punch 撞擊感。

**Commit 2**: `tune(chore): popDamage upgrade — 34pt double-stroke + scale punch 0→1.5→1.0 + 800ms duration`

---

### 3c. Commit 3 — Wire-up onFireImpact (sync timing G)

#### 3c-1. BattleScreen `addSide` 預先計算 hit info

`playAttackAnimations` `addSide` closure（line ~2240+ of BattleScreen.ts），需要在 attackTimeline call 前準備 hit reaction info。

關鍵：當前 `events` 是 outer scope（playAttackAnimations 結束後 caller 跑 popDamage）。需要 mid-flow 拿到 attacker 對應的 events subset。

**簡化策略**：onFireImpact callback 內**直接遍歷 attackerCells / defenderCells + 觸發 burst + react**（不等 distributeDamage events，因為 react 是視覺，可以基於 attack target 發）：

```ts
// 在 addSide 內，attackTimeline call 前準備 hit info：
const targetSlots = defenderCells
  .map((_, i) => activeDefenders[i]?.alive ? i : -1)
  .filter(i => i >= 0)
  .slice(0, 3);
const targetSide = side === 'A' ? 'B' : 'A';   // attacker side opposite

animations.push(attackTimeline({
  stage:           this.container,
  spiritContainer: attackerCells[slot].container,
  symbolId:        bestDrafted.symbolId,
  spiritKey:       SYMBOLS[bestDrafted.symbolId].spiritKey,
  targetPositions: targets,
  side,
  // chore #185-G: hit reactions fire concurrent with Phase 4 signature fx
  onFireImpact: () => {
    const color = SYMBOLS[bestDrafted.symbolId].color;
    targets.forEach((tp, i) => {
      this.spawnHitBurst(tp.x, tp.y, color);
      const targetSlot = targetSlots[i];
      if (targetSlot !== undefined) {
        this.defenderHitReact(targetSide, targetSlot);
      }
    });
  },
}));
```

> **Important**：onFireImpact 內不 await — 全 fire-and-forget。spawnHitBurst / defenderHitReact 自 destroy。

> **popDamage 移到 onFireImpact**？  
> 當前 popDamage 在 outer flow（events.map 之後）執行。Owner 期望 G「同步」即「打中→傷害數字 一氣呵成」。
> Option：移 popDamage call 到 onFireImpact 也可，但需小心 amount 來源（events 可能還沒算完）。
> **保守做法**：保留 outer popDamage call，**onFireImpact 只觸發 burst + defenderHitReact**。視覺上 popDamage 仍會在 attackTimeline 後幾百 ms 出現，跟 hit react 略 stagger 但 close enough — 接受。
> **激進做法**：將 popDamage 也搬進 onFireImpact，需先計 expected dmg per target。看 executor 視覺 trial 結果決定。

#### 3c-2. mercenaryHits 同樣套（既有有 multiple targets）

`mercenaryWeakFx` call 後也加 `spawnHitBurst` + `defenderHitReact`（per target）。具體 look 既有 mercenaryHits 邏輯適配。

**Commit 3**: `feat(chore): wire onFireImpact in addSide — spawnHitBurst + defenderHitReact concurrent with signature fx`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts`（AttackOptions onFireImpact + Phase 4 invoke）
- `src/screens/BattleScreen.ts`（spawnHitBurst + defenderHitReact + popDamage upgrade + addSide wire-up）

**禁止**：
- 動 chore #181/#182/#183 attack avatar / formation / faceDir 結構
- 動 PERSONALITIES / 8 signatures 內部
- 動 SlotEngine / WayHit / SymbolsConfig / DamageDistributor
- 動 chore #161/#165 activeUnits filter
- 動 chore #163 HP bar offset
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "onFireImpact" src/` — 應在 AttackOptions / attackTimeline / BattleScreen.addSide 三處
   - `grep "spawnHitBurst\|defenderHitReact" src/` — 應在 BattleScreen 3-4 處
   - 試玩 5 attack 確認所有 hook 觸發
5. **Preview 驗證 critical**：
   - **A**: 被擊 spirit shake ±6px + 紅色閃過 250ms
   - **B**: target 中央放射狀黃光爆炸 180ms
   - **C**: 「-N」紅字 34pt punch 跳出 800ms（明顯比之前大）
   - **G**: 受擊 + burst 跟 signature fx **同時** 發生（不再串聯延遲）
   - chore #181/#182/#183 attack avatar 流程仍正常
   - 8 signature fx 仍正常射出
   - 無 console error
5. 截圖 1 張：Phase 4 fire 瞬間（含 attacker 出招 + target 紅閃 + burst + 紅字）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 受擊反應（A 250ms / B 180ms / C 800ms）三者 timing 是否合適
- popDamage 從 600 → 800ms 是否拖太長（or 大小 34pt 太大?）
- onFireImpact callback 是否成功 sync（無 race / leak）
- 是否考慮把 popDamage 也搬進 onFireImpact（owner 試玩反饋為準）
- Spec deviations：預期 0
