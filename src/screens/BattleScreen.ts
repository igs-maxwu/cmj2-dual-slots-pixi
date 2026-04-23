import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import { SYMBOLS, PAYOUT_BASE } from '@/config/SymbolsConfig';
import { buildFullPool, totalWeight } from '@/systems/SymbolPool';
import { SlotEngine } from '@/systems/SlotEngine';
import {
  createFormation, isTeamAlive, teamHpTotal, type FormationGrid,
} from '@/systems/Formation';
import { distributeDamage, type DmgEvent } from '@/systems/DamageDistributor';
import { tween, tweenValue, delay, Easings } from '@/systems/tween';
import { SlotReel, REEL_W, REEL_H } from './SlotReel';
import { SpiritPortrait } from '@/components/SpiritPortrait';
import { UiButton } from '@/components/UiButton';
import { addCornerOrnaments } from '@/components/Decorations';
import type { DraftResult } from './DraftScreen';
import { attackTimeline } from './SpiritAttackChoreographer';
import type { WayHit } from '@/systems/SlotEngine';
import { mercenaryWeakFx } from '@/fx/MercenaryFx';
import { AmbientBackground } from './AmbientBackground';
import { VsBadgeAnimator } from '@/fx/VsBadgeAnimator';
import { goldText } from '@/components/GoldText';
import { AmbientParticles } from '@/fx/AmbientParticles';

// ─── Portrait layout 720×1280 ───────────────────────────────────────────────
const HEADER_Y   = 14;
const HP_Y       = 90;
const HP_BAR_W   = 270;
const HP_BAR_H   = 18;

// Jackpot area placeholder (y=138…338)
const JP_AREA_Y = 138;
const JP_AREA_H = 200;

// Formations enlarged (cell 68px) — placed below JP area
const FORMATION_CELL = 68;
const FORMATION_GAP  = 6;
const FORMATION_GRID = FORMATION_CELL * 3 + FORMATION_GAP * 2;               // 216
const FORMATION_A_X  = Math.round(CANVAS_WIDTH * 0.25 - FORMATION_GRID / 2); // ~72 left column
const FORMATION_B_X  = Math.round(CANVAS_WIDTH * 0.75 - FORMATION_GRID / 2); // ~432 right column
const FORMATION_Y    = 360;

// HP bars: A on left half, B on right half (16px side margin each)
const HP_A_X = 16;
const HP_B_X = CANVAS_WIDTH - 16 - HP_BAR_W;                                 // 434

// Slot reel — centred, pushed below formations
const SLOT_X     = Math.round((CANVAS_WIDTH - REEL_W) / 2);
const SLOT_Y     = 610;

// Log and back button pinned to bottom
const LOG_Y      = 1150;
const BACK_BTN_Y = CANVAS_HEIGHT - 50;

const ROUND_GAP_MS   = 500; // pause between rounds

// ─── Components for formation display ────────────────────────────────────────
interface FormationCellRefs {
  cell: Graphics;
  glowRing: Graphics;
  crossMark: Graphics;
  label: Text;
  container: Container;
  portrait: SpiritPortrait | null;
}

export class BattleScreen implements Screen {
  private app!: Application;
  private bg!: AmbientBackground;
  private particles!: AmbientParticles;
  private vsBadge!: VsBadgeAnimator;
  private container = new Container();
  private roundText!: Text;
  private hpBarA!: Graphics;
  private hpBarB!: Graphics;
  private hpEdgeA!: Graphics;
  private hpEdgeB!: Graphics;
  private hpTextA!: Text;
  private hpTextB!: Text;
  private _breatheTick: (() => void) | null = null;
  private cellsA: FormationCellRefs[] = [];
  private cellsB: FormationCellRefs[] = [];
  private displayedHpA = 0;
  private displayedHpB = 0;
  private logText!: Text;
  private fxLayer = new Container();    // damage numbers live here
  private reel!: SlotReel;
  private formationA: FormationGrid = [];
  private formationB: FormationGrid = [];
  private engine = new SlotEngine(3, 5);
  private running = false;
  private round = 0;
  private logLines: string[] = [];
  /** Consecutive rounds with zero wayHits per side — triggers guaranteed way at 3 */
  private consecutiveMissA = 0;
  private consecutiveMissB = 0;

  constructor(private cfg: DraftResult, private onExit: () => void) {}

  // ─── Screen lifecycle ────────────────────────────────────────────────────
  async onMount(app: Application, stage: Container): Promise<void> {
    this.app = app;
    this.bg = new AmbientBackground(app);
    stage.addChild(this.bg);
    this.particles = new AmbientParticles(app);
    stage.addChild(this.particles);
    stage.addChild(this.container);
    this.formationA = createFormation(this.cfg.selectedA, this.cfg.teamHpA);
    this.formationB = createFormation(this.cfg.selectedB, this.cfg.teamHpB);
    this.displayedHpA = teamHpTotal(this.formationA);
    this.displayedHpB = teamHpTotal(this.formationB);

    this.drawBackground();
    addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 130, 0.55);
    this.drawHeader();
    this.drawHpBars();
    this.drawJackpotMarquee();
    this.drawFormation('A');
    this.drawFormation('B');
    this.drawSlot();
    this.drawVsBadge();
    this.drawLog();
    this.drawBackButton();
    this.container.addChild(this.fxLayer);  // fx on top
    this.refresh();
    this._breatheTick = () => {
      const t = performance.now();
      const breatheAlpha = 0.25 + (Math.sin(t / 600) * 0.5 + 0.5) * 0.40;
      for (const ref of [...this.cellsA, ...this.cellsB]) {
        if (ref.glowRing.visible) ref.glowRing.alpha = breatheAlpha;
      }
      const ratioA = this.displayedHpA / this.cfg.teamHpA;
      const ratioB = this.displayedHpB / this.cfg.teamHpB;
      const pulseAlpha = 0.35 + (Math.sin(t / 300) * 0.5 + 0.5) * 0.65;
      this.hpEdgeA.alpha = ratioA < 0.30 ? pulseAlpha : 0;
      this.hpEdgeB.alpha = ratioB < 0.30 ? pulseAlpha : 0;
    };
    this.app.ticker.add(this._breatheTick);
    void this.loop();
  }

  private drawVsBadge(): void {
    const tex = Assets.get<Texture>('vs-badge');
    if (!tex) return;
    const size = 96;
    const badge = new Sprite(tex);
    badge.anchor.set(0.5, 0.5);
    badge.width = size;
    badge.height = size;
    // Sits between the two HP bars, visually connecting Player A ↔ Player B.
    badge.x = CANVAS_WIDTH / 2;
    badge.y = HP_Y + HP_BAR_H / 2;
    this.container.addChild(badge);
    this.vsBadge = new VsBadgeAnimator(badge, this.app, this.container);
  }

  onUnmount(): void {
    this.running = false;
    this.vsBadge.destroy();
    this.bg.destroyLayers();
    this.bg.destroy({ children: true });
    this.particles.destroy({ children: true });
    if (this._breatheTick) {
      this.app.ticker.remove(this._breatheTick);
      this._breatheTick = null;
    }
    this.container.destroy({ children: true });
    this.cellsA = [];
    this.cellsB = [];
  }

  // ─── Build UI ────────────────────────────────────────────────────────────
  private drawBackground(): void {
    // Solid base is provided by AmbientBackground; only draw the grid overlay.
    const grid = new Graphics();
    for (let x = 0; x < CANVAS_WIDTH; x += 40) grid.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT);
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) grid.moveTo(0, y).lineTo(CANVAS_WIDTH, y);
    grid.stroke({ width: 1, color: T.SEA.deep, alpha: 0.25 });
    this.container.addChild(grid);
  }

  private drawHeader(): void {
    const title = new Text({
      text: '雀靈戰記 · BATTLE',
      style: {
        fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.h1,
        fill: T.GOLD.base, stroke: { color: T.GOLD.shadow, width: 3 }, letterSpacing: 2,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = CANVAS_WIDTH / 2; title.y = HEADER_Y;
    this.container.addChild(title);

    this.roundText = goldText('ROUND 00', { fontSize: 32, withShadow: true });
    this.roundText.style.letterSpacing = 2;
    this.roundText.anchor.set(0.5, 0);
    this.roundText.x = CANVAS_WIDTH / 2;
    this.roundText.y = HEADER_Y + T.FONT_SIZE.h1 + 4;
    this.container.addChild(this.roundText);
  }

  private drawHpBars(): void {
    const ax = HP_A_X;
    const bx = HP_B_X;

    this.makeHpLabel(ax + HP_BAR_W / 2, HP_Y - 20, 'PLAYER A', T.TEAM.azure);
    this.makeHpLabel(bx + HP_BAR_W / 2, HP_Y - 20, 'PLAYER B', T.TEAM.vermilion);

    // Stack order per side: dark track → colored fill → ornate frame → A4 edge → text.
    this.hpBarA = this.buildHpStack(ax, HP_Y, HP_BAR_W, HP_BAR_H);
    this.hpBarB = this.buildHpStack(bx, HP_Y, HP_BAR_W, HP_BAR_H);

    // A4 — low-HP pulse edge (stroke-only overlay, alpha driven by ticker)
    this.hpEdgeA = new Graphics()
      .roundRect(ax, HP_Y, HP_BAR_W, HP_BAR_H, HP_BAR_H / 2)
      .stroke({ width: 3, color: T.HP.low, alpha: 1 });
    this.hpEdgeA.alpha = 0;
    this.container.addChild(this.hpEdgeA);

    this.hpEdgeB = new Graphics()
      .roundRect(bx, HP_Y, HP_BAR_W, HP_BAR_H, HP_BAR_H / 2)
      .stroke({ width: 3, color: T.HP.low, alpha: 1 });
    this.hpEdgeB.alpha = 0;
    this.container.addChild(this.hpEdgeB);

    this.hpTextA = goldText('', { fontSize: T.FONT_SIZE.md, fontWeight: '700', withShadow: true });
    this.hpTextA.anchor.set(0.5, 0.5);
    this.hpTextA.x = ax + HP_BAR_W / 2; this.hpTextA.y = HP_Y + HP_BAR_H / 2;
    this.container.addChild(this.hpTextA);

    this.hpTextB = goldText('', { fontSize: T.FONT_SIZE.md, fontWeight: '700', withShadow: true });
    this.hpTextB.anchor.set(0.5, 0.5);
    this.hpTextB.x = bx + HP_BAR_W / 2; this.hpTextB.y = HP_Y + HP_BAR_H / 2;
    this.container.addChild(this.hpTextB);
  }

  private makeHpLabel(cx: number, y: number, text: string, color: number): void {
    const label = new Text({
      text, style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.sm, fill: color, letterSpacing: 3 },
    });
    label.anchor.set(0.5, 0);
    label.x = cx; label.y = y;
    this.container.addChild(label);
  }

  private buildHpStack(x: number, y: number, w: number, h: number): Graphics {
    // 1. Dark track (empty fill)
    const track = new Graphics()
      .roundRect(x, y, w, h, h / 2)
      .fill(T.HP.track);
    this.container.addChild(track);

    // 2. Colored fill — returned so caller can redraw
    const fill = new Graphics();
    fill.x = x; fill.y = y;
    this.container.addChild(fill);

    // 3. Ornate frame overlay (dragon-head caps hide bar ends)
    const tex = Assets.get<Texture>('hp-frame');
    if (tex) {
      const bleedY = 12;
      const frame = new Sprite(tex);
      frame.anchor.set(0, 0.5);
      frame.x = x - 6;
      frame.y = y + h / 2;
      frame.width  = w + 12;
      frame.height = h + bleedY * 2;
      this.container.addChild(frame);
    } else {
      track.stroke({ width: 1, color: T.SEA.rim, alpha: 0.8 });
    }

    return fill;
  }

  // ─── Jackpot marquee ─────────────────────────────────────────────────────
  private drawJackpotMarquee(): void {
    const tex = Assets.get<Texture>('jp-marquee') ?? Texture.WHITE;
    const marquee = new Sprite(tex);
    marquee.anchor.set(0.5, 0.5);
    marquee.width  = CANVAS_WIDTH - 32;
    marquee.height = JP_AREA_H;
    marquee.x = CANVAS_WIDTH / 2;
    marquee.y = JP_AREA_Y + JP_AREA_H / 2;
    this.container.addChild(marquee);

    const numY = JP_AREA_Y + JP_AREA_H / 2 + 14;
    const tiers: [number, string][] = [
      [CANVAS_WIDTH * 0.22, '50,000'],
      [CANVAS_WIDTH * 0.50, '500,000'],
      [CANVAS_WIDTH * 0.78, '5,000,000'],
    ];
    for (const [x, val] of tiers) {
      const t = goldText(val, { fontSize: 22, withShadow: true });
      t.anchor.set(0.5, 0.5);
      t.x = x;
      t.y = numY;
      this.container.addChild(t);
    }
  }

  private drawFormation(side: 'A' | 'B'): void {
    const ox = side === 'A' ? FORMATION_A_X : FORMATION_B_X;
    const grid = side === 'A' ? this.formationA : this.formationB;
    const cells = side === 'A' ? this.cellsA : this.cellsB;
    const glowColor = side === 'A' ? T.TEAM.azureGlow : T.TEAM.vermilionGlow;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = ox + c * (FORMATION_CELL + FORMATION_GAP);
        const y = FORMATION_Y + r * (FORMATION_CELL + FORMATION_GAP);
        const container = new Container();
        container.x = x + FORMATION_CELL / 2;
        container.y = y + FORMATION_CELL / 2;
        this.container.addChild(container);

        // A3 — breathing glow ring (behind everything, alpha driven by ticker)
        const half = FORMATION_CELL / 2;
        const glowRing = new Graphics()
          .roundRect(-half - 2, -half - 2, FORMATION_CELL + 4, FORMATION_CELL + 4, T.RADIUS.sm + 2)
          .stroke({ width: 3, color: glowColor, alpha: 1 });
        glowRing.alpha = 0;
        glowRing.visible = false;
        container.addChildAt(glowRing, 0);

        const cell = new Graphics();
        container.addChild(cell);

        const slot = r * 3 + c;
        const unit = grid[slot];
        let portrait: SpiritPortrait | null = null;
        if (unit) {
          portrait = new SpiritPortrait(unit.symbolId, 46);
          portrait.y = -8;
          container.addChild(portrait);
        }

        const label = new Text({
          text: '', style: {
            fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.xs,
            fill: T.FG.cream, align: 'center',
          },
        });
        label.anchor.set(0.5, 0.5);
        label.y = 22;
        container.addChild(label);

        // A3 — dead cross (✕), drawn above label so always readable
        const margin = 10;
        const ch = FORMATION_CELL / 2 - margin;
        const crossMark = new Graphics()
          .moveTo(-ch, -ch).lineTo(ch, ch)
          .moveTo(ch, -ch).lineTo(-ch, ch)
          .stroke({ width: 3, color: T.FG.dim, alpha: 0.85 });
        crossMark.visible = false;
        container.addChild(crossMark);

        cells.push({ cell, glowRing, crossMark, label, container, portrait });
      }
    }
  }

  private drawSlot(): void {
    this.reel = new SlotReel();
    this.reel.x = SLOT_X;
    this.reel.y = SLOT_Y;
    this.container.addChild(this.reel);
  }

  private drawLog(): void {
    // Decorative divider above log
    const divTex = Assets.get<Texture>('divider');
    if (divTex) {
      const div = new Sprite(divTex);
      div.anchor.set(0.5, 0.5);
      const w = CANVAS_WIDTH * 0.5;
      div.scale.set(w / divTex.width);
      div.x = CANVAS_WIDTH / 2;
      div.y = LOG_Y - 10;
      div.alpha = 0.75;
      this.container.addChild(div);
    }

    this.logText = new Text({
      text: '',
      style: {
        fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.xs,
        fill: T.FG.muted, lineHeight: 16,
      },
    });
    this.logText.x = FORMATION_A_X;
    this.logText.y = LOG_Y + 10;
    this.container.addChild(this.logText);
  }

  private drawBackButton(): void {
    const btn = new UiButton('BACK TO DRAFT', 260, 46, () => this.onExit(),
      { fontSize: T.FONT_SIZE.md, variant: 'ornate' });
    btn.x = CANVAS_WIDTH / 2;
    btn.y = BACK_BTN_Y;
    this.container.addChild(btn);
  }

  // ─── Frame refresh (non-animated parts) ──────────────────────────────────
  private refresh(): void {
    this.roundText.text = `ROUND ${String(this.round).padStart(2, '0')}`;

    const hpA = teamHpTotal(this.formationA);
    const hpB = teamHpTotal(this.formationB);
    const maxA = this.cfg.teamHpA;
    const maxB = this.cfg.teamHpB;

    this.drawHpFill(this.hpBarA, this.displayedHpA / maxA, 'A');
    this.drawHpFill(this.hpBarB, this.displayedHpB / maxB, 'B');
    this.hpTextA.text = `${Math.round(this.displayedHpA)} / ${maxA}`;
    this.hpTextB.text = `${Math.round(this.displayedHpB)} / ${maxB}`;

    this.refreshFormation('A', this.formationA, this.cellsA);
    this.refreshFormation('B', this.formationB, this.cellsB);

    this.logText.text = this.logLines.slice(-3).join('\n');

    void hpA; void hpB;
  }

  private drawHpFill(g: Graphics, ratio: number, side: 'A' | 'B'): void {
    const w = Math.max(0, Math.min(1, ratio)) * HP_BAR_W;
    let color: number;
    if (ratio < 0.25) color = T.HP.low;
    else if (ratio < 0.55) color = T.HP.mid;
    else color = side === 'A' ? T.TEAM.azure : T.TEAM.vermilion;

    g.clear();
    if (w > 0) {
      g.roundRect(0, 0, w, HP_BAR_H, HP_BAR_H / 2).fill(color);
    }
  }

  private refreshFormation(side: 'A' | 'B', grid: FormationGrid, cells: FormationCellRefs[]): void {
    const teamColor = side === 'A' ? T.TEAM.azure : T.TEAM.vermilion;
    for (let i = 0; i < 9; i++) {
      const ref = cells[i];
      const unit = grid[i];
      ref.cell.clear();
      if (!unit) {
        ref.cell.roundRect(-FORMATION_CELL / 2, -FORMATION_CELL / 2, FORMATION_CELL, FORMATION_CELL, T.RADIUS.sm)
          .fill({ color: T.SEA.deep, alpha: 0.45 })
          .stroke({ width: 1, color: T.SEA.rim, alpha: 0.4 });
        ref.label.text = '';
        ref.glowRing.visible = false;
        ref.crossMark.visible = false;
        continue;
      }
      ref.cell.roundRect(-FORMATION_CELL / 2, -FORMATION_CELL / 2, FORMATION_CELL, FORMATION_CELL, T.RADIUS.sm)
        .fill({ color: T.SEA.deep, alpha: 0.45 })
        .stroke({ width: 2, color: unit.alive ? teamColor : T.FG.dim, alpha: unit.alive ? 1 : 0.4 });
      if (ref.portrait) ref.portrait.setAlive(unit.alive);
      ref.label.text = unit.alive ? `${unit.hp}` : 'DEAD';
      ref.label.style.fill = unit.alive ? T.FG.cream : T.FG.dim;
      ref.label.alpha = unit.alive ? 1 : 0.6;
      // A3 — breathing glow for alive, dead cross for fallen
      ref.glowRing.visible = unit.alive;
      ref.crossMark.visible = !unit.alive;
    }
  }

  // ─── Auto-battle loop ────────────────────────────────────────────────────
  private async loop(): Promise<void> {
    this.running = true;
    // Full pool: all 8 symbols always spin; non-selected ones fill cells without scoring
    const pool = buildFullPool(SYMBOLS);

    // Overkill tiebreaker state (used if both teams die in the same round)
    let lastDmgA = 0, lastDmgB = 0;
    let lastPreHpA = 0, lastPreHpB = 0;

    while (this.running && isTeamAlive(this.formationA) && isTeamAlive(this.formationB)) {
      this.round++;
      this.vsBadge.pulse();
      this.refresh();

      const spin = this.engine.spin(
        pool,
        this.cfg.selectedA, this.cfg.selectedB,
        this.cfg.betA, this.cfg.betB,
        this.cfg.coinScaleA, this.cfg.dmgScaleA,
        this.cfg.coinScaleB, this.cfg.dmgScaleB,
        this.cfg.fairnessExp,
      );
      if (!this.running) return;

      await this.reel.spin(spin.grid);
      if (!this.running) return;

      const lineFx = this.reel.highlightWays(spin.sideA.wayHits, spin.sideB.wayHits);
      const jackpotFx = this.fireJackpots(spin.sideA.wayHits, spin.sideB.wayHits);
      // Spirit attack choreography (concurrent with way highlights)
      const attackFx = this.playAttackAnimations(spin.sideA.wayHits, spin.sideB.wayHits);

      let dmgA = spin.sideA.dmgDealt;
      let dmgB = spin.sideB.dmgDealt;

      // ── Underdog boost: 1.3× damage when own HP ratio < 0.30 ──────────────
      const ratioA = teamHpTotal(this.formationA) / this.cfg.teamHpA;
      const ratioB = teamHpTotal(this.formationB) / this.cfg.teamHpB;
      if (ratioA < 0.30 && dmgA > 0) dmgA = Math.ceil(dmgA * 1.3);
      if (ratioB < 0.30 && dmgB > 0) dmgB = Math.ceil(dmgB * 1.3);

      // ── Consecutive-miss tracking + guaranteed way ─────────────────────────
      if (spin.sideA.wayHits.length === 0) this.consecutiveMissA++;
      else                                  this.consecutiveMissA = 0;
      if (spin.sideB.wayHits.length === 0) this.consecutiveMissB++;
      else                                  this.consecutiveMissB = 0;

      if (this.consecutiveMissA >= 3 && dmgA === 0) {
        dmgA = this.minGuaranteedDmg('A');
        this.consecutiveMissA = 0;
      }
      if (this.consecutiveMissB >= 3 && dmgB === 0) {
        dmgB = this.minGuaranteedDmg('B');
        this.consecutiveMissB = 0;
      }

      // Capture pre-damage HP for overkill tiebreaker
      lastPreHpA = teamHpTotal(this.formationA);
      lastPreHpB = teamHpTotal(this.formationB);
      lastDmgA = dmgA; lastDmgB = dmgB;

      const eventsOnB = dmgA > 0 ? distributeDamage(this.formationB, dmgA, 'A') : [];
      const eventsOnA = dmgB > 0 ? distributeDamage(this.formationA, dmgB, 'B') : [];

      const newHpA = teamHpTotal(this.formationA);
      const newHpB = teamHpTotal(this.formationB);

      const fx: Promise<void>[] = [lineFx, jackpotFx, attackFx];
      if (eventsOnB.length) fx.push(this.playDamageEvents(eventsOnB, 'B'));
      if (eventsOnA.length) fx.push(this.playDamageEvents(eventsOnA, 'A'));
      fx.push(tweenValue(this.displayedHpA, newHpA, 500, v => {
        this.displayedHpA = v;
        this.drawHpFill(this.hpBarA, v / this.cfg.teamHpA, 'A');
        this.hpTextA.text = `${Math.round(v)} / ${this.cfg.teamHpA}`;
      }));
      fx.push(tweenValue(this.displayedHpB, newHpB, 500, v => {
        this.displayedHpB = v;
        this.drawHpFill(this.hpBarB, v / this.cfg.teamHpB, 'B');
        this.hpTextB.text = `${Math.round(v)} / ${this.cfg.teamHpB}`;
      }));
      await Promise.all(fx);

      const tagA = ratioA < 0.30 ? '↑' : '';
      const tagB = ratioB < 0.30 ? '↑' : '';
      this.logLines.push(
        `R${this.round.toString().padStart(2, '0')}  ` +
        `A→B dmg ${dmgA}${tagA} (${spin.sideA.wayHits.length} ways)   ` +
        `B→A dmg ${dmgB}${tagB} (${spin.sideB.wayHits.length} ways)`,
      );
      this.refresh();

      if (!this.running) return;
      await delay(ROUND_GAP_MS);
    }

    if (!this.running) return;

    // ── Determine winner (overkill tiebreaker on double-death) ────────────────
    const aAlive = isTeamAlive(this.formationA);
    const bAlive = isTeamAlive(this.formationB);
    let winner: string;
    if (aAlive && !bAlive) {
      winner = 'Player A';
    } else if (!aAlive && bAlive) {
      winner = 'Player B';
    } else if (!aAlive && !bAlive) {
      // Both died same round — higher overkill damage wins
      const overkillA = Math.max(0, lastDmgA - lastPreHpB);
      const overkillB = Math.max(0, lastDmgB - lastPreHpA);
      if      (overkillA > overkillB) winner = 'Player A (OVERKILL)';
      else if (overkillB > overkillA) winner = 'Player B (OVERKILL)';
      else                             winner = 'DRAW';
    } else {
      winner = 'DRAW';
    }

    this.logLines.push('');
    this.logLines.push(`>>> ${winner} WINS  <<<`);
    this.refresh();
  }

  /**
   * Minimum damage injected for the guaranteed way mechanic.
   * Equivalent to a 3-way hit with numWays=1 using the most common selected symbol.
   */
  private minGuaranteedDmg(side: 'A' | 'B'): number {
    const selected  = side === 'A' ? this.cfg.selectedA : this.cfg.selectedB;
    const dmgScale  = side === 'A' ? this.cfg.dmgScaleA : this.cfg.dmgScaleB;
    const bet       = side === 'A' ? this.cfg.betA       : this.cfg.betB;
    const pool      = buildFullPool(SYMBOLS);
    const tw        = totalWeight(pool);
    // Use highest-weight symbol (most common) → smallest ratio → conservative minimum
    const anchorId  = selected.reduce(
      (best, id) => SYMBOLS[id].weight > SYMBOLS[best].weight ? id : best,
      selected[0],
    );
    const mult    = SlotEngine.scaledMult(anchorId, tw, 1, dmgScale, this.cfg.fairnessExp);
    const rawDmg  = (PAYOUT_BASE[3] ?? 5) * 1 * mult.dmgMult;
    return Math.max(1, Math.floor(rawDmg * (bet / 100)));
  }

  /**
   * For each side:
   *   - Best DRAFTED hit  → full T0 attackTimeline (one per side, prevents visual clutter)
   *   - All MERCENARY hits → lightweight mercenaryWeakFx (all concurrent, cheap)
   *
   * All animations run in parallel via Promise.all.
   */
  private async playAttackAnimations(hitA: WayHit[], hitB: WayHit[]): Promise<void> {
    const animations: Promise<void>[] = [];

    const addSide = (
      hits:       WayHit[],
      attackerCells: typeof this.cellsA,
      defenderCells: typeof this.cellsB,
      attackerFormation: typeof this.formationA,
      defenderFormation: typeof this.formationB,
    ): void => {
      const draftedHits    = hits.filter(h => !h.isMercenary);
      const mercenaryHits  = hits.filter(h =>  h.isMercenary);

      // Best drafted → full T0 (one per side)
      const bestDrafted = draftedHits.reduce<WayHit | null>((b, h) =>
        !b || h.matchCount * h.numWays > b.matchCount * b.numWays ? h : b, null);

      if (bestDrafted) {
        const slot = attackerFormation.findIndex(
          u => u && u.alive && u.symbolId === bestDrafted.symbolId);
        if (slot >= 0) {
          const origin  = attackerCells[slot].container;
          const targets = defenderCells
            .filter((_, i) => defenderFormation[i]?.alive)
            .slice(0, 3)
            .map(c => ({ x: c.container.x, y: c.container.y }));
          if (targets.length > 0) {
            animations.push(attackTimeline({
              stage:    this.container,
              symbolId: bestDrafted.symbolId,
              spiritKey: SYMBOLS[bestDrafted.symbolId].spiritKey,
              originX: origin.x, originY: origin.y,
              targetPositions: targets,
            }));
          }
        }
      }

      // Each mercenary hit → lightweight flash (all run concurrently)
      for (const mh of mercenaryHits) {
        const targets = defenderCells
          .filter((_, i) => defenderFormation[i]?.alive)
          .slice(0, 3)
          .map(c => ({ x: c.container.x, y: c.container.y }));
        if (targets.length > 0) {
          animations.push(mercenaryWeakFx(
            this.container,
            targets,
            Math.max(1, Math.floor(mh.rawDmg)),
            SYMBOLS[mh.symbolId].color,
          ));
        }
      }
    };

    addSide(hitA, this.cellsA, this.cellsB, this.formationA, this.formationB);
    addSide(hitB, this.cellsB, this.cellsA, this.formationB, this.formationA);

    await Promise.all(animations);
  }

  private async fireJackpots(
    hitA: { matchCount: number; hitCells: number[][] }[],
    hitB: { matchCount: number; hitCells: number[][] }[],
  ): Promise<void> {
    const bursts: Promise<void>[] = [];
    for (const wh of hitA) {
      if (wh.matchCount >= 5) {
        // burst at anchor col 0, first matching row
        bursts.push(this.reel.burstJackpot(0, wh.hitCells[0][0]));
        bursts.push(this.spawnWinBurst());
      }
    }
    for (const wh of hitB) {
      if (wh.matchCount >= 5) {
        // burst at anchor col 4, first matching row
        bursts.push(this.reel.burstJackpot(4, wh.hitCells[0][0]));
        bursts.push(this.spawnWinBurst());
      }
    }
    await Promise.all(bursts);
  }

  private async spawnWinBurst(): Promise<void> {
    const tex = Assets.get<Texture>('win-burst');
    if (!tex) return;
    const burst = new Sprite(tex);
    burst.anchor.set(0.5, 0.5);
    const size = Math.max(REEL_W, REEL_H) * 1.2;
    burst.width = size;
    burst.height = size;
    burst.x = SLOT_X + REEL_W / 2;
    burst.y = SLOT_Y + REEL_H / 2;
    burst.blendMode = 'add';
    burst.alpha = 0;
    this.fxLayer.addChild(burst);

    await tween(700, p => {
      // Flash up to full then fade + expand
      if (p < 0.2) burst.alpha = p / 0.2 * 0.85;
      else          burst.alpha = 0.85 * (1 - (p - 0.2) / 0.8);
      burst.scale.set(size / tex.width * (1 + p * 0.3));
      burst.rotation = p * 0.35;
    });
    burst.destroy();
  }

  // ─── Damage number popups ────────────────────────────────────────────────
  private async playDamageEvents(events: DmgEvent[], targetSide: 'A' | 'B'): Promise<void> {
    const pops = events.map(e => this.popDamage(targetSide, e.slotIndex, e.damageTaken));
    await Promise.all(pops);
  }

  private async popDamage(side: 'A' | 'B', slotIndex: number, amount: number): Promise<void> {
    if (amount <= 0) return;
    const ox = side === 'A' ? FORMATION_A_X : FORMATION_B_X;
    const col = slotIndex % 3;
    const row = Math.floor(slotIndex / 3);
    const cx = ox + col * (FORMATION_CELL + FORMATION_GAP) + FORMATION_CELL / 2;
    const cy = FORMATION_Y + row * (FORMATION_CELL + FORMATION_GAP) + FORMATION_CELL / 2;

    const txt = new Text({
      text: `-${amount}`,
      style: {
        fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.xl,
        fill: T.CTA.red, stroke: { color: 0x000, width: 4 },
      },
    });
    txt.anchor.set(0.5, 0.5);
    txt.x = cx; txt.y = cy;
    this.fxLayer.addChild(txt);

    await tween(600, p => {
      txt.y = cy - p * 60;
      txt.alpha = 1 - Math.max(0, (p - 0.4) / 0.6);
      txt.scale.set(1 + p * 0.2);
    }, Easings.easeOut);

    txt.destroy();
  }
}
