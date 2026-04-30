import { Application, Assets, Container, Graphics, Text } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
import { attackTimeline } from './SpiritAttackChoreographer';

// Reverse lookup: signature name → spirit that carries it
const SIG_SPIRIT: Record<string, { spiritKey: string; symbolId: number }> = {
  'lightning-xcross':  { spiritKey: 'canlan',        symbolId: 4 },
  'triple-dash':       { spiritKey: 'luoluo',        symbolId: 5 },
  'dual-fireball':     { spiritKey: 'zhuluan',       symbolId: 1 },
  'python-summon':     { spiritKey: 'zhaoyu',        symbolId: 2 },
  'dragon-dual-slash': { spiritKey: 'mengchenzhang', symbolId: 3 },
  'tiger-fist-combo':        { spiritKey: 'yin',           symbolId: 0 },
  'tortoise-hammer-smash':   { spiritKey: 'xuanmo',        symbolId: 7 },
  'phoenix-flame-arrow':     { spiritKey: 'lingyu',        symbolId: 6 },
  'generic':                 { spiritKey: 'canlan',        symbolId: 4 },
};

export const FX_SIGNATURES: string[] = Object.keys(SIG_SPIRIT);

export class FXPreviewScreen implements Screen {
  private container = new Container();
  private stage!: Container;
  private looping = false;
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _pauseResolve: (() => void) | null = null;

  constructor(
    private signatureName: string,
    private onExit: () => void,
  ) {}

  async onMount(_app: Application, stage: Container): Promise<void> {
    this.stage = stage;
    stage.addChild(this.container);
    this.drawStaticUI();

    const spirit = SIG_SPIRIT[this.signatureName];
    if (!spirit) {
      this.showError(`Unknown signature: "${this.signatureName}"`);
      this.installKeys();
      return;
    }

    // Lazy-load only the required spirit texture
    const sym = SYMBOLS[spirit.symbolId];
    const base = import.meta.env.BASE_URL;
    await Assets.load([{ alias: sym.spiritKey, src: `${base}assets/spirits/${sym.spiritKey}.webp` }]);

    this.installKeys();
    this.looping = true;
    void this.playSignatureLoop(spirit.spiritKey, spirit.symbolId);
  }

  onUnmount(): void {
    this.looping = false;
    if (this._pauseResolve) { this._pauseResolve(); this._pauseResolve = null; }
    if (this._onKeyDown) { window.removeEventListener('keydown', this._onKeyDown); this._onKeyDown = null; }
    this.container.destroy({ children: true });
  }

  private drawStaticUI(): void {
    const bg = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(T.SEA.abyss);
    this.container.addChild(bg);

    // Subtle radial glow at centre
    const glow = new Graphics();
    for (let i = 3; i >= 0; i--) {
      glow.circle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 200 + i * 60)
        .fill({ color: T.SEA.deep, alpha: 0.10 });
    }
    this.container.addChild(glow);

    // Target position markers (simulate enemy formation cells)
    for (const tp of this.targetPositions()) {
      const marker = new Graphics();
      marker.circle(tp.x, tp.y, 18).fill({ color: T.SEA.rim, alpha: 0.50 });
      marker.circle(tp.x, tp.y, 18).stroke({ width: 1.5, color: T.SEA.mid, alpha: 0.70 });
      this.container.addChild(marker);
    }

    // Header: "FX PREVIEW · <signature>"
    const header = new Text({
      text: `FX PREVIEW · ${this.signatureName}`,
      style: {
        fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.lg,
        fill: T.GOLD.base, letterSpacing: 4,
      },
    });
    header.anchor.set(0.5, 0);
    header.x = CANVAS_WIDTH / 2;
    header.y = 32;
    this.container.addChild(header);

    // Footer hint
    const footer = new Text({
      text: 'SPACE replay · ESC return',
      style: {
        fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.sm,
        fill: T.FG.muted, letterSpacing: 2,
      },
    });
    footer.anchor.set(0.5, 1);
    footer.x = CANVAS_WIDTH / 2;
    footer.y = CANVAS_HEIGHT - 24;
    this.container.addChild(footer);
  }

  private showError(msg: string): void {
    const err = new Text({
      text: msg,
      style: { fontFamily: T.FONT.body, fontSize: T.FONT_SIZE.md, fill: 0xff4444 },
    });
    err.anchor.set(0.5, 0.5);
    err.x = CANVAS_WIDTH / 2;
    err.y = CANVAS_HEIGHT / 2;
    this.container.addChild(err);
  }

  private targetPositions(): { x: number; y: number }[] {
    const y = Math.round(CANVAS_HEIGHT * 0.72);
    return [
      { x: Math.round(CANVAS_WIDTH * 0.35), y },
      { x: Math.round(CANVAS_WIDTH * 0.50), y },
      { x: Math.round(CANVAS_WIDTH * 0.65), y },
    ];
  }

  private async playSignatureLoop(spiritKey: string, symbolId: number): Promise<void> {
    while (this.looping) {
      // chore: attackTimeline now animates a spiritContainer directly — use temp container for preview
      const previewSpirit = new Container();
      previewSpirit.x = Math.round(CANVAS_WIDTH  * 0.20);
      previewSpirit.y = Math.round(CANVAS_HEIGHT * 0.50);
      this.stage.addChild(previewSpirit);
      await attackTimeline({
        stage:           this.stage,
        spiritContainer: previewSpirit,
        symbolId,
        spiritKey,
        targetPositions: this.targetPositions(),
      });
      previewSpirit.destroy();
      if (!this.looping) break;
      // 800 ms pause; Space key resolves early via _pauseResolve
      await new Promise<void>(resolve => {
        this._pauseResolve = resolve;
        setTimeout(() => { this._pauseResolve = null; resolve(); }, 800);
      });
      this._pauseResolve = null;
    }
  }

  private installKeys(): void {
    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        this.onExit();
      } else if (e.code === 'Space') {
        // Skip the 800 ms inter-loop pause; can't interrupt mid-animation
        if (this._pauseResolve) {
          this._pauseResolve();
          this._pauseResolve = null;
        }
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }
}
