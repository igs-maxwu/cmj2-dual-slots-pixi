import { Application } from 'pixi.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { ScreenManager } from '@/screens/ScreenManager';
import { LoadingScreen } from '@/screens/LoadingScreen';
import { DraftScreen, type DraftResult } from '@/screens/DraftScreen';
import { BattleScreen } from '@/screens/BattleScreen';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    width:       CANVAS_WIDTH,
    height:      CANVAS_HEIGHT,
    background:  0x0a0e1a,
    antialias:   true,
    autoDensity: true,
    resolution:  window.devicePixelRatio || 1,
  });

  document.getElementById('app')!.appendChild(app.canvas);

  const sm = new ScreenManager(app);

  const goToDraft = (): void => {
    sm.show(new DraftScreen((cfg: DraftResult) => {
      sm.show(new BattleScreen(cfg, goToDraft));
    }));
  };

  sm.show(new LoadingScreen(goToDraft));
}

main();
