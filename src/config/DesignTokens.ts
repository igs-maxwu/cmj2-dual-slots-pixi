import { CANVAS_WIDTH, CANVAS_HEIGHT } from './GameConfig';

/* ════════════════════════════════════════════════════════════════════════════
   Design Tokens — mirrors `dual-slots-battle-design-system/colors_and_type.css`
   Aesthetic: 豪華東亞仙境 · 深海金色 · 1v1 雀靈競技場老虎機

   Phaser consumes numeric `0xRRGGBB` colours and string font families, so
   the CSS custom properties from the handoff are projected here as:
     • `SEA / GOLD / CTA / TEAM / HP / SYM / SURF / FG` — palettes
     • `GLOW / SHADOW` — alpha + blur hints for FxManager
     • `RADIUS / FRAME / SPACING / FS` — geometry
     • `MOTION` — duration + easing tuples
     • `FONT / FONT_SIZE` — string stacks with calligraphy display layer

   Legacy keys under `COLORS.*` / `FONT.base|bold` are preserved so existing
   UI components keep compiling; values are remapped onto the new palette.
   ════════════════════════════════════════════════════════════════════════════ */

// ─── Sea · 深海底層（背景） ─────────────────────────────────────────────
export const SEA = {
  abyss:    0x061a33,
  deep:     0x0b2f5e,
  mid:      0x1b5a8a,
  light:    0x3aa8c9,
  caustic:  0x7ad7e8,
  rim:      0x12406b,
} as const;

// ─── Gold · 金屬（框線、標題、Logo） ─────────────────────────────────────
export const GOLD = {
  pale:   0xffe9a8,
  light:  0xffd54a,
  base:   0xf5b82a,
  deep:   0xe89b1a,
  shadow: 0x8a5412,
  glow:   0xffc94d,
} as const;

/** Vertical gold gradient stops — drive Phaser Graphics / custom textures. */
export const GOLD_GRADIENT_V = [0xffe9a8, 0xffd54a, 0xf5b82a, 0xe89b1a, 0x8a5412] as const;
export const GOLD_GRADIENT_STOPS_V = [0.00, 0.38, 0.60, 0.82, 1.00] as const;

// ─── CTA · 按鈕 ─────────────────────────────────────────────────────────
export const CTA = {
  green:      0x28c76f,
  greenLight: 0x58e090,
  greenDeep:  0x16803d,
  red:        0xe74c3c,
  redDeep:    0x9b1b1b,
  gold:       0xf5b82a,
  goldDeep:   0xe89b1a,
} as const;

// ─── Team · 1v1 陣營（青龍 / 朱雀） ─────────────────────────────────────
export const TEAM = {
  azure:         0x2f88e8,
  azureDeep:     0x164d8f,
  azureGlow:     0x6ab7ff,
  vermilion:     0xe84a3c,
  vermilionDeep: 0x8a1e12,
  vermilionGlow: 0xff8a6a,
} as const;

// ─── Symbols · 轉軸符號 placeholder 配色 ─────────────────────────────────
export const SYM = {
  low1:    0xc9a27a,
  low2:    0xb388d6,
  low3:    0xffd27a,
  mid1:    0x5fc29a,
  mid2:    0xff6b88,
  mid3:    0xa06bd8,
  high1:   0xffb347,
  high2:   0x4fd1e8,
  wild:    0xffe066,
  scatter: 0xff3b6b,
} as const;

// ─── HP / 狀態 ──────────────────────────────────────────────────────────
export const HP = {
  high:  0x39d274,
  mid:   0xffb020,
  low:   0xe84a3c,
  track: 0x1a0f0f,
} as const;

// ─── Surfaces · 面板（numeric color + alpha 0..1） ──────────────────────
export const SURF = {
  panel:      { color: 0x081c36, alpha: 0.85 },
  panelSolid: { color: 0x0d2547, alpha: 1.00 },
  glass:      { color: 0x7ad7e8, alpha: 0.08 },
  darkInlay:  { color: 0x020a18, alpha: 1.00 },
  overlay:    { color: 0x030a16, alpha: 0.75 },
} as const;

// ─── Foreground text ────────────────────────────────────────────────────
export const FG = {
  white:  0xffffff,
  cream:  0xfff6da,
  muted:  0x7ea3c7,
  dim:    0x4f7a9e,
  shadow: 0x051326,
} as const;

// ─── Glow hints — FxManager reads these for shadow / flame params ───────
export const GLOW = {
  gold:      { color: 0xffc94d, alphaOuter: 0.55, alphaInner: 0.25, outer: 48, inner: 24 },
  goldSm:    { color: 0xffc94d, alphaOuter: 0.65, outer: 10 },
  azure:     { color: 0x6ab7ff, alphaOuter: 0.55, alphaInner: 0.30, outer: 64, inner: 32 },
  vermilion: { color: 0xff8a6a, alphaOuter: 0.55, alphaInner: 0.30, outer: 64, inner: 32 },
  green:     { color: 0x58e090, alphaOuter: 0.60, outer: 18 },
} as const;

// ─── Shadows — drop shadows on frames / buttons ─────────────────────────
export const SHADOW = {
  frameOuter:  { color: 0x000000, alpha: 0.55, y: 6, blur: 14 },
  buttonDrop:  { color: 0x000000, alpha: 0.35, y: 4 },
  buttonPress: { color: 0x000000, alpha: 0.35, y: 1 },
} as const;

// ─── Geometry ───────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   6,
  md:   10,
  lg:   18,
  pill: 999,
} as const;

export const FRAME = {
  goldW:  3,
  innerW: 1,
} as const;

export const SPACING = {
  s1:  4,  s2:  8,  s3: 12, s4: 16, s5: 20,
  s6: 24,  s8: 32,  s10: 40, s12: 48,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────
export const FONT = {
  /** 書法大標（遊戲名、Big Win） */
  display:     `'Ma Shan Zheng', 'Noto Serif TC', serif`,
  displayBold: `'ZCOOL KuaiLe', 'Noto Serif TC', serif`,
  /** 次標題、UI 重要文字（雀靈名、技能名） */
  title:       `'Noto Serif TC', 'Cinzel', serif`,
  /** 一般 UI */
  body:        `'Noto Sans TC', 'PingFang TC', sans-serif`,
  /** 數字（贏分、倍率、等級） */
  num:         `'Cinzel', 'Noto Serif TC', serif`,

  /**
   * Legacy aliases — existing scenes pass `FONT.base` / `FONT.bold` straight
   * into Phaser `fontFamily`. Phaser accepts CSS-shorthand `<weight> <stack>`
   * in that field, so `bold` keeps its historical weight + swaps to the new
   * Noto Serif TC stack in one go.
   */
  base: `'Noto Sans TC', 'PingFang TC', sans-serif`,
  bold: `700 'Noto Serif TC', 'Cinzel', serif`,
} as const;

export const FONT_SIZE = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   18,
  xl:   22,
  xxl:  28,   // legacy key — remapped to --fs-2xl (was 36)
  h3:   22,
  h2:   28,
  h1:   40,
  big:  56,
  hero: 88,   // 書法大標
} as const;

export const LETTER_SPACING = {
  ui:   0.04,
  caps: 0.18,
} as const;

// ─── Motion ─────────────────────────────────────────────────────────────
export const MOTION = {
  durFast: 120,
  durMed:  220,
  durSlow: 380,
  easeOut:  'Cubic.easeOut',
  easeIn:   'Cubic.easeIn',
  easeBack: 'Back.easeOut',
  bezierEaseOut:  [0.22, 1, 0.36, 1] as const,
  bezierEaseIn:   [0.55, 0, 0.75, 0] as const,
  bezierEaseBack: [0.34, 1.56, 0.64, 1] as const,
} as const;

// ════════════════════════════════════════════════════════════════════════
// Legacy `COLORS` map — existing UI components consume this; values remap
// onto the new deep-sea + gold palette so the reskin lands without touching
// call sites. New code should prefer the SEA / GOLD / CTA / TEAM tokens.
// ════════════════════════════════════════════════════════════════════════
export const COLORS = {
  bg:           SEA.abyss,
  bgPanel:      SURF.panelSolid.color,
  bgCell:       SEA.rim,
  bgReel:       SURF.darkInlay.color,

  borderNormal: SEA.mid,
  borderGold:   GOLD.base,
  borderA:      TEAM.azure,
  borderB:      TEAM.vermilion,

  playerA:      TEAM.azure,
  playerB:      TEAM.vermilion,
  white:        FG.white,
  textMuted:    FG.muted,

  hpHigh:       HP.high,
  hpMid:        HP.mid,
  hpLow:        HP.low,
  hpBg:         HP.track,

  btnIdle:      CTA.green,
  btnHover:     CTA.greenLight,
  btnPressed:   CTA.greenDeep,
  btnDisabled:  0x2c3a4a,

  coin:         GOLD.base,
  dmgFloat:     CTA.red,
  healFloat:    CTA.green,
} as const;

// ─── Proportional Layout ─────────────────────────────────────────────────────
// All positions derived from canvas size — no magic pixel values.

export const LAYOUT = {
  // Horizontal
  panelW:      Math.round(CANVAS_WIDTH  * 0.165),   // ~211px  side panels
  centerX:     Math.round(CANVAS_WIDTH  * 0.5),      // 640
  get centerW() { return CANVAS_WIDTH - this.panelW * 2; }, // ~858px

  // Vertical zones
  arenaH:      Math.round(CANVAS_HEIGHT * 0.44),     // ~317px  formations
  reelY:       Math.round(CANVAS_HEIGHT * 0.44),     // slot machine starts here
  reelH:       Math.round(CANVAS_HEIGHT * 0.38),     // ~274px
  ctrlY:       Math.round(CANVAS_HEIGHT * 0.82),     // ~590px  log + button
  ctrlH:       Math.round(CANVAS_HEIGHT * 0.18),     // ~130px

  // Formation grid (3×3 cells)
  cellSize:    52,
  cellGap:     6,
  get gridW()  { return this.cellSize * 3 + this.cellGap * 2; },  // 168px
  get gridH()  { return this.cellSize * 3 + this.cellGap * 2; },  // 168px

  // Reel cell
  reelCellW:   96,
  reelCellH:   58,
  reelCellGap: 6,
  get reelTotalW() { return this.reelCellW * 5 + this.reelCellGap * 4; }, // 504px
  get reelTotalH() { return this.reelCellH * 4 + this.reelCellGap * 3; }, // 250px

  // Spin button
  btnW: 200,
  btnH:  56,
} as const;
