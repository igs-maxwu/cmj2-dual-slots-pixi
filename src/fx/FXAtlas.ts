import { Assets, Texture, Rectangle, Sprite } from 'pixi.js';

interface AtlasRegion {
  name:   string;
  rotate: boolean;
  xy:     [number, number];
  size:   [number, number];
  orig:   [number, number];   // pre-trim original size (for anchor correction)
  offset: [number, number];   // trim offset
}

interface AtlasSheet {
  webpPath:       string;                    // e.g. 'assets/fx/sos2-bigwin.webp'
  baseTexture:    Texture;                   // loaded via Pixi Assets
  regions:        Map<string, AtlasRegion>;
  regionTextures: Map<string, Texture>;      // cached sub-textures
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
 *
 * Rotate flag: MVP ignores rotation in the UV frame — callers that receive a region
 * with rotate===true should apply `sprite.rotation = -Math.PI / 2` to correct orientation.
 */
class FXAtlasManager {
  private sheets = new Map<string, AtlasSheet>();

  async load(entries: { name: string; atlas: string }[]): Promise<void> {
    for (const e of entries) {
      if (this.sheets.has(e.name)) continue;
      const atlasText = await fetch(e.atlas).then(r => r.text());
      const parsed    = this.parseAtlas(atlasText);
      // Resolve webp path: first non-empty line of atlas header is the filename.
      // Atlas and webp live in the same directory.
      const base      = e.atlas.substring(0, e.atlas.lastIndexOf('/') + 1);
      const webpPath  = base + parsed.header;
      const baseTex   = await Assets.load<Texture>(webpPath);
      this.sheets.set(e.name, {
        webpPath,
        baseTexture:    baseTex,
        regions:        parsed.regions,
        regionTextures: new Map(),
      });
    }
  }

  /** Create a new Sprite from a loaded region.  Anchor is centred (0.5, 0.5). */
  sprite(key: string): Sprite {
    const [sheetName, regionName] = this.splitKey(key);
    const sheet = this.sheets.get(sheetName);
    if (!sheet) throw new Error(`[FXAtlas] sheet not loaded: ${sheetName}`);
    let tex = sheet.regionTextures.get(regionName);
    if (!tex) {
      const r = sheet.regions.get(regionName);
      if (!r) throw new Error(`[FXAtlas] region not in ${sheetName}: ${regionName}`);
      // Pixi 8 API: new Texture({ source, frame }) — NOT new Texture(source, frame) (v7).
      // When rotate===true the region is stored rotated 90° in the source image;
      // we create the frame from the stored (rotated) dimensions and let the caller
      // correct orientation with sprite.rotation = -Math.PI/2 if needed.
      const frame = new Rectangle(r.xy[0], r.xy[1], r.size[0], r.size[1]);
      tex = new Texture({ source: sheet.baseTexture.source, frame });
      sheet.regionTextures.set(regionName, tex);
    }
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    return s;
  }

  /** Return region metadata (for debugging / dev tools). */
  regionInfo(key: string): AtlasRegion | undefined {
    const [sheetName, regionName] = this.splitKey(key);
    return this.sheets.get(sheetName)?.regions.get(regionName);
  }

  /** List all region keys for a sheet (for FX harness dropdown, etc). */
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
    const lines   = text.split(/\r?\n/);
    let   header  = '';
    const regions = new Map<string, AtlasRegion>();
    let   i       = 0;

    // Skip leading blank lines; first non-empty line = webp filename header
    while (i < lines.length && !lines[i].trim()) i++;
    header = lines[i].trim();
    i++;

    // Skip atlas header block: indented lines or lines containing ':' (size/format/filter/repeat)
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim())                                          { i++; continue; }
      if (line.startsWith(' ') || line.startsWith('\t'))        { i++; continue; }
      if (line.includes(':'))                                    { i++; continue; }
      break; // first flush-left non-colon line = first region name
    }

    // Parse region blocks
    let current: Partial<AtlasRegion> | null = null;
    for (; i < lines.length; i++) {
      const line = lines[i];

      if (!line.trim()) {
        // Blank line — flush current region
        if (current?.name) {
          regions.set(current.name, current as AtlasRegion);
          current = null;
        }
        continue;
      }

      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        // Flush previous region, start new one
        if (current?.name) regions.set(current.name, current as AtlasRegion);
        current = { name: line.trim(), rotate: false, orig: [0, 0], offset: [0, 0] };
        continue;
      }

      if (!current) continue;

      const t  = line.trim();
      const ci = t.indexOf(':');
      if (ci < 0) continue;
      const key = t.substring(0, ci).trim();
      const val = t.substring(ci + 1).trim();
      const nums = val.split(/\s*,\s*/).map(Number);

      switch (key) {
        case 'rotate': current.rotate = val === 'true'; break;
        case 'xy':     current.xy     = [nums[0], nums[1]]; break;
        case 'size':   current.size   = [nums[0], nums[1]]; break;
        case 'orig':   current.orig   = [nums[0], nums[1]]; break;
        case 'offset': current.offset = [nums[0], nums[1]]; break;
        // 'index' and unknown keys are intentionally ignored
      }
    }
    // Flush final region (file may not end with a blank line)
    if (current?.name) regions.set(current.name, current as AtlasRegion);

    return { header, regions };
  }
}

export const FXAtlas = new FXAtlasManager();

/**
 * Per-clan tint helper.  SOS2 FX sheets are largely grayscale/white,
 * so `sprite.tint = clanTint('azure')` converts one FX into 4 clan-coloured variants.
 * Colours mirror CLAN.* in DesignTokens.ts — kept in sync manually.
 */
export function clanTint(clan: 'azure' | 'white' | 'vermilion' | 'black'): number {
  switch (clan) {
    case 'azure':     return 0x38b6f5;
    case 'white':     return 0xe8c87a;
    case 'vermilion': return 0xff6b35;
    case 'black':     return 0x6b9e8a;
  }
}
