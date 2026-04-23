import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import {
  SYMBOLS, DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG,
  DEFAULT_TEAM_HP, DEFAULT_BET, DEFAULT_FAIRNESS_EXP,
  DEFAULT_SELECTED_A, DEFAULT_SELECTED_B,
} from '@/config/SymbolsConfig';
import { buildFullPool } from '@/systems/SymbolPool';
import { calculateScales } from '@/systems/ScaleCalculator';
import { SpiritPortrait } from '@/components/SpiritPortrait';
import { UiButton } from '@/components/UiButton';
import { addCornerOrnaments } from '@/components/Decorations';
import { AudioManager } from '@/systems/AudioManager';

// ─── Layout (proportional to canvas) ───────────────────────────────────────
const TILE_W  = 160;
const TILE_H  = 172;
const TILE_GAP = T.SPACING.s4;
const COLS = 4;
const ROWS = 2;
const GRID_W = COLS * TILE_W + (COLS - 1) * TILE_GAP;
const GRID_H = ROWS * TILE_H + (ROWS - 1) * TILE_GAP;
const GRID_X = Math.round((CANVAS_WIDTH - GRID_W) / 2);
const GRID_Y = Math.round(CANVAS_HEIGHT * 0.20);
const MAX_PICKS = 5;

// ─── Tile sub-zones (relative to each tile origin) ─────────────────────────
const PORTRAIT_D  = 60;
const PORTRAIT_CY = 42;
const NAME_Y      = 80;
const META_Y      = 104;
const BTN_ZONE_Y  = 128;
const BTN_ZONE_H  = 34;
const BTN_INSET_X = 6;
const BTN_GAP     = 4;
const BTN_W       = (TILE_W - 2 * BTN_INSET_X - BTN_GAP) / 2;
const BADGE_R     = 12;

export interface DraftResult {
  selectedA: number[];
  selectedB: number[];
  teamHpA: number;
  teamHpB: number;
  betA: number;
  betB: number;
  coinScaleA: number;
  dmgScaleA: number;
  coinScaleB: number;
  dmgScaleB: number;
  fairnessExp: number;
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

export class DraftScreen implements Screen {
  private container = new Container();
  private selectedA = new Set<number>(DEFAULT_SELECTED_A);
  private selectedB = new Set<number>(DEFAULT_SELECTED_B);
  private tiles: TileRefs[] = [];
  private statusText!: Text;
  private distAText!: Text;
  private distBText!: Text;
  private goButton!: UiButton;
  private pulseElapsed = 0;
  private app: Application | null = null;
  private pulseTickFn: ((ticker: { deltaMS: number }) => void) | null = null;

  constructor(private onReady: (cfg: DraftResult) => void) {}

  onMount(app: Application, stage: Container): void {
    this.app = app;
    stage.addChild(this.container);
    this.drawBackground();
    addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 130, 0.55);
    this.drawTitle();
    this.drawDistribution();
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

  // ─── Background ──────────────────────────────────────────────────────────
  private drawBackground(): void {
    const bg = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(T.SEA.abyss);
    this.container.addChild(bg);

    const grid = new Graphics();
    for (let x = 0; x < CANVAS_WIDTH; x += 40) grid.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT);
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) grid.moveTo(0, y).lineTo(CANVAS_WIDTH, y);
    grid.stroke({ width: 1, color: T.SEA.deep, alpha: 0.35 });
    this.container.addChild(grid);
  }

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
    title.y = Math.round(CANVAS_HEIGHT * 0.04);
    this.container.addChild(title);

    const sub = new Text({
      text: 'Pick 5 symbols for each player · Blue = A · Red = B',
      style: { fontFamily: T.FONT.body, fontSize: T.FONT_SIZE.sm, fill: T.FG.muted },
    });
    sub.anchor.set(0.5, 0);
    sub.x = CANVAS_WIDTH / 2;
    sub.y = Math.round(CANVAS_HEIGHT * 0.13);
    this.container.addChild(sub);
  }

  // ─── Team weight distribution ────────────────────────────────────────────
  private drawDistribution(): void {
    const right = CANVAS_WIDTH - Math.round(CANVAS_WIDTH * 0.04);
    const top   = Math.round(CANVAS_HEIGHT * 0.05);

    this.distAText = new Text({
      text: '', style: { fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.md, fill: T.TEAM.azure },
    });
    this.distAText.anchor.set(1, 0);
    this.distAText.x = right; this.distAText.y = top;
    this.container.addChild(this.distAText);

    this.distBText = new Text({
      text: '', style: { fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.md, fill: T.TEAM.vermilion },
    });
    this.distBText.anchor.set(1, 0);
    this.distBText.x = right; this.distBText.y = top + 22;
    this.container.addChild(this.distBText);
  }

  // ─── Tile grid ───────────────────────────────────────────────────────────
  private buildTiles(): void {
    const totalW = SYMBOLS.reduce((s, x) => s + x.weight, 0);

    SYMBOLS.forEach((sym, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const tx = GRID_X + col * (TILE_W + TILE_GAP);
      const ty = GRID_Y + row * (TILE_H + TILE_GAP);

      const tile = new Container();
      tile.x = tx; tile.y = ty;
      this.container.addChild(tile);

      // Decorative frame (static art) — loaded PNG behind everything
      const frameTex = Assets.get<Texture>('draft-tile-frame');
      if (frameTex) {
        const frame = new Sprite(frameTex);
        frame.anchor.set(0, 0);
        frame.width = TILE_W;
        frame.height = TILE_H;
        tile.addChild(frame);
      }

      // Selection state outline (drawn dynamically in refresh)
      const border = new Graphics();
      tile.addChild(border);

      // Spirit portrait
      const portrait = new SpiritPortrait(i, PORTRAIT_D);
      portrait.x = TILE_W / 2;
      portrait.y = PORTRAIT_CY;
      tile.addChild(portrait);

      // 中文 name
      const name = new Text({
        text: sym.spiritName,
        style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.lg, fill: T.FG.cream, letterSpacing: 2 },
      });
      name.anchor.set(0.5, 0);
      name.x = TILE_W / 2; name.y = NAME_Y;
      tile.addChild(name);

      // Weight + probability
      const prob = ((sym.weight / totalW) * 100).toFixed(1);
      const meta = new Text({
        text: `W:${sym.weight}   ${prob}%`,
        style: { fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.sm, fill: T.FG.muted },
      });
      meta.anchor.set(0.5, 0);
      meta.x = TILE_W / 2; meta.y = META_Y;
      tile.addChild(meta);

      // ── Pick buttons ──
      const btnA = new Container();
      btnA.x = BTN_INSET_X; btnA.y = BTN_ZONE_Y;
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
      btnA.cursor = 'pointer';
      tile.addChild(btnA);

      const btnB = new Container();
      btnB.x = BTN_INSET_X + BTN_W + BTN_GAP; btnB.y = BTN_ZONE_Y;
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
      btnB.cursor = 'pointer';
      tile.addChild(btnB);

      // ── Corner badges (shown when selected) ──
      const badgeA = this.createBadge('A', T.TEAM.azure);
      badgeA.x = 4; badgeA.y = 4;
      badgeA.visible = false;
      tile.addChild(badgeA);

      const badgeB = this.createBadge('B', T.TEAM.vermilion);
      badgeB.x = TILE_W - BADGE_R * 2 - 4; badgeB.y = 4;
      badgeB.visible = false;
      tile.addChild(badgeB);

      const refs: TileRefs = {
        border, badgeA, badgeB,
        btnA, btnABg, btnALbl,
        btnB, btnBBg, btnBLbl,
        hoverA: false, hoverB: false,
      };

      btnA.on('pointertap', () => { AudioManager.playSfx('ui-draft-select'); this.toggle('A', i); });
      btnA.on('pointerover', () => { refs.hoverA = true; this.redrawTile(i); });
      btnA.on('pointerout',  () => { refs.hoverA = false; this.redrawTile(i); });

      btnB.on('pointertap', () => { AudioManager.playSfx('ui-draft-select'); this.toggle('B', i); });
      btnB.on('pointerover', () => { refs.hoverB = true; this.redrawTile(i); });
      btnB.on('pointerout',  () => { refs.hoverB = false; this.redrawTile(i); });

      this.tiles.push(refs);
    });
  }

  private createBadge(letter: string, color: number): Container {
    const c = new Container();
    const g = new Graphics()
      .circle(BADGE_R, BADGE_R, BADGE_R)
      .fill(color)
      .stroke({ width: 1.5, color: T.FG.white, alpha: 0.9 });
    c.addChild(g);
    const t = new Text({
      text: letter,
      style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.sm, fill: T.FG.white },
    });
    t.anchor.set(0.5, 0.5);
    t.x = BADGE_R; t.y = BADGE_R;
    c.addChild(t);
    return c;
  }

  // ─── Status + toolbar + go ───────────────────────────────────────────────
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
    const labels  = ['CLEAR', 'MIRROR A→B', 'RANDOM 5+5'];
    const handlers: (() => void)[] = [
      () => this.clearAll(),
      () => this.mirror(),
      () => this.randomize(),
    ];
    const BTN_W2 = 170;
    const BTN_H2 = 44;
    const GAP    = T.SPACING.s4;
    const totalW = labels.length * BTN_W2 + (labels.length - 1) * GAP;
    const startX = Math.round((CANVAS_WIDTH - totalW) / 2);
    const y      = GRID_Y + GRID_H + Math.round(T.SPACING.s10 * 1.4);

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
    // Pushed further below the toolbar so the pulse doesn't collide with it
    this.goButton.y = GRID_Y + GRID_H + Math.round(T.SPACING.s12 * 2.8);
    this.container.addChild(this.goButton);
  }

  // ─── Selection logic ─────────────────────────────────────────────────────
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
    const ids = [0,1,2,3,4,5,6,7];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return new Set(ids.slice(0, MAX_PICKS));
  }

  private canGo(): boolean {
    return this.selectedA.size === MAX_PICKS && this.selectedB.size === MAX_PICKS;
  }

  // ─── Redraw ──────────────────────────────────────────────────────────────
  private refresh(): void {
    for (let i = 0; i < SYMBOLS.length; i++) this.redrawTile(i);

    const a = this.selectedA.size;
    const b = this.selectedB.size;
    const color = this.canGo() ? T.CTA.green : T.FG.cream;
    this.statusText.style.fill = color;
    this.statusText.text = `A ${a}/${MAX_PICKS}    B ${b}/${MAX_PICKS}`;

    this.distAText.text = `A  team weight  ${this.teamWeightPct('A')}%`;
    this.distBText.text = `B  team weight  ${this.teamWeightPct('B')}%`;

    const canGo = this.canGo();
    this.goButton.setText(canGo ? 'START BATTLE' : 'SELECT 5 EACH');
    this.goButton.setEnabled(canGo);
  }

  private redrawTile(i: number): void {
    const t = this.tiles[i];
    const pickedA = this.selectedA.has(i);
    const pickedB = this.selectedB.has(i);
    const bothFull = !pickedA && !pickedB && this.selectedA.size === MAX_PICKS && this.selectedB.size === MAX_PICKS;

    // Selection-state outline — sits ON TOP of the frame PNG
    t.border.clear();
    if (pickedA && pickedB) {
      t.border.roundRect(-2, -2, TILE_W + 4, TILE_H + 4, T.RADIUS.md)
        .stroke({ width: 4, color: T.GOLD.base, alpha: 1 });
    } else if (pickedA) {
      t.border.roundRect(-2, -2, TILE_W + 4, TILE_H + 4, T.RADIUS.md)
        .stroke({ width: 3, color: T.TEAM.azure, alpha: 1 });
    } else if (pickedB) {
      t.border.roundRect(-2, -2, TILE_W + 4, TILE_H + 4, T.RADIUS.md)
        .stroke({ width: 3, color: T.TEAM.vermilion, alpha: 1 });
    }
    void bothFull;

    // Badges
    t.badgeA.visible = pickedA;
    t.badgeB.visible = pickedB;

    // Pick buttons (three states: normal / hover / selected)
    const aLocked = !pickedA && this.selectedA.size >= MAX_PICKS;
    const bLocked = !pickedB && this.selectedB.size >= MAX_PICKS;
    this.drawPickBtn(t.btnABg, t.btnALbl, 'A', pickedA ? 'selected' : (t.hoverA && !aLocked ? 'hover' : 'normal'), aLocked);
    this.drawPickBtn(t.btnBBg, t.btnBLbl, 'B', pickedB ? 'selected' : (t.hoverB && !bLocked ? 'hover' : 'normal'), bLocked);
  }

  private drawPickBtn(
    bg: Graphics, lbl: Text, side: 'A' | 'B',
    state: 'normal' | 'hover' | 'selected', locked: boolean,
  ): void {
    const team = side === 'A' ? T.TEAM.azure : T.TEAM.vermilion;
    const teamDeep = side === 'A' ? T.TEAM.azureDeep : T.TEAM.vermilionDeep;
    const teamGlow = side === 'A' ? T.TEAM.azureGlow : T.TEAM.vermilionGlow;

    let fillColor: number;
    let fillAlpha: number;
    let strokeColor: number;
    let labelColor: number;

    if (locked) { fillColor = T.COLORS.btnDisabled; fillAlpha = 0.5; strokeColor = T.FG.dim;  labelColor = T.FG.dim; }
    else if (state === 'selected') { fillColor = team;      fillAlpha = 1;    strokeColor = teamGlow;      labelColor = T.FG.white; }
    else if (state === 'hover')    { fillColor = teamDeep;  fillAlpha = 0.8;  strokeColor = T.GOLD.base;   labelColor = T.FG.white; }
    else                           { fillColor = teamDeep;  fillAlpha = 0.45; strokeColor = team;          labelColor = teamGlow; }

    bg.clear()
      .roundRect(0, 0, BTN_W, BTN_ZONE_H, T.RADIUS.sm)
      .fill({ color: fillColor, alpha: fillAlpha })
      .stroke({ width: state === 'hover' ? 2 : 1.5, color: strokeColor, alpha: 0.9 });
    lbl.style.fill = labelColor;
  }

  private teamWeightPct(side: 'A' | 'B'): string {
    const set = side === 'A' ? this.selectedA : this.selectedB;
    const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
    const sum = Array.from(set).reduce((s, id) => s + SYMBOLS[id].weight, 0);
    if (total === 0) return '0';
    return ((sum / total) * 100).toFixed(1);
  }

  // ─── Pulsing START button ────────────────────────────────────────────────
  private updatePulse(deltaMS: number): void {
    if (!this.goButton) return;
    if (!this.canGo()) {
      this.goButton.scale.set(1);
      return;
    }
    this.pulseElapsed += deltaMS;
    const amp = 0.025;
    const s = 1 + amp * Math.sin((this.pulseElapsed / 650) * Math.PI);
    this.goButton.scale.set(s);
  }

  // ─── Launch ──────────────────────────────────────────────────────────────
  private launch(): void {
    if (!this.canGo()) return;
    AudioManager.playSfx('ui-apply');
    const selectedA = Array.from(this.selectedA);
    const selectedB = Array.from(this.selectedB);
    // Full pool: poolTotalW must match what the engine uses at runtime
    const pool = buildFullPool(SYMBOLS);
    const tw = pool.reduce((s, p) => s + p.weight, 0);
    const sa = calculateScales(DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG, selectedA, tw, DEFAULT_FAIRNESS_EXP);
    const sb = calculateScales(DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG, selectedB, tw, DEFAULT_FAIRNESS_EXP);

    this.onReady({
      selectedA, selectedB,
      teamHpA: DEFAULT_TEAM_HP, teamHpB: DEFAULT_TEAM_HP,
      betA: DEFAULT_BET, betB: DEFAULT_BET,
      coinScaleA: sa.coinScale, dmgScaleA: sa.dmgScale,
      coinScaleB: sb.coinScale, dmgScaleB: sb.dmgScale,
      fairnessExp: DEFAULT_FAIRNESS_EXP,
    });
  }
}
