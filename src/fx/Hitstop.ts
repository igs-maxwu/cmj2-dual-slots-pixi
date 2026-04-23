/**
 * Hitstop — momentarily freezes the Pixi ticker to give heavy hits
 * a cinematic "freeze frame" feel.
 *
 * Usage:
 *   await hitstop(app, 60);   // 60ms freeze (default)
 *
 * Implementation notes:
 *   - Stashes app.ticker.speed, drops it to 0.05 (near-zero but not 0
 *     so tweens driven by performance.now() still resolve).
 *   - try/finally guarantees cleanup even if the caller is cancelled.
 */
import { Application } from 'pixi.js';
import { delay } from '@/systems/tween';

export async function hitstop(app: Application, ms: number = 60): Promise<void> {
  const prev = app.ticker.speed;
  app.ticker.speed = 0.05;
  try {
    await delay(ms);
  } finally {
    app.ticker.speed = prev;
  }
}
