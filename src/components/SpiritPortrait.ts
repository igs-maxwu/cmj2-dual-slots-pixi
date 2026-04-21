import { Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';

/**
 * Round portrait tile for a 雀靈 (spirit).
 *
 * Visual stack (outer → inner):
 *   1. symbol-color dim backdrop circle (atmosphere)
 *   2. spirit sprite, masked to inner circle, anchored on upper body
 *   3. ornate gold ring overlay (portrait-ring.png) on top
 */
export class SpiritPortrait extends Container {
  private sprite: Sprite;
  private ring: Sprite | null = null;
  private backdrop: Graphics;
  private clipMask: Graphics;
  private diameter: number;
  private innerR: number;
  private currentSymbol = -1;

  constructor(symbolId: number, diameter: number) {
    super();
    this.diameter = diameter;
    const r = diameter / 2;
    this.innerR = r - 7;   // leave room for the ring PNG

    // 1. Symbol-color backdrop
    this.backdrop = new Graphics();
    this.addChild(this.backdrop);

    // 2. Circular mask for sprite
    this.clipMask = new Graphics().circle(0, 0, this.innerR).fill(0xffffff);
    this.addChild(this.clipMask);

    // 2b. Sprite — texture is swapped via setSymbol()
    this.sprite = new Sprite(Texture.WHITE);
    this.sprite.anchor.set(0.5, 0.18);
    this.sprite.mask = this.clipMask;
    this.addChild(this.sprite);

    // 3. Ring overlay (added last so it sits on top)
    const ringTex = Assets.get<Texture>('portrait-ring');
    if (ringTex) {
      this.ring = new Sprite(ringTex);
      this.ring.anchor.set(0.5, 0.5);
      this.ring.width = diameter;
      this.ring.height = diameter;
      this.addChild(this.ring);
    } else {
      // Fallback: programmatic triple ring (works before ring texture loads)
      const outer = new Graphics().circle(0, 0, r).fill(T.GOLD.shadow);
      const mid   = new Graphics().circle(0, 0, r - 2).fill(T.GOLD.light);
      const inner = new Graphics().circle(0, 0, r - 4).fill(T.GOLD.shadow);
      this.addChildAt(outer, 0);
      this.addChildAt(mid, 1);
      this.addChildAt(inner, 2);
    }

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
