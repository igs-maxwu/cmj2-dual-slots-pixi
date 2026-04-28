/** All non-spirit UI assets under public/assets/ui/ */
export const UI_ASSET_KEYS = [
  'slot-frame',
  'btn-normal',
  'btn-ornate',
  'portrait-ring',
  'win-burst',
] as const;

export type UiAssetKey = typeof UI_ASSET_KEYS[number];
