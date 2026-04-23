import { Assets, Container, Sprite, Text, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import * as T from '@/config/DesignTokens';
import { AudioManager } from '@/systems/AudioManager';

/**
 * Gold-plate button backed by btn-normal.png. Three states via sprite.tint +
 * scale (no separate PNGs needed):
 *   normal   — tint #FFFFFF, scale 1.00
 *   hover    — tint #FFFFFF, scale 1.04
 *   pressed  — tint #B88A40, scale 0.97
 *
 * With variant:'ornate' the btn-ornate asset is used instead; hover adds a
 * GlowFilter only to the bg sprite (not the label).
 */
export interface UiButtonOpts {
  fontSize?: number;
  color?: number;
  stroke?: number;
  variant?: 'normal' | 'ornate';
}

export class UiButton extends Container {
  private bg: Sprite;
  private lbl: Text;
  private enabled = true;
  private readonly isOrnate: boolean;
  private readonly glowFilter: GlowFilter | null;

  constructor(
    text: string,
    width: number,
    height: number,
    private onTap: () => void,
    opts: UiButtonOpts = {},
  ) {
    super();

    this.isOrnate = opts.variant === 'ornate';

    const texKey = this.isOrnate ? 'btn-ornate' : 'btn-normal';
    this.bg = new Sprite(Assets.get<Texture>(texKey) ?? Texture.WHITE);
    this.bg.anchor.set(0.5, 0.5);
    this.bg.width = width;
    this.bg.height = height;
    this.addChild(this.bg);

    const defaultColor = this.isOrnate ? T.GOLD.light : T.FG.white;
    this.lbl = new Text({
      text,
      style: {
        fontFamily: T.FONT.title,
        fontWeight: '700',
        fontSize: opts.fontSize ?? Math.round(height * 0.42),
        fill: opts.color ?? defaultColor,
        letterSpacing: 2,
        stroke: { color: 0x000, width: opts.stroke ?? 2 },
      },
    });
    this.lbl.anchor.set(0.5, 0.5);
    this.addChild(this.lbl);

    this.glowFilter = this.isOrnate
      ? new GlowFilter({ distance: 12, outerStrength: 2, color: T.GOLD.base })
      : null;

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => { if (this.enabled) { AudioManager.playSfx('ui-click', 0.7); this.onTap(); } });
    this.on('pointerover', () => { AudioManager.playSfx('ui-hover', 0.5); this.setState('hover'); });
    this.on('pointerout',  () => this.setState('normal'));
    this.on('pointerdown', () => this.setState('pressed'));
    this.on('pointerup',   () => this.setState('hover'));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.eventMode = enabled ? 'static' : 'none';
    this.cursor = enabled ? 'pointer' : 'default';
    this.bg.tint = enabled ? 0xFFFFFF : 0x555555;
    this.bg.filters = [];
    this.lbl.alpha = enabled ? 1 : 0.4;
    if (enabled) this.setState('normal');
  }

  setText(text: string): void { this.lbl.text = text; }

  private setState(state: 'normal' | 'hover' | 'pressed'): void {
    if (!this.enabled) return;
    if (this.isOrnate) {
      switch (state) {
        case 'normal':
          this.bg.tint = 0xFFFFFF;
          this.scale.set(1);
          this.bg.filters = [];
          break;
        case 'hover':
          this.bg.tint = 0xFFFFFF;
          this.scale.set(1.04);
          this.bg.filters = this.glowFilter ? [this.glowFilter] : [];
          break;
        case 'pressed':
          this.bg.tint = 0xFFE8A8;
          this.scale.set(0.97);
          this.bg.filters = [];
          break;
      }
    } else {
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
}
