# Chore — Console 警示清理（4 項：favicon + Pixi deprecation + perf 305ms + sos2-rainbow-halo preload）

## 1. Context

Owner 試玩後 console 出現 4 類雜訊。逐一清掉以避免未來 debug 時被干擾。

| # | 訊息 | 性質 | Fix 範圍 |
|---|---|---|---|
| 1 | `favicon.ico 404` (×2) | 美觀 | index.html 加 `<link rel="icon">` |
| 2 | PixiJS Deprecation `addChild: Only Containers...` | v9 breaking | Grep 找誰把 Sprite/Text/Graphics 當 parent |
| 3 | `[Violation] requestAnimationFrame 305ms` | 效能（卡幀）| 預載 + 識別 hotspot |
| 4 | `sos2-rainbow-halo.webp not in Cache` | chore #169 漏 preload | LoadingScreen 加 alias |

純 cleanup — 不動 game logic。

---

## Skills suggested

- **`incremental-implementation`** — 4 atomic commits（一項一 commit）
- **`source-driven-development`** — grep 確認每一處 fix
- **`debugging-and-error-recovery`** — Item 2 需 grep + 視 trial 結果

---

## 2. Spec drift check (P6)

1. 確認 `index.html` 結構（current 在 repo root，無 `<link rel="icon">`）
2. 確認 LoadingScreen 既有 preload list（`src/screens/LoadingScreen.ts` 約 line 160 area）
3. 確認 chore #169 `FreeSpinRetriggerCeremony.ts` line 18-19 用 `Texture.from(haloUrl)` lazy load

---

## 3. Task

### 3a. Commit 1 — Item 1: Suppress favicon 404

`index.html` line ~10（`<link rel="apple-touch-icon">` 上方或下方）：

加：
```html
<!-- chore #190: suppress browser auto-fetch /favicon.ico → 404 — empty data URL is sufficient -->
<link rel="icon" href="data:," />
```

或乾脆指向既有 PWA icon：
```html
<link rel="icon" type="image/png" href="/cmj2-dual-slots-pixi/assets/ui/pwa-icon-192.png" />
```

> **推薦**：用既有 pwa-icon-192.png（多用途，PWA + favicon）。如果 path 跟 `apple-touch-icon` 重複沒關係，瀏覽器會用最先 match 的。

`npm run build` 確認 console 無 `favicon.ico 404` warning。

**Commit 1**: `fix(chore): index.html add favicon link to suppress browser /favicon.ico 404`

---

### 3b. Commit 2 — Item 4: sos2-rainbow-halo preload

`src/screens/LoadingScreen.ts` 在 line ~160 area 既有 preload list：
```ts
{ alias: 'sos2-particles',     src: `${base}assets/fx/sos2-particles.webp` },
```

加一行：
```ts
{ alias: 'sos2-rainbow-halo',  src: `${base}assets/fx/sos2-rainbow-halo.webp` },
```

然後 `src/fx/FreeSpinRetriggerCeremony.ts` line 18-19 改成優先 `Assets.get`：
```ts
// chore #190: prefer cached asset (LoadingScreen preload), fallback to Texture.from
const haloTex = Assets.get<Texture>('sos2-rainbow-halo')
             ?? Texture.from(`${import.meta.env.BASE_URL}assets/fx/sos2-rainbow-halo.webp`);
```

> 加 `import { Assets } from 'pixi.js'` 若未 import。

**Commit 2**: `fix(chore): preload sos2-rainbow-halo in LoadingScreen + use Assets.get in FreeSpinRetriggerCeremony`

---

### 3c. Commit 3 — Item 2: PixiJS deprecation `addChild on non-Container`

#### 3c-1. 偵測

執行：
```bash
grep -rn "\.addChild(" src/fx src/screens src/components | grep -v "Container\." | grep -v "// " | head -30
```

對每個 hit 確認 parent 變數型態。Pixi 8 中 Sprite/Graphics/Text/Mesh 都是 Container subclass，但 v9 將分離。

**重點檢查**：
1. **如果 parent 是明確 `Sprite` / `Graphics` / `Text` 型別 + 有 `.addChild`** → 必修（包成 Container）
2. **若 parent 是 abstract `Container` 但實際 instance 是 Sprite** → 重新設計

#### 3c-2. 推薦做法

若找到 culprit：
- **Option A**：把 parent 改成 `new Container()`，把原 Sprite/Text/Graphics 改成 Container 的 child（多包一層）
- **Option B**：移除子物件，重新組織為 sibling

如 grep 完無明確 culprit，可能是某 third-party (Pixi internal) trigger — 紀錄並移到 future audit。

#### 3c-3. 試玩確認

每段遊戲流程跑一遍（Loading → Draft → Battle → Spin → Free Spin → JP → Result → Retreat），看 deprecation 是否還跳。

**Commit 3**: `fix(chore): wrap non-Container parent in Container for v9 deprecation compat`（或若無 culprit：`docs(chore): document Pixi v9 deprecation source unfound — defer to v9 migration`）

---

### 3d. Commit 4 — Item 3: requestAnimationFrame 305ms violation

#### 3d-1. Hotspot 識別策略

305ms 一 frame 太長 → 找一次性大計算。可能 culprit：
1. **BattleScreen.onMount** — 創 10 個 spirit + cells + ceremonies + reel
2. **drawFormation** — 一次創 5 spirit Sprite（含 texture parsing）
3. **SlotReel.spin first-time BlurFilter** — Filter 第一次 compile shader 慢
4. **JackpotCeremony first run** — atlas region parsing
5. **第一次點擊 SPIN 進入 round flow**

#### 3d-2. 預先 warm-up filter（推薦修法）

Pixi BlurFilter / GlowFilter 第一次 instantiate 編譯 shader 慢。在 LoadingScreen 結束前 / BattleScreen.onMount 開始時，預建一次：

`BattleScreen.onMount` 開頭加：
```ts
// chore #190: warm-up Pixi filter shader compile to avoid 305ms violation on first attack
new BlurFilter({ strength: 0 }).destroy();
new GlowFilter({ distance: 4, outerStrength: 0 }).destroy();
```

> **Note**：filter `.destroy()` API 視 pixi-filters 版本，executor 確認後加 OR 直接 set as filter on dummy container。

#### 3d-3. 進階：split heavy onMount work to next frame

若 onMount 仍超過 200ms（profile via DevTools Performance），切分：
```ts
async onMount(): Promise<void> {
  // First batch (essential UI):
  this.drawCompactHeader();
  this.drawJackpotMarquee();
  await new Promise(r => setTimeout(r, 0));  // yield to next frame

  // Second batch (formation):
  this.drawFormation('A');
  this.drawFormation('B');
  await new Promise(r => setTimeout(r, 0));

  // Third batch:
  this.reel = new SlotReel(...);
  ...
}
```

> 此為**進階 fix**，視 owner trial 結果決定。若 305ms 違反在 #3d-2 filter warm-up 後消失就不需。

**Commit 4**: `fix(chore): warm-up BlurFilter/GlowFilter shader compile on BattleScreen mount`

---

### 3e. 檔案範圍（嚴格）

**修改**：
- `index.html`（favicon link）
- `src/screens/LoadingScreen.ts`（preload sos2-rainbow-halo）
- `src/fx/FreeSpinRetriggerCeremony.ts`（Assets.get fallback）
- `src/screens/BattleScreen.ts`（filter warm-up + Item 2 修法視 grep 結果）

**禁止**：
- 動 game logic / SlotEngine / DamageDistributor
- 動 chore #181/#182/#185/#187/#188 結構
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts game state

---

## 4. DoD

1. `npm run build` 過
2. **4 atomic commits**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "favicon" index.html` — 確認 link 加上
   - `grep "sos2-rainbow-halo" src/screens/LoadingScreen.ts` — 確認 alias 加上
   - `grep "BlurFilter\|GlowFilter" src/screens/BattleScreen.ts | head -5` — 確認 warm-up
5. **Preview 驗證 critical**：
   - F12 console 無 `favicon.ico 404`
   - 進 BattleScreen + 觸發 free spin → free spin retrigger 無 `sos2-rainbow-halo not in Cache` warning（halo 也視覺顯示）
   - 第一次 SPIN 不再 305ms violation（DevTools Performance 確認）
   - PixiJS deprecation 是否還跳（report findings if persists）
   - 整體 gameplay 流暢無 regression

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（cleared console）
- Item 2 deprecation 是否找到 culprit？fix 路徑 / 或 defer
- Item 3 第一次 spin 是否仍 violation（or 哪一刻仍超 200ms）
- 整體 gameplay smoothness 體感
- Spec deviations：預期 0
