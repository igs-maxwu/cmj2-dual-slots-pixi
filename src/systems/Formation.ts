export interface GridUnit {
  symbolId: number;
  hp:       number;
  maxHp:    number;
  alive:    boolean;
}

/** 9-element flat array; index = row*3+col. null = empty slot. */
export type FormationGrid = (GridUnit | null)[];

export function createFormation(
  selectedSymbolIds: number[],   // exactly 5 IDs
  teamHp: number,
): FormationGrid {
  const unitHp = Math.floor(teamHp / 5);
  const grid: FormationGrid = Array(9).fill(null);

  // Fisher-Yates shuffle of slot indices [0..8]
  const indices = [0,1,2,3,4,5,6,7,8];
  for (let i = 8; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  for (let i = 0; i < 5; i++) {
    grid[indices[i]] = {
      symbolId: selectedSymbolIds[i],
      hp:       unitHp,
      maxHp:    unitHp,
      alive:    true,
    };
  }
  return grid;
}

export function isTeamAlive(grid: FormationGrid): boolean {
  return grid.some(u => u !== null && u.alive);
}

export function teamHpTotal(grid: FormationGrid): number {
  return grid.reduce((s, u) => s + (u?.hp ?? 0), 0);
}
