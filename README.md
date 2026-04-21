# cmj2-dual-slots-pixi

PixiJS rewrite of `cmj2-dual-slots`. Lightweight rendering, no Phaser scene lifecycle — flow is plain screen-swap (`DraftScreen` → `BattleScreen` → back).

## Stack

- PixiJS 8 for rendering
- TypeScript + Vite for build
- Pure TypeScript algorithm modules ported untouched from the Phaser version: `SymbolPool`, `PaylinesGenerator`, `ScaleCalculator`, `Formation`, `DamageDistributor`, `SlotEngine`.

## Scripts

```
npm install
npm run dev      # local dev server
npm run build    # tsc + vite build → dist/
npm run preview  # serve built dist/
```

## Deploy

`master` pushes auto-deploy to GitHub Pages via `.github/workflows/deploy-pages.yml`. Base path is `/cmj2-dual-slots-pixi/` (set in `vite.config.ts`).
