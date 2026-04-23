/**
 * Spirit Attack Choreographer
 *
 * Promise-based attack animation.  Phase 4 (Fire) dispatches on
 * SpiritPersonality.signature to play each female spirit's unique
 * attack pattern; male spirits fall through to the generic _fireShot.
 *
 * Animation flow:
 *   Phase 1: Prepare — scale-up pulse at origin
 *   Phase 2: Leap   — parabolic arc to centre
 *   Phase 3: Hold   — wobble charge at centre
 *   Phase 4: Fire   — signature dispatch (concurrent with shake)
 *   Phase 5: Return — fly back to formation
 */
import { Container, Graphics } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { tween, delay, Easings } from '@/systems/tween';
import { SpiritPortrait } from '@/components/SpiritPortrait';
import { applyGlow, applyBloom, applyShockwave, removeFilter } from '@/fx/GlowWrapper';

// ─── Signature types ────────────────────────────────────────────────────────

export type SpiritSignature =
  | 'lightning-xcross'   // 蒼嵐 — X-slash + cyan lightning + shockwave
  | 'triple-dash'        // 珞洛 — 3× melee dash + afterimages + tiger claw
  | 'dual-fireball'      // 朱鸞 — twin fireball charge + particle burst
  | 'python-summon'      // 昭宇 — summoning circle + serpent
  | 'generic';           // all male spirits (孟辰璋, 寅, 凌羽, 玄墨)

// ─── Per-spirit personality config ─────────────────────────────────────────

export interface SpiritPersonality {
  particleColor:  number;
  arcHeight:      number;
  shakeIntensity: number;
  signature:      SpiritSignature;
  duration: {
    prepare: number;
    leap:    number;
    hold:    number;
    fire:    number;
    return:  number;
  };
}

const PERSONALITIES: Record<string, SpiritPersonality> = {
  mengchenzhang: {
    particleColor: 0x00FFFF,  arcHeight: 130, shakeIntensity: 8, signature: 'generic',
    duration: { prepare: 130, leap: 300, hold: 180, fire: 270, return: 240 },
  },
  zhuluan: {
    particleColor: 0xff8a6a,  arcHeight: 110, shakeIntensity: 6, signature: 'dual-fireball',
    duration: { prepare: 130, leap: 320, hold: 160, fire: 290, return: 250 },
  },
  canlan: {
    particleColor: 0x6ab7ff,  arcHeight: 100, shakeIntensity: 6, signature: 'lightning-xcross',
    duration: { prepare: 120, leap: 290, hold: 150, fire: 260, return: 230 },
  },
  luoluo: {
    particleColor: 0xffa500,  arcHeight:  60, shakeIntensity: 7, signature: 'triple-dash',
    duration: { prepare: 100, leap: 200, hold:  80, fire: 420, return: 200 },
  },
  zhaoyu: {
    particleColor: 0x4adb8e,  arcHeight:  80, shakeIntensity: 4, signature: 'python-summon',
    duration: { prepare: 160, leap: 320, hold: 240, fire: 340, return: 240 },
  },
};

const DEFAULT_PERSONALITY: SpiritPersonality = {
  particleColor: 0xFFD700, arcHeight: 90, shakeIntensity: 5, signature: 'generic',
  duration: { prepare: 120, leap: 290, hold: 160, fire: 260, return: 230 },
};

// ─── Phase 4 context passed to every signature function ───────────────────

interface Phase4Ctx {
  stage:    Container;
  avatar:   SpiritPortrait;
  centerX:  number;
  centerY:  number;
  targets:  { x: number; y: number }[];
  color:    number;
  duration: number;          // D.fire ms
  shakeIntensity: number;
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface AttackOptions {
  stage:   Container;
  symbolId: number;
  spiritKey: string;
  originX: number;
  originY: number;
  targetPositions: { x: number; y: number }[];
  particleColor?: number;
  shakeIntensity?: number;
}

export async function attackTimeline(opts: AttackOptions): Promise<void> {
  const personality    = PERSONALITIES[opts.spiritKey] ?? DEFAULT_PERSONALITY;
  const particleColor  = opts.particleColor  ?? personality.particleColor;
  const shakeIntensity = opts.shakeIntensity ?? personality.shakeIntensity;
  const D = personality.duration;

  const centerX = Math.round(CANVAS_WIDTH  / 2);
  const centerY = Math.round(CANVAS_HEIGHT * 0.42);

  const { stage, symbolId, originX, originY, targetPositions } = opts;

  // Ghost avatar
  const avatar = new SpiritPortrait(symbolId, 64);
  avatar.x = originX;
  avatar.y = originY;
  stage.addChild(avatar);

  // Phase 1: Prepare
  await tween(D.prepare, p => {
    avatar.scale.set(1 + Easings.easeOut(p) * 0.40);
  });

  // Phase 2: Leap
  await tween(D.leap, p => {
    const ep = Easings.easeInOut(p);
    avatar.x = originX + (centerX - originX) * ep;
    const arc = -personality.arcHeight * 4 * p * (1 - p);
    avatar.y = originY + (centerY - originY) * ep + arc;
    avatar.scale.set(1.40 + ep * 0.15);
  });
  avatar.x = centerX;
  avatar.y = centerY;

  // Phase 3: Hold
  await tween(D.hold, p => {
    avatar.scale.set(1.55 + Math.sin(p * Math.PI * 5) * 0.06);
  });
  avatar.scale.set(1.55);

  // Phase 4: Fire — dispatch on signature
  const ctx: Phase4Ctx = {
    stage, avatar, centerX, centerY,
    targets: targetPositions,
    color: particleColor,
    duration: D.fire,
    shakeIntensity,
  };

  switch (personality.signature) {
    case 'lightning-xcross': await _sigLightningXCross(ctx); break;
    case 'triple-dash':      await _sigTripleDash(ctx);      break;
    case 'dual-fireball':    await _sigDualFireball(ctx);    break;
    case 'python-summon':    await _sigPythonSummon(ctx);    break;
    default: {
      const shots = targetPositions.map(tp =>
        _fireShot(stage, centerX, centerY, tp.x, tp.y, particleColor, D.fire));
      await Promise.all([...shots, _screenShake(stage, shakeIntensity)]);
    }
  }

  // Phase 5: Return
  const retX = originX;
  const retY = originY;
  await tween(D.return, p => {
    const ep = Easings.easeOut(p);
    avatar.x = centerX + (retX - centerX) * ep;
    avatar.y = centerY + (retY - centerY) * ep;
    avatar.scale.set(1.55 - ep * 0.55);
  });

  avatar.destroy();
}

// ═══════════════════════════════════════════════════════════════════════════
//   SIGNATURE IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

// ─── 蒼嵐 — Lightning X-Cross ────────────────────────────────────────────

async function _sigLightningXCross(ctx: Phase4Ctx): Promise<void> {
  const { stage, centerX: cx, centerY: cy, targets, color, duration } = ctx;

  // 1. X-cross slash at centre — two diagonal Graphics lines
  const slash = new Graphics();
  const arm   = 46;
  slash.x = cx; slash.y = cy;
  slash.moveTo(-arm, -arm).lineTo(arm, arm).stroke({ width: 5, color, alpha: 0.9 });
  slash.moveTo( arm, -arm).lineTo(-arm, arm).stroke({ width: 5, color, alpha: 0.9 });
  stage.addChild(slash);
  const slashGlow = applyGlow(slash, color, 4, 12);

  // 2. Shockwave ring from centre (concurrent)
  const swPromise = applyShockwave(stage, cx, cy, 130, duration);

  // 3. Staggered lightning bolts to each target
  const boltMs = Math.floor(duration * 0.65);
  const boltPromises = targets.map(async (tp, i) => {
    await delay(i * 45);
    const bolt = _lightningPath(cx, cy, tp.x, tp.y, color, 7);
    stage.addChild(bolt);
    const bGlow = applyGlow(bolt, color, 3, 8);
    await tween(boltMs, p => { bolt.alpha = 1 - p; });
    removeFilter(bolt, bGlow);
    bolt.destroy();
  });

  await Promise.all(boltPromises);

  // 4. White screen flash
  const flash = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0xffffff, alpha: 0.55 });
  stage.addChild(flash);
  await tween(110, p => { flash.alpha = 0.55 * (1 - p); });
  flash.destroy();

  // 5. Hitstop placeholder (proper ticker freeze wired in T5)
  await delay(60);

  removeFilter(slash, slashGlow);
  slash.destroy();
  await swPromise;
}

// ─── 珞洛 — Triple Dash ──────────────────────────────────────────────────

async function _sigTripleDash(ctx: Phase4Ctx): Promise<void> {
  const { stage, avatar, centerX: cx, centerY: cy, targets, color, duration } = ctx;

  const dashMs = Math.floor(duration / 4.2); // ~100ms per dash

  for (let dash = 0; dash < 3; dash++) {
    const tp      = targets[Math.min(dash, targets.length - 1)];
    const startX  = avatar.x;
    const startY  = avatar.y;
    const endX    = tp.x + (Math.random() - 0.5) * 24;
    const endY    = tp.y;

    // Afterimage: faint circle at departure point
    const ghost = new Graphics().circle(0, 0, 22).fill({ color, alpha: 0.38 });
    ghost.x = startX; ghost.y = startY;
    stage.addChild(ghost);
    void tween(dashMs * 2.4, p => { ghost.alpha = 0.38 * (1 - p); })
         .then(() => ghost.destroy());

    // Dash movement
    await tween(dashMs, p => {
      avatar.x = startX + (endX - startX) * Easings.easeIn(p);
      avatar.y = startY + (endY - startY) * Easings.easeIn(p);
    }, Easings.easeIn);

    // Claw slash marks at impact
    const claw = new Graphics();
    for (let i = 0; i < 3; i++) {
      const angle = (-0.4 + i * 0.4) + Math.PI / 2;
      claw
        .moveTo(tp.x - Math.cos(angle) * 8, tp.y - Math.sin(angle) * 28)
        .lineTo(tp.x + Math.cos(angle) * 8, tp.y + Math.sin(angle) * 28)
        .stroke({ width: 3.5, color, alpha: 0.85 });
    }
    stage.addChild(claw);
    await tween(110, p => { claw.alpha = 1 - p; });
    claw.destroy();
  }

  // Final heavy claw burst: 4 radiating slashes
  const lastTp   = targets[Math.min(2, targets.length - 1)];
  const burst    = new Graphics();
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    burst
      .moveTo(lastTp.x, lastTp.y)
      .lineTo(lastTp.x + Math.cos(angle) * 56, lastTp.y + Math.sin(angle) * 56)
      .stroke({ width: 4.5, color, alpha: 0.92 });
  }
  stage.addChild(burst);
  const bGlow = applyGlow(burst, color, 5, 14);
  await tween(220, p => {
    burst.scale.set(1 + p * 0.8);
    burst.alpha = 1 - p;
  });
  removeFilter(burst, bGlow);
  burst.destroy();

  // Hitstop placeholder
  await delay(80);

  // Snap avatar back to centre so Phase 5 can return normally
  avatar.x = cx;
  avatar.y = cy;
}

// ─── 朱鸞 — Dual Fireball ────────────────────────────────────────────────

async function _sigDualFireball(ctx: Phase4Ctx): Promise<void> {
  const { stage, centerX: cx, centerY: cy, targets, color, duration } = ctx;

  // 1. Two fireballs charge at avatar hands (left and right of centre)
  const fireMs  = Math.floor(duration * 0.35);
  const balls: Graphics[] = [];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const fb   = new Graphics().circle(0, 0, 8).fill({ color, alpha: 0.9 });
    fb.x = cx + side * 28; fb.y = cy;
    stage.addChild(fb);
    const fg = applyGlow(fb, color, 3, 10);
    await tween(fireMs, p => {
      const r = 8 + p * 14;
      fb.clear().circle(0, 0, r).fill({ color, alpha: 0.9 - p * 0.2 });
    });
    removeFilter(fb, fg);
    balls.push(fb);
  }

  // 2. Launch both fireballs (each to a different target)
  const launchMs = Math.floor(duration * 0.5);
  const launchPromises = balls.map(async (fb, i) => {
    const tp  = targets[Math.min(i, targets.length - 1)];
    const sx  = fb.x, sy = fb.y;
    const lg  = applyGlow(fb, color, 5, 16);

    await tween(launchMs, p => {
      const ep = Easings.easeIn(p);
      fb.x = sx + (tp.x - sx) * ep;
      fb.y = sy + (tp.y - sy) * ep;
      fb.scale.set(1 - ep * 0.4);
      fb.alpha  = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
    });
    removeFilter(fb, lg);

    // Impact burst
    const burst = new Graphics().circle(0, 0, 22).fill({ color, alpha: 0.72 });
    burst.x = tp.x; burst.y = tp.y;
    stage.addChild(burst);
    await tween(240, p => {
      burst.scale.set(1 + p * 2.2);
      burst.alpha = 0.72 * (1 - p);
    });
    burst.destroy();
    fb.destroy();
  });

  // 3. BloomFilter on stage during launch (adds glow-bloom to whole scene)
  const bloom = applyBloom(stage, 1.8);
  await Promise.all(launchPromises);
  removeFilter(stage, bloom);

  // 4. Screen shake + brief pause
  await Promise.all([_screenShake(stage, ctx.shakeIntensity), delay(60)]);
}

// ─── 昭宇 — Python Summon ────────────────────────────────────────────────

async function _sigPythonSummon(ctx: Phase4Ctx): Promise<void> {
  const { stage, targets, color, duration } = ctx;

  const tp = targets[0]; // primary target

  // 1. Summoning circle: concentric rings + 5-pointed star
  const circle = new Graphics();
  stage.addChild(circle);

  await tween(200, p => {
    circle.clear();
    const alpha = p * 0.75;
    // 3 concentric rings
    for (const r of [28, 48, 66]) {
      circle.circle(tp.x, tp.y, r).stroke({ width: 2, color, alpha });
    }
    // 5-pointed star outline
    const pts = _starPoints(tp.x, tp.y, 5, 60, 26);
    circle.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) circle.lineTo(pts[i].x, pts[i].y);
    circle.lineTo(pts[0].x, pts[0].y);
    circle.stroke({ width: 1.5, color, alpha: alpha * 0.8 });
  });

  // 2. Shockwave ring at target (substitutes for DisplacementFilter distortion)
  const swPromise = applyShockwave(stage, tp.x, tp.y, 90, 180);

  // 3. Serpent: zigzag path rising from target
  const snakeMs = Math.floor(duration * 0.55);
  const snake   = new Graphics();
  stage.addChild(snake);
  const snakeGlow = applyGlow(snake, color, 3, 8);
  const segments  = 8;

  await tween(snakeMs, p => {
    snake.clear();
    const visLen = p;                     // fraction of snake visible so far
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      if (t > visLen) break;
      const wave = Math.sin(t * Math.PI * 3 + p * Math.PI * 4) * 18;
      pts.push({ x: tp.x + wave, y: tp.y - t * 120 });
    }
    if (pts.length > 1) {
      snake.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) snake.lineTo(pts[i].x, pts[i].y);
      snake.stroke({ width: 5, color, alpha: 0.85 });
    }
  });

  // 4. Three green tint pulses on the impact circle
  for (let pulse = 0; pulse < 3; pulse++) {
    const ring = new Graphics()
      .circle(tp.x, tp.y, 20 + pulse * 12)
      .stroke({ width: 3, color, alpha: 0.7 });
    stage.addChild(ring);
    await tween(100, p => {
      ring.scale.set(1 + p * 0.8);
      ring.alpha = 0.7 * (1 - p);
    });
    ring.destroy();
    await delay(30);
  }

  // Hitstop placeholder
  await delay(50);

  // Cleanup
  removeFilter(snake, snakeGlow);
  snake.destroy();
  circle.clear();
  circle.destroy();
  await swPromise;
}

// ═══════════════════════════════════════════════════════════════════════════
//   INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Generic projectile shot (male spirits / fallback). */
async function _fireShot(
  stage: Container,
  sx: number, sy: number,
  tx: number, ty: number,
  color: number,
  durationMs: number,
): Promise<void> {
  const halo = new Graphics().circle(0, 0, 14).fill({ color, alpha: 0.32 });
  const core = new Graphics().circle(0, 0,  6).fill({ color, alpha: 0.95 });
  const proj = new Container();
  proj.addChild(halo, core);
  proj.x = sx; proj.y = sy;
  stage.addChild(proj);

  await tween(durationMs, p => {
    const ep  = Easings.easeIn(p);
    proj.x    = sx + (tx - sx) * ep;
    proj.y    = sy + (ty - sy) * ep;
    proj.scale.set(1.1 - ep * 0.45);
    proj.alpha = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
  });

  const burst = new Graphics().circle(0, 0, 18).fill({ color, alpha: 0.65 });
  burst.x = tx; burst.y = ty;
  stage.addChild(burst);
  await tween(200, p => {
    burst.scale.set(1 + p * 1.8);
    burst.alpha = 0.65 * (1 - p);
  });

  proj.destroy();
  burst.destroy();
}

async function _screenShake(stage: Container, intensity: number): Promise<void> {
  const ox = stage.x, oy = stage.y;
  await tween(300, p => {
    const decay = 1 - p;
    stage.x = ox + (Math.random() - 0.5) * intensity * 2 * decay;
    stage.y = oy + (Math.random() - 0.5) * intensity * 2 * decay;
  });
  stage.x = ox; stage.y = oy;
}

/** Returns a jagged lightning path as a Graphics object. */
function _lightningPath(
  sx: number, sy: number,
  tx: number, ty: number,
  color: number,
  segments: number = 7,
): Graphics {
  const g  = new Graphics();
  const dx = tx - sx, dy = ty - sy;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return g;
  const nx = -dy / d, ny = dx / d;

  const pts: { x: number; y: number }[] = [{ x: sx, y: sy }];
  for (let i = 1; i < segments; i++) {
    const t      = i / segments;
    const jitter = (Math.random() - 0.5) * d * 0.18;
    pts.push({ x: sx + dx * t + nx * jitter, y: sy + dy * t + ny * jitter });
  }
  pts.push({ x: tx, y: ty });

  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke({ width: 2.5, color, alpha: 0.93 });
  return g;
}

/** Returns alternating inner/outer points of a star polygon. */
function _starPoints(
  cx: number, cy: number,
  points: number,
  outer: number,
  inner: number,
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const r     = i % 2 === 0 ? outer : inner;
    result.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return result;
}
