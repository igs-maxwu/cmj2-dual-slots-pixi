# Chore HOTFIX — playAttackAnimations 用 activeUnits 對齊 cellsA/cellsB（chore #161 漏修點）

## 1. Context

**SPIN button stuck after round 2~3** — owner console 證實：

```
TypeError: Cannot read properties of undefined (reading 'container')
  at playAttackAnimations
  at loop
```

### Root cause

chore #161 修了 `drawFormation` / `refreshFormation` 用 `activeUnits = grid.filter(u => u !== null)` 對齊 `cellsA/B`（5-elem dense）跟 `formationA/B`（9-elem sparse from createFormation Fisher-Yashes）。

但 **`playAttackAnimations` (line 2222-2281) 漏修了**：
- `slot = attackerFormation.findIndex(...)` 取**原始 9-elem index**（可能 0-8）
- `attackerCells[slot]` → cellsA 只有 5 elem（0-4）→ slot ≥ 5 時 `undefined.container` **炸**

當 round loop 跑到有 spirit 在 formation idx ≥5 attack 時拋 promise reject → spin chain 整個停 → SPIN 按鈕 disabled 永遠 enable 不回來。

統計上每 round ~ 5/9 概率有 spirit at idx ≥5 attack → 玩到 round 3 內必發。

### 為什麼 chore #161 沒抓到

chore #161 只 audit 了 drawFormation / refreshFormation 兩個 function。`playAttackAnimations` 是 attack 動畫期間才跑（不在 mount 時），且需要 attack 觸發（rare event）。**static review miss** — 應該 grep 所有 `cellsA[`/`cellsB[`/`attackerCells[`/`defenderCells[` index access pattern 才完整。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit hotfix
- **`debugging-and-error-recovery`** — root cause 已從 console 證實，直接修
- **`source-driven-development`** — 沿用 chore #161 同樣 `activeUnits` pattern

---

## 2. Spec drift check (P6)

1. `mempalace_search "chore 161 activeUnits createFormation 9-elem sparse cellsA dense"`
2. 確認 chore #161 的 fix pattern 在 drawFormation L946 + refreshFormation L1698 仍是 `activeUnits[slot]`
3. 確認 `formationA/B` 仍是 9-elem sparse from createFormation（**未動 createFormation**）
4. 確認 `cellsA/cellsB` 仍是 5-elem dense（從 chore #161 後）

---

## 3. Task

### Single commit — playAttackAnimations 對齊

`src/screens/BattleScreen.ts` line 2222-2281。

#### 3a. addSide function 內加 active filter

當前 line 2225-2275：
```ts
const addSide = (
  hits:       WayHit[],
  attackerCells: typeof this.cellsA,
  defenderCells: typeof this.cellsB,
  attackerFormation: typeof this.formationA,
  defenderFormation: typeof this.formationB,
): void => {
  const draftedHits    = hits.filter(h => !h.isMercenary);
  const mercenaryHits  = hits.filter(h =>  h.isMercenary);

  const bestDrafted = draftedHits.reduce<WayHit | null>((b, h) =>
    !b || h.matchCount * h.numWays > b.matchCount * b.numWays ? h : b, null);

  if (bestDrafted) {
    const slot = attackerFormation.findIndex(
      u => u && u.alive && u.symbolId === bestDrafted.symbolId);
    if (slot >= 0) {
      const origin  = attackerCells[slot].container;       // ← CRASH HERE when slot ≥ 5
      const targets = defenderCells
        .filter((_, i) => defenderFormation[i]?.alive)     // ← also wrong index space
        .slice(0, 3)
        .map(c => ({ x: c.container.x, y: c.container.y }));
      ...
    }
  }

  for (const mh of mercenaryHits) {
    const targets = defenderCells
      .filter((_, i) => defenderFormation[i]?.alive)       // ← also wrong index space
      .slice(0, 3)
      .map(c => ({ x: c.container.x, y: c.container.y }));
    ...
  }
};
```

改成：
```ts
const addSide = (
  hits:       WayHit[],
  attackerCells: typeof this.cellsA,
  defenderCells: typeof this.cellsB,
  attackerFormation: typeof this.formationA,
  defenderFormation: typeof this.formationB,
): void => {
  const draftedHits    = hits.filter(h => !h.isMercenary);
  const mercenaryHits  = hits.filter(h =>  h.isMercenary);

  // chore: cellsA/B are 5-elem dense (active spirits only); formation is 9-elem sparse.
  // Use compact active arrays so findIndex / array-position checks align with cell index space.
  const activeAttackers = attackerFormation.filter(u => u !== null);
  const activeDefenders = defenderFormation.filter(u => u !== null);

  const bestDrafted = draftedHits.reduce<WayHit | null>((b, h) =>
    !b || h.matchCount * h.numWays > b.matchCount * b.numWays ? h : b, null);

  if (bestDrafted) {
    // chore: use activeAttackers (matches cellsA index space 0..4)
    const slot = activeAttackers.findIndex(
      u => u && u.alive && u.symbolId === bestDrafted.symbolId);
    if (slot >= 0) {
      const origin  = attackerCells[slot].container;
      const targets = defenderCells
        .filter((_, i) => activeDefenders[i]?.alive)        // chore: activeDefenders aligned with defenderCells
        .slice(0, 3)
        .map(c => ({ x: c.container.x, y: c.container.y }));
      if (targets.length > 0) {
        animations.push(attackTimeline({
          stage:    this.container,
          symbolId: bestDrafted.symbolId,
          spiritKey: SYMBOLS[bestDrafted.symbolId].spiritKey,
          originX: origin.x, originY: origin.y,
          targetPositions: targets,
        }));
      }
    }
  }

  for (const mh of mercenaryHits) {
    const targets = defenderCells
      .filter((_, i) => activeDefenders[i]?.alive)          // chore: aligned with defenderCells
      .slice(0, 3)
      .map(c => ({ x: c.container.x, y: c.container.y }));
    if (targets.length > 0) {
      animations.push(mercenaryWeakFx(
        this.container,
        targets,
        Math.max(1, Math.floor(mh.rawDmg)),
        SYMBOLS[mh.symbolId].color,
      ));
    }
  }
};
```

#### 3b. Verify

`npm run build` 過 → push → preview：
- 進 Battle 5v5
- 連續 spin 5+ rounds
- 觀察 console **無 TypeError**
- SPIN 按鈕每 round 結束都正常 enable
- attack 動畫從正確 spirit 飛向正確目標

**Commit**: `fix(chore): playAttackAnimations use activeUnits — align with cellsA/B 5-elem dense (chore #161 missed point)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（playAttackAnimations function 內 addSide closure）

**禁止**：
- 動 createFormation（formation 9-elem sparse 結構保留）
- 動 cellsA/cellsB 結構（保持 5-elem dense from chore #161）
- 動 SlotEngine / WayHit / SYMBOLS
- 動 attackTimeline / mercenaryWeakFx 內部
- 加新 const
- 改其他 function（已 grep 確認其他位置 chore #161 都修對了）

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 5v5 battle 連續 spin 10 rounds
   - **無 TypeError in console**
   - SPIN button 每 round 正常 enable / disable cycle
   - Attack 動畫看起來從 spirit 飛向對方（不是空中飛）
   - 死亡 spirit 不被選為 attacker（alive 判斷對齊新 index）
5. 截圖：spin 完 5+ rounds 後 console 乾淨 + ROUND 06+ HUD

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（console + ROUND ≥ 6 證明連續 spin）
- 確認 attack 動畫視覺軌跡（spirit → 對方）正確
- Spec deviations：預期 0
- **檢討**：chore #161 audit 應該 grep 所有 `cellsA[` / `cellsB[` index access — 漏 audit 一個 → 此 hotfix
