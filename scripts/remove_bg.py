"""
Remove flat light-gray backgrounds from Gemini-generated UI PNGs.

Heuristic: pixels that are bright (L>0.6) AND nearly neutral (S<0.15) are
treated as background and made transparent, with a soft ramp for anti-
aliased edges (L in [0.55, 0.65]). Colored pixels (gold, red, blue, etc.)
and dark pixels stay opaque.
"""
import os
import sys
from pathlib import Path
from PIL import Image

UI_DIR = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'ui'

# Per-file tuning if needed. Defaults work for most; bump L_FULL up for
# images that have legitimate bright centers (win-burst).
TUNING = {
    'win-burst.png':   {'L_FULL': 0.95, 'L_FADE': 0.90, 'S_MAX': 0.10},
    'logo-mark.png':   {'L_FULL': 0.70, 'L_FADE': 0.62, 'S_MAX': 0.15},
    '_default':        {'L_FULL': 0.65, 'L_FADE': 0.55, 'S_MAX': 0.18},
}

def process(path: Path) -> None:
    cfg = TUNING.get(path.name, TUNING['_default'])
    L_FULL = cfg['L_FULL']
    L_FADE = cfg['L_FADE']
    S_MAX  = cfg['S_MAX']

    img = Image.open(path).convert('RGBA')
    w, h = img.size
    pix = img.load()
    cleared = 0
    faded   = 0
    total   = w * h
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            mx = max(r, g, b); mn = min(r, g, b)
            L = (mx + mn) / 510.0           # 0..1
            S = (mx - mn) / 255.0 if mx > 0 else 0.0

            if S <= S_MAX:
                if L >= L_FULL:
                    pix[x, y] = (r, g, b, 0)
                    cleared += 1
                elif L >= L_FADE:
                    ratio = (L - L_FADE) / (L_FULL - L_FADE)
                    new_a = int(a * (1.0 - ratio))
                    pix[x, y] = (r, g, b, new_a)
                    faded += 1

    img.save(path, optimize=True)
    print(f'{path.name:22s}  size {w}x{h}  cleared {cleared:>7d}  faded {faded:>6d}  ({100*(cleared+faded)/total:.1f}%)')


def main() -> int:
    if not UI_DIR.exists():
        print(f'UI dir not found: {UI_DIR}', file=sys.stderr)
        return 1
    pngs = sorted(UI_DIR.glob('*.png'))
    if not pngs:
        print(f'No PNGs in {UI_DIR}', file=sys.stderr)
        return 1
    print(f'Processing {len(pngs)} files in {UI_DIR}\n')
    for p in pngs:
        process(p)
    return 0


if __name__ == '__main__':
    sys.exit(main())
