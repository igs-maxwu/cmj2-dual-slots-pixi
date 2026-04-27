import { Application } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { ScreenManager } from '@/screens/ScreenManager';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { DraftScreen, type DraftResult } from '@/screens/DraftScreen';
import { BattleScreen } from '@/screens/BattleScreen';
import { ResultScreen, type MatchResult } from '@/screens/ResultScreen';
import { FXPreviewScreen } from '@/screens/FXPreviewScreen';
import { initTweenTicker } from '@/systems/tween';
import { installFxDevHook } from '@/systems/FXDevHook';
import { FXAtlas } from '@/fx/FXAtlas';

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

  // Preload SOS2 FX atlas sheets before any screen renders.
  // BASE_URL handles GitHub Pages sub-path (/cmj2-dual-slots-pixi/).
  await FXAtlas.load([
    { name: 'sos2-bigwin',       atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-bigwin.atlas` },
    { name: 'sos2-near-win',     atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-near-win.atlas` },
    { name: 'sos2-declare-fire', atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-declare-fire.atlas` },
  ]);

  const sm = new ScreenManager(app);

  // res-01: callback chain — BattleScreen emits MatchResult; main.ts routes to ResultScreen
  const goToDraft = (): void => {
    sm.show(new DraftScreen((cfg: DraftResult) => {
      sm.show(new BattleScreen(cfg, (result?: MatchResult) => {
        if (result) {
          sm.show(new ResultScreen(result, goToDraft));
        } else {
          goToDraft();   // user pressed BACK TO DRAFT mid-match
        }
      }));
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
