import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from '@/config/GameConfig';
import { SYMBOLS } from '@/config/SymbolsConfig';
import { buildUnionPool } from '@/systems/SymbolPool';
import { SlotEngine } from '@/systems/SlotEngine';
import {
  createFormation, isTeamAlive, teamHpTotal, type FormationGrid,
} from '@/systems/Formation';
import { distributeDamage } from '@/systems/DamageDistributor';
import type { DraftResult } from './DraftScreen';

const CELL = 72;
const GAP  = 8;
const GRID_PX = 3 * CELL + 2 * GAP;

export class BattleScreen implements Screen {
  private container = new Container();
  private hpTextA!: Text;
  private hpTextB!: Text;
  private roundText!: Text;
  private logText!: Text;
  private gridCellsA: Graphics[] = [];
  private gridCellsB: Graphics[] = [];
  private gridLabelsA: Text[] = [];
  private gridLabelsB: Text[] = [];
  private formationA: FormationGrid = [];
  private formationB: FormationGrid = [];
  private engine = new SlotEngine(4, 5);
  private app: Application | null = null;
  private running = false;
  private round = 0;
  private logLines: string[] = [];

  constructor(private cfg: DraftResult, private onExit: () => void) {}

  onMount(app: Application, stage: Container): void {
    this.app = app;
    stage.addChild(this.container);
    this.formationA = createFormation(this.cfg.selectedA, this.cfg.teamHpA);
    this.formationB = createFormation(this.cfg.selectedB, this.cfg.teamHpB);
    this.drawBackground();
    this.drawHeader();
    this.drawFormations();
    this.drawLog();
    this.drawExitButton();
    this.refresh();
    this.start();
  }

  onUnmount(): void {
    this.running = false;
    this.container.destroy({ children: true });
    this.gridCellsA = [];
    this.gridCellsB = [];
    this.gridLabelsA = [];
    this.gridLabelsB = [];
  }

  private drawBackground(): void {
    const bg = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(COLORS.bg);
    this.container.addChild(bg);
  }

  private drawHeader(): void {
    const title = new Text({
      text: '雀靈戰記 · BATTLE',
      style: { fontFamily: 'Arial Black, sans-serif', fontSize: 32, fill: COLORS.gold },
    });
    title.anchor.set(0.5, 0);
    title.x = CANVAS_WIDTH / 2;
    title.y = 20;
    this.container.addChild(title);

    this.roundText = new Text({
      text: 'ROUND 00',
      style: { fontFamily: 'monospace', fontSize: 16, fill: COLORS.muted },
    });
    this.roundText.anchor.set(0.5, 0);
    this.roundText.x = CANVAS_WIDTH / 2;
    this.roundText.y = 64;
    this.container.addChild(this.roundText);

    this.hpTextA = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 22, fill: COLORS.playerA },
    });
    this.hpTextA.x = 40;
    this.hpTextA.y = 110;
    this.container.addChild(this.hpTextA);

    this.hpTextB = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 22, fill: COLORS.playerB },
    });
    this.hpTextB.anchor.set(1, 0);
    this.hpTextB.x = CANVAS_WIDTH - 40;
    this.hpTextB.y = 110;
    this.container.addChild(this.hpTextB);
  }

  private drawFormations(): void {
    const gridY = 160;
    const gridAX = 80;
    const gridBX = CANVAS_WIDTH - 80 - GRID_PX;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = r * 3 + c;
        const x0 = gridAX + c * (CELL + GAP);
        const x1 = gridBX + c * (CELL + GAP);
        const y  = gridY + r * (CELL + GAP);

        const cellA = new Graphics();
        cellA.x = x0;
        cellA.y = y;
        this.container.addChild(cellA);
        this.gridCellsA.push(cellA);

        const labelA = new Text({
          text: '',
          style: { fontFamily: 'monospace', fontSize: 11, fill: COLORS.text, align: 'center' },
        });
        labelA.anchor.set(0.5, 0.5);
        labelA.x = x0 + CELL / 2;
        labelA.y = y + CELL / 2;
        this.container.addChild(labelA);
        this.gridLabelsA.push(labelA);

        const cellB = new Graphics();
        cellB.x = x1;
        cellB.y = y;
        this.container.addChild(cellB);
        this.gridCellsB.push(cellB);

        const labelB = new Text({
          text: '',
          style: { fontFamily: 'monospace', fontSize: 11, fill: COLORS.text, align: 'center' },
        });
        labelB.anchor.set(0.5, 0.5);
        labelB.x = x1 + CELL / 2;
        labelB.y = y + CELL / 2;
        this.container.addChild(labelB);
        this.gridLabelsB.push(labelB);

        void idx;
      }
    }

    const vs = new Text({
      text: 'VS',
      style: { fontFamily: 'Arial Black', fontSize: 48, fill: COLORS.gold, stroke: { color: 0x000, width: 3 } },
    });
    vs.anchor.set(0.5, 0.5);
    vs.x = CANVAS_WIDTH / 2;
    vs.y = gridY + GRID_PX / 2;
    this.container.addChild(vs);
  }

  private drawLog(): void {
    this.logText = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 13, fill: COLORS.text, lineHeight: 18 },
    });
    this.logText.x = 80;
    this.logText.y = 450;
    this.container.addChild(this.logText);
  }

  private drawExitButton(): void {
    const btn = new Container();
    btn.x = CANVAS_WIDTH / 2;
    btn.y = CANVAS_HEIGHT - 40;
    this.container.addChild(btn);

    const bg = new Graphics()
      .roundRect(-100, -20, 200, 40, 8)
      .fill(0x1a3d28)
      .stroke({ width: 1.5, color: COLORS.border });
    btn.addChild(bg);

    const label = new Text({
      text: 'BACK TO DRAFT',
      style: { fontFamily: 'Arial Black', fontSize: 14, fill: 0xffffff },
    });
    label.anchor.set(0.5, 0.5);
    btn.addChild(label);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => this.onExit());
  }

  private refresh(): void {
    this.hpTextA.text = `A HP: ${teamHpTotal(this.formationA)}`;
    this.hpTextB.text = `HP B: ${teamHpTotal(this.formationB)}`;
    this.roundText.text = `ROUND ${String(this.round).padStart(2, '0')}`;

    for (let i = 0; i < 9; i++) {
      this.redrawCell(this.gridCellsA[i], this.gridLabelsA[i], this.formationA[i]);
      this.redrawCell(this.gridCellsB[i], this.gridLabelsB[i], this.formationB[i]);
    }

    this.logText.text = this.logLines.slice(-10).join('\n');
  }

  private redrawCell(cell: Graphics, label: Text, unit: FormationGrid[number]): void {
    cell.clear();
    if (!unit) {
      cell.roundRect(0, 0, CELL, CELL, 6)
        .fill({ color: 0x0f1628, alpha: 0.6 })
        .stroke({ width: 1, color: COLORS.border, alpha: 0.4 });
      label.text = '';
      return;
    }
    const sym = SYMBOLS[unit.symbolId];
    const alpha = unit.alive ? 1 : 0.25;
    cell.roundRect(0, 0, CELL, CELL, 6)
      .fill({ color: sym.color, alpha: 0.25 * alpha })
      .stroke({ width: 2, color: sym.color, alpha });
    label.text = unit.alive ? `${sym.name}\n${unit.hp}/${unit.maxHp}` : `${sym.name}\nDEAD`;
    label.alpha = alpha;
  }

  private async start(): Promise<void> {
    this.running = true;
    const pool = buildUnionPool(this.cfg.selectedA, this.cfg.selectedB, SYMBOLS);

    while (this.running && isTeamAlive(this.formationA) && isTeamAlive(this.formationB)) {
      this.round++;
      await this.sleep(700);
      if (!this.running) return;

      const spin = this.engine.spin(
        pool,
        this.cfg.selectedA, this.cfg.selectedB,
        this.cfg.betA, this.cfg.betB,
        this.cfg.coinScaleA, this.cfg.dmgScaleA,
        this.cfg.coinScaleB, this.cfg.dmgScaleB,
        this.cfg.fairnessExp,
      );

      const dmgA = spin.sideA.dmgDealt;
      const dmgB = spin.sideB.dmgDealt;
      if (dmgA > 0) distributeDamage(this.formationB, dmgA, 'A');
      if (dmgB > 0) distributeDamage(this.formationA, dmgB, 'B');

      this.logLines.push(
        `R${this.round.toString().padStart(2, '0')}  A→B dmg ${dmgA}  (${spin.sideA.hitLines.length} lines)   ` +
        `B→A dmg ${dmgB}  (${spin.sideB.hitLines.length} lines)`,
      );

      this.refresh();
    }

    if (!this.running) return;
    const winner = isTeamAlive(this.formationA) ? 'Player A' : 'Player B';
    this.logLines.push('');
    this.logLines.push(`>>> ${winner} WINS  <<<`);
    this.refresh();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
