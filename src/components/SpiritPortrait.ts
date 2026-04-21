import { Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';

/**
 * Round portrait tile for a 雀靈 (spirit).
 *
 * Visual stack (outer → inner):
 *   1. bronze outer ring
 *   2. gold middle ring
 *   3. bronze inner ring
 *   4. symbol-color dim backdrop (atmosphere)
 *   5. spirit sprite, masked to circle, anchored on upper body
 *
 * Call `setSymbol(id)` to swap the spirit without rebuilding the frame.
 */
export class SpiritPortrait extends Container {
  private sprite: Sprite;
  private backdrop: Graphics;
  private clipMask: Graphics;
  private diameter: number;
  private innerR: number;
  private currentSymbol = -1;

  constructor(symbolId: number, diameter: number) {
    super();
    this.diameter = diameter;
    const r = diameter / 2;
    this.innerR = r - 6;

    // Outer bronze ring
    const outer = new Graphics().circle(0, 0, r).fill(T.GOLD.shadow);
    this.addChild(outer);

    // Gold middle ring
    const mid = new Graphics().circle(0, 0, r - 2).fill(T.GOLD.light);
    this.addChild(mid);

    // Bronze inner ring
    const innerRing = new Graphics().circle(0, 0, r - 4).fill(T.GOLD.shadow);
    this.addChild(innerRing);

    // Symbol-color backdrop (atmosphere)
    this.backdrop = new Graphics();
    this.addChild(this.backdrop);

    // Circular mask for the sprite
    this.clipMask = new Graphics().circle(0, 0, this.innerR).fill(0xffffff);
    this.addChild(this.clipMask);

    // Sprite — placeholder texture, set via setSymbol()
    this.sprite = new Sprite(Texture.WHITE);
    this.sprite.anchor.set(0.5, 0.18);   // head anchor: centered x, 18% from top
    this.sprite.mask = this.clipMask;
    this.addChild(this.sprite);

    this.setSymbol(symbolId);
  }

  setSymbol(symbolId: number): void {
    if (this.currentSymbol === symbolId) return;
    this.currentSymbol = symbolId;
    const sym = SYMBOLS[symbolId];

    // Update backdrop tint
    this.backdrop.clear()
      .circle(0, 0, this.innerR)
      .fill({ color: sym.color, alpha: 0.28 });

    // Swap sprite texture
    const tex = Assets.get<Texture>(sym.spiritKey);
    if (tex) {
      this.sprite.texture = tex;
      const targetW = this.innerR * 2 * 0.96;
      this.sprite.scale.set(targetW / tex.width);
    }
  }

  setAlive(alive: boolean): void {
    this.alpha = alive ? 1 : 0.22;
  }
}
