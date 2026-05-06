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

/**
 * chore #FX-BURST: comic-style "BAM!" impact burst.
 *
 * Draws a 16-point jagged starburst polygon at (x, y):
 * - White core (alpha 0.95) for screen-dominant pop
 * - Coloured 6px stroke (spirit's particleColor) for character flavour
 *
 * Animation (380ms total):
 * - Pulse-in 180ms: scale 0.3 → 1.4, alpha 0 → 1
 * - Settle 80ms: scale 1.4 → 1.1
 * - Fade 120ms: alpha 1 → 0 (scale stays 1.1)
 *
 * Peak visual diameter ≈ 260px. Fire-and-forget (caller does not await).
 *
 * @param stage  Container to add burst to
 * @param x      Burst centre X (in stage coords)
 * @param y      Burst centre Y
 * @param color  Stroke colour (typically personality.particleColor)
 * @param scale  Optional size multiplier (default 1.0)
 */
function playComicBurst(stage: Container, x: number, y: number, color: number, scale: number = 1.0): void {
  const POINTS = 16;          // alternating outer/inner = 16 vertices
  const OUTER_R = 130 * scale;
  const INNER_R = 50 * scale;
  const STROKE_W = 6 * scale;

  const burst = new Graphics();
  // Build star polygon path
  for (let i = 0; i < POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2 - Math.PI / 2;   // start pointing up
    const r = i % 2 === 0 ? OUTER_R : INNER_R;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) burst.moveTo(px, py);
    else         burst.lineTo(px, py);
  }
  burst.closePath();
  burst.fill({ color: 0xffffff, alpha: 0.95 });
  burst.stroke({ width: STROKE_W, color, alpha: 1 });

  burst.x = x;
  burst.y = y;
  burst.alpha = 0;
  burst.scale.set(0.3);
  stage.addChild(burst);

  // Pulse-in 180ms
  void tween(180, p => {
    burst.alpha = p;
    burst.scale.set(0.3 + 1.1 * p);     // 0.3 → 1.4
  }, Easings.easeOut).then(async () => {
    // Settle 80ms
    await tween(80, p => {
      burst.scale.set(1.4 - 0.3 * p);    // 1.4 → 1.1
    }, Easings.easeOut);
    // Fade 120ms
    await tween(120, p => {
      burst.alpha = 1 - p;
    }, Easings.easeIn);
    burst.destroy();
  });
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
  /** chore #210: depth scale (0.85-1.10) of formation slot — used to compensate sprite child scale at clash */
  posScale?: number;
  /** chore #FX-PICK polish: override clash centre (default uses game arena hardcoded values).
   *  FXPreviewScreen uses this to draw FX in preview area instead of picker overlap. */
  clashX?: number;
  clashY?: number;
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
  const centerX = opts.clashX ?? (side === 'A'
    ? Math.round(CANVAS_WIDTH / 2 - CLASH_OFFSET)
    : Math.round(CANVAS_WIDTH / 2 + CLASH_OFFSET));
  // chore: raise centerY to mid-formation near VS badge (was CANVAS_HEIGHT*0.42=538, below front row)
  const centerY = opts.clashY ?? 420;

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
  // chore #210: clash uniform scale REAL fix (chore #194 was no-op — operated on container.scale which is always 1.0).
  // drawFormation sets sprite.scale = baseScale × pos.scale on the SPRITE CHILD; container.scale stays 1.0.
  // To make effective visual size uniform at clash:
  //   effective = container.scale × sprite.scale = (1/posScale) × (baseScale × posScale) = baseScale (uniform)
  // chore #210: container.scale = CLASH_SCALE/posScale compensates sprite child's baseScale × posScale.
  // Replaces chore #194 which was no-op (operated on container scale that was always 1.0).
  const posScale = opts.posScale ?? 1.0;
  const CLASH_SCALE = 1.0 / posScale;

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
    // chore #210: scale lerps from origAbsScale (origin slot) → CLASH_SCALE (centre) during leap
    const factor = 1.20 + ep * 0.10;
    const sBase = origAbsScale + (CLASH_SCALE - origAbsScale) * ep;
    const s = sBase * factor;
    avatar.scale.set(baseSign * s, s);
  });
  avatar.x = centerX;
  avatar.y = centerY;

  // Phase 3: Hold — scale pulse at clash centre (chore #210: CLASH_SCALE = 1/posScale, effective = 1.30×baseScale uniform)
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
    // chore #210: scale lerp from CLASH_SCALE (centre) → origAbsScale (origin slot)
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
  // chore #FX-BURST: comic burst at clash centre
  playComicBurst(stage, cx, cy, color);

  const slashGlow = applyGlow(slash, color, 4, 12);

  // chore #220: giant X-brand burst — 1.5× larger than slash, white core + cyan glow stroke
  const xBrand = new Graphics();
  const brandArm = 70;
  xBrand.x = cx; xBrand.y = cy;
  // White core: thick centre line
  xBrand.moveTo(-brandArm, -brandArm).lineTo(brandArm, brandArm).stroke({ width: 4, color: 0xffffff, alpha: 1 });
  xBrand.moveTo( brandArm, -brandArm).lineTo(-brandArm, brandArm).stroke({ width: 4, color: 0xffffff, alpha: 1 });
  xBrand.alpha = 0;
  xBrand.scale.set(0.5);
  stage.addChild(xBrand);
  const xBrandGlow = applyGlow(xBrand, color, 5, 18);

  // Pulse-in: 0.5x→1.2x scale + alpha 0→1 in 180ms
  void tween(180, p => {
    xBrand.alpha = p;
    xBrand.scale.set(0.5 + 0.7 * p);
  }, Easings.easeOut).then(async () => {
    // chore #220 polish: rotate while shrinking + fading (owner trial 2026-05-06).
    // Phase B (settle 80ms): scale 1.2→1.0, rotation 0 → π/4 (45°)
    // Phase C (fade 190ms): alpha 1→0, rotation π/4 → π/2 (90° total)
    await tween(80, p => {
      xBrand.scale.set(1.2 - 0.2 * p);
      xBrand.rotation = p * Math.PI / 4;
    }, Easings.easeOut);
    await tween(190, p => {
      xBrand.alpha    = 1 - p;
      xBrand.rotation = Math.PI / 4 + p * Math.PI / 4;
    }, Easings.easeIn);
    removeFilter(xBrand, xBrandGlow);
    xBrand.destroy();
  });

  // 2. Shockwave ring from centre (concurrent)
  // chore #220: bigger shockwave for more presence (was radius=130)
  const swPromise = applyShockwave(stage, cx, cy, 180, duration);

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

  // 4. Screen flash
  // chore #220: cyan-tinted flash (was generic white) — matches 蒼嵐 personality.particleColor
  const flash = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0x6ab7ff, alpha: 0.40 });
  stage.addChild(flash);
  await tween(120, p => { flash.alpha = 0.40 * (1 - p); });
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

    // chore #221: speed lines — 4 short horizontal streaks behind dash start
    const speedLines = new Graphics();
    const dirX = endX > startX ? -1 : 1;       // streaks point away from target direction
    for (let s = 0; s < 4; s++) {
      const sy = startY - 24 + s * 12;          // vertical spread
      const sx = startX + dirX * 8;
      speedLines.moveTo(sx, sy)
                .lineTo(sx + dirX * 32, sy)
                .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
    }
    stage.addChild(speedLines);
    void tween(200, p => { speedLines.alpha = 1 - p; })
         .then(() => speedLines.destroy());

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

    // chore #221: deeper claw gash — triple-stroke (dark base + colored mid + white core)
    // length 56→80 / width 3.5→4 (mid) / 6 (base) / 1.5 (core)
    const claw = new Graphics();
    for (let i = 0; i < 3; i++) {
      const angle = (-0.4 + i * 0.4) + Math.PI / 2;
      const x1 = tp.x - Math.cos(angle) * 12;
      const y1 = tp.y - Math.sin(angle) * 40;
      const x2 = tp.x + Math.cos(angle) * 12;
      const y2 = tp.y + Math.sin(angle) * 40;
      // Dark base stroke (depth)
      claw.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 6, color: 0x000000, alpha: 0.7 });
      // Main coloured stroke
      claw.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 4, color, alpha: 0.95 });
      // White core highlight
      claw.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 1.5, color: 0xffffff, alpha: 1 });
    }
    stage.addChild(claw);
    await tween(140, p => { claw.alpha = 1 - p; });    // 110→140ms 多看一下
    claw.destroy();

    // chore #FX-BURST: comic burst at impact
    playComicBurst(stage, tp.x, tp.y, color, 0.85);   // slightly smaller — 3 hits per attack

    // chore #221: dust burst at impact — 6 radial particles + gravity
    const dustParts: { g: Graphics; vx: number; vy: number }[] = [];
    for (let d = 0; d < 6; d++) {
      const angle = (d / 6) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.8 + Math.random() * 1.4;
      const dust = new Graphics()
        .circle(0, 0, 3 + Math.random() * 2)
        .fill({ color: 0xc8804a, alpha: 0.85 });
      dust.x = tp.x;
      dust.y = tp.y;
      stage.addChild(dust);
      dustParts.push({
        g: dust,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,        // slight upward bias
      });
    }
    void tween(240, p => {
      for (const dp of dustParts) {
        dp.g.x += dp.vx;
        dp.g.y += dp.vy;
        dp.vy += 0.18;                            // gravity
        dp.g.scale.set(1 + p * 0.3);
        dp.g.alpha = 0.85 * (1 - p);
      }
    }).then(() => {
      for (const dp of dustParts) dp.g.destroy();
    });
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

  // chore #222: 鳳凰展翼大幻影 — phoenix wings spread climax at target row centre
  // Programmatic Graphics — body + 2 fan-shape wings + tail flame, ~250px wingspan.
  // Fire-and-forget; overlaps with fireball launch + outlasts impact burst.
  {
    const phoenixCx = (targets[0].x + targets[targets.length - 1].x) / 2;
    const phoenixCy = targets[0].y - 50;
    const PHX_BODY  = 0xff8a6a;
    const PHX_EDGE  = 0xffd37a;

    const phoenix = new Graphics();

    // chore #222 polish: spread-winged bird (top-down view).
    // Layered draw order: wings (back) → body (mid) → tail-feathers (front overlap)

    // Layer 1: LEFT WING — swept outward (leading edge top, trailing edge feather-notched)
    const leftWing = [
      -8,  -10,    // shoulder top (attach to body)
      -55, -28,    // leading edge — sweep forward + up
      -120, -18,   // wing tip (outer)
      -110, 0,     // outer corner (kink down)
      -90, 5,      // feather 1 outer
      -82, -2,     //   notch
      -68, 8,      // feather 2
      -60, 0,      //   notch
      -42, 12,     // feather 3 (trailing edge)
      -30, 6,      //   notch
      -16, 14,     // wing root bottom
      -8,  16,     // shoulder bottom (attach back to body)
    ];
    phoenix.poly(leftWing).fill({ color: PHX_BODY, alpha: 0.75 });
    phoenix.poly(leftWing).stroke({ width: 2, color: PHX_EDGE, alpha: 0.9 });

    // Layer 2: RIGHT WING — mirror of left (flip x)
    const rightWing = leftWing.map((v, i) => i % 2 === 0 ? -v : v);
    phoenix.poly(rightWing).fill({ color: PHX_BODY, alpha: 0.75 });
    phoenix.poly(rightWing).stroke({ width: 2, color: PHX_EDGE, alpha: 0.9 });

    // Layer 3: BODY — vertical pointed oval (head up, tail down)
    const body = [
       0,  -34,    // beak / head tip
       8,  -22,    // head right
       10, -8,     // neck right
       9,   8,     // shoulder right
       12,  20,    // body right
       8,   30,    // tail base right
       0,   38,    // tail centre lower
      -8,   30,    // tail base left
      -12,  20,
      -9,   8,
      -10, -8,
      -8,  -22,
    ];
    phoenix.poly(body).fill({ color: PHX_BODY, alpha: 0.95 });
    phoenix.poly(body).stroke({ width: 2, color: PHX_EDGE, alpha: 1 });

    // Layer 4: TAIL FEATHERS — 5-fan splay below body (overlay)
    const tail = [
       0,   28,    // attach to body bottom
      -18,  56,    // far-left feather
      -10,  46,    // feather 1 mid
      -4,   62,    // feather 2 mid-down
       0,   50,    // centre feather tip
       4,   62,    // feather 3 mid-down
      10,   46,    // feather 4 mid
      18,   56,    // far-right feather
       0,   28,    // close back to attach
    ];
    phoenix.poly(tail).fill({ color: PHX_BODY, alpha: 0.7 });
    phoenix.poly(tail).stroke({ width: 1.5, color: PHX_EDGE, alpha: 0.85 });

    // Layer 5: HEAD HIGHLIGHT — small white circle for "eye/beak" depth
    phoenix.circle(0, -22, 3).fill({ color: 0xffffff, alpha: 0.6 });

    phoenix.x = phoenixCx;
    phoenix.y = phoenixCy;
    phoenix.alpha = 0;
    phoenix.scale.set(0.3);
    stage.addChild(phoenix);

    const phoenixGlow = applyGlow(phoenix, PHX_EDGE, 5, 22);

    // Pulse-in 240ms: scale 0.3→1.4, alpha 0→1
    void tween(240, p => {
      phoenix.alpha = p;
      phoenix.scale.set(0.3 + 1.1 * p);
    }, Easings.easeOut).then(async () => {
      // Settle 100ms: scale 1.4→1.0
      await tween(100, p => { phoenix.scale.set(1.4 - 0.4 * p); }, Easings.easeOut);
      // Hold + fade 280ms: alpha 1→0
      await tween(280, p => { phoenix.alpha = 1 - p; }, Easings.easeIn);
      removeFilter(phoenix, phoenixGlow);
      phoenix.destroy();
    });
  }

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

    // chore #222: removed generic comic burst — replaced by phoenix-themed climax (see top of fn)

    // Impact burst (existing — small fireball impact effect)
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

  // chore #223: 翠綠巨蟒大張口咬下 — vertical S-curve body + open jaws + fangs descending onto target.
  // Programmatic Graphics ~240px tall, fire-and-forget overlapping serpent + impact pulses.
  {
    const PYT_BODY = 0x4adb8e;
    const PYT_LITE = 0x8ff5c0;
    const PYT_DARK = 0x1a4030;

    const python = new Graphics();

    // Layer 1: BODY — S-curve coiled tail descending from above (bezier stroke)
    // Path origin = python centre = tp; body extends upward to y=-240
    python.moveTo(0, -240);
    python.bezierCurveTo(60, -200, -60, -120, 0, -10);
    python.stroke({ width: 32, color: PYT_BODY, alpha: 0.85 });
    // Inner brighter core
    python.moveTo(0, -240);
    python.bezierCurveTo(60, -200, -60, -120, 0, -10);
    python.stroke({ width: 18, color: PYT_LITE, alpha: 0.7 });

    // Layer 2: HEAD — ellipse at (0, -8), 32×24
    python.ellipse(0, -8, 32, 24).fill({ color: PYT_BODY, alpha: 0.95 });
    python.ellipse(0, -8, 32, 24).stroke({ width: 2.5, color: PYT_DARK, alpha: 1 });

    // Layer 3: UPPER JAW — wide-open V-shape extending down from head
    // Points: left mouth corner → right mouth corner → mouth back centre
    python.poly([
      -28,  5,     // left mouth corner
       28,  5,     // right mouth corner
       18, 28,     // right inner mouth
        0, 35,     // mouth back tip (deepest point)
      -18, 28,     // left inner mouth
    ]).fill({ color: PYT_DARK, alpha: 0.95 });
    python.poly([
      -28,  5,
       28,  5,
       18, 28,
        0, 35,
      -18, 28,
    ]).stroke({ width: 2, color: PYT_BODY, alpha: 1 });

    // Layer 4: TWO FANGS — white triangles pointing down from upper jaw
    python.poly([-14, 5, -10, 22, -6, 5]).fill({ color: 0xffffff, alpha: 0.95 });
    python.poly([-14, 5, -10, 22, -6, 5]).stroke({ width: 1, color: PYT_DARK, alpha: 0.7 });
    python.poly([ 14, 5,  10, 22,  6, 5]).fill({ color: 0xffffff, alpha: 0.95 });
    python.poly([ 14, 5,  10, 22,  6, 5]).stroke({ width: 1, color: PYT_DARK, alpha: 0.7 });

    // Layer 5: EYE — gold iris + black pupil (offset on head)
    python.circle(-13, -10, 5).fill({ color: 0xffd700, alpha: 0.95 });
    python.circle(-13, -10, 2.5).fill({ color: 0x000000, alpha: 1 });
    // Highlight on eye
    python.circle(-12, -11, 1).fill({ color: 0xffffff, alpha: 0.9 });

    python.x = tp.x;
    python.y = tp.y;
    python.alpha = 0;
    python.scale.set(0.3);
    stage.addChild(python);

    const pythonGlow = applyGlow(python, PYT_LITE, 5, 22);

    // Pulse-in 260ms: scale 0.3→1.4, alpha 0→1
    void tween(260, p => {
      python.alpha = p;
      python.scale.set(0.3 + 1.1 * p);
    }, Easings.easeOut).then(async () => {
      // Settle 100ms: scale 1.4→1.0
      await tween(100, p => { python.scale.set(1.4 - 0.4 * p); }, Easings.easeOut);
      // Hold + fade 300ms: alpha 1→0
      await tween(300, p => { python.alpha = 1 - p; }, Easings.easeIn);
      removeFilter(python, pythonGlow);
      python.destroy();
    });
  }

  // chore #223: removed generic comic burst — replaced by giant python jaws climax (see below)

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

  // chore #224: 龍頭虛影 + 巨大十字劍光 — twin climax effects fire-and-forget at sword impact moment
  {
    const DRG_BODY = AZURE;       // 0x4a90e2
    const DRG_LITE = AZURE_LITE;  // 0xa0d8ff
    const DRG_DARK = 0x1a3a6a;

    // ── Layer A: Dragon head silhouette (side profile, ~250px wide × 180px tall) ──
    const dragon = new Graphics();
    // Outline (side view facing right — snout tip on right, mane on left)
    dragon.poly([
      // Lower jaw + throat
       128,  -8,    // snout tip
       118,  10,    // upper lip front
       100,  18,    // jaw bend
        72,  28,    // jaw mid
        40,  38,    // jaw back
        10,  48,    // throat front
       -30,  55,    // throat back
       -70,  40,    // neck under
      -110,  50,    // body trail
      -135,  20,    // mane lower spike start
      // Mane trailing (jagged spikes pointing back-left)
      -145, -10,
      -155, -38,    // spike 1
      -120, -22,
      -130, -55,    // spike 2
       -95, -38,
      -100, -75,    // spike 3
       -65, -48,
       -55, -85,    // spike 4
       -25, -58,
        -5, -78,    // front horn
        20, -58,    // forehead
        45, -68,    // brow horn
        72, -42,
        95, -35,    // upper jaw front ridge
       115, -25,
       128, -8,     // close back to snout
    ]).fill({ color: DRG_BODY, alpha: 0.75 });
    dragon.poly([
       128,  -8, 118, 10, 100, 18, 72, 28, 40, 38, 10, 48, -30, 55, -70, 40,
      -110,  50, -135, 20, -145, -10, -155, -38, -120, -22, -130, -55, -95, -38,
      -100, -75, -65, -48, -55, -85, -25, -58, -5, -78, 20, -58, 45, -68,
        72, -42, 95, -35, 115, -25, 128, -8,
    ]).stroke({ width: 2, color: DRG_DARK, alpha: 1 });

    // Mouth interior (dark V opening)
    dragon.poly([72, 5, 122, 0, 110, 22, 80, 25])
          .fill({ color: DRG_DARK, alpha: 0.9 });

    // 2 sharp fangs (upper jaw)
    dragon.poly([88, 5, 92, 18, 96, 5]).fill({ color: 0xffffff, alpha: 0.95 });
    dragon.poly([108, 5, 112, 16, 116, 5]).fill({ color: 0xffffff, alpha: 0.95 });

    // Eye (gold iris + black pupil + white highlight)
    dragon.circle(45, -42, 6).fill({ color: 0xffd700, alpha: 1 });
    dragon.circle(45, -42, 3).fill({ color: 0x000000, alpha: 1 });
    dragon.circle(46, -43, 1.5).fill({ color: 0xffffff, alpha: 0.95 });

    // Whiskers (2 thin curves trailing from snout)
    dragon.moveTo(120, 5).bezierCurveTo(140, 25, 130, 50, 100, 60).stroke({ width: 2, color: DRG_LITE, alpha: 0.85 });
    dragon.moveTo(118, 12).bezierCurveTo(135, 35, 115, 65, 80, 70).stroke({ width: 2, color: DRG_LITE, alpha: 0.85 });

    dragon.x = cx;
    dragon.y = cy - 70;
    dragon.alpha = 0;
    dragon.scale.set(0.4);
    stage.addChild(dragon);
    const dragonGlow = applyGlow(dragon, DRG_LITE, 4, 22);

    // Pulse-in 220ms + settle 100ms + fade 320ms (~640ms total)
    void tween(220, p => {
      dragon.alpha = p * 0.9;
      dragon.scale.set(0.4 + p);    // 0.4 → 1.4
    }, Easings.easeOut).then(async () => {
      await tween(100, p => { dragon.scale.set(1.4 - 0.4 * p); }, Easings.easeOut);
      await tween(320, p => { dragon.alpha = 0.9 * (1 - p); }, Easings.easeIn);
      removeFilter(dragon, dragonGlow);
      dragon.destroy();
    });

    // ── Layer B: Giant cross sword light at midpoint(tp0, tp1) ──
    const swordCx = (tp0.x + tp1.x) / 2;
    const swordCy = (tp0.y + tp1.y) / 2;

    const swordLight = new Graphics();
    const ARM = 100;   // half-length each (full length 200px)

    // X-cross outer azure (thick)
    swordLight.moveTo(-ARM, -ARM).lineTo(ARM, ARM).stroke({ width: 18, color: DRG_BODY, alpha: 0.85 });
    swordLight.moveTo(ARM, -ARM).lineTo(-ARM, ARM).stroke({ width: 18, color: DRG_BODY, alpha: 0.85 });

    // X-cross white core (thin)
    swordLight.moveTo(-ARM, -ARM).lineTo(ARM, ARM).stroke({ width: 6, color: 0xffffff, alpha: 1 });
    swordLight.moveTo(ARM, -ARM).lineTo(-ARM, ARM).stroke({ width: 6, color: 0xffffff, alpha: 1 });

    swordLight.x = swordCx;
    swordLight.y = swordCy;
    swordLight.alpha = 0;
    swordLight.scale.set(0.5);
    swordLight.rotation = Math.PI / 8;   // slight tilt for dynamic feel
    stage.addChild(swordLight);
    const swordGlow = applyGlow(swordLight, DRG_LITE, 5, 18);

    // Faster pulse-in for sword light (cross flashes brighter than dragon)
    void tween(140, p => {
      swordLight.alpha = p;
      swordLight.scale.set(0.5 + 0.8 * p);   // 0.5 → 1.3
    }, Easings.easeOut).then(async () => {
      await tween(80, p => {
        swordLight.scale.set(1.3 - 0.2 * p);   // 1.3 → 1.1
        swordLight.rotation += 0.01;
      }, Easings.easeOut);
      await tween(220, p => { swordLight.alpha = 1 - p; }, Easings.easeIn);
      removeFilter(swordLight, swordGlow);
      swordLight.destroy();
    });
  }

  // (d) 400–520ms: impact flash + glow rings
  // chore #224: removed generic comic burst — replaced by dragon head + cross sword light (added above)

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
  playComicBurst(stage, tp0.x, tp0.y, TIGER, 0.85);   // chore #FX-BURST
  // (c) 300–480ms: 2nd heavy punch → target 1
  await doPunch(tp1, 180);
  playComicBurst(stage, tp1.x, tp1.y, TIGER, 0.85);   // chore #FX-BURST
  // (d) 480–560ms: 3rd decisive blow (faster)
  await doPunch(tp0, 80);
  playComicBurst(stage, tp0.x, tp0.y, TIGER, 0.85);   // chore #FX-BURST

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
  playComicBurst(stage, tp0.x, tp0.y, color, 1.2);    // chore #FX-BURST: 1.2x scale — 重武器更大爆
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
  playComicBurst(stage, tp0.x, tp0.y, color);          // chore #FX-BURST

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
