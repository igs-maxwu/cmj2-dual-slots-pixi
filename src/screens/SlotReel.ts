import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
// gemForSymbol import removed — p11-vA-03: programmatic ball replaces gem sprite
import { tween, delay, Easings } from '@/systems/tween';
import type { WayHit } from '@/systems/SlotEngine';
import { AudioManager } from '@/systems/AudioManager';

// ─── p11-vA-03: Symbol → clan character + ball color mapping ────────────────
// Clan spirits 0-7: azure 青龍 (0,1) / white 白虎 (2,3) / vermilion 朱雀 (4,5) / black 玄武 (6,7)
// Special symbols 8-11: Wild 替 / Curse 咒 / Scatter 散 / Jackpot 寶
const SYMBOL_VISUAL: Record<number, { char: string; color: number }> = {
  0: { char: '青', color: T.CLAN.azureGlow },
  1: { char: '青', color: T.CLAN.azureGlow },
  2: { char: '白', color: T.CLAN.whiteGlow },
  3: { char: '白', color: T.CLAN.whiteGlow },
  4: { char: '朱', color: T.CLAN.vermilionGlow },
  5: { char: '朱', color: T.CLAN.vermilionGlow },
  6: { char: '玄', color: T.CLAN.blackGlow },
  7: { char: '玄', color: T.CLAN.blackGlow },
  8:  { char: '替', color: T.GOLD.glow },      // Wild
  9:  { char: '咒', color: 0x8b3aaa },          // Curse
  10: { char: '散', color: 0xff3b6b },          // Scatter
  11: { char: '寶', color: T.GOLD.base },       // Jackpot
};

function hasPreMatch(grid: number[][], colLeft: number, colRight: number): boolean {
  const left = new Set<number>();
  for (let r = 0; r < 3; r++) left.add(grid[r][colLeft]);
  for (let r = 0; r < 3; r++) if (left.has(grid[r][colRight])) return true;
  return false;
}

const COLS = 5;
const ROWS = 3;
const CELL_W = 124;   // p10-v01: reduced from 128 (Variant B reel zone fits 330px h)
const CELL_H = 100;   // p10-v01: reduced from 150
const CELL_GAP = 8;
const FRAME_PAD = 16;

export const REEL_W = COLS * CELL_W + (COLS - 1) * CELL_GAP + FRAME_PAD * 2;
export const REEL_H = ROWS * CELL_H + (ROWS - 1) * CELL_GAP + FRAME_PAD * 2;

interface Cell {
  container:     Container;
  gemBall:       Container;     // p11-vA-03: programmatic glossy ball (shadow+main+highlight+char)
  overlay:       Graphics;
  currentSymbol: number;
  pipsContainer: Container;     // p10-v02: tier pip indicator (1-3 dots, bottom of cell)
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

    // s12-ui-05: programmatic ornate gold frame replaces slot-frame.webp
    // 3-stroke layered border + corner accent dots (mockup ornate frame style)
    const outerBorder = new Graphics()
      .roundRect(0, 0, REEL_W, REEL_H, T.RADIUS.md)
      .stroke({ width: 3, color: T.GOLD.shadow, alpha: 0.95 });
    this.addChild(outerBorder);

    const midBorder = new Graphics()
      .roundRect(2, 2, REEL_W - 4, REEL_H - 4, T.RADIUS.md - 1)
      .stroke({ width: 2, color: T.GOLD.base, alpha: 1.0 });
    this.addChild(midBorder);

    const innerBorder = new Graphics()
      .roundRect(5, 5, REEL_W - 10, REEL_H - 10, T.RADIUS.md - 2)
      .stroke({ width: 1, color: T.GOLD.glow, alpha: 0.7 });
    this.addChild(innerBorder);

    // Corner accent dots at 4 corners
    const cornerDots = [
      [4, 4], [REEL_W - 4, 4], [4, REEL_H - 4], [REEL_W - 4, REEL_H - 4],
    ];
    const corners = new Graphics();
    for (const [x, y] of cornerDots) {
      corners.circle(x, y, 2).fill({ color: T.GOLD.glow, alpha: 0.9 });
    }
    this.addChild(corners);

    // s12-ui-01c: programmatic L-bracket corner ornaments (no asset dependency)
    // Replaces dragon-corner.webp Sprite path (p10-bug-01 fallback promoted to primary)
    const positions: Array<[number, number, number, number]> = [
      [-8,          -8,          1,  1],   // top-left
      [REEL_W + 8,  -8,         -1,  1],   // top-right
      [-8,          REEL_H + 8,  1, -1],   // bottom-left
      [REEL_W + 8,  REEL_H + 8, -1, -1],  // bottom-right
    ];
    for (const [x, y, sx, sy] of positions) {
      const bracket = new Graphics()
        .moveTo(0, 24).lineTo(0, 0).lineTo(24, 0)
        .stroke({ width: 3, color: T.GOLD.shadow, alpha: 0.7 });
      bracket.x = x;
      bracket.y = y;
      bracket.scale.set(sx, sy);
      this.addChild(bracket);
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

        // p10-v02: inner accent ring — teal-cyan "glass frame" inside the outer border
        const innerRing = new Graphics()
          .roundRect(-CELL_W / 2 + 4, -CELL_H / 2 + 4, CELL_W - 8, CELL_H - 8, Math.max(T.RADIUS.sm - 2, 2))
          .stroke({ width: 1, color: T.SEA.caustic, alpha: 0.20 });
        container.addChild(innerRing);

        // p11-vA-03: gemBall Container — children rebuilt per-symbol in setCellSymbol()
        const gemBall = new Container();
        gemBall.x = 0;
        gemBall.y = 0;
        container.addChild(gemBall);

        // p10-v02: tier pip indicator — redrawn per-symbol in refreshCellPips()
        const pipsContainer = new Container();
        pipsContainer.x = 0;
        pipsContainer.y = CELL_H / 2 - 10;   // bottom of cell, 10px above edge
        container.addChild(pipsContainer);

        const overlay = new Graphics()
          .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
          .fill(0xffffff);
        overlay.alpha = 0;
        container.addChild(overlay);

        colCells.push({ container, gemBall, overlay, currentSymbol: -1, pipsContainer });
        this.setCellSymbol(colCells[r], r % SYMBOLS.length);
      }
      this.cells.push(colCells);
    }
  }

  /**
   * p11-vA-03: Programmatic glossy ball — replaces gem PNG sprite.
   * Rebuilds 4 children inside cell.gemBall each call:
   *   1. Drop shadow (slightly larger dark circle offset +2px Y)
   *   2. Main ball   (clan color fill + stroke)
   *   3. Highlight   (upper-left white ellipse for glossy effect)
   *   4. Chinese char (clan character, white fill + clan stroke)
   * GlowFilter applied to gemBall for depth glow effect.
   */
  private setCellSymbol(cell: Cell, symId: number): void {
    if (cell.currentSymbol === symId) return;
    cell.currentSymbol = symId;

    const visual = SYMBOL_VISUAL[symId] ?? SYMBOL_VISUAL[0]!;
    const r = Math.min(CELL_W, CELL_H) * 0.38;   // ball radius ≈ 38px

    // Clear previous ball contents
    cell.gemBall.removeChildren();

    // Layer 1: Drop shadow
    const shadow = new Graphics()
      .circle(0, 2, r + 1)
      .fill({ color: 0x000000, alpha: 0.50 });
    cell.gemBall.addChild(shadow);

    // Layer 2: Main ball (solid clan color)
    const main = new Graphics()
      .circle(0, 0, r)
      .fill({ color: visual.color, alpha: 1 });
    cell.gemBall.addChild(main);

    // Layer 3: Glossy highlight — small white ellipse upper-left
    const highlight = new Graphics()
      .ellipse(-r * 0.35, -r * 0.35, r * 0.45, r * 0.30)
      .fill({ color: 0xFFFFFF, alpha: 0.55 });
    cell.gemBall.addChild(highlight);

    // Layer 4: Chinese character centred on ball
    // White-clan symbols (id 2, 3): ball is 0xfff0b3 (light cream) — white text fails WCAG.
    // Use dark brown 0x4a3a1a instead (contrast ~7:1 vs cream, WCAG AAA).
    const isWhiteClan = symId === 2 || symId === 3;
    const charText = new Text({
      text: visual.char,
      style: {
        fontFamily: '"Noto Serif TC", "Ma Shan Zheng", serif',
        fontWeight: '700',
        fontSize: Math.round(r * 0.95),
        fill: isWhiteClan ? 0x4a3a1a : 0xFFFFFF,
        stroke: { color: visual.color, width: isWhiteClan ? 1 : 2 },
        dropShadow: {
          color: visual.color,
          alpha: isWhiteClan ? 0.4 : 0.6,
          blur: 6,
          distance: 0,
        },
      },
    });
    charText.anchor.set(0.5, 0.5);
    cell.gemBall.addChild(charText);

    // Subtle GlowFilter — clan color depth glow
    cell.gemBall.filters = [new GlowFilter({
      color: visual.color,
      distance: 12,
      outerStrength: 1.0,
      innerStrength: 0.2,
      quality: 0.4,
    })];

    // p10-v02: refresh tier pips for the new symbol (unchanged)
    this.refreshCellPips(cell, symId);
  }

  /**
   * p10-v02: Redraw tier pip indicator for a cell.
   * Pip count/color by symbol tier:
   *   special (Jackpot/Scatter/Curse/Wild) checked first, then ID range.
   * Uses T.SYM.low1 / mid1 / high1 (confirmed in DesignTokens — all exist).
   */
  private refreshCellPips(cell: Cell, symId: number): void {
    cell.pipsContainer.removeChildren();

    const sym = SYMBOLS[symId];
    let pipCount: number;
    let pipColor: number;

    if (sym.isJackpot)       { pipCount = 3; pipColor = T.GOLD.glow; }
    else if (sym.isScatter)  { pipCount = 2; pipColor = 0xff3b6b; }
    else if (sym.isCurse)    { pipCount = 1; pipColor = 0xc77fdb; }
    else if (sym.isWild)     { pipCount = 1; pipColor = T.GOLD.glow; }
    else if (symId <= 2)     { pipCount = 1; pipColor = T.SYM.low1; }
    else if (symId <= 5)     { pipCount = 2; pipColor = T.SYM.mid1; }
    else                     { pipCount = 3; pipColor = T.SYM.high1; }

    // Centered horizontal row: 3px radius pips, 4px gap between pip edges
    const pipR   = 3;
    const pipGap = 4;
    const totalW = pipCount * (pipR * 2) + (pipCount - 1) * pipGap;
    const startX = -(totalW / 2) + pipR;
    for (let i = 0; i < pipCount; i++) {
      const pip = new Graphics()
        .circle(startX + i * (pipR * 2 + pipGap), 0, pipR)
        .fill({ color: pipColor, alpha: 0.90 });
      cell.pipsContainer.addChild(pip);
    }
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

    // Existing overlay tint — kept for backwards-compat with other systems
    for (const cell of targets) {
      cell.overlay.clear()
        .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
        .fill(tint);
    }

    // d-06: win-frame sprite on each hit cell with shared GlowFilter pulse
    // One GlowFilter per pulseWay call; shared across frames in this wave —
    // multiple concurrent pulseWay calls each have their own isolated glow instance.
    const tex = Assets.get<Texture>('sos2-win-frame');
    const frames: Sprite[] = [];
    let glow: GlowFilter | null = null;
    if (tex && tex !== Texture.EMPTY) {
      glow = new GlowFilter({
        color: tint, distance: 8, outerStrength: 0, innerStrength: 0.3, quality: 0.4,
      });
      for (const cell of targets) {
        const f = new Sprite(tex);
        f.anchor.set(0.5);
        f.tint = tint;
        f.width  = CELL_W + 8;   // slight visual padding beyond cell boundary
        f.height = CELL_H + 8;
        f.alpha = 0;
        f.filters = [glow];       // share one filter instance — no per-frame rebuild
        cell.container.addChild(f);
        frames.push(f);
      }
    }

    // Pulse: overlay alpha + frame alpha + glow outerStrength all driven by Easings.pulse
    await tween(330, p => {
      const a = Easings.pulse(p);
      for (const cell of targets) cell.overlay.alpha = a * 0.7;
      if (glow && frames.length) {
        glow.outerStrength = a * 3.5;
        for (const f of frames) f.alpha = a;
      }
    });

    // Cleanup: restore overlay; destroy all frame sprites (unrefs glow filter)
    for (const cell of targets) {
      cell.overlay.alpha = 0;
      cell.overlay.clear()
        .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
        .fill(0xffffff);
    }
    for (const f of frames) f.destroy();
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
