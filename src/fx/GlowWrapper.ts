/**
 * GlowWrapper — thin helpers for pixi-filters effects.
 *
 * applyGlow / applyBloom mutate target.filters and return the filter
 * so callers can removeFilter() when done.
 * applyShockwave is a fire-and-forget Promise that cleans up after itself.
 */
import type { Container, Filter } from 'pixi.js';
import { GlowFilter, BloomFilter, ShockwaveFilter } from 'pixi-filters';
import { tween } from '@/systems/tween';

// ─── Glow ────────────────────────────────────────────────────────────────────

export function applyGlow(
  target: Container,
  color: number,
  strength: number = 2,
  distance: number = 10,
): GlowFilter {
  const filter = new GlowFilter({ color, outerStrength: strength, innerStrength: 0, distance });
  _pushFilter(target, filter);
  return filter;
}

// ─── Bloom ───────────────────────────────────────────────────────────────────

export function applyBloom(target: Container, strength: number = 1.5): BloomFilter {
  const filter = new BloomFilter({ strength });
  _pushFilter(target, filter);
  return filter;
}

// ─── Shockwave (fire-and-forget Promise) ─────────────────────────────────────

/**
 * Attaches a ShockwaveFilter to `stage` centred at (x, y) in world-pixel coords,
 * tweens `filter.time` over `duration`ms, then removes the filter.
 *
 * The default speed (500 px/s) means a 400ms tween expands the ripple ~200px —
 * visible across the formation zones without filling the full canvas.
 */
export async function applyShockwave(
  stage: Container,
  x: number,
  y: number,
  radius: number = 120,
  duration: number = 400,
): Promise<void> {
  const speed       = radius / (duration / 1000);   // px/s so wave reaches `radius` px by end
  const filter      = new ShockwaveFilter({
    center:     { x, y },
    speed,
    wavelength: 80,
    amplitude:  14,
    radius:     radius * 1.25,
  });
  filter.time = 0;
  _pushFilter(stage, filter);

  await tween(duration, p => {
    filter.time = p * (duration / 1000);
  });

  _removeFilter(stage, filter);
  filter.destroy();
}

// ─── Shared util ─────────────────────────────────────────────────────────────

export function removeFilter(target: Container, filter: Filter): void {
  _removeFilter(target, filter);
}

function _pushFilter(target: Container, filter: Filter): void {
  const existing = (target.filters as Filter[] | null) ?? [];
  target.filters = [...existing, filter];
}

function _removeFilter(target: Container, filter: Filter): void {
  const existing = (target.filters as Filter[] | null) ?? [];
  target.filters = existing.filter(f => f !== filter);
}
