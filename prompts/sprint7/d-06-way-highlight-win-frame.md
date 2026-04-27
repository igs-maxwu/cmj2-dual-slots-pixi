# Sprint 7 · d-06 — Way highlight win-frame（既有 Pixi Graphics 框替換成 SOS2 sos2-win-frame.webp + GlowFilter pulse）

## 1. Context

PR: **`SlotReel.pulseWay()` (line 316-346) 既有「Graphics roundRect 填色 → alpha pulse → 還原 white」改成「SOS2 win-frame.webp Sprite 疊在 cell 上 + GlowFilter outerStrength pulse」**。每個 wayHit cell 都有金色脈動光框，比純 alpha 色塊更有「中獎感」。

Why: Sprint 7 demo polish。Way highlight 是玩家**每 spin 都會看到**的視覺元素，提升其品質對 demo 截圖跟 hype video 整體質感影響最大。SOS2 atlas 已經包含現成的 `sos2-win-frame.webp` 框形 asset。

設計：
- 每個 hit cell：建一個 win-frame Sprite，scale 對齊 CELL_W × CELL_H + 些微 overshoot（visual padding）
- Tint：保留原本 `T.TEAM.azureGlow / vermilionGlow`（azure / vermilion 各側顏色不變）
- 動畫：與既有 `pulseWay` 同 330ms 時長、Easings.pulse 曲線（不動 timing）
- GlowFilter：outerStrength 0 → 3.5 → 0 配合 alpha pulse
- Cleanup：tween 結束 frame sprite destroy（既有 cell.overlay 仍保留作為 hover 等其他用途）
- d-04 已驗證 `Assets.get` + null guard pattern，d-06 沿用

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Sprite layering 在 cell 上方、GlowFilter 動態 outerStrength 動畫、cleanup 紀律（tween 結束所有 frame sprite destroy）。**特別注意**：本 PR 為**每 spin 數十個 hit cell** 的 hot path，避免每 hit cell 重建 GlowFilter instance（filter 物件可重用，per-spin 共一個 filter instance + 多 sprite share filter array）。
- **`code-simplification`** — 既有 pulseWay 末段「`cell.overlay.clear().fill(0xffffff)`」是從 placeholder 時期遺留的還原行為（Chesterton's Fence — 先理解 why 才能動）。本 PR 加新 frame sprite，**不改既有 overlay 邏輯**，避免破壞其他依賴（attack choreographer 可能也用 overlay）。
- **`source-driven-development`** — `pixi-filters` GlowFilter API 對照官方 docs（特別 outerStrength 動態變更語法），單 webp `Assets.get` 對照 d-04 既有 pattern。

---

## 2. Spec drift check (P6)

1. `mempalace_search "way highlight win-frame SOS2 polish d-06"`
2. 確認 `SlotReel.ts` line 316-346 `pulseWay` method
3. 確認 `LoadingScreen.ts` 是否 preload `sos2-win-frame`（**可能跟 d-04 一樣沒 preload — 若沒，本 PR 補**）
4. 確認 `pixi-filters` 已 imported in 既有檔（d-04 用過 BLEND_MODES，r-04 用過 GlowFilter）
5. 確認 `T.TEAM.azureGlow / vermilionGlow` 存在於 DesignTokens

## 3. Task

### 3a. Preflight — `LoadingScreen.ts` preload `sos2-win-frame`

搜尋既有 `preloadFx` method（d-04 PR #131 加的），加：

```ts
{ alias: 'sos2-win-frame',     src: `${BASE_URL}assets/fx/sos2-win-frame.webp` },
```

到 array 中（與 sos2-fire-wave / sos2-particles / sos2-radial-lights 同一群）。

### 3b. SlotReel — pulseWay rewrite

既有（line 316-346）：

```ts
private async pulseWay(hit: WayHit, side: 'A' | 'B'): Promise<void> {
  // ... compute targets ...
  for (const cell of targets) {
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(tint);
  }
  await tween(330, p => {
    const a = Easings.pulse(p) * 0.7;
    for (const cell of targets) cell.overlay.alpha = a;
  });
  for (const cell of targets) {
    cell.overlay.alpha = 0;
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(0xffffff);
  }
}
```

改寫為（**保留既有 overlay 行為作底色**，加 win-frame sprite 在頂層）：

```ts
import { Assets, Sprite, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';

private async pulseWay(hit: WayHit, side: 'A' | 'B'): Promise<void> {
  const dir       = side === 'A' ? 1 : -1;
  const anchorCol = side === 'A' ? 0 : COLS - 1;
  const tint      = side === 'A' ? T.TEAM.azureGlow : T.TEAM.vermilionGlow;

  const targets: Cell[] = [];
  for (let offset = 0; offset < hit.hitCells.length; offset++) {
    const actualCol = anchorCol + offset * dir;
    for (const row of hit.hitCells[offset]) {
      targets.push(this.cells[actualCol][row]);
    }
  }

  // Existing overlay tint (kept for backwards-compat with other systems)
  for (const cell of targets) {
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(tint);
  }

  // d-06: layer win-frame sprite on top of each hit cell
  const tex = Assets.get<Texture>('sos2-win-frame');
  const frames: Sprite[] = [];
  let glow: GlowFilter | null = null;
  if (tex && tex !== Texture.EMPTY) {
    glow = new GlowFilter({
      color: tint, distance: 8, outerStrength: 0, innerStrength: 0.3, quality: 0.4,
    });
    for (const cell of targets) {
      const f = new Sprite(tex);
      f.anchor.set(0.5);
      f.tint = tint;
      // Slightly larger than cell for visual padding
      f.width  = CELL_W + 8;
      f.height = CELL_H + 8;
      f.alpha = 0;
      f.filters = [glow];   // share filter instance across all frames in this pulse
      cell.container.addChild(f);
      frames.push(f);
    }
  }

  // Pulse animation — both overlay + frames driven by same Easings.pulse curve
  await tween(330, p => {
    const a = Easings.pulse(p);
    for (const cell of targets) cell.overlay.alpha = a * 0.7;
    if (glow && frames.length) {
      glow.outerStrength = a * 3.5;
      for (const f of frames) f.alpha = a;
    }
  });

  // Cleanup
  for (const cell of targets) {
    cell.overlay.alpha = 0;
    cell.overlay.clear()
      .roundRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, T.RADIUS.sm)
      .fill(0xffffff);
  }
  for (const f of frames) f.destroy();
}
```

**注意**：`glow` 是 `pulseWay` 區域變數（per-call instance），多個並行 wayHits 會各自一個 GlowFilter。共享 across pulses 會造成 outerStrength 互相覆寫 → 不要做。**per-pulse 一個 GlowFilter，per-pulse 結束 frames destroy 自然 unref filter**。

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts` 唯一檔（pulseWay rewrite + 2 imports）
- `src/screens/LoadingScreen.ts`（+1 行 preload — 若 sos2-win-frame 已 preload 則跳過）

**禁止**：
- BattleScreen.ts / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- DesignTokens（用既有 T.TEAM tints）
- Cell interface / Graphics overlay 既有結構（不動 backwards-compat）
- highlightWays method（這是 caller，pulseWay 是 callee — 只動 callee）
- main.ts atlas preload（已 OK）
- 加新 asset
- scripts/sim-rtp.mjs（純視覺）
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. 1 個 commit（含 LoadingScreen preload + SlotReel rewrite）
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle，spin 觸發 wayHit（很常見 ~50% 機率）
   - 看到金色 / azure / vermilion win-frame 在 hit cell 上方脈動 + glow
   - 多個並行 wayHit 各自有 frame、互不干擾
   - 5 spins 後 stage child count 穩定（無 sprite leak）
5. **截圖**：1 張 mid-pulse（最好包含雙方各自 wayHit 同時 highlight）
6. **效能**：FPS 全程 ≥ 50（DevTools Performance — way highlight 是 hot path）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- sos2-win-frame 是否原本 preloaded（spec drift catch 結果）
- GlowFilter 是否有 per-pulse 重建造成的 GC 壓力觀察（frontend-ui-engineering skill 觸發）
- FPS 觀察（特別並行 wayHits 多的場面）
- Spec deviations：預期 0
