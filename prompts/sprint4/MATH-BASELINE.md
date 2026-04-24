# MATH-BASELINE — Sprint 4 RTP Simulation Harness + Calibration Plan

**Author**: the-actuary (sub-agent)
**Date**: 2026-04-23
**Status**: Design doc only — no code. Dispatches m-01 executor.
**SPEC refs**: §8 (dual-scale), §9 (overkill), §10 (economy), §15 (Math Model v1.0)

---

## 1. Simulation Methodology

### Harness location

`scripts/sim-rtp.mjs` — Node.js ESM. Uses `tsx` or `vite-node` to import TypeScript source directly:

```
npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 42 --runs 50
```

Imports only from `src/systems/` and `src/config/` — zero Pixi. This mirrors the existing pattern in `scripts/compress-assets.mjs`.

### N-budget per metric

| Metric | Min rounds | Rationale |
|---|---|---|
| Coin RTP | 10,000 | Central limit theorem: ±1% CI at 3σ for slot math |
| Hit frequency | 10,000 | Rare tier (30+ ways) at 1.5% target needs ~150 events minimum |
| Passive trigger rates | 10,000 | Dragon/Tortoise fire rarely — 10k ensures ≥100 activations at realistic rates |
| Rounds-per-match | 1,000 matches | Each match is ~10 rounds → 10k total rounds embedded |
| Win/draw distribution | 1,000 matches | P(draw) expected < 0.5% → need 1k for statistical signal |

Multi-run aggregation: 50 × 10,000 rounds = 500,000 total. Reports per-run variance to distinguish true model variance from seed variance. All runs use sequential seeds (seed, seed+1, …).

### Deterministic seed

The `rng` parameter already threads through `SlotEngine.spin()`, `spinGrid()`, and `pickSymbol()`. The harness supplies a seeded PRNG (Mulberry32 or xoshiro128+ — pure JS, no npm dependency) injected at `buildFullPool` + `SlotEngine.spin` callsites. `createFormation` also uses `Math.random` internally — the harness must monkey-patch or pass a seeded replacement for full determinism.

**Open issue for executor**: `Formation.createFormation()` calls `Math.random()` directly (line 20). Executor should add an optional `rng?` parameter in m-01 so formation layout is also seeded.

### Output format

```jsonc
{
  "meta": { "rounds": 10000, "seed": 42, "runs": 50, "timestamp": "..." },
  "coin": {
    "totalBet": 1000000, "totalWon": 600234,
    "rtp": 0.600, "target": 0.60, "delta": 0.000
  },
  "damage": {
    "totalMaxHp": 4000000, "totalDealt": 1602100,
    "dmgRtp": 0.4005, "avgRoundsPerMatch": 9.8
  },
  "hitFreq": {
    "miss": 0.401, "ways_1_3": 0.347, "ways_4_10": 0.179,
    "ways_11_30": 0.055, "ways_30plus": 0.018
  },
  "passives": {
    "tiger_reduction_rate": 0.0, "tortoise_shield_activations_per_match": 0.0,
    "dragon_bonus_dmg_total": 0, "dragon_bonus_dmg_pct_of_total_dmg": 0.0,
    "phoenix_coin_on_kill_total": 0, "phoenix_pct_of_total_coin": 0.0
  },
  "match": {
    "draw_rate": 0.003, "overkill_A_wins": 0.497, "overkill_B_wins": 0.500,
    "underdog_buff_fire_rate": 0.072
  },
  "perRunVariance": { "rtp_stddev": 0.008, "hitFreq_stddev": 0.003 }
}
```

---

## 2. Metrics to Capture

### 2a. Coin RTP (SPEC §10, §15.3)

```
coinRTP = SUM(coinWon per spin) / SUM(bet per spin)
```

Broken down: per side (A vs B independently, since dual-scale), and per clan-draft combo (all 8 choose 5 = C(8,5) = 56 combos is too many for baseline; instead run 4 representative combos: all-azure, all-white, all-vermilion, all-black, and mixed default [0,1,2,3,4]).

**SPEC §15.3 target**: Base Ways = 60%. This is the number ScaleCalculator is analytically calibrated to via `DEFAULT_TARGET_RTP = 97`. The discrepancy (97 vs 60) is the known issue: `DEFAULT_TARGET_RTP` is passed as `targetRtpPct` but is used without the bet/100 scaling factor in `ScaleCalculator.calculateScales()`. The sim will measure the actual realized coin RTP and report whether it matches 60% or 97%.

**SPEC ambiguity flagged**: SPEC §15.3 says "Base Ways RTP 60%" but `DEFAULT_TARGET_RTP = 97` is labeled as "placeholder; Sprint 4 calibrates." These two numbers cannot both be right simultaneously. The sim will determine the truth empirically. See Section 4 for calibration paths.

### 2b. Damage RTP (SPEC §8, §15)

```
dmgRTP = SUM(dmgDealt per spin) / formation_maxHp_opponent
avgRoundsPerMatch = total_rounds / total_matches
```

SPEC target: ~400 HP/round average against a 4,000 HP formation (5 units × 800 HP each with DEFAULT_TEAM_HP=10000 / 5 = 2000 HP... wait: DEFAULT_TEAM_HP=10000, 5 units = 2000 HP/unit, 5 units = 10000 total — kills in ~10 rounds at 400 HP/round means 4000 total damage needed, not 10000). Executor note: confirm whether the "~10 rounds" target means A's 5 units die in 10 rounds, implying opponent inflicts 10000 HP / 10 = 1000 HP/round — not 400. This is a SPEC ambiguity. The sim will report raw numbers.

### 2c. Hit frequency histogram (SPEC §15.4)

Classify each spin's total wayHits count (summing sideA.wayHits.length + sideB.wayHits.length, measured per side independently):

| Tier | SPEC target |
|---|---|
| 0 ways (miss) | 40% |
| 1–3 ways | 35% |
| 4–10 ways | 18% |
| 11–30 ways | 5.5% |
| 30+ ways | 1.5% |

"Ways" here = count of WayHit entries (one per qualifying symbol per side), not numWays multiplier.

### 2d. Passive trigger rates

The sim must inject formation state into the loop:

- **White Tiger**: each distributeDamage call — record whether `hasAliveOfClan(grid, 'white')` was true → tiger_reduction_rate
- **Black Tortoise**: on each DmgEvent with `died=true` where Tortoise shield was consumed → track per-match activations. Requires reading `shieldUsed` on the grid unit after distributeDamage
- **Azure Dragon**: sum rawDmg × 0.2 × bet/100 for each wayHit where `matchCount >= 4 && clan === 'azure'` — this bonus is NOT currently implemented in SlotEngine (SlotEngine doesn't know about passives). The sim must compute it externally from the wayHits array
- **Vermilion Phoenix**: count kills per match, accumulate coin-on-kill = `500 × bet/100` per kill — also external computation from DmgEvents

**Implementation note for m-01**: Dragon and Phoenix bonuses are currently NOT applied inside SlotEngine or DamageDistributor — they are game-loop-level effects. The sim loop must apply them explicitly. Executor should replicate the exact logic from BattleScreen.

### 2e. Other metrics

- **Draw rate**: both teams hit 0 HP same round (SPEC §9 overkill resolves by dmgDealt comparison)
- **Overkill win distribution**: when simultaneous kill occurs, winner = side with higher dmgDealt that round
- **Underdog buff fire rate**: fraction of rounds where losing side had HP ratio < 0.30 before the spin, triggering ×1.3 damage — also a game-loop-level effect the sim must apply

---

## 3. Baseline Measurement Plan

Run with Sprint 3B passives ON. Recommended baseline config:

```
selectedA = [0,1,2,3,4]  (Yellow/White Tiger + Orange/Vermilion + Green/Black + Cyan/Azure + Blue/Azure)
selectedB = [0,1,2,3,4]  (symmetric)
bet = 100, teamHp = 10000, fairnessExp = 2.0
rounds = 10,000, runs = 50, seed = 1234
```

Report these three diagnostic questions:

1. **Does coin RTP match the SPEC 60% base Ways target?** Expected: the analytical solver sets `coinScale` to hit `DEFAULT_TARGET_RTP=97`, so realized coin RTP will likely be near 97%, not 60%. This will be the primary finding — the solver constant needs adjustment.

2. **Do passives shift dmgRTP above/below the ~400 HP/round target?** White Tiger passive reduces incoming damage by 10% universally (when any tiger alive on defense), which systematically reduces average damage per round. Dragon bonus adds damage when azure 4+ match fires. Net effect unknown — sim measures it.

3. **Hit frequency 60% ± ε?** The ScaleCalculator uses analytical probability math for the full 8-symbol pool. No hit-frequency tuning knob exists in the current code — fairnessExp affects damage scale, not hit frequency. Hit frequency is determined purely by symbol weights and pool composition.

---

## 4. Calibration Path

### Scenario A: All targets within ±5%

Coin RTP in [57%, 63%], hit frequency in [57%, 63%], avg rounds per match in [9, 11].

Action: declare baseline accepted. Dispatch m-03/m-04/m-05 meta mechanic executors.

### Scenario B: Coin RTP too high (expected: ~97% realized vs 60% target)

This is the most likely outcome given `DEFAULT_TARGET_RTP = 97`.

Action: change `DEFAULT_TARGET_RTP` from 97 to X where X = 97 × (60/realizedRTP).

Example: if realized coin RTP = 95%, then X = 97 × (60/95) = 61.2. Set `DEFAULT_TARGET_RTP = 61`.

Alternatively, recalibrate at the formula level: `coinScale = 0.60 / rawEVCoin` (drop the RTP-pct abstraction entirely and target 60% directly). The executor for m-02 should confirm which approach the owner prefers.

### Scenario C: Hit frequency too low (<55%) or too high (>65%)

The only structural tuning knob for hit frequency is the **symbol weight distribution**. Hit frequency = P(any qualifying way fires) = 1 - P(all symbols miss all 3+ consecutive column check). Increasing weight of common symbols (id 0-3) increases hit frequency; `fairnessExp` does NOT control hit frequency.

Action if too low: raise weights of symbols 0 and 1 (Yellow=20, Orange=15 currently). Each +5 to symbol 0 weight raises P(yellow way) meaningfully.
Action if too high: add a blank/void symbol with high weight (cleanest approach; reserved for Sprint 4 m-03 Wild slot addition).

### Scenario D: Dmg RTP way off

`DEFAULT_TARGET_DMG = 300` sets the analytical target in ScaleCalculator. If realized average rounds >> 10:

Lower `DEFAULT_TARGET_DMG` from 300 toward 200 to increase dmgScale. Each 10% reduction in `DEFAULT_TARGET_DMG` reduces dmgScale proportionally and thus reduces dmg/round, lengthening matches.

If realized average rounds << 10:

Raise `DEFAULT_TARGET_DMG` toward 400.

Rule of thumb: `avgRoundsPerMatch ≈ DEFAULT_TEAM_HP / (DEFAULT_TARGET_DMG × bet/100)` = 10000 / (300 × 1.0) = 33 expected. The current config likely produces far longer matches than 10 rounds. Sim will confirm.

---

## 5. Meta-Mechanic Simulation Design (m-03 / m-04 / m-05)

### Wild (m-03)

Add to SYMBOLS array: `{ id: 8, name: 'Wild', weight: 3, isWild: true }`. No clan assignment.

In SlotEngine `_evalSide()`, before the per-symbol loop: scan each column for Wild cells. For each non-Wild symbol's consecutive-column pass, treat a Wild cell in that column as a match (augmenting rowsWithSym). If the way fires with ≥1 Wild cell in the matched columns, apply ×2 multiplier to both rawCoin and rawDmg for that WayHit.

SPEC ambiguity: SPEC says Wild ×2 but does not specify whether Wild ×2 stacks with Streak ×2.

**Proposal: yes, multiplicative.** A Wild-boosted way during a ×2 Streak becomes ×4 on that way. This is standard slot math and adds meaningful upside variance. Flag for owner approval before m-03 executor proceeds.

Sim addition: track `wildContributionPct = wildEnhancedCoin / totalCoin`.

### Scatter (m-04)

Add `{ id: 9, name: 'Scatter', weight: 2, isScatter: true }`. Scatter never participates in ways evaluation. The spin loop counts Scatter appearances anywhere in the 5×3 grid (15 cells total).

Distribution to track:
- 0 scatter: P ≈ (1 - 2/totalW)^15
- 1 scatter: binomial
- 2 scatter: binomial
- 3+ scatter: triggers Free Spin flag in SpinResult (Sprint 6 handles the mode; Sprint 4 just emits `scatterCount >= 3`)

Sim reports: scatter count distribution, 3+ trigger rate (expected roughly 5–8% with weight=2 in pool of totalW ≈ 80).

### Streak Multiplier (m-05)

State external to SlotEngine — lives in BattleScreen game loop. Sim must replicate:

```
streakMult: 1.0 → (no miss) → 1.2 → (no miss) → 1.5 → (no miss) → 2.0 (cap)
miss (total wayHits === 0 for the active side) → reset to 1.0
```

Applied multiplicatively to BOTH coinWon and dmgDealt after SlotEngine.spin(). Interacts with Wild (see ambiguity above).

Sim tracks: streak multiplier distribution at spin time, average streak length, and contribution of streak bonus to total coin RTP.

### Post-meta RTP re-verification (m-06)

After m-03/m-04/m-05 are implemented, re-run 500k rounds with all mechanics enabled. Target: total coin RTP (base Ways 60% + Wild ~10% + Streak ~8% + Scatter free-spin accrual ~14% over lifetime) = ~100% per SPEC §15.3. Sprint 4 exit gate: 100% ± 2%.

---

## 6. Out of Scope for This Doc

- Free Spin mode (Sprint 6)
- 3-tier JP pool (Sprint 6)
- Resonance (Sprint 5)
- Curse flat 500 HP (Sprint 5)
- PvP matching balance (Sprint 7)
- Pixi rendering / visual FX of any kind

---

## SPEC Deviation Flags

| # | Flag | Status |
|---|---|---|
| 1 | `DEFAULT_TARGET_RTP=97` vs SPEC §15 "Base Ways 60%" — these are inconsistent. Sim will determine realized value; m-02 will reconcile. | Ambiguity, not violation |
| 2 | SPEC §15 "~10 rounds average" vs analytical expectation of ~33 rounds at current config — DEFAULT_TARGET_DMG=300 may be set too low. Sim will confirm. | Measurement pending |
| 3 | Wild ×2 + Streak ×2 stacking behavior not specified in SPEC §15. Proposal: multiplicative. | Owner approval needed before m-03 |
| 4 | Dragon/Phoenix passives are game-loop effects not inside SlotEngine — m-01 executor must implement them in the sim loop, not assume they are auto-applied | Implementation note |
| 5 | `createFormation()` uses unseeded `Math.random()` — breaks full determinism. m-01 executor should add optional `rng?` param. | Minor, m-01 scope |

---

## Risk Notes

- **HP floor interaction**: Black Tortoise sets HP to 1 rather than 0 on lethal hit. If multiple high-damage ways fire in one round against a lone Tortoise unit, only the first lethal event activates shield. Subsequent damage in the same round still reduces HP. Confirm `distributeDamage()` loop applies shield only once (it does: `shieldUsed` flag checked per unit).
- **Chip damage floor**: after 3 consecutive zero-way spins the engine guarantees ≥1 way on the 4th spin. This is a hit-frequency floor effect — sim must track and report how often the chip floor activates, as it skews the miss bucket downward from the theoretical value.
- **Underdog buff at HP=0 race**: if both teams trigger underdog buff in the same round, both deal ×1.3 damage — a simultaneous overkill edge case. Overkill tiebreaker (SPEC §9) resolves by comparing dmgDealt, but with ×1.3 applied symmetrically, outcomes become more random. Sim measures draw rate as a proxy.
- **Mercenary mode RTP contribution**: non-drafted symbols appear in grid at full weight but score at 30% coin and dmg. With default selections [0,1,2,3,4] on both sides, symbols 5/6/7 are always mercenary. Their contribution dampens realized RTP vs analytical expectation — the analytical ScaleCalculator does account for this via the full pool weight in probability math, but the 30% multiplier is separate. If realized RTP < analytical target, mercenary dampening is a candidate cause.

---

## Recommendation

**Dispatch m-01 executor prompt to implement the harness as specified above.**

The m-01 executor needs five concrete inputs:

1. Use `tsx` runner (already in devDependencies from the project's TypeScript setup)
2. Import path alias `@/` must resolve — add a `tsconfig.paths.mjs` shim or use `--tsconfig tsconfig.json` flag with tsx
3. Implement Mulberry32 seeded PRNG as a self-contained function in the script (no npm dependency)
4. Output JSON to stdout; also write `scripts/output/sim-baseline.json` for archival
5. CLI: `--rounds N --seed S --runs R --config (symmetric|azure|white|vermilion|black)` — where config selects which clan-homogenous draft to test

Do NOT proceed to m-02 constants tuning until m-01 produces a baseline JSON. The calibration direction (Scenario A/B/C/D above) depends entirely on measured values, not analytical prediction.
