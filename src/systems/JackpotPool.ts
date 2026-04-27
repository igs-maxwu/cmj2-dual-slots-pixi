/**
 * Jackpot Pool — SPEC §15.8 M12 Progressive Jackpot
 *
 * 3-tier independent progressive pools (minor / major / grand).
 * Pure TypeScript, zero Pixi dependency — caller manages state.
 *
 * Design:
 * - Each spin contributes 1% of total bet (both sides) to the combined fund.
 * - Fund splits 50/30/20 to minor/major/grand pools.
 * - localStorage persists across match + session (key: dualslot.jackpot.v1).
 * - On bad data / quota error / first-time use: fall back to seed values.
 *
 * API:
 *   loadPools()                         → JackpotPools (from storage or seeds)
 *   savePools(pools)                    → void (silently skips quota/SecurityError)
 *   accrueOnBet(pools, totalBet)        → JackpotPools (pure, does NOT mutate or save)
 *   resetPool(pools, tier)              → JackpotPools (pure, does NOT mutate or save)
 */

export interface JackpotPools {
  minor: number;   // 人獎 (Small)
  major: number;   // 地獎 (Medium)
  grand: number;   // 天獎 (Grand)
}

/** Seed (floor) values per SPEC §15.8 (NT$ at bet=100 base payouts) */
export const JACKPOT_SEEDS: Readonly<JackpotPools> = Object.freeze({
  minor:   50_000,
  major:  500_000,
  grand: 5_000_000,
});

/** 1% of every total spin bet accrues to the combined JP fund */
export const JACKPOT_ACCRUAL_RATE = 0.01;

/** Fund distribution: 50% → minor, 30% → major, 20% → grand */
export const JACKPOT_POOL_WEIGHTS: Readonly<Record<keyof JackpotPools, number>> = Object.freeze({
  minor: 0.50,
  major: 0.30,
  grand: 0.20,
});

const STORAGE_KEY = 'dualslot.jackpot.v1';

/**
 * Load pools from localStorage.
 *
 * Falls back to JACKPOT_SEEDS on any of:
 *   - key not found (first-time use)
 *   - JSON parse error
 *   - schema mismatch (missing field, NaN, Infinity, or value < seed)
 *   - SecurityError thrown in incognito / sandboxed environments
 */
export function loadPools(): JackpotPools {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...JACKPOT_SEEDS };

    const parsed = JSON.parse(raw) as Partial<JackpotPools>;
    const isValid =
      typeof parsed.minor === 'number' && Number.isFinite(parsed.minor) && parsed.minor >= JACKPOT_SEEDS.minor &&
      typeof parsed.major === 'number' && Number.isFinite(parsed.major) && parsed.major >= JACKPOT_SEEDS.major &&
      typeof parsed.grand === 'number' && Number.isFinite(parsed.grand) && parsed.grand >= JACKPOT_SEEDS.grand;

    if (!isValid) return { ...JACKPOT_SEEDS };
    return { minor: parsed.minor!, major: parsed.major!, grand: parsed.grand! };
  } catch {
    // JSON.parse failure, SecurityError (incognito), or other storage errors
    return { ...JACKPOT_SEEDS };
  }
}

/**
 * Persist pools to localStorage.
 * Silently skips on QuotaExceededError / SecurityError — never crashes caller.
 */
export function savePools(pools: JackpotPools): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pools));
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[JackpotPool] save skipped (quota/security):', e);
  }
}

/**
 * Pure accrual function — returns updated pools WITHOUT mutating input or saving.
 * Caller is responsible for calling savePools() after each spin.
 *
 * totalBet: sum of betA + betB for this spin.
 * During Free Spin, betA/betB are both 0, so no accrual occurs (correct by design).
 */
export function accrueOnBet(pools: JackpotPools, totalBet: number): JackpotPools {
  if (totalBet <= 0) return pools;
  const fund = totalBet * JACKPOT_ACCRUAL_RATE;
  return {
    minor: pools.minor + fund * JACKPOT_POOL_WEIGHTS.minor,
    major: pools.major + fund * JACKPOT_POOL_WEIGHTS.major,
    grand: pools.grand + fund * JACKPOT_POOL_WEIGHTS.grand,
  };
}

/**
 * Reset one tier to its seed value after a jackpot payout (j-03).
 * Returns new pools WITHOUT mutating input or saving.
 */
export function resetPool(pools: JackpotPools, tier: keyof JackpotPools): JackpotPools {
  return { ...pools, [tier]: JACKPOT_SEEDS[tier] };
}
