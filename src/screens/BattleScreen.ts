import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import { SYMBOLS, PAYOUT_BASE, streakMult } from '@/config/SymbolsConfig';
import { buildFullPool, totalWeight } from '@/systems/SymbolPool';
import { SlotEngine } from '@/systems/SlotEngine';
import {
  createFormation, isTeamAlive, teamHpTotal, hasAliveOfClan, type FormationGrid,
} from '@/systems/Formation';
import { distributeDamage, type DmgEvent } from '@/systems/DamageDistributor';
import { tween, tweenValue, delay, Easings } from '@/systems/tween';
import { SlotReel, REEL_W, REEL_H } from './SlotReel';
import { UiButton } from '@/components/UiButton';
import { addCornerOrnaments } from '@/components/Decorations';
import type { DraftResult } from './DraftScreen';
import { attackTimeline } from './SpiritAttackChoreographer';
import type { WayHit, SpinResult } from '@/systems/SlotEngine';
import { mercenaryWeakFx } from '@/fx/MercenaryFx';
import { AmbientBackground } from './AmbientBackground';
import { VsBadgeAnimator } from '@/fx/VsBadgeAnimator';
import { goldText } from '@/components/GoldText';
import { AmbientParticles } from '@/fx/AmbientParticles';
import { AudioManager } from '@/systems/AudioManager';
import { FXAtlas } from '@/fx/FXAtlas';
import { detectResonance, resonanceMultForClan, type ResonanceResult } from '@/systems/Resonance';
import type { ClanId } from '@/config/DesignTokens';
import { GlowFilter } from 'pixi-filters';
import {
  loadPools, savePools, accrueOnBet, resetPool,
  type JackpotPools,
} from '@/systems/JackpotPool';
import { playJackpotCeremony } from '@/fx/JackpotCeremony';
import { playNearWinTeaser } from '@/fx/NearWinTeaser';
import { playBigWinCeremony } from '@/fx/BigWinCeremony';
import { playFreeSpinEntryCeremony } from '@/fx/FreeSpinEntryCeremony';
import type { MatchResult, MatchOutcome } from '@/screens/ResultScreen';

// ─── Portrait layout 720×1280 — Variant A (p11-vA-01) ───────────────────────

// ── Compact header (unchanged from v-01) ────────────────────────────────────
const COMPACT_HDR_H = 54;   // compact header height

// ── p11-vA-01: JP HERO zone (y=70-220) ──────────────────────────────────────
const JP_LABEL_Y   = 70;    // "— THE POOL OF EIGHT SEAS —" label y
const JP_MARQUEE_Y = 88;    // hero panel top (label height + gap)
const JP_MARQUEE_H = 132;   // hero panel height → bottom at y=220

// ── p11-vA-01: Zone separator 「戰」 (y=262) ────────────────────────────────
const ZONE_SEP_Y   = 262;   // hairline + 「戰」 character center y

// ── p11-vA-01: Battle arena (y=285-595, 310px) ──────────────────────────────
const ARENA_TOP_Y  = 285;   // arena container top y
const ARENA_HEIGHT = 310;   // arena container height

// Slot reel — centred, below arena
const SLOT_X      = Math.round((CANVAS_WIDTH - REEL_W) / 2);
const REEL_ZONE_Y  = 615;   // p11-vA-01: was 700 (Variant B)

// Log panel pinned below reel zone
const LOG_Y        = 1055;  // p11-vA-01: was 1100
const LOG_H_CONST  = 185;   // p11-vA-01: was 140

const ROUND_GAP_MS = 500; // pause between rounds

// ── chore: SPIN button (manual spin replaces auto-loop) ─────────────────────
const SPIN_BTN_Y = 970;
const SPIN_BTN_W = 200;
const SPIN_BTN_H = 60;

// ── chore: AUTO + SKIP ghost buttons (mockup variant-a alignment) ───────────
const SPIN_BTN_GAP = 16;
const GHOST_BTN_W  = 110;
const GHOST_BTN_H  = 46;

// ── chore: PAYLINES decorative indicator (mockup variant-a alignment) ────────
const PAYLINES_Y      = 935;   // just above SPIN_BTN_Y=970
const PAYLINES_CELL_W = 14;
const PAYLINES_CELL_H = 14;
const PAYLINES_GAP    = 4;

// ─── NineGrid 3×3 formation layout (p11-vA-02) ──────────────────────────────
// 9 cells per side; 5 spirits placed via seeded Fisher-Yates at mount time.
// Depth scale: row 0 (back) = 0.78 × SPIRIT_H, row 1 (mid) = 0.94 ×, row 2 (front) = 1.10 ×
const SPIRIT_H           = 130;                              // source sprite height (px) at scale 1.0
const NINE_CELL_SIZE     = 80;                               // cell square side (px)
const NINE_GAP           = 24;                               // gap between cells (px) — chore: 4→24 for row/col separation
const NINE_STEP          = NINE_CELL_SIZE + NINE_GAP;        // = 104 px per cell step
const NINE_GRID_TOTAL    = 3 * NINE_CELL_SIZE + 2 * NINE_GAP; // = 288 px grid total width/height
const NINE_GRID_TOP_Y    = 305;                              // grid top y (arena 285 + 20 label pad)
const NINE_A_GRID_LEFT_X = 32;                               // A side grid left edge x
const NINE_B_GRID_LEFT_X = CANVAS_WIDTH - NINE_GRID_TOTAL - 32; // B side = 720-288-32 = 400

// Per-unit HP bar (inside each spirit container)
const UNIT_HP_BAR_W     = 64;
const UNIT_HP_BAR_H     = 6;
// HP bar y offset: above cell top edge (cell center is anchor, cell top is -NINE_CELL_SIZE/2)
const UNIT_HP_BAR_Y_OFF = -(NINE_CELL_SIZE / 2) - 10;       // above cell top by 10px

// ─── Components for formation display ────────────────────────────────────────
interface FormationCellRefs {
  container: Container;
  sprite:    Sprite | null;   // full-body spirit (anchor 0.5,1 = bottom-centre)
  hpTrack:   Graphics;        // static HP bar background
  hpFill:    Graphics;        // dynamic HP bar fill (redrawn in refreshFormation)
  glowRing:  Graphics;        // ground ellipse glow (breathes via ticker)
  crossMark: Graphics;
}

export class BattleScreen implements Screen {
  private app!: Application;
  private bg!: AmbientBackground;
  private particles!: AmbientParticles;
  private vsBadge?: VsBadgeAnimator;    // p10-v01: optional — VS shield is now static in drawBattleArena
  private container = new Container();
  private roundText!: Text;
  /** p10-v01: compact header containers */
  private roundPill!: Container;
  private _breatheTick: (() => void) | null = null;
  private cellsA: FormationCellRefs[] = [];
  private cellsB: FormationCellRefs[] = [];
  /** p11-vA-02: NineGrid — which of the 9 cells (0-8) each side's 5 spirits occupy */
  private gridPlacementA: number[] = [];
  private gridPlacementB: number[] = [];
  private walletA = 10000;
  private walletB = 10000;
  private displayedWalletA = 10000;
  private displayedWalletB = 10000;
  private walletTextA!: Text;
  private walletTextB!: Text;
  private logText!: Text;
  /** JP marquee live counter texts (j-05) — dynamic from this.jackpotPools */
  private jpMinorText!: Text;
  private jpMajorText!: Text;
  private jpGrandText!: Text;
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
  /** Consecutive non-miss spin count per side — drives SPEC §15 M3 Streak Multiplier */
  private streakA = 0;
  private streakB = 0;
  /** SPEC §15.5 M5 Resonance tier for each side (computed once at match start) */
  private resonanceA!: ResonanceResult;
  private resonanceB!: ResonanceResult;
  /** SPEC §15.6 M6 Curse — accumulated stacks per side (reset on match end in k-03) */
  private curseStackA = 0;
  private curseStackB = 0;
  /** Curse stack HUD containers (k-04) */
  private curseHudA!: Container;
  private curseHudAText!: Text;
  private curseHudB!: Container;
  private curseHudBText!: Text;
  /** SPEC §15.7 M10 Free Spin state — shared (both sides enter together via shared 5×3 grid) */
  private inFreeSpin = false;
  private freeSpinsRemaining = 0;
  private static readonly FREE_SPIN_COUNT = 5;
  private static readonly FREE_SPIN_WIN_MULT = 2;
  private static readonly BIGWIN_THRESHOLD_X  = 25;   // 25× bet → BigWin
  private static readonly MEGAWIN_THRESHOLD_X = 100;  // 100× bet → MegaWin
  // ── pace-01: Sequenced reveal timing (轉輪 → 對獎 → 出招 → 算傷害) ──────
  private static readonly PACE_AFTER_REEL_STOP = 700;  // 轉輪停 → 對獎
  private static readonly PACE_AFTER_REVEAL    = 400;  // 對獎 → 出招
  private static readonly PACE_AFTER_ATTACK    = 300;  // 出招 → 傷害
  private static readonly PACE_AFTER_DAMAGE    = 300;  // 傷害 → 下一回合
  /** p-02: demo mode — ?demo=1 URL param enables scripted 5-spin capture sequence */
  private demoMode = false;
  private demoSpinIndex = 0;
  private static readonly DEMO_SPIN_COUNT = 5;
  /**
   * p-02: 5 scripted grids for demo capture, in order:
   *   spin 0: NearWin  — sym0 covers cols 0,1,2,4 (col 3 missing)
   *   spin 1: BigWin   — sym4 5-of-a-kind numWays=8 + Wild×2 → ~34x bet
   *   spin 2: MegaWin  — sym4 5-of-a-kind numWays=48 + Wild×2 → ~202x bet
   *   spin 3: Jackpot  — sym11 (JP) in all 5 cols → triggers JP draw
   *   spin 4: FreeSpin — 3× scatter (sym10) spread across cols 0,2,4
   *
   * Grid format: 3 rows × 5 cols. Symbol IDs per SymbolsConfig:
   *   0-7: spirits | 8: Wild | 9: Curse | 10: Scatter | 11: Jackpot
   * coinScale≈0.017, so rare sym4 (w=8) needs numWays boost + Wild for thresholds.
   */
  private static readonly DEMO_GRIDS: number[][][] = [
    // Spin 0: NearWin — sym0 in cols 0,1,2,4 → coveredCols.size=4, missingCol=3
    [[0, 0, 0, 5, 0],
     [3, 1, 7, 6, 0],
     [0, 4, 0, 2, 0]],

    // Spin 1: BigWin — sym4 5-of-a-kind, numWays=8, Wild in col1 → ~34x bet
    [[4, 8, 4, 4, 4],
     [4, 4, 4, 1, 0],
     [0, 0, 0, 0, 0]],

    // Spin 2: MegaWin — sym4 5-of-a-kind, numWays=48, Wild in col1 → ~202x bet
    [[4, 8, 4, 4, 4],
     [4, 4, 4, 4, 4],
     [4, 0, 0, 0, 0]],

    // Spin 3: Jackpot — sym11 in all 5 cols → 5-of-a-kind JP trigger
    [[11, 11, 11, 11, 11],
     [3,   4,  5,  6,  7],
     [2,   0,  1,  6,  3]],

    // Spin 4: FreeSpin — 3 scatter (sym10) across cols 0,2,4 → free spin entry
    [[10, 3, 10, 6, 10],
     [4,  5,  7, 1,  2],
     [3,  6,  4, 2,  5]],
  ];
  /** DEV-only key handler for manual Free Spin trigger (removed on unmount) */
  private _devKeyHandler?: (e: KeyboardEvent) => void;
  /** Free Spin UI overlay (f-04) */
  private freeSpinBanner?: Container;
  private freeSpinBannerText?: Text;
  private freeSpinTint?: Graphics;
  private wasInFreeSpin = false;          // edge detector: enter / exit transitions
  private prevFreeSpinsRemaining = 0;     // detect retrigger jumps (freeSpinsRemaining went UP)
  /** chore: manual SPIN button — resolves waitForSpinClick() promise */
  private spinButton!: Container;
  private spinButtonBg!: Graphics;
  private spinButtonText!: Text;
  private spinButtonSubText!: Text;
  private spinClickResolve: (() => void) | null = null;
  /** chore: AUTO + SKIP ghost buttons */
  private autoButton!: Container;
  private autoButtonBg!: Graphics;     // stored for active-state border repaint
  private autoButtonText!: Text;       // stored for label updates (STOP N / AUTO)
  private skipButton!: Container;
  private autoSpinsRemaining = 0;      // 0 = AUTO off; >0 = counting down
  private autoMenuOpen = false;
  private autoMenuContainer?: Container;
  /** chore: PAYLINES decorative indicator */
  private paylinesContainer!: Container;
  private paylinesCells: Graphics[] = [];
  /** SPEC §15.8 M12 Jackpot pools — loaded from localStorage on mount, saved each spin (j-02) */
  private jackpotPools!: JackpotPools;

  /** res-01: cumulative damage tracking */
  private totalDmgDealtAtoB = 0;
  private totalDmgDealtBtoA = 0;
  private startWalletA = 0;
  private startWalletB = 0;
  private matchStartMs = 0;

  constructor(private cfg: DraftResult, private onMatchEnd: (result?: MatchResult) => void) {}

  // ─── Screen lifecycle ────────────────────────────────────────────────────
  async onMount(app: Application, stage: Container): Promise<void> {
    // p-02: demo mode — ?demo=1 enables scripted 5-spin capture sequence
    const params = new URLSearchParams(window.location.search);
    this.demoMode = params.get('demo') === '1';
    if (this.demoMode) {
      console.log('[Demo] mode active — scripted 5-spin capture sequence');
    }

    this.app = app;
    await AudioManager.init();
    AudioManager.playBgm('battle', true);
    this.bg = new AmbientBackground(app);
    stage.addChild(this.bg);
    this.particles = new AmbientParticles(app);
    stage.addChild(this.particles);
    stage.addChild(this.container);
    this.container.sortableChildren = true;   // p10-bug-01: enable zIndex respect (Pixi 8 requires explicit opt-in)
    // chore: Pixi 8 EventSystem requires stage to be 'static' for pointer events to propagate to children
    app.stage.eventMode = 'static';
    this.formationA = createFormation(this.cfg.selectedA, this.cfg.unitHpA);
    this.formationB = createFormation(this.cfg.selectedB, this.cfg.unitHpB);
    this.resonanceA = detectResonance(this.cfg.selectedA);
    this.resonanceB = detectResonance(this.cfg.selectedB);
    this.walletA = this.cfg.walletA ?? 10000;
    this.walletB = this.cfg.walletB ?? 10000;
    this.displayedWalletA = this.walletA;
    this.displayedWalletB = this.walletB;

    this.drawBackground();
    addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 130, 0.25);  // p10-v03: de-gold P1-C (0.55→0.25)
    this.drawCompactHeader();  // p10-v01: replaces drawTopBar + drawHeader + drawWallets
    this.jackpotPools = loadPools();
    if (import.meta.env.DEV) {
      const _t = accrueOnBet({ minor: 100, major: 100, grand: 100 }, 200);
      console.assert(Math.abs(_t.minor - 101) < 0.001, 'JackpotPool accrueOnBet minor');
      console.assert(Math.abs(_t.major - 100.6) < 0.001, 'JackpotPool accrueOnBet major');
      console.assert(Math.abs(_t.grand - 100.4) < 0.001, 'JackpotPool accrueOnBet grand');
    }
    this.drawJackpotMarquee();
    this.refreshJackpotMarquee();   // j-05: show loaded pool values immediately
    this.drawZoneSeparator();       // p11-vA-01: 「戰」 gold separator line between JP hero and arena
    this.drawBattleArena();         // p11-vA-01: 310px arena (was 520px Variant B)
    // p11-vA-02: seed NineGrid placements before drawing formation
    const seedBase = performance.now().toString();
    this.gridPlacementA = this.computeGridPlacement(`${seedBase}-A`);
    this.gridPlacementB = this.computeGridPlacement(`${seedBase}-B`);
    if (import.meta.env.DEV) {
      console.log(`[NineGrid] A placement: [${this.gridPlacementA.join(',')}]`);
      console.log(`[NineGrid] B placement: [${this.gridPlacementB.join(',')}]`);
    }
    this.drawSpiritShadows();    // chore: moved here from drawBackground() so shadows use seeded placement
    this.drawFormation('A');
    this.drawFormation('B');
    this.drawReelHeader();          // chore: ● A · YOUR TURN | ◇ SHARED BOARD ◇ | B · WAITING ○
    this.drawSlot();
    // drawVsBadge() removed — VS shield lives inside drawBattleArena (p10-v01)
    this.drawLog();
    this.drawSpinButton();          // chore: manual SPIN button (replaces auto-loop)
    this.drawPaylinesIndicator();   // chore: PAYLINES 1-10 decorative indicator
    // drawBackButton() removed — RETREAT button lives inside drawCompactHeader (p10-v01)
    this.drawCurseHud();
    this.drawFreeSpinOverlay();
    this.container.addChild(this.fxLayer);  // fx on top
    this.refresh();
    this._breatheTick = () => {
      const t = performance.now();
      const breatheAlpha = 0.25 + (Math.sin(t / 600) * 0.5 + 0.5) * 0.40;
      for (const ref of [...this.cellsA, ...this.cellsB]) {
        if (ref.glowRing.visible) ref.glowRing.alpha = breatheAlpha;
      }
    };
    this.app.ticker.add(this._breatheTick);
    void this.playResonanceBanner();  // fire-and-forget — BGM starts immediately, banner floats independently
    if (import.meta.env.DEV) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'f' || e.key === 'F') {
          this.inFreeSpin = true;
          this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
          console.log('[FreeSpin] DEV manual trigger — 5 spins, ×2 multiplier');
        }
        if (e.key === 'j' || e.key === 'J') {
          // DEV: draw tier using j-03 weights and play ceremony (j-04)
          const r = Math.random();
          const tier: 'grand' | 'major' | 'minor' = r < 0.03 ? 'grand' : r < 0.15 ? 'major' : 'minor';
          const amount = this.jackpotPools[tier];
          console.log(`[Jackpot] DEV manual trigger — tier=${tier} amount=${amount}`);
          void playJackpotCeremony(this.container, tier, amount);
        }
      };
      window.addEventListener('keydown', onKey);
      this._devKeyHandler = onKey;
    }
    // res-01: capture starting wallet and match start time for ResultScreen
    this.startWalletA = this.walletA;
    this.startWalletB = this.walletB;
    this.matchStartMs = performance.now();

    void this.loop();
  }

  // p10-v01: drawVsBadge() retired — VS shield now lives inside drawBattleArena()

  // ── p11-vA-01: Battle arena 310px (Variant A) ────────────────────────────
  // Compact warm-bed (285→595) + perspective floor + side labels + circle VS at y=415
  private drawBattleArena(): void {
    const ARENA_BOT = ARENA_TOP_Y + ARENA_HEIGHT;   // 285 + 310 = 595

    // ── Warm bed background ───────────────────────────────────────────────
    const bedPad = 14;
    const bed = new Graphics()
      .roundRect(bedPad, ARENA_TOP_Y + 8, CANVAS_WIDTH - bedPad * 2, ARENA_HEIGHT - 8, 8)
      .fill({ color: 0x061A33, alpha: 0.65 })
      .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.30 });
    const warmGlow = new Graphics()
      .ellipse(CANVAS_WIDTH / 2, ARENA_BOT - 30, 200, 60)
      .fill({ color: 0xF5B82A, alpha: 0.04 });
    this.container.addChild(bed);
    this.container.addChild(warmGlow);

    // ── Perspective floor lines (compact — fits 310px window) ─────────────
    // floorTop below mid-row cells: mid cell bottom = NINE_GRID_TOP_Y + 2*NINE_STEP (≈473)
    const floorTop  = NINE_GRID_TOP_Y + 2 * NINE_STEP;  // ≈473: below mid-row cell bottom
    const floorBot  = ARENA_BOT - 10;             // ≈585
    const floorH    = floorBot - floorTop;
    const vanishX   = CANVAS_WIDTH / 2;
    const lPad      = bedPad + 4;
    const rPad      = CANVAS_WIDTH - lPad;

    const floorLines = new Graphics();
    const NUM_RADIAL = 9;
    for (let i = 0; i <= NUM_RADIAL; i++) {
      const bottomX  = lPad + ((rPad - lPad) / NUM_RADIAL) * i;
      const isCenter = i === Math.floor(NUM_RADIAL / 2);
      floorLines.moveTo(vanishX, floorTop).lineTo(bottomX, floorBot);
      floorLines.stroke({ width: isCenter ? 1.5 : 1, color: T.GOLD.shadow, alpha: isCenter ? 0.50 : 0.25 });
    }
    const hBandTs = [0.25, 0.55, 0.85];
    const hBands = new Graphics();
    for (const t of hBandTs) {
      const y  = floorTop + floorH * t * t;
      const xL = vanishX - (vanishX - lPad) * t * t;
      const xR = vanishX + (rPad - vanishX) * t * t;
      hBands.moveTo(xL, y).lineTo(xR, y);
      hBands.stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.22 + t * 0.15 });
    }
    this.container.addChild(floorLines);
    this.container.addChild(hBands);

    // ── Side labels (A · 我方 / 對手 · B) ────────────────────────────────
    const labelY  = ARENA_TOP_Y + 10;
    const labelH  = 24;

    const bannerABg = new Graphics()
      .rect(bedPad + 14, labelY, 160, labelH)
      .fill({ color: T.CLAN.azureGlow, alpha: 0.06 });
    const bannerAAccent = new Graphics()
      .rect(bedPad + 14, labelY, 2, labelH)
      .fill({ color: T.CLAN.azureGlow, alpha: 0.9 });
    this.container.addChild(bannerABg);
    this.container.addChild(bannerAAccent);

    const bannerAText = new Text({
      text: 'A · 我方',
      style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 11, fill: T.CLAN.azureGlow, letterSpacing: 3 },
    });
    bannerAText.anchor.set(0, 0.5);
    bannerAText.x = bedPad + 22;
    bannerAText.y = labelY + labelH / 2;
    this.container.addChild(bannerAText);

    const bannerBBg = new Graphics()
      .rect(CANVAS_WIDTH - bedPad - 14 - 160, labelY, 160, labelH)
      .fill({ color: T.CLAN.vermilionGlow, alpha: 0.06 });
    const bannerBAccent = new Graphics()
      .rect(CANVAS_WIDTH - bedPad - 16, labelY, 2, labelH)
      .fill({ color: T.CLAN.vermilionGlow, alpha: 0.9 });
    this.container.addChild(bannerBBg);
    this.container.addChild(bannerBAccent);

    const bannerBText = new Text({
      text: '對手 · B',
      style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 11, fill: T.CLAN.vermilionGlow, letterSpacing: 3 },
    });
    bannerBText.anchor.set(1, 0.5);
    bannerBText.x = CANVAS_WIDTH - bedPad - 22;
    bannerBText.y = labelY + labelH / 2;
    this.container.addChild(bannerBText);

    // ── VS — circle at arena center, between A and B grids ──────────────
    // A grid right edge: NINE_A_GRID_LEFT_X + NINE_GRID_TOTAL = 280
    // B grid left edge:  NINE_B_GRID_LEFT_X = 440   → VS at x=360 (canvas center) is safe
    // y=415: between back-row top (305+40=345) and mid-row center (305+84+40=429)
    const vsCenterX = CANVAS_WIDTH / 2;
    const vsCenterY = ARENA_TOP_Y + 130;   // 285 + 130 = 415

    const vsCircle = new Graphics()
      .circle(vsCenterX, vsCenterY, 25)
      .fill({ color: 0x0d2547, alpha: 0.95 })
      .stroke({ width: 1.5, color: T.GOLD.base, alpha: 1 });
    this.container.addChild(vsCircle);

    const vsText = goldText('VS', { fontSize: 16, withShadow: true });
    vsText.anchor.set(0.5, 0.5);
    vsText.x = vsCenterX;
    vsText.y = vsCenterY;
    vsText.filters = [new GlowFilter({
      color: 0xFFD37A, distance: 8, outerStrength: 1.8, innerStrength: 0.3, quality: 0.4,
    })];
    this.container.addChild(vsText);
  }

  onUnmount(): void {
    this.running = false;
    AudioManager.stopBgm();
    this.vsBadge?.destroy();   // p10-v01: optional — VS is static in Variant B
    // chore: clear AUTO mode + menu on unmount
    this.stopAutoMode();
    this.closeAutoMenu();
    this.bg.destroyLayers();
    this.bg.destroy({ children: true });
    this.particles.destroy({ children: true });
    if (this._breatheTick) {
      this.app.ticker.remove(this._breatheTick);
      this._breatheTick = null;
    }
    if (this._devKeyHandler) {
      window.removeEventListener('keydown', this._devKeyHandler);
      this._devKeyHandler = undefined;
    }
    this.container.destroy({ children: true });
    this.cellsA = [];
    this.cellsB = [];
  }

  // ─── Build UI ────────────────────────────────────────────────────────────
  // v-03: dispatches to visual sub-layers (drawSpiritShadows moved out — needs placement seed first)
  // chore/visual: removed drawGridOverlay() + drawEdgeVignette() — not present in mockup variant-a
  private drawBackground(): void {
    this.drawPerspectiveFloor();
    // NOTE: drawSpiritShadows() is called separately in onMount AFTER gridPlacementA/B are seeded
  }

  /** Solid base is provided by AmbientBackground; this layer adds the water-ink grid. */
  private drawGridOverlay(): void {
    const grid = new Graphics();
    for (let x = 0; x < CANVAS_WIDTH; x += 40) grid.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT);
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) grid.moveTo(0, y).lineTo(CANVAS_WIDTH, y);
    grid.stroke({ width: 1, color: T.SEA.deep, alpha: 0.25 });
    this.container.addChild(grid);
  }

  /** 8 radial lines from a vanishing point above the arena + 3 horizontal depth bands.
   *  p10-v01: background grid floor only — detailed arena floor is in drawBattleArena(). */
  private drawPerspectiveFloor(): void {
    // Horizon aligns with back-row cell top: NINE_GRID_TOP_Y + 0*NINE_STEP = 305; subtract 30 for perspective
    const horizonY  = NINE_GRID_TOP_Y - 30;  // p11-vA-02: align horizon with NineGrid back-row top
    const vanishX   = CANVAS_WIDTH / 2;
    const bottomY   = CANVAS_HEIGHT;
    const goldColor = T.GOLD.shadow;

    // 8 radial convergence lines
    const floor = new Graphics();
    for (let i = 0; i <= 8; i++) {
      const bottomX = (CANVAS_WIDTH / 8) * i;
      floor.moveTo(vanishX, horizonY).lineTo(bottomX, bottomY);
    }
    floor.stroke({ width: 1, color: goldColor, alpha: 0.15 });

    // 3 horizontal depth bands (wider towards bottom = closer)
    const hBands = new Graphics();
    for (let i = 1; i <= 3; i++) {
      const t        = i / 4;
      const y        = horizonY + (bottomY - horizonY) * t;
      const halfW    = (CANVAS_WIDTH / 2) * (0.4 + t * 0.6);
      hBands.moveTo(vanishX - halfW, y).lineTo(vanishX + halfW, y);
    }
    hBands.stroke({ width: 1, color: goldColor, alpha: 0.20 });

    this.container.addChild(floor);
    this.container.addChild(hBands);
  }

  /** 4-corner concentric ellipse stack to simulate a radial edge vignette. */
  private drawEdgeVignette(): void {
    const cornerSize = 180;
    const corners: Array<[number, number]> = [
      [0, 0],
      [CANVAS_WIDTH, 0],
      [0, CANVAS_HEIGHT],
      [CANVAS_WIDTH, CANVAS_HEIGHT],
    ];
    for (const [cx, cy] of corners) {
      const v = new Graphics();
      for (let i = 0; i < 6; i++) {
        const r     = cornerSize * (i + 1) / 6;
        const alpha = 0.06 * (6 - i);   // outer = 0.36, steps down to ~0.06 at centre
        v.circle(cx, cy, r).fill({ color: 0x0D1421, alpha });
      }
      this.container.addChild(v);
    }
  }

  /**
   * p11-vA-02: Ground shadows derived dynamically from NineGrid placement.
   * One ellipse per occupied cell — size and alpha scale with depth (row 0=small/faint, row 2=large/dark).
   * Called AFTER gridPlacementA/B are seeded in onMount.
   */
  private drawSpiritShadows(): void {
    const shadow = new Graphics();
    for (const side of ['A', 'B'] as const) {
      for (let slot = 0; slot < 5; slot++) {
        const pos      = this.slotToArenaPos(side, slot);
        // Ellipse dimensions scale with depth
        const ellipseW = 28 * pos.scale;
        const ellipseH = 6  * pos.scale;
        const alpha    = 0.25 + pos.scale * 0.15;   // 0.36 (back) → 0.41 (mid) → 0.45 (front)
        // Shadow sits at cell bottom (feet position): container y + NINE_CELL_SIZE/2
        const shadowY  = pos.y + NINE_CELL_SIZE / 2 + 2;
        shadow.ellipse(pos.x, shadowY, ellipseW, ellipseH).fill({ color: 0x000000, alpha });
      }
    }
    this.container.addChild(shadow);
  }

  // ── p10-v01: Compact header (Variant B) ──────────────────────────────────────
  // Layout: [← RETREAT]  [ROUND pill]  [A label+amount | B label+amount]
  private drawCompactHeader(): void {
    const hdr = new Container();
    hdr.zIndex = 80;

    // Background: two-tone gradient simulation (dark navy)
    const bgTop = new Graphics()
      .rect(0, 0, CANVAS_WIDTH, COMPACT_HDR_H * 0.55)
      .fill({ color: 0x003264, alpha: 0.95 });
    const bgBot = new Graphics()
      .rect(0, COMPACT_HDR_H * 0.55, CANVAS_WIDTH, COMPACT_HDR_H * 0.45)
      .fill({ color: 0x001E3C, alpha: 0.80 });
    // Bottom hairline separator
    const border = new Graphics()
      .rect(0, COMPACT_HDR_H - 1, CANVAS_WIDTH, 1)
      .fill({ color: T.GOLD.shadow, alpha: 0.4 });
    hdr.addChild(bgTop, bgBot, border);

    const midY = COMPACT_HDR_H / 2;

    // Left: ← RETREAT button
    const retreatBg = new Graphics()
      .roundRect(0, 0, 100, 30, 4)
      .fill({ color: 0x000000, alpha: 0.25 })
      .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.3 });
    retreatBg.x = 16;
    retreatBg.y = midY - 15;
    hdr.addChild(retreatBg);

    const retreatLabel = new Text({
      text: '← RETREAT',
      style: { fontFamily: T.FONT.body, fontSize: 11, fill: T.FG.muted, letterSpacing: 2 },
    });
    retreatLabel.anchor.set(0.5, 0.5);
    retreatLabel.x = 16 + 50;
    retreatLabel.y = midY;
    retreatBg.eventMode = 'static';
    retreatBg.cursor = 'pointer';
    retreatBg.on('pointertap', () => this.onMatchEnd());
    hdr.addChild(retreatLabel);

    // Center: ROUND pill
    this.roundPill = new Container();
    this.roundPill.x = CANVAS_WIDTH / 2;
    this.roundPill.y = midY;

    const pillBg = new Graphics()
      .roundRect(-52, -14, 104, 28, 14)
      .fill({ color: 0x000000, alpha: 0.4 })
      .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
    this.roundPill.addChild(pillBg);

    this.roundText = goldText('ROUND 00', { fontSize: 14, withShadow: true });
    this.roundText.anchor.set(0.5, 0.5);
    this.roundText.style.letterSpacing = 2;
    this.roundPill.addChild(this.roundText);
    hdr.addChild(this.roundPill);

    // Right: wallet A + B side-by-side (compact, 8pt label + 13pt amount)
    // Player A — inner slot (closer to centre)
    const walletAX = CANVAS_WIDTH - 132;
    const walletBX = CANVAS_WIDTH - 50;

    const labelA = new Text({
      text: 'A',
      style: { fontFamily: T.FONT.body, fontSize: 8, fill: T.CLAN.azureGlow, letterSpacing: 2 },
    });
    labelA.anchor.set(0.5, 1);
    labelA.x = walletAX;
    labelA.y = midY - 1;
    hdr.addChild(labelA);

    this.walletTextA = goldText(this.formatWallet(this.walletA), { fontSize: 13, withShadow: false });
    this.walletTextA.anchor.set(0.5, 0);
    this.walletTextA.x = walletAX;
    this.walletTextA.y = midY + 1;
    hdr.addChild(this.walletTextA);

    const labelB = new Text({
      text: 'B',
      style: { fontFamily: T.FONT.body, fontSize: 8, fill: T.CLAN.vermilionGlow, letterSpacing: 2 },
    });
    labelB.anchor.set(0.5, 1);
    labelB.x = walletBX;
    labelB.y = midY - 1;
    hdr.addChild(labelB);

    this.walletTextB = goldText(this.formatWallet(this.walletB), { fontSize: 13, withShadow: false });
    this.walletTextB.anchor.set(0.5, 0);
    this.walletTextB.x = walletBX;
    this.walletTextB.y = midY + 1;
    hdr.addChild(this.walletTextB);

    this.container.addChild(hdr);
  }

  private formatWallet(n: number): string {
    return `${Math.round(n).toLocaleString('en-US')} NTD`;
  }

  private cascadeWallet(side: 'A' | 'B'): void {
    const from = side === 'A' ? this.displayedWalletA : this.displayedWalletB;
    const to   = side === 'A' ? this.walletA : this.walletB;
    if (from === to) return;
    const duration = Math.max(300, Math.min(800, Math.abs(to - from) * 2));
    const text = side === 'A' ? this.walletTextA : this.walletTextB;
    void tweenValue(from, to, duration, v => {
      if (side === 'A') this.displayedWalletA = v;
      else              this.displayedWalletB = v;
      text.text = this.formatWallet(v);
    }, Easings.easeOut);
  }


  // ─── Jackpot marquee ─────────────────────────────────────────────────────
  // p11-vA-01: Variant A — HERO 178px (was Variant B thin 64px strip)
  // Label above panel + warm-brown panel with gold border + bulb dots
  // + GRAND 42pt centre + MAJOR/MINOR bottom row
  // j-05 contract: jpGrandText / jpMajorText / jpMinorText MUST stay assigned here
  private drawJackpotMarquee(): void {
    // ── Label above hero panel: 「— THE POOL OF EIGHT SEAS —」──
    const label = new Text({
      text: '— THE POOL OF EIGHT SEAS —',
      style: { fontFamily: T.FONT.body, fontSize: 9, fill: T.FG.muted, letterSpacing: 4 },
    });
    label.anchor.set(0.5, 0);
    label.x = CANVAS_WIDTH / 2;
    label.y = JP_LABEL_Y;
    this.container.addChild(label);

    // ── HERO panel: y=88, h=132, margin 28px each side ──
    const panelX = 28;
    const panelW = CANVAS_WIDTH - 56;
    const panelY = JP_MARQUEE_Y;
    const panelH = JP_MARQUEE_H;

    // Dark warm-brown gradient bg (two-layer simulation — Pixi has no native gradient)
    const bgTop = new Graphics()
      .rect(panelX, panelY, panelW, panelH * 0.5)
      .fill({ color: 0x2a1a04, alpha: 1 });
    const bgBot = new Graphics()
      .rect(panelX, panelY + panelH * 0.5, panelW, panelH * 0.5)
      .fill({ color: 0x1a0f02, alpha: 1 });
    bgTop.zIndex = 5;  bgBot.zIndex = 5;
    this.container.addChild(bgTop);
    this.container.addChild(bgBot);

    // Gold border
    const border = new Graphics()
      .roundRect(panelX, panelY, panelW, panelH, 6)
      .stroke({ width: 1.5, color: T.GOLD.base, alpha: 1 });
    border.zIndex = 6;
    this.container.addChild(border);

    // Inner glow — wide soft inner stroke simulating box-shadow inset
    const innerGlow = new Graphics()
      .roundRect(panelX + 2, panelY + 2, panelW - 4, panelH - 4, 5)
      .stroke({ width: 6, color: T.GOLD.base, alpha: 0.15 });
    innerGlow.zIndex = 7;
    this.container.addChild(innerGlow);

    // Marquee bulbs — dotted gold pattern top + bottom edges
    const bulbs = new Graphics();
    const bulbY1 = panelY + 6;
    const bulbY2 = panelY + panelH - 6;
    for (let bx = panelX + 6; bx < panelX + panelW - 6; bx += 14) {
      bulbs.circle(bx, bulbY1, 1.5).circle(bx, bulbY2, 1.5);
    }
    bulbs.fill({ color: T.GOLD.glow, alpha: 0.6 });
    bulbs.zIndex = 8;
    this.container.addChild(bulbs);

    // ── Top row: ★ GRAND JACKPOT ★ label + POOL · NTD label ──
    const topRowY = panelY + 14;
    const grandLabel = new Text({
      text: '★ GRAND JACKPOT ★',
      style: { fontFamily: T.FONT.body, fontSize: 10, fill: T.GOLD.glow, letterSpacing: 4 },
    });
    grandLabel.x = panelX + 20;
    grandLabel.y = topRowY;
    grandLabel.zIndex = 10;
    this.container.addChild(grandLabel);

    const poolLabel = new Text({
      text: 'POOL · NTD',
      style: { fontFamily: T.FONT.body, fontSize: 10, fill: T.FG.muted, letterSpacing: 2 },
    });
    poolLabel.anchor.set(1, 0);
    poolLabel.x = panelX + panelW - 20;
    poolLabel.y = topRowY;
    poolLabel.zIndex = 10;
    this.container.addChild(poolLabel);

    // ── Centre: GRAND value — 42pt Cinzel gold + glow ──
    this.jpGrandText = goldText('5,000,000', { fontSize: 42, withShadow: true });
    this.jpGrandText.anchor.set(0.5, 0.5);
    this.jpGrandText.x = panelX + panelW / 2;
    this.jpGrandText.y = panelY + panelH * 0.50;
    this.jpGrandText.filters = [new GlowFilter({
      color: T.GOLD.base, distance: 18, outerStrength: 2.5, innerStrength: 0.5, quality: 0.4,
    })];
    this.jpGrandText.zIndex = 11;
    this.container.addChild(this.jpGrandText);

    // ── Bottom row: hairline + MAJOR (left) | MINOR (right) ──
    const bottomRowY  = panelY + panelH - 24;
    const dividerLine = new Graphics()
      .rect(panelX + 20, panelY + panelH - 40, panelW - 40, 1)
      .fill({ color: T.GOLD.base, alpha: 0.25 });
    dividerLine.zIndex = 9;
    this.container.addChild(dividerLine);

    const halfX1 = panelX + panelW * 0.30;
    const halfX2 = panelX + panelW * 0.70;

    const majorLbl = new Text({
      text: 'MAJOR',
      style: { fontFamily: T.FONT.body, fontSize: 12, fill: T.FG.muted, letterSpacing: 3 },
    });
    majorLbl.anchor.set(0.5, 0);
    majorLbl.x = halfX1;
    majorLbl.y = panelY + panelH - 40;    // chore161: label above value (40px from panel bottom)
    majorLbl.zIndex = 10;
    this.container.addChild(majorLbl);

    // chore161: 22→20pt + bottom-anchor(0.5,1) so text stays inside panel (6px inset)
    this.jpMajorText = goldText('500,000', { fontSize: 20, withShadow: false });
    this.jpMajorText.anchor.set(0.5, 1);
    this.jpMajorText.x = halfX1;
    this.jpMajorText.y = panelY + panelH - 6;
    this.jpMajorText.zIndex = 10;
    this.container.addChild(this.jpMajorText);

    const minorLbl = new Text({
      text: 'MINOR',
      style: { fontFamily: T.FONT.body, fontSize: 12, fill: T.FG.muted, letterSpacing: 3 },
    });
    minorLbl.anchor.set(0.5, 0);
    minorLbl.x = halfX2;
    minorLbl.y = panelY + panelH - 40;    // chore161: label above value (40px from panel bottom)
    minorLbl.zIndex = 10;
    this.container.addChild(minorLbl);

    // chore161: 22→20pt + bottom-anchor(0.5,1) so text stays inside panel (6px inset)
    this.jpMinorText = goldText('50,000', { fontSize: 20, withShadow: false });
    this.jpMinorText.anchor.set(0.5, 1);
    this.jpMinorText.x = halfX2;
    this.jpMinorText.y = panelY + panelH - 6;
    this.jpMinorText.zIndex = 10;
    this.container.addChild(this.jpMinorText);

    // Vertical divider between MAJOR and MINOR
    const vDivider = new Graphics()
      .rect(panelX + panelW * 0.5, bottomRowY - 10, 1, 30)
      .fill({ color: T.GOLD.base, alpha: 0.2 });
    vDivider.zIndex = 9;
    this.container.addChild(vDivider);
  }

  /** p11-vA-01: 「戰」 zone separator between JP hero and battle arena */
  private drawZoneSeparator(): void {
    const lineY = ZONE_SEP_Y;

    // Horizontal hairline (full width minus margin)
    const line = new Graphics()
      .rect(80, lineY, CANVAS_WIDTH - 160, 1)
      .fill({ color: T.GOLD.base, alpha: 0.4 });
    this.container.addChild(line);

    // Dark background rect behind the 「戰」 character to break the line cleanly
    const charBg = new Graphics()
      .rect(CANVAS_WIDTH / 2 - 18, lineY - 11, 36, 22)
      .fill({ color: 0x02101f, alpha: 1 });
    this.container.addChild(charBg);

    // 「戰」 character centered on line — gold, 14pt
    const zhanChar = new Text({
      text: '戰',
      style: {
        fontFamily: T.FONT.title, fontWeight: '700', fontSize: 14,
        fill: T.GOLD.base,
      },
    });
    zhanChar.anchor.set(0.5, 0.5);
    zhanChar.x = CANVAS_WIDTH / 2;
    zhanChar.y = lineY;
    zhanChar.filters = [new GlowFilter({
      color: T.GOLD.base, distance: 8, outerStrength: 1.2, innerStrength: 0.2, quality: 0.4,
    })];
    this.container.addChild(zhanChar);
  }

  /**
   * j-05: Refresh the three JP marquee texts from current jackpotPools state.
   * Called per-spin (after accrual), on mount (after loadPools), and after JP payout reset.
   * Text.text setter triggers internal glyph rebuild — calling once/spin is negligible.
   */
  private refreshJackpotMarquee(): void {
    this.jpMinorText.text = Math.floor(this.jackpotPools.minor).toLocaleString('en-US');
    this.jpMajorText.text = Math.floor(this.jackpotPools.major).toLocaleString('en-US');
    this.jpGrandText.text = Math.floor(this.jackpotPools.grand).toLocaleString('en-US');
  }

  /**
   * j-05: Brief scale pulse on a JP marquee text — 'grow' when pool accrues,
   * 'shrink' when pool resets after jackpot payout.
   */
  private pulseJackpotText(text: Text, mode: 'grow' | 'shrink'): void {
    const target = mode === 'grow' ? 1.05 : 0.85;
    const half   = mode === 'grow' ? 60   : 100;
    void tween(half, t => { text.scale.set(1 + (target - 1) * t); }, Easings.easeOut)
      .then(() => tween(half, t => { text.scale.set(target - (target - 1) * t); }, Easings.easeIn));
  }

  // ─── NineGrid seeded placement (p11-vA-02) ───────────────────────────────
  /**
   * FNV-1a hash seeded Fisher-Yates shuffle → select 5 of 9 cells (sorted).
   * Same seed → same placement (deterministic). Different mount seed → different result.
   */
  private computeGridPlacement(seed: string): number[] {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const rand = () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
      return ((h >>> 0) % 1000) / 1000;
    };
    const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [cells[i], cells[j]] = [cells[j]!, cells[i]!];
    }
    return cells.slice(0, 5).sort((a, b) => a - b);
  }

  // ─── NineGrid formation render (p11-vA-02) ───────────────────────────────
  /**
   * Draws the 5 spirits for one side onto NineGrid cells.
   * Sprites are addChild'd sorted back→front (row 0 first, row 2 last) for correct z-order
   * so front-row spirits visually appear in front of back-row ones.
   * B-side col mirroring handled in slotToArenaPos — no extra flip needed here.
   */
  private drawFormation(side: 'A' | 'B'): void {
    const grid      = side === 'A' ? this.formationA : this.formationB;
    const cells     = side === 'A' ? this.cellsA     : this.cellsB;
    const glowColor = side === 'A' ? T.TEAM.azureGlow : T.TEAM.vermilionGlow;

    // chore161 fix: createFormation scatters 5 spirits randomly into 9 slots (0-8).
    // drawFormation must collect non-null units in index order rather than reading grid[0..4].
    const activeUnits = grid.filter(u => u !== null);

    // Collect slot → pos, then sort back-to-front for z-ordering
    type PosResult = { x: number; y: number; row: number; scale: number };
    const sortedSlots: Array<{ slot: number; pos: PosResult }> = [];
    for (let slot = 0; slot < 5; slot++) {
      sortedSlots.push({ slot, pos: this.slotToArenaPos(side, slot) });
    }
    sortedSlots.sort((a, b) => a.pos.row - b.pos.row);   // back (0) → front (2)

    // Build a slot→cellRef map so cellsA/B stay in original slot order
    const cellRefsBySlot = new Map<number, FormationCellRefs>();

    for (const { slot, pos } of sortedSlots) {
      const unit = activeUnits[slot] ?? null;   // chore161: use compact active list not raw grid[slot]

      // spiritH derived from depth scale: scale × SPIRIT_H  (source height at scale=1)
      const spiritH = Math.round(pos.scale * SPIRIT_H);

      const container = new Container();
      container.x = pos.x;
      container.y = pos.y;
      container.zIndex = pos.row;   // 0=back / 1=mid / 2=front
      this.container.addChild(container);

      // Ground ellipse glow — breathes via ticker (visible only for alive units)
      const glowRing = new Graphics();
      if (unit) {
        const ew = NINE_CELL_SIZE * pos.scale * 0.7;
        glowRing.ellipse(0, NINE_CELL_SIZE / 2 - 2, ew / 2, 5).fill({ color: glowColor, alpha: 1 });
      }
      glowRing.alpha   = 0;
      glowRing.visible = unit !== null && unit.alive;
      container.addChildAt(glowRing, 0);

      // Full-body spirit sprite: anchor (0.5, 1) = bottom-centre; A faces right, B faces left
      let sprite: Sprite | null = null;
      if (unit) {
        const tex = Assets.get<Texture>(SYMBOLS[unit.symbolId]?.spiritKey ?? '');
        if (tex) {
          sprite = new Sprite(tex);
          sprite.anchor.set(0.5, 1);
          const baseScale = SPIRIT_H / Math.max(tex.width, tex.height);
          sprite.scale.set(baseScale * pos.scale);
          // A faces right (assets are facing-left by default → flip A); B stays left facing A
          if (side === 'A') sprite.scale.x *= -1;
          sprite.y = NINE_CELL_SIZE / 2;   // feet at cell bottom edge
          container.addChild(sprite);
        }
      }

      // Per-unit HP bar — track (static bg) + fill (redrawn in refreshFormation)
      // Position: above cell top edge (UNIT_HP_BAR_Y_OFF = -NINE_CELL_SIZE/2 - 10)
      const scaledBarW = Math.round(UNIT_HP_BAR_W * pos.scale);
      const hpTrack = new Graphics()
        .roundRect(-scaledBarW / 2, UNIT_HP_BAR_Y_OFF, scaledBarW, UNIT_HP_BAR_H, UNIT_HP_BAR_H / 2)
        .fill({ color: T.HP.track, alpha: 0.8 })
        .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
      hpTrack.visible = unit !== null;
      const hpFill = new Graphics();
      hpFill.visible = unit !== null;
      container.addChild(hpTrack);
      container.addChild(hpFill);

      // Death cross ✕ centred on torso
      const ch   = spiritH * 0.20;
      const midY = 0;   // container center (cell center)
      const crossMark = new Graphics()
        .moveTo(-ch, midY - ch).lineTo(ch, midY + ch)
        .moveTo( ch, midY - ch).lineTo(-ch, midY + ch)
        .stroke({ width: 3, color: T.FG.dim, alpha: 0.85 });
      crossMark.visible = false;
      container.addChild(crossMark);

      cellRefsBySlot.set(slot, { container, sprite, hpTrack, hpFill, glowRing, crossMark });
    }

    // Push to cellsA/B in original slot order (0-4) so refreshFormation index mapping is stable
    for (let slot = 0; slot < 5; slot++) {
      const ref = cellRefsBySlot.get(slot);
      if (ref) cells.push(ref);
    }
  }

  /**
   * p11-vA-02: Maps a formation slot index (0-4) to NineGrid cell center position.
   * Grid: 3×3 cells, row 0 = back (furthest), row 2 = front (closest).
   * B-side col is mirrored so front faces A (col 0 is rightmost for B).
   * Returns { x, y, row: 0|1|2, scale } where scale = 0.78 + (row/2)*0.32.
   */
  private slotToArenaPos(side: 'A' | 'B', slot: number): { x: number; y: number; row: number; scale: number } {
    const placement = side === 'A' ? this.gridPlacementA : this.gridPlacementB;
    const cellIdx   = placement[slot] ?? placement[0] ?? 0;  // fallback if slot >= 5
    const row       = Math.floor(cellIdx / 3);                // 0=back, 1=mid, 2=front
    const col       = cellIdx % 3;
    const mirroredCol = side === 'B' ? (2 - col) : col;

    const gridLeftX = side === 'A' ? NINE_A_GRID_LEFT_X : NINE_B_GRID_LEFT_X;
    const cellX     = gridLeftX + mirroredCol * NINE_STEP + NINE_CELL_SIZE / 2;
    const cellY     = NINE_GRID_TOP_Y + row * NINE_STEP + NINE_CELL_SIZE / 2;

    // Depth scale: back=0.78, mid=0.94, front=1.10
    const t     = row / 2;
    const scale = 0.78 + t * 0.32;

    return { x: cellX, y: cellY, row, scale };
  }

  /** chore: Reel header strip — ● A · YOUR TURN | ◇ SHARED BOARD ◇ | B · WAITING ○ */
  private drawReelHeader(): void {
    const stripY   = REEL_ZONE_Y - 28;
    const stripH   = 22;
    const stripX   = 28;
    const stripW   = CANVAS_WIDTH - 56;
    const midY     = stripY + stripH / 2;
    const dotR     = 4;

    // Background strip
    const bg = new Graphics()
      .rect(stripX, stripY, stripW, stripH)
      .fill({ color: 0x0d1f35, alpha: 0.80 });
    this.container.addChild(bg);

    // A side — solid azure dot (active state indicator)
    const aDot = new Graphics()
      .circle(stripX + 10, midY, dotR)
      .fill({ color: T.CLAN.azureGlow });
    aDot.filters = [new GlowFilter({ color: T.CLAN.azureGlow, distance: 8, outerStrength: 1.5, innerStrength: 0.1, quality: 0.3 })];
    this.container.addChild(aDot);

    // A · YOUR TURN (left, azure)
    const textA = new Text({
      text: 'A · YOUR TURN',
      style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 10, fill: T.CLAN.azureGlow, letterSpacing: 3 },
    });
    textA.anchor.set(0, 0.5);
    textA.x = stripX + 10 + dotR + 5;   // 5px gap after dot
    textA.y = midY;
    this.container.addChild(textA);

    // ◇ SHARED BOARD ◇ (centre, gold)
    const textCenter = new Text({
      text: '◇ SHARED BOARD ◇',
      style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 10, fill: T.GOLD.base, letterSpacing: 3 },
    });
    textCenter.anchor.set(0.5, 0.5);
    textCenter.x = CANVAS_WIDTH / 2;
    textCenter.y = midY;
    this.container.addChild(textCenter);

    // B · WAITING (right, muted — waiting state)
    const textB = new Text({
      text: 'B · WAITING',
      style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 10, fill: T.FG.muted, letterSpacing: 3 },
    });
    textB.anchor.set(1, 0.5);
    textB.x = stripX + stripW - 10 - dotR - 5;   // 5px gap before hollow dot
    textB.y = midY;
    this.container.addChild(textB);

    // B side — hollow circle (idle / waiting state indicator)
    const bDot = new Graphics()
      .circle(stripX + stripW - 10, midY, dotR)
      .stroke({ width: 1.5, color: T.FG.muted, alpha: 0.8 });
    this.container.addChild(bDot);
  }

  private drawSlot(): void {
    this.reel = new SlotReel();
    this.reel.x = SLOT_X;
    this.reel.y = REEL_ZONE_Y;   // p11-vA-01: REEL_ZONE_Y=615 (was 700 Variant B)
    this.container.addChild(this.reel);
  }

  private drawLog(): void {
    // p11-vA-01: battle log panel — LOG_H_CONST=185 (Variant A layout, y=1055)
    const LOG_PAD_X = 28;
    const LOG_H     = LOG_H_CONST;
    const logPanel = new Graphics()
      .roundRect(LOG_PAD_X, LOG_Y, CANVAS_WIDTH - LOG_PAD_X * 2, LOG_H, 6)
      .fill({ color: T.SEA.deep, alpha: 0.55 })
      .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.3 });
    this.container.addChild(logPanel);

    // "BATTLE LOG" label
    const logLabel = new Text({
      text: 'BATTLE LOG',
      style: { fontFamily: T.FONT.body, fontSize: 9, fill: T.FG.muted, letterSpacing: 4 },
    });
    logLabel.x = LOG_PAD_X + 12;
    logLabel.y = LOG_Y + 8;
    this.container.addChild(logLabel);

    // s12-ui-02: programmatic hairline replaces divider.webp Sprite
    const dividerW = (CANVAS_WIDTH - LOG_PAD_X * 2 - 24) * 0.9;
    const dividerX = (CANVAS_WIDTH - dividerW) / 2;
    const dividerY = LOG_Y + 24;
    const logDivider = new Graphics()
      .moveTo(dividerX, dividerY).lineTo(dividerX + dividerW, dividerY)
      .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.5 });
    this.container.addChild(logDivider);

    this.logText = new Text({
      text: '',
      style: {
        fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.xs,
        fill: T.FG.muted, lineHeight: 16,
      },
    });
    this.logText.x = LOG_PAD_X + 12;
    this.logText.y = LOG_Y + 28;
    this.container.addChild(this.logText);
  }

  // drawBackButton() retired in p10-v01 — RETREAT button is in drawCompactHeader()

  // ─── chore: Manual SPIN button ──────────────────────────────────────────
  private drawSpinButton(): void {
    this.spinButton = new Container();
    const btnX = (CANVAS_WIDTH - SPIN_BTN_W) / 2;   // centered
    this.spinButton.x = btnX;
    this.spinButton.y = SPIN_BTN_Y;
    this.spinButton.zIndex = 200;

    // Gold bg
    this.spinButtonBg = new Graphics()
      .roundRect(0, 0, SPIN_BTN_W, SPIN_BTN_H, 12)
      .fill({ color: T.GOLD.base, alpha: 1 })
      .stroke({ width: 2, color: T.GOLD.shadow, alpha: 0.8 });
    this.spinButton.addChild(this.spinButtonBg);

    // Gold glow
    this.spinButton.filters = [new GlowFilter({
      color: T.GOLD.glow, distance: 12, outerStrength: 1.5, innerStrength: 0.3, quality: 0.4,
    })];

    // Main label 「轉 動」
    this.spinButtonText = new Text({
      text: '轉 動',
      style: {
        fontFamily: T.FONT.title, fontWeight: '700', fontSize: 24,
        fill: 0x0D1421, letterSpacing: 8,
      },
    });
    this.spinButtonText.anchor.set(0.5, 0.5);
    this.spinButtonText.x = SPIN_BTN_W / 2;
    this.spinButtonText.y = SPIN_BTN_H / 2 - 6;
    this.spinButton.addChild(this.spinButtonText);

    // Sub label 「-N NTD」
    this.spinButtonSubText = new Text({
      text: `-${this.cfg.betA} NTD`,
      style: {
        fontFamily: T.FONT.body, fontWeight: '500', fontSize: 11,
        fill: 0x0D1421, fontStyle: 'italic',
      },
    });
    this.spinButtonSubText.anchor.set(0.5, 0.5);
    this.spinButtonSubText.x = SPIN_BTN_W / 2;
    this.spinButtonSubText.y = SPIN_BTN_H / 2 + 14;
    this.spinButton.addChild(this.spinButtonSubText);

    // Click handler — resolves the promise awaited in loop()
    // chore: explicit hit area required — Pixi 8 Container has no implicit hit area
    this.spinButton.hitArea   = new Rectangle(0, 0, SPIN_BTN_W, SPIN_BTN_H);
    this.spinButton.eventMode = 'none';   // starts disabled; enabled by waitForSpinClick()
    this.spinButton.cursor    = 'pointer';
    this.spinButton.on('pointertap', () => this.onSpinClick());

    this.container.addChild(this.spinButton);

    // AUTO button (left of SPIN) — dedicated draw so refs are stored for label refresh
    this.autoButton = this.drawAutoButton();
    this.autoButton.x = (CANVAS_WIDTH - SPIN_BTN_W) / 2 - GHOST_BTN_W - SPIN_BTN_GAP;
    this.autoButton.y = SPIN_BTN_Y + (SPIN_BTN_H - GHOST_BTN_H) / 2;   // vertical centre align
    this.container.addChild(this.autoButton);

    // SKIP button (right of SPIN)
    this.skipButton = this.drawGhostButton('SKIP', () => this.onSkipClick());
    this.skipButton.x = (CANVAS_WIDTH + SPIN_BTN_W) / 2 + SPIN_BTN_GAP;
    this.skipButton.y = SPIN_BTN_Y + (SPIN_BTN_H - GHOST_BTN_H) / 2;
    this.container.addChild(this.skipButton);
  }

  private onSpinClick(): void {
    if (!this.spinClickResolve) return;
    const resolve = this.spinClickResolve;
    this.spinClickResolve = null;
    // Visually disable during spin
    this.spinButton.eventMode    = 'none';
    this.spinButton.alpha        = 0.5;
    this.spinButtonText.text     = '...';
    resolve();
  }

  private enableSpinButton(): void {
    this.spinButton.eventMode = 'static';
    this.spinButton.alpha     = 1;
    this.spinButtonText.text  = '轉 動';
  }

  private waitForSpinClick(): Promise<void> {
    this.enableSpinButton();

    // AUTO mode: self-resolve after 350 ms so animation rhythm stays intact
    if (this.autoSpinsRemaining > 0) {
      return new Promise(resolve => {
        this.spinClickResolve = resolve;
        setTimeout(() => {
          if (this.spinClickResolve === resolve) {
            this.autoSpinsRemaining -= 1;
            this.refreshAutoButtonLabel();
            this.onSpinClick();   // disables button + resolves promise
            if (this.autoSpinsRemaining <= 0) this.stopAutoMode();
          }
        }, 350);
      });
    }

    return new Promise(resolve => {
      this.spinClickResolve = resolve;
    });
  }

  /** Stop AUTO mode — resets counter + refreshes button label. */
  private stopAutoMode(): void {
    this.autoSpinsRemaining = 0;
    if (this.autoButtonText) this.refreshAutoButtonLabel();
  }

  /** Update AUTO button text, border, and text fill to reflect current autoSpinsRemaining. */
  private refreshAutoButtonLabel(): void {
    if (!this.autoButtonText || !this.autoButtonBg) return;
    if (this.autoSpinsRemaining > 0) {
      this.autoButtonText.text        = `STOP ${this.autoSpinsRemaining}`;
      this.autoButtonText.style.fill  = T.GOLD.glow;    // gold text when active
      this.autoButton.alpha = 0.85;
      this.autoButtonBg.clear()
        .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
        .stroke({ width: 1.5, color: T.GOLD.glow, alpha: 0.9 });
    } else {
      this.autoButtonText.text        = 'AUTO';
      this.autoButtonText.style.fill  = T.FG.muted;     // muted when idle
      this.autoButton.alpha = 1;
      this.autoButtonBg.clear()
        .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
        .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
    }
  }

  /** Dedicated AUTO button — stores bg + text refs for refreshAutoButtonLabel(). */
  private drawAutoButton(): Container {
    const btn = new Container();
    this.autoButtonBg = new Graphics()
      .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
      .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
    btn.addChild(this.autoButtonBg);

    this.autoButtonText = new Text({
      text: 'AUTO',
      style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 14, fill: T.FG.muted, letterSpacing: 3 },
    });
    this.autoButtonText.anchor.set(0.5, 0.5);
    this.autoButtonText.x = GHOST_BTN_W / 2;
    this.autoButtonText.y = GHOST_BTN_H / 2;
    btn.addChild(this.autoButtonText);

    btn.hitArea   = new Rectangle(0, 0, GHOST_BTN_W, GHOST_BTN_H);
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointertap', () => this.onAutoClick());
    return btn;
  }

  /** chore: ghost button helper — transparent bg + 1px muted border (mockup GhostBtn style) */
  private drawGhostButton(label: string, onClick: () => void): Container {
    const btn = new Container();
    const bg = new Graphics()
      .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
      .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
    btn.addChild(bg);

    const text = new Text({
      text: label,
      style: {
        fontFamily: T.FONT.body, fontWeight: '600', fontSize: 14,
        fill: T.FG.muted, letterSpacing: 3,
      },
    });
    text.anchor.set(0.5, 0.5);
    text.x = GHOST_BTN_W / 2;
    text.y = GHOST_BTN_H / 2;
    btn.addChild(text);

    // chore: explicit hit area (per Issue 1 fix — Container needs Rectangle)
    btn.hitArea   = new Rectangle(0, 0, GHOST_BTN_W, GHOST_BTN_H);
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointertap', onClick);

    return btn;
  }

  private onAutoClick(): void {
    if (this.autoSpinsRemaining > 0) {
      this.stopAutoMode();   // running → cancel immediately
      return;
    }
    if (this.autoMenuOpen) {
      this.closeAutoMenu();  // menu open → toggle close
      return;
    }
    this.openAutoMenu();     // idle → open spin-count selector
  }

  /** Open the spin-count selector popup — scrim + panel + 4 count options + CANCEL. */
  private openAutoMenu(): void {
    this.autoMenuOpen = true;
    const menu = new Container();
    menu.zIndex = 500;    // above HUD but below JP/FreeSpin ceremonies
    this.autoMenuContainer = menu;

    // Scrim — semi-transparent overlay; click to dismiss
    const scrim = new Graphics()
      .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .fill({ color: 0x000000, alpha: 0.5 });
    scrim.eventMode = 'static';
    scrim.hitArea = new Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    scrim.cursor = 'pointer';
    scrim.on('pointertap', () => this.closeAutoMenu());
    menu.addChild(scrim);

    // Panel geometry — floats above SPIN button
    const panelW = 280, panelH = 260;
    const panelX = (CANVAS_WIDTH - panelW) / 2;
    const panelY = SPIN_BTN_Y - panelH - 20;

    const panelBg = new Graphics()
      .roundRect(panelX, panelY, panelW, panelH, 8)
      .fill({ color: 0x2a1a04, alpha: 1 })
      .stroke({ width: 1.5, color: T.GOLD.base, alpha: 1 });
    menu.addChild(panelBg);

    // Title
    const title = new Text({
      text: 'AUTO SPINS',
      style: {
        fontFamily: T.FONT.body, fontWeight: '600', fontSize: 16,
        fill: T.GOLD.glow, letterSpacing: 4,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = panelX + panelW / 2;
    title.y = panelY + 22;
    menu.addChild(title);

    // 4 count options — 2×2 grid with hover highlight
    const counts = [10, 25, 50, 100];
    const btnW = 110, btnH = 44, gap = 12;
    const gridX0 = panelX + (panelW - 2 * btnW - gap) / 2;
    const gridY0 = panelY + 68;
    counts.forEach((n, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const btn = this.drawGhostButton(`${n}`, () => this.setAutoSpins(n));
      btn.x = gridX0 + col * (btnW + gap);
      btn.y = gridY0 + row * (btnH + gap);
      // Hover highlight — bg fills on pointerover, clears on pointerout
      const btnBg = btn.getChildAt(0) as Graphics;
      btn.on('pointerover', () => {
        btnBg.clear()
          .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
          .fill({ color: T.GOLD.base, alpha: 0.15 })
          .stroke({ width: 1.5, color: T.GOLD.glow, alpha: 0.8 });
      });
      btn.on('pointerout', () => {
        btnBg.clear()
          .roundRect(0, 0, GHOST_BTN_W, GHOST_BTN_H, 4)
          .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
      });
      menu.addChild(btn);
    });

    // CANCEL button — centred at panel bottom
    const cancelBtn = this.drawGhostButton('CANCEL', () => this.closeAutoMenu());
    cancelBtn.x = panelX + (panelW - GHOST_BTN_W) / 2;
    cancelBtn.y = panelY + panelH - GHOST_BTN_H - 16;
    menu.addChild(cancelBtn);

    this.container.addChild(menu);
  }

  /** Close and destroy the spin-count selector popup. */
  private closeAutoMenu(): void {
    this.autoMenuOpen = false;
    if (this.autoMenuContainer) {
      this.autoMenuContainer.destroy({ children: true });
      this.autoMenuContainer = undefined;
    }
  }

  /** Start auto-spin with a chosen count. */
  private setAutoSpins(n: number): void {
    this.closeAutoMenu();
    this.autoSpinsRemaining = n;
    this.refreshAutoButtonLabel();
    // If currently waiting for a click, kick off immediately
    if (this.spinClickResolve) {
      this.autoSpinsRemaining -= 1;
      this.refreshAutoButtonLabel();
      this.onSpinClick();
      if (this.autoSpinsRemaining <= 0) this.stopAutoMode();
    }
  }

  private onSkipClick(): void {
    // chore: SKIP is a placeholder — animation skip not yet implemented
    if (import.meta.env.DEV) console.log('[SKIP] (placeholder — animation skip not yet implemented)');
  }

  // ─── chore: PAYLINES decorative indicator ───────────────────────────────
  private drawPaylinesIndicator(): void {
    this.paylinesContainer = new Container();
    this.paylinesCells = [];

    // "PAYLINES" label (left)
    const label = new Text({
      text: 'PAYLINES',
      style: {
        fontFamily: T.FONT.body, fontWeight: '500', fontSize: 9,
        fill: T.FG.muted, letterSpacing: 3,
      },
    });
    label.anchor.set(0, 0.5);
    label.y = 0;
    this.paylinesContainer.addChild(label);

    // Force text measurement (width may be 0 before first render)
    // Use fixed offset as label should be ~58px wide at fontSize 9 with letterSpacing 3
    const labelWidth = 70;   // conservative fixed width for centering

    // 10 cells, each in its own Container at relative x
    let xOffset = labelWidth + 12;
    for (let i = 0; i < 10; i++) {
      const cellRoot = new Container();
      cellRoot.x = xOffset;

      const cell = new Graphics()
        .roundRect(0, -PAYLINES_CELL_H / 2, PAYLINES_CELL_W, PAYLINES_CELL_H, 2)
        .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
      cellRoot.addChild(cell);

      const cellText = new Text({
        text: String(i + 1),
        style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 7, fill: T.FG.muted },
      });
      cellText.anchor.set(0.5, 0.5);
      cellText.x = PAYLINES_CELL_W / 2;
      cellText.y = 0;
      cellRoot.addChild(cellText);

      this.paylinesContainer.addChild(cellRoot);
      this.paylinesCells.push(cell);
      xOffset += PAYLINES_CELL_W + PAYLINES_GAP;
    }

    const totalW = labelWidth + 12 + 10 * PAYLINES_CELL_W + 9 * PAYLINES_GAP;
    this.paylinesContainer.x = (CANVAS_WIDTH - totalW) / 2;
    this.paylinesContainer.y = PAYLINES_Y;
    this.container.addChild(this.paylinesContainer);
  }

  private updatePaylinesIndicator(activeCount: number): void {
    const n = Math.min(Math.max(activeCount, 0), 10);
    this.paylinesCells.forEach((cell, i) => {
      cell.clear();
      if (i < n) {
        cell.roundRect(0, -PAYLINES_CELL_H / 2, PAYLINES_CELL_W, PAYLINES_CELL_H, 2)
            .fill({ color: T.GOLD.base })
            .stroke({ width: 1, color: T.GOLD.base });
      } else {
        cell.roundRect(0, -PAYLINES_CELL_H / 2, PAYLINES_CELL_W, PAYLINES_CELL_H, 2)
            .stroke({ width: 1, color: T.FG.muted, alpha: 0.5 });
      }
    });
  }

  // ─── Curse stack HUD (k-04) ──────────────────────────────────────────────
  private drawCurseHud(): void {
    // A side — bottom-left of wallet area
    this.curseHudA = new Container();
    this.curseHudA.x = 16;  this.curseHudA.y = JP_MARQUEE_Y + JP_MARQUEE_H + 8;   // p11-vA-01: below JP marquee hero
    const iconA = new Graphics()
      .circle(0, 0, 9).fill({ color: 0x8b3aaa, alpha: 0.85 })
      .stroke({ width: 1.5, color: 0xffaaff, alpha: 0.9 });
    this.curseHudA.addChild(iconA);
    this.curseHudAText = new Text({
      text: '×0',
      style: { fontFamily: T.FONT.num, fontSize: 12, fontWeight: '700', fill: 0xffaaff, letterSpacing: 1 },
    });
    this.curseHudAText.anchor.set(0, 0.5);
    this.curseHudAText.x = 14;  this.curseHudAText.y = 0;
    this.curseHudA.addChild(this.curseHudAText);
    this.curseHudA.visible = false;
    this.container.addChild(this.curseHudA);

    // B side mirror — bottom-right of wallet area
    this.curseHudB = new Container();
    this.curseHudB.x = CANVAS_WIDTH - 16;  this.curseHudB.y = JP_MARQUEE_Y + JP_MARQUEE_H + 8;   // p11-vA-01: below JP marquee hero
    const iconB = new Graphics()
      .circle(0, 0, 9).fill({ color: 0x8b3aaa, alpha: 0.85 })
      .stroke({ width: 1.5, color: 0xffaaff, alpha: 0.9 });
    this.curseHudB.addChild(iconB);
    this.curseHudBText = new Text({
      text: '×0',
      style: { fontFamily: T.FONT.num, fontSize: 12, fontWeight: '700', fill: 0xffaaff, letterSpacing: 1 },
    });
    this.curseHudBText.anchor.set(1, 0.5);
    this.curseHudBText.x = -14;  this.curseHudBText.y = 0;
    this.curseHudB.addChild(this.curseHudBText);
    this.curseHudB.visible = false;
    this.container.addChild(this.curseHudB);
  }

  private updateCurseHud(side: 'A' | 'B', stack: number): void {
    const hud  = side === 'A' ? this.curseHudA     : this.curseHudB;
    const text = side === 'A' ? this.curseHudAText : this.curseHudBText;
    if (stack <= 0) {
      hud.visible = false;
      return;
    }
    hud.visible = true;
    text.text   = `×${stack}`;
    hud.alpha   = stack >= 2 ? 1.0 : 0.7;
  }

  // ─── Free Spin overlay (f-04) — persistent banner + gold tint ───────────
  private drawFreeSpinOverlay(): void {
    // Full-screen gold tint — visible during free spin, initially hidden
    this.freeSpinTint = new Graphics()
      .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .fill({ color: 0xFFD37A, alpha: 0.08 });
    this.freeSpinTint.visible = false;
    this.freeSpinTint.zIndex = 50;   // above reel (~10), below HUD (~1000)
    this.container.addChild(this.freeSpinTint);

    // Banner Container (centred at top, initially hidden)
    this.freeSpinBanner = new Container();
    this.freeSpinBanner.x = CANVAS_WIDTH / 2;
    this.freeSpinBanner.y = JP_MARQUEE_Y + JP_MARQUEE_H + 16;   // p11-vA-01: below JP marquee hero
    this.freeSpinBanner.visible = false;
    this.freeSpinBanner.alpha = 0;

    this.freeSpinBannerText = goldText(`FREE SPINS  0 / ${BattleScreen.FREE_SPIN_COUNT}`, {
      fontSize: T.FONT_SIZE.h1,
      withShadow: true,
    });
    this.freeSpinBannerText.anchor.set(0.5, 0.5);
    this.freeSpinBannerText.filters = [new GlowFilter({
      color: 0xFFD37A,
      distance: 14,
      outerStrength: 2.2,
      innerStrength: 0.4,
      quality: 0.4,
    })];
    this.freeSpinBanner.addChild(this.freeSpinBannerText);
    this.container.addChild(this.freeSpinBanner);
  }

  /** Called twice per round: once after trigger detection, once after decrement.
   *  Handles enter / update / retrigger-pulse / exit transitions. */
  private refreshFreeSpinOverlay(): void {
    if (!this.freeSpinBanner || !this.freeSpinBannerText || !this.freeSpinTint) return;

    const isIn  = this.inFreeSpin;
    const wasIn = this.wasInFreeSpin;

    // Update text whenever in free spin mode
    if (isIn) {
      this.freeSpinBannerText.text = `FREE SPINS  ${this.freeSpinsRemaining} / ${BattleScreen.FREE_SPIN_COUNT}`;
    }

    // Transition: not-in → in (enter animation: scale 0.7→1.0 + alpha 0→1)
    if (isIn && !wasIn) {
      this.freeSpinBanner.visible = true;
      this.freeSpinTint.visible   = true;
      this.freeSpinBanner.alpha   = 0;
      this.freeSpinBanner.scale.set(0.7);
      void tween(220, t => {
        this.freeSpinBanner!.alpha = t;
        this.freeSpinBanner!.scale.set(0.7 + 0.3 * t);
      }, Easings.easeOut);
    }

    // Transition: in → not-in (exit fade-out: alpha 1→0, tint fades too)
    if (!isIn && wasIn) {
      void tween(300, t => {
        this.freeSpinBanner!.alpha = 1 - t;
        this.freeSpinTint!.alpha   = 0.08 * (1 - t);
      }, Easings.easeIn).then(() => {
        this.freeSpinBanner!.visible = false;
        this.freeSpinTint!.visible   = false;
        this.freeSpinTint!.alpha     = 0.08;   // restore for next entry
      });
    }

    // Retrigger pulse: freeSpinsRemaining jumped UP (not decremented)
    if (isIn && this.freeSpinsRemaining > this.prevFreeSpinsRemaining) {
      void tween(250, t => {
        const s = 1 + 0.25 * Math.sin(Math.PI * t);   // 1.0 → 1.25 → 1.0
        this.freeSpinBanner!.scale.set(s);
      }, Easings.easeOut);
    }

    // Update edge detectors for next call
    this.wasInFreeSpin          = isIn;
    this.prevFreeSpinsRemaining = this.freeSpinsRemaining;
  }

  // ─── Resonance banner (r-04) — fire-and-forget at match start ───────────
  private async playResonanceBanner(): Promise<void> {
    if (this.resonanceA.tier === 'NONE') return;

    const meta = T.CLAN_META;
    let bannerText: string;
    if (this.resonanceA.tier === 'SOLO') {
      const clan = this.resonanceA.boostedClans[0];
      bannerText = `♪ ${meta[clan].cn} 共鳴  ×1.5`;
    } else {
      // DUAL
      const c1 = this.resonanceA.boostedClans[0];
      const c2 = this.resonanceA.boostedClans[1];
      bannerText = `♪ ${meta[c1].cn} × ${meta[c2].cn}  雙重共鳴  ×1.5`;
    }

    const banner = goldText(bannerText, { fontSize: T.FONT_SIZE.h2, withShadow: true });
    banner.anchor.set(0.5, 0.5);
    banner.x = CANVAS_WIDTH / 2;
    banner.y = 380;
    banner.alpha = 0;
    banner.zIndex = 1000;
    this.container.addChild(banner);

    await tween(200, t => { banner.alpha = t; }, Easings.easeOut);
    await delay(1000);
    await tween(300, t => { banner.alpha = 1 - t; }, Easings.easeIn);

    banner.destroy();
  }

  // ─── Frame refresh (non-animated parts) ──────────────────────────────────
  private refresh(): void {
    this.roundText.text = `ROUND ${String(this.round).padStart(2, '0')}`;
    this.refreshFormation('A', this.formationA, this.cellsA);
    this.refreshFormation('B', this.formationB, this.cellsB);
    this.logText.text = this.logLines.slice(-3).join('\n');
    this.updateCurseHud('A', this.curseStackA);
    this.updateCurseHud('B', this.curseStackB);
  }

  private refreshFormation(side: 'A' | 'B', grid: FormationGrid, cells: FormationCellRefs[]): void {
    // chore161 fix: grid has 9 entries with spirits at random indices (createFormation scatters 0-8).
    // Extract non-null units in index order to match the compact display slots 0-4 from drawFormation.
    const activeUnits = grid.filter(u => u !== null);
    for (let i = 0; i < cells.length; i++) {
      const ref  = cells[i];
      const unit = activeUnits[i] ?? null;   // chore161: compact active list, not raw grid[i]
      if (!unit) {
        ref.glowRing.visible  = false;
        ref.crossMark.visible = false;
        ref.hpFill.clear();
        ref.hpTrack.visible = false;
        continue;
      }
      if (ref.sprite) ref.sprite.alpha = unit.alive ? 1 : 0.4;
      ref.glowRing.visible  = unit.alive;
      ref.crossMark.visible = !unit.alive;

      // Per-unit HP bar fill
      ref.hpFill.clear();
      if (unit.alive) {
        const ratio = unit.hp / unit.maxHp;
        const w     = UNIT_HP_BAR_W * Math.max(0, Math.min(1, ratio));
        const color = ratio > 0.6 ? T.HP.high : ratio > 0.3 ? T.HP.mid : T.HP.low;
        ref.hpFill
          .roundRect(-UNIT_HP_BAR_W / 2, UNIT_HP_BAR_Y_OFF, w, UNIT_HP_BAR_H, UNIT_HP_BAR_H / 2)
          .fill(color);
      }

      void side; // side unused here but kept for symmetry with call sites
    }
  }

  private playWinTierSfx(hitsA: WayHit[], hitsB: WayHit[]): void {
    const hasJackpot = [...hitsA, ...hitsB].some(h => h.matchCount === 5);
    if (hasJackpot) { AudioManager.playSfx('win-jackpot'); return; }
    const totalWays = hitsA.length + hitsB.length;
    if (totalWays === 0) return;
    if (totalWays >= 30)      AudioManager.playSfx('win-mega');
    else if (totalWays >= 11) AudioManager.playSfx('win-big');
    else if (totalWays >= 4)  AudioManager.playSfx('win-nice');
    else                      AudioManager.playSfx('win-small');
  }

  // ─── Manual-spin battle loop (chore: was auto-loop, now wait-for-click) ─────
  private async loop(): Promise<void> {
    this.running = true;
    // Full pool: all 8 symbols always spin; non-selected ones fill cells without scoring
    const pool = buildFullPool(SYMBOLS);

    // Overkill tiebreaker state (used if both teams die in the same round)
    let lastDmgA = 0, lastDmgB = 0;
    let lastPreHpA = 0, lastPreHpB = 0;

    while (this.running && isTeamAlive(this.formationA) && isTeamAlive(this.formationB)) {
      // chore: wait for player to press SPIN before each round (replaces auto-loop)
      await this.waitForSpinClick();
      if (!this.running) return;

      this.round++;
      this.vsBadge?.pulse();   // p10-v01: optional guard
      this.refresh();

      // p-02: demo mode — use scripted grid for the first DEMO_SPIN_COUNT spins
      let spin: SpinResult;
      if (this.demoMode && this.demoSpinIndex < BattleScreen.DEMO_SPIN_COUNT) {
        const forcedGrid = BattleScreen.DEMO_GRIDS[this.demoSpinIndex];
        spin = this.engine.evaluateForcedGrid(
          forcedGrid, pool,
          this.cfg.selectedA, this.cfg.selectedB,
          this.cfg.betA, this.cfg.betB,
          this.cfg.coinScaleA, this.cfg.dmgScaleA,
          this.cfg.coinScaleB, this.cfg.dmgScaleB,
          this.cfg.fairnessExp,
        );
        const labels = ['NEAR_WIN', 'BIG_WIN', 'MEGA_WIN', 'JACKPOT', 'FREE_SPIN'];
        console.log(`[Demo] spin ${this.demoSpinIndex + 1}/5: ${labels[this.demoSpinIndex]}`);
        this.demoSpinIndex++;
      } else {
        spin = this.engine.spin(
          pool,
          this.cfg.selectedA, this.cfg.selectedB,
          this.cfg.betA, this.cfg.betB,
          this.cfg.coinScaleA, this.cfg.dmgScaleA,
          this.cfg.coinScaleB, this.cfg.dmgScaleB,
          this.cfg.fairnessExp,
        );
      }
      if (!this.running) return;

      // ── M6 Curse cell counting per spin (k-02) ───────────────────────────
      // Curse on YOUR half of the grid charges OPPONENT's stack.
      // col 0-1 = A side → curse charges B; col 3-4 = B side → curse charges A.
      // col 2 = neutral (ignored). Stack proc happens in k-03.
      const CURSE_ID = SYMBOLS.findIndex(s => s.isCurse);
      if (CURSE_ID >= 0) {
        let curseLandingOnA = 0, curseLandingOnB = 0;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
            if (spin.grid[r][c] === CURSE_ID) {
              if (c < 2)      curseLandingOnA++;
              else if (c > 2) curseLandingOnB++;
            }
          }
        }
        this.curseStackB += curseLandingOnA;  // curse on A side → charges B
        this.curseStackA += curseLandingOnB;  // curse on B side → charges A
        if (import.meta.env.DEV && (curseLandingOnA + curseLandingOnB > 0)) {
          console.log(`[Curse] A side ${curseLandingOnA} → B stack=${this.curseStackB}, B side ${curseLandingOnB} → A stack=${this.curseStackA}`);
        }
      }

      // ── M10 Free Spin trigger: ≥3 scatter cells on shared 5×3 grid ──────────
      // Trigger detection runs before coin/dmg accumulators so this spin gets ×2.
      const SCATTER_ID = SYMBOLS.findIndex(s => s.isScatter);
      if (SCATTER_ID >= 0) {
        let scatterThisSpin = 0;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 5; c++) {
            if (spin.grid[r][c] === SCATTER_ID) scatterThisSpin++;
          }
        }
        if (scatterThisSpin >= 3) {
          if (!this.inFreeSpin) {
            // s13-fx-01: ceremony first, then enter free-spin mode
            await playFreeSpinEntryCeremony(this.container);

            // Fresh trigger — this spin and next 4 are free + ×2
            this.inFreeSpin = true;
            this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
            if (import.meta.env.DEV) console.log(`[FreeSpin] TRIGGERED — ${scatterThisSpin} scatters → 5 spins`);
            // Stop AUTO on FreeSpin so player notices the event
            if (this.autoSpinsRemaining > 0) this.stopAutoMode();
          } else {
            // Retrigger during free spin — add 5 more, cap 50
            this.freeSpinsRemaining = Math.min(50, this.freeSpinsRemaining + BattleScreen.FREE_SPIN_COUNT);
            if (import.meta.env.DEV) console.log(`[FreeSpin] RETRIGGER — ${scatterThisSpin} scatters → +5 (now ${this.freeSpinsRemaining})`);
          }
        }
      }

      this.refreshFreeSpinOverlay();   // enter / retrigger edge — banner shows before coin calcs

      // Mutable coin accumulators — Resonance adds extras, Streak multiplies;
      // wallet credit and cascade happen after all multipliers (below Streak section)
      let coinA = spin.sideA.coinWon;
      let coinB = spin.sideB.coinWon;

      AudioManager.playSfx('reel-spin-loop');
      await this.reel.spin(spin.grid);
      if (!this.running) return;

      // ── pace-01 Stage 1: 轉輪 SPIN — sfx fires as reel stops ────────────────
      this.playWinTierSfx(spin.sideA.wayHits, spin.sideB.wayHits);

      // Pace gap — let player see the stopped reel before highlights appear
      await delay(BattleScreen.PACE_AFTER_REEL_STOP);

      // ── pace-01 Stage 2: 對獎 REVEAL — wayHit highlight + JP particle burst ──
      // (parallel — same conceptual stage; both are visual results-of-spin)
      await Promise.all([
        this.reel.highlightWays(spin.sideA.wayHits, spin.sideB.wayHits),
        this.fireJackpots(spin.sideA.wayHits, spin.sideB.wayHits),
      ]);

      // chore: PAYLINES indicator — light up first N cells (N = total wayHit count, max 10)
      const totalHits = (spin.sideA.wayHits?.length ?? 0) + (spin.sideB.wayHits?.length ?? 0);
      this.updatePaylinesIndicator(totalHits);

      // ── Computation block (pure numerics — no awaiting, runs between stages) ──
      let dmgA = spin.sideA.dmgDealt;
      let dmgB = spin.sideB.dmgDealt;

      // ── M5 Resonance: ×1.5 on wayHits whose symbol clan is in boostedClans ──
      // Resonance first (per-wayHit clan-specific), Dragon bonus after.
      if (this.resonanceA.tier !== 'NONE') {
        for (const wh of spin.sideA.wayHits) {
          if (resonanceMultForClan(this.resonanceA, SYMBOLS[wh.symbolId].clan as ClanId) > 1) {
            coinA += Math.floor(wh.rawCoin * 0.5 * (this.cfg.betA / 100));
            dmgA  += Math.floor(wh.rawDmg  * 0.5 * (this.cfg.betA / 100));
          }
        }
      }
      if (this.resonanceB.tier !== 'NONE') {
        for (const wh of spin.sideB.wayHits) {
          if (resonanceMultForClan(this.resonanceB, SYMBOLS[wh.symbolId].clan as ClanId) > 1) {
            coinB += Math.floor(wh.rawCoin * 0.5 * (this.cfg.betB / 100));
            dmgB  += Math.floor(wh.rawDmg  * 0.5 * (this.cfg.betB / 100));
          }
        }
      }

      // ── Azure Dragon passive: +20% dmg on own-side 4+ match of dragon-clan symbols ──
      if (hasAliveOfClan(this.formationA, 'azure')) {
        for (const wh of spin.sideA.wayHits) {
          if (wh.matchCount >= 4 && SYMBOLS[wh.symbolId]?.clan === 'azure') {
            dmgA += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betA / 100));
          }
        }
      }
      if (hasAliveOfClan(this.formationB, 'azure')) {
        for (const wh of spin.sideB.wayHits) {
          if (wh.matchCount >= 4 && SYMBOLS[wh.symbolId]?.clan === 'azure') {
            dmgB += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betB / 100));
          }
        }
      }

      // ── M3 Streak Multiplier: applied after Resonance + dragon bonus ─────────
      // Coin and dmg both scaled; wallet credited and cascade kicked here.
      coinA = Math.floor(coinA * streakMult(this.streakA));
      coinB = Math.floor(coinB * streakMult(this.streakB));
      if (dmgA > 0) dmgA = Math.floor(dmgA * streakMult(this.streakA));
      if (dmgB > 0) dmgB = Math.floor(dmgB * streakMult(this.streakB));

      // ── M10 Free Spin: ×2 win multiplier (after Streak, before wallet credit) ──
      if (this.inFreeSpin) {
        coinA = Math.floor(coinA * BattleScreen.FREE_SPIN_WIN_MULT);
        coinB = Math.floor(coinB * BattleScreen.FREE_SPIN_WIN_MULT);
        if (dmgA > 0) dmgA = Math.floor(dmgA * BattleScreen.FREE_SPIN_WIN_MULT);
        if (dmgB > 0) dmgB = Math.floor(dmgB * BattleScreen.FREE_SPIN_WIN_MULT);
      }

      // ── bet=0 during Free Spin (both sides skip bet deduction) ──────────────
      const betA = this.inFreeSpin ? 0 : this.cfg.betA;
      const betB = this.inFreeSpin ? 0 : this.cfg.betB;
      this.walletA = this.walletA - betA + coinA;
      this.walletB = this.walletB - betB + coinB;
      this.cascadeWallet('A');
      this.cascadeWallet('B');

      // ── M12 JP pool accrual (j-02): 1% of total spin bet → progressive pools ──
      // Free Spin: betA/betB=0 → totalBetThisSpin=0 → no accrual (correct by design)
      const totalBetThisSpin = betA + betB;
      if (totalBetThisSpin > 0) {
        this.jackpotPools = accrueOnBet(this.jackpotPools, totalBetThisSpin);
        savePools(this.jackpotPools);
        this.refreshJackpotMarquee();   // j-05: pool grew, update display
        // Subtle grow pulse on minor text (fastest accruing tier — most visible growth)
        this.pulseJackpotText(this.jpMinorText, 'grow');
      }

      // ── Underdog boost: 1.3× damage when own HP ratio < 0.30 ──────────────
      const ratioA = teamHpTotal(this.formationA) / (this.cfg.unitHpA * this.cfg.selectedA.length);
      const ratioB = teamHpTotal(this.formationB) / (this.cfg.unitHpB * this.cfg.selectedB.length);
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

      // ── Update Streak for next round (after wayHits known) ────────────────
      if (spin.sideA.wayHits.length === 0) this.streakA = 0;
      else                                  this.streakA++;
      if (spin.sideB.wayHits.length === 0) this.streakB = 0;
      else                                  this.streakB++;

      // Capture pre-damage HP for overkill tiebreaker (must be before distributeDamage)
      lastPreHpA = teamHpTotal(this.formationA);
      lastPreHpB = teamHpTotal(this.formationB);
      lastDmgA = dmgA; lastDmgB = dmgB;

      // res-01: accumulate cumulative damage for ResultScreen stats
      this.totalDmgDealtAtoB += Math.max(0, dmgA);
      this.totalDmgDealtBtoA += Math.max(0, dmgB);

      // Pace gap — let player read the highlighted ways before attack fires
      await delay(BattleScreen.PACE_AFTER_REVEAL);

      // ── pace-01 Stage 3: 出招 ATTACK — spirit signature animations ────────
      await this.playAttackAnimations(spin.sideA.wayHits, spin.sideB.wayHits);

      // Pace gap — let FX residue settle before HP drain
      await delay(BattleScreen.PACE_AFTER_ATTACK);

      // ── pace-01 Stage 4: 算傷害 DAMAGE — distribute + HP drain animations ──
      const eventsOnB = dmgA > 0 ? distributeDamage(this.formationB, dmgA, 'A') : [];
      const eventsOnA = dmgB > 0 ? distributeDamage(this.formationA, dmgB, 'B') : [];

      // ── Vermilion Phoenix passive: +200 coin per enemy kill + coin burst visual ──
      const PHOENIX_COIN_PER_KILL = 200;   // m-04: tuned from 500 to bring total RTP under 100%
      if (hasAliveOfClan(this.formationA, 'vermilion')) {
        const kills = eventsOnB.filter(e => e.died);
        if (kills.length > 0) {
          this.walletA += kills.length * PHOENIX_COIN_PER_KILL * (this.cfg.betA / 100);
          this.cascadeWallet('A');
          const positions = kills.map(e => this.getFormationUnitWorldPos('B', e.slotIndex));
          this.playPhoenixCoinBurst('A', positions);
        }
      }
      if (hasAliveOfClan(this.formationB, 'vermilion')) {
        const kills = eventsOnA.filter(e => e.died);
        if (kills.length > 0) {
          this.walletB += kills.length * PHOENIX_COIN_PER_KILL * (this.cfg.betB / 100);
          this.cascadeWallet('B');
          const positions = kills.map(e => this.getFormationUnitWorldPos('A', e.slotIndex));
          this.playPhoenixCoinBurst('B', positions);
        }
      }

      const dmgFx: Promise<void>[] = [];
      if (eventsOnB.length) dmgFx.push(this.playDamageEvents(eventsOnB, 'B'));
      if (eventsOnA.length) dmgFx.push(this.playDamageEvents(eventsOnA, 'A'));
      await Promise.all(dmgFx);

      // Pace gap — 0.3s breath before JP / Curse / BigWin / next round
      await delay(BattleScreen.PACE_AFTER_DAMAGE);

      // ── M12 Jackpot trigger (j-03): detect 5-reel JP/Wild, draw tier, pay, reset ──
      await this.detectAndAwardJackpot(spin.grid);

      // ── d-05: Near-win detection — symbol covering exactly 4 of 5 reels ──────
      {
        const NON_SPECIAL_IDS = SYMBOLS
          .map((s, i) => (s.isWild || s.isCurse || s.isScatter || s.isJackpot) ? -1 : i)
          .filter(i => i >= 0);
        let nearWinTriggered = false;
        for (const symId of NON_SPECIAL_IDS) {
          if (nearWinTriggered) break;
          const coveredCols = new Set<number>();
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 5; c++) {
              if (spin.grid[r][c] === symId) coveredCols.add(c);
            }
          }
          if (coveredCols.size === 4) {
            let missingCol = -1;
            for (let c = 0; c < 5; c++) {
              if (!coveredCols.has(c)) { missingCol = c; break; }
            }
            if (missingCol >= 0) {
              const positions = [0, 1, 2].map(r => {
                const local = this.reel.cellLocal(missingCol, r);
                return { x: this.reel.x + local.x, y: this.reel.y + local.y };
              });
              const tint = T.CLAN_META[SYMBOLS[symId].clan]?.glow ?? 0xFFD37A;
              playNearWinTeaser(this.container, positions, tint);
              nearWinTriggered = true;
              if (import.meta.env.DEV) {
                console.log(`[NearWin] symbol=${SYMBOLS[symId].name} missingCol=${missingCol}`);
              }
            }
          }
        }
      }

      // ── d-07: Non-JP BigWin / MegaWin overlay (after wayHit + JP fx) ──────
      {
        const bigwinTierA = this._classifyBigWinTier(coinA, this.cfg.betA);
        const bigwinTierB = this._classifyBigWinTier(coinB, this.cfg.betB);
        const bigwinTier =
          (bigwinTierA === 'megawin' || bigwinTierB === 'megawin') ? 'megawin' :
          (bigwinTierA === 'bigwin'  || bigwinTierB === 'bigwin')  ? 'bigwin'  : null;
        if (bigwinTier) {
          const amount = Math.max(coinA, coinB);
          await playBigWinCeremony(this.container, bigwinTier, amount);
          if (import.meta.env.DEV) console.log(`[BigWin] tier=${bigwinTier} amount=${amount}`);
        }
      }

      // ── M6 Curse proc: 3+ stack → 500 HP flat damage to that side ──────────
      const CURSE_PROC_DMG = 500;
      const curseEventsOnA: DmgEvent[] = [];
      const curseEventsOnB: DmgEvent[] = [];

      if (this.curseStackA >= 3) {
        curseEventsOnA.push(...distributeDamage(this.formationA, CURSE_PROC_DMG, 'B'));
        // Flash HUD before reset (fire-and-forget — does not block combat flow)
        this.curseHudA.visible = true;
        this.curseHudA.scale.set(1.3);
        tween(250, t => {
          this.curseHudA.scale.set(1.3 - 0.3 * t);
          this.curseHudA.alpha = 1 - t;
        }, Easings.easeOut).then(() => {
          this.curseHudA.scale.set(1); this.curseHudA.alpha = 1; this.curseHudA.visible = false;
        });
        this.curseStackA = 0;
      }
      if (this.curseStackB >= 3) {
        curseEventsOnB.push(...distributeDamage(this.formationB, CURSE_PROC_DMG, 'A'));
        this.curseHudB.visible = true;
        this.curseHudB.scale.set(1.3);
        tween(250, t => {
          this.curseHudB.scale.set(1.3 - 0.3 * t);
          this.curseHudB.alpha = 1 - t;
        }, Easings.easeOut).then(() => {
          this.curseHudB.scale.set(1); this.curseHudB.alpha = 1; this.curseHudB.visible = false;
        });
        this.curseStackB = 0;
      }
      if (curseEventsOnA.length > 0) {
        this.logLines.push(`R${this.round.toString().padStart(2, '0')}  ⚡ Curse proc A −${CURSE_PROC_DMG}`);
        await this.playDamageEvents(curseEventsOnA, 'A');
      }
      if (curseEventsOnB.length > 0) {
        this.logLines.push(`R${this.round.toString().padStart(2, '0')}  ⚡ Curse proc B −${CURSE_PROC_DMG}`);
        await this.playDamageEvents(curseEventsOnB, 'B');
      }

      const tagA = ratioA < 0.30 ? '↑' : '';
      const tagB = ratioB < 0.30 ? '↑' : '';
      this.logLines.push(
        `R${this.round.toString().padStart(2, '0')}  ` +
        `A→B dmg ${dmgA}${tagA} (${spin.sideA.wayHits.length} ways)   ` +
        `B→A dmg ${dmgB}${tagB} (${spin.sideB.wayHits.length} ways)`,
      );
      this.refresh();

      // ── M10 Free Spin decrement at round end (all passives + damage settled) ──
      if (this.inFreeSpin) {
        this.freeSpinsRemaining--;
        if (this.freeSpinsRemaining <= 0) {
          this.inFreeSpin = false;
          this.freeSpinsRemaining = 0;
          if (import.meta.env.DEV) console.log('[FreeSpin] mode ended');
        }
      }
      this.refreshFreeSpinOverlay();   // count update or exit fade-out

      if (!this.running) return;
      await delay(ROUND_GAP_MS);
    }

    if (!this.running) return;

    // Ensure AUTO mode is cleared when match ends naturally
    this.stopAutoMode();

    // ── res-01: Determine outcome + emit MatchResult ──────────────────────────
    const aAlive = isTeamAlive(this.formationA);
    const bAlive = isTeamAlive(this.formationB);
    let outcome: MatchOutcome;
    if (aAlive && !bAlive) {
      outcome = 'A_WIN';
    } else if (!aAlive && bAlive) {
      outcome = 'B_WIN';
    } else if (!aAlive && !bAlive) {
      // Both died same round — higher overkill damage wins
      const overkillA = Math.max(0, lastDmgA - lastPreHpB);
      const overkillB = Math.max(0, lastDmgB - lastPreHpA);
      if      (overkillA > overkillB) outcome = 'A_OVERKILL';
      else if (overkillB > overkillA) outcome = 'B_OVERKILL';
      else                             outcome = 'DRAW';
    } else {
      outcome = 'DRAW';
    }

    this.logLines.push('');
    this.logLines.push(`>>> ${outcome} <<<`);
    this.refresh();

    const matchResult: MatchResult = {
      outcome,
      walletA_start: this.startWalletA,
      walletA_end:   this.walletA,
      walletB_start: this.startWalletB,
      walletB_end:   this.walletB,
      dmgDealtAtoB:  this.totalDmgDealtAtoB,
      dmgDealtBtoA:  this.totalDmgDealtBtoA,
      roundCount:    this.round,
      durationMs:    performance.now() - this.matchStartMs,
    };

    this.onMatchEnd(matchResult);
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
    // s12-ui-05: programmatic radial burst replaces win-burst.webp Sprite
    const burst = new Container();
    const cx = SLOT_X + REEL_W / 2;
    const cy = REEL_ZONE_Y + REEL_H / 2;
    burst.x = cx;
    burst.y = cy;
    burst.alpha = 0;
    burst.blendMode = 'add';
    this.fxLayer.addChild(burst);

    // Layer 1: Concentric circles (3 rings, alpha decreasing outward)
    const baseR = Math.max(REEL_W, REEL_H) * 0.6;
    const ring1 = new Graphics()
      .circle(0, 0, baseR * 0.4)
      .fill({ color: T.GOLD.glow, alpha: 0.5 });
    const ring2 = new Graphics()
      .circle(0, 0, baseR * 0.7)
      .fill({ color: T.GOLD.base, alpha: 0.30 });
    const ring3 = new Graphics()
      .circle(0, 0, baseR)
      .fill({ color: T.GOLD.shadow, alpha: 0.15 });
    burst.addChild(ring3);
    burst.addChild(ring2);
    burst.addChild(ring1);

    // Layer 2: 12 radial rays
    const rays = new Graphics();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const inner = baseR * 0.3;
      const outer = baseR * 1.1;
      rays.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      rays.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    rays.stroke({ width: 3, color: T.GOLD.glow, alpha: 0.8 });
    burst.addChild(rays);

    // Tween: 700ms — flash up + fade + expand + slight rotation
    await tween(700, p => {
      // Alpha envelope: rapid in (0-20%), slow out (20-100%)
      if (p < 0.2) burst.alpha = p / 0.2 * 0.85;
      else          burst.alpha = 0.85 * (1 - (p - 0.2) / 0.8);
      // Scale expand 1.0 → 1.3
      burst.scale.set(1 + p * 0.3);
      // Slight rotation
      burst.rotation = p * 0.35;
    });
    burst.destroy({ children: true });
  }

  // ─── Formation position helper ───────────────────────────────────────────
  /** World-space {x, y} of the unit at slotIndex in the given side's staggered arena layout. */
  private getFormationUnitWorldPos(side: 'A' | 'B', slotIndex: number): { x: number; y: number } {
    // Delegates to the same helper used by popDamage — both use the staggered arena layout (c-02).
    return this.slotToArenaPos(side, slotIndex);
  }

  // ─── Phoenix coin burst ───────────────────────────────────────────────────
  /**
   * Phoenix coin-on-kill visual feedback (fire-and-forget — do NOT await).
   * Spawns spinning gold coins at each killed unit's world position;
   * each coin arcs along a quadratic Bézier curve toward the attacker's wallet label.
   */
  private playPhoenixCoinBurst(side: 'A' | 'B', killPositions: { x: number; y: number }[]): void {
    const wallet  = side === 'A' ? this.walletTextA : this.walletTextB;
    const targetX = wallet.x;
    const targetY = wallet.y;

    const COINS_PER_KILL   = 5;
    const FLIGHT_DUR       = 700;
    const SPAWN_JITTER     = 80;
    const ROTATION_FRAMES  = [
      'Coin/Coin_01', 'Coin/Coin_03', 'Coin/Coin_05', 'Coin/Coin_07', 'Coin/Coin_09',
    ] as const;

    for (const pos of killPositions) {
      for (let i = 0; i < COINS_PER_KILL; i++) {
        const key  = ROTATION_FRAMES[i % ROTATION_FRAMES.length];
        const coin = FXAtlas.sprite(`sos2-bigwin:${key}`);
        coin.x = pos.x + (Math.random() - 0.5) * SPAWN_JITTER;
        coin.y = pos.y + (Math.random() - 0.5) * SPAWN_JITTER;
        coin.scale.set(0.35);
        coin.alpha  = 1;
        coin.zIndex = 500;    // above formations + HP bars
        this.container.addChild(coin);

        // Quadratic Bézier arc parameters
        const startX = coin.x;
        const startY = coin.y;
        const endX   = targetX + (Math.random() - 0.5) * 30;
        const endY   = targetY;
        const midX   = (startX + endX) / 2;
        const midY   = Math.min(startY, endY) - 80 - Math.random() * 60;

        const delayMs = i * 40 + Math.random() * 60;   // staggered fire

        // Fire-and-forget IIFE — never added to the round's fx[] array
        void (async () => {
          if (delayMs > 0) await delay(delayMs);
          if (coin.destroyed) return;
          await tween(FLIGHT_DUR, t => {
            const inv = 1 - t;
            coin.x = inv * inv * startX + 2 * inv * t * midX + t * t * endX;
            coin.y = inv * inv * startY + 2 * inv * t * midY + t * t * endY;
            coin.scale.set(0.35 + 0.35 * t);         // 0.35 → 0.70 grow while flying
            coin.rotation += 0.25;                    // continuous tumble
            if (t > 0.75) coin.alpha = (1 - t) * 4;  // fade in last 25% of arc
          }, Easings.easeOut);
          if (!coin.destroyed) coin.destroy();
        })();
      }
    }
  }

  // ─── Damage number popups ────────────────────────────────────────────────
  private async playDamageEvents(events: DmgEvent[], targetSide: 'A' | 'B'): Promise<void> {
    const pops = events.map(e => this.popDamage(targetSide, e.slotIndex, e.damageTaken));
    await Promise.all(pops);
  }

  // ─── d-07: BigWin / MegaWin threshold helper ────────────────────────────

  private _classifyBigWinTier(coin: number, bet: number): 'bigwin' | 'megawin' | null {
    if (bet <= 0) return null;
    const x = coin / bet;
    if (x >= BattleScreen.MEGAWIN_THRESHOLD_X) return 'megawin';
    if (x >= BattleScreen.BIGWIN_THRESHOLD_X)  return 'bigwin';
    return null;
  }

  // ─── M12 Jackpot trigger (j-03) ─────────────────────────────────────────

  /**
   * j-03: Detect 5-of-a-kind JP/Wild on shared grid. On hit:
   * (1) draw tier (3/12/85 weighted), (2) split pool 50/50 to both wallets,
   * (3) reset that pool to seed, (4) persist, (5) play placeholder visual.
   */
  private async detectAndAwardJackpot(grid: number[][]): Promise<void> {
    const JP_ID   = SYMBOLS.findIndex(s => s.isJackpot);
    const WILD_ID = SYMBOLS.findIndex(s => s.isWild);
    if (JP_ID < 0) return;

    // Each of 5 reels must have ≥1 JP-or-Wild cell
    const reelsCovered = new Set<number>();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const id = grid[r][c];
        if (id === JP_ID || id === WILD_ID) reelsCovered.add(c);
      }
    }
    if (reelsCovered.size < 5) return;

    // Tier draw: 3% Grand / 12% Major / 85% Minor
    const rnd = Math.random();
    const tier: 'grand' | 'major' | 'minor' = rnd < 0.03 ? 'grand' : rnd < 0.15 ? 'major' : 'minor';

    // Read pool, split 50/50, reset, persist
    const award = this.jackpotPools[tier];
    const halfAward = Math.floor(award / 2);
    this.walletA += halfAward;
    this.walletB += halfAward;
    this.jackpotPools = resetPool(this.jackpotPools, tier);
    savePools(this.jackpotPools);
    this.refreshJackpotMarquee();   // j-05: marquee shows reset value before ceremony
    // Shrink pulse on the reset tier's text — visual cue that pool was "drained"
    const tierText = { minor: this.jpMinorText, major: this.jpMajorText, grand: this.jpGrandText }[tier];
    this.pulseJackpotText(tierText, 'shrink');

    if (import.meta.env.DEV) {
      console.log(`[Jackpot] TRIGGERED tier=${tier} award=${award} (each side +${halfAward})`);
    }

    // Stop AUTO on JP win so player witnesses the ceremony uninterrupted
    if (this.autoSpinsRemaining > 0) this.stopAutoMode();

    // Full ceremony (j-04)
    await playJackpotCeremony(this.container, tier, award);

    // Wallet text refresh
    this.cascadeWallet('A');
    this.cascadeWallet('B');
  }

  private async popDamage(side: 'A' | 'B', slotIndex: number, amount: number): Promise<void> {
    if (amount <= 0) return;
    // Use staggered arena position: torso centre = feet y − SPIRIT_H/2
    const pos = this.slotToArenaPos(side, slotIndex);
    const cx  = pos.x;
    const cy  = pos.y - SPIRIT_H / 2;

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
