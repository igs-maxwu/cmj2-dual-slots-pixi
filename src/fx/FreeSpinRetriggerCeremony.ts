import { Container, Sprite, Text, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import * as T from '@/config/DesignTokens';
import { goldText } from '@/components/GoldText';
import { tween, Easings } from '@/systems/tween';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { FXAtlas } from '@/fx/FXAtlas';

export async function playFreeSpinRetriggerCeremony(
  parent: Container,
  newRoundsCount: number = 5,
): Promise<void> {
  const root = new Container();
  root.zIndex = 2000; // above HUD + popups, just below JP ceremony (2500)
  parent.addChild(root);

  // ── Stage 1 (0.0–0.4s): rainbow halo expand from centre ────────────────────
  const haloUrl = `${import.meta.env.BASE_URL}assets/fx/sos2-rainbow-halo.webp`;
  const haloTex = Texture.from(haloUrl);
  const halo = new Sprite(haloTex);
  halo.anchor.set(0.5);
  halo.x = CANVAS_WIDTH / 2;
  halo.y = CANVAS_HEIGHT / 2;
  halo.alpha = 0;
  halo.scale.set(0.3);
  halo.blendMode = 'add';
  root.addChild(halo);

  await tween(400, t => {
    halo.alpha = t * 0.85;
    halo.scale.set(0.3 + 1.0 * t); // 0.3 → 1.3
  }, Easings.easeOut);

  // ── Stage 2 (0.4–0.8s): MORE SPINS! gold text pop-in ───────────────────────
  const titleText = goldText('MORE SPINS!', { fontSize: 72, withShadow: true });
  titleText.anchor.set(0.5, 0.5);
  titleText.x = CANVAS_WIDTH / 2;
  titleText.y = CANVAS_HEIGHT / 2 - 30;
  titleText.alpha = 0;
  titleText.scale.set(0.5);
  titleText.filters = [new GlowFilter({
    color: T.GOLD.glow,
    distance: 22,
    outerStrength: 3.0,
    innerStrength: 0.6,
    quality: 0.5,
  })];
  root.addChild(titleText);

  const subText = new Text({
    text: `+${newRoundsCount} ROUNDS`,
    style: {
      fontFamily: T.FONT.body,
      fontWeight: '700',
      fontSize: 28,
      fill: T.GOLD.glow,
      letterSpacing: 6,
      stroke: { color: 0x000000, width: 3, alpha: 0.6 },
    },
  });
  subText.anchor.set(0.5, 0.5);
  subText.x = CANVAS_WIDTH / 2;
  subText.y = CANVAS_HEIGHT / 2 + 50;
  subText.alpha = 0;
  root.addChild(subText);

  await tween(400, t => {
    titleText.alpha = t;
    titleText.scale.set(0.5 + 0.7 * t); // 0.5 → 1.2
    subText.alpha = t;
  }, Easings.easeOut);

  // ── Stage 3 (0.8–1.2s): LightBall particle burst (radial) ──────────────────
  const PARTICLE_COUNT = 16;
  const particles: Sprite[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let p: Sprite;
    try {
      p = FXAtlas.sprite('sos2-bigwin:FX/LightBall_02');
    } catch {
      // Fallback: plain white circle via Graphics-less Sprite (EMPTY texture)
      p = new Sprite(Texture.WHITE);
      p.width = 16;
      p.height = 16;
      p.tint = 0xffdd88;
    }
    p.anchor.set(0.5);
    p.x = CANVAS_WIDTH / 2;
    p.y = CANVAS_HEIGHT / 2;
    p.scale.set(0.15);
    p.blendMode = 'add';
    p.alpha = 0;
    root.addChild(p);
    particles.push(p);
  }

  // Settle title text scale (1.2 → 1.0) in parallel with particle burst
  void tween(400, t => {
    titleText.scale.set(1.2 - 0.2 * t); // 1.2 → 1.0
  }, Easings.easeOut);

  await Promise.all(particles.map((p, i) => {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    const dist = 280 + Math.random() * 80;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    return tween(400, t => {
      p.x = CANVAS_WIDTH / 2 + dx * t;
      p.y = CANVAS_HEIGHT / 2 + dy * t;
      p.alpha = (t < 0.5 ? t * 2 : (1 - t) * 2) * 0.9;
      p.rotation = t * Math.PI * 2;
    }, Easings.easeOut);
  }));

  // ── Stage 4 (1.2–1.6s): fade out everything ───────────────────────────────
  await tween(400, t => {
    titleText.alpha = 1 - t;
    subText.alpha = 1 - t;
    halo.alpha = 0.85 * (1 - t);
  }, Easings.easeIn);

  // Cleanup — destroy root and all children in one call
  root.destroy({ children: true });
}
