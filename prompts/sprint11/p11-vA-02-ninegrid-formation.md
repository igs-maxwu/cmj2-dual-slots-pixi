# Sprint 11 · p11-vA-02 — NineGrid 3×3 Spirit Formation（5-of-9 deterministic placement + depth scale + B-side col mirror）

## 1. Context

PR: **既有 chore #146 1-2-2 三排 formation 改成 Variant A 的 3×3 NineGrid — 9 個 cells 中有 5 個放 spirit（per mount 確定性 Fisher-Yates 隨機選 5）。每排 depth scale 0.78→1.10（back 較小較遠 / front 較大較近）。Render back-to-front z-order（front 蓋 back）。B 側 col mirror（front 面對 A）。**

Why: p11-vA-01 已重排 layout 但 formation 仍是 chore #146 的 1-2-2 三排 — owner 試玩看到「九宮格」感不夠。Variant A mockup 用真正的 3×3 grid（NineGrid component）讓每場 spirit 站位**確定但有變化**（同場 reload 一致、不同場不同），增加 replay variety + 視覺豐富度。

Mockup reference: `download_picture/Dual Slot Pixi/battle-shared.jsx` line 403-540 (`randomGridPlacement` + `NineGrid` component)。

設計：

### Cell 結構（per side 3×3）

```
A side grid:                   B side grid (col mirrored):
┌─────┬─────┬─────┐           ┌─────┬─────┬─────┐
│ 0   │ 1   │ 2   │           │ 2   │ 1   │ 0   │
│back │back │back │           │back │back │back │
├─────┼─────┼─────┤           ├─────┼─────┼─────┤
│ 3   │ 4   │ 5   │           │ 5   │ 4   │ 3   │
│ mid │ mid │ mid │           │ mid │ mid │ mid │
├─────┼─────┼─────┤           ├─────┼─────┼─────┤
│ 6   │ 7   │ 8   │           │ 8   │ 7   │ 6   │
│front│front│front│           │front│front│front│
└─────┴─────┴─────┘           └─────┴─────┴─────┘
   (A 朝右面對 B)                 (B 朝左面對 A — col 反轉)
```

5 spirit 從 0-8 中**確定性隨機**選 5 個（Fisher-Yates seeded by mount-time hash）。

### Depth scale

| Row | t = row/2 | scale = 0.78 + t × 0.32 | spirit display H |
|---|---|---|---|
| back (0) | 0.0 | 0.78 | SPIRIT_H × 0.78 ≈ 102px |
| mid (1) | 0.5 | 0.94 | SPIRIT_H × 0.94 ≈ 122px |
| front (2) | 1.0 | 1.10 | SPIRIT_H × 1.10 ≈ 143px |

Sprite 用 `scale.set(spiritScale)` apply（既有 sprite 縮放路徑）。

### Cell 尺寸 + Grid 位置

| 參數 | 值 |
|---|---|
| CELL_SIZE | 80 |
| GAP | 4 |
| Grid total | 80×3 + 4×2 = 248×248 |
| A grid left edge | x=32（28 margin + 4 gap）|
| A grid top edge | y=305（arena top 285 + 20 padding，留給 side label）|
| B grid right edge | x=CANVAS_WIDTH-32=688 |
| B grid top edge | y=305（同 A）|

每 cell center：`gridLeftX + col*STEP + CELL_SIZE/2, gridTopY + row*STEP + CELL_SIZE/2`

### Fisher-Yates seeded random（FNV-1a hash）

直接從 mockup `randomGridPlacement(seed)` 抄過來：

```ts
private computeGridPlacement(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  // Fisher-Yates shuffle
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, 5).sort((a, b) => a - b);
}
```

Seed 來源：`onMount` 用 `performance.now().toString()` 為 base，A 側加 'A' suffix、B 側加 'B' suffix（兩側獨立 placement）。

### Render order（z-stacking）

drawFormation 須**先按 row 排序**（back row 0 先 addChild → front row 2 後 addChild）— 這樣 front 蓋 back（深度感）。

### B 側 col 反轉（mirror）

B 側 col 0 視覺上在「最右邊」（朝向 A），col 2 在「最左邊」（最遠離 A）。實作 mirror via 計算：

```ts
const mirroredCol = side === 'B' ? (2 - col) : col;
```

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — 9-cell grid 重構是 architectural change。注意：sorting by row before addChild（z-order），sprite scale apply（existing path or new）。
- **`source-driven-development`** — Fisher-Yates seeded RNG + FNV-1a hash 直接從 mockup `randomGridPlacement` line 403-420 抄。**確認 SlotReel sim seeded path** 不會被 BattleScreen 的 mount-time hash 干擾（兩個獨立 RNG）。
- **`code-simplification`** — 廢除 chore #146 的 1-2-2 LAYOUT array + ARENA_Y_FRONT/MID/BACK + ARENA_SPACING_*。改成 `gridPlacementA / gridPlacementB` 兩個 array + grid origin const。**method `slotToArenaPos` return type 加 scale field**（drawFormation 用）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 11 NineGrid 3x3 formation 5-of-9 seeded p11-vA-02"`
2. 確認 BattleScreen.ts p11-vA-01 後狀態（drawJackpotMarquee hero / drawZoneSeparator / drawBattleArena 310px / drawReelHeader）
3. 確認 chore #146 後 slotToArenaPos return 是 `{ x: number; y: number; row: 'front' | 'mid' | 'back' }`（**本 PR 改 row → number 0/1/2 + 加 scale**）
4. 確認 drawFormation 用 pos.row 判斷 spirit size（**本 PR 改用 pos.scale 直接 apply**）
5. 確認 drawSpiritShadows 用 ARENA_Y_FRONT/MID/BACK（**本 PR 改用動態 grid 位置算 shadow**）

## 3. Task

### 3a. const 重設（廢 chore #146 的 LAYOUT, 加 grid 常數）

```ts
// 廢除（chore #146）:
// const SPIRIT_H_BACK = ...
// const SPIRIT_H_MID  = ...
// const ARENA_Y_FRONT = ...
// const ARENA_Y_MID   = ...
// const ARENA_Y_BACK  = ...
// const ARENA_SPACING_FRONT_X = ...
// const ARENA_SPACING_MID_X   = ...

// 新增:
const NINE_CELL_SIZE     = 80;
const NINE_GAP           = 4;
const NINE_STEP          = NINE_CELL_SIZE + NINE_GAP;   // = 84
const NINE_GRID_TOTAL    = 3 * NINE_CELL_SIZE + 2 * NINE_GAP;  // = 248
const NINE_GRID_TOP_Y    = 305;                          // arena top 285 + 20 padding
const NINE_A_GRID_LEFT_X = 32;
const NINE_B_GRID_LEFT_X = CANVAS_WIDTH - NINE_GRID_TOTAL - 32;  // = 720-248-32 = 440

// SPIRIT_H 保留（chibi sprite source size）
// 各 row scale via formula 0.78 + (row/2) * 0.32
```

### 3b. 加 class fields + computeGridPlacement helper

```ts
private gridPlacementA: number[] = [];   // 5 cells from 0-8
private gridPlacementB: number[] = [];

private computeGridPlacement(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
  const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, 5).sort((a, b) => a - b);
}
```

### 3c. onMount 初始化 placements

加在 onMount 早期（before drawFormation）：

```ts
const seedBase = performance.now().toString();
this.gridPlacementA = this.computeGridPlacement(`${seedBase}-A`);
this.gridPlacementB = this.computeGridPlacement(`${seedBase}-B`);
if (import.meta.env.DEV) {
  console.log(`[NineGrid] A placement: [${this.gridPlacementA.join(',')}]`);
  console.log(`[NineGrid] B placement: [${this.gridPlacementB.join(',')}]`);
}
```

### 3d. 改寫 slotToArenaPos

```ts
private slotToArenaPos(side: 'A' | 'B', slot: number): { x: number; y: number; row: number; scale: number } {
  const placement = side === 'A' ? this.gridPlacementA : this.gridPlacementB;
  const cellIdx   = placement[slot] ?? placement[0];   // fallback to first if slot >= 5
  const row       = Math.floor(cellIdx / 3);            // 0 = back, 1 = mid, 2 = front
  const col       = cellIdx % 3;
  const mirroredCol = side === 'B' ? (2 - col) : col;

  const gridLeftX = side === 'A' ? NINE_A_GRID_LEFT_X : NINE_B_GRID_LEFT_X;
  const gridTopY  = NINE_GRID_TOP_Y;

  // Cell center
  const cellX = gridLeftX + mirroredCol * NINE_STEP + NINE_CELL_SIZE / 2;
  const cellY = gridTopY + row * NINE_STEP + NINE_CELL_SIZE / 2;

  // Depth scale
  const t = row / 2;
  const scale = 0.78 + t * 0.32;   // 0.78 → 0.94 → 1.10

  return { x: cellX, y: cellY, row, scale };
}
```

**注意 return type 改了** — 從 chore #146 的 `row: 'front' | 'mid' | 'back'` 變成 `row: number` (0/1/2) + 新增 `scale: number`。

### 3e. 改寫 drawFormation 用 scale + sort by row

```ts
private drawFormation(side: 'A' | 'B'): void {
  const formation = side === 'A' ? this.formationA : this.formationB;
  if (!formation) return;

  // Sort slots by row (back first → front last) for z-order
  const sortedSlots: Array<{ slot: number; pos: { x: number; y: number; row: number; scale: number } }> = [];
  for (let slot = 0; slot < formation.length; slot++) {
    sortedSlots.push({ slot, pos: this.slotToArenaPos(side, slot) });
  }
  sortedSlots.sort((a, b) => a.pos.row - b.pos.row);

  // Render back-to-front
  for (const { slot, pos } of sortedSlots) {
    const unit = formation[slot];
    if (!unit) continue;

    const container = new Container();
    container.x = pos.x;
    container.y = pos.y;
    container.zIndex = pos.row;   // sortableChildren=true respects this
    this.container.addChild(container);

    // ── Spirit sprite ──
    const tex = Assets.get<Texture>(unit.spiritKey);
    if (tex && tex !== Texture.EMPTY) {
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 1);   // bottom-center anchor (feet at center)
      const baseScale = SPIRIT_H / Math.max(tex.width, tex.height);
      sprite.scale.set(baseScale * pos.scale);
      // Side B mirror sprite (face left)
      if (side === 'B') sprite.scale.x *= -1;
      sprite.y = NINE_CELL_SIZE / 2;   // sprite feet at cell bottom
      container.addChild(sprite);
    }

    // ── HP bar above head ──
    // (既有 HP bar 邏輯，position scaled with pos.scale)
    const hpBarY = -NINE_CELL_SIZE / 2 - 6;   // above cell top
    // ... existing HPBar code with scaled position ...
  }
}
```

**注意**：既有 HP bar 邏輯（chore #146 內 `UNIT_HP_BAR_Y_OFF = -(SPIRIT_H/2+8)`）需重算 — 改成相對於 cell container 的位置（cell top 是 -NINE_CELL_SIZE/2）。

### 3f. drawSpiritShadows 改用 grid placements

既有 chore #146 用 hardcoded ARENA_*_X 算 shadow ellipse 位置。改成從 placement array 動態算：

```ts
private drawSpiritShadows(): void {
  const shadow = new Graphics();
  for (const side of ['A', 'B'] as const) {
    const placement = side === 'A' ? this.gridPlacementA : this.gridPlacementB;
    for (let slot = 0; slot < 5; slot++) {
      const pos = this.slotToArenaPos(side, slot);
      // Shadow size scales with depth (back smaller, front larger)
      const ellipseW = 28 * pos.scale;
      const ellipseH = 7 * pos.scale;
      const shadowY = pos.y + NINE_CELL_SIZE / 2 - 4;   // at cell bottom feet
      shadow.ellipse(pos.x, shadowY, ellipseW, ellipseH).fill({ color: 0x000000, alpha: 0.4 });
    }
  }
  this.container.addChild(shadow);
}
```

### 3g. VS shield 衝突 — 改 y position

既有 p11-vA-01 VS shield at y=415（arena center）。NineGrid 中央有可能會跟 cell idx 4（mid-center cell at row 1, col 1）的 spirit 衝突。

Mid-center cell 中心位置：
- A side: `NINE_A_GRID_LEFT_X (32) + 1*NINE_STEP (84) + NINE_CELL_SIZE/2 (40) = 156`
- B side: `NINE_B_GRID_LEFT_X (440) + 1*NINE_STEP + 40 = 564`
- A↔B center cells x 距離 = 564-156=408px，CANVAS center 360 在中間

VS shield at x=360, y=415 OK（在 A 跟 B 的 grid 之間）。**確認 grid right edge of A** = 32+248=280；**grid left edge of B** = 440。所以 VS at x=360 在 280→440 中間，**不衝突**。

但 mid row spirit 在 row=1（cellY=305+1*84+40=429），feet at 429+40=469。VS at y=415 在 mid row spirit 上方，不衝突。OK。

不需動 VS。

### 3h. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔
- 廢 chore #146 的 SPIRIT_H_BACK/MID, ARENA_Y_*, ARENA_SPACING_* 常數
- 新增 NINE_* 常數
- 新增 gridPlacementA/B fields + computeGridPlacement helper
- onMount 初始化 placements
- slotToArenaPos 重寫
- drawFormation 重寫 sort + scale
- drawSpiritShadows 重寫動態算

**禁止**：
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- DraftScreen / LoadingScreen / ResultScreen / FXPreviewScreen
- main.ts
- DesignTokens
- 加新 asset
- scripts/sim-rtp.mjs
- 改 j-05 既有 refresh / pulse
- 改 SlotReel cell 內部（p11-vA-03 工作）
- 改 attackTimeline / SpiritAttackChoreographer 內部（spirit 動畫不動）
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **2-3 個 commits**（per `incremental-implementation`）：
   - commit 1: 加 const + computeGridPlacement + onMount init
   - commit 2: slotToArenaPos + drawFormation 重寫
   - commit 3: drawSpiritShadows 動態化
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle，5 個 spirit per side **隨機站在 9 個 cells 中**
   - **同一場 reload** placement 不變（deterministic）
   - **不同場進 Battle** placement 改變（per-mount seed）
   - Back row spirit 較小（scale 0.78）、front row 較大（1.10）— 視覺 depth
   - Front row spirit **render 在 back row 上方**（front 蓋 back）
   - B 側 col 反轉 — 「front」spirit 在 grid 左邊（朝向 A）
   - VS shield at y=415 不被任何 spirit 蓋
   - HP bar 在每個 spirit 頭頂正確 scale
   - 死亡 spirit 的 ground shadow 正確消失
5. 截圖 1-2 張（含 placement 變化的 2 場 — 證實 randomization）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- placement seed 是用 `performance.now()` 還是其他（影響 reproducibility）
- 兩場 mount placement 是否真的不同（per-mount randomness verified）
- HP bar 跟 sprite scale 是否同步（front row 大 spirit + 大 HP bar，back row 小 + 小 HP bar）
- spirit attack 動畫（既有 attackTimeline）是否仍正常播（pos.x/y 仍是 absolute world coordinate）
- VS shield 衝突 — 任何中心 cell（idx 4 of A 或 B）的 spirit 是否擋到 VS
- Spec deviations：預期 0
