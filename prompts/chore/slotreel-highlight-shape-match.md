# Chore HOTFIX — SlotReel inline highlight 沒套 chore #202（同步 polygon facet）

## 1. Context

Owner 試玩 chore #202 後仍看到 reel 寶石用**球面 ellipse 反光**，跟改前一樣。

### Root cause

chore #200 抽 `drawGemSymbol` 共用 helper，**但 SlotReel.setCellSymbol 沒 refactor 改用**。當前 SlotReel.ts line 239-243 仍 inline 畫 highlight：

```ts
// SlotReel.setCellSymbol — Layer 3
const highlight = new Graphics()
  .ellipse(-r * 0.35, -r * 0.35, r * 0.45, r * 0.30)
  .fill({ color: 0xFFFFFF, alpha: 0.55 });
cell.gemBall.addChild(highlight);
```

chore #202 改了 `GemSymbol.drawGemSymbol`（DraftScreen 用）但**沒改 SlotReel inline 副本**。所以 reel cells 仍是 ellipse。

### Fix
SlotReel highlight 改 shape-aware（同 chore #202 邏輯）。或更乾淨：refactor SlotReel 用 drawGemSymbol（但 reel 還有 BlurFilter / mask / pip 等需保留結構，refactor 風險高）。

**保守 fix**：直接套同樣 polygon facet 邏輯到 SlotReel inline highlight。1 commit 小改動。

純視覺 — 不動 BlurFilter / mask / 連連看 / hit reaction。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 沿用 chore #202 GemSymbol pattern

---

## 2. Spec drift check (P6)

1. 確認 chore #202 GemSymbol shape-aware highlight pattern：sides===0 ellipse / else polygon facet
2. 確認 SlotReel.setCellSymbol 既有 shape variable + polygonPoints helper（chore #199）

---

## 3. Task

### Single commit — Apply chore #202 pattern to SlotReel

`src/screens/SlotReel.ts` line 239-243：

當前：
```ts
// Layer 3: Glossy highlight — small white ellipse upper-left (works on all shapes)
const highlight = new Graphics()
  .ellipse(-r * 0.35, -r * 0.35, r * 0.45, r * 0.30)
  .fill({ color: 0xFFFFFF, alpha: 0.55 });
cell.gemBall.addChild(highlight);
```

改成（match chore #202 pattern）：
```ts
// Layer 3: Glossy highlight — chore #203: matches gem shape (was固定 ellipse 球面光)
// Inner smaller polygon for gem facet feel; circle for W/S/JP keeps ellipse
const highlight = new Graphics();
if (shape.sides === 0) {
  // Circle (Wild/Scatter/JP) — keep ellipse ball reflection
  highlight.ellipse(-r * 0.35, -r * 0.35, r * 0.45, r * 0.30)
    .fill({ color: 0xFFFFFF, alpha: 0.55 });
} else {
  // Polygon gem — inner smaller same-sided polygon offset up-left = facet
  const facetR  = r * 0.45;
  const offsetX = -r * 0.15;
  const offsetY = -r * 0.20;
  highlight.poly(polygonPoints(offsetX, offsetY, facetR, shape.sides))
    .fill({ color: 0xFFFFFF, alpha: 0.35 });
}
cell.gemBall.addChild(highlight);
```

> **Note**：`shape` 變數 already 在 setCellSymbol scope 內（chore #199 加的）。`polygonPoints` 同樣 scope 內。直接 reuse。

> **Future cleanup**（不在本 chore 範圍）：refactor SlotReel.setCellSymbol 直接 call `drawGemSymbol(symId, r)` 取代 inline。但 SlotReel 多了 BlurFilter / mask / pipsContainer 等，refactor 需要小心 ordering — defer 到 future chore。

**Commit**: `fix(chore): SlotReel inline highlight match shape — chore #202 missed audit (DraftScreen GemSymbol component fixed but SlotReel inline copy not synced)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（setCellSymbol Layer 3 highlight 條件分支）

**禁止**：
- 動 chore #170/#172/#174 BlurFilter / mask / ghost fix
- 動 chore #199 shape branches in shadow + main layers
- 動 GemSymbol component（chore #200/#202）— DraftScreen 已正確
- 改 SPEC.md

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "shape.sides === 0\|highlight.poly" src/screens/SlotReel.ts | head -3` — 確認 highlight branch
5. **Preview 驗證**：
   - SlotReel reel 各 4 種寶石 highlight 跟 shape（◇⬠⬢ 內 facet，⬤ ellipse）
   - 跟 DraftScreen tile gem icon 一致

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（reel 內 facet highlight 對比）
- Audit lesson：data structure / drawing logic 抽 component 後**必須 grep 全部 inline copy**確認都 refactored。chore #200 抽 GemSymbol 但 SlotReel inline 沒換用，導致 chore #202 fix 漏 reel 端
- Spec deviations：預期 0
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3`
