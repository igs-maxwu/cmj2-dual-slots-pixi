export interface SymbolDef {
  id:     number;
  name:   string;
  shape:  'triangle'|'hexagon'|'square'|'cross'|'circle'|'heart'|'diamond'|'star';
  color:  number;   // 0xRRGGBB hex
  weight: number;
}

export const SYMBOLS: SymbolDef[] = [
  { id:0, name:'Yellow', shape:'triangle', color:0xFFD700, weight:20 },
  { id:1, name:'Orange', shape:'hexagon',  color:0xFF8C00, weight:15 },
  { id:2, name:'Green',  shape:'square',   color:0x32CD32, weight:12 },
  { id:3, name:'Cyan',   shape:'cross',    color:0x00FFFF, weight:10 },
  { id:4, name:'Blue',   shape:'circle',   color:0x1E90FF, weight:8  },
  { id:5, name:'Pink',   shape:'heart',    color:0xFF69B4, weight:6  },
  { id:6, name:'Red',    shape:'diamond',  color:0xFF4500, weight:4  },
  { id:7, name:'Purple', shape:'star',     color:0x9400D3, weight:2  },
];

export const PAYOUT_BASE: Record<number,number> = { 3:5, 4:20, 5:100 };
export const LINES_COUNT = 100;
export const DEFAULT_TEAM_HP    = 10000;
export const DEFAULT_BET        = 100;
export const DEFAULT_TARGET_RTP = 97;
export const DEFAULT_TARGET_DMG = 300;
export const DEFAULT_FAIRNESS_EXP = 2.0;
export const COIN_EXP = 1.0;

/** Default 5 symbol IDs selected for Player A (ids 0-4) */
export const DEFAULT_SELECTED_A: number[] = [0,1,2,3,4];
/** Default 5 symbol IDs selected for Player B (ids 0-4) */
export const DEFAULT_SELECTED_B: number[] = [0,1,2,3,4];
