# Chore — Reel gem 形狀依 tier 分 + ⭐ 加大

## 1. Context

Owner 試玩 chore #197/#198 後 2 改動需求：

### Issue 1: ⭐ pip 太小
當前 `starOuterR = 5`（chore #197）— 玩家覺得偏小。改 7-8px 更明顯。

### Issue 2: 寶石形狀依 tier 分
當前 chore #198 全部都是 pentagon（5-sided）。Owner 想要：

| Tier | Pip | 形狀 | 適用 |
|---|---|---|---|
| Low (1 ⭐) | 1 star | **方形寶石 (4-sided diamond)** | id 0-2 (寅 / 鸞 / 雨) |
| Mid (2 ⭐) | 2 stars | **Pentagon (5-sided)**（保留）| id 3-5 (璋 / 嵐 / 洛) |
| High (3 ⭐) | 3 stars | **六角寶石 (6-sided)** | id 6-7 (羽 / 墨) |
| Special | 變化 | **圓形** | Wild W / Scatter S / Jackpot JP |
| Curse | 1 (purple) | (any, weight=0 永不出現) | — |

→ 玩家用**形狀 + 顏色 + 字 + ⭐ 數量**4 軸辨識度。

純視覺 — 不動 SymbolsConfig / 機制 / 連連看。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（generic polygon helper / shape-by-tier dispatch + ⭐ 加大）
- **`source-driven-development`** — 用既有 chore #198 pentagonPoints 結構，refactor 成 generic n-gon

---

## 2. Spec drift check (P6)

1. 確認 chore #198 `pentagonPoints` helper + setCellSymbol drawing
2. 確認 chore #197 `refreshCellPips` star drawing (starOuterR = 5)
3. 確認 chore #173 SYMBOL_VISUAL char + chore #198 8 unique colors

---

## 3. Task

### 3a. Commit 1 — Generic polygonPoints + shape dispatch

`src/screens/SlotReel.ts`：

#### 3a-1. Refactor pentagonPoints → polygonPoints

當前：
```ts
function pentagonPoints(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    pts.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  return pts;
}
```

改成 generic：
```ts
/** Build n-vertex regular polygon points centered at (cx, cy). Top vertex pointing up. */
function polygonPoints(cx: number, cy: number, r: number, sides: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    pts.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  return pts;
}
```

#### 3a-2. New shape dispatcher

加新 helper：
```ts
/**
 * chore #199: gem shape per symbol.
 * Tier mapping:
 *   id 0-2 (low):     square (4-vertex diamond — point up)
 *   id 3-5 (mid):     pentagon (5-vertex — chore #198 default)
 *   id 6-7 (high):    hexagon (6-vertex)
 *   id 8/10/11 (W/S/JP): circle (no polygon)
 *   id 9 (Curse, weight=0): pentagon (fallback, never spawns)
 *
 * Returns:
 *   - { sides: 4|5|6 } for polygon (generates via polygonPoints)
 *   - { sides: 0 }      for circle (use Graphics.circle)
 */
function shapeFor(symId: number): { sides: number } {
  const sym = SYMBOLS[symId];
  if (!sym) return { sides: 5 };
  if (sym.isWild || sym.isScatter || sym.isJackpot) return { sides: 0 };   // circle
  if (sym.isCurse) return { sides: 5 };   // never spawns; pentagon fallback
  if (symId <= 2) return { sides: 4 };    // low tier: square
  if (symId <= 5) return { sides: 5 };    // mid tier: pentagon
  return { sides: 6 };                     // high tier: hexagon (id 6-7)
}
```

#### 3a-3. setCellSymbol drawing branches by shape

當前 chore #198 setCellSymbol 內 ball drawing（shadow / main / highlight）固定 pentagon。改成根據 shapeFor result：

```ts
const shape = shapeFor(symId);

// Shadow
if (shape.sides === 0) {
  cellShadow.circle(0, 4, r + 1).fill({ color: 0x000000, alpha: 0.4 });
} else {
  cellShadow.poly(polygonPoints(0, 4, r + 1, shape.sides))
    .fill({ color: 0x000000, alpha: 0.4 });
}

// Main (gradient + dark stroke)
if (shape.sides === 0) {
  cellMain.circle(0, 0, r).fill({ ... gradient ... }).stroke({ ... dark ... });
} else {
  cellMain.poly(polygonPoints(0, 0, r, shape.sides))
    .fill({ ... gradient ... })
    .stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });
}

// Highlight (small ellipse upper-left, same as before — works on all shapes)
cellHighlight.ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.15)
  .fill({ color: 0xffffff, alpha: 0.5 });
```

> **方形 (sides=4)** with rotation -90° = 4-vertex with top at 12 o'clock = **diamond ◇**（point up，跟 pentagon 視覺一致）。
> **六角 (sides=6)** = 頂角向上六角 ⬢。
> **圓形 (sides=0)** = Graphics.circle (chore p11-vA-03 既有 pattern)。

**Commit 1**: `feat(chore): generic polygonPoints + shapeFor — 4/5/6-sided gems by tier + circle for specials`

---

### 3b. Commit 2 — ⭐ pip 加大 (5 → 7)

`refreshCellPips` (line ~324)：

當前：
```ts
const starOuterR  = 5;
const starInnerR  = starOuterR * 0.4;
const starSpacing = starOuterR * 2 + 2;
```

改成：
```ts
// chore #199: bigger star (was 5)
const starOuterR  = 7;
const starInnerR  = starOuterR * 0.4;   // 2.8
const starSpacing = starOuterR * 2 + 2; // 16
```

> Spacing 自動跟（starOuterR × 2 + 2 = 16）— 3 stars 寬度從 30 變 50px，仍在 cell 底部 padding 內（CELL_W 124px）。

`pipsContainer.y = CELL_H/2 - 10` 不變 — bottom padding 仍 OK。

**Commit 2**: `tune(chore): pip ⭐ size 5→7 (more visible)`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（pentagonPoints → polygonPoints + shapeFor + setCellSymbol shape branch + starOuterR 5→7）

**禁止**：
- 動 chore #198 SYMBOL_VISUAL 8 unique colors
- 動 chore #173 char mapping
- 動 chore #197 star geometry (poly + alpha + outline) — 只調 size
- 動 SlotEngine / 機制 / 連連看 / hit reaction
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + commit URL（PR or direct master）
4. **Pre-merge audit**：
   - `grep "polygonPoints\|shapeFor" src/screens/SlotReel.ts` — 確認 generic helper + dispatch
   - `grep "starOuterR" src/screens/SlotReel.ts` — 應顯示 7
5. **Preview 驗證**：
   - 進 BattleScreen → 看 reel 各 ball 形狀：
     - 寅 / 鸞 / 雨 (id 0-2)：**方形 ◇**（4-sided diamond）+ 1 ⭐
     - 璋 / 嵐 / 洛 (id 3-5)：**Pentagon ⬠**（5-sided）+ 2 ⭐
     - 羽 / 墨 (id 6-7)：**六角 ⬢**（6-sided）+ 3 ⭐
     - W / S / JP：**圓形 ⬤** + W/S/JP 字 + ⭐ 對應 1/2/3
   - ⭐ 比之前明顯（7 vs 5px）
   - 連連看 / ring / attack 動畫不受影響

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（reel 含 4 種形狀 mix）
- shape 大小看起來 r 對嗎（pentagon r vs square r 同 — diamond 看起來會比 hexagon 小一點是正常）
- ⭐ 7px 是否合適（or 8 / 9 還想再大）
- 玩家 4 軸辨識度（形狀+色+字+pip）overall feel
- Spec deviations：1（chore #198 全 pentagon → tier-based 4/5/6/circle，owner-approved 2026-05-05）
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3` 確認 source on master
