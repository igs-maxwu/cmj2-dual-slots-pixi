import type { FormationGrid } from './Formation';
import { hasAliveOfClan } from './Formation';
import { SYMBOLS } from '@/config/SymbolsConfig';

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
  // Passive: White Tiger clan — incoming damage × 0.9 if any tiger alive on defending side
  if (hasAliveOfClan(grid, 'white')) {
    totalDmg = Math.ceil(totalDmg * 0.9);
  }

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
    let hit = Math.min(u.hp, remaining);

    // Passive: Black Tortoise — last alive tortoise absorbs lethal damage once
    const aliveCount = grid.filter(g => g !== null && g.alive).length;
    if (SYMBOLS[u.symbolId]?.clan === 'black' && !u.shieldUsed && aliveCount === 1 && hit >= u.hp) {
      hit = u.hp - 1;
      u.shieldUsed = true;
    }

    u.hp      -= hit;
    remaining -= hit;
    const died = u.hp <= 0;
    if (died) u.alive = false;
    events.push({ slotIndex: idx, damageTaken: hit, died });
  }

  return events;
}
