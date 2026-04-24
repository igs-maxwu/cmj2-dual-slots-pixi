import type { SymbolDef } from './SymbolsConfig';
import * as T from './DesignTokens';

export interface GemAsset {
  assetKey: string;   // 'gem-triangle' | 'gem-hexagon' | 'gem-pentagon' | 'gem-square' | 'gem-diamond'
  tint:     number;   // CLAN colour applied as sprite.tint
}

/**
 * Maps each SYMBOLS[id] to a SOS2 gem asset + clan tint.
 *
 * SOS2 has 5 gem shapes; SYMBOLS has 8 entries.  Same-clan pairs reuse a shape
 * but carry different tints so they stay visually distinct:
 *
 *   id  spirit        clan       gem             tint
 *   0   寅  (Yin)     white      triangle        CLAN.white  (amber)
 *   1   朱鸞          vermilion  hexagon         CLAN.vermilion (flame-orange)
 *   2   朝雨          black      square          CLAN.black  (jade)
 *   3   孟辰璋        azure      pentagon        CLAN.azure  (teal-sky)
 *   4   蒼嵐          azure      diamond         CLAN.azure
 *   5   珞洛          white      square          CLAN.white  (reused shape, different clan tint)
 *   6   凌羽          vermilion  diamond         CLAN.vermilion
 *   7   玄墨          black      pentagon        CLAN.black
 */
export const GEM_FOR_SYMBOL: Record<number, GemAsset> = {
  0: { assetKey: 'gem-triangle', tint: T.CLAN.white     },
  1: { assetKey: 'gem-hexagon',  tint: T.CLAN.vermilion },
  2: { assetKey: 'gem-square',   tint: T.CLAN.black     },
  3: { assetKey: 'gem-pentagon', tint: T.CLAN.azure     },
  4: { assetKey: 'gem-diamond',  tint: T.CLAN.azure     },
  5: { assetKey: 'gem-square',   tint: T.CLAN.white     },
  6: { assetKey: 'gem-diamond',  tint: T.CLAN.vermilion },
  7: { assetKey: 'gem-pentagon', tint: T.CLAN.black     },
};

export function gemForSymbol(sym: SymbolDef): GemAsset {
  return GEM_FOR_SYMBOL[sym.id] ?? { assetKey: 'gem-triangle', tint: 0xffffff };
}
