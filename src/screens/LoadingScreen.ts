import { Application, Assets, Container, Graphics, Text } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
import { addCornerOrnaments } from '@/components/Decorations';

const TRACK_W = 440;
const TRACK_H = 14;

export class LoadingScreen implements Screen {
  private container = new Container();
  private statusText!: Text;
  private progressBar!: Graphics;
  private trackX = 0;
  private trackY = 0;
  private titleText: Text | null = null;
  private subText: Text | null = null;

  constructor(private onDone: () => void) {}

  async onMount(_app: Application, stage: Container): Promise<void> {
    stage.addChild(this.container);
    this.drawBackground();
    this.drawTitle();
    this.drawProgress();
    // s12-ui-06: all decorations are programmatic — no UI preload needed
    this.upgradeToDecoratedLoadingScreen();

    // Spirit portraits + SOS2 FX webps needed by SpiritAttackChoreographer (d-04)
    await Promise.all([this.preloadSpirits(), this.preloadFx()]);
    this.onDone();
  }

  onUnmount(): void {
    this.container.destroy({ children: true });
  }

  private drawBackground(): void {
    const bg = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(T.SEA.abyss);
    this.container.addChild(bg);

    // Subtle concentric glow
    const glow = new Graphics();
    for (let i = 4; i >= 0; i--) {
      glow.circle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 260 + i * 50)
        .fill({ color: T.SEA.deep, alpha: 0.08 });
    }
    this.container.addChild(glow);
  }

  private drawTitle(): void {
    this.titleText = new Text({
      text: '雀靈戰記',
      style: {
        fontFamily: T.FONT.display, fontWeight: '700', fontSize: T.FONT_SIZE.hero,
        fill: T.GOLD.base, stroke: { color: T.GOLD.shadow, width: 6 },
        letterSpacing: 8,
      },
    });
    this.titleText.anchor.set(0.5, 0.5);
    this.titleText.x = CANVAS_WIDTH / 2;
    this.titleText.y = CANVAS_HEIGHT / 2 - 70;
    this.container.addChild(this.titleText);

    this.subText = new Text({
      text: 'DUAL SLOTS BATTLE',
      style: {
        fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.md,
        fill: T.FG.muted, letterSpacing: 12,
      },
    });
    this.subText.anchor.set(0.5, 0.5);
    this.subText.x = CANVAS_WIDTH / 2;
    this.subText.y = CANVAS_HEIGHT / 2 - 10;
    this.container.addChild(this.subText);
  }

  private drawProgress(): void {
    this.trackX = (CANVAS_WIDTH - TRACK_W) / 2;
    this.trackY = CANVAS_HEIGHT / 2 + 80;

    const track = new Graphics()
      .roundRect(this.trackX, this.trackY, TRACK_W, TRACK_H, TRACK_H / 2)
      .fill(T.HP.track)
      .stroke({ width: 1, color: T.GOLD.deep, alpha: 0.7 });
    this.container.addChild(track);

    this.progressBar = new Graphics();
    this.container.addChild(this.progressBar);

    this.statusText = new Text({
      text: 'Loading  0/0',
      style: {
        fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.md,
        fill: T.FG.cream, letterSpacing: 2,
      },
    });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.x = CANVAS_WIDTH / 2;
    this.statusText.y = this.trackY + TRACK_H + 14;
    this.container.addChild(this.statusText);
  }

  /** Once UI textures load, swap the plain text title for the logo mark +
   *  divider and add decorative corners. */
  private upgradeToDecoratedLoadingScreen(): void {
    // Corner ornaments
    addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 150, 0.6);

    // s12-ui-02: replace logo-mark sprite with stylized programmatic title
    // (titleText already drawn by drawTitle() — keep visible, just upgrade visual)
    if (this.titleText) {
      // Enhance existing titleText with stronger glow + slightly larger scale
      this.titleText.style.dropShadow = {
        color: T.GOLD.glow,
        alpha: 0.8,
        blur: 12,
        distance: 0,
        angle: 0,
      };
      this.titleText.scale.set(1.2);
    }

    // s12-ui-02: programmatic divider line replaces divider.webp Sprite
    const dividerY = CANVAS_HEIGHT / 2 + 30;
    const dividerW = 560;
    const dividerX = (CANVAS_WIDTH - dividerW) / 2;
    const dividerLine = new Graphics()
      .moveTo(dividerX, dividerY).lineTo(dividerX + dividerW, dividerY)
      .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.85 });
    this.container.addChild(dividerLine);

    // Decorative dot in center of divider (visual interest)
    const dividerDot = new Graphics()
      .circle(CANVAS_WIDTH / 2, dividerY, 3)
      .fill({ color: T.GOLD.base });
    this.container.addChild(dividerDot);
  }

  private async preloadSpirits(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    const assets = SYMBOLS.filter(s => !s.isWild && !s.isCurse && !s.isScatter && !s.isJackpot).map(s => ({
      alias: s.spiritKey,
      src:   `${base}assets/spirits/${s.spiritKey}.webp`,
    }));
    const total = assets.length;
    this.updateProgress(0, total, 'Loading spirits');
    await Assets.load(assets, (p: number) => {
      this.updateProgress(Math.round(p * total), total, 'Loading spirits');
    });
    this.updateProgress(total, total, 'Loading spirits');
  }

  /** d-04: SOS2 single-webp FX sheets used by SpiritAttackChoreographer */
  private async preloadFx(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    await Assets.load([
      { alias: 'sos2-fire-wave',     src: `${base}assets/fx/sos2-fire-wave.webp` },
      { alias: 'sos2-particles',     src: `${base}assets/fx/sos2-particles.webp` },
      { alias: 'sos2-radial-lights', src: `${base}assets/fx/sos2-radial-lights.webp` },
      { alias: 'sos2-win-frame',     src: `${base}assets/fx/sos2-win-frame.webp` },   // d-06
    ]);
  }

  private updateProgress(loaded: number, total: number, label: string): void {
    const ratio = total === 0 ? 0 : loaded / total;
    this.progressBar.clear()
      .roundRect(this.trackX, this.trackY, TRACK_W * ratio, TRACK_H, TRACK_H / 2)
      .fill(T.GOLD.base);
    this.statusText.text = `${label}  ${loaded}/${total}`;
  }
}
