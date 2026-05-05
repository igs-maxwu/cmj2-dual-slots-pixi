# Chore — Pip dots 升級成 ⭐ 金星（1/2/3 stars，Tier 色保留）

## 1. Context

當前 `SlotReel.refreshCellPips`（line 290-321）畫 1-3 顆 **圓點**作為 tier indicator：
- 1 dot (low tier)：id 0-2 / Wild / Curse — T.SYM.low1
- 2 dots (mid tier)：id 3-5 / Scatter — T.SYM.mid1
- 3 dots (high tier)：id 6-7 / Jackpot — T.SYM.high1

Owner 試玩反映 — 想升級成 **⭐ 金星樣式**（更像 RPG rarity star ratings）。

純視覺升級 — 不動 tier mapping / count / color logic，只改畫法（circle → 5-point star）。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用 Pixi Graphics polygon 5-point star

---

## 2. Spec drift check (P6)

1. 確認 chore p10-v02 既有 `refreshCellPips` 結構（pip count + color mapping）
2. 確認 cell.pipsContainer y position (CELL_H/2 - 10)
3. 確認 chore #173 SYMBOL_VISUAL Curse weight=0 → curse pips 永不顯示，但 logic 保留 fallback

---

## 3. Task

### Single commit — Replace circle with 5-point star

`src/screens/SlotReel.ts` `refreshCellPips` 內部 pip drawing loop (line 315-320)：

當前：
```ts
// Centered horizontal row: 3px radius pips, 4px gap between pip edges
const pipR   = 3;
const pipGap = 4;
const totalW = pipCount * (pipR * 2) + (pipCount - 1) * pipGap;
const startX = -(totalW / 2) + pipR;
for (let i = 0; i < pipCount; i++) {
  const pip = new Graphics()
    .circle(startX + i * (pipR * 2 + pipGap), 0, pipR)
    .fill({ color: pipColor, alpha: 0.90 });
  cell.pipsContainer.addChild(pip);
}
```

改成：
```ts
// chore #197: ⭐ 5-point gold star pips (was circle dots)
// Tier feel like RPG rarity star ratings
const starOuterR = 5;          // bigger than dot (was r=3)
const starInnerR = starOuterR * 0.4;
const starSpacing = starOuterR * 2 + 2;   // tighter horizontal spacing
const totalW = pipCount * (starOuterR * 2) + (pipCount - 1) * 2;
const startX = -(totalW / 2) + starOuterR;

for (let i = 0; i < pipCount; i++) {
  const star = new Graphics();
  // Build 5-point star polygon: 10 vertices alternating outer/inner radius
  const cx = startX + i * starSpacing;
  const points: number[] = [];
  for (let v = 0; v < 10; v++) {
    const r = v % 2 === 0 ? starOuterR : starInnerR;
    const angle = (v / 10) * Math.PI * 2 - Math.PI / 2;   // start at top
    points.push(cx + Math.cos(angle) * r, Math.sin(angle) * r);
  }
  star.poly(points).fill({ color: pipColor, alpha: 0.95 });
  star.stroke({ width: 0.5, color: 0x000000, alpha: 0.6 });   // dark outline for legibility on bright ball
  cell.pipsContainer.addChild(star);
}
```

> **5-point star geometry**:
> - 10 vertices: alternating outer (R=5) + inner (R=2) radius
> - Angle step: 360°/10 = 36°，start at 12 o'clock (-π/2)
> - Outer at angles 0°/72°/144°/216°/288°，inner at 36°/108°/180°/252°/324°
>
> **Stroke**：0.5px dark outline 增加在亮色 ball（米黃 / 亮藍 / 橘）上的辨識度。Glow ball 的 high alpha 字下面 star 仍清楚。

### 視覺驗證

`npm run build` + 試玩：
- 每球底部現在是 1/2/3 顆金 ⭐（不再圓點）
- Tier 色仍保留（low / mid / high glow color）
- 大小不擋到角色字（pipsContainer.y = CELL_H/2 - 10 不變）

**Commit**: `feat(chore): pip indicators circle→5-point star — RPG rarity feel for tier display`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（refreshCellPips 內 pip drawing loop）

**禁止**：
- 動 tier mapping logic (id → pipCount / pipColor)
- 動 cell.pipsContainer 結構 / position / parent
- 動 buildCells 或其他 reel 結構
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL（PR or direct master — 但 direct commit 後 orchestrator 必 verify origin/master per Sprint 15 lesson）
4. **Pre-merge audit**：
   - `grep "star.poly\|5-point" src/screens/SlotReel.ts` — 確認 star geometry
   - `grep "circle.*pipR" src/screens/SlotReel.ts` — 應 0 hits（舊 circle 移除）
5. **Preview 驗證**：
   - 進 BattleScreen → 看 reel 各 ball 底部
   - id 0-2 (寅 / 鸞 / 雨)：1 顆 low-color 星
   - id 3-5 (璋 / 嵐 / 洛)：2 顆 mid-color 星
   - id 6-7 (羽 / 墨)：3 顆 high-color 星
   - W (Wild) / S (Scatter) / JP 各自 1/2/3 gold star
   - Spin 動畫期間 pip 跟 cell 一起 BlurFilter / mask（chore #170/174 不影響）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（reel 含 1/2/3 star ball mix）
- ⭐ 大小 5px outer 是否合適（or 4 太小 / 6 太大）
- 視覺感受 RPG rarity feel 是否到位
- Spec deviations：預期 0
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3` 確認 source on master
