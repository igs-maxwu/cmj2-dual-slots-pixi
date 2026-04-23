/**
 * ParticleEmitterHelper — thin wrapper around @pixi/particle-emitter v5.
 *
 * Accepts a simplified config and returns a ready-to-update Emitter.
 * The caller is responsible for calling emitter.update(deltaMs / 1000)
 * every tick and emitter.destroy() when done.
 *
 * Note: @pixi/particle-emitter v5 was built against PixiJS 7 modular
 * packages; we cast the Container to satisfy its types while both share
 * the same underlying display-object hierarchy at runtime.
 */
import { Container } from 'pixi.js';
import { Emitter, type EmitterConfigV3 } from '@pixi/particle-emitter';
import type { Container as DisplayContainer } from '@pixi/display';

// ─── Simplified config ────────────────────────────────────────────────────────

export interface SimpleEmitterConfig {
  /** Particles emitted per second. */
  spawnRate: number;
  /** Particle lifetime in milliseconds. */
  lifetime: number;
  /** Colour gradient as 0xRRGGBB values, at least two entries. */
  colors: number[];
  /** Initial speed in pixels per second. */
  speed: number;
  /** If true, particles rotate randomly. */
  rotation: boolean;
  /** Initial scale (default 1.0). */
  scale?: number;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** Converts a 0xRRGGBB number to a CSS hex string expected by the color behavior. */
function toHex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

/**
 * Creates and returns a configured particle Emitter attached to `container`.
 * The emitter starts emitting immediately; call `emitter.emit = false` to stop.
 */
export function createEmitter(container: Container, cfg: SimpleEmitterConfig): Emitter {
  const lifeSec  = cfg.lifetime / 1000;
  const scale    = cfg.scale ?? 1;

  const config: EmitterConfigV3 = {
    lifetime:         { min: lifeSec * 0.8, max: lifeSec },
    frequency:        1 / cfg.spawnRate,
    spawnChance:      1,
    particlesPerWave: 1,
    emitterLifetime:  -1,  // infinite
    maxParticles:     Math.ceil(cfg.spawnRate * lifeSec * 2),
    pos:              { x: 0, y: 0 },
    addAtBack:        false,
    behaviors: [
      {
        type:   'alpha',
        config: {
          alpha: {
            list: [
              { value: 1,   time: 0 },
              { value: 0.8, time: 0.6 },
              { value: 0,   time: 1 },
            ],
          },
        },
      },
      {
        type:   'scale',
        config: {
          scale: {
            list: [
              { value: scale,         time: 0 },
              { value: scale * 0.25,  time: 1 },
            ],
          },
          minMult: 0.5,
        },
      },
      {
        type:   'color',
        config: {
          color: {
            list: cfg.colors.map((c, i) => ({
              value: toHex(c),
              time:  cfg.colors.length > 1 ? i / (cfg.colors.length - 1) : 0,
            })),
          },
        },
      },
      {
        type:   'moveSpeed',
        config: {
          speed: {
            list: [
              { value: cfg.speed,       time: 0 },
              { value: cfg.speed * 0.3, time: 1 },
            ],
          },
          minMult: 0.6,
        },
      },
      ...(cfg.rotation ? [{
        type:   'rotationStatic',
        config: { min: 0, max: 360 },
      }] : []),
      {
        type:   'spawnShape',
        config: { type: 'circle', data: { x: 0, y: 0, radius: 4 } },
      },
    ],
  };

  // Cast is safe: pixi.js Container and @pixi/display Container are structurally
  // identical at runtime — both inherit from the same EventEmitter base.
  return new Emitter(container as unknown as DisplayContainer, config);
}

export type { Emitter };
