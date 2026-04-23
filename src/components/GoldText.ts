import { FillGradient, Text } from 'pixi.js';
import * as T from '@/config/DesignTokens';

export interface GoldTextOptions {
  fontSize?: number;
  fontWeight?: string;
  withShadow?: boolean;
}

export function goldText(initial: string, opts: GoldTextOptions = {}): Text {
  const {
    fontSize   = 42,
    fontWeight = '900',
    withShadow = true,
  } = opts;

  const grad = new FillGradient({
    type:         'linear',
    x0: 0, y0: 0,
    x1: 0, y1: 1,
    textureSpace: 'local',
    colorStops: [
      { offset: 0.00, color: '#fff2b8' },
      { offset: 0.50, color: T.GOLD.base  },
      { offset: 1.00, color: T.GOLD.shadow },
    ],
  });

  return new Text({
    text: initial,
    style: {
      fontFamily:  T.FONT.num,
      fontWeight,
      fontSize,
      fill:        grad,
      stroke:      { color: '#3a2510', width: 3, join: 'round' },
      ...(withShadow && {
        dropShadow: { color: '#000000', blur: 2, distance: 2, alpha: 0.5 },
      }),
    },
  });
}
