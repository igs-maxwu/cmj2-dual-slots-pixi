#!/usr/bin/env node
/**
 * Batch convert public/assets/**\/*.png to .webp at quality 82.
 *
 * Usage:  node scripts/compress-assets.mjs
 *
 * - Skips files already present as .webp (unless --force)
 * - Deletes the original PNG after successful WebP write
 * - Prints per-file size saving + grand total
 */
import sharp from 'sharp';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT    = new URL('../public/assets/', import.meta.url).pathname.replace(/^\//, '');
const QUALITY = 82;
const FORCE   = process.argv.includes('--force');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p));
    else if (extname(e.name).toLowerCase() === '.png') files.push(p);
  }
  return files;
}

async function convert(file) {
  const out = file.replace(/\.png$/i, '.webp');
  if (!FORCE && existsSync(out)) return { file, skipped: true };

  const before = (await stat(file)).size;
  await sharp(file).webp({ quality: QUALITY, effort: 6 }).toFile(out);
  const after  = (await stat(out)).size;
  await unlink(file);
  return { file: basename(file), before, after, saved: before - after };
}

const files = await walk(ROOT);
console.log(`Found ${files.length} PNG files under public/assets/`);

let totalBefore = 0, totalAfter = 0;
for (const f of files) {
  const r = await convert(f);
  if (r.skipped) { console.log(`SKIP  ${r.file} (webp exists)`); continue; }
  totalBefore += r.before;
  totalAfter  += r.after;
  const pct = ((1 - r.after / r.before) * 100).toFixed(1);
  console.log(`${r.file.padEnd(28)} ${(r.before/1024).toFixed(0).padStart(5)} KB -> ${(r.after/1024).toFixed(0).padStart(5)} KB (-${pct}%)`);
}

const pct = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
console.log(`\nTOTAL ${(totalBefore/1024).toFixed(0)} KB -> ${(totalAfter/1024).toFixed(0)} KB (-${pct}%)`);
