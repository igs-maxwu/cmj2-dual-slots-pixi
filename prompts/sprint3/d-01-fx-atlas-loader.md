# Sprint 3 D · 01 — FX Atlas Loader + per-clan tint helper

## 1. Context

PR: **Sprint 3 D · 建立 FXAtlas 載入系統，讓後續 FX 功能 PR 可 reuse SOS2 FX 雪碧圖**

Why: PR #62 已把 SOS2 FX（`sos2-bigwin.webp` / `sos2-near-win.webp` / `sos2-declare-fire.webp` + 其他 standalone webp）放進 `public/assets/fx/`。每張 atlas 帶 `.atlas` 伴檔（Spine format，已將檔頭 `BigWin.png` 改寫為 `sos2-bigwin.webp`）。現在需要**一個統一的 loader + Sprite factory**，讓之後 d-02 ~ d-07 每個 FX PR 都只要呼叫 `FXAtlas.sprite('sos2-bigwin:Coin/Coin_01')` 就能拿到可用 `Sprite`。**本 PR 只做基礎設施，不動任何現有 FX 行為**。

Source:
- PR #62 chore/sos2-asset-import（assets 已在 master）
- `prompts/sprint3/D-ROADMAP.md`（整體 Sprint 3D 規劃）
- Spine atlas 格式：行為 `region_name\n  rotate: false\n  xy: x, y\n  size: w, h\n  orig: ow, oh\n  offset: ox, oy\n  index: -1`
- Pixi 8：`Assets.load()` 不原生支援 Spine atlas 格式（它只吃 TexturePacker JSON）。本 PR 自刻簡單 parser。

Base: master HEAD（PR #62 after merge）
Target: `feat/sprint3d-01-fx-atlas-loader`

## 2. Spec drift check (P6 — mandatory)

1. `mempalace_search "Sprint 3D FX atlas SOS2 loader"` + `"D-ROADMAP FXAtlas"`
2. `ls public/assets/fx/` 確認 13 個檔案（10 個 webp + 3 個 atlas）齊備
3. `Read` 一份 `.atlas` 檔（建議 `public/assets/fx/sos2-bigwin.atlas`）確認格式與 prompt 描述一致
4. 若 FXAtlas 既有類似模組（grep `src/fx/` 有無 `FXAtlas` / `SpriteSheet` / `TextureAtlas` 已存在），STOP 回報 — 不能重複造輪子

## 3. Task

### 3a. 新增 `src/fx/FXAtlas.ts`（新檔，約 120 行）

```ts
import { Assets, Texture, Rectangle, Sprite } from 'pixi.js';

interface AtlasRegion {
  name: string;
  rotate: boolean;
  xy: [number, number];
  size: [number, number];
  orig: [number, number];   // pre-trim original size (for anchor correction)
  offset: [number, number]; // trim offset
}

interface AtlasSheet {
  webpPath: string;             // e.g. 'assets/fx/sos2-bigwin.webp'
  baseTexture: Texture;         // loaded via Pixi Assets
  regions: Map<string, AtlasRegion>;
  regionTextures: Map<string, Texture>;  // cached sub-textures
}

/**
 * Minimal Spine-format .atlas parser + Pixi sprite factory.
 *
 * Usage:
 *   await FXAtlas.load([
 *     { name: 'sos2-bigwin',   atlas: 'assets/fx/sos2-bigwin.atlas' },
 *     { name: 'sos2-near-win', atlas: 'assets/fx/sos2-near-win.atlas' },
 *   ]);
 *   const coin = FXAtlas.sprite('sos2-bigwin:Coin/Coin_01');
 *
 * Region key format: '<sheetName>:<regionName>'
 * Sheet is loaded lazily if not preloaded; sprite() is async-safe only if preload done.
 */
class FXAtlasManager {
  private sheets = new Map<string, AtlasSheet>();

  async load(entries: { name: string; atlas: string }[]): Promise<void> {
    for (const e of entries) {
      if (this.sheets.has(e.name)) continue;
      const atlasText = await fetch(e.atlas).then(r => r.text());
      const parsed = this.parseAtlas(atlasText);
      // Resolve webp path: first non-empty line of atlas header is the filename.
      // Assume atlas is at same dir as webp; webp path = dirname(atlas) + parsed.header
      const base = e.atlas.substring(0, e.atlas.lastIndexOf('/') + 1);
      const webpPath = base + parsed.header;
      const baseTexture = await Assets.load<Texture>(webpPath);
      this.sheets.set(e.name, {
        webpPath, baseTexture,
        regions: parsed.regions,
        regionTextures: new Map(),
      });
    }
  }

  sprite(key: string): Sprite {
    const [sheetName, regionName] = this.splitKey(key);
    const sheet = this.sheets.get(sheetName);
    if (!sheet) throw new Error(`[FXAtlas] sheet not loaded: ${sheetName}`);
    let tex = sheet.regionTextures.get(regionName);
    if (!tex) {
      const r = sheet.regions.get(regionName);
      if (!r) throw new Error(`[FXAtlas] region not in ${sheetName}: ${regionName}`);
      // Note: if r.rotate === true, the region is stored 90° in the source image.
      // Pixi 8 Texture has no rotated-subtexture; we ignore rotate for MVP and
      // let callers that hit rotated regions know to apply sprite.rotation = -Math.PI/2.
      const frame = new Rectangle(r.xy[0], r.xy[1], r.size[0], r.size[1]);
      tex = new Texture({ source: sheet.baseTexture.source, frame });
      sheet.regionTextures.set(regionName, tex);
    }
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    return s;
  }

  /** Return region bbox (for debugging / dev tools). */
  regionInfo(key: string): AtlasRegion | undefined {
    const [sheetName, regionName] = this.splitKey(key);
    return this.sheets.get(sheetName)?.regions.get(regionName);
  }

  /** List all region keys (for FX harness dropdown, etc). */
  listRegions(sheetName: string): string[] {
    const sheet = this.sheets.get(sheetName);
    if (!sheet) return [];
    return Array.from(sheet.regions.keys());
  }

  private splitKey(key: string): [string, string] {
    const i = key.indexOf(':');
    if (i < 0) throw new Error(`[FXAtlas] bad key "${key}", expect "<sheet>:<region>"`);
    return [key.substring(0, i), key.substring(i + 1)];
  }

  private parseAtlas(text: string): { header: string; regions: Map<string, AtlasRegion> } {
    const lines = text.split(/\r?\n/);
    let header = '';
    const regions = new Map<string, AtlasRegion>();
    let i = 0;
    // Skip empty lines; first non-empty = png filename header
    while (i < lines.length && !lines[i].trim()) i++;
    header = lines[i].trim();
    i++;
    // Skip size/format/filter/repeat header block (indented lines starting with "key:")
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      // Region name is flush-left (no leading space); property rows are indented with spaces
      if (line.startsWith(' ') || line.startsWith('\t')) { i++; continue; }
      if (line.includes(':')) { i++; continue; } // skip header "format:..." etc
      break;
    }
    // Parse region blocks
    let current: Partial<AtlasRegion> | null = null;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) {
        if (current?.name) {
          regions.set(current.name, current as AtlasRegion);
          current = null;
        }
        continue;
      }
      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        if (current?.name) regions.set(current.name, current as AtlasRegion);
        current = { name: line.trim(), rotate: false };
        continue;
      }
      if (!current) continue;
      const t = line.trim();
      const kv = t.split(/:\s*/);
      if (kv.length < 2) continue;
      const [key, val] = kv;
      const nums = val.split(/\s*,\s*/).map(Number);
      if (key === 'rotate') current.rotate = val === 'true';
      else if (key === 'xy')     current.xy     = [nums[0], nums[1]];
      else if (key === 'size')   current.size   = [nums[0], nums[1]];
      else if (key === 'orig')   current.orig   = [nums[0], nums[1]];
      else if (key === 'offset') current.offset = [nums[0], nums[1]];
    }
    if (current?.name) regions.set(current.name, current as AtlasRegion);
    return { header, regions };
  }
}

export const FXAtlas = new FXAtlasManager();

/**
 * Per-clan tint helper. SOS2 FX sheets are largely grayscale/white,
 * so `sprite.tint = clanTint('azure')` converts one FX into 4 clan-colored variants.
 */
export function clanTint(clan: 'azure' | 'white' | 'vermilion' | 'black'): number {
  switch (clan) {
    case 'azure':     return 0x38b6f5;  // matches CLAN.azure from DesignTokens (d-02 will reuse)
    case 'white':     return 0xe8c87a;
    case 'vermilion': return 0xff6b35;
    case 'black':     return 0x6b9e8a;
  }
}
```

### 3b. Preload 整合 — 改 `src/main.ts`（或既有 LoadingScreen）

現有 Pixi 啟動流程（grep `new Application`）裡，在 `Assets.load` 既有 manifest 之後、建立 ScreenManager 之前，加入：

```ts
import { FXAtlas } from '@/fx/FXAtlas';

await FXAtlas.load([
  { name: 'sos2-bigwin',        atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-bigwin.atlas` },
  { name: 'sos2-near-win',      atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-near-win.atlas` },
  { name: 'sos2-declare-fire',  atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-declare-fire.atlas` },
]);
```

**注意 `import.meta.env.BASE_URL`** 因 GitHub Pages 部署 base path 是 `/cmj2-dual-slots-pixi/`，不能寫死 `/assets/...`。參考既有 audio / ui 資產 preload 寫法保持一致。

### 3c. 可選擴充 FXPreviewScreen（選配，若 >15 行就跳過）

若 `src/screens/FXPreviewScreen.ts` 存在（PR #46）且本 PR 時間夠，新增 URL query param `?atlas=<sheet>:<region>` 顯示該 sprite 置中 + 可切換 4 clan tint。**超過 15 行請放到之後的 polish PR**。

### 3d. 檔案範圍（嚴格）

**新增**：`src/fx/FXAtlas.ts`（唯一新檔）

**修改**：`src/main.ts`（+5 ~ +8 行 preload 呼叫）

**禁止**：
- 任何 `src/screens/*` 現有 screen（BattleScreen / DraftScreen / SlotReel 等）的 FX 內容變更 — 那些是 d-02 ~ d-07 的工作
- SymbolsConfig.ts / DesignTokens.ts
- 新增 npm package（標準 Pixi 8 Texture + Rectangle 夠用）
- 任何 .webp 或 .atlas 改寫（已在 PR #62 處理）

**若發現 .atlas 檔案本身格式異常（parser 炸），STOP 回報，不要改 assets。**

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- **Parser 精簡：** 只要能 parse 已知 3 張 atlas 就算過關。不需支援 `index: 0+`（多 atlas page）、repeat、format 等進階欄位 — SOS2 atlas 皆為 single page。
- **Rotate 旗標處理**：MVP 可忽略（文件註明 caller 自行 `sprite.rotation = -Math.PI/2` 矯正），但 parser 必須正確解析 `rotate: true`，不能吞掉該 region
- **Texture frame**：Pixi 8 `new Texture({ source, frame })` 不是 `new Texture(source, frame)`（這是 v7 API），記得用物件形式
- 編輯 `FXAtlas.ts` ≥ 3 次無法過 build → STOP 回報
- 啟動時（Vite dev + build）**console 必須 zero error**；若 atlas path 404，表示 BASE_URL 沒接好

## 5. Handoff

- PR URL
- 1 行摘要（例如 "FXAtlas loader + 3 atlas preload integrated, 0 behavioral change"）
- Spec deviations：預期 0
- 確認 `npm run build` + preview 實機啟動 zero console error
- 是否有做 §3c FXPreview 擴充（選配）
- 簡述你所使用的 `Texture({ source, frame })` 呼叫是否有踩到 Pixi 8 API 坑
- Dependencies for downstream：d-02 ~ d-07 將 import `FXAtlas` 跟 `clanTint`，請確認命名可公開 reuse
