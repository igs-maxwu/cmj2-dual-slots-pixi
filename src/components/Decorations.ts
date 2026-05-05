import { Container, Graphics } from 'pixi.js';
import * as T from '@/config/DesignTokens';

/**
 * Place programmatic L-bracket corner ornaments at all 4 corners of a
 * rectangular region. Mirrored via negative scale for top-right /
 * bottom-left / bottom-right.
 *
 * Style: gold L-bracket (horizontal + vertical arms) with inner highlight
 * stroke and a small dot at the corner — translated from mockup
 * CornerOrnament SVG path (battle-shared.jsx line 52-61).
 *
 * s12-ui-01: replaces Assets.get<Texture>('corner-ornament') Sprite path —
 * no asset dependency.
 */
export function addCornerOrnaments(
  container: Container,
  regionW: number,
  regionH: number,
  size = 180,
  alpha = 0.45,
): void {
  const places: Array<{ sx: number; sy: number; x: number; y: number }> = [
    { sx:  1, sy:  1, x: 0,       y: 0       },   // top-left
    { sx: -1, sy:  1, x: regionW, y: 0       },   // top-right
    { sx:  1, sy: -1, x: 0,       y: regionH },   // bottom-left
    { sx: -1, sy: -1, x: regionW, y: regionH },   // bottom-right
  ];

  // Scale factor: mockup SVG coordinate space is 0-40; size maps to that range
  const s = size / 40;

  for (const p of places) {
    // chore #195: Pixi v9 deprecation fix — corner parent was Graphics (extends Container
    // in v8 only). Use Container as parent so Graphics children attach via proper API.
    // Visual is identical — only the parent type changes.
    const corner = new Container();

    // Outer L bracket — own Graphics, child of Container
    // Translated from SVG: M2 2 L20 2 M2 2 L2 20 M2 2 L12 12
    const outer = new Graphics();
    outer.moveTo(2 * s, 2 * s).lineTo(20 * s, 2 * s);   // horizontal arm
    outer.moveTo(2 * s, 2 * s).lineTo(2 * s, 20 * s);   // vertical arm
    outer.moveTo(2 * s, 2 * s).lineTo(12 * s, 12 * s);  // diagonal accent
    outer.stroke({ width: 1.5, color: T.GOLD.base, alpha: 0.9 });
    corner.addChild(outer);

    // Inner highlight L (shorter, brighter)
    const inner = new Graphics();
    inner.moveTo(6 * s, 6 * s).lineTo(14 * s, 6 * s);
    inner.moveTo(6 * s, 6 * s).lineTo(6 * s, 14 * s);
    inner.stroke({ width: 1, color: T.GOLD.glow, alpha: 0.6 });
    corner.addChild(inner);

    // Corner dot at L origin
    const dot = new Graphics()
      .circle(2 * s, 2 * s, 1.5 * s)
      .fill({ color: T.GOLD.base });
    corner.addChild(dot);

    // Mirror to the correct corner via negative scale
    corner.scale.set(p.sx, p.sy);
    corner.x = p.x;
    corner.y = p.y;
    corner.alpha = alpha;
    container.addChild(corner);
  }
}
