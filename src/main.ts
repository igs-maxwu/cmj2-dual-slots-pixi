import { Application } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { ScreenManager } from '@/screens/ScreenManager';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { DraftScreen, type DraftResult } from '@/screens/DraftScreen';
import { BattleScreen } from '@/screens/BattleScreen';
import { FXPreviewScreen } from '@/screens/FXPreviewScreen';
import { initTweenTicker } from '@/systems/tween';
import { installFxDevHook } from '@/systems/FXDevHook';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width:       CANVAS_WIDTH,
    height:      CANVAS_HEIGHT,
    background:  0x0a0e1a,
    antialias:   true,
    autoDensity: true,
    resolution:  window.devicePixelRatio || 1,
    // Portrait 720×1280 — CSS keeps aspect ratio and centers in viewport
  });

  // Wire tween time-axis to Pixi ticker (prevents split RAF + Ticker time-axes)
  initTweenTicker(app.ticker);

  // Dev console hook: window.__DEV_FX.play('lightning-xcross') (self-gates on DEV)
  installFxDevHook(app);

  document.getElementById('app')!.appendChild(app.canvas);

  // FX atlas sheets (~600 KB) deferred — loaded in BattleScreen.onMount
  // behind the '進入戰場中' overlay. DraftScreen does not use FX atlases.

  const sm = new ScreenManager(app);

  const goToDraft = (): void => {
    sm.show(new DraftScreen((cfg: DraftResult) => {
      sm.show(new BattleScreen(cfg, goToDraft));
    }));
  };

  // Dev-only: ?fx=<signature-name> jumps straight to FX preview loop
  const fxParam = new URLSearchParams(location.search).get('fx');
  if (fxParam && import.meta.env.DEV) {
    sm.show(new FXPreviewScreen(fxParam, goToDraft));
    return;
  }

  sm.show(new LoadingScreen(goToDraft));
}

main();
