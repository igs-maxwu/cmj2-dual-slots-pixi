import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
import { UI_ASSET_KEYS } from '@/config/UiAssets';
import { addCornerOrnaments } from '@/components/Decorations';

const TRACK_W = 440;
const TRACK_H = 14;

export class LoadingScreen implements Screen {
  private container = new Container();
  private statusText!: Text;
  private progressBar!: Graphics;
  private trackX = 0;
  private trackY = 0;
  private logo: Sprite | null = null;
  private titleText: Text | null = null;

  constructor(private onDone: () => void) {}

  async onMount(_app: Application, stage: Container): Promise<void> {
    stage.addChild(this.container);
    this.drawBackground();
    this.drawTitle();
    this.drawProgress();

    // Pre-load the UI bundle first (small & fast), so decorations paint
    // onto the SAME loading screen before the heavy spirits load.
    await this.preloadUi();
    this.upgradeToDecoratedLoadingScreen();

    // Now the heavy spirits
    await this.preloadSpirits();
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

    const sub = new Text({
      text: 'DUAL SLOTS BATTLE',
      style: {
        fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.md,
        fill: T.FG.muted, letterSpacing: 12,
      },
    });
    sub.anchor.set(0.5, 0.5);
    sub.x = CANVAS_WIDTH / 2;
    sub.y = CANVAS_HEIGHT / 2 - 10;
    this.container.addChild(sub);
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

    // Logo mark — replace the plain title if texture is available
    const logoTex = Assets.get<Texture>('logo-mark');
    if (logoTex) {
      this.logo = new Sprite(logoTex);
      this.logo.anchor.set(0.5, 0.5);
      const maxW = 720;
      const scale = maxW / logoTex.width;
      this.logo.scale.set(scale);
      this.logo.x = CANVAS_WIDTH / 2;
      this.logo.y = CANVAS_HEIGHT / 2 - 90;
      this.container.addChild(this.logo);
      if (this.titleText) this.titleText.visible = false;
    }

    // Divider under subtitle
    const divTex = Assets.get<Texture>('divider');
    if (divTex) {
      const div = new Sprite(divTex);
      div.anchor.set(0.5, 0.5);
      const w = 560;
      div.scale.set(w / divTex.width);
      div.x = CANVAS_WIDTH / 2;
      div.y = CANVAS_HEIGHT / 2 + 30;
      div.alpha = 0.85;
      this.container.addChild(div);
    }
  }

  private async preloadUi(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    const assets = UI_ASSET_KEYS.map(k => ({
      alias: k,
      src:   `${base}assets/ui/${k}.png`,
    }));
    const total = assets.length;
    this.updateProgress(0, total, 'Loading UI');
    await Assets.load(assets, (p: number) => {
      this.updateProgress(Math.round(p * total), total, 'Loading UI');
    });
    this.updateProgress(total, total, 'Loading UI');
  }

  private async preloadSpirits(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    const assets = SYMBOLS.map(s => ({
      alias: s.spiritKey,
      src:   `${base}assets/spirits/${s.spiritKey}.png`,
    }));
    const total = assets.length;
    this.updateProgress(0, total, 'Loading spirits');
    await Assets.load(assets, (p: number) => {
      this.updateProgress(Math.round(p * total), total, 'Loading spirits');
    });
    this.updateProgress(total, total, 'Loading spirits');
  }

  private updateProgress(loaded: number, total: number, label: string): void {
    const ratio = total === 0 ? 0 : loaded / total;
    this.progressBar.clear()
      .roundRect(this.trackX, this.trackY, TRACK_W * ratio, TRACK_H, TRACK_H / 2)
      .fill(T.GOLD.base);
    this.statusText.text = `${label}  ${loaded}/${total}`;
  }
}
