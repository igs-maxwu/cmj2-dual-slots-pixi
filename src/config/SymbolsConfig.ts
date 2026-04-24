export type Clan = 'azure' | 'vermilion' | 'white' | 'black';

export interface SymbolDef {
  id:          number;
  name:        string;                     // legacy color name, kept for algo
  shape:       'triangle'|'hexagon'|'square'|'cross'|'circle'|'heart'|'diamond'|'star'|'wild';
  color:       number;                     // 0xRRGGBB atmosphere color
  weight:      number;
  spiritKey:   string;                     // asset filename (no extension)
  spiritName:  string;                     // 中文顯示名
  clan:        Clan;
  isWild?:     boolean;    // Wild substitutes for any spirit; does not score its own ways
}

export const SYMBOLS: SymbolDef[] = [
  { id:0, name:'Yellow', shape:'triangle', color:0xFFD700, weight:20,
    spiritKey:'yin',           spiritName:'寅',       clan:'white'     },
  { id:1, name:'Orange', shape:'hexagon',  color:0xFF8C00, weight:15,
    spiritKey:'zhuluan',       spiritName:'朱鸞',     clan:'vermilion' },
  { id:2, name:'Green',  shape:'square',   color:0x32CD32, weight:12,
    spiritKey:'zhaoyu',        spiritName:'朝雨',     clan:'black'     },
  { id:3, name:'Cyan',   shape:'cross',    color:0x00FFFF, weight:10,
    spiritKey:'mengchenzhang', spiritName:'孟辰璋',   clan:'azure'     },
  { id:4, name:'Blue',   shape:'circle',   color:0x1E90FF, weight:8,
    spiritKey:'canlan',        spiritName:'蒼嵐',     clan:'azure'     },
  { id:5, name:'Pink',   shape:'heart',    color:0xFF69B4, weight:6,
    spiritKey:'luoluo',        spiritName:'珞洛',     clan:'white'     },
  { id:6, name:'Red',    shape:'diamond',  color:0xFF4500, weight:4,
    spiritKey:'lingyu',        spiritName:'凌羽',     clan:'vermilion' },
  { id:7, name:'Purple', shape:'star',     color:0x9400D3, weight:2,
    spiritKey:'xuanmo',        spiritName:'玄墨',     clan:'black'     },
  { id:8, name:'Wild',   shape:'wild',     color:0xffd700, weight:3,
    spiritKey:'wild',          spiritName:'神獸化身', clan:'azure',    isWild:true },
];

export const PAYOUT_BASE: Record<number,number> = { 3:5, 4:20, 5:100 };
/** @deprecated Paylines replaced by Ways engine in P0.2; kept for grep-safety only. */
export const LINES_COUNT = 0;
export const DEFAULT_UNIT_HP    = 1000;     // per-spirit HP (SPEC §15.3)
export const DEFAULT_BET        = 100;
export const DEFAULT_TARGET_RTP = 60;    // SPEC §15.3 Base Ways coin RTP
export const DEFAULT_TARGET_DMG = 600;   // halve match length: ~20 round → ~10
export const DEFAULT_FAIRNESS_EXP = 2.0;
/** Coin-rarity exponent — matches COIN_EXPONENT_FIXED=2.0 in reference demo. */
export const COIN_EXP = 2.0;

export const DEFAULT_SELECTED_A: number[] = [0,1,2,3,4];
export const DEFAULT_SELECTED_B: number[] = [0,1,2,3,4];
