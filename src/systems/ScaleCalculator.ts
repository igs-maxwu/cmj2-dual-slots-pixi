import { SYMBOLS, PAYOUT_BASE } from '@/config/SymbolsConfig';
import { REEL_ROWS } from '@/config/GameConfig';
import { buildFullPool, totalWeight } from './SymbolPool';
import { SlotEngine } from './SlotEngine';

export interface ScaleResult {
  coinScale: number;
  dmgScale:  number;
}

/**
 * Computes coinScale and dmgScale for a player given:
 *  - targetRtpPct: desired coin return % (e.g. 97)
 *  - targetDmgPct: desired damage % (e.g. 300 means expected total match dmg = 300% of teamHp)
 *  - selectedSymIds: the 5 symbol IDs this player selected
 *  - poolTotalW: total weight of the union pool (A union B)
 *  - fairnessExp: exponent for damage scaling (default 2.0)
 *
 * Uses analytical Ways-to-Win expected-value formula (not Monte Carlo).
 *
 * Ways EV per round per symbol:
 *   p        = symbol weight / poolTotalW  (per-cell probability)
 *   p_any    = 1 - (1 - p)^ROWS            (prob ≥1 in a column)
 *
 *   P(matchCount = k)            = p_any^k × (1 - p_any)   for k < COLS
 *   P(matchCount = 5)            = p_any^5                  for k = 5
 *   E[numWays | matchCount = k]  ≈ (p × ROWS / p_any)^k
 *
 *   Combining (p_any^k cancels with 1/p_any^k from E[numWays|k]):
 *   EV_3 = (1 - p_any) × (ROWS × p)^3 × BASE[3]
 *   EV_4 = (1 - p_any) × (ROWS × p)^4 × BASE[4]
 *   EV_5 =              (ROWS × p)^5 × BASE[5]
 *   Total EV per symbol = EV_3 + EV_4 + EV_5.
 *   No LINES_COUNT factor — Ways EV is absolute per round.
 */
export function calculateScales(
  targetRtpPct:   number,
  targetDmgPct:   number,
  selectedSymIds: number[],
  poolTotalW:     number,
  fairnessExp:    number = 2.0,
  coinExp:        number = 2.0,
): ScaleResult {
  const ROWS = REEL_ROWS;
  let rawEVCoin = 0;
  let rawEVDmg  = 0;

  for (const id of selectedSymIds) {
    const sym   = SYMBOLS[id];
    const prob  = sym.weight / poolTotalW;
    const ratio = poolTotalW / sym.weight;

    const dynCoin = Math.pow(ratio, coinExp);
    const dynDmg  = Math.pow(ratio, fairnessExp);

    const p_any = 1 - Math.pow(1 - prob, ROWS);
    const eWays3 = Math.pow(ROWS * prob, 3);
    const eWays4 = Math.pow(ROWS * prob, 4);
    const eWays5 = Math.pow(ROWS * prob, 5);

    const ev = (1 - p_any) * eWays3 * (PAYOUT_BASE[3] ?? 0)
             + (1 - p_any) * eWays4 * (PAYOUT_BASE[4] ?? 0)
             +               eWays5 * (PAYOUT_BASE[5] ?? 0);

    rawEVCoin += ev * dynCoin;
    rawEVDmg  += ev * dynDmg;
  }

  const rawCoin = rawEVCoin || 1;
  const rawDmg  = rawEVDmg  || 1;

  return {
    coinScale: targetRtpPct / rawCoin,
    dmgScale:  targetDmgPct / rawDmg,
  };
}

/**
 * Runs a quick match simulation to verify actual win rate.
 * Returns winRateA in [0, 100].
 */
export function simulateWinRate(
  selectedA:   number[],
  selectedB:   number[],
  coinScaleA:  number,
  dmgScaleA:   number,
  coinScaleB:  number,
  dmgScaleB:   number,
  fairnessExp: number,
  teamHpA:     number,
  teamHpB:     number,
  betA:        number,
  betB:        number,
  matches:     number = 600,
): number {
  const pool    = buildFullPool(SYMBOLS);
  const engine  = new SlotEngine(3, 5);
  let winsA     = 0;
  const ROUND_LIMIT = 2000;

  for (let m = 0; m < matches; m++) {
    let hpA = teamHpA, hpB = teamHpB, rounds = 0;
    while (hpA > 0 && hpB > 0 && rounds < ROUND_LIMIT) {
      rounds++;
      const res = engine.spin(pool, selectedA, selectedB, betA, betB,
                              coinScaleA, dmgScaleA, coinScaleB, dmgScaleB, fairnessExp);
      hpA -= res.sideB.dmgDealt;
      hpB -= res.sideA.dmgDealt;
    }
    if      (hpA > 0 && hpB <= 0) winsA += 1;
    else if (hpA <= 0 && hpB > 0) winsA += 0;
    else                           winsA += 0.5; // draw
  }
  return (winsA / matches) * 100;
}

/**
 * Auto-balance: iteratively adjusts fairnessExp until winRateA ~= 50% +/- 1%.
 * Matches Dual Slot 3.html autoBalanceWinRate() algorithm.
 * Returns the balanced fairnessExp.
 */
export function autoBalance(
  selectedA:     number[],
  selectedB:     number[],
  teamHpA:       number,
  teamHpB:       number,
  betA:          number,
  betB:          number,
  maxIterations: number = 15,
): { fairnessExp: number; finalWinRate: number } {
  let exp = 2.0;
  let finalWinRate = 0;
  const TARGET = 50.0;
  const TOL    = 1.0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const pool = buildFullPool(SYMBOLS);
    const tw   = totalWeight(pool);
    const scalesA = calculateScales(97, 300, selectedA, tw, exp);
    const scalesB = calculateScales(97, 300, selectedB, tw, exp);

    const rate = simulateWinRate(
      selectedA, selectedB,
      scalesA.coinScale, scalesA.dmgScale,
      scalesB.coinScale, scalesB.dmgScale,
      exp, teamHpA, teamHpB, betA, betB, 600,
    );
    finalWinRate = rate;
    const diff = rate - TARGET;
    if (Math.abs(diff) <= TOL) break;
    const step = Math.abs(diff) > 5 ? 0.2 : 0.05;
    exp += diff > 0 ? step : -step;
    exp = Math.max(0.1, Math.min(10.0, exp));
  }
  return { fairnessExp: exp, finalWinRate };
}
