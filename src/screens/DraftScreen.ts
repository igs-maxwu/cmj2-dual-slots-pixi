import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS } from '@/config/GameConfig';
import {
  SYMBOLS, DEFAULT_TARGET_RTP, DEFAULT_TARGET_DMG,
  DEFAULT_TEAM_HP, DEFAULT_BET, DEFAULT_FAIRNESS_EXP,
} from '@/config/SymbolsConfig';
import { buildUnionPool } from '@/systems/SymbolPool';
import { calculateScales } from '@/systems/ScaleCalculator';

const TILE_W = 130;
const TILE_H = 100;
const TILE_GAP = 14;
const COLS = 4;
const ROWS = 2;
const GRID_W = COLS * TILE_W + (COLS - 1) * TILE_GAP;
const GRID_H = ROWS * TILE_H + (ROWS - 1) * TILE_GAP;
const GRID_X = Math.round((CANVAS_WIDTH - GRID_W) / 2);
const GRID_Y = Math.round((CANVAS_HEIGHT - GRID_H) / 2) - 40;
const MAX_PICKS = 5;

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

export class DraftScreen implements Screen {
  private container = new Container();
  private selectedA = new Set<number>();
  private selectedB = new Set<number>();
  private checkLabelsA: Text[] = [];
  private checkLabelsB: Text[] = [];
  private statusText!: Text;
  private goButton!: Container;
  private goBg!: Graphics;
  private goLabel!: Text;

  constructor(private onReady: (cfg: DraftResult) => void) {}

  onMount(_app: Application, stage: Container): void {
    stage.addChild(this.container);
    this.drawBackground();
    this.drawTitle();
    this.buildTiles();
    this.buildStatus();
    this.buildGoButton();
    this.refresh();
  }

  onUnmount(): void {
    this.container.destroy({ children: true });
    this.checkLabelsA = [];
    this.checkLabelsB = [];
  }

  private drawBackground(): void {
    const bg = new Graphics()
      .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .fill(COLORS.bg);
    this.container.addChild(bg);

    const grid = new Graphics();
    for (let x = 0; x < CANVAS_WIDTH; x += 40) grid.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT);
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) grid.moveTo(0, y).lineTo(CANVAS_WIDTH, y);
    grid.stroke({ width: 1, color: 0x1a2a40, alpha: 0.4 });
    this.container.addChild(grid);
  }

  private drawTitle(): void {
    const title = new Text({
      text: 'SYMBOL DRAFT',
      style: { fontFamily: 'Arial Black, sans-serif', fontSize: 36, fill: 0xf1c40f, stroke: { color: 0x000, width: 4 } },
    });
    title.anchor.set(0.5, 0);
    title.x = CANVAS_WIDTH / 2;
    title.y = 40;
    this.container.addChild(title);

    const sub = new Text({
      text: 'Each player selects 5 symbols  |  Blue = Player A  |  Red = Player B',
      style: { fontFamily: 'Arial', fontSize: 14, fill: COLORS.muted },
    });
    sub.anchor.set(0.5, 0);
    sub.x = CANVAS_WIDTH / 2;
    sub.y = 88;
    this.container.addChild(sub);
  }

  private buildTiles(): void {
    const totalW = SYMBOLS.reduce((s, x) => s + x.weight, 0);

    SYMBOLS.forEach((sym, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const tx = GRID_X + col * (TILE_W + TILE_GAP);
      const ty = GRID_Y + row * (TILE_H + TILE_GAP);

      const tile = new Container();
      tile.x = tx;
      tile.y = ty;
      this.container.addChild(tile);

      const bg = new Graphics()
        .roundRect(0, 0, TILE_W, TILE_H, 8)
        .fill(COLORS.tile)
        .stroke({ width: 1.5, color: COLORS.border, alpha: 0.8 });
      tile.addChild(bg);

      const swatch = new Graphics()
        .circle(TILE_W / 2, 28, 14)
        .fill({ color: sym.color, alpha: 0.9 });
      tile.addChild(swatch);

      const name = new Text({
        text: sym.name,
        style: { fontFamily: 'Arial', fontSize: 13, fill: COLORS.text },
      });
      name.anchor.set(0.5, 0);
      name.x = TILE_W / 2;
      name.y = 50;
      tile.addChild(name);

      const prob = ((sym.weight / totalW) * 100).toFixed(1);
      const meta = new Text({
        text: `W:${sym.weight}  ${prob}%`,
        style: { fontFamily: 'monospace', fontSize: 11, fill: COLORS.muted },
      });
      meta.anchor.set(0.5, 0);
      meta.x = TILE_W / 2;
      meta.y = 70;
      tile.addChild(meta);

      const checkA = new Text({
        text: '[ ]',
        style: { fontFamily: 'monospace', fontSize: 18, fill: COLORS.playerA },
      });
      checkA.anchor.set(0.5, 0.5);
      checkA.x = -22;
      checkA.y = TILE_H / 2;
      checkA.eventMode = 'static';
      checkA.cursor = 'pointer';
      checkA.on('pointertap', () => this.toggle('A', i));
      tile.addChild(checkA);
      this.checkLabelsA.push(checkA);

      const checkB = new Text({
        text: '[ ]',
        style: { fontFamily: 'monospace', fontSize: 18, fill: COLORS.playerB },
      });
      checkB.anchor.set(0.5, 0.5);
      checkB.x = TILE_W + 22;
      checkB.y = TILE_H / 2;
      checkB.eventMode = 'static';
      checkB.cursor = 'pointer';
      checkB.on('pointertap', () => this.toggle('B', i));
      tile.addChild(checkB);
      this.checkLabelsB.push(checkB);

      bg.eventMode = 'static';
      bg.cursor = 'pointer';
      bg.on('pointertap', () => this.toggle('A', i));
    });
  }

  private buildStatus(): void {
    this.statusText = new Text({
      text: '',
      style: { fontFamily: 'monospace', fontSize: 18, fill: COLORS.text },
    });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.x = CANVAS_WIDTH / 2;
    this.statusText.y = GRID_Y + GRID_H + 30;
    this.container.addChild(this.statusText);
  }

  private buildGoButton(): void {
    this.goButton = new Container();
    this.goButton.x = CANVAS_WIDTH / 2;
    this.goButton.y = GRID_Y + GRID_H + 85;
    this.container.addChild(this.goButton);

    this.goBg = new Graphics();
    this.goButton.addChild(this.goBg);

    this.goLabel = new Text({
      text: 'SELECT 5 EACH TO START',
      style: { fontFamily: 'Arial Black, sans-serif', fontSize: 16, fill: 0xffffff },
    });
    this.goLabel.anchor.set(0.5, 0.5);
    this.goButton.addChild(this.goLabel);

    this.goButton.eventMode = 'static';
    this.goButton.cursor = 'pointer';
    this.goButton.on('pointertap', () => this.launch());
    this.drawGoBg(false);
  }

  private drawGoBg(hover: boolean): void {
    const active = this.canGo();
    const fill = hover && active ? 0x2ecc71 : active ? COLORS.go : COLORS.goOff;
    this.goBg.clear()
      .roundRect(-140, -22, 280, 44, 8)
      .fill(fill)
      .stroke({ width: 1.5, color: hover ? COLORS.gold : 0x336633, alpha: 0.8 });
  }

  private toggle(side: 'A' | 'B', idx: number): void {
    const set = side === 'A' ? this.selectedA : this.selectedB;
    if (set.has(idx)) set.delete(idx);
    else if (set.size < MAX_PICKS) set.add(idx);
    this.refresh();
  }

  private canGo(): boolean {
    return this.selectedA.size === MAX_PICKS && this.selectedB.size === MAX_PICKS;
  }

  private refresh(): void {
    SYMBOLS.forEach((_, i) => {
      this.checkLabelsA[i].text = this.selectedA.has(i) ? '[A]' : '[ ]';
      this.checkLabelsB[i].text = this.selectedB.has(i) ? '[B]' : '[ ]';
    });
    this.statusText.text = `A: ${this.selectedA.size}/${MAX_PICKS}   B: ${this.selectedB.size}/${MAX_PICKS}`;
    this.goLabel.text = this.canGo() ? 'START BATTLE!' : 'SELECT 5 EACH TO START';
    this.drawGoBg(false);
  }

  private launch(): void {
    if (!this.canGo()) return;
    const selectedA = Array.from(this.selectedA);
    const selectedB = Array.from(this.selectedB);
    const pool = buildUnionPool(selectedA, selectedB, SYMBOLS);
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
