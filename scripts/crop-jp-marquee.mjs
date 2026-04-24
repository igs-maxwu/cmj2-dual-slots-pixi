// Extract ONLY the ornate gold-frame region from jp-marquee.webp,
// discarding the baked-in checkerboard padding.
// Original: 1024x1024 with ornate frame roughly at y=370-625, x=60-960.
// We auto-detect the "gold" pixel region by hue-based thresholding.

import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IN   = path.join(ROOT, 'public/assets/ui/jp-marquee.webp');

function isFramePixel(r, g, b) {
  // Gold frame: high R + G, low B;  Green panel: high G, low R/B, mid;
  // Reject grey-checker pixels: r≈g≈b within 10.
  const diff = Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b));
  return diff > 18;  // non-grey
}

async function main() {
  const img = await sharp(IN).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = img;
  const W = info.width, H = info.height, C = info.channels;
  console.log(`Source: ${W}x${H}`);

  let minX=W, maxX=0, minY=H, maxY=0;
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    const i = (y*W+x)*C;
    if (isFramePixel(data[i], data[i+1], data[i+2])) {
      if (x<minX) minX=x; if (x>maxX) maxX=x;
      if (y<minY) minY=y; if (y>maxY) maxY=y;
    }
  }
  const cx = maxX - minX + 1;
  const cy = maxY - minY + 1;
  console.log(`Frame bbox: (${minX}, ${minY}) -> (${maxX}, ${maxY}), size ${cx} x ${cy}`);

  // Extract + punch transparent bg for pixels outside frame coloring
  // Step 1: extract bounding box
  const cropped = await sharp(IN).extract({ left: minX, top: minY, width: cx, height: cy }).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const cdata = cropped.data;
  const cW = cropped.info.width, cH = cropped.info.height, cC = cropped.info.channels;

  // Step 2: set alpha=0 on grey pixels
  for (let y=0; y<cH; y++) for (let x=0; x<cW; x++) {
    const i = (y*cW+x)*cC;
    if (!isFramePixel(cdata[i], cdata[i+1], cdata[i+2])) {
      cdata[i+3] = 0;  // fully transparent
    }
  }

  const outBuf = await sharp(cdata, { raw: { width: cW, height: cH, channels: cC } })
    .webp({ quality: 92, effort: 6 })
    .toBuffer();

  const tmp = IN + '.tmp2';
  await fs.writeFile(tmp, outBuf);
  await fs.rename(tmp, IN);
  console.log(`Wrote ${outBuf.length} bytes, ${cW}x${cH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
