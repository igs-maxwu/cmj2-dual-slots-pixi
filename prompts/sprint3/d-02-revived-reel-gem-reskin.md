# Sprint 3 D · 02（復活）— SlotReel 用 SOS2 gem symbols 取代圓框 portrait

## 1. Context

PR: **Reel 轉軸不再用圓框 SpiritPortrait，改用 SOS2 五顆寶石（triangle/diamond/pentagon/square/hexagon）**

Why: Owner mockup 2026-04-23 顯示 reel 格子是**金框彩色寶石**（紫五邊、紅方、黃三角、藍菱、橙六邊），風格與 SOS2 Egyptian-fantasy 素材一致。目前 SlotReel 每格塞 `SpiritPortrait`（圓框 + 雀靈肖像），視覺過度重複（BattleScreen 5×3 = 15 個圓框 + formation 的 portrait 一起炸太多圓形）。

改用寶石 = **信息分層**：雀靈 = 角色（站在戰場上），寶石 = 符號（出現在轉軸上），配對關係保留（symbolId 仍是 0~7）。

Source:
- PR #62 d-00 SOS2 assets: `public/assets/symbols/gems/gem-{triangle,diamond,pentagon,square,hexagon}.webp`（5 顆，每顆 ~1.8 KB）
- `src/config/SymbolsConfig.ts` 每個 SymbolDef 已有 `shape: 'triangle'|'hexagon'|'square'|'cross'|'circle'|'heart'|'diamond'|'star'` 欄位
- `src/screens/SlotReel.ts` line 130 `new SpiritPortrait(0, 100)` 是主要改點
- Owner mockup: `download_picture/dual-slot-pixi/battle-redesign/mockup.png`（若未放，STOP 等 owner）

Base: master HEAD（可 **並行** c-02 free-standing spirits PR，兩者不同檔案）
Target: `feat/sprint3d-02-reel-gem-reskin`

## 2. Spec drift check (P6 — mandatory)

1. `mempalace_search "SlotReel gem reskin symbol reskin SOS2 d-02"`
2. `ls public/assets/symbols/gems/` 確認 5 個 webp 存在
3. `grep -n shape src/config/SymbolsConfig.ts` 查 8 個 spirit shape 分布：
   ```
   id:0 Yin       triangle
   id:1 Zhuluan   hexagon
   id:2 Zhaoyu    square
   id:3 Meng      cross      ← 無 gem 對應
   id:4 Canlan    circle     ← 無 gem 對應
   id:5 Luoluo    heart      ← 無 gem 對應
   id:6 Lingyu    diamond
   id:7 Xuanmo    star       ← 無 gem 對應
   ```
4. **重要發現**：SOS2 只有 5 顆寶石形狀，但 SYMBOLS 有 8 種。**3 個 spirit（Meng cross、Canlan circle、Luoluo heart、Xuanmo star）沒有 gem 對應**。

### 對應策略（Task §3a 會實作）

方案：**按 clan 分組複用 5 顆 gem**，不做形狀對應：

| Symbol ID | Spirit | Clan | Gem asset | Tint |
|---|---|---|---|---|
| 0 | Yin (白虎) | white | `gem-triangle.webp` | `T.CLAN.white` (amber) |
| 1 | Zhuluan (朱雀) | vermilion | `gem-hexagon.webp` | `T.CLAN.vermilion` (flame) |
| 2 | Zhaoyu (玄武) | black | `gem-square.webp` | `T.CLAN.black` (jade) |
| 3 | Meng (青龍) | azure | `gem-pentagon.webp` | `T.CLAN.azure` (teal) |
| 4 | Canlan (青龍) | azure | `gem-diamond.webp` | `T.CLAN.azure` (teal) |
| 5 | Luoluo (白虎) | white | `gem-square.webp` | `T.CLAN.white` reused |
| 6 | Lingyu (朱雀) | vermilion | `gem-diamond.webp` | `T.CLAN.vermilion` reused |
| 7 | Xuanmo (玄武) | black | `gem-pentagon.webp` | `T.CLAN.black` reused |

**同 clan 的兩隻共享形狀但靠 tint 與 clan 色區分**。mockup 可見紫/紅/黃/藍/橙 = 5 色彩分佈。

## 3. Task

### 3a. 新增 `src/config/GemMapping.ts`（新檔，小 helper）

```ts
import type { SymbolDef } from './SymbolsConfig';
import * as T from './DesignTokens';

export interface GemAsset {
  assetKey: string;    // 'gem-triangle' | ...
  tint:     number;    // CLAN color
}

// Keyed by SYMBOLS[id].id
export const GEM_FOR_SYMBOL: Record<number, GemAsset> = {
  0: { assetKey: 'gem-triangle', tint: T.CLAN.white     },
  1: { assetKey: 'gem-hexagon',  tint: T.CLAN.vermilion },
  2: { assetKey: 'gem-square',   tint: T.CLAN.black     },
  3: { assetKey: 'gem-pentagon', tint: T.CLAN.azure     },
  4: { assetKey: 'gem-diamond',  tint: T.CLAN.azure     },
  5: { assetKey: 'gem-square',   tint: T.CLAN.white     },
  6: { assetKey: 'gem-diamond',  tint: T.CLAN.vermilion },
  7: { assetKey: 'gem-pentagon', tint: T.CLAN.black     },
};

export function gemForSymbol(sym: SymbolDef): GemAsset {
  return GEM_FOR_SYMBOL[sym.id] ?? { assetKey: 'gem-triangle', tint: 0xffffff };
}
```

### 3b. Preload 5 gem assets（修改 `src/main.ts` 或 LoadingScreen）

在既有 `Assets.load` manifest 裡加 5 個 gem：

```ts
Assets.add({
  alias: 'gem-triangle', src: `${import.meta.env.BASE_URL}assets/symbols/gems/gem-triangle.webp`,
});
// ...repeat for diamond/pentagon/square/hexagon
```

若既有 preload 是 bundle 形式，加到同一 bundle。請查現有 pattern（grep `Assets.add` 或 `Assets.loadBundle`）。

### 3c. `SlotReel.ts` 換 cell 建構邏輯

line 130 附近：

```ts
// BEFORE:
const portrait = new SpiritPortrait(0, 100);
portrait.y = 0;
container.addChild(portrait);

// AFTER:
const gemSprite = new Sprite(Texture.WHITE);  // placeholder, updated by setCellSymbol
gemSprite.anchor.set(0.5);
gemSprite.y = 0;
container.addChild(gemSprite);
```

`Cell` interface 改：

```ts
interface Cell {
  container:     Container;
  gemSprite:     Sprite;            // was: portrait: SpiritPortrait
  overlay:       Graphics;
  currentSymbol: number;
}
```

### 3d. `setCellSymbol()` 重寫

```ts
private setCellSymbol(cell: Cell, symId: number): void {
  if (cell.currentSymbol === symId) return;
  cell.currentSymbol = symId;
  const gemInfo = gemForSymbol(SYMBOLS[symId]);
  const tex = Assets.get<Texture>(gemInfo.assetKey);
  if (tex) {
    cell.gemSprite.texture = tex;
    // Size gem to ~80% of cell size
    const targetSize = Math.min(CELL_W, CELL_H) * 0.80;
    const scale = targetSize / Math.max(tex.width, tex.height);
    cell.gemSprite.scale.set(scale);
  }
  cell.gemSprite.tint = gemInfo.tint;
}
```

### 3e. 刪除 SpiritPortrait import（從 SlotReel.ts）

SlotReel 已不需要 `SpiritPortrait`，移除 import line 5。（但 DraftScreen 還在用 SpiritPortrait — 別動 `src/components/SpiritPortrait.ts`）

### 3f. 檔案範圍（嚴格）

**新增**：`src/config/GemMapping.ts`（~30 行）

**修改**：
- `src/screens/SlotReel.ts`（換 Cell struct + setCellSymbol + 刪 SpiritPortrait import，淨變動約 +25 / −20 行）
- `src/main.ts` 或 LoadingScreen（加 5 個 Assets.add / bundle entry）

**禁止**：
- `src/components/SpiritPortrait.ts`（DraftScreen 還在用）
- `SymbolsConfig.ts`（data 不動）
- `DesignTokens.ts`（CLAN 已在 c-01 加過）
- `BattleScreen.ts`（c-02 在動）
- SPEC.md

**若 gem mapping 有疑慮（example shape vs actual shape 不合），STOP 回報**。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- 5 顆 gem × 5 colors × 8 spirit → 會有同 gem+同色重複（如 Luoluo square/white 與 Zhaoyu square/black 不衝突但 Zhuluan hexagon/vermilion 和 Lingyu diamond/vermilion 同 clan 不同 gem 可區分）— 這是預期，不要試圖找完美 1:1 對應
- `Texture.WHITE` placeholder 後立即 `setCellSymbol()` 蓋掉，build 時 ticker 未跑不會看到白框
- Highlight ways 動畫（既有 `highlightWays()`）不需改 — tint / alpha tween 套在 gemSprite 上一樣 work
- SlotReel 編輯 ≥ 3 次無法過 build → STOP 回報

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：預期 0；若 gem tint 在某 clan 視覺太暗/太亮請說明
- Dependencies：c-01 (CLAN tokens) ✅ / d-00 gem assets ✅
- 是否有做視覺上的微調（gem shadow、hover 光暈等）
- 確認 highlightWays / attack animations 在新 gem sprite 上仍正常
