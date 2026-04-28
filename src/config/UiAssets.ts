/** All non-spirit UI assets under public/assets/ui/
 *  s12-ui-06: all webp assets decommissioned — array kept empty for future use. */
export const UI_ASSET_KEYS = [] as const;

export type UiAssetKey = typeof UI_ASSET_KEYS[number];
