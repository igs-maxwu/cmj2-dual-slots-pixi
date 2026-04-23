import { Application, Container, Graphics, Sprite } from 'pixi.js';
import * as T from '@/config/DesignTokens';
import { tweenValue, Easings } from '@/systems/tween';

// ~600 ms lifetime at 60 fps
const PARTICLE_LIFE_FRAMES = 36;
// spawn interval: 1 200–2 000 ms = 72–120 frames at 60 fps
const SPAWN_MIN = 72;
const SPAWN_RNG = 48;

interface Particle {
  g: Graphics;
  vx: number;
  vy: number;
  framesLeft: number;
}

export class VsBadgeAnimator {
  private readonly _app: Application;
  private readonly _badge: Sprite;
  private readonly _container: Container;
  private readonly _particles: Particle[] = [];
  private _spawnCountdown = SPAWN_MIN + Math.floor(Math.random() * SPAWN_RNG);
  private _tick: (() => void) | null = null;
  private readonly _baseScaleX: number;
  private readonly _baseScaleY: number;

  constructor(badge: Sprite, app: Application, parentContainer: Container) {
    this._app       = app;
    this._badge     = badge;
    this._container = parentContainer;
    this._baseScaleX = badge.scale.x;
    this._baseScaleY = badge.scale.y;

    this._tick = () => {
      // (a) Slow continuous rotation
      badge.rotation += 0.004;

      // (b) Update alive particles
      for (let i = this._particles.length - 1; i >= 0; i--) {
        const p = this._particles[i];
        p.framesLeft--;
        if (p.framesLeft <= 0) {
          p.g.destroy();
          this._particles.splice(i, 1);
          continue;
        }
        p.g.x += p.vx;
        p.g.y += p.vy;
        const t = 1 - p.framesLeft / PARTICLE_LIFE_FRAMES;
        p.g.alpha = 0.85 * (1 - t);
        p.g.scale.set(1 - t * 0.6); // 1.0 → 0.4
      }

      // (c) Periodic gold particle shed
      this._spawnCountdown--;
      if (this._spawnCountdown <= 0) {
        if (this._particles.length < 50) this._spawnBatch();
        this._spawnCountdown = SPAWN_MIN + Math.floor(Math.random() * SPAWN_RNG);
      }
    };

    this._app.ticker.add(this._tick);
  }

  // Called once per round start — scale pop then settle.
  pulse(): void {
    this._badge.scale.set(this._baseScaleX, this._baseScaleY);
    void tweenValue(1.0, 1.18, 80, v => {
      this._badge.scale.set(this._baseScaleX * v, this._baseScaleY * v);
    }, Easings.backOut)
      .then(() => tweenValue(1.18, 1.0, 160, v => {
        this._badge.scale.set(this._baseScaleX * v, this._baseScaleY * v);
      }, Easings.easeOut));
  }

  destroy(): void {
    if (this._tick) {
      this._app.ticker.remove(this._tick);
      this._tick = null;
    }
    for (const p of this._particles) p.g.destroy();
    this._particles.length = 0;
  }

  private _spawnBatch(): void {
    const count = 5 + Math.floor(Math.random() * 3); // 5–7
    const cx = this._badge.x;
    const cy = this._badge.y;
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.random() * 2;
      const g = new Graphics().circle(0, 0, r).fill({ color: T.GOLD.base, alpha: 0.85 });
      g.x = cx + (Math.random() - 0.5) * 40; // ±20 px
      g.y = cy + (Math.random() - 0.5) * 40;
      this._container.addChild(g);
      this._particles.push({
        g,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.6 + Math.random() * 0.9,
        framesLeft: PARTICLE_LIFE_FRAMES,
      });
    }
  }
}
