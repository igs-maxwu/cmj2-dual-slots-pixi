# Chore — defenderHitReact 改觸發於實際扣血 + 加強震動/紅閃

## 1. Context

Owner 試玩反映：「希望被打的角色扣血的時候可以震動一下然後閃紅色」。

### 現況分析

chore #185-A `defenderHitReact` 已實作（shake ±6px + 紅 tint 250ms），但：

1. **觸發點錯位**：在 `playAttackAnimations` Phase 4 onFireImpact 觸發，目標是 attack 預計打的 slots（front 3 alive defenders）
2. **實際扣血計算分離**：`distributeDamage` 算 dmg events 用不同邏輯（按 column 序 → 殺到前排再到後排）
3. → attack burst position 跟 actual dmg slot **可能不對應**
4. **效果太弱**：±6px shake + alpha 0.55 fade 250ms 視覺不明顯

### Fix
1. **重接觸發點**：`playDamageEvents` 內每個 dmg event 都觸發 defenderHitReact（跟 popDamage 同 timing）
2. **效果加強**：shake 6→10px / alpha 0.55→0.75 / duration 250→350ms
3. **保留** chore #185 原 onFireImpact 內的 burst（hit-impact burst 仍在 attack target 位置 — 那是視覺爆炸特效）

→ Net：受打 spirit **真實扣血時**才震動 + 紅閃，視覺對應正確。

純視覺 fix — 不動 distributeDamage / popDamage 結構。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用既有 defenderHitReact + sparseToDense map

---

## 2. Spec drift check (P6)

1. 確認 chore #185 `defenderHitReact` exists (line ~2635)
2. 確認 chore #185 `onFireImpact` callback 內 defenderHitReact call (line ~2334)
3. 確認 chore #188 `playDamageEvents` 含 sparseToDense map (line ~2456)

---

## 3. Task

### Single commit — Sync hit react with actual damage events + stronger effect

#### 3a. Bump effect strength

`src/screens/BattleScreen.ts` `defenderHitReact` (line 2635)：

當前：
```ts
private defenderHitReact(side: 'A' | 'B', slotIndex: number): void {
  // ...
  const overlay = new Graphics()
    .rect(-NINE_CELL_SIZE / 2, -SPIRIT_H, NINE_CELL_SIZE, SPIRIT_H)
    .fill({ color: 0xff3030, alpha: 0.55 });
  c.addChild(overlay);

  void tween(250, p => {
    const shakeAmp = 6 * (1 - p);
    c.x = origX + Math.sin(p * Math.PI * 6) * shakeAmp;
    overlay.alpha = 0.55 * (1 - p);
  }, Easings.easeOut).then(() => {
    c.x = origX;
    if (!overlay.destroyed) overlay.destroy();
  });
}
```

改成：
```ts
private defenderHitReact(side: 'A' | 'B', slotIndex: number): void {
  const cells = side === 'A' ? this.cellsA : this.cellsB;
  const ref = cells[slotIndex];
  if (!ref) return;
  const c = ref.container;
  const origX = c.x;

  // chore #208: stronger red overlay (was alpha 0.55 → 0.75)
  const overlay = new Graphics()
    .rect(-NINE_CELL_SIZE / 2, -SPIRIT_H, NINE_CELL_SIZE, SPIRIT_H)
    .fill({ color: 0xff2020, alpha: 0.75 });
  c.addChild(overlay);

  // chore #208: stronger shake amp 6→10 + longer duration 250→350ms
  void tween(350, p => {
    const shakeAmp = 10 * (1 - p);
    c.x = origX + Math.sin(p * Math.PI * 8) * shakeAmp;   // 6π → 8π (faster shake)
    overlay.alpha = 0.75 * (1 - p);
  }, Easings.easeOut).then(() => {
    c.x = origX;
    if (!overlay.destroyed) overlay.destroy();
  });
}
```

> **Why**：放大效果讓「扣血」感覺明顯。owner 試玩後可微調。

#### 3b. Trigger from playDamageEvents (per actual dmg)

`src/screens/BattleScreen.ts` `playDamageEvents` (line ~2456 area)：

當前：
```ts
private async playDamageEvents(events: DmgEvent[], targetSide: 'A' | 'B'): Promise<void> {
  // chore #188 sparseToDense map
  const formation = targetSide === 'A' ? this.formationA : this.formationB;
  const sparseToDense = new Map<number, number>();
  let denseIdx = 0;
  formation.forEach((u, i) => {
    if (u !== null) {
      sparseToDense.set(i, denseIdx);
      denseIdx++;
    }
  });

  const pops = events.map(e => {
    const dense = sparseToDense.get(e.slotIndex);
    if (dense === undefined) {
      if (import.meta.env.DEV) console.warn(`[BattleScreen] popDamage skipped`, e);
      return Promise.resolve();
    }
    return this.popDamage(targetSide, dense, e.damageTaken);
  });
  await Promise.all(pops);
}
```

改成（加 defenderHitReact per event）：
```ts
private async playDamageEvents(events: DmgEvent[], targetSide: 'A' | 'B'): Promise<void> {
  // chore #188 sparseToDense map
  const formation = targetSide === 'A' ? this.formationA : this.formationB;
  const sparseToDense = new Map<number, number>();
  let denseIdx = 0;
  formation.forEach((u, i) => {
    if (u !== null) {
      sparseToDense.set(i, denseIdx);
      denseIdx++;
    }
  });

  const pops = events.map(e => {
    const dense = sparseToDense.get(e.slotIndex);
    if (dense === undefined) {
      if (import.meta.env.DEV) console.warn(`[BattleScreen] popDamage skipped`, e);
      return Promise.resolve();
    }
    // chore #208: defender shake + red flash on actual damage (was: only at attack target slot)
    this.defenderHitReact(targetSide, dense);
    return this.popDamage(targetSide, dense, e.damageTaken);
  });
  await Promise.all(pops);
}
```

#### 3c. 移除 onFireImpact 內舊 defenderHitReact call?

當前 `addSide` onFireImpact (line ~2328)：
```ts
onFireImpact: () => {
  const color = SYMBOLS[bestDrafted.symbolId].color;
  targets.forEach((tp, i) => {
    this.spawnHitBurst(tp.x, tp.y, color);                  // Keep — visual burst at attack zone
    const targetSlot = targetSlots[i];
    if (targetSlot !== undefined) {
      this.defenderHitReact(targetSide, targetSlot);        // chore #208: REMOVE — now triggered by playDamageEvents
    }
  });
}
```

改成：
```ts
onFireImpact: () => {
  const color = SYMBOLS[bestDrafted.symbolId].color;
  targets.forEach((tp) => {
    // chore #208: keep burst at attack zone (cinematic), but remove defenderHitReact here
    // (now triggered per actual damage event in playDamageEvents)
    this.spawnHitBurst(tp.x, tp.y, color);
  });
}
```

> 移除 `targetSlots` 計算 + defenderHitReact call，保留 spawnHitBurst（attack 衝擊感）。

> **Trade-off**：之前 attack burst 跟 hit react 同時 fire 在 attack zone（可能 wrong slot）。chore #208 後 burst 仍 attack zone，react 在 actual dmg slot — 兩個動畫位置可能略不同，但 react 真的對到傷害角色。

**Commit**: `feat(chore): defender shake + red flash on actual damage event (was: only at attack target zone) + stronger effect (10px / 0.75 alpha / 350ms)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（defenderHitReact body + playDamageEvents add call + addSide onFireImpact remove call）

**禁止**：
- 動 chore #185 spawnHitBurst / popDamage 結構
- 動 distributeDamage / DmgEvent
- 動 chore #188 sparseToDense map
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "defenderHitReact" src/screens/BattleScreen.ts` — 應在 playDamageEvents 內 + helper definition + 不在 onFireImpact 內
   - shake 10 / alpha 0.75 / duration 350 確認
5. **Preview 驗證**：
   - 中獎扣血時，**被打的 spirit** 真的震動 + 紅閃（之前是 attack target 區，可能不對應）
   - 連 5+ spin 確認多 dmg event 都觸發
   - chore #185 hit burst 仍在 attack target 位置（保留 cinematic）
   - 沒 spirit 是 dead 但仍 react（dead spirit 應該已從 cells 移除？— 確認 sparseToDense 邏輯）
6. **Audit per chore #203 lesson**：grep 全 codebase 確認無其他 defenderHitReact 調用

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（受擊瞬間 spirit 紅閃 + shake）
- shake 10 / alpha 0.75 / 350ms 是否合適 (or 太誇 / 不夠)
- 對應正確：是真正扣血 spirit 震動，不是 attack zone
- Spec deviations：1（chore #185 onFireImpact-triggered → playDamageEvents-triggered，更精確）
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3` + close stale PR
