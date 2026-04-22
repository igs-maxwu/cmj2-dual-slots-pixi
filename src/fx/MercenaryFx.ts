/**
 * MercenaryFx — lightweight visual for non-drafted spirit hits (30% damage).
 *
 * Deliberately minimal vs the full T0 choreography:
 *   - No leap / no hitstop / no screen flash
 *   - 0.3 s total
 *   - Target cell border flashes twice in the spirit's particle colour
 *   - Small damage number pops above the first target cell
 *
 * Usage:
 *   await mercenaryWeakFx(stage, cellPositions, damageAmount, color);
 */
import { Container, Graphics, Text } from 'pixi.js';
import * as T from '@/config/DesignTokens';
import { tween, delay } from '@/systems/tween';

/** One target cell position (stage-local coordinates). */
export interface CellPosition {
  x: number;
  y: number;
}

/**
 * Plays the mercenary weak-hit FX and resolves when done (~300ms).
 *
 * @param stage          Root container (same as attackTimeline's stage param)
 * @param cellPositions  Stage-local centres of each affected enemy cell
 * @param damageAmount   Damage dealt (shown as small pop-up text)
 * @param color          Spirit's particle colour (0xRRGGBB)
 */
export async function mercenaryWeakFx(
  stage: Container,
  cellPositions: CellPosition[],
  damageAmount: number,
  color: number = 0x88ccff,
): Promise<void> {
  if (cellPositions.length === 0) return;

  // ── Border flash on each target cell (2 pulses, 130ms each) ───────────────
  const rings = cellPositions.map(cp => {
    const ring = new Graphics()
      .roundRect(-28, -28, 56, 56, T.RADIUS.sm)
      .stroke({ width: 3, color, alpha: 0.0 });
    ring.x = cp.x;
    ring.y = cp.y;
    stage.addChild(ring);
    return ring;
  });

  // Pulse 1
  await tween(110, p => {
    const a = Math.sin(p * Math.PI) * 0.85;
    for (const r of rings) {
      r.clear()
        .roundRect(-28, -28, 56, 56, T.RADIUS.sm)
        .stroke({ width: 3, color, alpha: a });
    }
  });
  // Pulse 2
  await tween(110, p => {
    const a = Math.sin(p * Math.PI) * 0.65;
    for (const r of rings) {
      r.clear()
        .roundRect(-28, -28, 56, 56, T.RADIUS.sm)
        .stroke({ width: 3, color, alpha: a });
    }
  });

  for (const r of rings) r.destroy();

  // ── Small damage number at first cell ─────────────────────────────────────
  if (damageAmount > 0) {
    const first = cellPositions[0];
    const txt   = new Text({
      text: `-${damageAmount}`,
      style: {
        fontFamily: T.FONT.num,
        fontWeight: '600',
        fontSize:   T.FONT_SIZE.xs,   // deliberately smaller than full T0 pop
        fill:       color,
        stroke:     { color: 0x000000, width: 2 },
      },
    });
    txt.anchor.set(0.5, 0.5);
    txt.x = first.x;
    txt.y = first.y - 10;
    stage.addChild(txt);

    await tween(260, p => {
      txt.y     = first.y - 10 - p * 28;
      txt.alpha = 1 - Math.max(0, (p - 0.45) / 0.55);
    });

    txt.destroy();
  } else {
    await delay(260);
  }
}
