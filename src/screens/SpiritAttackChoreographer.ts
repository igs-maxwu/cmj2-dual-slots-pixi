/**
 * Spirit Attack Choreographer
 *
 * Promise-based reusable attack animation.  Call `attackTimeline()` after
 * each spin's wayHits to play a spirit leaping from its formation slot to
 * the centre of the screen, charging, firing projectiles at the enemy
 * formation, then returning home.
 *
 * The animation creates a temporary ghost SpiritPortrait that lives on the
 * top-level stage container for the duration of the tween, then destroys
 * itself — the original formation portrait is untouched.
 *
 * Template spirit: Meng (孟辰璋, id=3, spiritKey='mengchenzhang', cyan).
 */
import { Container, Graphics } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { tween, delay, Easings } from '@/systems/tween';
import { SpiritPortrait } from '@/components/SpiritPortrait';

// ─── Signature types ────────────────────────────────────────────────────────

/**
 * Identifies which Phase-4 (Fire) choreography to dispatch.
 * PR #1: field is stored only.
 * PR #2: attackTimeline dispatches on this value.
 */
export type SpiritSignature =
  | 'lightning-xcross'   // 蒼嵐 — X-slash + cyan lightning + shockwave
  | 'triple-dash'        // 珞洛 — 3× melee dash + afterimages + tiger claw
  | 'dual-fireball'      // 朱鸞 — twin fireball charge + particle burst
  | 'python-summon'      // 昭宇 — summoning circle + serpent
  | 'generic';           // all male spirits (孟辰璋, 寅, 凌羽, 玄墨)

// ─── Per-spirit personality config ─────────────────────────────────────────

export interface SpiritPersonality {
  /** Colour of the projectile / impact glow */
  particleColor:   number;
  /** Peak height of the parabolic leap arc (px, positive = upward) */
  arcHeight:       number;
  /** Canvas-shake pixel radius on impact */
  shakeIntensity:  number;
  /** Which Phase-4 signature to dispatch */
  signature:       SpiritSignature;
  /** Timing in ms for each animation phase */
  duration: {
    prepare: number;   // scale-up pulse before jump
    leap:    number;   // fly to centre
    hold:    number;   // charge at centre
    fire:    number;   // projectile travel
    return:  number;   // fly back home
  };
}

/** Personalities keyed by spiritKey.  Add one per spirit as assets land. */
const PERSONALITIES: Record<string, SpiritPersonality> = {
  /** 孟辰璋 — cyan, generic (male spirit template) */
  mengchenzhang: {
    particleColor: 0x00FFFF,
    arcHeight:     130,
    shakeIntensity: 8,
    signature:     'generic',
    duration: { prepare: 130, leap: 300, hold: 180, fire: 270, return: 240 },
  },
  /** 朱鸞 — vermilion, dual fireball */
  zhuluan: {
    particleColor: 0xff8a6a,
    arcHeight:     110,
    shakeIntensity: 6,
    signature:     'dual-fireball',
    duration: { prepare: 130, leap: 320, hold: 160, fire: 290, return: 250 },
  },
  /** 蒼嵐 — azure, lightning X-cross */
  canlan: {
    particleColor: 0x6ab7ff,
    arcHeight:     100,
    shakeIntensity: 6,
    signature:     'lightning-xcross',
    duration: { prepare: 120, leap: 290, hold: 150, fire: 260, return: 230 },
  },
  /** 珞洛 — tiger orange, triple melee dash */
  luoluo: {
    particleColor: 0xffa500,
    arcHeight:      60,   // low arc — melee fighter
    shakeIntensity:  7,
    signature:     'triple-dash',
    duration: { prepare: 100, leap: 200, hold:  80, fire: 420, return: 200 },
  },
  /** 昭宇 — venom green, python summon */
  zhaoyu: {
    particleColor: 0x4adb8e,
    arcHeight:      80,
    shakeIntensity:  4,
    signature:     'python-summon',
    duration: { prepare: 160, leap: 320, hold: 240, fire: 340, return: 240 },
  },
};

const DEFAULT_PERSONALITY: SpiritPersonality = {
  particleColor: 0xFFD700,
  arcHeight:     90,
  shakeIntensity: 5,
  signature:     'generic',
  duration: { prepare: 120, leap: 290, hold: 160, fire: 260, return: 230 },
};

// ─── Public API ────────────────────────────────────────────────────────────

export interface AttackOptions {
  /** Root Pixi container; ghost avatar is added here for z-ordering */
  stage:   Container;
  /** Attacking spirit symbol id (for SpiritPortrait appearance) */
  symbolId: number;
  /** Asset key — used to look up SpiritPersonality */
  spiritKey: string;
  /** World-space origin (centre of the attacker's formation cell) */
  originX: number;
  originY: number;
  /** World-space targets (alive cells in the enemy formation) */
  targetPositions: { x: number; y: number }[];
  /** Override particle colour (e.g. team colour) — falls back to personality */
  particleColor?: number;
  /** Override shake intensity */
  shakeIntensity?: number;
}

/**
 * Play the full spirit attack choreography and resolve when complete.
 *
 * ```ts
 * await attackTimeline({ stage, symbolId, spiritKey, originX, originY, targetPositions });
 * ```
 */
export async function attackTimeline(opts: AttackOptions): Promise<void> {
  const personality = PERSONALITIES[opts.spiritKey] ?? DEFAULT_PERSONALITY;
  const particleColor  = opts.particleColor  ?? personality.particleColor;
  const shakeIntensity = opts.shakeIntensity ?? personality.shakeIntensity;
  const D = personality.duration;

  // Centre of the canvas (stage) — staging area for the attack pose
  const centerX = Math.round(CANVAS_WIDTH  / 2);
  const centerY = Math.round(CANVAS_HEIGHT * 0.42);  // slightly above mid

  const { stage, symbolId, originX, originY, targetPositions } = opts;

  // ── Ghost avatar ─────────────────────────────────────────────────────────
  const avatar = new SpiritPortrait(symbolId, 64);
  avatar.x = originX;
  avatar.y = originY;
  stage.addChild(avatar);

  // ── Phase 1: Prepare — scale-up pulse ────────────────────────────────────
  await tween(D.prepare, p => {
    avatar.scale.set(1 + Easings.easeOut(p) * 0.40);
  });

  // ── Phase 2: Leap to centre (parabolic arc) ───────────────────────────────
  await tween(D.leap, p => {
    const ep = Easings.easeInOut(p);
    avatar.x = originX + (centerX - originX) * ep;
    const arc = -personality.arcHeight * 4 * p * (1 - p);
    avatar.y = originY + (centerY - originY) * ep + arc;
    avatar.scale.set(1.40 + ep * 0.15);
  });
  avatar.x = centerX;
  avatar.y = centerY;

  // ── Phase 3: Charge hold — wobble pulse ───────────────────────────────────
  const holdEnd = performance.now() + D.hold;
  await tween(D.hold, p => {
    avatar.scale.set(1.55 + Math.sin(p * Math.PI * 5) * 0.06);
  });
  void holdEnd;
  avatar.scale.set(1.55);

  // ── Phase 4: Fire projectiles + screen shake (concurrent) ─────────────────
  const shots = targetPositions.map(tp =>
    _fireShot(stage, centerX, centerY, tp.x, tp.y, particleColor, D.fire),
  );
  const shake = _screenShake(stage, shakeIntensity);
  await Promise.all([...shots, shake]);

  // ── Phase 5: Return to formation ─────────────────────────────────────────
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

// ─── Internal helpers ───────────────────────────────────────────────────────

async function _fireShot(
  stage: Container,
  sx: number, sy: number,
  tx: number, ty: number,
  color: number,
  durationMs: number,
): Promise<void> {
  // Projectile: bright core + soft glow halo
  const halo = new Graphics().circle(0, 0, 14).fill({ color, alpha: 0.32 });
  const core = new Graphics().circle(0, 0, 6).fill({ color, alpha: 0.95 });
  const proj = new Container();
  proj.addChild(halo, core);
  proj.x = sx; proj.y = sy;
  stage.addChild(proj);

  await tween(durationMs, p => {
    const ep = Easings.easeIn(p);
    proj.x = sx + (tx - sx) * ep;
    proj.y = sy + (ty - sy) * ep;
    proj.scale.set(1.1 - ep * 0.45);
    proj.alpha  = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
  });

  // Impact burst at target
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
  const ox = stage.x;
  const oy = stage.y;
  await tween(300, p => {
    const decay = 1 - p;
    stage.x = ox + (Math.random() - 0.5) * intensity * 2 * decay;
    stage.y = oy + (Math.random() - 0.5) * intensity * 2 * decay;
  });
  stage.x = ox;
  stage.y = oy;
}
