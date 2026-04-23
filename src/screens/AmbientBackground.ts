import { Application, Container, Graphics } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';

// Each parallax layer is 2× canvas-wide for seamless horizontal wrap.
const W2 = CANVAS_WIDTH * 2; // 1440

export class AmbientBackground extends Container {
  private readonly _app: Application;
  private readonly _farLayer  = new Container();
  private readonly _midLayer  = new Container();
  private readonly _nearLayer = new Container();
  private readonly _dots: { g: Graphics; baseY: number; phase: number }[] = [];
  private _tick: (() => void) | null = null;

  constructor(app: Application) {
    super();
    this._app  = app;
    this.alpha = 0.85;

    // Solid dark base — always visible, not part of parallax.
    this.addChild(
      new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(T.SEA.abyss),
    );

    this._buildFar();
    this._buildMid();
    this._buildNear();
    this.addChild(this._farLayer, this._midLayer, this._nearLayer);

    this._tick = () => {
      const t = performance.now();

      this._farLayer.x  -= 0.12;
      this._midLayer.x  -= 0.28;
      this._nearLayer.x -= 0.55;

      if (this._farLayer.x  < -CANVAS_WIDTH) this._farLayer.x  += CANVAS_WIDTH;
      if (this._midLayer.x  < -CANVAS_WIDTH) this._midLayer.x  += CANVAS_WIDTH;
      if (this._nearLayer.x < -CANVAS_WIDTH) this._nearLayer.x += CANVAS_WIDTH;

      for (const d of this._dots) {
        d.g.y = d.baseY + Math.sin(t / 1800 + d.phase) * 12;
      }
    };
    this._app.ticker.add(this._tick);
  }

  destroyLayers(): void {
    if (this._tick) {
      this._app.ticker.remove(this._tick);
      this._tick = null;
    }
  }

  // ── 遠山 (Far) — misty mountain silhouettes, slowest drift ────────────────
  private _buildFar(): void {
    this._farLayer.alpha = 0.5;

    // Upper ridge peaks y≈130–280; lower ridge fills bottom edge.
    const upperPts: [number, number][] = [
      [0, 440], [60, 260], [140, 300], [210, 140], [310, 230],
      [400, 155], [480, 260], [560, 195], [640, 285], [720, 440],
    ];
    const lowerPts: [number, number][] = [
      [0, CANVAS_HEIGHT], [90, CANVAS_HEIGHT - 90],
      [210, CANVAS_HEIGHT - 55], [330, CANVAS_HEIGHT - 130],
      [450, CANVAS_HEIGHT - 80], [570, CANVAS_HEIGHT - 110],
      [690, CANVAS_HEIGHT - 60], [720, CANVAS_HEIGHT],
    ];

    for (let p = 0; p < 2; p++) {
      const ox = p * CANVAS_WIDTH;

      const gUp = new Graphics();
      gUp.moveTo(ox, CANVAS_HEIGHT);
      upperPts.forEach(([x, y]) => gUp.lineTo(ox + x, y));
      gUp.lineTo(ox + CANVAS_WIDTH, CANVAS_HEIGHT).closePath()
        .fill({ color: T.SEA.deep, alpha: 0.65 });

      const gLow = new Graphics();
      lowerPts.forEach(([x, y], i) => i === 0 ? gLow.moveTo(ox + x, y) : gLow.lineTo(ox + x, y));
      gLow.lineTo(ox + CANVAS_WIDTH, CANVAS_HEIGHT).closePath()
        .fill({ color: T.SEA.mid, alpha: 0.30 });

      this._farLayer.addChild(gUp, gLow);
    }

    void W2; // referenced for clarity; actual width is 2 × passes above
  }

  // ── 雲霧 (Mid) — horizontal mist bands, medium drift ────────────────────
  private _buildMid(): void {
    const bands: { y: number; h: number; color: number; alpha: number }[] = [
      { y:  80, h: 38, color: T.FG.cream,    alpha: 0.10 },
      { y: 355, h: 22, color: T.FG.cream,    alpha: 0.07 },
      { y: 605, h: 44, color: T.GOLD.shadow, alpha: 0.08 },
      { y: 950, h: 28, color: T.FG.cream,    alpha: 0.06 },
    ];
    for (let p = 0; p < 2; p++) {
      const ox = p * CANVAS_WIDTH;
      for (const b of bands) {
        this._midLayer.addChild(
          new Graphics()
            .rect(ox, b.y, CANVAS_WIDTH, b.h)
            .fill({ color: b.color, alpha: b.alpha }),
        );
      }
    }
  }

  // ── 墨點 (Near) — floating ink dots, fastest drift + sin bob ────────────
  private _buildNear(): void {
    const defs: { x: number; y: number; r: number; color: number }[] = [
      { x:   55, y:  220, r: 3, color: T.FG.muted  },
      { x:  145, y:  480, r: 2, color: T.GOLD.base  },
      { x:  255, y:  150, r: 2, color: T.FG.muted   },
      { x:  350, y:  700, r: 3, color: T.FG.muted   },
      { x:  430, y:  340, r: 2, color: T.GOLD.base  },
      { x:  520, y:  920, r: 2, color: T.FG.muted   },
      { x:  600, y:  560, r: 3, color: T.FG.muted   },
      { x:  670, y:  110, r: 2, color: T.GOLD.base  },
      { x:  785, y:  770, r: 2, color: T.FG.muted   },
      { x:  890, y: 1060, r: 3, color: T.GOLD.base  },
      { x: 1020, y:  310, r: 2, color: T.FG.muted   },
      { x: 1130, y:  830, r: 2, color: T.GOLD.base  },
      { x: 1240, y:  460, r: 3, color: T.FG.muted   },
      { x: 1370, y: 1120, r: 2, color: T.FG.muted   },
    ];
    defs.forEach((d, i) => {
      const g = new Graphics().circle(0, 0, d.r).fill({ color: d.color, alpha: 0.55 });
      g.x = d.x;
      this._nearLayer.addChild(g);
      this._dots.push({ g, baseY: d.y, phase: i * 0.7 });
    });
  }
}
