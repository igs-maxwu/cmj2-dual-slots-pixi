/**
 * Dual-direction slot engine matching Dual Slot 3.html reference demo.
 * A evaluates paylines left->right (anchor col 0).
 * B evaluates paylines right->left (anchor col 4).
 */
import { generatePaylines } from './PaylinesGenerator';
import { spinGrid, totalWeight, type PoolEntry } from './SymbolPool';
import { SYMBOLS, PAYOUT_BASE, LINES_COUNT, COIN_EXP } from '@/config/SymbolsConfig';

/** Side identifier — kept as a named export for backward compatibility. */
export type Side = 'A' | 'B';

export interface HitLine {
  lineIndex:  number;
  symbolId:   number;
  matchCount: number;
  rawCoin:    number;
  rawDmg:     number;
}

export interface SideResult {
  coinWon:  number;
  dmgDealt: number;
  hitLines: HitLine[];
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
  private paylines: number[][];
  private rows: number;
  private cols: number;

  constructor(rows = 3, cols = 5) {
    this.rows = rows;
    this.cols = cols;
    this.paylines = generatePaylines(this.rows, this.cols, LINES_COUNT);
  }

  getPaylines(): Readonly<number[][]> { return this.paylines; }

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

    const sideA = this._evalSide(grid, this.paylines, 'A', selectedA, betA,
                                  tw, coinScaleA, dmgScaleA, fairnessExp);
    const sideB = this._evalSide(grid, this.paylines, 'B', selectedB, betB,
                                  tw, coinScaleB, dmgScaleB, fairnessExp);
    return { grid, sideA, sideB };
  }

  private _evalSide(
    grid:        number[][],
    paylines:    number[][],
    side:        'A' | 'B',
    selected:    number[],
    bet:         number,
    poolTotalW:  number,
    coinScale:   number,
    dmgScale:    number,
    fairnessExp: number,
  ): SideResult {
    const COLS     = this.cols;
    const hitLines: HitLine[] = [];
    let totalCoin = 0;
    let totalDmg  = 0;

    for (let li = 0; li < paylines.length; li++) {
      const line = paylines[li];

      const anchorCol = side === 'A' ? 0 : COLS - 1;
      const anchorSym = grid[line[anchorCol]][anchorCol];
      if (!selected.includes(anchorSym)) continue;

      let matchCount = 1;
      if (side === 'A') {
        for (let c = 1; c < COLS; c++) {
          if (grid[line[c]][c] === anchorSym) matchCount++;
          else break;
        }
      } else {
        for (let c = COLS - 2; c >= 0; c--) {
          if (grid[line[c]][c] === anchorSym) matchCount++;
          else break;
        }
      }

      if (matchCount < 3) continue;

      const base    = PAYOUT_BASE[matchCount] ?? 0;
      const mult    = SlotEngine.scaledMult(anchorSym, poolTotalW, coinScale, dmgScale, fairnessExp);
      const rawCoin = base * mult.coinMult;
      const rawDmg  = base * mult.dmgMult;

      hitLines.push({ lineIndex: li, symbolId: anchorSym, matchCount, rawCoin, rawDmg });
      totalCoin += rawCoin;
      totalDmg  += rawDmg;
    }

    let finalCoin = Math.floor(totalCoin * (bet / 100));
    let finalDmg  = Math.floor(totalDmg  * (bet / 100));
    if (totalDmg  > 0 && finalDmg  === 0) finalDmg  = 1;
    if (totalCoin > 0 && finalCoin === 0) finalCoin = 1;

    return { coinWon: finalCoin, dmgDealt: finalDmg, hitLines };
  }
}

