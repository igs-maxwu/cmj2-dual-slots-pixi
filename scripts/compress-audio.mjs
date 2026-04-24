// Sprint 4 l-01: compress BGM tracks to 48kbps CBR MP3 for ~5x size reduction.
// SFX left alone (already 15-80KB each, minimal gain from re-encode).

import ffmpegPath from 'ffmpeg-static';
import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BGM_DIR = path.join(ROOT, 'public/assets/audio/bgm');

// Only BGM tracks > 1MB get compressed. big-win.mp3 (244KB) already fine.
const TARGETS = ['battle.mp3', 'victory.mp3'];
const TARGET_BITRATE = '48k';  // CBR — music quality acceptable at 48kbps stereo

async function main() {
  for (const file of TARGETS) {
    const src = path.join(BGM_DIR, file);
    const tmp = path.join(BGM_DIR, file + '.tmp');
    const origSize = (await fs.stat(src)).size;

    execSync(`"${ffmpegPath}" -i "${src}" -b:a ${TARGET_BITRATE} -y "${tmp}"`, { stdio: ['ignore', 'ignore', 'ignore'] });

    const newSize = (await fs.stat(tmp)).size;
    await fs.rename(tmp, src);
    const pct = Math.round((newSize / origSize) * 100);
    console.log(`${file}: ${(origSize/1024).toFixed(0)} KB -> ${(newSize/1024).toFixed(0)} KB (${pct}%)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
