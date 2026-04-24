# Sprint 4 · l-02 — Asset Lazy-Loading（首屏只載輕量、Battle 才載重磅）

## 1. Context

PR: **拆分 asset preload：LoadingScreen 只載 DraftScreen 必需的輕量資產；spirits + fx + bgm 延後到進 BattleScreen 時再載**

Why: 目前 LoadingScreen 一次載完所有資產（~5.9 MB），用戶首次開頁等待 5-10s。改分層後首屏（Loading → Draft）只載 ~600 KB（UI + gems），Battle 進入時 async load 剩餘 ~5.3 MB。首屏時間預期從 ~10s → ~2s。

當前 LoadingScreen（`src/screens/LoadingScreen.ts`）：
- `preloadUi()` — UI textures (~516 KB)
- `preloadGems()` — 5 gems (~9 KB)
- `preloadSpirits()` — 8 spirit webp (~744 KB)
- （FX atlases / BGM 不在 LoadingScreen，由 main.ts 或 AudioManager 觸發）

讓我再次 grep 其他地方的 preload 點找出實際瓶頸。

Source:
- `src/screens/LoadingScreen.ts`（主要改）
- `src/main.ts` — FXAtlas preload 呼叫（line ~32-40）
- `src/systems/AudioManager.ts`（可能需延後 BGM 載入）
- `src/screens/ScreenManager.ts`（若需加 transition hook）

Base: master HEAD（l-03 PWA merged）
Target: `feat/sprint4-l-02-lazy-load`

## 2. Spec drift check (P6)

1. `grep -rn "Assets.load\|FXAtlas.load\|AudioManager" src/` 列出所有目前會觸發下載的地方
2. 確認執行序：`main.ts → LoadingScreen.onMount → preloadUi → preloadGems + preloadSpirits → FXAtlas.load → ScreenManager.show(Draft)`
3. 找出 BattleScreen 真正需要的資產清單：
   - spirits (8 webp, 744 KB) ✓ 必需
   - fx atlases (3 webp + 3 atlas, ~600 KB) ✓ 必需
   - bgm/battle.mp3 (1.5 MB) ✓ 必需（可 streaming，非 blocking）
   - 其他 UI / gems / DraftScreen assets 已在首屏

## 3. Task

### 3a. LoadingScreen 只做 DraftScreen preload

改 `src/screens/LoadingScreen.ts` onMount：

```ts
async onMount(app: Application, stage: Container): Promise<void> {
  stage.addChild(this.container);
  this.drawBackground();
  this.drawTitle();
  this.drawProgress();

  // Phase 1: UI + gems ONLY (DraftScreen-ready, ~540 KB)
  await this.preloadUi();
  this.upgradeToDecoratedLoadingScreen();
  await this.preloadGems();

  // spirits deferred to BattleScreen.onMount
  this.onDone();
}
```

**移除** `preloadSpirits()` 的 eager call（但保留 method 本身，BattleScreen 會 reuse）。改為 export 讓 BattleScreen 呼叫：

```ts
export async function preloadBattleAssets(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  // Spirits
  const spiritAssets = SYMBOLS.filter(s => !s.isWild).map(s => ({
    alias: s.spiritKey,
    src:   `${base}assets/spirits/${s.spiritKey}.webp`,
  }));
  await Assets.load(spiritAssets);
}
```

### 3b. FXAtlas preload 延後到 BattleScreen

改 `src/main.ts`：**拿掉** 頂層 `await FXAtlas.load([...])`，讓 FXAtlas 空載狀態進 DraftScreen（DraftScreen 不用 FXAtlas）。BattleScreen.onMount 內呼叫：

```ts
// src/screens/BattleScreen.ts onMount():
await preloadBattleAssets();    // spirits + 其他 battle-only
await FXAtlas.load([
  { name: 'sos2-bigwin',       atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-bigwin.atlas` },
  { name: 'sos2-near-win',     atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-near-win.atlas` },
  { name: 'sos2-declare-fire', atlas: `${import.meta.env.BASE_URL}assets/fx/sos2-declare-fire.atlas` },
]);
// rest of onMount...
```

### 3c. BattleScreen 加過渡 loading overlay

進 BattleScreen 時有 ~1-2s asset load 空窗期，加個簡單 loading overlay（「進入戰場中」文字 + 半透明 backdrop）。建議直接在 BattleScreen.onMount 開頭畫：

```ts
async onMount(app: Application, stage: Container): Promise<void> {
  this.app = app;
  stage.addChild(this.container);

  // Loading overlay during battle asset preload
  const overlay = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill({ color: T.SEA.abyss, alpha: 0.95 });
  const loadingText = new Text({
    text: '進入戰場中…',
    style: { fontFamily: T.FONT.display, fontSize: T.FONT_SIZE.h1, fill: T.GOLD.base, letterSpacing: 4 },
  });
  loadingText.anchor.set(0.5);
  loadingText.x = CANVAS_WIDTH / 2;
  loadingText.y = CANVAS_HEIGHT / 2;
  this.container.addChild(overlay);
  this.container.addChild(loadingText);

  // Load heavy assets
  await preloadBattleAssets();
  await FXAtlas.load([...]);

  // Remove overlay
  overlay.destroy();
  loadingText.destroy();

  // rest of existing onMount...
}
```

### 3d. AudioManager BGM 載入策略（選配 §3f）

若 AudioManager 頂層 `init()` 會 eager load 所有 BGM：改為 lazy — 只 `AudioManager.playBgm('battle')` 時載 `battle.mp3`，減少 DraftScreen 不必要的 BGM 載入。

若 AudioManager 已是 streaming（HTMLAudioElement，不全載），skip 此步。

### 3e. 檔案範圍（嚴格）

**修改**：
- `src/screens/LoadingScreen.ts`（移除 spirits eager load，export preloadBattleAssets）
- `src/main.ts`（拿掉 FXAtlas.load 頂層呼叫）
- `src/screens/BattleScreen.ts`（onMount 開頭加 loading overlay + 延後 asset load）
- `src/systems/AudioManager.ts`（若需要）

**禁止**：
- DraftScreen（不變）
- FXAtlas.ts（loader 本身不變）
- 所有 asset 檔案
- SPEC.md
- vite.config.ts（PWA 不變）

## 4. DoD (P1 — 逐字)

1. `npm run build` 過
2. commit + push
3. PR URL
4. **Preview 驗證**：
   - 首次開頁 Loading → Draft 快（< 2s）
   - 進 Battle 時短暫看到「進入戰場中」overlay（1-2s）
   - Battle 全功能正常（雀靈 portrait / FX / BGM / gems 都出）
   - 二次進 Battle 瞬間（asset 已 cache）

## 5. Handoff

- PR URL
- 首次 Loading → Draft 時間（粗估 ms）
- Battle overlay 出現時長
- Spec deviations：預期 0
- 若 AudioManager 延後載入不順（BGM 卡頓），說明 + 建議
