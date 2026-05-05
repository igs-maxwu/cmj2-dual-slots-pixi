# Chore — gemBall GlowFilter lazy 化（移除 15 always-on filters，~5-9ms/frame perf）

## 1. Context

Filter audit（chore #205 closure）：
- 15 cells × always-on GlowFilter on gemBall = 15 filters
- 6 UI text/dot GlowFilter = 6
- ~21 always-on filter during gameplay
- spin 期間 +15 BlurFilter = 36 active

mid-tier mobile each filter ~0.3-0.6ms → **~5-9ms** 永久成本。

### Optimization
**Lazy GlowFilter**：
- 預設 gemBall 無 filter（依賴 chore #199 dark stroke + chore #202/203 facet highlight 已夠精緻）
- Spin 期間：BlurFilter 仍照 chore #170 加（既有）
- 中獎時：chore #172/185 pulseWay 既有臨時加 glow（保留）
- 結果：always-on filter 從 15 → 0

### 預期收益
- frame time 省 ~5-9ms
- 累計 active filters 26 → ~11
- 60fps budget 寬鬆很多

### Trade-off
- 靜態 idle gem 沒 glow（owner trial 評估接受度）
- 視覺：chore #199 dark stroke + chore #202 facet 已增加質感，預期可接受

純 perf optimization — 不動視覺結構 / 機制。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — careful with chore #170 BlurFilter / chore #172 resetGemBallFilter / chore #185 win pulse 互動

---

## 2. Spec drift check (P6)

1. 確認 chore p11-vA-03 setCellSymbol line 189 + 282 always-on GlowFilter
2. 確認 chore #170 spinColumn line 440 + spinColumnCenter line 529 BlurFilter set
3. 確認 chore #172 resetGemBallFilter helper（set GlowFilter back at lock）
4. 確認 chore #185/#202 pulseWay temp glow（saved/restored line 595-610）

---

## 3. Task

### Single commit — Lazy GlowFilter

`src/screens/SlotReel.ts`：

#### 3a. setCellSymbol (line 189) — 移除 always-on GlowFilter

當前：
```ts
cell.gemBall.filters = [new GlowFilter({
  color: visual.color,
  distance: 12,
  outerStrength: 1.0,
  innerStrength: 0.2,
  quality: 0.4,
})];
```

改成：
```ts
// chore #206: lazy GlowFilter — gemBall has NO filter by default (dark stroke + facet highlight already provide depth).
// GlowFilter is applied transiently:
//   - BlurFilter during spin (chore #170)
//   - GlowFilter during win pulse (chore #185 pulseWay)
cell.gemBall.filters = [];
```

#### 3b. setCellSymbol (line 282 area) — 同上 

如有第二處 same pattern (early-return path?)，同樣改 `[]`。

#### 3c. resetGemBallFilter (chore #172) 改成 clear

當前 (chore #172 加的)：
```ts
private resetGemBallFilter(cell: Cell): void {
  cell.gemBall.filters = [new GlowFilter({ ... default ... })];
}
```

改成：
```ts
private resetGemBallFilter(cell: Cell): void {
  // chore #206: lazy mode — clear filters at lock (was restore default GlowFilter)
  cell.gemBall.filters = [];
}
```

#### 3d. spinColumn / spinColumnCenter BlurFilter path 不動

既有：
```ts
cell.gemBall.filters = [blur]; // re-apply after setCellSymbol resets to GlowFilter
```

→ Spin 期間仍 set BlurFilter（chore #170），lock 後 resetGemBallFilter clear → 0 filter ✓

#### 3e. pulseWay temp glow path 不動

chore #185 (line 594-610) 既有 saved/restored pattern：
```ts
const savedFilters = cell.gemBall.filters ? [...cell.gemBall.filters] : null;
// ... apply temp glow ...
cell.gemBall.filters = savedFilters;
```

→ 中獎時 saved 是 `[]`（lazy 後），temp glow 短期掛上，restore 回 `[]`。**不動**。

**Commit**: `perf(chore): gemBall GlowFilter lazy — 15 always-on filters removed (~5-9ms/frame mobile fps)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（setCellSymbol GlowFilter set 改 `[]` + resetGemBallFilter clear）

**禁止**：
- 動 chore #170 spin BlurFilter path
- 動 chore #172 setCellSymbol early-return guard
- 動 chore #185/#202 pulseWay temp glow saved/restored
- 動 chore #198/#199 gem shape / 8 colors / dark stroke / facet highlight
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "gemBall.filters" src/screens/SlotReel.ts | head -10` — 應有 setCellSymbol `[]` 設置 + spin BlurFilter 仍套
   - `grep "new GlowFilter" src/screens/SlotReel.ts` — setCellSymbol 已無 GlowFilter，只剩 pulseWay 內 (line 596) 仍存
5. **Preview 驗證 critical**：
   - 進 BattleScreen idle reel — gem 仍清楚（dark stroke + facet highlight 撐住視覺）
   - Spin 動畫 BlurFilter 仍正常（chore #170 不破）
   - Win pulse temp glow 仍正常（chore #185 pulseWay 保留）
   - DevTools Performance：frame time 應**降 ~5-9ms**
   - mobile fps：實測（owner trial）應跟 chore #205 比改善
6. **Audit per chore #203 lesson**：grep全 codebase 確認沒其他 inline copy 也需 sync

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（idle reel 對比，看視覺接受度）
- DevTools Performance 量 frame time（before/after）
- mobile 主觀感受 — 卡頓改善程度
- 視覺：失去 always-on glow 是否仍 acceptable
- Spec deviations：1（chore p11-vA-03 always-on GlowFilter spec → lazy；perf trade-off owner-approved 2026-05-05）
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3` + close stale PR
