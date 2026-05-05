import { Container, Graphics, Text } from 'pixi.js';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';

/**
 * chore #200: shared gem drawer — used by SlotReel (reel cells) + DraftScreen (tile icon).
 *
 * Tier / shape mapping (matches SlotReel chore #199):
 *   id 0-2 (low,  1⭐) — 4-sided diamond ◇
 *   id 3-5 (mid,  2⭐) — 5-sided pentagon ⬠
 *   id 6-7 (high, 3⭐) — 6-sided hexagon ⬢
 *   id 8/10/11 (W/S/JP) — circle ⬤
 *   id 9 (Curse, weight=0) — pentagon fallback (never spawns)
 *
 * Color map (chore #198 — 8 unique gem colors, supersedes chore #173 clan-shared):
 *   0 寅 (白虎1) 0xfff0b3 米黃 · 1 鸞 (朱雀1) 0xff5050 朱紅
 *   2 雨 (玄武1) 0x4adb8e 翠綠 · 3 璋 (青龍1) 0x4a90e2 深藍
 *   4 嵐 (青龍2) 0x7ae8ff 天藍 · 5 洛 (白虎2) 0xffd980 淺金
 *   6 羽 (朱雀2) 0xff8a3a 橘紅 · 7 墨 (玄武2) 0x9a4adb 紫晶
 */

// ─── Shared data ─────────────────────────────────────────────────────────────

export const SYMBOL_VISUAL: Record<number, { char: string; color: number }> = {
  0: { char: '寅', color: 0xfff0b3 },   // 白虎 1: 米黃
  1: { char: '鸞', color: 0xff5050 },   // 朱雀 1: 朱紅
  2: { char: '雨', color: 0x4adb8e },   // 玄武 1: 翠綠
  3: { char: '璋', color: 0x4a90e2 },   // 青龍 1: 深藍
  4: { char: '嵐', color: 0x7ae8ff },   // 青龍 2: 亮天藍
  5: { char: '洛', color: 0xffd980 },   // 白虎 2: 淺金
  6: { char: '羽', color: 0xff8a3a },   // 朱雀 2: 橘紅
  7: { char: '墨', color: 0x9a4adb },   // 玄武 2: 紫晶
  8:  { char: 'W',  color: T.GOLD.glow  },  // Wild
  9:  { char: '咒', color: 0xc77fe0    },  // Curse (weight=0, never spawns)
  10: { char: 'S',  color: 0xff3b6b    },  // Scatter
  11: { char: 'JP', color: T.GOLD.base },  // Jackpot
};

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Build n-vertex regular polygon points centered at (cx, cy), point-up. */
export function polygonPoints(cx: number, cy: number, r: number, sides: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    pts.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  return pts;
}

/**
 * Gem shape per symbol tier.
 * Returns { sides: 4|5|6 } for polygon, or { sides: 0 } for circle (specials).
 */
export function shapeFor(symId: number): { sides: number } {
  const sym = SYMBOLS[symId];
  if (!sym) return { sides: 5 };
  if (sym.isWild || sym.isScatter || sym.isJackpot) return { sides: 0 };
  if (sym.isCurse) return { sides: 5 };
  if (symId <= 2) return { sides: 4 };   // low tier: diamond
  if (symId <= 5) return { sides: 5 };   // mid tier: pentagon
  return { sides: 6 };                    // high tier: hexagon
}

// ─── Shared gem drawing ───────────────────────────────────────────────────────

/**
 * Draw a gem symbol icon into a new Container.
 * Used by SlotReel (large, r≈38) and DraftScreen tile (small, r≈18).
 *
 * @param symId   Symbol ID 0-11
 * @param r       Gem radius (outer)
 * @param charScale  fontSize = r * charScale (pass 0 to skip char overlay)
 */
export function drawGemSymbol(symId: number, r: number, charScale = 0.95): Container {
  const c = new Container();
  const visual = SYMBOL_VISUAL[symId];
  if (!visual) return c;
  const shape = shapeFor(symId);

  // Layer 1: Drop shadow
  const shadow = new Graphics();
  if (shape.sides === 0) {
    shadow.circle(0, r * 0.1, r + 1).fill({ color: 0x000000, alpha: 0.5 });
  } else {
    shadow.poly(polygonPoints(0, r * 0.1, r + 1, shape.sides))
      .fill({ color: 0x000000, alpha: 0.5 });
  }
  c.addChild(shadow);

  // Layer 2: Main gem fill + dark stroke
  const main = new Graphics();
  if (shape.sides === 0) {
    main.circle(0, 0, r).fill({ color: visual.color, alpha: 1 });
    main.circle(0, 0, r).stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });
  } else {
    main.poly(polygonPoints(0, 0, r, shape.sides)).fill({ color: visual.color, alpha: 1 });
    main.poly(polygonPoints(0, 0, r, shape.sides)).stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });
  }
  c.addChild(main);

  // Layer 3: Glossy highlight (upper-left ellipse)
  const hl = new Graphics()
    .ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.15)
    .fill({ color: 0xffffff, alpha: 0.5 });
  c.addChild(hl);

  // Layer 4: Character overlay (optional)
  if (charScale > 0) {
    const isMultiChar = visual.char.length > 1;
    const charText = new Text({
      text: visual.char,
      style: {
        fontFamily: '"Noto Serif TC", "Ma Shan Zheng", serif',
        fontWeight: '700',
        fontSize: Math.round(r * (isMultiChar ? 0.65 : charScale)),
        fill: 0x2a1a05,
        stroke: { color: visual.color, width: 1.5 },
        dropShadow: { color: visual.color, alpha: 0.5, blur: 6, distance: 0 },
      },
    });
    charText.anchor.set(0.5, 0.5);
    c.addChild(charText);
  }

  return c;
}
