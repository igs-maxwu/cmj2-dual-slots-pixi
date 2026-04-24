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
import type { WayHit } from '@/systems/SlotEngine';
import { mercenaryWeakFx } from '@/fx/MercenaryFx';
import { AmbientBackground } from './AmbientBackground';
import { VsBadgeAnimator } from '@/fx/VsBadgeAnimator';
import { goldText } from '@/components/GoldText';
import { AmbientParticles } from '@/fx/AmbientParticles';
import { AudioManager } from '@/systems/AudioManager';
import { FXAtlas } from '@/fx/FXAtlas';

// ─── Portrait layout 720×1280 ───────────────────────────────────────────────
const HEADER_Y   = 14;

// Jackpot area placeholder (y=138…338)
const JP_AREA_Y = 138;
const JP_AREA_H = 200;

// Wallet labels — centred over former team HP bar zones (freed space y=70-130)
const WALLET_A_X = 151;   // left-side centre  (≈ CANVAS_WIDTH * 0.21)
const WALLET_B_X = 569;   // right-side centre (≈ CANVAS_WIDTH * 0.79)
const WALLET_Y   = 52;    // just above JP marquee area

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

  constructor(private cfg: DraftResult, private onExit: () => void) {}

  // ─── Screen lifecycle ────────────────────────────────────────────────────
  async onMount(app: Application, stage: Container): Promise<void> {
    this.app = app;

    // ── Loading overlay: visible while FX atlases download (~600 KB) ─────────
    stage.addChild(this.container);
    const overlay = new Graphics()
      .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .fill({ color: T.SEA.abyss });
    const loadingText = new Text({
      text: '進入戰場中…',
      style: {
        fontFamily:    T.FONT.display,
        fontSize:      T.FONT_SIZE.h1,
        fill:          T.GOLD.base,
        letterSpacing: 4,
      },
    });
    loadingText.anchor.set(0.5);
    loadingText.x = CANVAS_WIDTH / 2;
    loadingText.y = CANVAS_HEIGHT / 2;
    this.container.addChild(overlay);
    this.container.addChild(loadingText);

    // FX atlases deferred from main.ts — FXAtlas.load() is idempotent
    // (sheets.has() guard), so second-match entry is instant.
    await FXAtlas.load([
      { name: 'sos2-bigwin',       atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-bigwin.atlas` },
      { name: 'sos2-near-win',     atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-near-win.atlas` },
      { name: 'sos2-declare-fire', atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-declare-fire.atlas` },
    ]);

    overlay.destroy();
    loadingText.destroy();
    // ─────────────────────────────────────────────────────────────────────────

    await AudioManager.init();
    AudioManager.playBgm('battle', true);
    this.bg = new AmbientBackground(app);
    stage.addChildAt(this.bg, 0);          // bg behind container (z: bg=0, container=1)
    this.particles = new AmbientParticles(app);
    stage.addChildAt(this.particles, 1);   // particles behind container (z: bg=0, particles=1, container=2)
    this.formationA = createFormation(this.cfg.selectedA, this.cfg.unitHpA);
    this.formationB = createFormation(this.cfg.selectedB, this.cfg.unitHpB);
    this.walletA = this.cfg.walletA ?? 10000;
    this.walletB = this.cfg.walletB ?? 10000;
    this.displayedWalletA = this.walletA;
    this.displayedWalletB = this.walletB;

    this.drawBackground();
    addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 130, 0.55);
    this.drawHeader();
    this.drawWallets();
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


  private drawWallets(): void {
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
    // Opaque ink-wash panel behind jp-marquee PNG (prevents transparent checkerboard bleed)
    const bgPanel = new Graphics()
      .roundRect(16, JP_AREA_Y, CANVAS_WIDTH - 32, JP_AREA_H, T.RADIUS.lg)
      .fill({ color: T.SEA.deep, alpha: 0.85 })
      .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
    this.container.addChild(bgPanel);

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

  // ─── Frame refresh (non-animated parts) ──────────────────────────────────
  private refresh(): void {
    this.roundText.text = `ROUND ${String(this.round).padStart(2, '0')}`;
    this.refreshFormation('A', this.formationA, this.cellsA);
    this.refreshFormation('B', this.formationB, this.cellsB);
    this.logText.text = this.logLines.slice(-3).join('\n');
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

      const spin = this.engine.spin(
        pool,
        this.cfg.selectedA, this.cfg.selectedB,
        this.cfg.betA, this.cfg.betB,
        this.cfg.coinScaleA, this.cfg.dmgScaleA,
        this.cfg.coinScaleB, this.cfg.dmgScaleB,
        this.cfg.fairnessExp,
      );
      if (!this.running) return;

      // Deduct bet, credit streak-boosted winnings, kick cascade animation (non-blocking)
      // M3 Streak Multiplier applies to coin (uses streak from previous round)
      const coinA = Math.floor(spin.sideA.coinWon * streakMult(this.streakA));
      const coinB = Math.floor(spin.sideB.coinWon * streakMult(this.streakB));
      this.walletA = this.walletA - this.cfg.betA + coinA;
      this.walletB = this.walletB - this.cfg.betB + coinB;
      this.cascadeWallet('A');
      this.cascadeWallet('B');

      AudioManager.playSfx('reel-spin-loop');
      await this.reel.spin(spin.grid);
      if (!this.running) return;

      this.playWinTierSfx(spin.sideA.wayHits, spin.sideB.wayHits);
      const lineFx = this.reel.highlightWays(spin.sideA.wayHits, spin.sideB.wayHits);
      const jackpotFx = this.fireJackpots(spin.sideA.wayHits, spin.sideB.wayHits);
      // Spirit attack choreography (concurrent with way highlights)
      const attackFx = this.playAttackAnimations(spin.sideA.wayHits, spin.sideB.wayHits);

      let dmgA = spin.sideA.dmgDealt;
      let dmgB = spin.sideB.dmgDealt;

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

      // ── M3 Streak Multiplier: consecutive wins build ×1 → ×2 cap; miss resets ──
      // Applied after dragon bonus (global round multiplier on top of per-wayHit bonus).
      if (dmgA > 0) dmgA = Math.floor(dmgA * streakMult(this.streakA));
      if (dmgB > 0) dmgB = Math.floor(dmgB * streakMult(this.streakB));

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

      // Capture pre-damage HP for overkill tiebreaker
      lastPreHpA = teamHpTotal(this.formationA);
      lastPreHpB = teamHpTotal(this.formationB);
      lastDmgA = dmgA; lastDmgB = dmgB;

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

      const fx: Promise<void>[] = [lineFx, jackpotFx, attackFx];
      if (eventsOnB.length) fx.push(this.playDamageEvents(eventsOnB, 'B'));
      if (eventsOnA.length) fx.push(this.playDamageEvents(eventsOnA, 'A'));
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
