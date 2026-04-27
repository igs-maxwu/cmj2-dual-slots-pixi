/**
 * JackpotCeremony — SPEC §15.8 M12 full-screen JP celebration.
 *
 * j-04: Replaces j-03 goldText placeholder with SOS2 BigWin atlas ceremony.
 * Three tiers share the same flow but differ in atlas regions, duration,
 * coin count, and decorative elements (wings, shine, lightball).
 *
 * Usage:
 *   await playJackpotCeremony(this.container, 'minor', 50000);
 *
 * The returned Promise resolves once ceremony is fully dismissed and all
 * Pixi objects destroyed.  The ticker callback is removed before resolve —
 * zero leak guarantee.
 */
import { Container, Sprite, Graphics, Ticker } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { FXAtlas } from '@/fx/FXAtlas';
import { goldText } from '@/components/GoldText';
import * as T from '@/config/DesignTokens';
import { tween, delay, Easings } from '@/systems/tween';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';

// ── Tier configuration ────────────────────────────────────────────────────────

const TIER_CONFIG = {
  minor: {
    txtKey:    'sos2-bigwin:TXT_01_Big',
    flareKey:  'sos2-bigwin:FX/BigWin_Main_light',
    coinCount: 8,
    duration:  3000,
    label:     '人獎 MINOR',
    hasWings:  false,
    hasShine:  false,
  },
  major: {
    txtKey:    'sos2-bigwin:TXT_01_Mega',
    flareKey:  'sos2-bigwin:FX/MegaWin_Main_light_01',
    coinCount: 16,
    duration:  4000,
    label:     '地獎 MAJOR',
    hasWings:  true,
    hasShine:  false,
  },
  grand: {
    txtKey:    'sos2-bigwin:TXT_01_Super',
    flareKey:  'sos2-bigwin:FX/SuperWin_Main_light_01',
    coinCount: 30,
    duration:  5000,
    label:     '天獎 GRAND',
    hasWings:  true,
    hasShine:  true,
  },
} as const;

interface CoinState {
  sprite: Sprite;
  vx:     number;
  vy:     number;
  birth:  number;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * j-04: Full-screen JP ceremony driven by SOS2 BigWin atlas.
 *
 * Caller awaits the returned Promise; on resolve, the ceremony Container
 * is destroyed and removed from the parent.  No objects escape.
 *
 * @param parent  BattleScreen's root Container (ceremony added at zIndex 2500)
 * @param tier    'grand' | 'major' | 'minor'
 * @param amount  Jackpot award in NT$ (pool value, NOT half-award)
 */
export async function playJackpotCeremony(
  parent:  Container,
  tier:    'grand' | 'major' | 'minor',
  amount:  number,
): Promise<void> {
  const cfg = TIER_CONFIG[tier];
  const cx  = CANVAS_WIDTH / 2;
  const cy  = CANVAS_HEIGHT / 2 - 80;

  // ── Build ceremony Container hierarchy ──────────────────────────────────────
  const root = new Container();
  root.zIndex = 2500;
  parent.addChild(root);

  // Dim overlay (full screen, fades in)
  const bg = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0x000000, alpha: 1.0 });
  bg.alpha = 0;
  root.addChild(bg);

  // Light flare (behind text)
  const flare = FXAtlas.sprite(cfg.flareKey);
  flare.x = cx;  flare.y = cy;
  flare.alpha = 0;
  flare.scale.set(0.6);
  root.addChild(flare);

  // Grand-only: Shine (insert behind flare at index 1)
  let shine: Sprite | null = null;
  let lightBall: Sprite | null = null;
  if (cfg.hasShine) {
    shine = FXAtlas.sprite('sos2-bigwin:FX/Shine_02');
    shine.x = cx;  shine.y = cy;
    shine.alpha = 0;
    root.addChildAt(shine, 1);

    lightBall = FXAtlas.sprite('sos2-bigwin:FX/LightBall_02');
    lightBall.x = cx;  lightBall.y = cy;
    lightBall.alpha = 0;
    root.addChild(lightBall);
  }

  // Tier text sprite
  const txt = FXAtlas.sprite(cfg.txtKey);
  txt.x = cx;  txt.y = cy;
  txt.alpha = 0;
  txt.scale.set(0.4);
  root.addChild(txt);

  // Major/Grand: decorative wings
  let wingL: Sprite | null = null;
  let wingR: Sprite | null = null;
  if (cfg.hasWings) {
    wingL = FXAtlas.sprite('sos2-bigwin:Wing_L');
    wingR = FXAtlas.sprite('sos2-bigwin:Wing_R');
    wingL.x = cx - 200;  wingL.y = cy;
    wingR.x = cx + 200;  wingR.y = cy;
    wingL.alpha = wingR.alpha = 0;
    root.addChild(wingL);
    root.addChild(wingR);
  }

  // NT$ amount label (below center)
  const amountText = goldText(`NT$${Math.floor(amount).toLocaleString()}`, {
    fontSize:   T.FONT_SIZE.big,
    withShadow: true,
  });
  amountText.anchor.set(0.5, 0.5);
  amountText.x = cx;
  amountText.y = CANVAS_HEIGHT / 2 + 100;
  amountText.alpha = 0;
  amountText.filters = [
    new GlowFilter({ color: 0xFFD37A, distance: 16, outerStrength: 2, innerStrength: 0.5, quality: 0.5 }),
  ];
  root.addChild(amountText);

  // ── Precompute coin textures (9 frames) — no per-tick sprite creation ───────
  const coinTextures = Array.from({ length: 9 }, (_, i) =>
    FXAtlas.sprite(`sos2-bigwin:Coin/Coin_0${i + 1}`).texture,
  );
  const coins: CoinState[] = [];
  const startTime = performance.now();

  const spawnCoin = (): void => {
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI * 2 / 3); // ±60° of straight up
    const speed = 5 + Math.random() * 7;
    const c: CoinState = {
      sprite: FXAtlas.sprite('sos2-bigwin:Coin/Coin_01'),
      vx:     Math.cos(angle) * speed,
      vy:     Math.sin(angle) * speed,
      birth:  performance.now(),
    };
    c.sprite.x = cx;
    c.sprite.y = CANVAS_HEIGHT / 2;
    c.sprite.scale.set(0.5 + Math.random() * 0.5);
    root.addChild(c.sprite);
    coins.push(c);
  };

  // ── Animation sequence ──────────────────────────────────────────────────────

  // Stage 1: bg dim + flare bloom (300-400ms, parallel)
  await Promise.all([
    tween(300, t => { bg.alpha = 0.55 * t; }, Easings.easeOut),
    tween(400, t => {
      flare.alpha = t;
      flare.scale.set(0.6 + 0.4 * t);
    }, Easings.easeOut),
  ]);

  // Stage 2: tier text scale-in with slight overshoot (300ms)
  await tween(300, t => {
    txt.alpha = t;
    txt.scale.set(0.4 + 0.6 * t + 0.1 * Math.sin(Math.PI * t));
  }, Easings.easeOut);

  // Stage 3: wings + shine + lightball + amount text (fire-and-forget)
  if (cfg.hasWings && wingL && wingR) {
    void tween(400, t => { wingL!.alpha = t; wingR!.alpha = t; }, Easings.easeOut);
  }
  if (cfg.hasShine && shine && lightBall) {
    void tween(500, t => { shine!.alpha = 0.7 * t; lightBall!.alpha = t; }, Easings.easeOut);
  }
  void tween(300, t => { amountText.alpha = t; }, Easings.easeOut);

  // Stage 4: spawn coins staggered over first 800ms
  const coinSpawnInterval = 800 / cfg.coinCount;
  for (let i = 0; i < cfg.coinCount; i++) {
    setTimeout(spawnCoin, i * coinSpawnInterval);
  }

  // Stage 5: ticker drives coin physics + frame animation
  const ticker = Ticker.shared;
  const tickFn = (): void => {
    const dt  = ticker.deltaTime;  // Pixi v8: deltaTime on Ticker.shared
    const now = performance.now();
    for (const c of coins) {
      c.vy += 0.4 * dt;
      c.sprite.x += c.vx * dt;
      c.sprite.y += c.vy * dt;
      const age      = now - c.birth;
      const frameIdx = Math.floor(age / 80) % 9;
      c.sprite.texture = coinTextures[frameIdx];
      // Fade out near end of ceremony
      const remaining = cfg.duration - (now - startTime);
      if (remaining < 600) c.sprite.alpha = Math.max(0, remaining / 600);
    }
  };
  ticker.add(tickFn);

  // Hold ceremony for remaining duration (stages 1-2 consumed ~700ms)
  await delay(cfg.duration - 700);

  // Stage 6: fade out everything (500ms)
  await tween(500, t => { root.alpha = 1 - t; }, Easings.easeIn);

  // Cleanup: remove ticker callback, destroy root (all children destroyed recursively)
  ticker.remove(tickFn);
  root.destroy({ children: true });
}
