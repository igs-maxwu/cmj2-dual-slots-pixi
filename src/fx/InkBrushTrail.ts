/**
 * InkBrushTrail — a moving calligraphic trail rendered as a series of
 * line segments that fade from opaque at the tip to transparent at the tail.
 *
 * Usage:
 *   const trail = new InkBrushTrail(0x00FFFF, 3, 14);
 *   stage.addChild(trail);
 *
 *   // inside a tween callback:
 *   trail.update(avatar.x, avatar.y);
 *
 *   // when motion ends:
 *   await trail.fade(200);
 *   trail.destroy();
 */
import { Container, Graphics } from 'pixi.js';
import { tween } from '@/systems/tween';

export class InkBrushTrail extends Container {
  private readonly pts: { x: number; y: number }[] = [];
  private readonly g = new Graphics();
  private readonly color: number;
  private readonly lineW: number;
  private readonly maxPts: number;

  constructor(color = 0x000000, lineWidth = 3, maxSegments = 14) {
    super();
    this.color  = color;
    this.lineW  = lineWidth;
    this.maxPts = maxSegments + 1; // one extra so we always have a "current" point
    this.addChild(this.g);
  }

  update(x: number, y: number): void {
    this.pts.push({ x, y });
    if (this.pts.length > this.maxPts) this.pts.shift();
    this._redraw();
  }

  private _redraw(): void {
    this.g.clear();
    const n = this.pts.length;
    if (n < 2) return;
    for (let i = 1; i < n; i++) {
      const t      = i / (n - 1);           // 0 at tail, 1 at tip
      const alpha  = t * 0.85;
      const width  = Math.max(0.5, this.lineW * t);
      const p0     = this.pts[i - 1];
      const p1     = this.pts[i];
      this.g
        .moveTo(p0.x, p0.y)
        .lineTo(p1.x, p1.y)
        .stroke({ width, color: this.color, alpha });
    }
  }

  /** Fade out the whole trail over `ms` milliseconds. */
  async fade(ms: number): Promise<void> {
    const start = this.alpha;
    await tween(ms, p => { this.alpha = start * (1 - p); });
    this.alpha = 0;
  }
}
