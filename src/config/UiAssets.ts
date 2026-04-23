/** All non-spirit UI assets under public/assets/ui/ */
export const UI_ASSET_KEYS = [
  'slot-frame',
  'draft-tile-frame',
  'btn-normal',
  'btn-ornate',
  'hp-frame',
  'portrait-ring',
  'corner-ornament',
  'dragon-corner',
  'win-burst',
  'divider',
  'vs-badge',
  'logo-mark',
] as const;

export type UiAssetKey = typeof UI_ASSET_KEYS[number];
