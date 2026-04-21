import type { FormationGrid } from './Formation';

export type AttackerSide = 'A' | 'B';

export interface DmgEvent {
  slotIndex:   number;
  damageTaken: number;
  died:        boolean;
}

/**
 * Distributes damage across a 3x3 formation grid.
 * Attack priority:
 *   Side A attacks B: col 0 -> col 1 -> col 2 (B's left side = closer to VS centre)
 *   Side B attacks A: col 2 -> col 1 -> col 0 (A's right side = closer to VS centre)
 * Within each column: row 0 -> row 1 -> row 2 (top to bottom).
 */
export function distributeDamage(
  grid:        FormationGrid,
  totalDmg:    number,
  attackerSide: AttackerSide,
): DmgEvent[] {
  const colOrder = attackerSide === 'A' ? [0, 1, 2] : [2, 1, 0];
  const queue: number[] = [];

  for (const col of colOrder) {
    for (const row of [0, 1, 2]) {
      const idx = row * 3 + col;
      const u = grid[idx];
      if (u && u.alive) queue.push(idx);
    }
  }

  const events: DmgEvent[] = [];
  let remaining = totalDmg;

  for (const idx of queue) {
    if (remaining <= 0) break;
    const u = grid[idx]!;
    const taken = Math.min(u.hp, remaining);
    u.hp      -= taken;
    remaining -= taken;
    const died = u.hp <= 0;
    if (died) u.alive = false;
    events.push({ slotIndex: idx, damageTaken: taken, died });
  }

  return events;
}
