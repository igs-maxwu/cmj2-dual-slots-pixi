import { Container, Sprite, Ticker } from 'pixi.js';
import { FXAtlas } from '@/fx/FXAtlas';

const SAND_KEYS = [
  'sos2-near-win:Sand_01',
  'sos2-near-win:Sand_02',
  'sos2-near-win:Sand_03',
  'sos2-near-win:Sand_04',
];
const FRAME_MS = 80;       // ~12 fps cycle
const TOTAL_MS = 800;      // 200 fade-in + 300 hold + 300 fade-out

interface SandState {
  sprite: Sprite;
  baseX: number;
  baseY: number;
}

/**
 * d-05: Near-win gold-dust teaser at the "missing" column.
 *
 * Caller passes 3 cell positions (one per row of the missing column).
 * Each row spawns 1 Sand sprite that rises 120px over 800ms with
 * sinusoidal x-jitter and alpha-pulse, frame-cycling through Sand_01..04.
 *
 * Fire-and-forget — caller does NOT await; module self-cleans.
 */
export function playNearWinTeaser(
  parent: Container,
  cellPositions: Array<{ x: number; y: number }>,
  tint: number = 0xFFD37A,
): void {
  if (cellPositions.length === 0) return;

  // Build sand textures once (atlas caches sub-textures)
  const sandTextures = SAND_KEYS.map(key => FXAtlas.sprite(key).texture);

  const sands: SandState[] = [];
  const start = performance.now();

  for (const pos of cellPositions) {
    const s = new Sprite(sandTextures[0]);
    s.anchor.set(0.5);
    s.tint = tint;
    s.alpha = 0;
    s.scale.set(0.5);
    s.x = pos.x;
    s.y = pos.y;
    s.blendMode = 'add';   // Pixi 8 string enum
    parent.addChild(s);
    sands.push({ sprite: s, baseX: pos.x, baseY: pos.y });
  }

  const ticker = Ticker.shared;
  const tickFn = () => {
    const now = performance.now();
    const t = (now - start) / TOTAL_MS;
    if (t >= 1) {
      // Cleanup
      ticker.remove(tickFn);
      for (const s of sands) s.sprite.destroy();
      return;
    }
    // Frame cycle
    const frameIdx = Math.floor((now - start) / FRAME_MS) % 4;
    // Alpha envelope: fade-in 200ms / hold 300ms / fade-out 300ms
    let alpha: number;
    if (t < 0.25)       alpha = (t / 0.25) * 0.7;                         // 0 → 0.7
    else if (t < 0.625) alpha = 0.7;                                       // hold
    else                alpha = 0.7 * (1 - (t - 0.625) / 0.375);          // 0.7 → 0
    // Position + jitter
    for (const s of sands) {
      s.sprite.texture = sandTextures[frameIdx];
      s.sprite.alpha   = alpha;
      s.sprite.y       = s.baseY - t * 120;                   // rise 120px
      s.sprite.x       = s.baseX + Math.sin(t * Math.PI * 4) * 15;
    }
  };
  ticker.add(tickFn);
}
