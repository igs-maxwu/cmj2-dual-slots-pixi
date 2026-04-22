import type { SymbolDef } from '@/config/SymbolsConfig';

export interface PoolEntry { id: number; weight: number; }

/**
 * Builds a pool containing ALL symbols, regardless of selection.
 * Non-selected symbols fill the grid but are never iterated by the
 * Ways evaluator, so they reduce win frequency without affecting
 * the scoring logic.  poolTotalW must be computed from this pool
 * whenever it is passed to SlotEngine or ScaleCalculator so that
 * probability math is consistent.
 */
export function buildFullPool(allSymbols: SymbolDef[]): PoolEntry[] {
  return allSymbols.map((sym, id) => ({ id, weight: sym.weight }));
}

/**
 * Builds the active symbol pool as the UNION of A and B selections.
 * Kept for reference / testing; production code should use buildFullPool.
 */
export function buildUnionPool(
  selectedA: number[],
  selectedB: number[],
  allSymbols: SymbolDef[],
): PoolEntry[] {
  const union = new Set([...selectedA, ...selectedB]);
  return Array.from(union).map(id => ({
    id,
    weight: allSymbols[id].weight,
  }));
}

/** Weighted random pick from pool. */
export function pickSymbol(pool: PoolEntry[], rng: () => number = Math.random): number {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = rng() * total;
  for (const p of pool) {
    if (r < p.weight) return p.id;
    r -= p.weight;
  }
  return pool[pool.length - 1].id;
}

/** Total weight of a pool (used by ScaleCalculator). */
export function totalWeight(pool: PoolEntry[]): number {
  return pool.reduce((s, p) => s + p.weight, 0);
}

/** Spin a full ROWS×COLS grid from the pool. */
export function spinGrid(
  rows: number,
  cols: number,
  pool: PoolEntry[],
  rng: () => number = Math.random,
): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => pickSymbol(pool, rng)),
  );
}
