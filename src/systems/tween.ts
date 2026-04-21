/**
 * Promise-based tween helpers — RAF-driven, no library.
 * Animations `await` cleanly; composition via Promise.all / sequence.
 */

export type Easing = (t: number) => number;

export const Easings = {
  linear:    (t: number): number => t,
  easeIn:    (t: number): number => t * t,
  easeOut:   (t: number): number => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  /** Overshoots past 1 then settles — classic "landing" feel */
  backOut: (t: number): number => {
    const s = 1.70158;
    const u = t - 1;
    return 1 + u * u * ((s + 1) * u + s);
  },
  /** Symmetric triangular pulse 0 → 1 → 0 */
  pulse: (t: number): number => 1 - Math.abs(t - 0.5) * 2,
};

export function tween(
  durationMs: number,
  update: (progress: number) => void,
  ease: Easing = Easings.linear,
): Promise<void> {
  return new Promise(resolve => {
    const start = performance.now();
    const step = (now: number): void => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / durationMs);
      update(ease(p));
      if (p >= 1) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function tweenValue(
  from: number, to: number,
  durationMs: number,
  update: (value: number) => void,
  ease: Easing = Easings.linear,
): Promise<void> {
  return tween(durationMs, p => update(from + (to - from) * p), ease);
}

export function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
