import { Assets, Container, Sprite, Texture } from 'pixi.js';

/**
 * Place the `corner-ornament.png` in all 4 corners of a rectangular region,
 * mirroring via negative scale for top-right / bottom-left / bottom-right.
 */
export function addCornerOrnaments(
  container: Container,
  regionW: number,
  regionH: number,
  size = 180,
  alpha = 0.45,
): void {
  const tex = Assets.get<Texture>('corner-ornament');
  if (!tex) return;
  const k = size / tex.width;
  const places: Array<{ sx: number; sy: number; x: number; y: number }> = [
    { sx:  1, sy:  1, x: 0,       y: 0       },
    { sx: -1, sy:  1, x: regionW, y: 0       },
    { sx:  1, sy: -1, x: 0,       y: regionH },
    { sx: -1, sy: -1, x: regionW, y: regionH },
  ];
  for (const p of places) {
    const s = new Sprite(tex);
    s.anchor.set(0, 0);
    s.scale.set(p.sx * k, p.sy * k);
    s.x = p.x; s.y = p.y;
    s.alpha = alpha;
    container.addChild(s);
  }
}
