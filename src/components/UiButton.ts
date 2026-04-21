import { Assets, Container, Sprite, Text, Texture } from 'pixi.js';
import * as T from '@/config/DesignTokens';

/**
 * Gold-plate button backed by btn-normal.png. Three states via sprite.tint +
 * scale (no separate PNGs needed):
 *   normal   — tint #FFFFFF, scale 1.00
 *   hover    — tint #FFFFFF, scale 1.04
 *   pressed  — tint #B88A40, scale 0.97
 */
export interface UiButtonOpts {
  fontSize?: number;
  color?: number;
  stroke?: number;
}

export class UiButton extends Container {
  private bg: Sprite;
  private lbl: Text;
  private enabled = true;

  constructor(
    text: string,
    width: number,
    height: number,
    private onTap: () => void,
    opts: UiButtonOpts = {},
  ) {
    super();

    this.bg = new Sprite(Assets.get<Texture>('btn-normal') ?? Texture.WHITE);
    this.bg.anchor.set(0.5, 0.5);
    this.bg.width = width;
    this.bg.height = height;
    this.addChild(this.bg);

    this.lbl = new Text({
      text,
      style: {
        fontFamily: T.FONT.title,
        fontWeight: '700',
        fontSize: opts.fontSize ?? Math.round(height * 0.42),
        fill: opts.color ?? T.FG.white,
        letterSpacing: 2,
        stroke: { color: 0x000, width: opts.stroke ?? 2 },
      },
    });
    this.lbl.anchor.set(0.5, 0.5);
    this.addChild(this.lbl);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => { if (this.enabled) this.onTap(); });
    this.on('pointerover', () => this.setState('hover'));
    this.on('pointerout',  () => this.setState('normal'));
    this.on('pointerdown', () => this.setState('pressed'));
    this.on('pointerup',   () => this.setState('hover'));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.eventMode = enabled ? 'static' : 'none';
    this.cursor = enabled ? 'pointer' : 'default';
    this.bg.tint = enabled ? 0xFFFFFF : 0x555555;
    this.lbl.alpha = enabled ? 1 : 0.4;
    if (enabled) this.setState('normal');
  }

  setText(text: string): void { this.lbl.text = text; }

  private setState(state: 'normal' | 'hover' | 'pressed'): void {
    if (!this.enabled) return;
    switch (state) {
      case 'normal':
        this.bg.tint = 0xFFFFFF;
        this.scale.set(1);
        break;
      case 'hover':
        this.bg.tint = 0xFFFFFF;
        this.scale.set(1.04);
        break;
      case 'pressed':
        this.bg.tint = 0xB88A40;
        this.scale.set(0.97);
        break;
    }
  }
}
