import { Assets, BlurFilter, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
// gemForSymbol import removed — p11-vA-03: programmatic ball replaces gem sprite
import { tween, delay, Easings } from '@/systems/tween';
import type { WayHit } from '@/systems/SlotEngine';
import { AudioManager } from '@/systems/AudioManager';
// chore #200: shared gem helpers — SYMBOL_VISUAL / polygonPoints / shapeFor moved to GemSymbol
import { SYMBOL_VISUAL, polygonPoints, shapeFor } from '@/components/GemSymbol';

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

  // chore: light streak layer (gold strips top/bottom edges, visible during spin)
  private streakLayer?: Container;
  private streakA?: Graphics;
  private streakB?: Graphics;

  constructor() {
    super();
    this.buildFrame();
    this.buildCells();
    this.buildLightStreaks();
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

        // chore: rect mask clips BlurFilter/Y-slide overflow to cell bounds during spin.
        // Must be a child of container so it tracks container scale changes (popCell pulse, BackOut settle).
        const cellMask = new Graphics()
          .rect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H)
          .fill(0xffffff);
        container.addChild(cellMask);
        container.mask = cellMask;

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
   * Force-apply the default GlowFilter that setCellSymbol normally installs.
   * Called at spin lock sites to guarantee BlurFilter cleanup even when
   * setCellSymbol early-returns (finalSymbol === currentSymbol case).
   * Params mirror line 249 setCellSymbol — keep in sync if those change.
   */
  private resetGemBallFilter(cell: Cell): void {
    const visual = SYMBOL_VISUAL[cell.currentSymbol];
    if (!visual) return;
    cell.gemBall.filters = [new GlowFilter({
      color: visual.color,
      distance: 12,
      outerStrength: 1.0,
      innerStrength: 0.2,
      quality: 0.4,
    })];
  }

  /**
   * p11-vA-03: Programmatic glossy ball — replaces gem PNG sprite.
   * Rebuilds 4 children inside cell.gemBall each call:
   *   1. Drop shadow (shape-matched polygon/circle offset +4px Y — chore #199)
   *   2. Main gem    (4/5/6-sided or circle by tier + dark stroke — chore #199)
   *   3. Highlight   (upper-left white ellipse for gloss)
   *   4. Chinese char (spirit character, dark fill + gem stroke)
   * GlowFilter applied to gemBall for depth glow effect.
   */
  private setCellSymbol(cell: Cell, symId: number): void {
    if (cell.currentSymbol === symId) return;
    cell.currentSymbol = symId;

    const visual = SYMBOL_VISUAL[symId] ?? SYMBOL_VISUAL[0]!;
    const r = Math.min(CELL_W, CELL_H) * 0.38;   // gem radius ≈ 38px

    // Clear previous gem contents
    cell.gemBall.removeChildren();

    // chore #199: gem shape per tier — 4(diamond) / 5(pentagon) / 6(hexagon) / 0(circle for specials)
    const shape = shapeFor(symId);

    // Layer 1: Drop shadow (shape-matched, offset down)
    const shadow = new Graphics();
    if (shape.sides === 0) {
      shadow.circle(0, 4, r + 1).fill({ color: 0x000000, alpha: 0.50 });
    } else {
      shadow.poly(polygonPoints(0, 4, r + 1, shape.sides)).fill({ color: 0x000000, alpha: 0.50 });
    }
    cell.gemBall.addChild(shadow);

    // Layer 2: Main gem (unique spirit color + dark outline)
    const main = new Graphics();
    if (shape.sides === 0) {
      main.circle(0, 0, r).fill({ color: visual.color, alpha: 1 });
    } else {
      main.poly(polygonPoints(0, 0, r, shape.sides)).fill({ color: visual.color, alpha: 1 });
    }
    main.stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });
    cell.gemBall.addChild(main);

    // Layer 3: Glossy highlight — small white ellipse upper-left (works on all shapes)
    const highlight = new Graphics()
      .ellipse(-r * 0.35, -r * 0.35, r * 0.45, r * 0.30)
      .fill({ color: 0xFFFFFF, alpha: 0.55 });
    cell.gemBall.addChild(highlight);

    // Layer 4: Chinese character centred on ball
    // chore161: ALL ball use dark warm-brown 0x2a1a05 for unified contrast on glossy ball surface.
    // Contrast ratios vs clan glows: azure~10:1 / white~13:1 / vermilion~8:1 / black~10:1 /
    //   gold~11:1 / curse-purple(0xc77fe0)~5:1 / scatter-pink~4.5:1 — all ≥ WCAG AA (4.5:1).
    // chore: shrink fontSize for multi-char labels (e.g. "JP") so they fit inside the ball circle
    const isMultiChar = visual.char.length > 1;
    const charText = new Text({
      text: visual.char,
      style: {
        fontFamily: '"Noto Serif TC", "Ma Shan Zheng", serif',
        fontWeight: '700',
        fontSize: Math.round(r * (isMultiChar ? 0.65 : 0.95)),
        fill: 0x2a1a05,                               // dark warm-brown — all clans
        stroke: { color: visual.color, width: 1.5 },  // clan stroke matches ball color
        dropShadow: {
          color: visual.color,
          alpha: 0.5,
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

    // chore #197: ⭐ 5-point gold star pips (was circle dots) — RPG rarity feel
    // chore #199: bigger star (5→7 for visibility)
    const starOuterR  = 7;
    const starInnerR  = starOuterR * 0.4;
    const starSpacing = starOuterR * 2 + 2;   // tighter horizontal spacing
    const totalW = pipCount * (starOuterR * 2) + (pipCount - 1) * 2;
    const startX = -(totalW / 2) + starOuterR;

    for (let i = 0; i < pipCount; i++) {
      const star = new Graphics();
      // 5-point star: 10 vertices alternating outer/inner radius, start at 12 o'clock
      const cx = startX + i * starSpacing;
      const points: number[] = [];
      for (let v = 0; v < 10; v++) {
        const r = v % 2 === 0 ? starOuterR : starInnerR;
        const angle = (v / 10) * Math.PI * 2 - Math.PI / 2;
        points.push(cx + Math.cos(angle) * r, Math.sin(angle) * r);
      }
      star.poly(points).fill({ color: pipColor, alpha: 0.95 });
      star.stroke({ width: 0.5, color: 0x000000, alpha: 0.6 });   // dark outline for legibility on bright ball
      cell.pipsContainer.addChild(star);
    }
  }

  // ─── Light streaks ───────────────────────────────────────────────────────
  /** Gold strip bars at top/bottom edges of each column — fade in/out on spin. */
  private buildLightStreaks(): void {
    this.streakLayer = new Container();
    this.streakLayer.visible = false;
    this.addChild(this.streakLayer);

    this.streakA = new Graphics();
    this.streakB = new Graphics();

    for (let c = 0; c < COLS; c++) {
      const cx = FRAME_PAD + c * (CELL_W + CELL_GAP) + CELL_W / 2;
      // Top streak — just inside the top frame edge
      this.streakA
        .rect(cx - 8, FRAME_PAD - 4, 16, 12)
        .fill({ color: T.GOLD.glow, alpha: 1 });
      // Bottom streak — just inside the bottom frame edge
      this.streakB
        .rect(cx - 8, REEL_H - FRAME_PAD - 8, 16, 12)
        .fill({ color: T.GOLD.glow, alpha: 1 });
    }
    this.streakA.alpha = 0;
    this.streakB.alpha = 0;
    this.streakLayer.addChild(this.streakA);
    this.streakLayer.addChild(this.streakB);
  }

  // ─── Spin ────────────────────────────────────────────────────────────────
  /**
   * Spec (chore #192+#193): ALL 5 reels start simultaneously at t=0; stops staggered in 3 stages.
   *   R1+R5  lock at t ≈ 0.6 s  (fade 90ms + swap 510ms, lock = 600ms)
   *   R2+R4  lock at t ≈ 1.1 s  (fade 90ms + swap 1010ms, lock = 1100ms)
   *   R3     lock at t ≈ 1.6 s  (fade 90ms + swap 1520ms = 1610ms)
   *                              (pre-flash overlay parallel, 200/400ms — visual only, no lock impact)
   *                              (teaser: same lock t≈1610ms — pre-flash 400ms still parallel)
   *
   * Owner spec 2026-05-04: "大家一起轉，1+5 一起停，2+4 一起停，第 3 輪最後停"
   */
  async spin(finalGrid: number[][]): Promise<void> {
    // chore: light streak fade-in at spin start
    if (this.streakLayer) {
      this.streakLayer.visible = true;
      void tween(180, t => {
        if (this.streakA) this.streakA.alpha = t * 0.6;
        if (this.streakB) this.streakB.alpha = t * 0.6;
      });
    }

    // B4 teaser: if either outer/inner pair on one side shares a symbol,
    // escalate the center pre-flash to tease a possible 3-way.
    const teaser = hasPreMatch(finalGrid, 0, 1) || hasPreMatch(finalGrid, 4, 3);

    // chore #192+#193: ALL 5 reels start simultaneously; stops staggered in 3 stages
    // Stage 1 (t≈600ms):  cols 0+4 lock first  (fade 90 + swap 510)
    // Stage 2 (t≈1100ms): cols 1+3 lock second (fade 90 + swap 1010)
    // Stage 3 (t≈1610ms): col 2   locks last   (fade 90 + swap 1520; pre-flash overlay is parallel)
    const p04 = Promise.all([
      this.spinColumn(0, finalGrid, 510),     // lock t=600ms
      this.spinColumn(4, finalGrid, 510),
    ]);
    const p13 = Promise.all([
      this.spinColumn(1, finalGrid, 1010),    // chore #192: was 510, lock t=1100ms
      this.spinColumn(3, finalGrid, 1010),
    ]);
    // chore #193: pre-flash now parallel → fade(90)+swap(1520)=1610ms; was 200+90+310=600 from t=1000
    const p2 = this.spinColumnCenter(2, finalGrid, 1520, teaser);

    await Promise.all([p04, p13, p2]);

    // chore: light streak fade-out at spin end
    if (this.streakLayer) {
      await tween(180, t => {
        if (this.streakA) this.streakA.alpha = (1 - t) * 0.6;
        if (this.streakB) this.streakB.alpha = (1 - t) * 0.6;
      });
      this.streakLayer.visible = false;
    }
  }

  private async spinColumn(col: number, finalGrid: number[][], spinMs: number): Promise<void> {
    const colCells = this.cells[col];

    // Spin-up fade
    await tween(90, p => {
      for (const cell of colCells) cell.container.alpha = 1 - p * 0.35;
    });

    // Rapid symbol swap while spinning — chore: vertical slide illusion
    // Each swap: gemBall slides from -CELL_H (above) down to 0 (centre) in 65ms
    // chore: vertical motion blur active during spin (removed on lock by setCellSymbol)
    const blur = new BlurFilter({ strengthX: 0, strengthY: 16, quality: 2 });

    const stopAt = performance.now() + spinMs;
    while (performance.now() < stopAt) {
      const slideDur = 65;
      const slideStart = performance.now();

      // Reset gemBall to top of cell, then swap symbol
      for (const cell of colCells) cell.gemBall.y = -CELL_H;
      for (const cell of colCells) {
        this.setCellSymbol(cell, Math.floor(Math.random() * SYMBOLS.length));
        cell.gemBall.filters = [blur]; // re-apply after setCellSymbol resets to GlowFilter
      }

      // Slide down to centre within 65ms (~60fps sub-steps)
      while (performance.now() - slideStart < slideDur && performance.now() < stopAt) {
        const t = Math.min(1, (performance.now() - slideStart) / slideDur);
        for (const cell of colCells) cell.gemBall.y = -CELL_H * (1 - t);
        await delay(16);
      }
    }
    // Reset gemBall.y before lock — prevents position bleed into final symbol
    for (const cell of colCells) cell.gemBall.y = 0;

    // Lock to final
    for (let r = 0; r < ROWS; r++) {
      this.setCellSymbol(colCells[r], finalGrid[r][col]);
      this.resetGemBallFilter(colCells[r]); // chore: force BlurFilter cleanup (handles setCellSymbol early-return)
    }
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
    // chore #193: fire-and-forget — pre-flash overlay runs IN PARALLEL with swap (not before)
    // center col spins simultaneously with outer/inner; flash is purely cosmetic while reels turn
    void tween(flashMs, p => {
      const a = Easings.pulse(p) * flashPeak;
      for (const cell of colCells) cell.overlay.alpha = a;
    }).then(() => {
      for (const cell of colCells) {
        cell.overlay.alpha = 0;
        cell.overlay.clear()
          .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
          .fill(0xffffff);
      }
    });

    // Spin-up fade (proceeds immediately — does NOT wait for pre-flash)
    await tween(90, p => {
      for (const cell of colCells) cell.container.alpha = 1 - p * 0.35;
    });

    // Slow-mo symbol swap: 93ms per frame (0.7× speed) — chore: vertical slide illusion
    // chore: stronger vertical blur for centre column (more dramatic slow-mo feel)
    const blur = new BlurFilter({ strengthX: 0, strengthY: 22, quality: 2 });

    const stopAt = performance.now() + spinMs;
    while (performance.now() < stopAt) {
      const slideDur = 93;
      const slideStart = performance.now();

      // Reset gemBall to top of cell, then swap symbol
      for (const cell of colCells) cell.gemBall.y = -CELL_H;
      for (const cell of colCells) {
        this.setCellSymbol(cell, Math.floor(Math.random() * SYMBOLS.length));
        cell.gemBall.filters = [blur]; // re-apply after setCellSymbol resets to GlowFilter
      }

      // Slide down to centre within 93ms (~60fps sub-steps)
      while (performance.now() - slideStart < slideDur && performance.now() < stopAt) {
        const t = Math.min(1, (performance.now() - slideStart) / slideDur);
        for (const cell of colCells) cell.gemBall.y = -CELL_H * (1 - t);
        await delay(16);
      }
    }
    // Reset gemBall.y before lock
    for (const cell of colCells) cell.gemBall.y = 0;

    // Lock to final
    for (let r = 0; r < ROWS; r++) {
      this.setCellSymbol(colCells[r], finalGrid[r][col]);
      this.resetGemBallFilter(colCells[r]); // chore: force BlurFilter cleanup
    }
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

  // ─── Win-trace helpers ───────────────────────────────────────────────────

  /**
   * Pop all cells in each column sequentially (column 0 first, then 1, …).
   * Each column's cells pop in parallel; columns are awaited in order.
   */
  private async popCellSequence(
    targets: Cell[][],
    tint: number,
    stepMs: number = 100,
  ): Promise<void> {
    for (const colTargets of targets) {
      await Promise.all(colTargets.map(cell => this.popCell(cell, tint, stepMs)));
    }
  }

  /** Scale + glow pulse on a single cell. Restores state on completion. */
  private async popCell(cell: Cell, tint: number, durMs: number): Promise<void> {
    const baseScale = cell.container.scale.x;

    // Tint overlay
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(tint);

    // Temp glow — save/restore original gemBall filters (set by setCellSymbol)
    const savedFilters = cell.gemBall.filters ? [...cell.gemBall.filters] : null;
    const glow = new GlowFilter({
      color: tint, distance: 14, outerStrength: 2.5, innerStrength: 0.6, quality: 0.5,
    });
    cell.gemBall.filters = [glow];

    await tween(durMs, t => {
      const p = Easings.pulse(t);
      cell.container.scale.set(baseScale + 0.3 * p);
      cell.overlay.alpha = p * 0.7;
      glow.outerStrength = p * 4;
    });

    // Restore
    cell.container.scale.set(baseScale);
    cell.gemBall.filters = savedFilters;
    cell.overlay.alpha = 0;
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(0xffffff);
  }

  /**
   * Draw an animated arrow from one cell to another (SlotReel-local coords).
   * Starts a fire-and-forget 100ms fade-in and returns the Graphics ref for
   * the caller to manage cleanup (fade-out + destroy).
   */
  private drawArrow(from: Cell, to: Cell, tint: number): Graphics {
    const arrow = new Graphics();
    arrow.alpha = 0;
    this.addChild(arrow);

    const fx = from.container.x;
    const fy = from.container.y;
    const tx = to.container.x;
    const ty = to.container.y;
    const dx = tx - fx;
    const dy = ty - fy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len;
    const uy = dy / len;

    // Inset endpoints so line doesn't overlap cell centre markers
    const inset = 32;
    const sx = fx + ux * inset;
    const sy = fy + uy * inset;
    const ex = tx - ux * inset;
    const ey = ty - uy * inset;

    // Glow underlay (thick, semi-transparent)
    arrow
      .moveTo(sx, sy).lineTo(ex, ey)
      .stroke({ width: 8, color: tint, alpha: 0.35, cap: 'round' });

    // Main line
    arrow
      .moveTo(sx, sy).lineTo(ex, ey)
      .stroke({ width: 3, color: tint, alpha: 1, cap: 'round' });

    // Arrowhead triangle at endpoint
    const headSize = 14;
    const perpX = -uy;
    const perpY =  ux;
    arrow
      .moveTo(ex, ey)
      .lineTo(ex - ux * headSize + perpX * headSize * 0.5, ey - uy * headSize + perpY * headSize * 0.5)
      .lineTo(ex - ux * headSize - perpX * headSize * 0.5, ey - uy * headSize - perpY * headSize * 0.5)
      .closePath()
      .fill({ color: tint, alpha: 1 });

    // Fire-and-forget fade-in (runs concurrently with caller's popCell await)
    void tween(100, t => { arrow.alpha = t; });

    return arrow;
  }

  /**
   * Draw a ring frame around a winning cell. Returns the Graphics for
   * caller-managed cleanup (fades with arrows after hold).
   */
  private drawWinRing(cell: Cell, tint: number): Graphics {
    const ring = new Graphics();
    const r = Math.min(CELL_W, CELL_H) * 0.48; // slightly larger than ball radius

    // Outer glow underlay
    ring.circle(0, 0, r + 4)
      .stroke({ width: 6, color: tint, alpha: 0.30 });
    // Main stroke
    ring.circle(0, 0, r)
      .stroke({ width: 2.5, color: tint, alpha: 1 });

    ring.x = cell.container.x;
    ring.y = cell.container.y;
    ring.alpha = 0;
    ring.scale.set(1.15); // start slightly larger, pop-in to 1.0
    this.addChild(ring);

    // Fire-and-forget pop-in (concurrent with popCell)
    void tween(120, t => {
      ring.alpha = t;
      ring.scale.set(1.15 - 0.15 * t);
    }, Easings.easeOut);

    return ring;
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

    // Build targets indexed by column offset — targets[i] = cells at column (anchorCol + i*dir)
    const targets: Cell[][] = [];
    for (let offset = 0; offset < hit.hitCells.length; offset++) {
      const actualCol = anchorCol + offset * dir;
      targets.push(hit.hitCells[offset].map(row => this.cells[actualCol][row]));
    }

    // chore: sequential connect-the-dots trace — pop + ring per col, arrow between cols
    const arrows: Graphics[] = [];
    const rings:  Graphics[] = [];
    const STEP_MS = 100;

    for (let i = 0; i < targets.length; i++) {
      // Draw arrow from previous column rep-cell (skip on first column)
      if (i > 0) {
        arrows.push(this.drawArrow(targets[i - 1][0], targets[i][0], tint));
      }

      // Draw ring on every matched cell in this column (fire-and-forget pop-in)
      for (const cell of targets[i]) {
        rings.push(this.drawWinRing(cell, tint));
      }

      // Pop all matched cells in this column (concurrent with ring/arrow fade-in)
      await Promise.all(targets[i].map(c => this.popCell(c, tint, STEP_MS)));
    }

    // Hold final state — all rings + arrows visible
    await delay(300);

    // Fade out rings + arrows together, then destroy
    await tween(220, t => {
      for (const a of arrows) a.alpha = 1 - t;
      for (const r of rings)  r.alpha  = 1 - t;
    });
    for (const a of arrows) a.destroy();
    for (const r of rings)  r.destroy();
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
