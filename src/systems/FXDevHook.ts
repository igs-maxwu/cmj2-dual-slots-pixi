import type { Application } from 'pixi.js';
import { attackTimeline } from '@/screens/SpiritAttackChoreographer';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';

declare global {
  interface Window {
    __DEV_FX?: { play: (name: string) => void; list: () => string[] };
  }
}

const SIG_SPIRIT: Record<string, { spiritKey: string; symbolId: number }> = {
  'lightning-xcross':  { spiritKey: 'canlan',        symbolId: 4 },
  'triple-dash':       { spiritKey: 'luoluo',        symbolId: 5 },
  'dual-fireball':     { spiritKey: 'zhuluan',       symbolId: 1 },
  'python-summon':     { spiritKey: 'zhaoyu',        symbolId: 2 },
  'dragon-dual-slash': { spiritKey: 'mengchenzhang', symbolId: 3 },
  'tiger-fist-combo':        { spiritKey: 'yin',           symbolId: 0 },
  'tortoise-hammer-smash':   { spiritKey: 'xuanmo',        symbolId: 7 },
  'phoenix-flame-arrow':     { spiritKey: 'lingyu',        symbolId: 6 },
  'generic':                 { spiritKey: 'canlan',        symbolId: 4 },
};

export function installFxDevHook(app: Application): void {
  if (!import.meta.env.DEV) return;

  const play = (name: string): void => {
    const spirit = SIG_SPIRIT[name];
    if (!spirit) {
      console.warn(`[DEV_FX] Unknown signature: "${name}". Call __DEV_FX.list() to see options.`);
      return;
    }
    // chore: attackTimeline now animates a spiritContainer directly — use temp container for dev hook
    import('pixi.js').then(({ Container }) => {
      const devSpirit = new Container();
      devSpirit.x = Math.round(CANVAS_WIDTH  * 0.20);
      devSpirit.y = Math.round(CANVAS_HEIGHT * 0.50);
      app.stage.addChild(devSpirit);
      void attackTimeline({
        stage:           app.stage,
        spiritContainer: devSpirit,
        symbolId:        spirit.symbolId,
        spiritKey:       spirit.spiritKey,
        targetPositions: [
          { x: Math.round(CANVAS_WIDTH * 0.35), y: Math.round(CANVAS_HEIGHT * 0.72) },
          { x: Math.round(CANVAS_WIDTH * 0.50), y: Math.round(CANVAS_HEIGHT * 0.72) },
          { x: Math.round(CANVAS_WIDTH * 0.65), y: Math.round(CANVAS_HEIGHT * 0.72) },
        ],
      }).then(() => devSpirit.destroy());
    });
  };

  const list = (): string[] => Object.keys(SIG_SPIRIT);

  window.__DEV_FX = { play, list };
}
