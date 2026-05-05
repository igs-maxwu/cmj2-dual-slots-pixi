# Chore — Gem highlight 跟著 shape（facet 內部高光取代 ball ellipse）

## 1. Context

當前 chore #198-#200 GemSymbol `drawGemSymbol`（line 102-105）highlight 用**固定 ellipse**：
```ts
hl.ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.15)
  .fill({ color: 0xffffff, alpha: 0.5 });
```

這是 **球面（circle）的反光**樣式 — 對 polygon gem 看起來不對（owner 截圖：方型寶石上仍是球面光點）。

### Owner spec
寶石的反光要**跟形狀走** — 像真實 facet 寶石：
- 方形 ◇ (sides=4): 內部小方形 facet（菱形 highlight）
- 五角 ⬠ (sides=5): 內部小五角 facet
- 六角 ⬢ (sides=6): 內部小六角 facet
- 圓 ⬤ (sides=0): 保留 ellipse（球面對的）

純視覺 — 不動 shape / color / char / pip。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用既有 polygonPoints helper

---

## 2. Spec drift check (P6)

1. 確認 chore #198-#200 GemSymbol drawGemSymbol 內部 layered drawing (shadow / main / highlight / char)
2. 確認 polygonPoints helper 仍 export

---

## 3. Task

### Single commit — Highlight shape branch

`src/components/GemSymbol.ts` line 100-105 area：

當前：
```ts
// Layer 3: Glossy highlight (upper-left ellipse)
const hl = new Graphics()
  .ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.15)
  .fill({ color: 0xffffff, alpha: 0.5 });
c.addChild(hl);
```

改成：
```ts
// chore #202: highlight matches gem shape (was固定 ellipse — looked like ball reflection)
// Inner smaller polygon offset upper-left = facet highlight feel
const hl = new Graphics();
if (shape.sides === 0) {
  // Circle (Wild/Scatter/JP) — keep ellipse ball reflection
  hl.ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.15)
    .fill({ color: 0xffffff, alpha: 0.5 });
} else {
  // Polygon (gem facet) — inner smaller same-sided polygon, offset up-left
  const facetR  = r * 0.45;        // smaller inner facet
  const offsetX = -r * 0.15;       // shift left
  const offsetY = -r * 0.20;       // shift up
  hl.poly(polygonPoints(offsetX, offsetY, facetR, shape.sides))
    .fill({ color: 0xffffff, alpha: 0.35 });
}
c.addChild(hl);
```

> **Visual logic**：smaller polygon at same vertex orientation = light hitting the front-facing facet of a faceted gem. Offset up-left = simulates light source from upper-left.
>
> **Alpha 0.35 vs 0.5**：polygon facet 較大覆蓋面積，alpha 降以避免過度白化。circle 保留 0.5 因為 ellipse 較小。

### 視覺驗證

`npm run build` 後 owner 試玩：
- 方型 (寅/鸞/雨) gem：內部小菱形 highlight（不再 ellipse 球面光）
- 五角 (璋/嵐/洛) gem：內部小五角 facet highlight
- 六角 (羽/墨) gem：內部小六角 facet
- 圓 (W/S/JP) gem：保留 ellipse 球面光點

**Commit**: `tune(chore): GemSymbol highlight matches shape — polygon gems get inner facet (was固定 ellipse ball reflection)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/components/GemSymbol.ts`（drawGemSymbol highlight branch）

**禁止**：
- 動 chore #197-#201 其他結構（shape / color / char / pip / sprite layer）
- 改 SlotReel / DraftScreen
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "shape.sides === 0\|polygonPoints" src/components/GemSymbol.ts | head -5` — 確認 highlight branch
5. **Preview 驗證**：
   - SlotReel reel cells 各 4 種 shape highlight 都跟形狀
   - DraftScreen tile gem icon 也 synced（GemSymbol 共用）
   - 圓形 special (W/S/JP) 仍 ellipse 球面光

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（4 種形狀 mix highlight 對比）
- facetR 0.45 + offset 0.15/0.20 比例 OK 嗎（or 試 0.5 / 0.35）
- alpha 0.35 vs 0.5 視覺感受
- Spec deviations：預期 0
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3`
