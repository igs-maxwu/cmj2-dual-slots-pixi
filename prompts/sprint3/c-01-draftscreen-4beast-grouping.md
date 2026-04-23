# Sprint 3 C · 01 — DraftScreen 4-beast clan grouping (T7 theme depth kickoff)

## 1. Context

PR: **Sprint 3 C · DraftScreen 改為 4 聖獸分組佈局**，每排 = 1 clan，加 ClanBanner + CLAN 色票，讓玩家在選雀靈階段就能看見 4 beast 歸屬（SPEC §8 passive + Sprint 5 Resonance 前置 UI）。

Why: Sprint 3 A + B 把角色層（signatures + passives）補滿，C 階段要把 4 聖獸世界觀從資料層「外顯到畫面」。目前 DraftScreen 是 4×2 扁平網格，玩家看不出青龍/白虎/朱雀/玄武歸類。改完後 Sprint 5 Resonance 機制（2-2 pair x1.5 / 4-of-a-kind x2.0）玩家立刻看得懂。

Source:
- SPEC §11 Sprint 3 row：「T7 4-beast theme depth」
- **Design mockup**（唯一真理）：
  - `download_picture/dual-slot-pixi/project/Symbol Draft.html`
  - `download_picture/dual-slot-pixi/project/app.jsx`（React 原型，請 Read **全檔**，逐像素照抄視覺）
- MemPalace drawer `82fc422428be5f4b` (Sprint 3B closure + 4 passive 對應 clan)
- `src/config/SymbolsConfig.ts` 已有 `clan` 欄位於每個 SymbolDef
- `src/config/DesignTokens.ts` 目前只有 `TEAM.azure` + `TEAM.vermilion`（player side 用），**無** clan 色票
- 現有 DraftScreen `src/screens/DraftScreen.ts`（520 行，整段 buildTiles 需重做）

Base: `master` HEAD（Sprint 3B 全 merge 後）
Target: `feat/sprint3c-01-draft-clan-grouping`

## 2. Spec drift check (P6 — mandatory)

執行前 **必做**：

1. `mempalace_search "Sprint 3C draft 4 beast clan grouping T7 theme depth"` + `"DraftScreen clan banner color tokens"`。
2. `Read` mockup 兩個檔案：`Symbol Draft.html` 全檔 + `app.jsx` 全檔。`app.jsx` 是 prototype（React），**不要照抄結構**，但視覺規格（色碼、尺寸、圓角、陰影、字型、間距）一律照抄。
3. 確認：clan 字串是否仍為 `'azure' | 'vermilion' | 'white' | 'black'`（grep `SymbolsConfig.ts`）。
4. 若發現 mockup 與 SPEC / SymbolsConfig 衝突（例如 clan 名稱不一致）**STOP 回報**，不要猜。

## 3. Task

### 3a. 新增 CLAN 色票 to `src/config/DesignTokens.ts`

在 `TEAM` 區塊**之後**（約 line 63 後）加入新 block：

```ts
// ─── Clan · 4 聖獸（青龍 / 白虎 / 朱雀 / 玄武）────────────────────────────
// 與 TEAM 色故意偏移（TEAM 是 player A/B side，CLAN 是聖獸歸屬）— 避免混淆。
export const CLAN = {
  azure:         0x38b6f5,  // 青龍 teal-sky
  azureGlow:     0x7ae8ff,
  white:         0xe8c87a,  // 白虎 amber-gold（非純白，避免消失）
  whiteGlow:     0xfff0b3,
  vermilion:     0xff6b35,  // 朱雀 flame-orange
  vermilionGlow: 0xffaa70,
  black:         0x6b9e8a,  // 玄武 jade-sea
  blackGlow:     0xa8e8d0,
} as const;

export type ClanId = 'azure' | 'white' | 'vermilion' | 'black';

export const CLAN_META: Record<ClanId, {
  cn: string; en: string; color: number; glow: number;
}> = {
  azure:     { cn: '青龍', en: 'Azure Dragon',     color: CLAN.azure,     glow: CLAN.azureGlow     },
  white:     { cn: '白虎', en: 'White Tiger',      color: CLAN.white,     glow: CLAN.whiteGlow     },
  vermilion: { cn: '朱雀', en: 'Vermilion Bird',   color: CLAN.vermilion, glow: CLAN.vermilionGlow },
  black:     { cn: '玄武', en: 'Black Tortoise',   color: CLAN.black,     glow: CLAN.blackGlow     },
};
```

### 3b. 重構 `src/screens/DraftScreen.ts`

#### 3b-1. Layout 常數（取代現有 COLS/ROWS/TILE_W/TILE_H）

```ts
const CLAN_ORDER: ClanId[] = ['azure', 'white', 'vermilion', 'black'];
const TILE_W = 152;
const TILE_H = 152;
const TILE_GAP = 40;           // 兩顆 tile 水平間距
const BANNER_H = 32;
const BANNER_TO_TILES_GAP = 8; // banner 底下留 8px 再放 tile row
const CLAN_ROW_GAP = 12;       // clan 與 clan 間距
const ROW_H = BANNER_H + BANNER_TO_TILES_GAP + TILE_H;  // 192
const GRID_H = ROW_H * 4 + CLAN_ROW_GAP * 3;            // 4*192 + 36 = 804
const GRID_Y = 160;                                      // title+wallet 區之後
// two tiles centered in 720 canvas: total width 2*152 + 40 = 344
const TILES_TOTAL_W = TILE_W * 2 + TILE_GAP;
const TILES_START_X = Math.round((CANVAS_WIDTH - TILES_TOTAL_W) / 2);
```

#### 3b-2. Data 分組：在 buildTiles() 之前新建 helper

```ts
// Group SYMBOLS by clan, preserving SymbolsConfig id order within each clan.
function spiritsByClan(): Record<ClanId, { sym: SymbolDef; idx: number }[]> {
  const out: Record<ClanId, { sym: SymbolDef; idx: number }[]> = {
    azure: [], white: [], vermilion: [], black: [],
  };
  SYMBOLS.forEach((sym, idx) => { out[sym.clan as ClanId].push({ sym, idx }); });
  return out;
}
```

驗證：執行後應該每個 clan 陣列長度為 2，總 8 = 匹配 SPEC §4。若不成立 **throw Error** 讓測試直接炸給你看。

#### 3b-3. 重寫 `buildTiles()`：遍歷 CLAN_ORDER，每 clan 先 draw banner 再 draw 2 tiles

偽碼：

```ts
const grouped = spiritsByClan();
const totalW = SYMBOLS.reduce((s, x) => s + x.weight, 0);

CLAN_ORDER.forEach((clanId, rowIdx) => {
  const meta = T.CLAN_META[clanId];
  const rowY = GRID_Y + rowIdx * (ROW_H + CLAN_ROW_GAP);

  // --- ClanBanner (720x32) ---
  this.drawClanBanner(clanId, meta, rowY);

  // --- 2 tiles for this clan, below banner ---
  const tileY = rowY + BANNER_H + BANNER_TO_TILES_GAP;
  grouped[clanId].forEach((entry, col) => {
    const tileX = TILES_START_X + col * (TILE_W + TILE_GAP);
    this.drawSpiritTile(entry.sym, entry.idx, meta, tileX, tileY, totalW);
  });
});
```

#### 3b-4. `drawClanBanner(clanId, meta, rowY)` 方法

照 mockup `ClanBanner` component（app.jsx 200-266）：

```ts
private drawClanBanner(clanId: ClanId, meta, rowY: number): void {
  const banner = new Container();
  banner.x = 0; banner.y = rowY;
  this.container.addChild(banner);

  // Background panel (720x32)，從 clan 色 12% alpha fade 到透明 + panelSolid 底
  const bg = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, BANNER_H)
    .fill({ color: T.SURF.panelSolid.color, alpha: 1.0 });
  // clan-tint gradient overlay — Pixi 8 FillGradient linear
  const tint = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, BANNER_H)
    .fill({
      fill: new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 }, end: { x: CANVAS_WIDTH * 0.6, y: 0 },
        textureSpace: 'local',
        colorStops: [
          { offset: 0,   color: { r: meta.colorR, g: meta.colorG, b: meta.colorB, a: 0.13 } },  // or similar; use number w/ alpha form
          { offset: 1,   color: { r: 0, g: 0, b: 0, a: 0 } },
        ],
      }),
    });
  // If FillGradient API won't take alpha stops cleanly, fallback:
  // simple solid fill at alpha 0.10 is acceptable. Don't burn >3 edits trying for fancy gradient.
  banner.addChild(bg);
  banner.addChild(tint);

  // 4px left color bar with glow
  const bar = new Graphics()
    .rect(0, 0, 4, BANNER_H)
    .fill(meta.color);
  banner.addChild(bar);

  // Hairline top + bottom 1px in clan color 20% alpha
  const hairline = new Graphics()
    .moveTo(0, 0).lineTo(CANVAS_WIDTH, 0)
    .moveTo(0, BANNER_H - 1).lineTo(CANVAS_WIDTH, BANNER_H - 1)
    .stroke({ width: 1, color: meta.color, alpha: 0.2 });
  banner.addChild(hairline);

  // Chinese calligraphy name (20px, clan color)
  const cn = new Text({
    text: meta.cn,
    style: {
      fontFamily: T.FONT.display,  // Ma Shan Zheng
      fontSize: 20, fontWeight: '700',
      fill: meta.color,
      dropShadow: { color: meta.color, alpha: 0.5, blur: 4, distance: 0 },
      letterSpacing: 2,
    },
  });
  cn.anchor.set(0, 0.5);
  cn.x = 16; cn.y = BANNER_H / 2;
  banner.addChild(cn);

  // Separator dot
  const dot = new Text({ text: '·', style: { fontSize: 11, fill: T.FG.muted } });
  dot.anchor.set(0, 0.5);
  dot.x = 16 + cn.width + 8; dot.y = BANNER_H / 2;
  banner.addChild(dot);

  // English name (11px muted, uppercase, letterSpacing wide)
  const en = new Text({
    text: meta.en.toUpperCase(),
    style: { fontFamily: T.FONT.title, fontSize: 11, fill: T.FG.muted, letterSpacing: 3 },
  });
  en.anchor.set(0, 0.5);
  en.x = dot.x + 14; en.y = BANNER_H / 2;
  banner.addChild(en);

  // Right reserved zone (Sprint 5 Resonance hook)
  const rightHint = new Text({
    text: '◇ RESONANCE',
    style: { fontFamily: T.FONT.num, fontSize: 9, fill: T.FG.muted, letterSpacing: 2 },
  });
  rightHint.anchor.set(1, 0.5);
  rightHint.x = CANVAS_WIDTH - 16; rightHint.y = BANNER_H / 2;
  rightHint.alpha = 0.35;
  banner.addChild(rightHint);
  // RESONANCE_HOOK: Sprint 5 will replace this with pip indicator (2-pair x1.5 / 4-kind x2.0)
}
```

#### 3b-5. `drawSpiritTile` 重構（替代現有 forEach 內的 tile 建構）

關鍵 **視覺變化**（照 mockup `SpiritTile` app.jsx 268-429）：

1. **背景**：垂直漸層 `#12305a → #0a1f3c`（180°）— 用 FillGradient 或直接兩層 Graphics 疊蓋疊色
2. **不再用 `draft-tile-frame.png`**：mockup 純 Graphics；**刪除** frame Sprite 相關程式碼 + 保留 `addCornerOrnaments` 外層裝飾
3. **Portrait 圓形**：52×52，位置 (50, 10) tile 相對座標 = 中心 (76, 36)。背景 radial-gradient (clan color 0.4 → #1a3560 0.6 → #0a1f3c 1.0)；border 1.5px clan color；glow 10px clan color 33% alpha
4. **Chinese name**：y=65 (top anchor) 或 y=73 center anchor，16px Noto Serif TC 700，letterSpacing 2.4（mockup 0.15em of 16px ≈ 2.4）
5. **Meta row**：y=86 top，11px Cinzel fill muted，letterSpacing 0.88
6. **Pick buttons**：y=110 h=32，inset 6px 左右，gap 4px。寬度 = (152 - 12 - 4) / 2 = 68px
7. **Inner hairline gold border**：inset 4px，roundRect r=7，stroke 1px gold base alpha 0.25
8. **Selection outline / glow**（取代現有 refresh() 的 roundRect stroke）：
   - A only: 3px `T.TEAM.azure` outline + inner glow #8fc1f4
   - B only: 3px `T.TEAM.vermilion` outline + inner glow #f29b92
   - Both: 4px `T.GOLD.glow` outline + inner glow gold pale
   - None: 2px `T.GOLD.base` baseline outline, no extra glow
9. **Corner badges 24×24**：位置 **外凸** (-6, -6)（top-left 給 A）與 (TILE_W-18, -6)（top-right 給 B），兩層 circle：fill player color + 2px gold-pale border，字 "A"/"B" white Cinzel 12px bold。只在被選中時 `visible=true`

### 3c. WalletRow 加 clan-count 讀數（新功能，從 mockup）

在現有 `drawDistribution` 之下（或整合進去）加一行讀數。格式：

```
A WEIGHT  青2·白1·朱1·玄1           玄1·朱2·白1·青1  B WEIGHT
```

- 左側 `A WEIGHT` 11px Cinzel muted letterSpacing 1
- clan counter：每個 clan 以 CN 首字 + 計數，顏色用 `T.CLAN.{clanId}`，若 count=0 則不顯示該 clan
- 右側 `B WEIGHT` 鏡像
- refresh() 時重算並更新 text

新建 method `updateClanCountReadout()` 每次 toggle 後呼叫。

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/config/DesignTokens.ts`（+約 20 行 CLAN block）
- `src/screens/DraftScreen.ts`（重寫 buildTiles + 新增 drawClanBanner / drawSpiritTile + 加 clan-count readout，淨變動約 +150 / −80 行）

**禁止**：
- `SymbolsConfig.ts`（clan 資料已存在，勿動）
- `BattleScreen.ts`（Sprint 3C-02 再碰）
- SPEC.md
- 新 PNG 素材（mockup 全 Graphics，`draft-tile-frame.png` 這個 asset **本 PR 要拿掉**但先別 `git rm` 檔案本身，只移除 load + Sprite 建立即可）
- `AudioManager` SFX 事件（沿用既有 `ui-draft-select` / `ui-apply`）
- `UiButton` / `goldText` / `SpiritPortrait` / `Decorations` 任何元件

**若發現既有程式碼 bug，STOP 回報，不要自己改**（Executor Rule P2）。

### 3e. 互動行為保留（不可變）

- A/B 按鈕 toggle 邏輯、`MAX_PICKS=5`、overflow lock（另一側滿 5 時該側鎖灰）
- CLEAR / MIRROR A→B / RANDOM 5+5 / START BATTLE 按鈕行為 100% 不變
- hover 狀態（button 變深、border 換 gold）保留
- pulse 脈動效果保留
- `DraftResult` output 資料結構不變（`launch()` method 保持）

### 3f. §3c 視覺精修（選配，可延後）

若時間允許：
- Banner 右側 `◇ RESONANCE` 文字加上呼吸 alpha 0.25→0.45 循環 1500ms
- Portrait 圓加上細微旋轉微粒（clan color，1-2 個，3000ms 週期）

若 >10 行請跳過，留 polish PR。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- **Mockup 是真理**：任何模糊點先 Read `app.jsx` 對應 component，不要即興發揮
- 4 clan × 2 tile = 8 總數必須與 SYMBOLS.length 一致，否則 throw
- `FillGradient` Pixi 8 API 採 `start: {x,y}, end: {x,y}` 格式（不是 `x0/y0/x1/y1`）— 見既有 `GoldText.ts` 範例
- `DraftScreen.ts` 編輯 ≥ 3 次未收斂 → STOP 回報
- onUnmount 的 `this.container.destroy({ children: true })` 邏輯不變，新增的 banner / tile 都要是 container 的子層，不要掛在 stage 直接

## 5. Handoff

- PR URL
- 1 行摘要（PR title + 主要 visual delta）
- Spec deviations：預期 0；若有，列條目說明為何
- Dependencies：CLAN 色票已在本 PR 新加；後續 Sprint 3C-02 BattleScreen clan 呼吸光 + Sprint 5 Resonance 會 reuse
- 是否有做 §3f 視覺精修
- 是否確認 mockup `app.jsx` 的 `app.jsx`/`Symbol Draft.html` 讀取無誤
- 任何 Pixi 8 API 與 mockup React 語意對不上時的判斷說明（例如 box-shadow 在 Pixi 改用 GlowFilter 或 drop shadow）
