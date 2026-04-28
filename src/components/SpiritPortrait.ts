import { Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';

/**
 * Round portrait tile for a 雀靈 (spirit).
 *
 * Visual stack (outer → inner):
 *   1. ringContainer (z=0): atmosphere disc + clan-color ring strokes
 *   2. symbol-color dim backdrop circle (atmosphere)
 *   3. spirit sprite, masked to inner circle, anchored on upper body
 *
 * s12-ui-04: portrait-ring.webp Sprite replaced with programmatic clan-color
 * GlowFilter ring (mockup SpiritToken style). Ring color matches spirit clan.
 */
export class SpiritPortrait extends Container {
  private sprite: Sprite;
  private ringContainer: Container;
  private backdrop: Graphics;
  private clipMask: Graphics;
  private diameter: number;
  private innerR: number;
  private currentSymbol = -1;

  constructor(symbolId: number, diameter: number) {
    super();
    this.diameter = diameter;
    const r = diameter / 2;
    this.innerR = r - 7;   // leave room for the ring

    // Ring container — sits at z=0, behind backdrop + sprite
    // (ring strokes at r/r-2/r-5 visible outside the sprite clipMask at innerR)
    this.ringContainer = new Container();
    this.addChild(this.ringContainer);

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

    // s12-ui-04: clan-aware ring color
    const clanColorMap: Record<string, number> = {
      azure:     T.CLAN.azureGlow,
      white:     T.CLAN.whiteGlow,
      vermilion: T.CLAN.vermilionGlow,
      black:     T.CLAN.blackGlow,
    };
    const ringColor = sym.isJackpot || sym.isWild
      ? T.GOLD.glow
      : sym.isCurse
        ? 0x8b3aaa
        : sym.isScatter
          ? 0xff3b6b
          : (clanColorMap[sym.clan as string] ?? T.GOLD.base);
    this.updateRing(ringColor);

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

  /** Redraws clan-color ring in ringContainer. Called by setSymbol(). */
  private updateRing(clanColor: number): void {
    this.ringContainer.removeChildren();
    const r = this.diameter / 2;

    // Outer dim atmosphere disc (clan color, behind everything)
    const outerAtm = new Graphics()
      .circle(0, 0, r + 2)
      .fill({ color: clanColor, alpha: 0.20 });
    this.ringContainer.addChild(outerAtm);

    // Outer ring band (gold shadow)
    const outerBand = new Graphics()
      .circle(0, 0, r)
      .stroke({ width: 3, color: T.GOLD.shadow, alpha: 0.95 });
    this.ringContainer.addChild(outerBand);

    // Mid clan-color ring (brand identity ring)
    const midRing = new Graphics()
      .circle(0, 0, r - 2)
      .stroke({ width: 2, color: clanColor, alpha: 1.0 });
    // Subtle clan-color glow on mid ring
    midRing.filters = [new GlowFilter({
      color: clanColor, distance: 8, outerStrength: 1.2, innerStrength: 0.3,
    })];
    this.ringContainer.addChild(midRing);

    // Inner gold highlight (keeps gold-plate feel)
    const innerHi = new Graphics()
      .circle(0, 0, r - 5)
      .stroke({ width: 1, color: T.GOLD.light, alpha: 0.7 });
    this.ringContainer.addChild(innerHi);
  }
}
