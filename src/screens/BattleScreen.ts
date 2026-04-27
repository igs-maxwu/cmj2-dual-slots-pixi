import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
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

// ─── Portrait layout 720×1280 ───────────────────────────────────────────────
const HEADER_Y   = 14;

// ── v-01: Top UI bar ────────────────────────────────────────────────────────
const TOP_BAR_H = 45;
const TOP_BAR_Y = 0;

// Jackpot area placeholder (y=138…338)
const JP_AREA_Y = 138;
const JP_AREA_H = 200;
// v-02: 2-row marquee split
const JP_GRAND_H  = 70;                       // upper row — GRAND
const JP_BOTTOM_H = JP_AREA_H - JP_GRAND_H;   // lower row — MAJOR + MINOR (130)

// Wallet labels — centred over former team HP bar zones (freed space y=70-130)
const WALLET_A_X = 151;   // left-side centre  (≈ CANVAS_WIDTH * 0.21)
const WALLET_B_X = 569;   // right-side centre (≈ CANVAS_WIDTH * 0.79)
const WALLET_Y   = 78;    // v-01: raised from 52 → 78 to clear top bar + title

// Slot reel — centred, pushed below formations
const SLOT_X     = Math.round((CANVAS_WIDTH - REEL_W) / 2);
const SLOT_Y     = 610;

// Log and back button pinned to bottom
const LOG_Y      = 1150;
const BACK_BTN_Y = CANVAS_HEIGHT - 50;

const ROUND_GAP_MS = 500; // pause between rounds

// ─── Free-standing arena layout (replaces 3×3 cell grid; data model unchanged) ────
// Two staggered rows: front row (3 chars, lower) + back row (2 chars, higher = further back)
const SPIRIT_H              = 130;                          // rendered sprite height (px)
const ARENA_Y_FRONT         = 460;                          // front-row feet baseline y
const ARENA_Y_BACK          = ARENA_Y_FRONT - 34;           // back row 34px higher (depth)
const ARENA_SPACING_FRONT_X = 72;                           // horiz gap between front spirits
const ARENA_SPACING_BACK_X  = 92;                           // back spirits wider apart
const ARENA_A_CENTER_X      = 176;                          // A-side front-row pivot x
const ARENA_B_CENTER_X      = CANVAS_WIDTH - 176;           // B-side mirror

// Per-unit HP bar (inside each spirit container)
const UNIT_HP_BAR_W     = 64;
const UNIT_HP_BAR_H     = 6;
const UNIT_HP_BAR_Y_OFF = -SPIRIT_H - 22;   // above the spirit head

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
  private vsBadge!: VsBadgeAnimator;
  private container = new Container();
  private roundText!: Text;
  /** v-01: Top UI bar (menu / round pill / store) */
  private topBar!: Container;
  private menuIcon!: Text;
  private storeIcon!: Text;
  private roundPill!: Container;
  /** v-01: Player A/B labels above wallet text */
  private playerLabelA!: Text;
  private playerLabelB!: Text;
  private _breatheTick: (() => void) | null = null;
  private cellsA: FormationCellRefs[] = [];
  private cellsB: FormationCellRefs[] = [];
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
  /** SPEC §15.8 M12 Jackpot pools — loaded from localStorage on mount, saved each spin (j-02) */
  private jackpotPools!: JackpotPools;

  constructor(private cfg: DraftResult, private onExit: () => void) {}

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
    this.formationA = createFormation(this.cfg.selectedA, this.cfg.unitHpA);
    this.formationB = createFormation(this.cfg.selectedB, this.cfg.unitHpB);
    this.resonanceA = detectResonance(this.cfg.selectedA);
    this.resonanceB = detectResonance(this.cfg.selectedB);
    this.walletA = this.cfg.walletA ?? 10000;
    this.walletB = this.cfg.walletB ?? 10000;
    this.displayedWalletA = this.walletA;
    this.displayedWalletB = this.walletB;

    this.drawBackground();
    addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 130, 0.55);
    this.drawTopBar();     // v-01: top bar first so header title sits below it
    this.drawHeader();
    this.drawWallets();
    this.jackpotPools = loadPools();
    if (import.meta.env.DEV) {
      console.log('[JackpotPool] loaded:', this.jackpotPools);
      const _t = accrueOnBet({ minor: 100, major: 100, grand: 100 }, 200);
      console.assert(Math.abs(_t.minor - 101) < 0.001, 'JackpotPool accrueOnBet minor');
      console.assert(Math.abs(_t.major - 100.6) < 0.001, 'JackpotPool accrueOnBet major');
      console.assert(Math.abs(_t.grand - 100.4) < 0.001, 'JackpotPool accrueOnBet grand');
      console.log('[JackpotPool] smoke check passed');
    }
    this.drawJackpotMarquee();
    this.refreshJackpotMarquee();   // j-05: show loaded pool values immediately
    this.drawFormation('A');
    this.drawFormation('B');
    this.drawSlot();
    this.drawVsBadge();
    this.drawLog();
    this.drawBackButton();
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
    // Sits in the freed top-bar zone, connecting Player A ↔ Player B.
    badge.x = CANVAS_WIDTH / 2;
    badge.y = 99;
    this.container.addChild(badge);
    this.vsBadge = new VsBadgeAnimator(badge, this.app, this.container);
  }

  onUnmount(): void {
    this.running = false;
    AudioManager.stopBgm();
    this.vsBadge.destroy();
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
  // v-03: dispatches to 4 visual sub-layers
  private drawBackground(): void {
    this.drawGridOverlay();
    this.drawPerspectiveFloor();
    this.drawEdgeVignette();
    this.drawSpiritShadows();
  }

  /** Solid base is provided by AmbientBackground; this layer adds the water-ink grid. */
  private drawGridOverlay(): void {
    const grid = new Graphics();
    for (let x = 0; x < CANVAS_WIDTH; x += 40) grid.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT);
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) grid.moveTo(0, y).lineTo(CANVAS_WIDTH, y);
    grid.stroke({ width: 1, color: T.SEA.deep, alpha: 0.25 });
    this.container.addChild(grid);
  }

  /** 8 radial lines from a vanishing point above the arena + 3 horizontal depth bands. */
  private drawPerspectiveFloor(): void {
    const horizonY  = ARENA_Y_FRONT - 30;
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
   * Ellipse ground shadows beneath each spirit slot.
   * Positions derived from slotToArenaPos (slots 0-4, both sides).
   *   A front (slots 1,2,4): x = 104, 176, 248
   *   A back  (slots 0,3):   x = 84,  268
   *   B front (slots 1,2,4): x = 616, 544, 472
   *   B back  (slots 0,3):   x = 636, 452
   */
  private drawSpiritShadows(): void {
    const A_FRONT_X = [104, 176, 248];
    const A_BACK_X  = [84,  268];
    const B_FRONT_X = [616, 544, 472];
    const B_BACK_X  = [636, 452];

    const shadow = new Graphics();
    for (const x of A_FRONT_X) shadow.ellipse(x, ARENA_Y_FRONT + 8, 32, 8).fill({ color: 0x000000, alpha: 0.4 });
    for (const x of A_BACK_X)  shadow.ellipse(x, ARENA_Y_BACK  + 8, 32, 8).fill({ color: 0x000000, alpha: 0.4 });
    for (const x of B_FRONT_X) shadow.ellipse(x, ARENA_Y_FRONT + 8, 32, 8).fill({ color: 0x000000, alpha: 0.4 });
    for (const x of B_BACK_X)  shadow.ellipse(x, ARENA_Y_BACK  + 8, 32, 8).fill({ color: 0x000000, alpha: 0.4 });
    this.container.addChild(shadow);
  }

  private drawHeader(): void {
    // v-01: title downsized (24→was 32) and placed below top bar
    const title = new Text({
      text: '雀靈戰記 · BATTLE',
      style: {
        fontFamily: T.FONT.title, fontWeight: '700', fontSize: 24,
        fill: T.GOLD.base, stroke: { color: T.GOLD.shadow, width: 2 }, letterSpacing: 2,
      },
    });
    title.anchor.set(0.5, 0);
    title.x = CANVAS_WIDTH / 2;
    title.y = TOP_BAR_H + 4;   // directly below top bar
    this.container.addChild(title);
    // roundText is now created in drawTopBar() inside the ROUND pill
  }

  // ── v-01: Top UI bar ────────────────────────────────────────────────────────
  private drawTopBar(): void {
    this.topBar = new Container();
    this.topBar.zIndex = 80;   // annotation; actual order = addChild sequence

    // Background — two Graphics layers simulate gradient (Pixi 8 has no native gradient fill)
    const bgTop = new Graphics()
      .rect(TOP_BAR_Y, 0, CANVAS_WIDTH, TOP_BAR_H * 0.5)
      .fill({ color: 0x003264, alpha: 0.95 });
    const bgBot = new Graphics()
      .rect(0, TOP_BAR_H * 0.5, CANVAS_WIDTH, TOP_BAR_H * 0.5)
      .fill({ color: 0x001E3C, alpha: 0.70 });
    // Bottom border — cyan accent line
    const border = new Graphics()
      .rect(0, TOP_BAR_H - 1.5, CANVAS_WIDTH, 1.5)
      .fill({ color: 0x00FFFF, alpha: 0.3 });

    this.topBar.addChild(bgTop);
    this.topBar.addChild(bgBot);
    this.topBar.addChild(border);

    // Left: menu icon (☰ placeholder — onClick wired in Phase 2)
    this.menuIcon = new Text({
      text: '☰',
      style: { fontFamily: T.FONT.body, fontSize: 28, fill: 0xFFFFFF },
    });
    this.menuIcon.anchor.set(0, 0.5);
    this.menuIcon.x = 14;
    this.menuIcon.y = TOP_BAR_H / 2;
    this.topBar.addChild(this.menuIcon);

    // Center: ROUND pill
    this.roundPill = new Container();
    this.roundPill.x = CANVAS_WIDTH / 2;
    this.roundPill.y = TOP_BAR_H / 2;

    const pillBg = new Graphics()
      .roundRect(-70, -16, 140, 32, 16)
      .fill({ color: 0x000000, alpha: 0.4 })
      .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
    this.roundPill.addChild(pillBg);

    // ROUND text — replaces the old drawHeader roundText; same this.roundText ref
    this.roundText = goldText('ROUND 00', { fontSize: 16, withShadow: true });
    this.roundText.anchor.set(0.5, 0.5);
    this.roundText.style.letterSpacing = 3;
    this.roundPill.addChild(this.roundText);
    this.topBar.addChild(this.roundPill);

    // Right: store icon (🎁 placeholder — onClick wired in Phase 2)
    this.storeIcon = new Text({
      text: '🎁',
      style: { fontFamily: T.FONT.body, fontSize: 22 },
    });
    this.storeIcon.anchor.set(1, 0.5);
    this.storeIcon.x = CANVAS_WIDTH - 14;
    this.storeIcon.y = TOP_BAR_H / 2;
    this.topBar.addChild(this.storeIcon);

    this.container.addChild(this.topBar);
  }


  private drawWallets(): void {
    // v-01: PLAYER A/B labels — placed above wallet text
    this.playerLabelA = new Text({
      text: 'PLAYER A',
      style: {
        fontFamily: T.FONT.body, fontWeight: '700',
        fontSize: 11, fill: T.CLAN.azureGlow,
        letterSpacing: 3,
      },
    });
    this.playerLabelA.anchor.set(0.5, 0);
    this.playerLabelA.x = WALLET_A_X;
    this.playerLabelA.y = WALLET_Y - 16;
    this.container.addChild(this.playerLabelA);

    this.playerLabelB = new Text({
      text: 'PLAYER B',
      style: {
        fontFamily: T.FONT.body, fontWeight: '700',
        fontSize: 11, fill: T.CLAN.vermilionGlow,
        letterSpacing: 3,
      },
    });
    this.playerLabelB.anchor.set(0.5, 0);
    this.playerLabelB.x = WALLET_B_X;
    this.playerLabelB.y = WALLET_Y - 16;
    this.container.addChild(this.playerLabelB);

    this.walletTextA = goldText(this.formatWallet(this.walletA), { fontSize: 16, withShadow: true });
    this.walletTextA.anchor.set(0.5, 0);
    this.walletTextA.x = WALLET_A_X;
    this.walletTextA.y = WALLET_Y;
    this.container.addChild(this.walletTextA);

    this.walletTextB = goldText(this.formatWallet(this.walletB), { fontSize: 16, withShadow: true });
    this.walletTextB.anchor.set(0.5, 0);
    this.walletTextB.x = WALLET_B_X;
    this.walletTextB.y = WALLET_Y;
    this.container.addChild(this.walletTextB);
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
  private drawJackpotMarquee(): void {
    // v-02: 2-row layout — GRAND full-width top, MAJOR + MINOR side-by-side bottom

    // Background panel — gold-bordered dark panel (jp-marquee PNG removed)
    const bgPanel = new Graphics()
      .roundRect(16, JP_AREA_Y, CANVAS_WIDTH - 32, JP_AREA_H, T.RADIUS.lg)
      .fill({ color: T.SEA.deep, alpha: 0.85 })
      .stroke({ width: 1.5, color: T.GOLD.shadow, alpha: 0.7 });
    this.container.addChild(bgPanel);

    // Horizontal hairline separator between row 1 (GRAND) and row 2 (MAJOR + MINOR)
    const sepY = JP_AREA_Y + JP_GRAND_H;
    const separator = new Graphics()
      .rect(40, sepY, CANVAS_WIDTH - 80, 1)
      .fill({ color: T.GOLD.shadow, alpha: 0.3 });
    this.container.addChild(separator);

    // Vertical hairline separator between MAJOR and MINOR in row 2
    const vSepX = CANVAS_WIDTH / 2;
    const vSeparator = new Graphics()
      .rect(vSepX, sepY + 12, 1, JP_BOTTOM_H - 24)
      .fill({ color: T.GOLD.shadow, alpha: 0.3 });
    this.container.addChild(vSeparator);

    // ── Row 1: GRAND 天獎 (full-width, large) ──────────────────────────────
    const grandRowCenterY = JP_AREA_Y + JP_GRAND_H / 2;

    const grandLabel = new Text({
      text: '天獎  GRAND',
      style: {
        fontFamily: T.FONT.body, fontWeight: '700',
        fontSize: 11, fill: T.GOLD.shadow, letterSpacing: 4,
      },
    });
    grandLabel.anchor.set(0.5, 0.5);
    grandLabel.x = CANVAS_WIDTH / 2;
    grandLabel.y = grandRowCenterY - 14;
    this.container.addChild(grandLabel);

    this.jpGrandText = goldText('5,000,000', { fontSize: 30, withShadow: true });
    this.jpGrandText.anchor.set(0.5, 0.5);
    this.jpGrandText.x = CANVAS_WIDTH / 2;
    this.jpGrandText.y = grandRowCenterY + 12;
    this.jpGrandText.filters = [new GlowFilter({
      color: 0xFFD37A, distance: 14, outerStrength: 2.5, innerStrength: 0.5, quality: 0.4,
    })];
    this.container.addChild(this.jpGrandText);

    // ── Row 2: MAJOR 地獎 (left half) + MINOR 人獎 (right half) ───────────
    const bottomRowCenterY = sepY + JP_BOTTOM_H / 2;
    const majorX = CANVAS_WIDTH * 0.25;
    const minorX = CANVAS_WIDTH * 0.75;

    const majorLabel = new Text({
      text: '地獎  MAJOR',
      style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 10, fill: T.GOLD.shadow, letterSpacing: 3 },
    });
    majorLabel.anchor.set(0.5, 0.5);
    majorLabel.x = majorX;
    majorLabel.y = bottomRowCenterY - 12;
    this.container.addChild(majorLabel);

    this.jpMajorText = goldText('500,000', { fontSize: 20, withShadow: true });
    this.jpMajorText.anchor.set(0.5, 0.5);
    this.jpMajorText.x = majorX;
    this.jpMajorText.y = bottomRowCenterY + 10;
    this.jpMajorText.filters = [new GlowFilter({
      color: 0xC9A961, distance: 10, outerStrength: 1.5, innerStrength: 0.4, quality: 0.4,
    })];
    this.container.addChild(this.jpMajorText);

    const minorLabel = new Text({
      text: '人獎  MINOR',
      style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 10, fill: T.GOLD.shadow, letterSpacing: 3 },
    });
    minorLabel.anchor.set(0.5, 0.5);
    minorLabel.x = minorX;
    minorLabel.y = bottomRowCenterY - 12;
    this.container.addChild(minorLabel);

    this.jpMinorText = goldText('50,000', { fontSize: 20, withShadow: true });
    this.jpMinorText.anchor.set(0.5, 0.5);
    this.jpMinorText.x = minorX;
    this.jpMinorText.y = bottomRowCenterY + 10;
    this.jpMinorText.filters = [new GlowFilter({
      color: 0xC9A961, distance: 10, outerStrength: 1.5, innerStrength: 0.4, quality: 0.4,
    })];
    this.container.addChild(this.jpMinorText);
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

  // ─── Free-standing formation ──────────────────────────────────────────────
  private drawFormation(side: 'A' | 'B'): void {
    const grid      = side === 'A' ? this.formationA : this.formationB;
    const cells     = side === 'A' ? this.cellsA     : this.cellsB;
    const glowColor = side === 'A' ? T.TEAM.azureGlow : T.TEAM.vermilionGlow;

    for (let slot = 0; slot < 9; slot++) {
      const unit = grid[slot];
      const pos  = this.slotToArenaPos(side, slot);

      const container = new Container();
      container.x = pos.x;
      container.y = pos.y;
      this.container.addChild(container);

      // Ground ellipse glow — breathes via ticker (visible only for alive units)
      const glowRing = new Graphics();
      if (unit) {
        const ew = SPIRIT_H * 0.9;
        glowRing.ellipse(0, 0, ew / 2, 7).fill({ color: glowColor, alpha: 1 });
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
          sprite.scale.set(SPIRIT_H / tex.height);
          // flip x for A-side so spirits face the centre (assets are facing-left by default).
          if (side === 'A') sprite.scale.x *= -1;
          container.addChild(sprite);
        }
      }

      // Per-unit HP bar — track (static bg) + fill (redrawn in refreshFormation)
      const hpTrack = new Graphics()
        .roundRect(-UNIT_HP_BAR_W / 2, UNIT_HP_BAR_Y_OFF, UNIT_HP_BAR_W, UNIT_HP_BAR_H, UNIT_HP_BAR_H / 2)
        .fill({ color: T.HP.track, alpha: 0.8 })
        .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
      hpTrack.visible = unit !== null;
      const hpFill = new Graphics();
      container.addChild(hpTrack);
      container.addChild(hpFill);

      // Death cross ✕ centred on torso (midpoint of sprite)
      const ch    = SPIRIT_H * 0.25;
      const midY  = -SPIRIT_H / 2;
      const crossMark = new Graphics()
        .moveTo(-ch, midY - ch).lineTo(ch, midY + ch)
        .moveTo( ch, midY - ch).lineTo(-ch, midY + ch)
        .stroke({ width: 3, color: T.FG.dim, alpha: 0.85 });
      crossMark.visible = false;
      container.addChild(crossMark);

      cells.push({ container, sprite, hpTrack, hpFill, glowRing, crossMark });
    }
  }

  /**
   * Maps a 3×3 formation slot index to the staggered arena position.
   * Slot layout mirrors the mockup: front row (3 chars) closer to centre VS,
   * back row (2 chars) higher up and further from centre (depth illusion).
   * B-side x offsets are mirrored (sprite also flipped via scale.x = -1).
   */
  private slotToArenaPos(side: 'A' | 'B', slot: number): { x: number; y: number } {
    const LAYOUT: ReadonlyArray<{ row: 'front' | 'back'; xOff: number }> = [
      { row: 'back',  xOff: -ARENA_SPACING_BACK_X   },  // slot 0
      { row: 'front', xOff: -ARENA_SPACING_FRONT_X  },  // slot 1
      { row: 'front', xOff:  0                      },  // slot 2
      { row: 'back',  xOff: +ARENA_SPACING_BACK_X   },  // slot 3
      { row: 'front', xOff: +ARENA_SPACING_FRONT_X  },  // slot 4
      { row: 'back',  xOff: -ARENA_SPACING_BACK_X  * 1.5 }, // slot 5 (extra)
      { row: 'front', xOff: -ARENA_SPACING_FRONT_X * 1.5 }, // slot 6 (extra)
      { row: 'back',  xOff: +ARENA_SPACING_BACK_X  * 1.5 }, // slot 7 (extra)
      { row: 'front', xOff: +ARENA_SPACING_FRONT_X * 1.5 }, // slot 8 (extra)
    ];
    const entry   = LAYOUT[slot] ?? LAYOUT[0];
    const centerX = side === 'A' ? ARENA_A_CENTER_X : ARENA_B_CENTER_X;
    const mirror  = side === 'B' ? -1 : 1;
    return {
      x: centerX + entry.xOff * mirror,
      y: entry.row === 'front' ? ARENA_Y_FRONT : ARENA_Y_BACK,
    };
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
    this.logText.x = 16;
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

  // ─── Curse stack HUD (k-04) ──────────────────────────────────────────────
  private drawCurseHud(): void {
    // A side — bottom-left of wallet area
    this.curseHudA = new Container();
    this.curseHudA.x = 16;  this.curseHudA.y = 130;
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
    this.curseHudB.x = CANVAS_WIDTH - 16;  this.curseHudB.y = 130;
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
    this.freeSpinBanner.y = 80;
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
    for (let i = 0; i < 9; i++) {
      const ref  = cells[i];
      const unit = grid[i];
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
            // Fresh trigger — this spin and next 4 are free + ×2
            this.inFreeSpin = true;
            this.freeSpinsRemaining = BattleScreen.FREE_SPIN_COUNT;
            if (import.meta.env.DEV) console.log(`[FreeSpin] TRIGGERED — ${scatterThisSpin} scatters → 5 spins`);
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
