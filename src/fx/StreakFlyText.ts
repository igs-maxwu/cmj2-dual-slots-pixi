/**
 * StreakFlyText — s13-fx-02
 *
 * Plays a ×N.N multiplier label that pops in at a reel position, flies
 * to the target wallet, and fades out ("absorbed").  Used after streak ≥ 2
 * round wins.  Total duration: ~1 000 ms.
 *
 * Caller: fire-and-forget (don't await) so it runs alongside the win cascade.
 *
 * Stage 1 (  0– 200ms):  pop-in at (startX, startY)  scale 0→1.2, alpha 0→1
 * Stage 2 (200– 700ms):  fly to (endX, endY)          scale 1.2→0.9
 *                         trail particle spawned every 50 ms
 * Stage 3 (700–1000ms):  absorb at endpoint            scale 0.9→0.3, alpha 1→0
 */

import { Container, Graphics } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { goldText } from '@/components/GoldText';
import * as T from '@/config/DesignTokens';
import { tween, delay, Easings } from '@/systems/tween';

// Trail particle: small circle that fades over 300 ms
function spawnTrailParticle(
  parent: Container,
  x: number,
  y: number,
): void {
  const g = new Graphics()
    .circle(0, 0, 5)
    .fill({ color: T.GOLD.glow, alpha: 0.8 });
  g.x = x;
  g.y = y;
  parent.addChild(g);

  void tween(300, t => {
    g.alpha = 0.8 * (1 - t);
    g.scale.set(1 + t * 0.5);
  }, Easings.easeOut).then(() => {
    if (!g.destroyed) g.destroy();
  });
}

// Cubic bezier easing approximation (ease-in-out-quad as substitute)
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export async function playStreakFlyText(
  parent: Container,
  multiplier: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Promise<void> {
  const root = new Container();
  root.zIndex = 1800;
  parent.addChild(root);

  // ── Multiplier label ──────────────────────────────────────────────────────
  // chore #212: was `×${multiplier.toFixed(1)}` (e.g. "×1.5") — owner wants explicit combo text
  const label = goldText('Combo HIT!!', { fontSize: 32, withShadow: true });
  label.anchor.set(0.5, 0.5);
  label.x = startX;
  label.y = startY;
  label.alpha = 0;
  label.scale.set(0);
  label.style.fill = T.GOLD.glow;
  label.filters = [new GlowFilter({
    color: T.GOLD.glow,
    distance: 18,
    outerStrength: 2.5,
    innerStrength: 0.5,
  })];
  root.addChild(label);

  // ── Stage 1: pop-in (0–200ms) ─────────────────────────────────────────────
  await tween(200, t => {
    label.alpha = t;
    label.scale.set(1.2 * t);
  }, Easings.easeOut);

  // ── Stage 2: fly to wallet (200–700ms = 500ms) ────────────────────────────
  // Spawn trail particles every 50 ms for 400 ms of the flight window
  let trailElapsed = 0;
  const TRAIL_INTERVAL = 50;

  await tween(500, t => {
    const eased = easeInOutQuad(t);
    label.x = startX + (endX - startX) * eased;
    label.y = startY + (endY - startY) * eased;
    label.scale.set(1.2 - 0.3 * t);   // 1.2 → 0.9

    // Trail particle logic — approximate; tween callback fires each frame
    trailElapsed += 16;   // ~60 fps estimate
    if (trailElapsed >= TRAIL_INTERVAL) {
      trailElapsed -= TRAIL_INTERVAL;
      spawnTrailParticle(root, label.x, label.y);
    }
  }, Easings.linear);

  // ── Stage 3: absorb at endpoint (700–1000ms = 300ms) ─────────────────────
  await tween(300, t => {
    label.scale.set(0.9 - 0.6 * t);   // 0.9 → 0.3
    label.alpha = 1 - t;
  }, Easings.easeIn);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  if (!root.destroyed) root.destroy({ children: true });
}
