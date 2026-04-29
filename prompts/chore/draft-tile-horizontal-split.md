# Chore — DraftScreen tile 改 horizontal split：名字 LEFT / 人物 RIGHT（人物 2× 大）

## 1. Context

#167 merged 後 owner 試玩反映：
- Tile 加寬有效（人物比之前大）
- 但希望**人物更大** + **跟名字一左一右排列**（不要垂直 stack）

當前 #167 layout（vertical stack）：
- y=8-36: name strip 28px
- y=40-125: sprite zone 85px ← **人物只有 85px 高**
- y=127: meta 9pt
- y=147-179: A/B button 32px

橫向 split 後 sprite 可拉到 ~170-180px（**2× 高**），人物明顯大很多。

純視覺 layout 重排 — 不動 spec / draft logic。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit（單一 layout 重排）
- **`source-driven-development`** — 用實際 px budget 算 left/right column

---

## 2. Spec drift check (P6)

1. `mempalace_search "DraftScreen tile 296 horizontal split sprite name"`
2. 確認 既 #167 的 const：`TILE_W=296 / TILE_H=185 / SPIRIT_ZONE_Y=40 / SPIRIT_ZONE_H=85 / NAME_STRIP_Y=8 / NAME_STRIP_H=28 / META_Y=127 / BTN_ZONE_Y=147 / BTN_W=140`
3. 確認 既有 sprite anchor (0.5, 1) bottom-centre

---

## 3. Task

### Single commit — Tile 內 layout 重排（horizontal split）

`src/screens/DraftScreen.ts`：

#### 3a. Layout const 重新規劃

**目標**：left 100px (info column) | right 188px (sprite column)，TILE_H 微增 200。

當前（#167）：
```ts
const TILE_W              = 296;
const TILE_H              = 185;   // chore: vertical stack post-#166
// ...
const NAME_STRIP_Y        = 8;
const NAME_STRIP_H        = 28;
const SPIRIT_ZONE_Y       = NAME_STRIP_Y + NAME_STRIP_H + 4;     // 40
const SPIRIT_ZONE_H       = 85;
const META_Y              = SPIRIT_ZONE_Y + SPIRIT_ZONE_H + 4;   // 127
const BTN_ZONE_Y          = TILE_H - BTN_ZONE_H - 6;             // 147
const BTN_INSET_X         = 6;
const BTN_GAP             = 4;
const BTN_W               = (TILE_W - 2 * BTN_INSET_X - BTN_GAP) / 2;  // 140
```

改成（horizontal split）：
```ts
const TILE_W              = 296;     // unchanged
const TILE_H              = 200;     // 185→200 (modest growth; canvas budget OK)
// ...

// chore: horizontal split — left info column / right sprite column
const TILE_PAD            = 8;                                                  // tile inner padding
const COL_GAP             = 8;                                                  // gap between info / sprite columns
const INFO_COL_W          = 100;                                                // left column: name + meta + A/B
const SPRITE_COL_W        = TILE_W - 2 * TILE_PAD - INFO_COL_W - COL_GAP;       // = 180 right column
const SPRITE_COL_X        = TILE_PAD + INFO_COL_W + COL_GAP;                    // = 116
const SPRITE_COL_Y        = TILE_PAD;                                           // = 8
const SPRITE_COL_H        = TILE_H - 2 * TILE_PAD;                              // = 184 (2× the old 85!)

// Info column zones (left, x=8 to 108):
const INFO_NAME_Y         = TILE_PAD + 6;                                       // 14
const INFO_NAME_H         = 32;                                                 // name strip
const INFO_META_Y         = INFO_NAME_Y + INFO_NAME_H + 4;                      // 50

// A/B buttons stack vertically at info column bottom
const BTN_ZONE_H          = 32;
const BTN_GAP_VERT        = 4;
const BTN_A_Y             = TILE_H - TILE_PAD - 2 * BTN_ZONE_H - BTN_GAP_VERT;  // 116 (top button)
const BTN_B_Y             = TILE_H - TILE_PAD - BTN_ZONE_H;                     // 160 (bottom button)
const BTN_W               = INFO_COL_W - 2 * 4;                                 // 92 (info col width minus 4px each side)
const BTN_X               = TILE_PAD + 4;                                       // 12
```

對應 ROW_H / GRID_H：
```ts
const ROW_H = BANNER_H + BANNER_TO_TILES_GAP + TILE_H;   // 32+8+200 = 240
const GRID_H = ROW_H * 4 + CLAN_ROW_GAP * 3;             // 240*4 + 12*3 = 996
// GRID_Y 160 + GRID_H 996 = 1156, 剩 124px for goButton + status
```

> CANVAS budget check: 1280-1156=124. goButton (~80) + status (~20) = ~100，**剩 24px margin** 仍夠（可微調 TILE_H 195 留更多 buffer 若 build preview 緊）。

#### 3b. drawSpiritTile 重排

當前（#167）：name strip 上方 → sprite 中間 → meta 下方 → A/B 底部水平 2 顆

新版（horizontal split）：
- LEFT: name strip 上方 + meta + A/B vertical stack（從上到下）
- RIGHT: full-body sprite 大幅佔據右半（高 ~184px）

**Sprite 部分**（既有 line 350-366）改成：
```ts
// chore: subtle clan-color glow box for sprite zone (right column)
const glowBg = new Graphics()
  .roundRect(SPRITE_COL_X, SPRITE_COL_Y, SPRITE_COL_W, SPRITE_COL_H, 6)
  .fill({ color: meta.color, alpha: 0.10 });
tile.addChild(glowBg);

// Full-body spirit sprite (anchor 0.5,1 = bottom-centre, fits SPRITE_COL)
const spiritKey = sym.spiritKey;
const tex = Assets.get<Texture>(`spirit-${spiritKey}`)
         ?? Texture.from(`/cmj2-dual-slots-pixi/assets/spirits/${spiritKey}.webp`);
const spirit = new Sprite(tex);
spirit.anchor.set(0.5, 1);
const aspect = tex.height / tex.width || 1.6;
// Scale to fit SPRITE_COL_H (height-constrained)
const fitH = SPRITE_COL_H - 8;                                        // 8px inset
const fitW = fitH / aspect;
// If too wide for column, height-constrain instead
const finalW = Math.min(fitW, SPRITE_COL_W - 8);
const finalH = finalW === fitW ? fitH : finalW * aspect;
spirit.width = finalW;
spirit.height = finalH;
spirit.x = SPRITE_COL_X + SPRITE_COL_W / 2;
spirit.y = SPRITE_COL_Y + SPRITE_COL_H - 4;                           // feet near sprite zone bottom
tile.addChild(spirit);
```

**Name 部分**（既有 line 369-388）改成 left column：
```ts
// chore: name strip in LEFT info column
const nameBg = new Graphics()
  .roundRect(TILE_PAD + 2, INFO_NAME_Y, INFO_COL_W - 4, INFO_NAME_H, 6)
  .fill({ color: meta.color, alpha: 0.18 })
  .stroke({ width: 1, color: meta.color, alpha: 0.55 });
tile.addChild(nameBg);

const name = new Text({
  text: sym.spiritName,
  style: {
    fontFamily: T.FONT.title, fontWeight: '700',
    fontSize: 20,                                                     // 22→20 fit narrower column
    fill: T.FG.cream, letterSpacing: 2,                               // 4→2 narrower
    dropShadow: { color: meta.color, alpha: 0.6, blur: 6, distance: 0 },
  },
});
name.anchor.set(0.5, 0.5);
name.x = TILE_PAD + INFO_COL_W / 2;                                   // 8 + 50 = 58
name.y = INFO_NAME_Y + INFO_NAME_H / 2;                               // 14 + 16 = 30
tile.addChild(name);
```

**Meta 部分**（既有 line 392-399）改成 left column 中段：
```ts
const prob = ((sym.weight / totalW) * 100).toFixed(1);
const metaTxt = new Text({
  text: `W:${sym.weight}\n${prob}%`,                                  // newline split for narrow column
  style: { fontFamily: T.FONT.num, fontSize: 9, fill: T.FG.muted, letterSpacing: 1, align: 'center' },
});
metaTxt.anchor.set(0.5, 0);
metaTxt.x = TILE_PAD + INFO_COL_W / 2;
metaTxt.y = INFO_META_Y;
tile.addChild(metaTxt);
```

> Meta 從單行 `W:21  11.4%` 變雙行 `W:21\n11.4%`，因 INFO_COL_W=100 太窄擺單行。

**A/B button 部分**（既有 line 391-420）改成 vertical stack：
```ts
// ── Pick button A (top, in info column) ──
const btnA = new Container();
btnA.x = BTN_X; btnA.y = BTN_A_Y;
const btnABg = new Graphics();
btnA.addChild(btnABg);
const btnALbl = new Text({
  text: 'A',
  style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.lg, fill: T.FG.white, letterSpacing: 2 },
});
btnALbl.anchor.set(0.5, 0.5);
btnALbl.x = BTN_W / 2; btnALbl.y = BTN_ZONE_H / 2;
btnA.addChild(btnALbl);
btnA.eventMode = 'static';
btnA.cursor = 'pointer';
tile.addChild(btnA);

// ── Pick button B (below A) ──
const btnB = new Container();
btnB.x = BTN_X; btnB.y = BTN_B_Y;
// ... (analogous to btnA, label 'B')
```

> 既有 hitArea / event listener / refs 結構保留，只改 x/y 座標。

**Badge** 既有 line 423-431（左上 / 右上角）保留**不動**。

#### 3c. redrawTile 內 button bg / border 對應更新

既有 redrawTile 內可能有 `roundRect(0, 0, BTN_W, BTN_ZONE_H, ...)` 重畫 button bg — 因為 BTN_W 從 140→92 自動跟 const，不用改 code，**只用 const 變動帶過**。

**Commit**: `feat(chore): DraftScreen tile horizontal split — name LEFT info col / sprite RIGHT col 2× taller`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/DraftScreen.ts`（const layout 一段 + drawSpiritTile 內 sprite/name/meta/btnA/btnB 五段）

**禁止**：
- 動 SpiritPortrait
- 動 SymbolsConfig / draft 邏輯 / button 行為 / Resonance
- 動 BattleScreen / ResultScreen
- 動 main.ts / SPEC.md / DesignTokens / sim-rtp.mjs
- 加新 asset
- 動 spirit webp

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Preview 驗證 critical**：
   - DraftScreen 每 tile 內：**LEFT** 名字 + meta + A/B 垂直堆 / **RIGHT** 整隻 sprite 接近 tile 全高（**比 #167 大 ~2×**）
   - 4 clan banner + 8 spirit grid 仍**正常垂直排列**，不超出 1280px
   - START BATTLE button + status visible
   - A 和 B 按鈕分上下排列，A 上 / B 下，可點 + visual feedback 正常
   - meta `W:N\nN.N%` 雙行清楚
   - 角色名 20pt 在 info col 名字 strip（dropShadow clan-glow）清楚可讀
5. 截圖 1 張：DraftScreen 完整（含 4 clan + 8 tile + start battle button）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- sprite 實際視覺高度（vs #167 的 85px 改善多少？）
- left/right column 比例（100/180 是否 OK / 還需調？）
- A/B 上下堆 vs 之前左右並排哪個更好點（owner subjective）
- TILE_H 200 是否擠到 goButton（若擠 → 縮 195）
- Spec deviations：預期 0
