export const BGM_KEYS = ['battle', 'big-win', 'victory'] as const;
export type BgmKey = typeof BGM_KEYS[number];

export const SFX_KEYS = [
  // reel (4)
  'reel-spin-loop', 'reel-stop-outer', 'reel-stop-inner', 'reel-r3-anticipation',
  // win tier (5)
  'win-small', 'win-nice', 'win-big', 'win-mega', 'win-jackpot',
  // skill (8)
  'skill-canlan', 'skill-luoluo', 'skill-zhuluan', 'skill-zhaoyu',
  'skill-meng',   'skill-yin',    'skill-xuanmo',  'skill-lingyu',
  // impact (4)
  'hit-light', 'hit-heavy', 'hitstop-whoosh', 'damage-crit',
  // ui (6)
  'ui-hover', 'ui-click', 'ui-draft-select', 'ui-apply', 'ui-back', 'ui-error',
  // status (3)
  'status-hp-low', 'status-underdog', 'status-victory-stinger',
] as const;
export type SfxKey = typeof SFX_KEYS[number];
