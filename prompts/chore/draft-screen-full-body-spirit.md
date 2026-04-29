# Chore — DraftScreen 圖鑑卡片：圓頭像 → 整隻 spirit 全身（mockup 蒼嵐 style）

## 1. Context

Owner 試玩 post-#164 後反映：DraftScreen「圖鑑頁」當前每個角色卡只放小圓頭像（PortraitPortrait 46px diameter），看不到角色全貌。希望改成 mockup 示意圖（owner 截圖右上角「蒼嵐」卡片）的 **整隻全身 spirit 立繪**：

- 全身角色佔卡片大半空間
- 角色名（蒼嵐）大字 overlay 在角色身上 / 角色頭頂
- A / B 圓形 badge / 按鈕保留在角落
- 仍保持「2 tile per row × 4 clan row」grid 結構

純視覺重做 — 不動 spec / draft logic / SymbolsConfig / Resonance / button 行為。

### 既有 asset
`public/assets/spirits/*.webp` 已有 8 隻全身 spirit（`mengchenzhang.webp` 孟辰珅 / `lingyu.webp` 凌羽 / `xuanmo.webp` 玄墨 / `canlan.webp` 蒼嵐 / `luoluo.webp` 珞洛 / `yin.webp` 寅 / `zhuluan.webp` 朱鸞 / `zhaoyu.webp` 朝雨）— BattleScreen formation 用同一批 webp，draft tile 直接借用。

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（tile size + sprite swap / 文字版面 / button 重新對齊）
- **`source-driven-development`** — 直接 Sprite + Texture，**不重寫 SpiritPortrait**（保留給 BattleScreen `drawCompactHeader` 等其他地方用）
- **`debugging-and-error-recovery`** — 若 spirit sprite aspect ratio 不一致，必須讀真實 texture dimension 算 scale

---

## 2. Spec drift check (P6)

1. `mempalace_search "DraftScreen tile spirit portrait full-body mockup canlan"`
2. 確認 既 `src/screens/DraftScreen.ts` line 23-47 const TILE_W=152 / TILE_H=152 / PORTRAIT_R=26 / NAME_Y=65 / META_Y=86 / BTN_ZONE_Y=110
3. 確認 既 `src/components/SpiritPortrait.ts` 是 round-clipped portrait（不適用 full-body）
4. 確認 既 spirit webp 命名 — `SymbolDef.spiritKey` 對應檔名（grep `spiritKey` 看 SymbolsConfig 或 BattleScreen 怎麼 load）

---

## 3. Task

### 3a. Commit 1 — Tile 加高 + 全身 sprite 取代圓頭像

`src/screens/DraftScreen.ts`：

#### 3a-1. Layout const 調整

當前：
```ts
const TILE_W              = 152;
const TILE_H              = 152;
// ...
const PORTRAIT_R  = 26;
const PORTRAIT_CX = Math.round(TILE_W / 2);
const PORTRAIT_CY = 36;
const NAME_Y      = 65;
const META_Y      = 86;
const BTN_ZONE_Y  = 110;
```

改成：
```ts
const TILE_W              = 152;        // unchanged - keep 2-per-row grid
const TILE_H              = 220;        // taller to fit full-body sprite
// ...
const SPIRIT_ZONE_Y       = 8;          // top padding above sprite
const SPIRIT_ZONE_H       = 150;        // sprite area: 150px tall (fits typical spirit aspect)
const NAME_Y              = SPIRIT_ZONE_Y + SPIRIT_ZONE_H + 8;   // 166: name strip below sprite
const META_Y              = NAME_Y + 22;                          // 188: weight % below name
const BTN_ZONE_Y          = TILE_H - 32 - 6;                      // 182: bottom-aligned A/B buttons
const BTN_ZONE_H          = 32;
```

對應 `ROW_H` / `GRID_H` const 重算：
```ts
const ROW_H = BANNER_H + BANNER_TO_TILES_GAP + TILE_H;   // 32+8+220 = 260
const GRID_H = ROW_H * 4 + CLAN_ROW_GAP * 3;             // 260*4 + 12*3 = 1076
```

> **Caution**: GRID_H = 1076 已超出 CANVAS_HEIGHT(1280) - GRID_Y(160) - 144 (toolbar + status). 若超 → 需縮 SPIRIT_ZONE_H 或 TILE_H。Executor 用實際 build preview 確認；若 toolbar 被擠掉，將 SPIRIT_ZONE_H 縮回 110-130 px 範圍找 sweet spot。最終 TILE_H 不超過 200px 為宜。

#### 3a-2. Sprite full-body 替換

`drawSpiritTile()` line 350-366（目前 portrait circle backdrop + ring + SpiritPortrait 三段）→ 整段替換成：

```ts
// ── Full-body spirit sprite (anchor 0.5,1 = bottom-centre, fits SPIRIT_ZONE) ──
const spiritKey = sym.spiritKey;   // existing field on SymbolDef
const tex = Assets.get<Texture>(`spirit-${spiritKey}`)
         ?? Texture.from(`/cmj2-dual-slots-pixi/assets/spirits/${spiritKey}.webp`);
const spirit = new Sprite(tex);
spirit.anchor.set(0.5, 1);                              // feet at y reference
const aspect = tex.height / tex.width || 1.6;
const targetH = SPIRIT_ZONE_H;
const targetW = targetH / aspect;
spirit.width = targetW;
spirit.height = targetH;
spirit.x = TILE_W / 2;
spirit.y = SPIRIT_ZONE_Y + SPIRIT_ZONE_H;               // bottom of sprite zone
tile.addChild(spirit);

// ── Subtle clan-color glow backdrop (replaces circle backdrop) ──
const glowBg = new Graphics()
  .roundRect(8, SPIRIT_ZONE_Y, TILE_W - 16, SPIRIT_ZONE_H, 6)
  .fill({ color: meta.color, alpha: 0.10 });
tile.addChildAt(glowBg, tile.children.length - 1);     // behind sprite
```

> **Note**: BattleScreen / SlotEngine 使用 spirit webp 用同樣的 `spiritKey` field — 從 `SYMBOLS[idx].spiritKey` 取（grep 確認）。

#### 3a-3. Move name overlay 到 sprite 下方（保留既有 `NAME_Y`）

既有 line 369-378 `name` Text 不動，只改 `name.y = NAME_Y`（已自動跟新 const）。

**Commit 1**: `feat(chore): DraftScreen full-body spirit sprite replaces circle portrait + tile h 152→220`

---

### 3b. Commit 2 — 文字 overlay 美化（mockup 風格）

mockup 蒼嵐示例顯示**角色名作為大字 overlay 直接覆在 sprite 上**，不是放下面的 strip。

#### 3b-1. Name overlay style

當前 name `T.FONT_SIZE.md`（推測 16-18pt，small）+ position 在 sprite 下方。

改成：**大字 overlay 在 sprite zone 上半部**（vertical thirds 上 1/3）：

```ts
const name = new Text({
  text: sym.spiritName,
  style: {
    fontFamily: T.FONT.title, fontWeight: '700',
    fontSize: 24,                                       // 18→24 (mockup style)
    fill: T.FG.cream,
    letterSpacing: 4,
    stroke: { color: 0x000000, width: 3, alpha: 0.7 },  // dark outline for legibility on sprite
    dropShadow: {
      color: meta.color,                                // clan-color glow
      alpha: 0.6,
      blur: 6,
      distance: 0,
    },
  },
});
name.anchor.set(0.5, 0);
name.x = TILE_W / 2;
name.y = SPIRIT_ZONE_Y + 12;                          // top-overlay on sprite
tile.addChild(name);
```

#### 3b-2. Meta text（W: 21  11.4%）—— 縮小放下面 strip

```ts
const prob = ((sym.weight / totalW) * 100).toFixed(1);
const metaTxt = new Text({
  text: `W:${sym.weight}  ${prob}%`,
  style: { fontFamily: T.FONT.num, fontSize: 9, fill: T.FG.muted, letterSpacing: 1 },
});
metaTxt.anchor.set(0.5, 0);
metaTxt.x = TILE_W / 2;
metaTxt.y = SPIRIT_ZONE_Y + SPIRIT_ZONE_H + 4;        // just below sprite zone
tile.addChild(metaTxt);
```

`META_Y` const 可移除（直接 inline 計算）。

**Commit 2**: `polish(chore): DraftScreen name overlay 24pt + clan-glow + dark outline; meta text 9pt below sprite`

---

### 3c. Commit 3 — A/B 按鈕底部對齊 + 圓 badge 微調

當前 line 390-431 的 `btnA` / `btnB` Container + `badgeA` / `badgeB` 不動，只確認：

#### 3c-1. button position

`BTN_ZONE_Y = TILE_H - 32 - 6 = 182`（const 已調，btnA/B 自動跟）。

#### 3c-2. badge 角落位置

當前 badgeA `x=-6, y=-6`（左上）；badgeB `x=TILE_W-18, y=-6`（右上）— 保留不動。

#### 3c-3. button hit area + 視覺對比

確認 button bg 在 redrawTile 內畫對 alpha / border。**不改邏輯**，只**目測對比**確保 A/B 按鈕在新版面（sprite overlay 下方 + 文字 strip）仍清晰可點。

若視覺糊（sprite alpha 高蓋住 button），加：
```ts
// btn bg: opaque gradient bar so A/B stays legible against busy sprite tile
btnABg.fill({ color: 0x000000, alpha: 0.45 });    // darker bg for legibility
```
具體調整視 build preview 觀察決定。

**Commit 3**: `polish(chore): DraftScreen A/B button bottom-anchor + button bg darker for legibility on busy tile`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/DraftScreen.ts`（const layout + drawSpiritTile sprite swap + name/meta style）

**禁止**：
- 動 SpiritPortrait component（保留給 BattleScreen 其他地方）
- 動 SymbolsConfig / Resonance / draft 邏輯 / toggle / mirror / random / startBattle
- 動 spirit webp 檔案 / Asset 名稱
- 改 BattleScreen / ResultScreen / 其他 screen
- 改 main.ts / SPEC.md / DesignTokens / sim-rtp.mjs
- 加新 asset
- 動 SpiritPortrait.ts（其他 caller 仍用 round portrait）
- TILE_W 不變（保 2-per-row layout）

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - DraftScreen 8 隻 spirit 都顯示**整隻全身**（不再小圓頭像）
   - 角色名（孟辰珅 / 凌羽 / 寅 / 珞洛 / 朱鸞 / 凌羽 / 朝雨 / 玄墨）大字 24pt overlay 在 sprite 上半，dark outline 清楚可讀
   - 4 clan banner（青龍 / 白虎 / 朱雀 / 玄武）+ 8 spirit grid 仍**正常垂直排列**，CANVAS 1280px 不超出（toolbar / status 仍 visible）
   - A / B 圓 badge / button 仍可點 + visual feedback（hover / select state）正常
   - W:21  11.4% meta text 縮小放角色名上方 / sprite 下方，不擾亂視覺
5. 截圖 1 張：DraftScreen 完整 visible（含 4 clan + 8 spirit + start battle button）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 實際 TILE_H 採用值（若 220 太擠則 180 或 200）
- spirit aspect ratio handling：是否所有 8 隻 sprite 都正確 fit SPIRIT_ZONE（無 stretch / 比例變形）
- name overlay 是否清楚（dark outline 夠不夠）
- A/B button 在 busy 卡片上是否仍易點
- Spec deviations：預期 0
