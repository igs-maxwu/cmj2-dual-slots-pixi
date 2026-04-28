/** All non-spirit UI assets under public/assets/ui/ */
export const UI_ASSET_KEYS = [
  'slot-frame',
  'portrait-ring',
  'win-burst',
] as const;

export type UiAssetKey = typeof UI_ASSET_KEYS[number];
