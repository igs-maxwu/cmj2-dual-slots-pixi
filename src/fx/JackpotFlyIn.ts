/**
 * JackpotFlyIn — s13-fx-02
 *
 * After JackpotCeremony resolves, the NT$ award amount is shown flying
 * from the JP marquee centre to the target side wallet.
 * Both A and B wallets receive halfAward; call this twice (in parallel).
 *
 * Total duration: ~1 200 ms.
 *
 * Stage 1 (  0– 300ms):  dramatic pop-in at centre  scale 0→1.4, alpha 0→1
 * Stage 2 (300–1000ms):  trail-fly to wallet         scale 1.4→0.7
 *                         dense trail every 30 ms
 * Stage 3 (1000–1200ms): absorb into wallet          scale 0.7→0.3, alpha 1→0
 */

import { Container, Graphics } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { goldText } from '@/components/GoldText';
import * as T from '@/config/DesignTokens';
import { tween, Easings } from '@/systems/tween';

// Trail particle: slightly larger than StreakFlyText (JP is more dramatic)
function spawnTrailParticle(
  parent: Container,
  x: number,
  y: number,
): void {
  const size = 4 + Math.random() * 5;   // 4–9 px radius for variety
  const g = new Graphics()
    .circle(0, 0, size)
    .fill({ color: T.GOLD.glow, alpha: 0.75 });
  g.x = x + (Math.random() - 0.5) * 12;
  g.y = y + (Math.random() - 0.5) * 12;
  parent.addChild(g);

  void tween(400, t => {
    g.alpha = 0.75 * (1 - t);
    g.scale.set(1 + t * 0.8);
  }, Easings.easeOut).then(() => {
    if (!g.destroyed) g.destroy();
  });
}

// Ease-in-out-quad approximation
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export async function playJackpotFlyIn(
  parent: Container,
  amount: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Promise<void> {
  const root = new Container();
  root.zIndex = 2600;   // above JP ceremony (2500) so it's visible on top
  parent.addChild(root);

  // ── Amount label ──────────────────────────────────────────────────────────
  const label = goldText(`+${Math.floor(amount).toLocaleString()}`, {
    fontSize: 48,
    withShadow: true,
  });
  label.anchor.set(0.5, 0.5);
  label.x = startX;
  label.y = startY;
  label.alpha = 0;
  label.scale.set(0);
  label.style.fill = T.GOLD.glow;
  label.filters = [new GlowFilter({
    color:         T.GOLD.glow,
    distance:      30,
    outerStrength: 4,
    innerStrength: 0.8,
  })];
  root.addChild(label);

  // ── Stage 1: dramatic pop-in at centre (0–300ms) ─────────────────────────
  await tween(300, t => {
    label.alpha = t;
    // Overshoot slightly: 0→1.5 then settle to 1.4
    label.scale.set(1.4 * t + 0.1 * Math.sin(Math.PI * t));
  }, Easings.easeOut);

  // ── Stage 2: trail-fly to wallet (300–1000ms = 700ms) ────────────────────
  let trailElapsed = 0;
  const TRAIL_INTERVAL = 30;

  await tween(700, t => {
    const eased = easeInOut(t);
    label.x = startX + (endX - startX) * eased;
    label.y = startY + (endY - startY) * eased;
    label.scale.set(1.4 - 0.7 * t);   // 1.4 → 0.7

    trailElapsed += 16;   // ~60 fps
    if (trailElapsed >= TRAIL_INTERVAL) {
      trailElapsed -= TRAIL_INTERVAL;
      spawnTrailParticle(root, label.x, label.y);
    }
  }, Easings.linear);

  // ── Stage 3: absorb into wallet (1000–1200ms = 200ms) ────────────────────
  await tween(200, t => {
    label.scale.set(0.7 - 0.4 * t);   // 0.7 → 0.3
    label.alpha = 1 - t;
  }, Easings.easeIn);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  if (!root.destroyed) root.destroy({ children: true });
}
