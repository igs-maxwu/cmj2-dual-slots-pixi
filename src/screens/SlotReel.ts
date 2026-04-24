import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
import { gemForSymbol } from '@/config/GemMapping';
import { tween, delay, Easings } from '@/systems/tween';
import type { WayHit } from '@/systems/SlotEngine';
import { AudioManager } from '@/systems/AudioManager';

function hasPreMatch(grid: number[][], colLeft: number, colRight: number): boolean {
  const left = new Set<number>();
  for (let r = 0; r < 3; r++) left.add(grid[r][colLeft]);
  for (let r = 0; r < 3; r++) if (left.has(grid[r][colRight])) return true;
  return false;
}

const COLS = 5;
const ROWS = 3;
const CELL_W = 128;
const CELL_H = 150;
const CELL_GAP = 8;
const FRAME_PAD = 16;

export const REEL_W = COLS * CELL_W + (COLS - 1) * CELL_GAP + FRAME_PAD * 2;
export const REEL_H = ROWS * CELL_H + (ROWS - 1) * CELL_GAP + FRAME_PAD * 2;

interface Cell {
  container:     Container;
  gemSprite:     Sprite;        // SOS2 gem visual (replaces SpiritPortrait)
  overlay:       Graphics;
  currentSymbol: number;
}

/** Re-exported for callers that previously imported HitLineLite from here. */
export type { WayHit } from '@/systems/SlotEngine';

/**
 * 5×4 slot reel visual.
 *
 * Animation flow per spin:
 *   spin(finalGrid)
 *     → for each column: rapid symbol-swap during spin window, then
 *       lock to final symbol + bounce + flash
 *   highlightLines(hitA, hitB, paylines)
 *     → per hit line, pulse matching cells in the team color
 *   burstJackpot(col, row)
 *     → one-shot gold particle burst (call on 5-match lines)
 */
export class SlotReel extends Container {
  private cells: Cell[][] = [];

  constructor() {
    super();
    this.buildFrame();
    this.buildCells();
  }

  // ─── Build ──────────────────────────────────────────────────────────────
  private buildFrame(): void {
    // Dark interior — cells show through between the frame ornaments
    const bg = new Graphics()
      .roundRect(4, 4, REEL_W - 8, REEL_H - 8, T.RADIUS.md)
      .fill({ color: T.SURF.darkInlay.color, alpha: 0.9 });
    this.addChild(bg);

    // Ornate frame PNG overlaid on top
    const frameTex = Assets.get<Texture>('slot-frame');
    if (frameTex) {
      // Draw frame slightly larger than reel area so its ornate border sits
      // around the edges with a small outward bleed.
      const bleed = 14;
      const frame = new Sprite(frameTex);
      frame.anchor.set(0, 0);
      frame.x = -bleed;
      frame.y = -bleed;
      frame.width  = REEL_W + bleed * 2;
      frame.height = REEL_H + bleed * 2;
      this.addChild(frame);
    } else {
      // Fallback — keep programmatic border
      const border = new Graphics()
        .roundRect(0, 0, REEL_W, REEL_H, T.RADIUS.md)
        .stroke({ width: 2, color: T.GOLD.deep, alpha: 0.85 });
      this.addChild(border);
    }

    // Dragon-head corner ornaments — mirrored to all 4 corners
    const cornerTex = Assets.get<Texture>('dragon-corner');
    if (cornerTex) {
      const corners: Array<[number, number, number, number, number, number]> = [
        // ax,  ay,  x,              y,              sx,  sy
        [0, 0,  -8,            -8,            1,  1],
        [1, 0,  REEL_W + 8,    -8,           -1,  1],
        [0, 1,  -8,            REEL_H + 8,    1, -1],
        [1, 1,  REEL_W + 8,    REEL_H + 8,   -1, -1],
      ];
      for (const [ax, ay, x, y, sx, sy] of corners) {
        const corner = new Sprite(cornerTex);
        corner.anchor.set(ax, ay);
        corner.width = 120;
        corner.height = 120;
        corner.x = x;
        corner.y = y;
        corner.scale.x = Math.sign(sx) * Math.abs(corner.scale.x);
        corner.scale.y = Math.sign(sy) * Math.abs(corner.scale.y);
        this.addChild(corner);
      }
    }
  }

  private buildCells(): void {
    for (let c = 0; c < COLS; c++) {
      const colCells: Cell[] = [];
      for (let r = 0; r < ROWS; r++) {
        const x = FRAME_PAD + c * (CELL_W + CELL_GAP);
        const y = FRAME_PAD + r * (CELL_H + CELL_GAP);

        const container = new Container();
        container.x = x + CELL_W / 2;
        container.y = y + CELL_H / 2;
        // Pivot so scaling grows from center
        container.pivot.set(0, 0);
        this.addChild(container);

        const cellBg = new Graphics()
          .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
          .fill({ color: T.SEA.deep, alpha: 0.55 })
          .stroke({ width: 1, color: T.SEA.rim, alpha: 0.7 });
        container.addChild(cellBg);

        // Gem sprite — Texture.WHITE placeholder, overwritten by setCellSymbol()
        const gemSprite = new Sprite(Texture.WHITE);
        gemSprite.anchor.set(0.5);
        gemSprite.y = 0;
        container.addChild(gemSprite);

        const overlay = new Graphics()
          .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
          .fill(0xffffff);
        overlay.alpha = 0;
        container.addChild(overlay);

        colCells.push({ container, gemSprite, overlay, currentSymbol: -1 });
        this.setCellSymbol(colCells[r], r % SYMBOLS.length);
      }
      this.cells.push(colCells);
    }
  }

  private setCellSymbol(cell: Cell, symId: number): void {
    if (cell.currentSymbol === symId) return;
    cell.currentSymbol = symId;
    const sym     = SYMBOLS[symId];
    const gemInfo = gemForSymbol(sym);
    const tex     = Assets.get<Texture>(gemInfo.assetKey);
    if (tex) {
      cell.gemSprite.texture = tex;
      // Scale gem to ~80% of the smaller cell dimension
      const targetSize = Math.min(CELL_W, CELL_H) * 0.80;
      const scale = targetSize / Math.max(tex.width, tex.height);
      cell.gemSprite.scale.set(scale);
    }
    cell.gemSprite.tint = gemInfo.tint;
  }

  // ─── Spin ────────────────────────────────────────────────────────────────
  /**
   * Spec-locked stop times (measured from spin() call, settle phase excluded):
   *
   *   R1+R5  lock at t = 0.6 s   (start t=0,    fade 90ms + swap 510ms)
   *   R2+R4  lock at t = 1.1 s   (start t=500ms, fade 90ms + swap 510ms)
   *   R3     lock at t = 1.6 s   (start t=1000ms, pre-flash 200ms + fade 90ms + swap 310ms)
   *
   * Each group is separated by 500 ms.
   */
  async spin(finalGrid: number[][]): Promise<void> {
    // Outer pair — start immediately, lock at t ≈ 600ms
    const p04 = Promise.all([
      this.spinColumn(0, finalGrid, 510),
      this.spinColumn(4, finalGrid, 510),
    ]);

    // Inner pair — start 500ms later, lock at t ≈ 1100ms
    await delay(500);
    const p13 = Promise.all([
      this.spinColumn(1, finalGrid, 510),
      this.spinColumn(3, finalGrid, 510),
    ]);

    // B4 teaser: if either outer/inner pair on one side shares a symbol,
    // escalate the center pre-flash to tease a possible 3-way.
    const teaser = hasPreMatch(finalGrid, 0, 1) || hasPreMatch(finalGrid, 4, 3);

    // Center — start 500ms after inner, lock at t ≈ 1600ms (or ≈ 1800ms if teaser)
    // (spinColumnCenter adds 200ms/400ms pre-flash + 90ms fade before swap)
    await delay(500);
    const p2 = this.spinColumnCenter(2, finalGrid, 310, teaser);

    await Promise.all([p04, p13, p2]);
  }

  private async spinColumn(col: number, finalGrid: number[][], spinMs: number): Promise<void> {
    const colCells = this.cells[col];

    // Spin-up fade
    await tween(90, p => {
      for (const cell of colCells) cell.container.alpha = 1 - p * 0.35;
    });

    // Rapid symbol swap while spinning
    const stopAt = performance.now() + spinMs;
    while (performance.now() < stopAt) {
      for (const cell of colCells) {
        this.setCellSymbol(cell, Math.floor(Math.random() * SYMBOLS.length));
      }
      await delay(65);
    }

    // Lock to final
    for (let r = 0; r < ROWS; r++) this.setCellSymbol(colCells[r], finalGrid[r][col]);
    for (const cell of colCells) cell.container.alpha = 1;

    // Anticipation compress (cells squish down slightly before snap)
    await tween(70, p => {
      for (const cell of colCells) cell.container.scale.set(1 - p * 0.10);
    });
    // BackOut settle — overshoots 1.0 then snaps back (classic landing feel)
    await tween(240, p => {
      for (const cell of colCells) cell.container.scale.set(0.90 + Easings.backOut(p) * 0.10);
    });
    for (const cell of colCells) cell.container.scale.set(1);

    AudioManager.playSfx('reel-stop-outer');

    // Stop-flash
    await tween(160, p => {
      const a = Easings.pulse(p) * 0.30;
      for (const cell of colCells) cell.overlay.alpha = a;
    });
    for (const cell of colCells) cell.overlay.alpha = 0;
  }

  /**
   * Center column: gold anticipation flash then slow-mo spin (0.7× speed).
   */
  private async spinColumnCenter(col: number, finalGrid: number[][], spinMs: number, anticipated: boolean): Promise<void> {
    const colCells = this.cells[col];

    AudioManager.playSfx('reel-r3-anticipation');

    // Gold pre-flash anticipation — brighter + longer when B4 teaser triggers
    const flashFill = anticipated ? (T.GOLD.light ?? T.GOLD.base) : T.GOLD.base;
    const flashMs   = anticipated ? 400 : 200;
    const flashPeak = anticipated ? 0.85 : 0.55;
    for (const cell of colCells) {
      cell.overlay.clear()
        .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
        .fill(flashFill);
    }
    await tween(flashMs, p => {
      const a = Easings.pulse(p) * flashPeak;
      for (const cell of colCells) cell.overlay.alpha = a;
    });
    for (const cell of colCells) {
      cell.overlay.alpha = 0;
      cell.overlay.clear()
        .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
        .fill(0xffffff);
    }

    // Spin-up fade
    await tween(90, p => {
      for (const cell of colCells) cell.container.alpha = 1 - p * 0.35;
    });

    // Slow-mo symbol swap: 65ms → 93ms per frame (0.7× speed)
    const stopAt = performance.now() + spinMs;
    while (performance.now() < stopAt) {
      for (const cell of colCells) {
        this.setCellSymbol(cell, Math.floor(Math.random() * SYMBOLS.length));
      }
      await delay(93);
    }

    // Lock to final
    for (let r = 0; r < ROWS; r++) this.setCellSymbol(colCells[r], finalGrid[r][col]);
    for (const cell of colCells) cell.container.alpha = 1;

    // Anticipation compress — center column squishes more than outer cols
    await tween(90, p => {
      for (const cell of colCells) cell.container.scale.set(1 - p * 0.15);
    });
    // BackOut settle — stronger overshoot for center drama
    await tween(300, p => {
      for (const cell of colCells) cell.container.scale.set(0.85 + Easings.backOut(p) * 0.15);
    });
    for (const cell of colCells) cell.container.scale.set(1);

    AudioManager.playSfx('reel-stop-inner');

    // Brighter stop-flash for center
    await tween(200, p => {
      const a = Easings.pulse(p) * 0.42;
      for (const cell of colCells) cell.overlay.alpha = a;
    });
    for (const cell of colCells) cell.overlay.alpha = 0;
  }

  // ─── Ways win highlights ─────────────────────────────────────────────────
  async highlightWays(hitA: WayHit[], hitB: WayHit[]): Promise<void> {
    const pulses: Promise<void>[] = [];
    for (const wh of hitA) pulses.push(this.pulseWay(wh, 'A'));
    for (const wh of hitB) pulses.push(this.pulseWay(wh, 'B'));
    await Promise.all(pulses);
  }

  private async pulseWay(hit: WayHit, side: 'A' | 'B'): Promise<void> {
    const dir       = side === 'A' ? 1 : -1;
    const anchorCol = side === 'A' ? 0 : COLS - 1;
    const tint      = side === 'A' ? T.TEAM.azureGlow : T.TEAM.vermilionGlow;

    const targets: Cell[] = [];
    for (let offset = 0; offset < hit.hitCells.length; offset++) {
      const actualCol = anchorCol + offset * dir;
      for (const row of hit.hitCells[offset]) {
        targets.push(this.cells[actualCol][row]);
      }
    }

    for (const cell of targets) {
      cell.overlay.clear()
        .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
        .fill(tint);
    }

    await tween(330, p => {
      const a = Easings.pulse(p) * 0.7;
      for (const cell of targets) cell.overlay.alpha = a;
    });

    for (const cell of targets) {
      cell.overlay.alpha = 0;
      cell.overlay.clear()
        .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
        .fill(0xffffff);
    }
  }

  // ─── Jackpot particles ───────────────────────────────────────────────────
  async burstJackpot(col: number, row: number): Promise<void> {
    const target = this.cells[col][row];
    const cx = target.container.x;
    const cy = target.container.y;

    interface Particle { g: Graphics; vx: number; vy: number; }
    const parts: Particle[] = [];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2.5 + Math.random() * 2.5;
      const g = new Graphics()
        .circle(0, 0, 3 + Math.random() * 3)
        .fill({ color: T.GOLD.light, alpha: 0.95 });
      g.x = cx; g.y = cy;
      this.addChild(g);
      parts.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
    }

    await tween(620, p => {
      for (const pt of parts) {
        pt.g.x += pt.vx;
        pt.g.y += pt.vy;
        pt.vy += 0.14;
        pt.g.alpha = 1 - p;
        pt.g.scale.set(1 - p * 0.7);
      }
    });
    for (const pt of parts) pt.g.destroy();
  }

  // ─── Position helpers ────────────────────────────────────────────────────
  /** Returns reel-local coordinates of a cell's center */
  cellLocal(col: number, row: number): { x: number; y: number } {
    const cell = this.cells[col][row];
    return { x: cell.container.x, y: cell.container.y };
  }
}
