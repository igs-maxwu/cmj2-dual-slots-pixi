// Sprint 3D-00: SOS2 asset import chore.
// Run: node scripts/import-sos2-assets.mjs
// Compresses SOS2 raw PNGs → WebP into public/assets/{symbols/gems, fx}
// Copies companion .atlas files verbatim (Spine format, used by FXAtlas loader).

import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'download_picture/slot-sos2-client-main/game');
const OUT_SYMBOLS = path.join(ROOT, 'public/assets/symbols/gems');
const OUT_FX = path.join(ROOT, 'public/assets/fx');

// [src relative path, out filename, webp quality]
const STANDALONE_SYMBOLS = [
  ['Img/Symbol/Symbol_00.png', 'gem-triangle.webp', 85],
  ['Img/Symbol/Symbol_01.png', 'gem-diamond.webp',  85],
  ['Img/Symbol/Symbol_02.png', 'gem-pentagon.webp', 85],
  ['Img/Symbol/Symbol_03.png', 'gem-square.webp',   85],
  ['Img/Symbol/Symbol_04.png', 'gem-hexagon.webp',  85],
];

const STANDALONE_FX = [
  ['Img/Win/OLD/Jpg/FX_Coins_1.png',         'sos2-coins.webp',          82],
  ['Img/Win/OLD/Jpg/FX_Particles_1.png',     'sos2-particles.webp',      82],
  ['Img/Win/OLD/Jpg/FX_RainbowHalo_1.png',   'sos2-rainbow-halo.webp',   82],
  ['Img/Win/OLD/Jpg/Win_FX_RadialLights.png','sos2-radial-lights.webp',  82],
  ['Img/Win/OLD/Jpg/Win_FX_Wave.png',        'sos2-fire-wave.webp',      82],
];

// atlas sheets: [src png, src atlas, out basename, webp q]
const ATLAS_SHEETS = [
  ['Spine/BigWin/BigWin.png',                'Spine/BigWin/BigWin.atlas',
   'sos2-bigwin',            88],
  ['Spine/NearWin/FX_NearWin.png',           'Spine/NearWin/FX_NearWin.atlas',
   'sos2-near-win',          88],
  ['Spine/Declare/FG_Declare_Fire.png',      'Spine/Declare/FG_Declare_Fire.atlas',
   'sos2-declare-fire',      88],
];

// scene atlases without .atlas files — just compress the PNG
const SCENE_ONLY = [
  ['Spine/Scene/FX_Fly_Multiplier.png', 'sos2-fly-multiplier.webp', 82],
  ['Spine/Scene/FX_Fly_Spawn.png',      'sos2-fly-spawn.webp',      82],
  ['Spine/Scene/FX_WinFrame.png',       'sos2-win-frame.webp',      82],
];

async function ensureDir(d) { await fs.mkdir(d, { recursive: true }); }

async function compressPng(srcRel, outDir, outName, q) {
  const srcAbs = path.join(SRC, srcRel);
  const outAbs = path.join(outDir, outName);
  const stat = await fs.stat(srcAbs);
  await sharp(srcAbs).webp({ quality: q, effort: 6 }).toFile(outAbs);
  const outStat = await fs.stat(outAbs);
  const pct = Math.round((outStat.size / stat.size) * 100);
  console.log(`  ${srcRel} (${(stat.size/1024).toFixed(0)} KB)`
    + ` -> ${path.relative(ROOT, outAbs)} (${(outStat.size/1024).toFixed(0)} KB, ${pct}%)`);
}

async function copyAtlasWithRewrite(srcAtlas, outAtlasAbs, newPngName) {
  // Spine .atlas first non-empty line = filename reference. Rewrite to new WebP name.
  const raw = await fs.readFile(path.join(SRC, srcAtlas), 'utf8');
  const lines = raw.split(/\r?\n/);
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.endsWith('.png') || t.endsWith('.webp') || t.endsWith('.jpg')) {
      lines[i] = newPngName;
      replaced = true;
      break;
    }
  }
  if (!replaced) console.warn(`  !! could not find filename header in ${srcAtlas}`);
  await fs.writeFile(outAtlasAbs, lines.join('\n'), 'utf8');
  console.log(`  ${srcAtlas} -> ${path.relative(ROOT, outAtlasAbs)} (header rewritten)`);
}

async function main() {
  await ensureDir(OUT_SYMBOLS);
  await ensureDir(OUT_FX);

  console.log('\n== Symbols (gems) ==');
  for (const [srcRel, out, q] of STANDALONE_SYMBOLS) {
    await compressPng(srcRel, OUT_SYMBOLS, out, q);
  }

  console.log('\n== Standalone FX ==');
  for (const [srcRel, out, q] of STANDALONE_FX) {
    await compressPng(srcRel, OUT_FX, out, q);
  }

  console.log('\n== Scene FX (atlas-less sheets) ==');
  for (const [srcRel, out, q] of SCENE_ONLY) {
    await compressPng(srcRel, OUT_FX, out, q);
  }

  console.log('\n== Atlas sheets (PNG + .atlas companion) ==');
  for (const [pngRel, atlasRel, base, q] of ATLAS_SHEETS) {
    const pngOut = `${base}.webp`;
    const atlasOut = path.join(OUT_FX, `${base}.atlas`);
    await compressPng(pngRel, OUT_FX, pngOut, q);
    await copyAtlasWithRewrite(atlasRel, atlasOut, pngOut);
  }

  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
