import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import * as T from '@/config/DesignTokens';
import { AudioManager } from '@/systems/AudioManager';

/**
 * Programmatic gold-plate button — pure Pixi.Graphics, no asset dependency.
 *
 * Three states via redrawing bg Graphics:
 *   normal   — gold gradient + border
 *   hover    — slightly brighter gold + scale 1.04
 *   pressed  — darker tint + scale 0.97
 *
 * Sound: ui-click on tap, ui-hover on pointerover.
 *
 * s12-ui-03: replaces Sprite + btn-normal.webp / btn-ornate.webp path.
 * 'ornate' variant removed (dead code — no callers used it).
 */
export interface UiButtonOpts {
  fontSize?: number;
  color?: number;
  stroke?: number;
}

export class UiButton extends Container {
  private bg: Graphics;
  private lbl: Text;
  private enabled = true;
  private readonly w: number;
  private readonly h: number;

  constructor(
    text: string,
    width: number,
    height: number,
    private onTap: () => void,
    opts: UiButtonOpts = {},
  ) {
    super();
    this.w = width;
    this.h = height;

    // Background — programmatic gradient + border
    this.bg = new Graphics();
    this.addChild(this.bg);
    this.drawBg('normal');

    // Label
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

    // Hit area for click events (Pixi 8 Container needs explicit hitArea)
    this.hitArea = new Rectangle(-width / 2, -height / 2, width, height);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap',  () => { if (this.enabled) { AudioManager.playSfx('ui-click', 0.7); this.onTap(); } });
    this.on('pointerover', () => { if (this.enabled) { AudioManager.playSfx('ui-hover', 0.5); this.setState('hover'); } });
    this.on('pointerout',  () => this.setState('normal'));
    this.on('pointerdown', () => this.setState('pressed'));
    this.on('pointerup',   () => this.setState('hover'));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.eventMode = enabled ? 'static' : 'none';
    this.cursor    = enabled ? 'pointer' : 'default';
    this.lbl.alpha = enabled ? 1 : 0.4;
    this.drawBg(enabled ? 'normal' : 'disabled');
  }

  setText(text: string): void { this.lbl.text = text; }

  private setState(state: 'normal' | 'hover' | 'pressed'): void {
    if (!this.enabled) return;
    this.drawBg(state);
    switch (state) {
      case 'normal':  this.scale.set(1);     break;
      case 'hover':   this.scale.set(1.04);  break;
      case 'pressed': this.scale.set(0.97);  break;
    }
  }

  /** Redraws background per state — gold gradient simulation + border. */
  private drawBg(state: 'normal' | 'hover' | 'pressed' | 'disabled'): void {
    this.bg.clear();
    const radius = 8;
    const halfW = this.w / 2;
    const halfH = this.h / 2;

    // Color per state
    let topColor: number, bottomColor: number, borderColor: number;
    switch (state) {
      case 'hover':
        topColor    = T.GOLD.glow;       // brighter top
        bottomColor = T.GOLD.base;
        borderColor = T.GOLD.glow;
        break;
      case 'pressed':
        topColor    = T.GOLD.shadow;     // darker (pressed)
        bottomColor = T.GOLD.shadow;
        borderColor = T.GOLD.base;
        break;
      case 'disabled':
        topColor    = 0x444444;
        bottomColor = 0x222222;
        borderColor = 0x666666;
        break;
      case 'normal':
      default:
        topColor    = T.GOLD.base;
        bottomColor = T.GOLD.shadow;
        borderColor = T.GOLD.base;
        break;
    }

    // 2-rect gradient simulation (Pixi 8 has no native linear gradient)
    this.bg.roundRect(-halfW, -halfH, this.w, this.h * 0.5, radius)
      .fill({ color: topColor });
    this.bg.roundRect(-halfW, 0, this.w, this.h * 0.5, radius)
      .fill({ color: bottomColor });

    // Border
    this.bg.roundRect(-halfW, -halfH, this.w, this.h, radius)
      .stroke({ width: 2, color: borderColor, alpha: 0.9 });
  }
}
