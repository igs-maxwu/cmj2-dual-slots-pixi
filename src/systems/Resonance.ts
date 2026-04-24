import { SYMBOLS } from '@/config/SymbolsConfig';
import type { ClanId } from '@/config/DesignTokens';

export type ResonanceTier = 'SOLO' | 'DUAL' | 'NONE';

export interface ResonanceResult {
  tier:         ResonanceTier;
  boostedClans: ClanId[];              // clans with ×1.5 active; SOLO=1, DUAL=2, NONE=0
  clanCounts:   Record<ClanId, number>; // for HUD readout
}

/**
 * Analyse a 5-spirit draft and determine Resonance tier (SPEC §15.5 adapted for 5-pick).
 *
 * With MAX_PICKS=5 and 2 spirits per clan (azure/white/vermilion/black), exactly
 * two distributions are achievable:
 *
 *   SOLO  (2,1,1,1) — all 4 clans covered, 1 pair   → boostedClans = [pairedClan]
 *   DUAL  (2,2,1,0) — 2 pairs, 1 solo, 1 missing    → boostedClans = [clan1, clan2]
 *   NONE  — other (edge case: Wild in draft, or impossible distribution)
 *
 * Wild symbols (isWild) are excluded from clan counts — Resonance measures
 * actual spirit coverage, not substitutes.
 */
export function detectResonance(selected: number[]): ResonanceResult {
  const clanCounts: Record<ClanId, number> = {
    azure: 0, white: 0, vermilion: 0, black: 0,
  };

  for (const id of selected) {
    const sym = SYMBOLS[id];
    if (!sym || sym.isWild) continue;
    clanCounts[sym.clan as ClanId]++;
  }

  const counts = Object.values(clanCounts).sort((a, b) => b - a);
  const pairs  = (Object.entries(clanCounts) as [ClanId, number][])
    .filter(([, c]) => c === 2)
    .map(([clan]) => clan);

  // (2,2,1,0) — two pairs
  if (counts[0] === 2 && counts[1] === 2 && counts[2] === 1 && counts[3] === 0) {
    return { tier: 'DUAL', boostedClans: pairs, clanCounts };
  }
  // (2,1,1,1) — one pair, all clans covered
  if (counts[0] === 2 && counts[1] === 1 && counts[2] === 1 && counts[3] === 1) {
    return { tier: 'SOLO', boostedClans: pairs, clanCounts };
  }
  return { tier: 'NONE', boostedClans: [], clanCounts };
}

/**
 * Returns the Resonance multiplier (×1.5 or ×1.0) for a given spirit clan.
 * Used by r-02 when applying per-wayHit coin/dmg scaling.
 */
export function resonanceMultForClan(result: ResonanceResult, clan: ClanId): number {
  return result.boostedClans.includes(clan) ? 1.5 : 1.0;
}
