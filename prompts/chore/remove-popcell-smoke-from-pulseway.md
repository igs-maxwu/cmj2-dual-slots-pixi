# Chore #214 — 移除 pulseWay 的 popCell 煙特效（GlowFilter halo）

## 1. Context

Owner 試玩 2026-05-05 反映：「我說從symbol區飄出來的動畫，是從單排symbol飄出來的煙，會出現在攻擊後... 表演的時間點很奇怪... 似乎不需要這個煙的特效」。

### 視覺起源確認

[`SlotReel.ts pulseWay`](src/screens/SlotReel.ts#L698)（在 `highlightWays`，[BattleScreen Stage 2](src/screens/BattleScreen.ts#L1881)「對獎 REVEAL」執行）對每個 winning way line 跑三層特效：

1. **`drawArrow`** col→col 連接線（chore #171 sequential trace）
2. **`drawWinRing`** 每個 winning cell 加金/紅/藍環框（最近的 chore）
3. **`popCell`** ([SlotReel.ts:575](src/screens/SlotReel.ts#L575)) — 對同一 cell 同時跑：
   - `cell.container.scale` 0→0.3 pulse + 還原（snappy 推凸感）
   - `cell.overlay` tint α 0→0.7→0 fade（短暫顏色閃光）
   - **`cell.gemBall.filters = [GlowFilter]`** outerStrength 0→4→0 ← **這就是「煙」/暈光殘像**

煙 = GlowFilter halo 從 `gemBall` 邊緣外擴 14px、quality 0.5、tint 配 team color，在 100ms 內擴散到 outerStrength=4 再消失。視覺上跟 ring 框 + arrow 線**疊在同 cell**，產生「連線都已經顯示了還飄煙」的冗餘感。

### Fix 範圍

**只移除 popCell 內的 GlowFilter 部分**（煙），保留 scale pulse + tint overlay flash（snappy 反饋仍存）+ arrows + rings（連線追蹤）。

純視覺刪減 — 不動 pulseWay sequential trace 結構 / drawArrow / drawWinRing / highlightWays caller。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 動 popCell 內 GlowFilter set/restore 三段，其他保留

---

## 2. Spec drift check (P6)

1. 確認 [`SlotReel.ts:575-604`](src/screens/SlotReel.ts#L575) `popCell` 仍含 GlowFilter 邏輯（line 583-588 saved/applied + line 599 restored）
2. 確認 [`SlotReel.ts:715-728`](src/screens/SlotReel.ts#L715) pulseWay 內 popCell call (line 727) 仍是 await
3. 確認 chore #206 (gemBall lazy GlowFilter) 已 merged — gemBall.filters 預設 `[]`
4. 確認 chore #185-G / chore #171 trace + ring + arrow 都還在

---

## 3. Task

### Single commit — Strip GlowFilter from popCell

`src/screens/SlotReel.ts` line 575-604 `popCell`：

當前：
```ts
private async popCell(cell: Cell, tint: number, durMs: number): Promise<void> {
  const baseScale = cell.container.scale.x;

  // Tint overlay
  cell.overlay.clear()
    .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
    .fill(tint);

  // Temp glow — save/restore original gemBall filters (set by setCellSymbol)
  const savedFilters = cell.gemBall.filters ? [...cell.gemBall.filters] : null;
  const glow = new GlowFilter({
    color: tint, distance: 14, outerStrength: 2.5, innerStrength: 0.6, quality: 0.5,
  });
  cell.gemBall.filters = [glow];

  await tween(durMs, t => {
    const p = Easings.pulse(t);
    cell.container.scale.set(baseScale + 0.3 * p);
    cell.overlay.alpha = p * 0.7;
    glow.outerStrength = p * 4;
  });

  // Restore
  cell.container.scale.set(baseScale);
  cell.gemBall.filters = savedFilters;
  cell.overlay.alpha = 0;
  cell.overlay.clear()
    .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
    .fill(0xffffff);
}
```

改成：
```ts
private async popCell(cell: Cell, tint: number, durMs: number): Promise<void> {
  const baseScale = cell.container.scale.x;

  // Tint overlay (kept — snappy color flash on cell)
  cell.overlay.clear()
    .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
    .fill(tint);

  // chore #214: removed GlowFilter halo ("煙") — owner trial feedback 2026-05-05:
  // glow halo lingered visually layered with drawArrow + drawWinRing on same cell,
  // making the connect-the-dots trace feel cluttered. Scale pulse + tint flash kept
  // for snappy feedback; rings + arrows already provide column trace.

  await tween(durMs, t => {
    const p = Easings.pulse(t);
    cell.container.scale.set(baseScale + 0.3 * p);
    cell.overlay.alpha = p * 0.7;
  });

  // Restore (no GlowFilter to restore now)
  cell.container.scale.set(baseScale);
  cell.overlay.alpha = 0;
  cell.overlay.clear()
    .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
    .fill(0xffffff);
}
```

### 變動摘要

| 項目 | Before | After |
|---|---|---|
| Scale pulse 0→0.3 | ✓ kept | ✓ kept |
| Tint overlay α 0→0.7→0 | ✓ kept | ✓ kept |
| GlowFilter halo 0→4 outerStrength | ✓ active | ✗ removed |
| `savedFilters` save/restore dance | ✓ active | ✗ removed |
| `glow.outerStrength = p * 4` 每幀更新 | ✓ active | ✗ removed |
| `import { GlowFilter }` | 仍需留（其他地方用） | 仍需留（不動 import） |

> **保留 imports**：`GlowFilter` 在 SlotReel 其他地方還用（spin BlurFilter path / 其他 filter 操作），不要刪 import。

> **不動**：drawArrow / drawWinRing / pulseWay sequential loop / highlightWays caller / popCellSequence (已 unused 但保留)。

**Commit**: `tune(chore): remove popCell GlowFilter halo from pulseWay (owner trial 2026-05-05 — smoke felt redundant with drawArrow + drawWinRing trace)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts` `popCell` 內 GlowFilter set / animate / restore 三段（line ~583-599 範圍）

**禁止**：
- 動 `pulseWay` 結構 / sequential col loop / arrow + ring 邏輯
- 動 `drawArrow` / `drawWinRing` / `highlightWays` / `popCellSequence`
- 動 chore #170 spin BlurFilter path
- 動 chore #185 / chore #171 / chore #206 既有特效
- 刪 `import { GlowFilter }` from pixi-filters
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "GlowFilter" src/screens/SlotReel.ts` — 應仍有 import + 其他既有用法（如 chore #185 win pulse 殘留？確認），但 popCell 內 NO
   - `grep -A20 "private async popCell" src/screens/SlotReel.ts | grep -E "savedFilters\|cell.gemBall.filters\|glow.outerStrength"` — 應全空（popCell 內已移除）
   - `grep "drawArrow\|drawWinRing\|pulseWay" src/screens/SlotReel.ts` — 結構不動
5. **Preview 驗證**：
   - 進 BattleScreen，AUTO 25 spins
   - 中獎時 reel 應只看到：cell 短暫 scale pulse + tint flash + ring 框 + arrow 連線（**沒煙**）
   - sequential col-by-col trace 仍正常
   - arrows + rings fade-out 仍正常
   - chore #185 win pulse / chore #171 trace / chore #206 lazy filter 不破

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（中獎瞬間 reel 區，對比之前有煙 / 之後乾淨）
- spec deviations: 1 (chore #185 popCell GlowFilter halo 移除 — owner trial 2026-05-05)
- Process check：照 chore #214 起新 pattern — 把 `git checkout feat/<slug> || -b` + `git add <files>` + `git commit` + `git push -u` 串在**單一 Bash call** (`&&` 鏈)，避免上次 chore #211/#213 工作目錄 leak 到 master 的 race
