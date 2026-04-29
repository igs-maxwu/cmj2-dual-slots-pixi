# Chore — DraftScreen tile 加寬 + 名字移到 sprite 上方（不再 overlay 蓋人物）

## 1. Context

#166 merged 後 owner 試玩反映 2 個 issue（截圖佐證）：

1. **名字檔到人物圖** — chore #166 把 24pt 名字當 overlay 蓋在 sprite 上（`NAME_OVERLAY_Y = 18`），擋到角色頭/身體，反而看不清角色細節
2. **兩側空白太多** — 當前 `TILE_W=152` × 2 tiles + `TILE_GAP=40` = 344px，只佔 720px canvas 的 47.8%，左右各**留 188px 空白**沒利用到

修正方向：
- 把 tile 加寬（用滿橫向空間）
- 把名字從 overlay 移到 sprite **上方獨立 strip**，不再蓋人物

純視覺 layout 調整 — 不動 spec / draft logic / 不換 asset。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（拓寬 / 名字移位）
- **`source-driven-development`** — 先讀當前 const 算實際 px budget，再調

---

## 2. Spec drift check (P6)

1. `mempalace_search "DraftScreen TILE_W tile gap name overlay 166"`
2. 確認 既 `TILE_W=152 / TILE_H=185 / TILE_GAP=40 / TILES_TOTAL_W=344 / TILES_START_X=188`（chore #166 final）
3. 確認 既 `SPIRIT_ZONE_Y=8 / SPIRIT_ZONE_H=115 / NAME_OVERLAY_Y=18`（chore #166 added）
4. 確認 既 `GRID_Y=160 / GRID_H=936`（4 row × 225 ROW_H + 36 gap）+ CANVAS_HEIGHT=1280 → 仍剩 184px for goButton + status

---

## 3. Task

### 3a. Commit 1 — Tile 加寬使用空間

`src/screens/DraftScreen.ts` line 22-32：

當前：
```ts
const TILE_W              = 152;
const TILE_H              = 185;   // chore: taller to fit full-body spirit (was 152)
const TILE_GAP            = 40;    // horizontal gap between the 2 tiles in each row
// ...
const TILES_TOTAL_W       = TILE_W * 2 + TILE_GAP;                     // 344
const TILES_START_X       = Math.round((CANVAS_WIDTH - TILES_TOTAL_W) / 2); // 188
```

改成：
```ts
// chore: widen tile to use canvas horizontal space (was 152px → much wasted margin)
// CANVAS_WIDTH 720 - 32px*2 side margin - 24px between = 632 / 2 = 316 each tile
const TILE_W              = 296;        // was 152 — uses ~80% canvas width per row
const TILE_H              = 200;        // was 185 — slight bump for new name strip
const TILE_GAP            = 24;         // was 40 — keep some breathing room between tiles
// ...
const TILES_TOTAL_W       = TILE_W * 2 + TILE_GAP;                     // = 616
const TILES_START_X       = Math.round((CANVAS_WIDTH - TILES_TOTAL_W) / 2); // = 52
```

> 估算：tile 從 152 → 296，**+144 px wider**（接近 2× 寬），左右 margin 從 188 → 52 ✓

對應 `BTN_W` 重算（既有 line 45）：
```ts
const BTN_W = (TILE_W - 2 * BTN_INSET_X - BTN_GAP) / 2;  // (296 - 12 - 4) / 2 = 140
```

對應 `ROW_H` / `GRID_H`（line 28-29）：
```ts
const ROW_H = BANNER_H + BANNER_TO_TILES_GAP + TILE_H;   // 32+8+200 = 240
const GRID_H = ROW_H * 4 + CLAN_ROW_GAP * 3;             // 240*4 + 12*3 = 996
```

> CANVAS budget check：GRID_Y 160 + GRID_H 996 = 1156，剩 124px 給 goButton + status — 仍夠（goButton ~80px + status ~24px = 104px）。若 toolbar 緊張，TILE_H 可保 185，GRID_H 936 不變。

**Commit 1**: `feat(chore): DraftScreen tile widen 152→296 to use canvas space (margin 188→52)`

---

### 3b. Commit 2 — 名字移到 sprite 上方獨立 strip

當前 line 38-40：
```ts
const SPIRIT_ZONE_Y  = 8;
const SPIRIT_ZONE_H  = 115;
const NAME_OVERLAY_Y = SPIRIT_ZONE_Y + 10;    // 18: name overlay in upper portion of sprite
```

改成：
```ts
// chore: name strip ABOVE sprite (no longer overlay - was hiding character)
const NAME_STRIP_Y   = 8;                     // top of tile
const NAME_STRIP_H   = 32;                    // 24pt + padding
const SPIRIT_ZONE_Y  = NAME_STRIP_Y + NAME_STRIP_H + 4;     // 44: below name
const SPIRIT_ZONE_H  = 110;                   // 110px sprite area (was 115; shrink slightly to fit new strip)
```

並調整 META 位置 / BTN 位置（既有 line 41-42）：
```ts
// META row: just below sprite zone
const META_Y     = SPIRIT_ZONE_Y + SPIRIT_ZONE_H + 4;        // 158
const BTN_ZONE_Y = TILE_H - BTN_ZONE_H - 6;                  // 162 (TILE_H 200 - 32 - 6)
```

#### 3b-2. drawSpiritTile 內 name 創建

當前 line 380-387（chore #166 stroked overlay version）：
```ts
const name = new Text({
  text: sym.spiritName,
  style: {
    fontFamily: T.FONT.title, fontWeight: '700',
    fontSize: 24, fill: T.FG.cream, letterSpacing: 4,
    stroke: { color: 0x000000, width: 3, alpha: 0.7 },
    dropShadow: { color: meta.color, alpha: 0.6, blur: 6, distance: 0 },
  },
});
name.anchor.set(0.5, 0);
name.x = TILE_W / 2;
name.y = NAME_OVERLAY_Y;   // 18 — overlap sprite
tile.addChild(name);
```

改成：
```ts
// chore: name in dedicated strip ABOVE sprite (no longer overlay)
// Optional name backdrop strip (subtle clan-glow line/box)
const nameBg = new Graphics()
  .roundRect(8, NAME_STRIP_Y, TILE_W - 16, NAME_STRIP_H, 6)
  .fill({ color: meta.color, alpha: 0.18 })
  .stroke({ width: 1, color: meta.color, alpha: 0.55 });
tile.addChild(nameBg);

const name = new Text({
  text: sym.spiritName,
  style: {
    fontFamily: T.FONT.title, fontWeight: '700',
    fontSize: 22,                                          // 24→22 fits strip cleanly
    fill: T.FG.cream, letterSpacing: 4,
    dropShadow: { color: meta.color, alpha: 0.6, blur: 6, distance: 0 },
  },
});
name.anchor.set(0.5, 0.5);
name.x = TILE_W / 2;
name.y = NAME_STRIP_Y + NAME_STRIP_H / 2;                  // strip vertical center
tile.addChild(name);
```

> 移除 dark outline stroke（不再需要 — 不蓋 sprite 了），保留 clan-color dropShadow 給氛圍。
> Name backdrop 用 clan-color alpha=0.18 fill + alpha=0.55 stroke，跟既有 azureGlow 等 palette 統一。

#### 3b-3. drawSpiritTile sprite 重新對齊

當前 line 360-366 sprite y reference：
```ts
spirit.y = SPIRIT_ZONE_Y + SPIRIT_ZONE_H;   // 8 + 115 = 123
```

新 const 自動更新 → `44 + 110 = 154`，feet 在 sprite zone bottom，正確。**code line 不用改**（const 變動帶過）。

#### 3b-4. drawSpiritTile glowBg 對應

當前 line 350-353：
```ts
const glowBg = new Graphics()
  .roundRect(8, SPIRIT_ZONE_Y, TILE_W - 16, SPIRIT_ZONE_H, 6)
  .fill({ color: meta.color, alpha: 0.10 });
```

const 自動跟（SPIRIT_ZONE_Y 8→44）→ **不用改**。

#### 3b-5. metaTxt y 對齊新 const

當前 line 399：
```ts
metaTxt.y = SPIRIT_ZONE_Y + SPIRIT_ZONE_H + 4;   // 8+115+4 = 127
```

改成 inline 用新 META_Y const：
```ts
metaTxt.y = META_Y;                              // 158
```

**Commit 2**: `polish(chore): DraftScreen name above sprite (dedicated strip) — no longer overlay; clan-color backdrop`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/DraftScreen.ts`（const layout 一段 + drawSpiritTile 內 name 創建段 + glowBg 連帶 sprite y 自動跟）

**禁止**：
- 動 SpiritPortrait 組件
- 動 SymbolsConfig / draft 邏輯 / button 行為
- 動 SmartButton / UiButton / Decorations
- 動 BattleScreen / ResultScreen
- 動 main.ts / SPEC.md / DesignTokens / sim-rtp.mjs
- 加新 asset
- 動 spirit webp

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - DraftScreen tile 變寬（左右 margin 明顯減少 vs #166 版本，~52px 兩側）
   - 名字在 sprite **上方獨立 strip**（不再 overlay 蓋人物）— sprite 全身完整可見
   - 4 clan banner + 8 spirit grid 仍**正常垂直排列**，不超出 1280px
   - START BATTLE button + status 仍 visible
   - A / B 圓 badge / button 仍 visible 可點
5. 截圖 1 張：完整 DraftScreen（含全部 4 clan + 8 tile + start battle button）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 實際 TILE_W / TILE_H 採用值
- name strip 視覺感受（高度 32 是否剛好 / 22pt 是否清楚 / clan-color backdrop 是否提升質感）
- sprite 在加寬 tile 內視覺感受（一樣 110px tall 但寬 tile 內顯小？需要 SPIRIT_ZONE_H 拉到 130 嗎？）
- Spec deviations：預期 0
