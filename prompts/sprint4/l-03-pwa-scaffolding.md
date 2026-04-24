# Sprint 4 · l-03 — PWA Scaffolding（manifest + service worker）

## 1. Context

PR: **把遊戲變可安裝 PWA — iOS/Android 加入主畫面變獨立 app**

Why: SPEC §16 Lightweight Strategy v1.0 locked — 「PWA delivery, ≤ 5 MB page-1 session bundle」。Sprint 4 Track L 目標之一。當前 bundle 5.9 MB，要做 PWA 以：
- Offline cache（重訪秒開）
- Install prompt（加入主畫面獨立 app 體驗）
- Lighthouse PWA 分項通過
- Service worker 做 asset cache（avoid 重複下載 BGM/spirits）

用 `vite-plugin-pwa`（Vite 生態標準方案，autoupdate + workbox 配置）。

Source:
- `vite.config.ts` 當前只 11 行（base + alias）
- `index.html` 當前無 manifest link / theme-color
- `public/assets/ui/` 有既有 logo 可用作 PWA icon

Base: master HEAD（l-01 merged）
Target: `feat/sprint4-l-03-pwa`

## 2. Spec drift check (P6)

1. `grep -rn "vite-plugin-pwa\|serviceWorker\|manifest" vite.config.ts index.html public/` 確認尚未安裝
2. 確認 `public/assets/ui/` 有可用 logo（例如 `portrait-ring.webp` 或類似），若無 STOP 回報
3. `npm ls vite-plugin-pwa` 若已安裝，STOP 回報

## 3. Task

### 3a. 安裝 `vite-plugin-pwa`

```bash
npm install --save-dev vite-plugin-pwa
```

### 3b. 更新 `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: '/cmj2-dual-slots-pixi/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'assets/**/*'],
      manifest: {
        name: '雀靈戰記 · Dual Slots',
        short_name: '雀靈戰記',
        description: '1v1 mahjong-fantasy slot battle',
        theme_color: '#0a0e1a',
        background_color: '#0a0e1a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/cmj2-dual-slots-pixi/',
        start_url: '/cmj2-dual-slots-pixi/',
        icons: [
          {
            src: 'assets/ui/pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'assets/ui/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'assets/ui/pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache all .webp / .webmanifest / .js / .css / audio files for offline
        globPatterns: ['**/*.{js,css,html,webp,webmanifest,mp3,atlas}'],
        // Large assets — audio BGM runtime cache instead of precache
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
```

### 3c. 產出 PWA icon（192×192 + 512×512）

**本 PR 不創新圖**，改用既有素材 resize。可行方案：

**選項 A**：scripts 裡加個 `generate-pwa-icons.mjs`，從 `public/assets/ui/` 某個現成圖（如 logo 或 portrait ring）resize 出 192/512：

```ts
// scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
const src = 'public/assets/ui/portrait-ring.webp';  // 確認實際檔名
for (const size of [192, 512]) {
  await sharp(src).resize(size, size, { fit: 'contain', background: '#0a0e1a' })
    .png().toFile(`public/assets/ui/pwa-icon-${size}.png`);
}
```

**選項 B**：若找不到乾淨 square logo，用 SVG 生成一張極簡 fallback icon（四聖獸陰陽紋 + 金色邊框）：

```ts
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0e1a"/>
  <circle cx="256" cy="256" r="220" fill="none" stroke="#f5b82a" stroke-width="8"/>
  <text x="256" y="300" text-anchor="middle" font-size="140" font-family="serif" fill="#f5b82a" font-weight="bold">雀</text>
</svg>`;
await sharp(Buffer.from(svg)).resize(192).png().toFile('.../pwa-icon-192.png');
// repeat 512
```

選 B 較可靠（不依賴既有素材結構）。檔案 < 5 KB each。

### 3d. index.html 加 PWA meta

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0a0e1a" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <link rel="apple-touch-icon" href="/cmj2-dual-slots-pixi/assets/ui/pwa-icon-192.png" />
  <title>雀靈戰記 · Dual Slots (Pixi)</title>
  <!-- existing style block unchanged -->
</head>
```

### 3e. 驗證

```bash
npm run build
ls dist/
# 應該看到 manifest.webmanifest + sw.js + workbox-*.js
```

### 3f. 檔案範圍（嚴格）

**新增**：
- `public/assets/ui/pwa-icon-192.png`（新圖）
- `public/assets/ui/pwa-icon-512.png`（新圖）
- `scripts/generate-pwa-icons.mjs`（icon 生成器，留檔以便日後 update）

**修改**：
- `vite.config.ts`（+ VitePWA plugin block）
- `index.html`（+ PWA meta tags）
- `package.json` / `package-lock.json`（+ vite-plugin-pwa dep + sharp 若未有）

**禁止**：
- `src/` 任何檔案（PWA 透過 vite plugin 自動注入，不需 src 改）
- SPEC.md
- 其他 assets

## 4. DoD (P1 — 逐字)

1. `npm run build` 過，產出 `dist/manifest.webmanifest` + `dist/sw.js`
2. No console.log / debugger
3. commit + push
4. PR URL
5. **驗證**：本機 preview 時 DevTools → Application → Manifest 顯示正確名稱 + icon，Service Worker 顯示 activated
6. PR summary 附 `dist/` 檔案大小

## 5. Handoff

- PR URL
- 確認 manifest 正確（short_name, icon 尺寸齊全）
- dist 產出 sw.js + workbox 檔案列出
- 實機 install test 可做可不做（Lighthouse 之後 l-04 檢查）
