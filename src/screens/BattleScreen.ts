import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
import { buildUnionPool } from '@/systems/SymbolPool';
import { SlotEngine } from '@/systems/SlotEngine';
import {
  createFormation, isTeamAlive, teamHpTotal, type FormationGrid,
} from '@/systems/Formation';
import { distributeDamage, type DmgEvent } from '@/systems/DamageDistributor';
import { tween, tweenValue, delay, Easings } from '@/systems/tween';
import { SlotReel, REEL_W, REEL_H } from './SlotReel';
import type { DraftResult } from './DraftScreen';

// ─── Layout constants (proportional to canvas) ──────────────────────────────
const HEADER_Y   = Math.round(CANVAS_HEIGHT * 0.04);
const HP_Y       = Math.round(CANVAS_HEIGHT * 0.17);
const HP_BAR_W   = Math.round(CANVAS_WIDTH  * 0.19);
const HP_BAR_H   = 16;

const MID_Y_TOP  = Math.round(CANVAS_HEIGHT * 0.24);

const FORMATION_CELL = 64;
const FORMATION_GAP  = 6;
const FORMATION_GRID = FORMATION_CELL * 3 + FORMATION_GAP * 2;
const FORMATION_A_X  = Math.round(CANVAS_WIDTH * 0.05);
const FORMATION_B_X  = CANVAS_WIDTH - FORMATION_GRID - Math.round(CANVAS_WIDTH * 0.05);
const SLOT_X         = Math.round((CANVAS_WIDTH - REEL_W) / 2);
const SLOT_Y         = MID_Y_TOP + Math.round((FORMATION_GRID - REEL_H) / 2);
const FORMATION_Y    = MID_Y_TOP;

const LOG_Y          = MID_Y_TOP + Math.max(REEL_H, FORMATION_GRID) + T.SPACING.s6;
const BACK_BTN_Y     = CANVAS_HEIGHT - T.SPACING.s8;

const ROUND_GAP_MS   = 500; // pause between rounds

// ─── Components for formation display ────────────────────────────────────────
interface FormationCellRefs { cell: Graphics; label: Text; container: Container; }

export class BattleScreen implements Screen {
  private container = new Container();
  private roundText!: Text;
  private hpBarA!: Graphics;
  private hpBarB!: Graphics;
  private hpTextA!: Text;
  private hpTextB!: Text;
  private cellsA: FormationCellRefs[] = [];
  private cellsB: FormationCellRefs[] = [];
  private displayedHpA = 0;
  private displayedHpB = 0;
  private logText!: Text;
  private fxLayer = new Container();    // damage numbers live here
  private reel!: SlotReel;
  private formationA: FormationGrid = [];
  private formationB: FormationGrid = [];
  private engine = new SlotEngine(4, 5);
  private running = false;
  private round = 0;
  private logLines: string[] = [];

  constructor(private cfg: DraftResult, private onExit: () => void) {}

  // ─── Screen lifecycle ────────────────────────────────────────────────────
  async onMount(_app: Application, stage: Container): Promise<void> {
    stage.addChild(this.container);
    this.formationA = createFormation(this.cfg.selectedA, this.cfg.teamHpA);
    this.formationB = createFormation(this.cfg.selectedB, this.cfg.teamHpB);
    this.displayedHpA = teamHpTotal(this.formationA);
    this.displayedHpB = teamHpTotal(this.formationB);

    this.drawBackground();
    this.drawHeader();
    this.drawHpBars();
    this.drawFormation('A');
    this.drawFormation('B');
    this.drawSlot();
    this.drawLog();
    this.drawBackButton();
    this.container.addChild(this.fxLayer);  // fx on top
    this.refresh();
    void this.loop();
  }

  onUnmount(): void {
    this.running = false;
    this.container.destroy({ children: true });
    this.cellsA = [];
    this.cellsB = [];
  }

  // ─── Build UI ────────────────────────────────────────────────────────────
  private drawBackground(): void {
    const bg = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(T.SEA.abyss);
    this.container.addChild(bg);

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

    this.roundText = new Text({
      text: 'ROUND 00',
      style: { fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.md, fill: T.FG.muted, letterSpacing: 2 },
    });
    this.roundText.anchor.set(0.5, 0);
    this.roundText.x = CANVAS_WIDTH / 2;
    this.roundText.y = HEADER_Y + T.FONT_SIZE.h1 + 4;
    this.container.addChild(this.roundText);
  }

  private drawHpBars(): void {
    const ax = FORMATION_A_X;
    const bx = CANVAS_WIDTH - FORMATION_A_X - HP_BAR_W;

    this.makeHpLabel(ax + HP_BAR_W / 2, HP_Y - 20, 'PLAYER A', T.TEAM.azure);
    this.makeHpLabel(bx + HP_BAR_W / 2, HP_Y - 20, 'PLAYER B', T.TEAM.vermilion);

    this.makeHpTrack(ax, HP_Y, HP_BAR_W, HP_BAR_H);
    this.makeHpTrack(bx, HP_Y, HP_BAR_W, HP_BAR_H);

    this.hpBarA = new Graphics(); this.hpBarA.x = ax; this.hpBarA.y = HP_Y;
    this.container.addChild(this.hpBarA);
    this.hpBarB = new Graphics(); this.hpBarB.x = bx; this.hpBarB.y = HP_Y;
    this.container.addChild(this.hpBarB);

    this.hpTextA = new Text({
      text: '', style: {
        fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.md,
        fill: T.FG.white, stroke: { color: 0x000, width: 3 },
      },
    });
    this.hpTextA.anchor.set(0.5, 0.5);
    this.hpTextA.x = ax + HP_BAR_W / 2; this.hpTextA.y = HP_Y + HP_BAR_H / 2;
    this.container.addChild(this.hpTextA);

    this.hpTextB = new Text({
      text: '', style: {
        fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.md,
        fill: T.FG.white, stroke: { color: 0x000, width: 3 },
      },
    });
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

  private makeHpTrack(x: number, y: number, w: number, h: number): void {
    const track = new Graphics()
      .roundRect(x, y, w, h, h / 2)
      .fill(T.HP.track)
      .stroke({ width: 1, color: T.SEA.rim, alpha: 0.8 });
    this.container.addChild(track);
  }

  private drawFormation(side: 'A' | 'B'): void {
    const ox = side === 'A' ? FORMATION_A_X : FORMATION_B_X;
    const cells = side === 'A' ? this.cellsA : this.cellsB;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = ox + c * (FORMATION_CELL + FORMATION_GAP);
        const y = FORMATION_Y + r * (FORMATION_CELL + FORMATION_GAP);
        const container = new Container();
        container.x = x + FORMATION_CELL / 2;
        container.y = y + FORMATION_CELL / 2;
        this.container.addChild(container);

        const cell = new Graphics();
        container.addChild(cell);

        const label = new Text({
          text: '', style: {
            fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.xs,
            fill: T.FG.cream, align: 'center',
          },
        });
        label.anchor.set(0.5, 0.5);
        container.addChild(label);

        cells.push({ cell, label, container });
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
    this.logText = new Text({
      text: '',
      style: {
        fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.xs,
        fill: T.FG.muted, lineHeight: 16,
      },
    });
    this.logText.x = FORMATION_A_X;
    this.logText.y = LOG_Y;
    this.container.addChild(this.logText);
  }

  private drawBackButton(): void {
    const btn = new Container();
    btn.x = CANVAS_WIDTH / 2;
    btn.y = BACK_BTN_Y;
    this.container.addChild(btn);

    const bg = new Graphics()
      .roundRect(-110, -20, 220, 40, T.RADIUS.md)
      .fill({ color: T.SURF.panel.color, alpha: T.SURF.panel.alpha })
      .stroke({ width: 1.5, color: T.GOLD.deep, alpha: 0.7 });
    btn.addChild(bg);

    const label = new Text({
      text: 'BACK TO DRAFT',
      style: { fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.sm, fill: T.GOLD.pale, letterSpacing: 2 },
    });
    label.anchor.set(0.5, 0.5);
    btn.addChild(label);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => this.onExit());
    btn.on('pointerover', () => {
      bg.clear()
        .roundRect(-110, -20, 220, 40, T.RADIUS.md)
        .fill({ color: T.GOLD.deep, alpha: 0.22 })
        .stroke({ width: 2, color: T.GOLD.base, alpha: 1 });
      label.style.fill = T.GOLD.light;
    });
    btn.on('pointerout', () => {
      bg.clear()
        .roundRect(-110, -20, 220, 40, T.RADIUS.md)
        .fill({ color: T.SURF.panel.color, alpha: T.SURF.panel.alpha })
        .stroke({ width: 1.5, color: T.GOLD.deep, alpha: 0.7 });
      label.style.fill = T.GOLD.pale;
    });
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

    this.logText.text = this.logLines.slice(-8).join('\n');

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
    for (let i = 0; i < 9; i++) {
      const ref = cells[i];
      const unit = grid[i];
      ref.cell.clear();
      if (!unit) {
        ref.cell.roundRect(-FORMATION_CELL / 2, -FORMATION_CELL / 2, FORMATION_CELL, FORMATION_CELL, T.RADIUS.sm)
          .fill({ color: T.SEA.deep, alpha: 0.45 })
          .stroke({ width: 1, color: T.SEA.rim, alpha: 0.4 });
        ref.label.text = '';
        continue;
      }
      const sym = SYMBOLS[unit.symbolId];
      const alpha = unit.alive ? 1 : 0.22;
      const teamColor = side === 'A' ? T.TEAM.azure : T.TEAM.vermilion;
      ref.cell.roundRect(-FORMATION_CELL / 2, -FORMATION_CELL / 2, FORMATION_CELL, FORMATION_CELL, T.RADIUS.sm)
        .fill({ color: sym.color, alpha: 0.18 * alpha })
        .stroke({ width: 2, color: unit.alive ? teamColor : T.FG.dim, alpha });
      ref.label.text = unit.alive
        ? `${sym.name}\n${unit.hp}/${unit.maxHp}`
        : `${sym.name}\nDEAD`;
      ref.label.alpha = alpha;
    }
  }

  // ─── Auto-battle loop ────────────────────────────────────────────────────
  private async loop(): Promise<void> {
    this.running = true;
    const pool = buildUnionPool(this.cfg.selectedA, this.cfg.selectedB, SYMBOLS);
    const paylines = this.engine.getPaylines();

    while (this.running && isTeamAlive(this.formationA) && isTeamAlive(this.formationB)) {
      this.round++;
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

      const lineFx = this.reel.highlightLines(spin.sideA.hitLines, spin.sideB.hitLines, paylines);
      const jackpotFx = this.fireJackpots(spin.sideA.hitLines, spin.sideB.hitLines, paylines);

      const dmgA = spin.sideA.dmgDealt;
      const dmgB = spin.sideB.dmgDealt;
      const eventsOnB = dmgA > 0 ? distributeDamage(this.formationB, dmgA, 'A') : [];
      const eventsOnA = dmgB > 0 ? distributeDamage(this.formationA, dmgB, 'B') : [];

      const newHpA = teamHpTotal(this.formationA);
      const newHpB = teamHpTotal(this.formationB);

      const fx: Promise<void>[] = [lineFx, jackpotFx];
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

      this.logLines.push(
        `R${this.round.toString().padStart(2, '0')}  ` +
        `A→B dmg ${dmgA} (${spin.sideA.hitLines.length} lines)   ` +
        `B→A dmg ${dmgB} (${spin.sideB.hitLines.length} lines)`,
      );
      this.refresh();

      if (!this.running) return;
      await delay(ROUND_GAP_MS);
    }

    if (!this.running) return;
    const winner = isTeamAlive(this.formationA) ? 'Player A' : 'Player B';
    this.logLines.push('');
    this.logLines.push(`>>> ${winner} WINS  <<<`);
    this.refresh();
  }

  private async fireJackpots(
    hitA: { lineIndex: number; matchCount: number; symbolId: number }[],
    hitB: { lineIndex: number; matchCount: number; symbolId: number }[],
    paylines: readonly number[][],
  ): Promise<void> {
    const bursts: Promise<void>[] = [];
    for (const hl of hitA) {
      if (hl.matchCount >= 5) {
        const line = paylines[hl.lineIndex];
        bursts.push(this.reel.burstJackpot(0, line[0]));
      }
    }
    for (const hl of hitB) {
      if (hl.matchCount >= 5) {
        const line = paylines[hl.lineIndex];
        bursts.push(this.reel.burstJackpot(4, line[4]));
      }
    }
    await Promise.all(bursts);
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
