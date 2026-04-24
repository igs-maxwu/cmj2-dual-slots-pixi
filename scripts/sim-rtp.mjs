#!/usr/bin/env node
/**
 * RTP Simulation Harness  — Sprint 4 m-01
 *
 * Usage:
 *   npx tsx scripts/sim-rtp.mjs [--rounds N] [--seed S] [--runs R] [--config CFG]
 *
 * Imports TypeScript source via tsx + tsconfig.json @/ path alias.
 *
 * Game-loop passives replicated from BattleScreen (not inside SlotEngine):
 *   Azure Dragon  — +20% dmg on own 4+ match of azure-clan symbols
 *   Underdog buff — ×1.3 dmg when attacker HP ratio < 0.30
 *   Chip floor    — after 3 consecutive 0-way spins inject minGuaranteedDmg
 *   Phoenix       — +200 coin per enemy kill (Vermilion clan)
 *   White Tiger   — 10% incoming-dmg reduction (inside distributeDamage)
 *   Black Tortoise— lethal-hit shield once (inside distributeDamage)
 *
 * Math.random is monkey-patched to the seeded PRNG for the duration of each
 * simulation run, so createFormation() (which calls Math.random directly) is
 * also deterministic.  The original is restored after each run.
 *
 * Future action: add optional rng parameter to createFormation() to avoid
 * monkey-patching (see MATH-BASELINE §5 flag #5).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── TypeScript source imports (tsx resolves @/ via tsconfig.json paths) ─────
import { SYMBOLS, PAYOUT_BASE, DEFAULT_UNIT_HP, DEFAULT_BET,
         DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG, DEFAULT_FAIRNESS_EXP,
         streakMult }
  from '@/config/SymbolsConfig';
import { buildFullPool, totalWeight }  from '@/systems/SymbolPool';
import { SlotEngine }                  from '@/systems/SlotEngine';
import { createFormation, isTeamAlive, teamHpTotal, hasAliveOfClan }
  from '@/systems/Formation';
import { distributeDamage }            from '@/systems/DamageDistributor';
import { calculateScales }             from '@/systems/ScaleCalculator';

// ── CLI argument parsing ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, def) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : def;
}
const ROUNDS     = parseInt(getArg('--rounds', '10000'), 10);
const SEED       = parseInt(getArg('--seed',   '1234'),  10);
const RUNS       = parseInt(getArg('--runs',   '50'),    10);
const CONFIG_KEY = getArg('--config', 'symmetric');

// ── Mulberry32 seeded PRNG (self-contained, no npm) ──────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Draft configurations ─────────────────────────────────────────────────────
// SYMBOLS by clan:  white=[0,5]  vermilion=[1,6]  black=[2,7]  azure=[3,4]
const DRAFT_CONFIGS = {
  symmetric:  [0, 1, 2, 3, 4],   // default: one of each (heavy-weight bias)
  azure:      [3, 4, 0, 1, 2],   // 2 azure + 3 others
  white:      [0, 5, 1, 2, 3],   // 2 white + 3 others
  vermilion:  [1, 6, 0, 2, 3],   // 2 vermilion + 3 others
  black:      [2, 7, 0, 1, 3],   // 2 black + 3 others
};

const selected = DRAFT_CONFIGS[CONFIG_KEY] ?? DRAFT_CONFIGS.symmetric;
const UNIT_HP   = DEFAULT_UNIT_HP;                    // per-spirit HP (SPEC §15.3)
const TEAM_HP   = UNIT_HP * selected.length;          // derived; 5 × 1000 = 5000
const BET       = DEFAULT_BET;       // 100
const FAIRNESS  = DEFAULT_FAIRNESS_EXP; // 2.0
const PHOENIX_COIN_PER_KILL = 200;   // m-04: tuned from 500 to bring total RTP under 100%

// ── Pre-compute scales (shared across all runs / matches) ────────────────────
const pool   = buildFullPool(SYMBOLS);
const tw     = totalWeight(pool);
const scales = calculateScales(
  DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG, selected, tw, FAIRNESS,
);
const { coinScale, dmgScale } = scales;

// ── Chip-floor helper (mirrors BattleScreen.minGuaranteedDmg) ────────────────
function minGuaranteedDmg() {
  // Use highest-weight selected symbol (most common = smallest ratio = conservative min)
  const anchorId = selected.reduce(
    (best, id) => SYMBOLS[id].weight > SYMBOLS[best].weight ? id : best,
    selected[0],
  );
  const mult   = SlotEngine.scaledMult(anchorId, tw, 1, dmgScale, FAIRNESS);
  const rawDmg = (PAYOUT_BASE[3] ?? 5) * 1 * mult.dmgMult;
  return Math.max(1, Math.floor(rawDmg * (BET / 100)));
}

// ── Per-run simulation ────────────────────────────────────────────────────────
/**
 * Runs ROUNDS rounds (multiple matches) and returns per-run metrics.
 * rng is a Mulberry32 function; Math.random is monkey-patched to rng
 * for the full duration so createFormation() is deterministic too.
 */
function simRun(rng) {
  const origRandom = Math.random;
  // Monkey-patch: createFormation() uses Math.random directly.
  // We replace it with the seeded rng so formation placement is deterministic.
  // Restored after the run ends.
  Math.random = rng;

  const engine = new SlotEngine(3, 5);

  // ── accumulators ──────────────────────────────────────────────────────────
  let totalBet  = 0, totalWon = 0;
  let totalDmgDealt = 0, totalMaxHp = 0;
  let totalMatches = 0;

  // Hit-frequency buckets (per side independently → 2 × ROUNDS samples)
  let hf_miss = 0, hf_1_3 = 0, hf_4_10 = 0, hf_11_30 = 0, hf_30plus = 0;
  let hf_total = 0;

  // Passive counters
  let tigerDefendSpins    = 0;  // rounds where white tiger alive on defending side
  let tigerTotalSpins     = 0;  // total rounds where distributeDamage is called on each side
  let tortoiseShields     = 0;  // total shield activations across all matches
  let dragonBonusDmg      = 0;
  let phoenixCoinTotal    = 0;

  // Wild counters
  let wildBoostedWayHits  = 0;  // total way-hits where ≥1 Wild cell contributed
  let totalWayHits        = 0;  // total way-hits across all sides

  // Streak counters (M3)
  let streakA = 0, streakB = 0;
  let totalStreakSumA = 0, totalStreakSumB = 0;
  let maxStreakObserved = 0;
  let streakBoostedCoin = 0;  // extra coin earned due to streak > 1

  // Match stats
  let drawCount   = 0;
  let winsA       = 0, winsB = 0;
  let underdogFires = 0, underdogSpins = 0;
  let chipFloorFires = 0;

  // Current match state
  let formationA = createFormation(selected, UNIT_HP);
  let formationB = createFormation(selected, UNIT_HP);
  totalMaxHp += TEAM_HP * 2;  // both sides' initial HP counts toward the pool

  let consecutiveMissA = 0, consecutiveMissB = 0;
  let lastPreHpA = teamHpTotal(formationA);
  let lastPreHpB = teamHpTotal(formationB);
  let lastDmgA = 0, lastDmgB = 0;

  for (let round = 0; round < ROUNDS; round++) {
    totalBet += BET * 2;  // both sides bet each round

    const spin = engine.spin(
      pool, selected, selected, BET, BET,
      coinScale, dmgScale, coinScale, dmgScale, FAIRNESS, rng,
    );

    // M3 Streak Multiplier applied to coin (streak from previous round)
    const sMA = streakMult(streakA);
    const sMB = streakMult(streakB);
    const coinWonA = Math.floor(spin.sideA.coinWon * sMA);
    const coinWonB = Math.floor(spin.sideB.coinWon * sMB);
    totalWon += coinWonA + coinWonB;
    streakBoostedCoin += (coinWonA - spin.sideA.coinWon) + (coinWonB - spin.sideB.coinWon);

    // ── Hit-frequency histogram (per side) ──
    for (const ways of [spin.sideA.wayHits.length, spin.sideB.wayHits.length]) {
      hf_total++;
      if      (ways === 0)   hf_miss++;
      else if (ways <= 3)    hf_1_3++;
      else if (ways <= 10)   hf_4_10++;
      else if (ways <= 30)   hf_11_30++;
      else                   hf_30plus++;
    }

    // ── Wild boost tracking ────────────────────────────────────────────────
    for (const wh of spin.sideA.wayHits) {
      totalWayHits++;
      if (wh.wildUsed) wildBoostedWayHits++;
    }
    for (const wh of spin.sideB.wayHits) {
      totalWayHits++;
      if (wh.wildUsed) wildBoostedWayHits++;
    }

    let dmgA = spin.sideA.dmgDealt;
    let dmgB = spin.sideB.dmgDealt;

    // ── Azure Dragon passive: +20% dmg on own 4+ match of azure-clan symbols ──
    if (hasAliveOfClan(formationA, 'azure')) {
      for (const wh of spin.sideA.wayHits) {
        if (wh.matchCount >= 4 && SYMBOLS[wh.symbolId]?.clan === 'azure') {
          const bonus = Math.floor(wh.rawDmg * 0.2 * (BET / 100));
          dmgA            += bonus;
          dragonBonusDmg  += bonus;
        }
      }
    }
    if (hasAliveOfClan(formationB, 'azure')) {
      for (const wh of spin.sideB.wayHits) {
        if (wh.matchCount >= 4 && SYMBOLS[wh.symbolId]?.clan === 'azure') {
          const bonus = Math.floor(wh.rawDmg * 0.2 * (BET / 100));
          dmgB            += bonus;
          dragonBonusDmg  += bonus;
        }
      }
    }

    // ── M3 Streak Multiplier on dmg (after dragon bonus, global round multiplier) ──
    totalStreakSumA += streakA;
    totalStreakSumB += streakB;
    if (streakA > maxStreakObserved) maxStreakObserved = streakA;
    if (streakB > maxStreakObserved) maxStreakObserved = streakB;
    if (dmgA > 0) dmgA = Math.floor(dmgA * sMA);
    if (dmgB > 0) dmgB = Math.floor(dmgB * sMB);

    // ── Underdog buff: ×1.3 dmg when attacker HP ratio < 0.30 ────────────
    underdogSpins++;
    const ratioA = teamHpTotal(formationA) / TEAM_HP;
    const ratioB = teamHpTotal(formationB) / TEAM_HP;
    if (ratioA < 0.30 && dmgA > 0) { dmgA = Math.ceil(dmgA * 1.3); underdogFires++; }
    if (ratioB < 0.30 && dmgB > 0) { dmgB = Math.ceil(dmgB * 1.3); underdogFires++; }

    // ── Consecutive-miss tracking + chip damage floor ─────────────────────
    if (spin.sideA.wayHits.length === 0) consecutiveMissA++;
    else                                  consecutiveMissA = 0;
    if (spin.sideB.wayHits.length === 0) consecutiveMissB++;
    else                                  consecutiveMissB = 0;

    if (consecutiveMissA >= 3 && dmgA === 0) {
      dmgA = minGuaranteedDmg();
      consecutiveMissA = 0;
      chipFloorFires++;
    }
    if (consecutiveMissB >= 3 && dmgB === 0) {
      dmgB = minGuaranteedDmg();
      consecutiveMissB = 0;
      chipFloorFires++;
    }

    // ── Update Streak for next round (after wayHits + chip floor known) ──
    if (spin.sideA.wayHits.length === 0) streakA = 0; else streakA++;
    if (spin.sideB.wayHits.length === 0) streakB = 0; else streakB++;

    // ── White Tiger passive tracking (inside distributeDamage) ────────────
    if (dmgA > 0) {
      tigerTotalSpins++;
      if (hasAliveOfClan(formationB, 'white')) tigerDefendSpins++;
    }
    if (dmgB > 0) {
      tigerTotalSpins++;
      if (hasAliveOfClan(formationA, 'white')) tigerDefendSpins++;
    }

    // ── Black Tortoise shield tracking ────────────────────────────────────
    const shieldsBeforeB = formationB.reduce((n, u) => n + (u?.shieldUsed ? 1 : 0), 0);
    const shieldsBeforeA = formationA.reduce((n, u) => n + (u?.shieldUsed ? 1 : 0), 0);

    // ── Distribute damage ─────────────────────────────────────────────────
    const eventsOnB = dmgA > 0 ? distributeDamage(formationB, dmgA, 'A') : [];
    const eventsOnA = dmgB > 0 ? distributeDamage(formationA, dmgB, 'B') : [];

    // ── Accumulate shield activations ─────────────────────────────────────
    const shieldsAfterB = formationB.reduce((n, u) => n + (u?.shieldUsed ? 1 : 0), 0);
    const shieldsAfterA = formationA.reduce((n, u) => n + (u?.shieldUsed ? 1 : 0), 0);
    tortoiseShields += (shieldsAfterB - shieldsBeforeB) + (shieldsAfterA - shieldsBeforeA);

    // ── Damage accounting ─────────────────────────────────────────────────
    const actualDmgOnB = eventsOnB.reduce((s, e) => s + e.damageTaken, 0);
    const actualDmgOnA = eventsOnA.reduce((s, e) => s + e.damageTaken, 0);
    totalDmgDealt += actualDmgOnA + actualDmgOnB;

    // ── Vermilion Phoenix passive: +200 coin per enemy kill ───────────────
    if (hasAliveOfClan(formationA, 'vermilion')) {
      const kills = eventsOnB.filter(e => e.died).length;
      const phoenixCoin = kills * PHOENIX_COIN_PER_KILL * (BET / 100);
      phoenixCoinTotal += phoenixCoin;
      totalWon         += phoenixCoin;
    }
    if (hasAliveOfClan(formationB, 'vermilion')) {
      const kills = eventsOnA.filter(e => e.died).length;
      const phoenixCoin = kills * PHOENIX_COIN_PER_KILL * (BET / 100);
      phoenixCoinTotal += phoenixCoin;
      totalWon         += phoenixCoin;
    }

    // ── Match termination check ───────────────────────────────────────────
    const aAlive = isTeamAlive(formationA);
    const bAlive = isTeamAlive(formationB);

    if (!aAlive || !bAlive) {
      totalMatches++;

      // Overkill tiebreaker (SPEC §9): winner = side with higher dmgDealt this round
      if (!aAlive && !bAlive) {
        // Simultaneous kill = draw (or resolve by last damage if equal)
        if (dmgA > dmgB) winsA++;
        else if (dmgB > dmgA) winsB++;
        else drawCount++;
      } else if (!bAlive) {
        winsA++;
      } else {
        winsB++;
      }

      // Count tortoise shields gained in this match for per-match average
      // (already accumulated in tortoiseShields cumulatively)

      // Reset for next match
      formationA = createFormation(selected, UNIT_HP);
      formationB = createFormation(selected, UNIT_HP);
      totalMaxHp += TEAM_HP * 2;
      consecutiveMissA = 0;
      consecutiveMissB = 0;
      streakA = 0;
      streakB = 0;
    }
  }

  // Restore Math.random after this run
  Math.random = origRandom;

  return {
    totalBet,
    totalWon,
    totalDmgDealt,
    totalMaxHp,
    totalMatches,
    hf_miss, hf_1_3, hf_4_10, hf_11_30, hf_30plus, hf_total,
    tigerDefendSpins, tigerTotalSpins,
    tortoiseShields,
    dragonBonusDmg,
    phoenixCoinTotal,
    wildBoostedWayHits, totalWayHits,
    totalStreakSumA, totalStreakSumB, maxStreakObserved, streakBoostedCoin,
    drawCount, winsA, winsB,
    underdogFires, underdogSpins,
    chipFloorFires,
  };
}

// ── Aggregate across multiple runs ──────────────────────────────────────────
const startMs = Date.now();
process.stderr.write(
  `\n[sim-rtp] ${RUNS} run(s) × ${ROUNDS.toLocaleString()} rounds` +
  ` | seed=${SEED} | config=${CONFIG_KEY}\n`,
);

const runResults = [];
for (let r = 0; r < RUNS; r++) {
  const rng = mulberry32(SEED + r);
  const result = simRun(rng);
  runResults.push(result);
  if (r % 10 === 9 || r === RUNS - 1) {
    process.stderr.write(`  Completed run ${r + 1}/${RUNS}\n`);
  }
}
const elapsedMs = Date.now() - startMs;

// ── Sum across all runs ──────────────────────────────────────────────────────
const agg = runResults.reduce((acc, r) => {
  for (const key of Object.keys(r)) acc[key] = (acc[key] ?? 0) + r[key];
  return acc;
}, {});

// ── Per-run RTP array for variance ──────────────────────────────────────────
const perRunRtp       = runResults.map(r => r.totalWon / r.totalBet);
const perRunMissRate  = runResults.map(r => r.hf_miss / r.hf_total);

function mean(arr)   { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ── Build output object ──────────────────────────────────────────────────────
const coinRtp          = agg.totalWon / agg.totalBet;
const avgRoundsPerMatch = ROUNDS * RUNS / agg.totalMatches;
const dmgRtp           = agg.totalDmgDealt / agg.totalMaxHp;
const hfDenom          = agg.hf_total || 1;

const output = {
  meta: {
    rounds:    ROUNDS,
    seed:      SEED,
    runs:      RUNS,
    config:    CONFIG_KEY,
    selected,
    coinScale: +coinScale.toFixed(6),
    dmgScale:  +dmgScale.toFixed(6),
    timestamp: new Date().toISOString(),
    elapsedMs,
    msPerRound: +(elapsedMs / (ROUNDS * RUNS)).toFixed(4),
  },
  coin: {
    totalBet:  agg.totalBet,
    totalWon:  +agg.totalWon.toFixed(2),
    rtp:       +coinRtp.toFixed(4),
    target:    0.60,
    delta:     +(coinRtp - 0.60).toFixed(4),
    note: 'DEFAULT_TARGET_RTP=97 causes rtp≈0.97; SPEC §15 target=0.60 (m-02 will reconcile)',
  },
  damage: {
    totalMaxHp:       agg.totalMaxHp,
    totalDealt:       agg.totalDmgDealt,
    dmgRtp:           +dmgRtp.toFixed(4),
    totalMatches:     agg.totalMatches,
    avgRoundsPerMatch: +avgRoundsPerMatch.toFixed(2),
    analyticalEstimate: +(TEAM_HP / (DEFAULT_TARGET_DMG * (BET / 100))).toFixed(1),
  },
  hitFreq: {
    miss:      +(agg.hf_miss   / hfDenom).toFixed(4),
    ways_1_3:  +(agg.hf_1_3   / hfDenom).toFixed(4),
    ways_4_10: +(agg.hf_4_10  / hfDenom).toFixed(4),
    ways_11_30:+(agg.hf_11_30 / hfDenom).toFixed(4),
    ways_30plus:+(agg.hf_30plus/ hfDenom).toFixed(4),
    spec_targets: { miss: 0.40, ways_1_3: 0.35, ways_4_10: 0.18, ways_11_30: 0.055, ways_30plus: 0.015 },
  },
  passives: {
    tiger_reduction_rate:                   +(agg.tigerDefendSpins / (agg.tigerTotalSpins || 1)).toFixed(4),
    tortoise_shield_activations_per_match:  +(agg.tortoiseShields / agg.totalMatches).toFixed(4),
    dragon_bonus_dmg_total:                 +agg.dragonBonusDmg.toFixed(2),
    dragon_bonus_dmg_pct_of_total_dmg:      +(agg.dragonBonusDmg / (agg.totalDmgDealt || 1)).toFixed(4),
    phoenix_coin_on_kill_total:             +agg.phoenixCoinTotal.toFixed(2),
    phoenix_pct_of_total_coin:              +(agg.phoenixCoinTotal / (agg.totalWon || 1)).toFixed(4),
    chip_floor_fires_per_1k_rounds:         +(agg.chipFloorFires / (ROUNDS * RUNS) * 1000).toFixed(3),
  },
  wild: {
    boosted_way_hits:           agg.wildBoostedWayHits,
    boosted_pct_of_all_hits:    +((agg.wildBoostedWayHits / (agg.totalWayHits || 1))).toFixed(4),
  },
  streak: {
    avg_streak_A:               +(agg.totalStreakSumA / (ROUNDS * RUNS)).toFixed(4),
    avg_streak_B:               +(agg.totalStreakSumB / (ROUNDS * RUNS)).toFixed(4),
    max_streak:                 runResults.reduce((m, r) => Math.max(m, r.maxStreakObserved), 0),
    streak_boosted_coin_pct:    +(agg.streakBoostedCoin / (agg.totalWon || 1)).toFixed(4),
  },
  match: {
    draw_rate:              +(agg.drawCount  / agg.totalMatches).toFixed(4),
    overkill_A_wins:        +(agg.winsA      / agg.totalMatches).toFixed(4),
    overkill_B_wins:        +(agg.winsB      / agg.totalMatches).toFixed(4),
    underdog_buff_fire_rate:+(agg.underdogFires / (agg.underdogSpins * 2 || 1)).toFixed(4),
  },
  perRunVariance: {
    rtp_mean:      +mean(perRunRtp).toFixed(4),
    rtp_stddev:    +stddev(perRunRtp).toFixed(4),
    hitMiss_mean:  +mean(perRunMissRate).toFixed(4),
    hitMiss_stddev:+stddev(perRunMissRate).toFixed(4),
  },
};

// ── Output ───────────────────────────────────────────────────────────────────
const jsonOut = JSON.stringify(output, null, 2);

// stdout: machine-readable JSON (pipeable)
process.stdout.write(jsonOut + '\n');

// Write to file for archival
const outDir = new URL('./output/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(outDir, { recursive: true });
const outFile = outDir + 'sim-baseline.json';
writeFileSync(outFile, jsonOut + '\n', 'utf8');

// stderr: human-readable summary
process.stderr.write(`\n── Simulation complete in ${(elapsedMs / 1000).toFixed(1)}s ──\n`);
process.stderr.write(`Coin RTP: ${(coinRtp * 100).toFixed(2)}%  (target 60.00%, delta ${((coinRtp - 0.60) * 100).toFixed(2)}pp)\n`);
process.stderr.write(`Hit miss: ${(agg.hf_miss / hfDenom * 100).toFixed(1)}%  (SPEC target 40%)\n`);
process.stderr.write(`Avg rounds/match: ${avgRoundsPerMatch.toFixed(1)}  (analytical est. ${+(TEAM_HP / (DEFAULT_TARGET_DMG * (BET/100))).toFixed(1)})\n`);
process.stderr.write(`A wins: ${(agg.winsA/agg.totalMatches*100).toFixed(1)}%  B wins: ${(agg.winsB/agg.totalMatches*100).toFixed(1)}%  draws: ${(agg.drawCount/agg.totalMatches*100).toFixed(2)}%\n`);
process.stderr.write(`Output written to: ${outFile}\n\n`);
