import { Container, Graphics } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { FXAtlas } from '@/fx/FXAtlas';
import { goldText } from '@/components/GoldText';
import * as T from '@/config/DesignTokens';
import { tween, delay, Easings } from '@/systems/tween';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';

/**
 * s13-fx-01: Free Spin entry ceremony — fire-text declaration.
 *
 * 7-stage choreography (~2.5s total):
 *   1. Dim BG        0–300ms   navy overlay alpha 0→0.6
 *   2. Fire bg     300–500ms   sos2-declare-fire Fire_1 + Fire_6 fade-in
 *   3. Text scale  500–1000ms  "FREE SPIN" scale 0.4→1.05(overshoot)→1.0
 *   4. Sub text   1000–1200ms  "靈氣爆發 · 5 ROUNDS" fade-in
 *   5. Hold       1200–2000ms  800ms hold
 *   6. Fade out   2000–2300ms  root.alpha 1→0
 *   7. Cleanup    2300ms       root.destroy({children:true})
 *
 * Caller awaits this Promise; on resolve the ceremony Container is
 * destroyed + removed from parent. Caller then enters free-spin mode
 * (5 spins, ×2 multiplier) with the f-04 banner showing N/5.
 */
export async function playFreeSpinEntryCeremony(parent: Container): Promise<void> {
  const root = new Container();
  root.zIndex = 2400;   // above HUD (1100), below JP ceremony (2500)
  parent.addChild(root);

  // ── Layer 1: Dim BG ──
  const bg = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0x0D1421 });   // full alpha fill; bg.alpha drives visibility
  bg.alpha = 0;
  root.addChild(bg);

  // ── Layer 2: Fire backgrounds (left + right) ──
  // Fire_1 and Fire_6 both have rotate:true in the atlas; apply -π/2 correction.
  const fireL = FXAtlas.sprite('sos2-declare-fire:FX/Fire_1');
  fireL.rotation = -Math.PI / 2;
  fireL.anchor.set(0.5, 1);
  fireL.x = CANVAS_WIDTH * 0.25;
  fireL.y = CANVAS_HEIGHT * 0.85;
  fireL.alpha = 0;
  fireL.scale.set(1.5);
  root.addChild(fireL);

  const fireR = FXAtlas.sprite('sos2-declare-fire:FX/Fire_6');
  fireR.rotation = -Math.PI / 2;
  fireR.anchor.set(0.5, 1);
  fireR.x = CANVAS_WIDTH * 0.75;
  fireR.y = CANVAS_HEIGHT * 0.85;
  fireR.alpha = 0;
  fireR.scale.set(1.5);
  fireR.scale.x *= -1;   // mirror horizontal
  root.addChild(fireR);

  // ── Layer 3: Main text ──
  const mainText = goldText('FREE SPIN', { fontSize: 80, withShadow: true });
  mainText.anchor.set(0.5, 0.5);
  mainText.x = CANVAS_WIDTH / 2;
  mainText.y = CANVAS_HEIGHT / 2 - 30;
  mainText.alpha = 0;
  mainText.scale.set(0.4);
  mainText.style.fill = T.GOLD.glow;
  mainText.filters = [new GlowFilter({
    color: T.GOLD.glow, distance: 24, outerStrength: 3, innerStrength: 0.6,
  })];
  root.addChild(mainText);

  // ── Layer 4: Sub text ──
  const subText = goldText('靈氣爆發 · 5 ROUNDS', { fontSize: 22, withShadow: true });
  subText.anchor.set(0.5, 0.5);
  subText.x = CANVAS_WIDTH / 2;
  subText.y = CANVAS_HEIGHT / 2 + 50;
  subText.alpha = 0;
  subText.style.fill = T.GOLD.base;
  subText.style.letterSpacing = 6;
  subText.style.fontStyle = 'italic';
  root.addChild(subText);

  // ── Stage 1: Dim BG fade-in (0–300ms) ──
  await tween(300, t => { bg.alpha = 0.6 * t; }, Easings.easeOut);

  // ── Stage 2: Fire bg fade-in (300–500ms, 200ms duration — background) ──
  void tween(200, t => {
    fireL.alpha = 0.85 * t;
    fireR.alpha = 0.85 * t;
  }, Easings.easeOut);

  // ── Stage 3: Main text scale-up + alpha (500–1000ms, 500ms) ──
  await delay(200);   // let fire tween start before text
  await tween(500, t => {
    mainText.alpha = t;
    // Overshoot: 0.4 → 1.05 (peak) → 1.0
    const overshoot = 0.4 + 0.65 * t + 0.05 * Math.sin(Math.PI * t);
    mainText.scale.set(overshoot);
  }, Easings.easeOut);

  // ── Stage 4: Sub text fade-in (1000–1200ms, 200ms — background) ──
  void tween(200, t => { subText.alpha = t; }, Easings.easeOut);

  // ── Stage 5: Hold (200ms sub fade + 800ms hold = 1000ms delay) ──
  await delay(1000);

  // ── Stage 6: Fade out everything (2000–2300ms, 300ms) ──
  await tween(300, t => {
    root.alpha = 1 - t;
  }, Easings.easeIn);

  // ── Stage 7: Cleanup ──
  root.destroy({ children: true });
}
