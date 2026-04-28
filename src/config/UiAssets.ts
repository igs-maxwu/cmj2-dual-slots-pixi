/** All non-spirit UI assets under public/assets/ui/ */
export const UI_ASSET_KEYS = [
  'slot-frame',
  'btn-normal',
  'btn-ornate',
  'portrait-ring',
  'corner-ornament',
  'dragon-corner',
  'win-burst',
  'divider',
  'logo-mark',
] as const;

export type UiAssetKey = typeof UI_ASSET_KEYS[number];
