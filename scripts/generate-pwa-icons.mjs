#!/usr/bin/env node
/**
 * Generate PWA icons for 雀靈戰記 · Dual Slots
 * Produces pwa-icon-192.png + pwa-icon-512.png in public/assets/ui/
 *
 * Uses an SVG template (Option B from l-03 prompt) — no source-image dependency.
 * Run once; re-run to regenerate if branding changes.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, '..', 'public', 'assets', 'ui');
mkdirSync(outDir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0e1a"/>
  <circle cx="256" cy="256" r="220" fill="none" stroke="#f5b82a" stroke-width="8"/>
  <circle cx="256" cy="256" r="180" fill="none" stroke="#f5b82a" stroke-width="2" opacity="0.4"/>
  <text x="256" y="310" text-anchor="middle" font-size="180" font-family="serif"
        fill="#f5b82a" font-weight="bold">雀</text>
</svg>`;

const buf = Buffer.from(svg);

for (const size of [192, 512]) {
  const outPath = join(outDir, `pwa-icon-${size}.png`);
  await sharp(buf)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`✓ pwa-icon-${size}.png written to ${outPath}`);
}

console.log('PWA icons generated.');
