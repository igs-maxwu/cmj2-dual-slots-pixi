/**
 * Dual-direction Ways-to-Win slot engine.
 * A evaluates ways left→right (anchor col 0).
 * B evaluates ways right→left (anchor col 4).
 *
 * Ways scoring: for each selected symbol, count consecutive columns from
 * the anchor in which that symbol appears ≥1 time.  The win multiplier is
 * the product of per-column symbol counts (numWays).  Max ways = ROWS^COLS.
 */
import { spinGrid, totalWeight, type PoolEntry } from './SymbolPool';
import { SYMBOLS, PAYOUT_BASE, COIN_EXP } from '@/config/SymbolsConfig';

/** Side identifier — kept as a named export for backward compatibility. */
export type Side = 'A' | 'B';

/** One ways-win hit for a single symbol on one side. */
export interface WayHit {
  symbolId:    number;
  matchCount:  number;       // consecutive columns with ≥1 matching symbol (3–5)
  numWays:     number;       // product of per-column match counts
  /** hitCells[colOffset] = row indices in that column that matched */
  hitCells:    number[][];
  rawCoin:     number;
  rawDmg:      number;
  /** true = spirit was not drafted by this side; scores at 30% (mercenary mode) */
  isMercenary: boolean;
  /** true = at least one hit cell contained a Wild substitute (SPEC §15 M1: way ×2) */
  wildUsed?:   boolean;
}

export interface SideResult {
  coinWon:  number;
  dmgDealt: number;
  wayHits:  WayHit[];
}

export interface SpinResult {
  grid:  number[][];
  sideA: SideResult;
  sideB: SideResult;
}

export interface ScaledMultipliers {
  coinMult: number;
  dmgMult:  number;
}

export class SlotEngine {
  private rows: number;
  private cols: number;

  constructor(rows = 3, cols = 5) {
    this.rows = rows;
    this.cols = cols;
  }

  /**
   * Computes per-symbol scaled multipliers based on pool weights.
   * coinMult = (totalW / weight)^coinExp * coinScale
   * dmgMult  = (totalW / weight)^fairnessExp * dmgScale
   */
  static scaledMult(
    symbolId:    number,
    poolTotalW:  number,
    coinScale:   number,
    dmgScale:    number,
    fairnessExp: number,
  ): ScaledMultipliers {
    const w     = SYMBOLS[symbolId].weight;
    const ratio = poolTotalW / w;
    return {
      coinMult: Math.pow(ratio, COIN_EXP)    * coinScale,
      dmgMult:  Math.pow(ratio, fairnessExp) * dmgScale,
    };
  }

  /**
   * p-02: Demo mode path — evaluate a caller-provided grid without RNG.
   * Identical to spin() but skips spinGrid(); grid is injected directly.
   * All ceremony triggers (BigWin, JP, FreeSpin, NearWin) work unchanged.
   */
  evaluateForcedGrid(
    grid:        number[][],
    pool:        PoolEntry[],
    selectedA:   number[],
    selectedB:   number[],
    betA:        number,
    betB:        number,
    coinScaleA:  number = 1,
    dmgScaleA:   number = 1,
    coinScaleB:  number = 1,
    dmgScaleB:   number = 1,
    fairnessExp: number = 2.0,
  ): SpinResult {
    const tw = totalWeight(pool);
    const sideA = this._evalSide(grid, 'A', selectedA, betA, tw, coinScaleA, dmgScaleA, fairnessExp);
    const sideB = this._evalSide(grid, 'B', selectedB, betB, tw, coinScaleB, dmgScaleB, fairnessExp);
    return { grid, sideA, sideB };
  }

  spin(
    pool:        PoolEntry[],
    selectedA:   number[],
    selectedB:   number[],
    betA:        number,
    betB:        number,
    coinScaleA:  number = 1,
    dmgScaleA:   number = 1,
    coinScaleB:  number = 1,
    dmgScaleB:   number = 1,
    fairnessExp: number = 2.0,
    rng:         () => number = Math.random,
  ): SpinResult {
    const grid = spinGrid(this.rows, this.cols, pool, rng);
    const tw   = totalWeight(pool);

    const sideA = this._evalSide(grid, 'A', selectedA, betA, tw, coinScaleA, dmgScaleA, fairnessExp);
    const sideB = this._evalSide(grid, 'B', selectedB, betB, tw, coinScaleB, dmgScaleB, fairnessExp);
    return { grid, sideA, sideB };
  }

  private _evalSide(
    grid:        number[][],
    side:        'A' | 'B',
    selected:    number[],
    bet:         number,
    poolTotalW:  number,
    coinScale:   number,
    dmgScale:    number,
    fairnessExp: number,
  ): SideResult {
    const COLS      = this.cols;
    const ROWS      = this.rows;
    const dir       = side === 'A' ? 1 : -1;
    const anchorCol = side === 'A' ? 0 : COLS - 1;

    const wayHits: WayHit[] = [];
    let totalCoin = 0;
    let totalDmg  = 0;

    // Spec rev2: scan all symbols; non-drafted score at 30% (mercenary mode).
    const isDrafted = new Set(selected);

    for (let symId = 0; symId < SYMBOLS.length; symId++) {
      // Wild is a substitute only — does not score its own way
      if (SYMBOLS[symId].isWild) continue;
      // Curse is a blocker only — does not score, does not substitute
      if (SYMBOLS[symId].isCurse) continue;
      // Scatter does not score ways; 3+ triggers Free Spin (handled in f-02)
      if (SYMBOLS[symId].isScatter) continue;
      // Jackpot does not score ways; 5-of-a-kind (Wild assists) triggers JP draw (j-03)
      if (SYMBOLS[symId].isJackpot) continue;

      let matchCount = 0;
      let numWays    = 1;
      const hitCells: number[][] = [];
      let wildUsed   = false;

      for (let offset = 0; offset < COLS; offset++) {
        const actualCol = anchorCol + offset * dir;
        const rowsWithSym: number[] = [];
        for (let r = 0; r < ROWS; r++) {
          const cellId = grid[r][actualCol];
          if (cellId === symId) {
            rowsWithSym.push(r);
          } else if (SYMBOLS[cellId]?.isWild) {
            rowsWithSym.push(r);
            wildUsed = true;
          }
        }
        if (rowsWithSym.length === 0) break;
        matchCount++;
        numWays *= rowsWithSym.length;
        hitCells.push(rowsWithSym);
      }

      if (matchCount < 3) continue;

      const base            = PAYOUT_BASE[matchCount] ?? 0;
      const mult            = SlotEngine.scaledMult(symId, poolTotalW, coinScale, dmgScale, fairnessExp);
      const isMercenary     = !isDrafted.has(symId);
      const mercenaryMult   = isMercenary ? 0.30 : 1.0;
      const wildMult        = wildUsed ? 2.0 : 1.0;   // SPEC §15 M1 — way with wild ×2
      const rawCoin         = base * numWays * mult.coinMult * mercenaryMult * wildMult;
      const rawDmg          = base * numWays * mult.dmgMult  * mercenaryMult * wildMult;

      wayHits.push({ symbolId: symId, matchCount, numWays, hitCells, rawCoin, rawDmg, isMercenary, wildUsed });
      totalCoin += rawCoin;
      totalDmg  += rawDmg;
    }

    let finalCoin = Math.floor(totalCoin * (bet / 100));
    let finalDmg  = Math.floor(totalDmg  * (bet / 100));
    if (totalDmg  > 0 && finalDmg  === 0) finalDmg  = 1;
    if (totalCoin > 0 && finalCoin === 0) finalCoin = 1;

    return { coinWon: finalCoin, dmgDealt: finalDmg, wayHits };
  }
}
