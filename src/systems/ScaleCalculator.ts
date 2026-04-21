import { SYMBOLS, PAYOUT_BASE, LINES_COUNT } from '@/config/SymbolsConfig';
import { buildUnionPool, totalWeight } from './SymbolPool';
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
 * Uses analytical expected-value formula (not Monte Carlo).
 * Formula from Dual Slot 3.html calculateOptimalScales().
 */
export function calculateScales(
  targetRtpPct:   number,
  targetDmgPct:   number,
  selectedSymIds: number[],
  poolTotalW:     number,
  fairnessExp:    number = 2.0,
  coinExp:        number = 1.0,
): ScaleResult {
  let rawEVCoin = 0;
  let rawEVDmg  = 0;

  for (const id of selectedSymIds) {
    const sym   = SYMBOLS[id];
    const prob  = sym.weight / poolTotalW;
    const ratio = poolTotalW / sym.weight;

    const dynCoin = Math.pow(ratio, coinExp);
    const dynDmg  = Math.pow(ratio, fairnessExp);

    // Expected payout contribution per payline per spin
    const p3 = Math.pow(prob, 3) * (1 - prob);
    const p4 = Math.pow(prob, 4) * (1 - prob);
    const p5 = Math.pow(prob, 5);
    const ev  = p3 * (PAYOUT_BASE[3] ?? 0)
              + p4 * (PAYOUT_BASE[4] ?? 0)
              + p5 * (PAYOUT_BASE[5] ?? 0);

    rawEVCoin += ev * dynCoin;
    rawEVDmg  += ev * dynDmg;
  }

  const rawCoin = rawEVCoin * LINES_COUNT || 1;
  const rawDmg  = rawEVDmg  * LINES_COUNT || 1;

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
  const pool    = buildUnionPool(selectedA, selectedB, SYMBOLS);
  const engine  = new SlotEngine(4, 5);
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
    const pool = buildUnionPool(selectedA, selectedB, SYMBOLS);
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
