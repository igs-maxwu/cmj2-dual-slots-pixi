import { Application, Assets, Container, FillGradient, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import type { ClanId } from '@/config/DesignTokens';
import {
  SYMBOLS, DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG,
  DEFAULT_UNIT_HP, DEFAULT_BET, DEFAULT_FAIRNESS_EXP,
  DEFAULT_SELECTED_A, DEFAULT_SELECTED_B,
} from '@/config/SymbolsConfig';
import type { SymbolDef } from '@/config/SymbolsConfig';
import { buildFullPool } from '@/systems/SymbolPool';
import { calculateScales } from '@/systems/ScaleCalculator';
import { UiButton } from '@/components/UiButton';
import { addCornerOrnaments } from '@/components/Decorations';
import { AudioManager } from '@/systems/AudioManager';
import { goldText } from '@/components/GoldText';
import { detectResonance, type ResonanceResult } from '@/systems/Resonance';
import { drawGemSymbol } from '@/components/GemSymbol';  // chore #200: shared gem icon

// ─── Clan-grouped layout ────────────────────────────────────────────────────
const CLAN_ORDER: ClanId[] = ['azure', 'white', 'vermilion', 'black'];
// chore: widen tile to use canvas horizontal space (was 152px → large wasted margin)
// CANVAS_WIDTH 720 - 52px*2 side margin - 24px gap = 592 / 2 ≈ 296 each tile
const TILE_W              = 296;        // was 152 — uses ~82% canvas width
const TILE_H              = 185;        // unchanged (200 overflows goButton past 1280px canvas)
const TILE_GAP            = 24;         // was 40 — tighter gap, tile width compensates
const BANNER_H            = 32;
const BANNER_TO_TILES_GAP = 8;
const CLAN_ROW_GAP        = 12;    // vertical gap between clan rows
const ROW_H               = BANNER_H + BANNER_TO_TILES_GAP + TILE_H;   // 225
const GRID_H              = ROW_H * 4 + CLAN_ROW_GAP * 3;              // 936
const GRID_Y              = 160;   // below title + wallet header
const TILES_TOTAL_W       = TILE_W * 2 + TILE_GAP;                     // 616
const TILES_START_X       = Math.round((CANVAS_WIDTH - TILES_TOTAL_W) / 2); // 52
const MAX_PICKS           = 5;

// ─── Tile sub-zones — horizontal split ──────────────────────────────────────
// chore: LEFT info column (name + meta + A/B) | RIGHT sprite column (2× taller)
const TILE_PAD      = 8;
const COL_GAP       = 8;
const INFO_COL_W    = 100;
const SPRITE_COL_W  = TILE_W - 2 * TILE_PAD - INFO_COL_W - COL_GAP;  // 172
const SPRITE_COL_X  = TILE_PAD + INFO_COL_W + COL_GAP;                // 116
const SPRITE_COL_Y  = TILE_PAD;                                        // 8
const SPRITE_COL_H  = TILE_H - 2 * TILE_PAD;                          // 169 (~2× old 85px)

// Info column zones (x = TILE_PAD to TILE_PAD+INFO_COL_W = 8..108)
const INFO_NAME_Y   = TILE_PAD + 6;                                    // 14
const INFO_NAME_H   = 32;
const INFO_META_Y   = INFO_NAME_Y + INFO_NAME_H + 4;                   // 50

// chore #200: meta size bump + gem icon zone + A/B horizontal
const INFO_META_H   = 18;
const INFO_GEM_Y    = INFO_META_Y + INFO_META_H + 6;                   // 74
const INFO_GEM_R    = 18;                                               // gem radius
const INFO_GEM_CY   = INFO_GEM_Y + INFO_GEM_R;                         // 92

// chore #200: A/B buttons horizontal side-by-side (was vertical stack)
const BTN_ZONE_H    = 30;
const BTN_GAP_HORZ  = 4;
const BTN_W         = (INFO_COL_W - 8 - BTN_GAP_HORZ) / 2;            // 44
const BTN_A_X       = TILE_PAD + 4;                                     // 12
const BTN_B_X       = BTN_A_X + BTN_W + BTN_GAP_HORZ;                   // 60
const BTN_Y         = TILE_H - TILE_PAD - BTN_ZONE_H - 4;               // 143
const BADGE_R       = 12;

// ─── Module-level helper ─────────────────────────────────────────────────────
function spiritsByClan(): Record<ClanId, { sym: SymbolDef; idx: number }[]> {
  const out: Record<ClanId, { sym: SymbolDef; idx: number }[]> = {
    azure: [], white: [], vermilion: [], black: [],
  };
  // Exclude Wild (isWild) and Curse (isCurse) — neither is a draftable spirit.
  const eligible = SYMBOLS.filter(s => !s.isWild && !s.isCurse && !s.isScatter && !s.isJackpot);
  eligible.forEach(sym => { out[sym.clan as ClanId].push({ sym, idx: sym.id }); });
  if (eligible.length !== 8 || CLAN_ORDER.some(c => out[c].length !== 2)) {
    throw new Error('spiritsByClan: expected 4 clans × 2 spirits each');
  }
  return out;
}

// ─── Public interfaces ───────────────────────────────────────────────────────
export interface DraftResult {
  selectedA: number[];
  selectedB: number[];
  unitHpA: number;
  unitHpB: number;
  betA: number;
  betB: number;
  coinScaleA: number;
  dmgScaleA: number;
  coinScaleB: number;
  dmgScaleB: number;
  fairnessExp: number;
  walletA: number;
  walletB: number;
}

interface TileRefs {
  border:  Graphics;
  badgeA:  Container;
  badgeB:  Container;
  btnA:    Container;
  btnABg:  Graphics;
  btnALbl: Text;
  btnB:    Container;
  btnBBg:  Graphics;
  btnBLbl: Text;
  hoverA:  boolean;
  hoverB:  boolean;
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export class DraftScreen implements Screen {
  private container    = new Container();
  private selectedA    = new Set<number>(DEFAULT_SELECTED_A);
  private selectedB    = new Set<number>(DEFAULT_SELECTED_B);
  private tiles: TileRefs[] = [];
  private statusText!: Text;
  private clanCountA!: Text;
  private clanCountB!: Text;
  private goButton!: UiButton;
  private pulseElapsed = 0;
  private app: Application | null = null;
  private pulseTickFn: ((ticker: { deltaMS: number }) => void) | null = null;
  private resonanceResult: ResonanceResult = { tier: 'NONE', boostedClans: [], clanCounts: { azure:0, white:0, vermilion:0, black:0 } };
  private clanHints: Partial<Record<ClanId, Text>> = {};

  constructor(private onReady: (cfg: DraftResult) => void) {}

  // ─── Screen lifecycle ──────────────────────────────────────────────────────
  onMount(app: Application, stage: Container): void {
    this.app = app;
    stage.addChild(this.container);
    this.drawBackground();
    addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 130, 0.55);
    this.drawTitle();
    this.drawWallets();
    this.drawClanCountRow();
    this.buildTiles();
    this.buildStatus();
    this.buildToolbar();
    this.buildGoButton();
    this.refresh();

    this.pulseTickFn = (ticker) => this.updatePulse(ticker.deltaMS);
    app.ticker.add(this.pulseTickFn);
  }

  onUnmount(): void {
    if (this.pulseTickFn && this.app) this.app.ticker.remove(this.pulseTickFn);
    this.pulseTickFn = null;
    this.container.destroy({ children: true });
    this.tiles = [];
  }

  // ─── Background ───────────────────────────────────────────────────────────
  private drawBackground(): void {
    const bg = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(T.SEA.abyss);
    this.container.addChild(bg);

    const grid = new Graphics();
    for (let x = 0; x < CANVAS_WIDTH; x += 40) grid.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT);
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) grid.moveTo(0, y).lineTo(CANVAS_WIDTH, y);
    grid.stroke({ width: 1, color: T.SEA.deep, alpha: 0.35 });
    this.container.addChild(grid);
  }

  // ─── Header (fits inside 0–160 px) ────────────────────────────────────────
  private drawTitle(): void {
    const title = new Text({
      text: 'SYMBOL DRAFT',
      style: {
        fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.h1,
        fill: T.GOLD.base, stroke: { color: T.GOLD.shadow, width: 4 },
        letterSpacing: 2,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = CANVAS_WIDTH / 2;
    title.y = 12;
    this.container.addChild(title);

    const sub = new Text({
      text: 'Pick 5 symbols for each player · Blue = A · Red = B',
      style: { fontFamily: T.FONT.body, fontSize: T.FONT_SIZE.sm, fill: T.FG.muted },
    });
    sub.anchor.set(0.5, 0);
    sub.x = CANVAS_WIDTH / 2;
    sub.y = 58;
    this.container.addChild(sub);
  }

  private drawWallets(): void {
    const labelY = 82;
    const amtY   = 98;
    const sides: Array<['A' | 'B', number]> = [
      ['A', Math.round(CANVAS_WIDTH * 0.30)],
      ['B', Math.round(CANVAS_WIDTH * 0.70)],
    ];

    for (const [side, x] of sides) {
      const color = side === 'A' ? T.TEAM.azure : T.TEAM.vermilion;
      const lbl = new Text({
        text: `PLAYER ${side} · WALLET`,
        style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.xs, fill: color, letterSpacing: 2 },
      });
      lbl.anchor.set(0.5, 0);
      lbl.x = x; lbl.y = labelY;
      this.container.addChild(lbl);

      const amt = goldText('10,000 NTD', { fontSize: 20, withShadow: true });
      amt.anchor.set(0.5, 0);
      amt.x = x; amt.y = amtY;
      this.container.addChild(amt);
    }
  }

  // ─── Clan-count readout (replaces old weight-pct distribution) ───────────
  private drawClanCountRow(): void {
    const y = 132;

    this.clanCountA = new Text({
      text: '',
      style: { fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.xs, fill: T.FG.muted, letterSpacing: 1 },
    });
    this.clanCountA.anchor.set(0, 0.5);
    this.clanCountA.x = 24; this.clanCountA.y = y;
    this.container.addChild(this.clanCountA);

    this.clanCountB = new Text({
      text: '',
      style: { fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.xs, fill: T.FG.muted, letterSpacing: 1 },
    });
    this.clanCountB.anchor.set(1, 0.5);
    this.clanCountB.x = CANVAS_WIDTH - 24; this.clanCountB.y = y;
    this.container.addChild(this.clanCountB);
  }

  // ─── Tile grid — 4 clan rows ──────────────────────────────────────────────
  private buildTiles(): void {
    // Pre-size array so we can assign by symbolId index
    this.tiles = new Array(SYMBOLS.length).fill(null) as unknown as TileRefs[];
    const totalW  = SYMBOLS.reduce((s, x) => s + x.weight, 0);
    const grouped = spiritsByClan();

    CLAN_ORDER.forEach((clanId, rowIdx) => {
      const rowY  = GRID_Y + rowIdx * (ROW_H + CLAN_ROW_GAP);
      this.drawClanBanner(clanId, rowY);

      const tileY = rowY + BANNER_H + BANNER_TO_TILES_GAP;
      grouped[clanId].forEach((entry, col) => {
        const tileX = TILES_START_X + col * (TILE_W + TILE_GAP);
        this.drawSpiritTile(entry.sym, entry.idx, clanId, tileX, tileY, totalW);
      });
    });
  }

  // ─── Clan banner (full-width, 32px) ──────────────────────────────────────
  private drawClanBanner(clanId: ClanId, rowY: number): void {
    const meta   = T.CLAN_META[clanId];
    const banner = new Container();
    banner.x = 0; banner.y = rowY;
    this.container.addChild(banner);

    // Solid panel base
    const bg = new Graphics()
      .rect(0, 0, CANVAS_WIDTH, BANNER_H)
      .fill({ color: T.SURF.panelSolid.color, alpha: 1.0 });
    banner.addChild(bg);

    // Clan-tint gradient: solid left 60%, fades right (simple overlay)
    const tint = new Graphics()
      .rect(0, 0, Math.round(CANVAS_WIDTH * 0.6), BANNER_H)
      .fill({ color: meta.color, alpha: 0.12 });
    banner.addChild(tint);

    // 4 px left colour bar
    const bar = new Graphics()
      .rect(0, 0, 4, BANNER_H)
      .fill(meta.color);
    banner.addChild(bar);

    // Hairline top + bottom
    const hairline = new Graphics()
      .moveTo(0, 0).lineTo(CANVAS_WIDTH, 0)
      .moveTo(0, BANNER_H - 1).lineTo(CANVAS_WIDTH, BANNER_H - 1)
      .stroke({ width: 1, color: meta.color, alpha: 0.20 });
    banner.addChild(hairline);

    // Chinese calligraphy name
    const cn = new Text({
      text: meta.cn,
      style: {
        fontFamily: T.FONT.display, fontSize: 20, fontWeight: '700',
        fill: meta.color,
        dropShadow: { color: meta.color, alpha: 0.5, blur: 4, distance: 0 },
        letterSpacing: 2,
      },
    });
    cn.anchor.set(0, 0.5);
    cn.x = 16; cn.y = BANNER_H / 2;
    banner.addChild(cn);

    // Separator dot
    const dot = new Text({ text: '·', style: { fontFamily: T.FONT.num, fontSize: 11, fill: T.FG.muted } });
    dot.anchor.set(0, 0.5);
    dot.x = cn.x + cn.width + 8; dot.y = BANNER_H / 2;
    banner.addChild(dot);

    // English name
    const en = new Text({
      text: meta.en.toUpperCase(),
      style: { fontFamily: T.FONT.title, fontSize: 11, fill: T.FG.muted, letterSpacing: 3 },
    });
    en.anchor.set(0, 0.5);
    en.x = dot.x + dot.width + 8; en.y = BANNER_H / 2;
    banner.addChild(en);

    // Right: Sprint 5 Resonance pip indicator (r-03) — updated live via updateResonanceHud()
    const rightHint = new Text({
      text: '◇ RESONANCE',
      style: { fontFamily: T.FONT.num, fontSize: 9, fill: T.FG.muted, letterSpacing: 2 },
    });
    rightHint.anchor.set(1, 0.5);
    rightHint.x = CANVAS_WIDTH - 16; rightHint.y = BANNER_H / 2;
    rightHint.alpha = 0.35;
    banner.addChild(rightHint);
    // Store ref for live Resonance HUD updates (r-03)
    this.clanHints[clanId] = rightHint;
  }

  // ─── Single spirit tile ───────────────────────────────────────────────────
  private drawSpiritTile(
    sym: SymbolDef, idx: number, clanId: ClanId,
    tileX: number, tileY: number, totalW: number,
  ): void {
    const meta = T.CLAN_META[clanId];
    const tile = new Container();
    tile.x = tileX; tile.y = tileY;
    this.container.addChild(tile);

    // ── Gradient background ──
    const bgGrad = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end:   { x: 0, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 0x12305a },
        { offset: 1, color: 0x0a1f3c },
      ],
    });
    tile.addChild(
      new Graphics().roundRect(0, 0, TILE_W, TILE_H, T.RADIUS.md).fill(bgGrad),
    );

    // ── Inner gold hairline ──
    tile.addChild(
      new Graphics()
        .roundRect(4, 4, TILE_W - 8, TILE_H - 8, 7)
        .stroke({ width: 1, color: T.GOLD.base, alpha: 0.25 }),
    );

    // ── Selection border (redrawn per refresh) ──
    const border = new Graphics();
    tile.addChild(border);

    // ── RIGHT: clan-color glow backdrop for sprite column ──
    const glowBg = new Graphics()
      .roundRect(SPRITE_COL_X, SPRITE_COL_Y, SPRITE_COL_W, SPRITE_COL_H, 6)
      .fill({ color: meta.color, alpha: 0.10 });
    tile.addChild(glowBg);

    // ── RIGHT: full-body spirit sprite — fills right column (anchor 0.5,1 = feet) ──
    const tex = Assets.get<Texture>(sym.spiritKey) ?? Texture.EMPTY;
    const spirit = new Sprite(tex);
    spirit.anchor.set(0.5, 1);
    const aspect = tex.height > 0 ? tex.height / tex.width : 1.6;
    const fitH    = SPRITE_COL_H - 8;
    const fitW    = fitH / aspect;
    const finalW  = Math.min(fitW, SPRITE_COL_W - 8);
    const finalH  = finalW === fitW ? fitH : finalW * aspect;
    spirit.width  = finalW;
    spirit.height = finalH;
    spirit.x = SPRITE_COL_X + SPRITE_COL_W / 2;
    spirit.y = SPRITE_COL_Y + SPRITE_COL_H - 4;            // feet near sprite-zone bottom
    tile.addChild(spirit);

    // ── LEFT: name strip in info column — clan-color backdrop ──
    const nameBg = new Graphics()
      .roundRect(TILE_PAD + 2, INFO_NAME_Y, INFO_COL_W - 4, INFO_NAME_H, 6)
      .fill({ color: meta.color, alpha: 0.18 })
      .stroke({ width: 1, color: meta.color, alpha: 0.55 });
    tile.addChild(nameBg);

    const name = new Text({
      text: sym.spiritName,
      style: {
        fontFamily: T.FONT.title, fontWeight: '700',
        fontSize: 20,                                       // 22→20: fits narrower info col
        fill: T.FG.cream,
        letterSpacing: 2,
        dropShadow: { color: meta.color, alpha: 0.6, blur: 6, distance: 0 },
      },
    });
    name.anchor.set(0.5, 0.5);
    name.x = TILE_PAD + INFO_COL_W / 2;                    // 8 + 50 = 58 (info col centre)
    name.y = INFO_NAME_Y + INFO_NAME_H / 2;                // 14 + 16 = 30
    tile.addChild(name);

    // ── LEFT: meta text — single line, 12pt (chore #200: was 9pt two-line) ──
    const prob = ((sym.weight / totalW) * 100).toFixed(1);
    const metaTxt = new Text({
      text: `W:${sym.weight}  ${prob}%`,
      style: { fontFamily: T.FONT.num, fontSize: 12, fill: T.FG.cream, letterSpacing: 1, align: 'center' },
    });
    metaTxt.anchor.set(0.5, 0);
    metaTxt.x = TILE_PAD + INFO_COL_W / 2;
    metaTxt.y = INFO_META_Y;
    tile.addChild(metaTxt);

    // ── LEFT: SYMBOL gem icon — visual link to reel (chore #200) ──
    const gem = drawGemSymbol(idx, INFO_GEM_R, 0.9);
    gem.x = TILE_PAD + INFO_COL_W / 2;
    gem.y = INFO_GEM_CY;
    tile.addChild(gem);

    // ── LEFT: Pick button A (horizontal — chore #200: was vertical y=109) ──
    const btnA = new Container();
    btnA.x = BTN_A_X; btnA.y = BTN_Y;
    const btnABg = new Graphics();
    btnA.addChild(btnABg);
    const btnALbl = new Text({
      text: 'A',
      style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.lg, fill: T.FG.white, letterSpacing: 2 },
    });
    btnALbl.anchor.set(0.5, 0.5);
    btnALbl.x = BTN_W / 2; btnALbl.y = BTN_ZONE_H / 2;
    btnA.addChild(btnALbl);
    btnA.eventMode = 'static';
    btnA.cursor    = 'pointer';
    tile.addChild(btnA);

    // ── LEFT: Pick button B (right of A — chore #200 horizontal) ──
    const btnB = new Container();
    btnB.x = BTN_B_X; btnB.y = BTN_Y;
    const btnBBg = new Graphics();
    btnB.addChild(btnBBg);
    const btnBLbl = new Text({
      text: 'B',
      style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.lg, fill: T.FG.white, letterSpacing: 2 },
    });
    btnBLbl.anchor.set(0.5, 0.5);
    btnBLbl.x = BTN_W / 2; btnBLbl.y = BTN_ZONE_H / 2;
    btnB.addChild(btnBLbl);
    btnB.eventMode = 'static';
    btnB.cursor    = 'pointer';
    tile.addChild(btnB);

    // ── Corner badges (visible only when selected) ──
    const badgeA = this.createBadge('A', T.TEAM.azure);
    badgeA.x = -6; badgeA.y = -6;
    badgeA.visible = false;
    tile.addChild(badgeA);

    const badgeB = this.createBadge('B', T.TEAM.vermilion);
    badgeB.x = TILE_W - 18; badgeB.y = -6;
    badgeB.visible = false;
    tile.addChild(badgeB);

    // ── Refs (indexed by symbol id for O(1) refresh) ──
    const refs: TileRefs = {
      border, badgeA, badgeB,
      btnA, btnABg, btnALbl,
      btnB, btnBBg, btnBLbl,
      hoverA: false, hoverB: false,
    };

    btnA.on('pointertap',  () => { AudioManager.playSfx('ui-draft-select'); this.toggle('A', idx); });
    btnA.on('pointerover', () => { refs.hoverA = true;  this.redrawTile(idx); });
    btnA.on('pointerout',  () => { refs.hoverA = false; this.redrawTile(idx); });

    btnB.on('pointertap',  () => { AudioManager.playSfx('ui-draft-select'); this.toggle('B', idx); });
    btnB.on('pointerover', () => { refs.hoverB = true;  this.redrawTile(idx); });
    btnB.on('pointerout',  () => { refs.hoverB = false; this.redrawTile(idx); });

    this.tiles[idx] = refs;
  }

  private createBadge(letter: string, color: number): Container {
    const c = new Container();
    const g = new Graphics()
      .circle(BADGE_R, BADGE_R, BADGE_R)
      .fill(color)
      .stroke({ width: 2, color: T.GOLD.pale, alpha: 0.9 });
    c.addChild(g);
    const t = new Text({
      text: letter,
      style: { fontFamily: T.FONT.num, fontWeight: '700', fontSize: 12, fill: T.FG.white },
    });
    t.anchor.set(0.5, 0.5);
    t.x = BADGE_R; t.y = BADGE_R;
    c.addChild(t);
    return c;
  }

  // ─── Status + toolbar + go ────────────────────────────────────────────────
  private buildStatus(): void {
    this.statusText = new Text({
      text: '',
      style: { fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.lg, fill: T.FG.cream, letterSpacing: 2 },
    });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.x = CANVAS_WIDTH / 2;
    this.statusText.y = GRID_Y + GRID_H + T.SPACING.s5;
    this.container.addChild(this.statusText);
  }

  private buildToolbar(): void {
    const labels   = ['CLEAR', 'MIRROR A→B', 'RANDOM 5+5'];
    const handlers = [
      () => this.clearAll(),
      () => this.mirror(),
      () => this.randomize(),
    ];
    const BTN_W2   = 170;
    const BTN_H2   = 44;
    const GAP      = T.SPACING.s4;
    const totalW   = labels.length * BTN_W2 + (labels.length - 1) * GAP;
    const startX   = Math.round((CANVAS_WIDTH - totalW) / 2);
    const y        = GRID_Y + GRID_H + Math.round(T.SPACING.s10 * 1.4);

    labels.forEach((label, i) => {
      const btn = new UiButton(label, BTN_W2, BTN_H2, handlers[i], { fontSize: T.FONT_SIZE.sm });
      btn.x = startX + BTN_W2 / 2 + i * (BTN_W2 + GAP);
      btn.y = y + BTN_H2 / 2;
      this.container.addChild(btn);
    });
  }

  private buildGoButton(): void {
    this.goButton = new UiButton('SELECT 5 EACH', 320, 60, () => this.launch(),
      { fontSize: T.FONT_SIZE.xl });
    this.goButton.x = CANVAS_WIDTH / 2;
    this.goButton.y = GRID_Y + GRID_H + Math.round(T.SPACING.s12 * 2.8);
    this.container.addChild(this.goButton);
  }

  // ─── Selection logic ──────────────────────────────────────────────────────
  private toggle(side: 'A' | 'B', idx: number): void {
    const set = side === 'A' ? this.selectedA : this.selectedB;
    if (set.has(idx)) set.delete(idx);
    else if (set.size < MAX_PICKS) set.add(idx);
    this.refresh();
  }

  private clearAll(): void {
    this.selectedA.clear();
    this.selectedB.clear();
    this.refresh();
  }

  private mirror(): void {
    this.selectedB = new Set(this.selectedA);
    this.refresh();
  }

  private randomize(): void {
    this.selectedA = this.pickRandomFive();
    this.selectedB = this.pickRandomFive();
    this.refresh();
  }

  private pickRandomFive(): Set<number> {
    // Only eligible (non-Wild, non-Curse) spirit ids
    const ids = SYMBOLS.filter(s => !s.isWild && !s.isCurse && !s.isScatter && !s.isJackpot).map(s => s.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return new Set(ids.slice(0, MAX_PICKS));
  }

  private canGo(): boolean {
    return this.selectedA.size === MAX_PICKS && this.selectedB.size === MAX_PICKS;
  }

  // ─── Resonance HUD (r-03) ────────────────────────────────────────────────
  private updateResonanceHud(): void {
    this.resonanceResult = detectResonance(Array.from(this.selectedA));
    for (const clanId of CLAN_ORDER) {
      const hint = this.clanHints[clanId];
      if (!hint) continue;
      if (this.resonanceResult.boostedClans.includes(clanId)) {
        hint.text       = '✦ ×1.5';
        hint.style.fill = T.GOLD.glow;
        hint.alpha      = 1.0;
      } else {
        hint.text       = '◇ RESONANCE';
        hint.style.fill = T.FG.muted;
        hint.alpha      = 0.35;
      }
    }
  }

  // ─── Redraw ───────────────────────────────────────────────────────────────
  private refresh(): void {
    for (let i = 0; i < SYMBOLS.length; i++) this.redrawTile(i);

    const a     = this.selectedA.size;
    const b     = this.selectedB.size;
    const color = this.canGo() ? T.CTA.green : T.FG.cream;
    this.statusText.style.fill = color;
    this.statusText.text       = `A ${a}/${MAX_PICKS}    B ${b}/${MAX_PICKS}`;

    this.updateClanCountReadout();
    this.updateResonanceHud();

    const canGo = this.canGo();
    this.goButton.setText(canGo ? 'START BATTLE' : 'SELECT 5 EACH');
    this.goButton.setEnabled(canGo);
  }

  private redrawTile(i: number): void {
    const t = this.tiles[i];
    if (!t) return;

    const pickedA  = this.selectedA.has(i);
    const pickedB  = this.selectedB.has(i);
    const bothFull = !pickedA && !pickedB &&
      this.selectedA.size === MAX_PICKS && this.selectedB.size === MAX_PICKS;

    // Selection-state border
    t.border.clear();
    if (pickedA && pickedB) {
      t.border.roundRect(-2, -2, TILE_W + 4, TILE_H + 4, T.RADIUS.md + 2)
        .stroke({ width: 4, color: T.GOLD.glow, alpha: 1 });
    } else if (pickedA) {
      t.border.roundRect(-2, -2, TILE_W + 4, TILE_H + 4, T.RADIUS.md + 2)
        .stroke({ width: 3, color: T.TEAM.azure, alpha: 1 });
    } else if (pickedB) {
      t.border.roundRect(-2, -2, TILE_W + 4, TILE_H + 4, T.RADIUS.md + 2)
        .stroke({ width: 3, color: T.TEAM.vermilion, alpha: 1 });
    } else {
      t.border.roundRect(-2, -2, TILE_W + 4, TILE_H + 4, T.RADIUS.md + 2)
        .stroke({ width: 2, color: T.GOLD.base, alpha: bothFull ? 0.15 : 0.25 });
    }

    // Badges
    t.badgeA.visible = pickedA;
    t.badgeB.visible = pickedB;

    // Pick buttons
    const aLocked = !pickedA && this.selectedA.size >= MAX_PICKS;
    const bLocked = !pickedB && this.selectedB.size >= MAX_PICKS;
    this.drawPickBtn(t.btnABg, t.btnALbl, 'A',
      pickedA ? 'selected' : (t.hoverA && !aLocked ? 'hover' : 'normal'), aLocked);
    this.drawPickBtn(t.btnBBg, t.btnBLbl, 'B',
      pickedB ? 'selected' : (t.hoverB && !bLocked ? 'hover' : 'normal'), bLocked);
  }

  private drawPickBtn(
    bg: Graphics, lbl: Text, side: 'A' | 'B',
    state: 'normal' | 'hover' | 'selected', locked: boolean,
  ): void {
    const team     = side === 'A' ? T.TEAM.azure      : T.TEAM.vermilion;
    const teamDeep = side === 'A' ? T.TEAM.azureDeep  : T.TEAM.vermilionDeep;
    const teamGlow = side === 'A' ? T.TEAM.azureGlow  : T.TEAM.vermilionGlow;

    let fillColor: number, fillAlpha: number, strokeColor: number, labelColor: number;

    if (locked) {
      fillColor = T.COLORS.btnDisabled; fillAlpha = 0.5;
      strokeColor = T.FG.dim;          labelColor = T.FG.dim;
    } else if (state === 'selected') {
      fillColor = team;      fillAlpha = 1.0;
      strokeColor = teamGlow; labelColor = T.FG.white;
    } else if (state === 'hover') {
      fillColor = teamDeep;  fillAlpha = 0.8;
      strokeColor = T.GOLD.base; labelColor = T.FG.white;
    } else {
      // chore: darkened normal-state fill 0.45→0.60 for legibility on busy sprite tile bg
      fillColor = teamDeep;  fillAlpha = 0.60;
      strokeColor = team;    labelColor = teamGlow;
    }

    bg.clear()
      .roundRect(0, 0, BTN_W, BTN_ZONE_H, T.RADIUS.sm)
      .fill({ color: fillColor, alpha: fillAlpha })
      .stroke({ width: state === 'hover' ? 2 : 1.5, color: strokeColor, alpha: 0.9 });
    lbl.style.fill = labelColor;
  }

  // ─── Clan-count readout ───────────────────────────────────────────────────
  private updateClanCountReadout(): void {
    this.clanCountA.text = 'A · ' + this.clanCountStr(this.selectedA);
    this.clanCountB.text = this.clanCountStr(this.selectedB) + ' · B';
  }

  private clanCountStr(selected: Set<number>): string {
    const parts: string[] = [];
    for (const clanId of CLAN_ORDER) {
      const cnt = Array.from(selected).filter(id => SYMBOLS[id].clan === clanId).length;
      if (cnt > 0) parts.push(`${T.CLAN_META[clanId].cn[0]}${cnt}`);
    }
    return parts.length > 0 ? parts.join('·') : '—';
  }

  // ─── Weight helper (kept for potential future use) ────────────────────────
  private teamWeightPct(side: 'A' | 'B'): string {
    const set   = side === 'A' ? this.selectedA : this.selectedB;
    const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
    const sum   = Array.from(set).reduce((s, id) => s + SYMBOLS[id].weight, 0);
    if (total === 0) return '0';
    return ((sum / total) * 100).toFixed(1);
  }
  // ─── Pulsing START button ─────────────────────────────────────────────────
  private updatePulse(deltaMS: number): void {
    if (!this.goButton) return;
    if (!this.canGo()) { this.goButton.scale.set(1); return; }
    this.pulseElapsed += deltaMS;
    const amp = 0.025;
    const s   = 1 + amp * Math.sin((this.pulseElapsed / 650) * Math.PI);
    this.goButton.scale.set(s);
  }

  // ─── Launch ───────────────────────────────────────────────────────────────
  private launch(): void {
    if (!this.canGo()) return;
    AudioManager.playSfx('ui-apply');
    const selectedA = Array.from(this.selectedA);
    const selectedB = Array.from(this.selectedB);
    const pool = buildFullPool(SYMBOLS);
    const tw   = pool.reduce((s, p) => s + p.weight, 0);
    const sa   = calculateScales(DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG, selectedA, tw, DEFAULT_FAIRNESS_EXP);
    const sb   = calculateScales(DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG, selectedB, tw, DEFAULT_FAIRNESS_EXP);

    this.onReady({
      selectedA, selectedB,
      unitHpA: DEFAULT_UNIT_HP, unitHpB: DEFAULT_UNIT_HP,
      betA: DEFAULT_BET, betB: DEFAULT_BET,
      coinScaleA: sa.coinScale, dmgScaleA: sa.dmgScale,
      coinScaleB: sb.coinScale, dmgScaleB: sb.dmgScale,
      fairnessExp: DEFAULT_FAIRNESS_EXP,
      walletA: 10000,
      walletB: 10000,
    });
  }
}
