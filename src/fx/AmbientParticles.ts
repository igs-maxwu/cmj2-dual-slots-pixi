import { Application, Container, Graphics } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';

const PARTICLE_COUNT = 20;
const PETAL_COLORS: [number, number][] = [
  [T.GOLD.base,  0.55],
  [T.FG.cream,   0.45],
  [0xe07b9a,     0.40],
];

interface Petal {
  g: Graphics;
  vx: number;
  vy: number;
  vr: number;
}

function drawPetal(g: Graphics): void {
  // Teardrop petal: narrow top, rounded bottom
  g.clear();
  const colorIdx = Math.floor(Math.random() * PETAL_COLORS.length);
  const [color, alpha] = PETAL_COLORS[colorIdx];
  g.moveTo(0, -7)
    .quadraticCurveTo(5, -2, 4, 7)
    .quadraticCurveTo(0, 10, -4, 7)
    .quadraticCurveTo(-5, -2, 0, -7)
    .fill({ color, alpha });
}

function randomX(): number { return Math.random() * CANVAS_WIDTH; }

export class AmbientParticles extends Container {
  private readonly _app: Application;
  private readonly _petals: Petal[] = [];
  private _tick: (() => void) | null = null;

  constructor(app: Application) {
    super();
    this._app = app;
    this.alpha = 0.85;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const g = new Graphics();
      drawPetal(g);
      g.x = randomX();
      g.y = Math.random() * CANVAS_HEIGHT;
      this.addChild(g);

      this._petals.push({
        g,
        vx: -0.3 + Math.random() * 0.6,
        vy: 0.4 + Math.random() * 0.6,
        vr: (-0.03 + Math.random() * 0.06),
      });
    }

    this._tick = () => {
      for (const p of this._petals) {
        p.g.x += p.vx;
        p.g.y += p.vy;
        p.g.rotation += p.vr;

        if (p.g.y > CANVAS_HEIGHT + 20) {
          // Respawn at top with new color
          drawPetal(p.g);
          p.g.x = randomX();
          p.g.y = -20;
          p.vx = -0.3 + Math.random() * 0.6;
          p.vy = 0.4 + Math.random() * 0.6;
          p.vr = -0.03 + Math.random() * 0.06;
          p.g.rotation = Math.random() * Math.PI * 2;
        }
      }
    };

    this._app.ticker.add(this._tick);
  }

  override destroy(options?: { children?: boolean }): void {
    if (this._tick) {
      this._app.ticker.remove(this._tick);
      this._tick = null;
    }
    super.destroy(options);
  }
}
