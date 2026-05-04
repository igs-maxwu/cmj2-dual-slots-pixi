# Chore HOTFIX — popDamage sparse-to-dense slot index conversion (chore #181 missed audit)

## 1. Context

Owner 試玩 chore #187 後反映：扣血數字「-366」出現在**死掉**的 spirit 頭上（截圖佐證 — A 側某 dead spirit 有 X 標但仍冒紅字）。

### Root cause

**Index space mismatch**：

`DamageDistributor.distributeDamage` 回傳 `events: DmgEvent[]`，其中 `slotIndex` 是 **9-elem grid sparse index** (0-8)，line 60：
```ts
const idx = row * 3 + col;  // 0..8
events.push({ slotIndex: idx, damageTaken: hit, died });
```

但 chore #181 重設計後 `slotToArenaPos` 用 **5-elem dense index** (0-4 對應 SLOT_TO_POS_SPEC 5 entries)：
```ts
const spec = SLOT_TO_POS_SPEC[slot] ?? SLOT_TO_POS_SPEC[0]!;
```

當 slotIndex ≥ 5 → `SLOT_TO_POS_SPEC[5+]` undefined → **fallback 到 slot 0**（左上角 outer-back）。

→ 扣血數字錯位到 slot 0 位置，若該 slot spirit 已死則出現在 X 標頭上。

### 同 chore #161/#165 pattern lesson 重演

> Audit lesson #1（locked in KG）：改變 data structure 時 grep ALL index access sites。

chore #181 從 NineGrid 3×3 換成 5-slot zigzag 時，**漏 audit `popDamage` / `playDamageEvents`**。distributeDamage 仍用 9-elem grid index，但 cells 已 5-elem dense。

機制零改動 — 純 index conversion fix at boundary。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`debugging-and-error-recovery`** — root cause 已確認 (sparse vs dense mismatch)，直接 fix

---

## 2. Spec drift check (P6)

1. 確認 `distributeDamage` 仍回傳 9-elem sparse `slotIndex` (line 35 `idx = row * 3 + col`)
2. 確認 chore #181 `slotToArenaPos` 用 5-elem dense `SLOT_TO_POS_SPEC[slot]`
3. 確認 `formationA/B` 仍是 9-elem sparse from createFormation（chore #161 確認）

---

## 3. Task

### Single commit — sparse-to-dense conversion in playDamageEvents

`src/screens/BattleScreen.ts` `playDamageEvents` (line ~2458)：

當前：
```ts
private async playDamageEvents(events: DmgEvent[], targetSide: 'A' | 'B'): Promise<void> {
  const pops = events.map(e => this.popDamage(targetSide, e.slotIndex, e.damageTaken));
  await Promise.all(pops);
}
```

改成：
```ts
private async playDamageEvents(events: DmgEvent[], targetSide: 'A' | 'B'): Promise<void> {
  // chore #188: distributeDamage returns sparse 9-elem grid slotIndex (0-8);
  // popDamage / slotToArenaPos uses dense 5-elem index (0-4) post-chore #181.
  // Build sparse→dense map matching cellsA/B compaction order.
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
      if (import.meta.env.DEV) {
        console.warn(`[BattleScreen] popDamage skipped — sparse slot ${e.slotIndex} not in formation`, e);
      }
      return Promise.resolve();
    }
    return this.popDamage(targetSide, dense, e.damageTaken);
  });
  await Promise.all(pops);
}
```

> **Important**：`u !== null` 不過濾 alive — 死掉的 spirit container 仍存在於 cellsA[denseIdx]，dmg 數字仍應出現在該位置（該位置剛被打死，數字符合「殺死它」的劇情）。
>
> **Verify**：`cellsA/B` 在 chore #161 後是依**non-null** 順序 dense compact。與 `formation.filter(u => u !== null)` 一致。所以本 fix 的 sparseToDense map 跟 cellsA[denseIdx] index 對齊 ✓

### 驗證

```bash
npm run build
```

試玩 5+ spin，確認：
- 多輪後死掉 spirit 的 cells 位置仍對應正確
- 扣血數字出現在 **被擊中的 spirit 頭上**（不是死掉 spirit 頭上）
- 殺死當前 spirit 的最後一擊，數字仍出現在該 spirit 位置（即將標 X）

**Commit**: `fix(chore): popDamage sparse-to-dense slot index — DmgEvent.slotIndex (9-elem grid) → cellsA/B dense (5-elem) for correct popDamage position (chore #181 missed audit)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（playDamageEvents 加 sparseToDense map）

**禁止**：
- 動 DamageDistributor（保留 9-elem sparse slotIndex output）
- 動 chore #181 SLOT_TO_POS_SPEC / slotToArenaPos
- 動 chore #161/#165 activeUnits filter pattern (cellsA/B 5-elem dense)
- 動 chore #185 popDamage 內部（fontSize 34 / 3-stage 800ms 不變）
- 動 chore #187 strict mercenary / alive-gate
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "DmgEvent\|slotIndex" src/screens/BattleScreen.ts | head` — 確認只 playDamageEvents 用 + 是 sparse
   - 試玩 5+ rounds，cause some spirits to die，看後續 dmg 數字位置
5. **Preview 驗證 critical**：
   - 連 spin 直到 A 側某 spirit 死亡
   - 繼續 spin → A 側受擊時，dmg 數字應在**真正受擊 spirit** 頭上（不是死掉 spirit）
   - 殺死當前 spirit 的最後一擊，數字在該 spirit 上（合理）
   - 多輪測試確認位置一致
   - chore #185 popDamage 的 punch animation 仍正常
   - 無 console error / TypeScript error

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（dmg 數字位置正確）
- 多輪測試確認 dmg 跟著正確 spirit
- Spec deviations：預期 0
- **Audit lesson 重演**：data structure migrations need codebase-wide grep — chore #181 漏了 popDamage/playDamageEvents
- chore #187 / #185 functionality 不受影響
