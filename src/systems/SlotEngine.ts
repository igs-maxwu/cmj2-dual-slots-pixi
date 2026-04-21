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

/** @deprecated EngineConfig is from the old API; use (rows, cols) directly. */
export interface EngineConfig {
  rows:        number;
  cols:        number;
  linesCount?: number;
  payoutBase?: Record<string, number>;
  allSymbols?: unknown[];
}

export class SlotEngine {
  private paylines: number[][];
  private rows: number;
  private cols: number;

  constructor(rowsOrCfg: number | EngineConfig = 4, cols = 5) {
    if (typeof rowsOrCfg === 'object') {
      this.rows = rowsOrCfg.rows;
      this.cols = rowsOrCfg.cols;
    } else {
      this.rows = rowsOrCfg;
      this.cols = cols;
    }
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
    selectedA:   number[] | SpiritDef[],
    selectedB:   number[] | SpiritDef[],
    betA:        number,
    betB:        number,
    coinScaleA:  number = 1,
    dmgScaleA:   number = 1,
    coinScaleB:  number = 1,
    dmgScaleB:   number = 1,
    fairnessExp: number = 2.0,
    rng:         () => number = Math.random,
  ): SpinResult {
    // Normalize legacy spirit-array calls to unique symbol-id arrays
    const normA = (selectedA as (number | SpiritDef)[]).map(x =>
      typeof x === 'number' ? x : (x as SpiritDef).injectsSymbols[0] ?? 0);
    const normB = (selectedB as (number | SpiritDef)[]).map(x =>
      typeof x === 'number' ? x : (x as SpiritDef).injectsSymbols[0] ?? 0);
    const resolvedA: number[] = [...new Set(normA)];
    const resolvedB: number[] = [...new Set(normB)];

    const grid = spinGrid(this.rows, this.cols, pool, rng);
    const tw   = totalWeight(pool);

    const sideA = this._evalSide(grid, this.paylines, 'A', resolvedA, betA,
                                  tw, coinScaleA, dmgScaleA, fairnessExp);
    const sideB = this._evalSide(grid, this.paylines, 'B', resolvedB, betB,
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

// ---------------------------------------------------------------------------
// Legacy stubs — kept for files not yet migrated to R5
// These will be removed when GameScene, SkillResolver, SpiritRegistry are
// rewritten in R5.
// ---------------------------------------------------------------------------

export type Element = 'man' | 'pin' | 'sou' | 'honor' | 'wild';
export type Rarity  = 'N' | 'R' | 'SR' | 'SSR';

/** @deprecated Use SymbolDef from SymbolsConfig.ts after R5 */
export interface SymbolDef {
  id:        number;
  name:      string;
  element:   Element;
  tier:      1 | 2 | 3;
  weight:    number;
  coinMult:  number;
  dmgMult:   number;
  traitKey:  string;
}

export interface SkillTrigger {
  type:      'own_line'|'ally_same_element'|'symbol_match'|'hp_threshold'|'on_death';
  minMatch?: number;
  count?:    number;
  symbolId?: number;
  hpPct?:    number;
  once?:     boolean;
}

export interface SkillEffect {
  type:      'dmg_bonus'|'coin_bonus'|'double_eval'|'pierce_formation'|
             'refund_bet'|'dmg_immunity'|'skill_resonance'|'halve_strongest_enemy'|'revive_hp';
  value?:    number;
  duration?: number;
}

export interface SpiritSkill {
  id:          string;
  name:        string;
  trigger:     SkillTrigger;
  effect:      SkillEffect;
  description: string;
}

/** @deprecated Will be removed in R5 */
export interface SpiritDef {
  id:             string;
  name:           string;
  rarity:         Rarity;
  element:        Element;
  tier:           1 | 2 | 3;
  baseHp:         number;
  atkBonus:       number;
  coinBonus:      number;
  injectsSymbols: number[];
  skill:          SpiritSkill;
}

/** @deprecated Use PoolEntry from SymbolPool.ts after R5 */
export type PoolSymbol = { id: number; weight: number };

/** @deprecated */
export interface EvaluationResult {
  grid:  number[][];
  sideA: SideResult;
  sideB: SideResult;
}

export interface RoundState {
  usedRevive:         Set<string>;
  immunityRoundsLeft: number;
  hp:    number[];
  maxHp: number[];
}

export function createRoundState(): RoundState {
  return { usedRevive: new Set<string>(), immunityRoundsLeft: 0, hp: [], maxHp: [] };
}

/** @deprecated Use buildUnionPool from SymbolPool.ts after R5 */
export function buildSymbolPool(
  _spiritsA: SpiritDef[],
  _spiritsB: SpiritDef[],
  _allSymbols: SymbolDef[],
): PoolSymbol[] {
  return [];
}

export interface SimStats {
  iterations: number;
  rtpA:       number;
  rtpB:       number;
  avgDmgA:    number;
  avgDmgB:    number;
  winRateA:   number;
}
