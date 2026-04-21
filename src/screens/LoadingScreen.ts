import { Application, Assets, Container, Graphics, Text } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';

const TRACK_W = 420;
const TRACK_H = 12;

export class LoadingScreen implements Screen {
  private container = new Container();
  private statusText!: Text;
  private progressBar!: Graphics;
  private trackX = 0;
  private trackY = 0;

  constructor(private onDone: () => void) {}

  async onMount(_app: Application, stage: Container): Promise<void> {
    stage.addChild(this.container);
    this.drawBackground();
    this.drawTitle();
    this.drawProgress();
    await this.preload();
    this.onDone();
  }

  onUnmount(): void {
    this.container.destroy({ children: true });
  }

  private drawBackground(): void {
    const bg = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(T.SEA.abyss);
    this.container.addChild(bg);

    // Subtle radial-ish gradient using concentric circles
    const glow = new Graphics();
    for (let i = 4; i >= 0; i--) {
      glow.circle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 260 + i * 50)
        .fill({ color: T.SEA.deep, alpha: 0.08 });
    }
    this.container.addChild(glow);
  }

  private drawTitle(): void {
    const title = new Text({
      text: '雀靈戰記',
      style: {
        fontFamily: T.FONT.display, fontWeight: '700', fontSize: T.FONT_SIZE.hero,
        fill: T.GOLD.base, stroke: { color: T.GOLD.shadow, width: 6 },
        letterSpacing: 8,
      },
    });
    title.anchor.set(0.5, 0.5);
    title.x = CANVAS_WIDTH / 2;
    title.y = CANVAS_HEIGHT / 2 - 70;
    this.container.addChild(title);

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
    this.trackY = CANVAS_HEIGHT / 2 + 60;

    const track = new Graphics()
      .roundRect(this.trackX, this.trackY, TRACK_W, TRACK_H, TRACK_H / 2)
      .fill(T.HP.track)
      .stroke({ width: 1, color: T.GOLD.deep, alpha: 0.7 });
    this.container.addChild(track);

    this.progressBar = new Graphics();
    this.container.addChild(this.progressBar);

    this.statusText = new Text({
      text: 'Loading spirits  0/8',
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

  private async preload(): Promise<void> {
    const base = import.meta.env.BASE_URL; // e.g. "/cmj2-dual-slots-pixi/"
    const assets = SYMBOLS.map(s => ({
      alias: s.spiritKey,
      src:   `${base}assets/spirits/${s.spiritKey}.png`,
    }));

    const total = assets.length;

    // Initial paint
    this.updateProgress(0, total);

    await Assets.load(assets, (progress: number) => {
      const done = Math.round(progress * total);
      this.updateProgress(done, total);
    });

    // Ensure final state paints
    this.updateProgress(total, total);
  }

  private updateProgress(loaded: number, total: number): void {
    const ratio = total === 0 ? 0 : loaded / total;
    this.progressBar.clear()
      .roundRect(this.trackX, this.trackY, TRACK_W * ratio, TRACK_H, TRACK_H / 2)
      .fill(T.GOLD.base);
    this.statusText.text = `Loading spirits  ${loaded}/${total}`;
  }
}
