import { Container, Sprite, Ticker } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { FXAtlas } from '@/fx/FXAtlas';
import { goldText } from '@/components/GoldText';
import { tween, delay, Easings } from '@/systems/tween';
import { CANVAS_WIDTH } from '@/config/GameConfig';

const TIER_CONFIG = {
  bigwin: {
    txtKey:    'sos2-bigwin:TXT_01_Big',
    flareKey:  'sos2-bigwin:FX/BigWin_Main_light',
    coinCount: 4,
    duration:  1200,
  },
  megawin: {
    txtKey:    'sos2-bigwin:TXT_01_Mega',
    flareKey:  'sos2-bigwin:FX/MegaWin_Main_light_01',
    coinCount: 8,
    duration:  2000,
  },
} as const;

interface CoinState {
  sprite: Sprite;
  vx: number;
  vy: number;
  birth: number;
}

const CEREMONY_Y = 400;       // upper-center, avoids reel main view
const COIN_FRAME_MS = 80;

/**
 * d-07: Non-JP BigWin ceremony — short, no full-screen dim.
 *
 * Caller awaits Promise; resolve = ceremony complete + cleanup done.
 * Distinct from j-04 JackpotCeremony: no dim bg, no wings, no shine,
 * shorter duration, upper position. Avoids visual competition with JP.
 */
export async function playBigWinCeremony(
  parent: Container,
  tier: 'bigwin' | 'megawin',
  amount: number,
): Promise<void> {
  const cfg = TIER_CONFIG[tier];

  const root = new Container();
  root.zIndex = 2200;          // below JP 2500, above HUD 1100
  parent.addChild(root);

  // Flare (behind text)
  const flare = FXAtlas.sprite(cfg.flareKey);
  flare.x = CANVAS_WIDTH / 2;
  flare.y = CEREMONY_Y;
  flare.alpha = 0;
  flare.scale.set(0.5);
  root.addChild(flare);

  // Tier text
  const txt = FXAtlas.sprite(cfg.txtKey);
  txt.x = CANVAS_WIDTH / 2;
  txt.y = CEREMONY_Y;
  txt.alpha = 0;
  txt.scale.set(0.5);
  root.addChild(txt);

  // Amount text
  const amountText = goldText(`NT$${Math.floor(amount).toLocaleString()}`, {
    fontSize: 36, withShadow: true,
  });
  amountText.anchor.set(0.5, 0.5);
  amountText.x = CANVAS_WIDTH / 2;
  amountText.y = CEREMONY_Y + 80;
  amountText.alpha = 0;
  amountText.filters = [new GlowFilter({
    color: 0xFFD37A, distance: 12, outerStrength: 1.5, innerStrength: 0.4,
  })];
  root.addChild(amountText);

  // Coin shower
  const coinKeys = Array.from({ length: 9 }, (_, i) =>
    `sos2-bigwin:Coin/Coin_0${i + 1}`,
  );
  const coinTextures = coinKeys.map(k => FXAtlas.sprite(k).texture);
  const coins: CoinState[] = [];
  const start = performance.now();
  const spawnCoin = () => {
    const c: CoinState = {
      sprite: new Sprite(coinTextures[0]),
      vx: (Math.random() - 0.5) * 10,
      vy: -6 - Math.random() * 4,
      birth: performance.now(),
    };
    c.sprite.anchor.set(0.5);
    c.sprite.x = CANVAS_WIDTH / 2;
    c.sprite.y = CEREMONY_Y;
    c.sprite.scale.set(0.4 + Math.random() * 0.3);
    root.addChild(c.sprite);
    coins.push(c);
  };

  // Stage 1: flare + text fade-in (250ms)
  await Promise.all([
    tween(250, t => {
      flare.alpha = t;
      flare.scale.set(0.5 + t * 0.5);
    }, Easings.easeOut),
    tween(250, t => {
      txt.alpha = t;
      txt.scale.set(0.5 + t * 0.6 + 0.08 * Math.sin(Math.PI * t));   // overshoot
    }, Easings.easeOut),
  ]);

  // Stage 2: amount fade-in (200ms)
  void tween(200, t => { amountText.alpha = t; }, Easings.easeOut);

  // Stage 3: coin shower spawn over 400ms
  const spawnInterval = 400 / cfg.coinCount;
  for (let i = 0; i < cfg.coinCount; i++) {
    setTimeout(spawnCoin, i * spawnInterval);
  }

  // Stage 4: ticker drives physics + frame cycle
  const ticker = Ticker.shared;
  const tickFn = (tk: Ticker) => {
    const dt = tk.deltaTime;
    const now = performance.now();
    for (const c of coins) {
      c.vy += 0.4 * dt;
      c.sprite.x += c.vx * dt;
      c.sprite.y += c.vy * dt;
      const age = now - c.birth;
      const frameIdx = Math.floor(age / COIN_FRAME_MS) % 9;
      c.sprite.texture = coinTextures[frameIdx];
      const remaining = cfg.duration - (now - start);
      if (remaining < 400) c.sprite.alpha = Math.max(0, remaining / 400);
    }
  };
  ticker.add(tickFn);

  // Hold remaining time
  await delay(cfg.duration - 250);

  // Stage 5: fade out (300ms)
  await tween(300, t => { root.alpha = 1 - t; }, Easings.easeIn);

  // Cleanup
  ticker.remove(tickFn);
  root.destroy({ children: true });
}
