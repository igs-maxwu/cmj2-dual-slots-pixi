# Sprint 7 · d-05 — Near-win 金粉 teaser（4-of-5 reels 覆蓋同 symbol → 缺的那 column 浮現金粉 hint）

## 1. Context

PR: **新建 `src/fx/NearWinTeaser.ts`，export `playNearWinTeaser(reel, missingCol, tint): Promise<void>`。BattleScreen post-spin 偵測「near-win」條件 → 在缺的那欄浮現 SOS2 sos2-near-win atlas 的 Sand 系列粒子，給玩家「差一點」的視覺暗示。Sim 同步加 near-win 頻率統計確認 10-20% 區間。**

Why: Sprint 7 demo polish。Slot 經典「near-miss / near-win」是核心 juice 機制 — 玩家看到 4 reel 都湊到同 symbol、就差 1 reel 沒對到，**情緒峰值反而比小贏更高**。視覺暗示後玩家更願意 spin 下一把。Demo 想抓的就是這個情緒爆點。

設計：

### Near-win 偵測條件（簡化版）

對每個非特殊 symbol（spirit id 0-7，跳過 Wild/Curse/Scatter/Jackpot）：
- 計算 `coveredCols` = 出現在哪些 column（0..4）
- 若 `|coveredCols| == 4`（恰好 4 個 reel 有，1 個缺）→ near-win 5-of-a-kind 候選
- 找出 missing column = `[0..4] \ coveredCols`（有且只有 1 個）
- 跳過：若 SlotEngine 已對該 symbol scored 5-of-a-kind way（不可能 — 5-of-a-kind 需 5 reel 覆蓋）
- **最多每 spin 觸發 1 次 teaser**（即使多 symbol 同時 4-of-5，挑第一個或最高 weight 的）

### 視覺：Sand 粒子柱

`sos2-near-win` atlas 含 `Sand_01..04` 4 frame，可用作 frame-cycle 動畫。

- 在 missing column 的 3 個 row 各浮現 1 個 Sand sprite（共 3 顆）
- 每顆 sprite frame index = `Math.floor(t * 4) % 4` 換 region
- 軌跡：從 cell.y - 30 上升到 cell.y - 120（120px 上飄），y 隨 t 線性、x 加 sin 擾動 ±15px
- alpha 0 → 0.7 → 0（fade-in 200ms / hold 300ms / fade-out 300ms = 800ms 全程）
- tint = 對應 symbol 的 clan 色（azure / white / vermilion / black）

### 不阻塞 game flow

`playNearWinTeaser` **fire-and-forget** call，BattleScreen 不 await（near-win 只是視覺暗示，不該延遲 damage 結算或下回合）。Cleanup 由 module 內部負責。

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Container 階層、frame swap pattern（沿用 d-04 / j-04 既有 FXAtlas.sprite() texture swap），fire-and-forget 不 block loop。**特別注意**：multi-frame Sprite 如何以 single Sprite + texture swap 做 cycle，避免每 frame 重建 Sprite。
- **`incremental-implementation`** — 3 commits：(1) NearWinTeaser.ts new module，(2) BattleScreen detection + integration，(3) sim 統計。每個 commit 自包含 + build 過。
- **`test-driven-development`** — sim 是 truth source。期望 `near_win_rate ≈ 10-20%`（依 P(any symbol covers exactly 4 reels) 估算）。若 sim 量到 < 5% 或 > 30%，flag — 表示偵測邏輯有 bug 或 SPEC 期望需重估。

---

## 2. Spec drift check (P6)

1. `mempalace_search "near-win teaser gold-dust 4 of 5 reels d-05 polish"`
2. 確認 `sos2-near-win` atlas 已 in main.ts line 34-37 preload list（**已確認 — 跟 sos2-bigwin 同 batch**）
3. 確認 `sos2-near-win.atlas` 含 `Sand_01..04` regions（**已驗證**：grep 看到 Sand_01/02/03/04）
4. 確認 SlotReel 提供 cell 座標 helper（line 381 `cellLocal(col, row)` 存在）
5. 確認 BattleScreen `loop()` 內 spin 結束後 grid 可訪問（既有變數 `spin.grid`）

## 3. Task

### 3a. 新檔 `src/fx/NearWinTeaser.ts`

```ts
import { Container, Sprite, Ticker } from 'pixi.js';
import { FXAtlas } from '@/fx/FXAtlas';
import { tween } from '@/systems/tween';

const SAND_KEYS = [
  'sos2-near-win:Sand_01',
  'sos2-near-win:Sand_02',
  'sos2-near-win:Sand_03',
  'sos2-near-win:Sand_04',
];
const FRAME_MS = 80;       // ~12 fps cycle
const TOTAL_MS = 800;      // 200 fade-in + 300 hold + 300 fade-out

interface SandState {
  sprite: Sprite;
  baseX: number;
  baseY: number;
  birth: number;
}

/**
 * d-05: Near-win gold-dust teaser at the "missing" column.
 *
 * Caller passes 3 cell positions (one per row of the missing column).
 * Each row spawns 1 Sand sprite that rises 120px over 800ms with
 * sinusoidal x-jitter and alpha-pulse, frame-cycling through Sand_01..04.
 *
 * Fire-and-forget — caller does NOT await; module self-cleans.
 */
export function playNearWinTeaser(
  parent: Container,
  cellPositions: Array<{ x: number; y: number }>,
  tint: number = 0xFFD37A,
): void {
  if (cellPositions.length === 0) return;

  // Build sand textures once (caller may invoke many times — atlas caches sub-textures)
  const sandTextures = SAND_KEYS.map(key => FXAtlas.sprite(key).texture);

  const sands: SandState[] = [];
  const start = performance.now();

  for (const pos of cellPositions) {
    const s = new Sprite(sandTextures[0]);
    s.anchor.set(0.5);
    s.tint = tint;
    s.alpha = 0;
    s.scale.set(0.5);
    s.x = pos.x;
    s.y = pos.y;
    s.blendMode = 'add';   // Pixi 8 string enum
    parent.addChild(s);
    sands.push({ sprite: s, baseX: pos.x, baseY: pos.y, birth: start });
  }

  const ticker = Ticker.shared;
  const tickFn = (_tk: Ticker) => {
    const now = performance.now();
    const t = (now - start) / TOTAL_MS;
    if (t >= 1) {
      // Cleanup
      ticker.remove(tickFn);
      for (const s of sands) s.sprite.destroy();
      return;
    }
    // Frame cycle
    const frameIdx = Math.floor((now - start) / FRAME_MS) % 4;
    // Alpha envelope: fade-in 200ms / hold 300ms / fade-out 300ms
    let alpha: number;
    if (t < 0.25)       alpha = (t / 0.25) * 0.7;          // 0 → 0.7
    else if (t < 0.625) alpha = 0.7;                       // hold
    else                alpha = 0.7 * (1 - (t - 0.625) / 0.375);   // 0.7 → 0
    // Position + jitter
    for (const s of sands) {
      s.sprite.texture = sandTextures[frameIdx];
      s.sprite.alpha   = alpha;
      s.sprite.y       = s.baseY - t * 120;          // rise 120px
      s.sprite.x       = s.baseX + Math.sin(t * Math.PI * 4) * 15;
    }
  };
  ticker.add(tickFn);
}
```

**Commit 1**: `feat(d-05a): NearWinTeaser module — Sand cycle particles fire-and-forget`

### 3b. BattleScreen — detect + integrate

加 import：

```ts
import { playNearWinTeaser } from '@/fx/NearWinTeaser';
```

在 `loop()` 內，spin 結果 grid 拿到後（line ~570-580 spin call 之後、Curse counting 之前）加偵測：

```ts
// d-05: Near-win detection — symbol covering exactly 4 of 5 reels
const NON_SPECIAL_IDS = SYMBOLS
  .map((s, i) => (s.isWild || s.isCurse || s.isScatter || s.isJackpot) ? -1 : i)
  .filter(i => i >= 0);

let nearWinTriggered = false;
for (const symId of NON_SPECIAL_IDS) {
  if (nearWinTriggered) break;   // max 1 teaser per spin
  const coveredCols = new Set<number>();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      if (spin.grid[r][c] === symId) coveredCols.add(c);
    }
  }
  if (coveredCols.size === 4) {
    // Find missing column
    let missingCol = -1;
    for (let c = 0; c < 5; c++) {
      if (!coveredCols.has(c)) { missingCol = c; break; }
    }
    if (missingCol >= 0) {
      // Build cell positions for that column (3 rows)
      const positions = [0, 1, 2].map(r => {
        const local = this.reel.cellLocal(missingCol, r);
        return { x: this.reel.x + local.x, y: this.reel.y + local.y };
      });
      const clan = SYMBOLS[symId].clan;
      const tint = T.CLAN_META[clan]?.glow ?? 0xFFD37A;
      playNearWinTeaser(this.container, positions, tint);
      nearWinTriggered = true;
      if (import.meta.env.DEV) {
        console.log(`[NearWin] symbol=${SYMBOLS[symId].name} missingCol=${missingCol}`);
      }
    }
  }
}
```

**Commit 2**: `feat(d-05b): BattleScreen near-win detection + teaser integration`

### 3c. sim-rtp.mjs — near-win frequency tracking

per-run init：

```ts
let nearWinCount = 0;
```

per-spin（在既有 loop 內，**replicate detection 邏輯**避免 import BattleScreen）：

```ts
const nonSpecialIds = SYMBOLS
  .map((s, i) => (s.isWild || s.isCurse || s.isScatter || s.isJackpot) ? -1 : i)
  .filter(i => i >= 0);
let foundNearWin = false;
for (const symId of nonSpecialIds) {
  if (foundNearWin) break;
  const coveredCols = new Set();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      if (spin.grid[r][c] === symId) coveredCols.add(c);
    }
  }
  if (coveredCols.size === 4) {
    nearWinCount++;
    foundNearWin = true;
  }
}
```

output 加：

```ts
near_win: {
  triggers: nearWinCount,
  rate_per_spin: nearWinCount / ROUNDS,
}
```

**Commit 3**: `feat(d-05c): sim near-win frequency tracking`

### 3d. 檔案範圍（嚴格）

**新增**：
- `src/fx/NearWinTeaser.ts`（~80 lines new）

**修改**：
- `src/screens/BattleScreen.ts`（+import + detect block ~25 行）
- `scripts/sim-rtp.mjs`（per-run + per-spin + output ~15 行）

**禁止**：
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- DraftScreen / LoadingScreen（**sos2-near-win 已 preload，不需動**）
- main.ts（已 OK）
- DesignTokens（用既有 T.CLAN_META.glow）
- 加新 asset
- SPEC.md
- 改 d-04 / d-06 邏輯
- 改 ways scoring 規則（near-win 是純視覺，不影響 score）

## 4. DoD

1. `npm run build` 過
2. **3 個 commit**（per `incremental-implementation`）
3. push + PR URL + sim JSON
4. **Sim 數字**：
   - `near_win.rate_per_spin`（期望 0.10-0.20，**核心 acceptance**）
   - 若超出該區間，flag — 偵測邏輯需檢視
5. **Preview 驗證**：
   - 進 Battle，跑 ~20 spin，至少看到 2-4 次 console `[NearWin] symbol=X missingCol=Y` + 缺的欄出現金粉柱
   - 視覺**輕**（alpha ≤ 0.7）— 不該蓋過 wayHit highlight
   - 截圖 1 張 mid-teaser
6. **效能**：FPS 不掉（teaser 是 fire-and-forget，不該影響 hot path）

## 5. Handoff

- PR URL
- 1 行摘要
- `near_win.rate_per_spin` 數值 + 是否落 10-20%
- 1 張截圖（mid-teaser）
- Ticker callback 是否確實 unregister（frontend-ui-engineering skill — zombie callback risk）
- Pixi 8 frame swap pattern 與 d-04 / j-04 對照是否一致（source-driven-development skill）
- Spec deviations：預期 0
