import { Container, FillGradient, Graphics, Rectangle, Text } from 'pixi.js';
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
 * chore #204: upgraded to FillGradient 3-stop + double border + top highlight + corner dots + drop shadow
 */
// chore #219: removed color + stroke — neither was used by callers, defaults moved into Text style.
export interface UiButtonOpts {
  fontSize?: number;
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
    // chore #219: dark warm-brown fill on gold gradient (was T.FG.white — poor contrast on light top
    // of gradient ~1.5:1). 0x2a1a05 matches reel gem char + SPIN button style; ~9:1 WCAG AAA contrast.
    // Stroke removed — dark fill on gold needs no outline (stroke became visual noise).
    this.lbl = new Text({
      text,
      style: {
        fontFamily: T.FONT.title,
        fontWeight: '700',
        fontSize: opts.fontSize ?? Math.round(height * 0.42),
        fill: 0x2a1a05,
        letterSpacing: 2,
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

  /**
   * chore #204: Redraws background per state — FillGradient 3-stop + double border +
   * top inner highlight + 4 corner accent dots + drop shadow (JP marquee aesthetic).
   */
  private drawBg(state: 'normal' | 'hover' | 'pressed' | 'disabled'): void {
    this.bg.clear();
    const radius = 10;
    const halfW = this.w / 2;
    const halfH = this.h / 2;

    // Color stops per state
    let stops: Array<{ offset: number; color: string }>;
    let outerStroke: number;
    let innerStroke: number;
    let topHighlight: number;

    switch (state) {
      case 'hover':
        stops = [
          { offset: 0.00, color: '#fff5b8' },   // bright top
          { offset: 0.45, color: '#ffd700' },   // mid gold
          { offset: 1.00, color: '#a07810' },   // dark bottom
        ];
        outerStroke  = 0x4a2a04;
        innerStroke  = T.GOLD.glow;
        topHighlight = 0xfff8c8;
        break;

      case 'pressed':
        stops = [
          { offset: 0.00, color: '#806020' },   // darker top
          { offset: 0.50, color: '#a07810' },
          { offset: 1.00, color: '#604010' },   // very dark bottom
        ];
        outerStroke  = 0x2a1a04;
        innerStroke  = T.GOLD.shadow;
        topHighlight = 0xa07810;
        break;

      case 'disabled':
        stops = [
          { offset: 0.00, color: '#555555' },
          { offset: 1.00, color: '#222222' },
        ];
        outerStroke  = 0x111111;
        innerStroke  = 0x444444;
        topHighlight = 0x666666;
        break;

      case 'normal':
      default:
        stops = [
          { offset: 0.00, color: '#ffe488' },   // bright top
          { offset: 0.50, color: '#d4a020' },   // mid gold
          { offset: 1.00, color: '#7a5408' },   // dark bottom
        ];
        outerStroke  = 0x2a1a04;
        innerStroke  = T.GOLD.base;
        topHighlight = 0xffe488;
        break;
    }

    // chore #205: inline shadow — 3-layer dark roundRects offset down (replaces DropShadowFilter, 0 filter cost)
    if (state !== 'disabled') {
      this.bg.roundRect(-halfW + 1, -halfH + 4, this.w, this.h, radius)
        .fill({ color: 0x000000, alpha: 0.20 });
      this.bg.roundRect(-halfW + 0.5, -halfH + 3, this.w, this.h, radius)
        .fill({ color: 0x000000, alpha: 0.25 });
      this.bg.roundRect(-halfW, -halfH + 2, this.w, this.h, radius)
        .fill({ color: 0x000000, alpha: 0.30 });
    }

    // Layer 1: multi-stop vertical gradient (smoother than 2-rect simulation)
    const grad = new FillGradient({
      type:         'linear',
      start:        { x: 0, y: 0 },
      end:          { x: 0, y: 1 },
      textureSpace: 'local',
      colorStops:   stops,
    });
    this.bg.roundRect(-halfW, -halfH, this.w, this.h, radius).fill(grad);

    // Layer 2: outer dark stroke (frame)
    this.bg.roundRect(-halfW, -halfH, this.w, this.h, radius)
      .stroke({ width: 2, color: outerStroke, alpha: 1 });

    // Layer 3: inner gold hairline (JP marquee style)
    this.bg.roundRect(-halfW + 2, -halfH + 2, this.w - 4, this.h - 4, radius - 2)
      .stroke({ width: 1, color: innerStroke, alpha: 0.85 });

    // Layer 4: top inner highlight (thin bright line just inside top edge)
    this.bg.roundRect(-halfW + 4, -halfH + 3, this.w - 8, 1, 0)
      .fill({ color: topHighlight, alpha: 0.6 });

    // Layer 5: 4 corner accent dots (decorative, JP marquee style)
    if (state !== 'disabled') {
      const dotR = 1.5;
      const dotMargin = 5;
      const dots: [number, number][] = [
        [-halfW + dotMargin, -halfH + dotMargin],
        [ halfW - dotMargin, -halfH + dotMargin],
        [-halfW + dotMargin,  halfH - dotMargin],
        [ halfW - dotMargin,  halfH - dotMargin],
      ];
      for (const [dx, dy] of dots) {
        this.bg.circle(dx, dy, dotR).fill({ color: T.GOLD.glow, alpha: 0.8 });
      }
    }

  }
}
