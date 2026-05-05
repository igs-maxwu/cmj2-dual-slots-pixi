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
import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { tween, delay, Easings } from '@/systems/tween';
import { applyGlow, applyBloom, applyShockwave, removeFilter } from '@/fx/GlowWrapper';
import { AudioManager } from '@/systems/AudioManager';

// ─── d-04 helper ─────────────────────────────────────────────────────────────

/**
 * d-04: Build a SOS2 single-webp FX sprite, additive-blended, anchor centered.
 * Returns null if asset not loaded (caller null-checks + skips the FX layer).
 * Pixi 8 blendMode uses string enum 'add' (v7 used BLEND_MODES.ADD).
 */
function _makeFxSprite(assetKey: string, tint: number = 0xffffff): Sprite | null {
  const tex = Assets.get<Texture>(assetKey);
  if (!tex || tex === Texture.EMPTY) return null;
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.tint = tint;
  s.blendMode = 'add';
  return s;
}

// ─── Signature types ────────────────────────────────────────────────────────

export type SpiritSignature =
  | 'lightning-xcross'   // 蒼嵐 — X-slash + cyan lightning + shockwave
  | 'triple-dash'        // 珞洛 — 3× melee dash + afterimages + tiger claw
  | 'dual-fireball'      // 朱鸞 — twin fireball charge + particle burst
  | 'python-summon'      // 朝雨 — summoning circle + serpent
  | 'dragon-dual-slash'  // 孟辰璋 — twin jade swords + dragon-scale trail
  | 'tiger-fist-combo'      // 寅 — 3× heavy punch + tiger ghost + earth crack
  | 'tortoise-hammer-smash' // 玄墨 — charge → overhead smash → radial crack + shell halo
  | 'phoenix-flame-arrow'  // 凌羽 — bow draw → bezier flame arrow → phoenix burst
  | 'generic';             // (no remaining spirits — all signatures landed)

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
    particleColor: 0x4a90e2,  arcHeight: 130, shakeIntensity: 8, signature: 'dragon-dual-slash',
    duration: { prepare: 130, leap: 300, hold: 180, fire: 640, return: 240 },
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
  yin: {
    particleColor: 0xff8c33,  arcHeight:  90, shakeIntensity: 9, signature: 'tiger-fist-combo',
    duration: { prepare: 130, leap: 290, hold: 160, fire: 720, return: 230 },
  },
  xuanmo: {
    particleColor: 0xa0a8c0,  arcHeight: 110, shakeIntensity: 12, signature: 'tortoise-hammer-smash',
    duration: { prepare: 140, leap: 310, hold: 200, fire: 750, return: 250 },
  },
  lingyu: {
    particleColor: 0xFF4500,  arcHeight:  80, shakeIntensity: 7, signature: 'phoenix-flame-arrow',
    duration: { prepare: 120, leap: 280, hold: 140, fire: 700, return: 220 },
  },
};

const DEFAULT_PERSONALITY: SpiritPersonality = {
  particleColor: 0xFFD700, arcHeight: 90, shakeIntensity: 5, signature: 'generic',
  duration: { prepare: 120, leap: 290, hold: 160, fire: 260, return: 230 },
};

// ─── Phase 4 context passed to every signature function ───────────────────

interface Phase4Ctx {
  stage:    Container;
  avatar:   Container;   // chore: widened from SpiritPortrait — Sprite and SpiritPortrait both extend Container
  centerX:  number;
  centerY:  number;
  targets:  { x: number; y: number }[];
  color:    number;
  duration: number;          // D.fire ms
  shakeIntensity: number;
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface AttackOptions {
  stage:           Container;   // fx layer (signature animations drawn here)
  spiritContainer: Container;   // chore: animate this directly — was: create new clone avatar
  symbolId:        number;      // for signature dispatch
  spiritKey:       string;      // for personality lookup + signature dispatch
  targetPositions: { x: number; y: number }[];
  particleColor?:  number;
  shakeIntensity?: number;
  side?: 'A' | 'B';            // clash positioning — A centre-left, B centre-right
  /** chore #185-G: called once at the start of Phase 4 (fire) — caller spawns hit reactions */
  onFireImpact?: () => void;
}

export async function attackTimeline(opts: AttackOptions): Promise<void> {
  const personality    = PERSONALITIES[opts.spiritKey] ?? DEFAULT_PERSONALITY;
  const particleColor  = opts.particleColor  ?? personality.particleColor;
  const shakeIntensity = opts.shakeIntensity ?? personality.shakeIntensity;
  const D = personality.duration;

  // chore: side-aware clash position — A leaps to centre-left, B to centre-right (140px gap between them)
  const side = opts.side ?? 'A';
  const CLASH_OFFSET = 70;
  const centerX = side === 'A'
    ? Math.round(CANVAS_WIDTH / 2 - CLASH_OFFSET)
    : Math.round(CANVAS_WIDTH / 2 + CLASH_OFFSET);
  // chore: raise centerY to mid-formation near VS badge (was CANVAS_HEIGHT*0.42=538, below front row)
  const centerY = 420;

  const { stage, spiritContainer, targetPositions } = opts;
  const avatar = spiritContainer;   // alias — animate formation spirit directly (no clone)

  // chore: save container's original state to fully restore after attack
  const origX      = avatar.x;
  const origY      = avatar.y;
  const origScaleX = avatar.scale.x;
  const origScaleY = avatar.scale.y;
  const origZIndex = avatar.zIndex;
  // base scale for this slot (e.g. 0.85 back / 1.10 front) — phases multiply on top
  const origAbsScale = Math.abs(origScaleX) || 1.0;
  // chore #194: uniform scale at clash centre — back-row + front-row same size at centre
  // (was origAbsScale × factor so back 0.85×1.30=1.105 vs front 1.10×1.30=1.430)
  const CLASH_SCALE = 1.0;

  // Bring spirit to top during attack so it renders above all other formation elements
  avatar.zIndex = 1500;
  if (avatar.parent) avatar.parent.sortableChildren = true;

  // chore: drawFormation (BattleScreen) already flips A side sprite child (sprite.scale.x *= -1).
  // Container scale.x is uniform positive in formation. Preserve its original sign during attack
  // so the pre-oriented sprite child facing stays intact. Previous faceDir A:-1 caused double-flip
  // (container flipped) × (sprite child already flipped) = net no-flip → A appeared facing left.
  const baseSign = Math.sign(origScaleX) || 1;

  // Phase 1: Prepare — scale up from base scale
  await tween(D.prepare, p => {
    const s = origAbsScale * (1.0 + Easings.easeOut(p) * 0.20);
    avatar.scale.set(baseSign * s, s);
  });

  // Phase 2: Leap from formation slot to clash centre
  await tween(D.leap, p => {
    const ep = Easings.easeInOut(p);
    avatar.x = origX + (centerX - origX) * ep;
    const arc = -personality.arcHeight * 4 * p * (1 - p);
    avatar.y = origY + (centerY - origY) * ep + arc;
    // chore #194: scale lerps from origAbsScale (origin slot) → CLASH_SCALE (centre) during leap
    const factor = 1.20 + ep * 0.10;
    const sBase = origAbsScale + (CLASH_SCALE - origAbsScale) * ep;
    const s = sBase * factor;
    avatar.scale.set(baseSign * s, s);
  });
  avatar.x = centerX;
  avatar.y = centerY;

  // Phase 3: Hold — scale pulse at clash centre (chore #194: CLASH_SCALE base, uniform)
  await tween(D.hold, p => {
    const s = CLASH_SCALE * (1.30 + Math.sin(p * Math.PI * 5) * 0.04);
    avatar.scale.set(baseSign * s, s);
  });
  avatar.scale.set(baseSign * CLASH_SCALE * 1.30, CLASH_SCALE * 1.30);

  // chore #185-G: notify caller to spawn hit reactions concurrent with signature fx
  try {
    opts.onFireImpact?.();
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[attackTimeline] onFireImpact threw', err);
  }

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
    case 'dragon-dual-slash': await _sigDragonDualSlash(ctx); break;
    case 'tiger-fist-combo':       await _sigTigerFistCombo(ctx);       break;
    case 'tortoise-hammer-smash':  await _sigTortoiseHammerSmash(ctx);  break;
    case 'phoenix-flame-arrow':    await _sigPhoenixFlameArrow(ctx);    break;
    default: {
      const shots = targetPositions.map(tp =>
        _fireShot(stage, centerX, centerY, tp.x, tp.y, particleColor, D.fire));
      await Promise.all([...shots, _screenShake(stage, shakeIntensity)]);
    }
  }

  // Phase 5: Return to formation slot
  await tween(D.return, p => {
    const ep = Easings.easeOut(p);
    avatar.x = centerX + (origX - centerX) * ep;
    avatar.y = centerY + (origY - centerY) * ep;
    // chore #194: scale lerp from CLASH_SCALE (centre) → origAbsScale (origin slot)
    const factor = 1.30 - ep * 0.30;   // phase multiplier 1.30 → 1.0
    const sBase = CLASH_SCALE + (origAbsScale - CLASH_SCALE) * ep;
    const s = sBase * factor;
    avatar.scale.set(baseSign * s, s);
  });

  // Restore original container state exactly (no destroy — it's the live formation container)
  avatar.x = origX;
  avatar.y = origY;
  avatar.scale.set(origScaleX, origScaleY);   // restores sign + base scale
  avatar.zIndex = origZIndex;
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

// ─── 朝雨 — Python Summon ────────────────────────────────────────────────

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

// ─── 孟辰璋 — Dragon Dual Slash ──────────────────────────────────────────

async function _sigDragonDualSlash(ctx: Phase4Ctx): Promise<void> {
  const { stage, centerX: cx, centerY: cy, targets, color } = ctx;
  AudioManager.playSfx('skill-meng');
  const AZURE = 0x4a90e2, AZURE_LITE = 0xa0d8ff;
  const SWORD_W = 6, SWORD_H = 44;

  // d-04: dual azure fire-wave layer (additive, concurrent with entire slash)
  const fireA = _makeFxSprite('sos2-fire-wave', 0x6ad8ff);
  const fireB = _makeFxSprite('sos2-fire-wave', 0x6ad8ff);
  if (fireA && fireB) {
    fireA.x = cx - 60; fireA.y = cy;
    fireB.x = cx + 60; fireB.y = cy;
    fireA.scale.set(0.5); fireB.scale.set(0.5);
    fireA.alpha = 0;      fireB.alpha = 0;
    stage.addChild(fireA, fireB);
    void tween(ctx.duration, t => {
      const a = Easings.easeOut(t);
      fireA.alpha = (1 - t) * 0.9;
      fireB.alpha = (1 - t) * 0.9;
      fireA.scale.set(0.5 + a * 1.3);
      fireB.scale.set(0.5 + a * 1.3);
      fireA.rotation = -t * 0.4;
      fireB.rotation = +t * 0.4;
    });
    setTimeout(() => { fireA.destroy(); fireB.destroy(); }, ctx.duration + 50);
  }

  // (a) 0–120ms: two jade swords appear
  const drawSword = (g: Graphics) => {
    g.clear();
    g.rect(-SWORD_W / 2, -SWORD_H / 2, SWORD_W, SWORD_H).fill(AZURE_LITE);
    g.rect(-1, -SWORD_H / 2, 2, SWORD_H).fill(AZURE);
  };
  const swordL = new Graphics(); drawSword(swordL);
  const swordR = new Graphics(); drawSword(swordR);
  swordL.x = cx - 28; swordL.y = cy; swordL.alpha = 0;
  swordR.x = cx + 28; swordR.y = cy; swordR.alpha = 0;
  stage.addChild(swordL, swordR);
  const glowL = applyGlow(swordL, AZURE, 3, 10);
  const glowR = applyGlow(swordR, AZURE, 3, 10);
  await tween(120, p => { swordL.alpha = swordR.alpha = p; });

  // (b+c) 120–400ms: diagonal slash + hex particle trail
  const tp0 = targets[0] ?? { x: cx, y: cy + 80 };
  const tp1 = targets[1] ?? targets[0] ?? { x: cx, y: cy + 80 };
  const PARTICLE_COUNT = 12;
  const particles: Graphics[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const pt = new Graphics();
    const r = 4;
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      if (s === 0) pt.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else pt.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    pt.closePath().fill({ color: AZURE, alpha: 0.8 });
    pt.visible = false;
    stage.addChild(pt);
    particles.push(pt);
  }
  let spawnIdx = 0;
  await tween(280, p => {
    const ep = Easings.easeIn(p);
    swordL.rotation = -0.8 - p * 0.8;
    swordL.x = cx - 28 + (tp0.x - (cx - 28)) * ep;
    swordL.y = cy + (tp0.y - cy) * ep;
    swordR.rotation = 0.8 + p * 0.8;
    swordR.x = cx + 28 + (tp1.x - (cx + 28)) * ep;
    swordR.y = cy + (tp1.y - cy) * ep;
    if (p > 0.15 && spawnIdx < PARTICLE_COUNT) {
      const pt = particles[spawnIdx++];
      const src = spawnIdx % 2 === 0 ? swordL : swordR;
      pt.x = src.x + (Math.random() - 0.5) * 10;
      pt.y = src.y + (Math.random() - 0.5) * 10;
      pt.alpha = 0.8; pt.visible = true;
    }
    for (let i = 0; i < spawnIdx; i++)
      particles[i].alpha = Math.max(0, particles[i].alpha - 0.04);
  });

  // (d) 400–520ms: impact flash + glow rings
  const flash = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0xffffff, alpha: 0.4 });
  flash.alpha = 0.4; stage.addChild(flash);
  const impactA = new Graphics().circle(tp0.x, tp0.y, 22).fill({ color: AZURE, alpha: 0.65 });
  const impactB = new Graphics().circle(tp1.x, tp1.y, 22).fill({ color: AZURE, alpha: 0.65 });
  stage.addChild(impactA, impactB);
  const glowIA = applyGlow(impactA, AZURE, 2.5, 16);
  const glowIB = applyGlow(impactB, AZURE, 2.5, 16);
  await Promise.all([
    tween(80,  p => { flash.alpha = 0.4 * (1 - p); }),
    tween(120, p => {
      impactA.scale.set(1 + p * 1.3); impactA.alpha = 0.65 * (1 - p);
      impactB.scale.set(1 + p * 1.3); impactB.alpha = 0.65 * (1 - p);
    }),
    _screenShake(stage, ctx.shakeIntensity),
  ]);

  // (e) 520–640ms: swords fade + hitstop
  await Promise.all([
    tween(120, p => { swordL.alpha = swordR.alpha = 1 - p; }),
    delay(60),
  ]);

  // Cleanup
  removeFilter(swordL, glowL); swordL.destroy();
  removeFilter(swordR, glowR); swordR.destroy();
  removeFilter(impactA, glowIA); impactA.destroy();
  removeFilter(impactB, glowIB); impactB.destroy();
  flash.destroy();
  for (const pt of particles) pt.destroy();
  void color;
}

// ─── 寅 — Tiger Fist Combo ───────────────────────────────────────────────

async function _sigTigerFistCombo(ctx: Phase4Ctx): Promise<void> {
  const { stage, avatar, centerX: cx, centerY: cy, targets, color: TIGER } = ctx;
  AudioManager.playSfx('skill-yin');

  const tp0 = targets[0] ?? { x: cx, y: cy + 80 };
  const tp1 = targets[1] ?? tp0;

  // (a) 0–120ms: charge pose — glow + expanding foot ring
  const chargeGlow = applyGlow(avatar, TIGER, 2.5, 14);
  const footRing = new Graphics();
  stage.addChild(footRing);
  await tween(120, p => {
    footRing.clear()
      .circle(cx, cy + 32, 30 + p * 20)
      .fill({ color: TIGER, alpha: 0.6 * (1 - p) });
  });
  footRing.destroy();

  // Punch helper — lunge 10 px toward target + concurrent impact ring + afterimage
  const doPunch = async (tp: { x: number; y: number }, ms: number) => {
    const startX = avatar.x, startY = avatar.y;
    const dx = tp.x - startX, dy = tp.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const lungeX = startX + (dx / dist) * 10;
    const lungeY = startY + (dy / dist) * 10;

    // Afterimage at departure (fire-and-forget)
    const ghost = new Graphics().circle(0, 0, 22).fill({ color: TIGER, alpha: 0.4 });
    ghost.x = startX; ghost.y = startY; ghost.scale.set(1.05);
    stage.addChild(ghost);
    void tween(150, p2 => { ghost.alpha = 0.4 * (1 - p2); }).then(() => ghost.destroy());

    // Lunge out (first half) + return (second half) + impact ring
    const ring = new Graphics();
    stage.addChild(ring);
    await tween(ms, p => {
      const lerp = p < 0.5 ? p * 2 : (1 - p) * 2;
      avatar.x = startX + (lungeX - startX) * lerp;
      avatar.y = startY + (lungeY - startY) * lerp;
      if (p < 0.6) {
        const rp = p / 0.6;
        ring.clear()
          .circle(tp.x, tp.y, 16 + rp * 12)
          .stroke({ width: 3, color: TIGER, alpha: 0.9 * (1 - rp) });
      }
    });
    avatar.x = cx; avatar.y = cy;
    ring.destroy();
  };

  // d-04: per-punch radial flash (3 hits) — fire-and-forget, approx hit timing
  for (let i = 0; i < 3; i++) {
    const punchT = i * (ctx.duration / 3);
    setTimeout(() => {
      const flash = _makeFxSprite('sos2-radial-lights', 0xffaa44);
      if (!flash) return;
      flash.x = (i === 1 ? tp1.x : tp0.x) + (Math.random() - 0.5) * 80;
      flash.y = (i === 1 ? tp1.y : tp0.y) + (Math.random() - 0.5) * 60;
      flash.scale.set(0.3);
      flash.alpha = 0.95;
      stage.addChild(flash);
      void tween(180, t => {
        flash.alpha = 0.95 * (1 - t);
        flash.scale.set(0.3 + t * 0.8);
        flash.rotation = t * 0.5;
      }, Easings.easeOut).then(() => flash.destroy());
    }, punchT);
  }

  // (b) 120–300ms: 1st heavy punch → target 0
  await doPunch(tp0, 180);
  // (c) 300–480ms: 2nd heavy punch → target 1
  await doPunch(tp1, 180);
  // (d) 480–560ms: 3rd decisive blow (faster)
  await doPunch(tp0, 80);

  // (d cont) 560–620ms: earth crack cross + shockwave (concurrent, fire-and-forget shake)
  const crackX = tp0.x, crackY = tp0.y + 40;
  const crack = new Graphics();
  crack.rect(crackX - 30, crackY - 3, 60, 6).fill({ color: TIGER, alpha: 0.9 });
  crack.rect(crackX - 3, crackY - 30, 6, 60).fill({ color: TIGER, alpha: 0.9 });
  stage.addChild(crack);
  const swPromise = applyShockwave(stage, crackX, crackY, 80, 100);
  void _screenShake(stage, ctx.shakeIntensity);
  await tween(60, p => { crack.alpha = 0.9 * (1 - p); });
  crack.destroy();

  // (e) 620–720ms: tiger ghost — dual-ring flash (白虎加持)
  const ghostOuter = new Graphics().circle(cx, cy, 90).fill({ color: 0xffffff, alpha: 0.25 });
  const ghostInner = new Graphics().circle(cx, cy, 50).fill({ color: TIGER, alpha: 0.40 });
  stage.addChild(ghostOuter, ghostInner);
  await tween(100, p => {
    ghostOuter.alpha = 0.25 * (1 - p);
    ghostInner.alpha = 0.40 * (1 - p);
  });
  ghostOuter.destroy();
  ghostInner.destroy();

  // Cleanup
  removeFilter(avatar, chargeGlow);
  await swPromise;
}

// ─── 玄墨 — Tortoise Hammer Smash ───────────────────────────────────────

async function _sigTortoiseHammerSmash(ctx: Phase4Ctx): Promise<void> {
  const { stage, avatar, centerX: cx, centerY: cy, targets, color } = ctx;
  AudioManager.playSfx('skill-xuanmo');
  const CRACK = 0x3a4055;
  const GOLD  = 0xd4af37;

  const tp0 = targets[0] ?? { x: cx, y: cy + 80 };

  // (a) 0–250ms: charge — hammer rises above head + silver spiral particles
  const hammerBody = new Graphics();
  hammerBody.rect(-11, -72, 22, 72).fill({ color: CRACK, alpha: 0.9 });
  hammerBody.rect(-4,  -72,  8, 72).fill({ color, alpha: 0.45 });    // silver highlight stripe
  const hammerHead = new Graphics().circle(0, -72, 8).fill({ color: GOLD, alpha: 0.95 });
  const hammer = new Container();
  hammer.addChild(hammerBody, hammerHead);
  hammer.x = cx; hammer.y = cy; hammer.alpha = 0;
  stage.addChild(hammer);
  const hammerGlow = applyGlow(hammer, color, 2, 10);

  const spiralPts: Graphics[] = [];
  for (let i = 0; i < 6; i++) {
    const pt = new Graphics().circle(0, 0, 4).fill({ color, alpha: 0.7 });
    stage.addChild(pt);
    spiralPts.push(pt);
  }

  const origX = avatar.x;
  await tween(250, p => {
    avatar.x = origX - 5 * Easings.easeOut(p);
    hammer.alpha = Easings.easeOut(p);
    hammer.y = cy + 20 - 80 * Easings.easeOut(p);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + p * Math.PI * 4;
      const r = 30 + p * 20;
      spiralPts[i].x = cx + Math.cos(angle) * r;
      spiralPts[i].y = (cy - 20) + Math.sin(angle) * r * 0.5;
      spiralPts[i].alpha = 0.7 * (1 - p * 0.5);
    }
  });

  // (b) 250–400ms: overhead dive smash (easeIn — accelerating)
  const hammerStartY = hammer.y;
  await tween(150, p => {
    const ep = Easings.easeIn(p);
    hammer.rotation = 1.5 * ep;
    hammer.x = cx + (tp0.x - cx) * ep;
    hammer.y = hammerStartY + (tp0.y - hammerStartY) * ep;
    for (const sp of spiralPts) sp.alpha = 0.35 * (1 - ep);
  });
  for (const sp of spiralPts) sp.destroy();

  // (c) 400–480ms: impact burst — flash + 8 radial cracks; kick off shake + shockwave
  AudioManager.playSfx('hit-heavy');
  const swPromise = applyShockwave(stage, tp0.x, tp0.y, 120, 150);
  void _screenShake(stage, ctx.shakeIntensity);

  // d-04: ground impact — smoke plume (grey particles) + radial glow
  const smoke = _makeFxSprite('sos2-particles', 0xc0c0d0);
  const impactGlow = _makeFxSprite('sos2-radial-lights', 0xffaa44);
  if (smoke) {
    smoke.x = tp0.x; smoke.y = tp0.y + 40;
    smoke.scale.set(0.4); smoke.alpha = 0.85;
    stage.addChild(smoke);
    void tween(700, t => {
      smoke.alpha = 0.85 * (1 - t);
      smoke.scale.set(0.4 + t * 1.4);
      smoke.y = tp0.y + 40 - t * 60;
    }, Easings.easeOut).then(() => smoke.destroy());
  }
  if (impactGlow) {
    impactGlow.x = tp0.x; impactGlow.y = tp0.y + 60;
    impactGlow.scale.set(0.2); impactGlow.alpha = 1;
    stage.addChild(impactGlow);
    void tween(450, t => {
      impactGlow.alpha = 1 - t;
      impactGlow.scale.set(0.2 + t * 1.6);
    }, Easings.easeOut).then(() => impactGlow.destroy());
  }

  const flash = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0xffffff, alpha: 0.5 });
  stage.addChild(flash);

  const cracks: Graphics[] = [];
  for (let i = 0; i < 8; i++) {
    const ck = new Graphics().rect(0, -2, 90, 4).fill({ color: CRACK, alpha: 0.9 });
    ck.x = tp0.x; ck.y = tp0.y;
    ck.rotation = (i / 8) * Math.PI * 2;
    ck.scale.x = 0;
    stage.addChild(ck);
    cracks.push(ck);
  }

  await tween(80, p => {
    flash.alpha = 0.5 * (1 - p);
    hammer.alpha = 1 - p;
    for (const ck of cracks) ck.scale.x = Easings.easeOut(p);
  });
  flash.destroy();

  // (d) 480–600ms: hitstop (60ms) + hex shell halo (120ms) — concurrent
  const hexHalo = new Graphics();
  hexHalo.x = cx; hexHalo.y = cy;
  stage.addChild(hexHalo);

  await Promise.all([
    delay(60),
    tween(120, p => {
      const r = 90 + 40 * p;
      hexHalo.clear().moveTo(r, 0);
      for (let s = 1; s <= 6; s++) {
        const a = (s / 6) * Math.PI * 2;
        hexHalo.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      hexHalo.closePath().stroke({ width: 4, color: GOLD, alpha: 0.5 * (1 - p) });
    }),
  ]);
  hexHalo.destroy();

  // (e) 600–720ms: cracks fade out
  await tween(120, p => {
    for (const ck of cracks) ck.alpha = 0.9 * (1 - p);
  });

  // Cleanup
  removeFilter(hammer, hammerGlow);
  hammer.destroy({ children: true });
  for (const ck of cracks) ck.destroy();
  await swPromise;
}

// ─── 凌羽 — Phoenix Flame Arrow ─────────────────────────────────────────

async function _sigPhoenixFlameArrow(ctx: Phase4Ctx): Promise<void> {
  const { stage, avatar, centerX: cx, centerY: cy, targets, color } = ctx;
  AudioManager.playSfx('skill-lingyu');
  const DARK_RED  = 0x8b1a1a;
  const GOLD_BOW  = 0xd4a028;

  const tp0 = targets[0] ?? { x: cx, y: cy + 80 };

  // (a) 0–200ms: bow + arrow appear — scale 0.8→1 + alpha 0→1 (backOut)
  const bowG = new Graphics();
  const bowX = cx + 20;
  const bowY = cy;

  // D-shaped bow: polyline arc + string
  bowG.moveTo(0, -22);
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    bowG.lineTo(Math.sin(t * Math.PI) * 16, -22 + t * 44);
  }
  bowG.stroke({ width: 3, color: GOLD_BOW, alpha: 0.9 });
  bowG.moveTo(0, -22).lineTo(0, 22).stroke({ width: 1.5, color: GOLD_BOW, alpha: 0.55 });

  bowG.x = bowX; bowG.y = bowY;
  stage.addChild(bowG);

  // Arrow: rect body + pointed tip
  const arrowG = new Graphics();
  arrowG.rect(-6, -1, 44, 2).fill({ color: DARK_RED, alpha: 0.95 });
  arrowG.moveTo(38, -3).lineTo(44, 0).lineTo(38, 3).fill({ color, alpha: 0.9 });
  arrowG.x = bowX; arrowG.y = bowY;
  stage.addChild(arrowG);

  const arrowGlow = applyGlow(arrowG, color, 1.5, 8);

  await tween(200, p => {
    const s = 0.8 + 0.2 * Easings.backOut(p);
    const a = Easings.easeOut(p);
    bowG.scale.set(s);  bowG.alpha = a;
    arrowG.scale.set(s); arrowG.alpha = a;
  });

  // (b) 200–280ms: charge flicker — 2 × 40ms alpha pulses (0.7 ↔ 1.0)
  for (let f = 0; f < 2; f++) {
    await tween(40, p => {
      const a = 0.7 + 0.3 * Math.sin(p * Math.PI);
      bowG.alpha = a; arrowG.alpha = a;
    });
  }

  // (c) 280–480ms: arrow flight along quadratic bezier + orange flame trail
  // Bow fades out in background (300ms, fire-and-forget)
  void tween(300, p => { bowG.alpha = 1 - p; }).then(() => { bowG.destroy(); });

  // d-04: fire trail following arrow path + ember burst on impact
  const trail = _makeFxSprite('sos2-fire-wave', 0xff5722);
  if (trail) {
    trail.scale.set(0.35); trail.alpha = 0;
    stage.addChild(trail);
    void tween(ctx.duration * 0.7, t => {
      trail.x = cx + (-60 + t * 120);
      trail.y = cy - 20 + Math.sin(t * Math.PI) * 10;
      trail.alpha = Math.min(1, t * 3) * (1 - Math.max(0, t - 0.7) * 3);
      trail.rotation = t * 0.3;
    });
    setTimeout(() => trail.destroy(), ctx.duration);
  }
  setTimeout(() => {
    const ember = _makeFxSprite('sos2-particles', 0xffaa00);
    if (!ember) return;
    ember.x = tp0.x; ember.y = tp0.y - 20;
    ember.scale.set(0.3); ember.alpha = 1;
    stage.addChild(ember);
    void tween(380, t => {
      ember.alpha = 1 - t;
      ember.scale.set(0.3 + t * 1.0);
    }, Easings.easeOut).then(() => ember.destroy());
  }, ctx.duration * 0.7);

  const startX = bowX + 38;  // arrow tip origin
  const startY = bowY;
  const ctrlX  = (startX + tp0.x) / 2;
  const ctrlY  = Math.min(startY, tp0.y) - 80;

  let lastSpawnSeg = -1;
  await tween(200, p => {
    const ep = Easings.easeIn(p);
    // Quadratic bezier position
    const bx = (1 - ep) * (1 - ep) * startX + 2 * (1 - ep) * ep * ctrlX + ep * ep * tp0.x;
    const by = (1 - ep) * (1 - ep) * startY + 2 * (1 - ep) * ep * ctrlY + ep * ep * tp0.y;
    // Tangent for arrow rotation
    const t1  = Math.min(ep + 0.01, 1);
    const bx1 = (1 - t1) * (1 - t1) * startX + 2 * (1 - t1) * t1 * ctrlX + t1 * t1 * tp0.x;
    const by1 = (1 - t1) * (1 - t1) * startY + 2 * (1 - t1) * t1 * ctrlY + t1 * t1 * tp0.y;
    arrowG.x = bx; arrowG.y = by;
    arrowG.rotation = Math.atan2(by1 - by, bx1 - bx);

    // Spawn flame particle every ~20ms (~10 per 200ms flight)
    const seg = Math.floor(p * 10);
    if (seg > lastSpawnSeg) {
      lastSpawnSeg = seg;
      const r = 3 + Math.random() * 2;
      const flame = new Graphics().circle(0, 0, r).fill({ color, alpha: 0.9 });
      flame.x = bx; flame.y = by;
      stage.addChild(flame);
      void tween(120, p2 => { flame.alpha = 0.9 * (1 - p2); }).then(() => { flame.destroy(); });
    }
  });

  // (d) 480–560ms: impact — flash + phoenix silhouette + shockwave + shake
  removeFilter(arrowG, arrowGlow);
  arrowG.destroy();
  AudioManager.playSfx('damage-crit');

  const swPromise = applyShockwave(stage, tp0.x, tp0.y, 90, 100);
  void _screenShake(stage, ctx.shakeIntensity);

  const flash = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0xffffff, alpha: 0.5 });
  stage.addChild(flash);

  // Phoenix silhouette: 2 rings + 2 wing rects
  const pxOuter = new Graphics().circle(0, 0, 60).fill({ color: 0xff8844, alpha: 0.35 });
  pxOuter.x = tp0.x; pxOuter.y = tp0.y;
  const pxInner = new Graphics().circle(0, 0, 30).fill({ color, alpha: 0.65 });
  pxInner.x = tp0.x; pxInner.y = tp0.y;
  const wingL = new Graphics().rect(-60, -10, 60, 20).fill({ color, alpha: 0.50 });
  wingL.x = tp0.x; wingL.y = tp0.y; wingL.rotation = -0.4;
  const wingR = new Graphics().rect(0, -10, 60, 20).fill({ color, alpha: 0.50 });
  wingR.x = tp0.x; wingR.y = tp0.y; wingR.rotation = 0.4;
  stage.addChild(pxOuter, pxInner, wingL, wingR);

  const bloom = applyBloom(stage, 1.5);
  await tween(80, p => { flash.alpha = 0.5 * (1 - p); });
  flash.destroy();
  removeFilter(stage, bloom);

  // (e) 560–700ms: phoenix fade + 5 ember particles float upward (120ms)
  const embers: Graphics[] = [];
  const emberVX: number[] = [];
  for (let i = 0; i < 5; i++) {
    const em = new Graphics().circle(0, 0, 3).fill({ color, alpha: 0.7 });
    em.x = tp0.x; em.y = tp0.y;
    stage.addChild(em);
    embers.push(em);
    emberVX.push((Math.random() - 0.5) * 1.0);
  }

  await Promise.all([
    tween(120, p => {
      pxOuter.alpha = 0.35 * (1 - p);
      pxInner.alpha = 0.65 * (1 - p);
      wingL.alpha   = 0.50 * (1 - p);
      wingR.alpha   = 0.50 * (1 - p);
      for (let i = 0; i < embers.length; i++) {
        embers[i].x = tp0.x + emberVX[i] * p * 60;
        embers[i].y = tp0.y - p * 60;
        embers[i].alpha = 0.7 * (1 - p);
      }
    }),
    delay(60),
  ]);

  // Cleanup
  pxOuter.destroy(); pxInner.destroy();
  wingL.destroy();   wingR.destroy();
  for (const em of embers) em.destroy();
  await swPromise;
  void avatar;
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
