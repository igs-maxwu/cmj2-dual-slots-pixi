# Sprint 7 · d-07 — BigWin / MegaWin ceremony for **non-JP** big payouts（reuse sos2-bigwin atlas，視覺層級低於 JP ceremony）

## 1. Context

PR: **新建 `src/fx/BigWinCeremony.ts`，export `playBigWinCeremony(parent, tier, amount): Promise<void>`。BattleScreen post-spin（streak/resonance 計算完、damage settle 前）偵測 coinWon 跨閾值 → 觸發對應 tier 的 ceremony。Atlas 共用 j-04 已 preload 的 sos2-bigwin（TXT_01_Big / TXT_01_Mega 等 region），但 ceremony 視覺**短促 + 不 full-screen dim**，避免與 JP ceremony 撞臉。Sprint 7 最後一個 PR — 完工後 Demo Polish 4/4 全收。**

Why: Sprint 7 demo polish 收尾。標準 slot UX 在「big spin」時玩家需要視覺確認。SPEC §15 不限定金額閾值，**Owner 採業界經驗值**：

| Tier | 閾值（bet=100 為基準）| 預期頻率 |
|---|---|---|
| BigWin | coinWon ≥ 25× bet (2,500 NTD) | ~3-5% spins |
| MegaWin | coinWon ≥ 100× bet (10,000 NTD) | ~0.3-0.8% spins |
| SuperWin | (本 PR **不做** — JP 已蓋掉 500×+ 的視覺空間) | — |

**注意**：閾值針對「單側 coinWon（streak / resonance / free spin x2 都計入）」，不是雙方加總。每側獨立判定。

設計與 JP ceremony 區隔（防撞臉）：

| 維度 | JP Ceremony (j-04) | BigWin/MegaWin (d-07) |
|---|---|---|
| zIndex | 2500 | 2200（in-between range） |
| Dim BG | 0.55 alpha 全螢幕 | **無**（不 dim） |
| Duration | 3.0 / 4.0 / 5.0s | **1.2 / 2.0s**（更短） |
| Coin count | 8 / 16 / 30 | **4 / 8** |
| Wings/Shine | major+/grand only | 都不加 |
| Position | Center | **偏上** y=400（避開 reel 主視野） |

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — 視覺 hierarchy 設計（BigWin 不該蓋掉 wayHit highlight 也不該與 JP ceremony 競爭注意力）、Container cleanup、ticker 紀律與 j-04 一致。
- **`incremental-implementation`** — 3 commits：(1) BigWinCeremony.ts new module（BigWin tier only，最簡）→ build 過 → preview 看視覺，(2) MegaWin tier，(3) BattleScreen integration + threshold detection。任何 tier 視覺出錯可單獨 revert。
- **`source-driven-development`** — Atlas region 名稱與 j-04 對照（`TXT_01_Big` vs `TXT_01_Mega`，**名稱 case 與 j-04 已驗證過的 keys 完全一致**）；Pixi 8 Ticker pattern 沿用 j-04 既有 `Ticker.shared.add/remove` pattern。

---

## 2. Spec drift check (P6)

1. `mempalace_search "BigWin MegaWin ceremony non-JP threshold polish d-07"`
2. 確認 `sos2-bigwin` atlas 已 preloaded in main.ts line 34-37（**已確認** — j-04 已使用）
3. 確認 atlas regions：`TXT_01_Big` / `TXT_01_Mega` / `FX/BigWin_Main_light` / `FX/MegaWin_Main_light_01` / `Coin/Coin_01..09`（j-04 已驗證 12 region）
4. 確認 BattleScreen.ts 既有 `coinA / coinB` 變數在 streak block 後可訪問（line ~660，本 PR 用此值判定 threshold）
5. 確認 j-04 的 `JackpotCeremony.ts` 未動過（**本 PR 不 import JackpotCeremony**，BigWin 是獨立 module）

## 3. Task

### 3a. 新檔 `src/fx/BigWinCeremony.ts`

```ts
import { Container, Sprite, Ticker } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { FXAtlas } from '@/fx/FXAtlas';
import { goldText } from '@/components/GoldText';
import { tween, delay, Easings } from '@/systems/tween';
import { CANVAS_WIDTH } from '@/config/screen';

const TIER_CONFIG = {
  bigwin: {
    txtKey:    'sos2-bigwin:TXT_01_Big',
    flareKey:  'sos2-bigwin:FX/BigWin_Main_light',
    coinCount: 4,
    duration:  1200,
  },
  megawin: {
    txtKey:    'sos2-bigwin:TXT_01_Mega',
    flareKey:  'sos2-bigwin:FX/MegaWin_Main_light_01',
    coinCount: 8,
    duration:  2000,
  },
} as const;

interface CoinState {
  sprite: Sprite;
  vx: number;
  vy: number;
  birth: number;
}

const CEREMONY_Y = 400;          // upper-center, avoids reel main view
const COIN_FRAME_MS = 80;

/**
 * d-07: Non-JP BigWin / MegaWin ceremony — short, no full-screen dim.
 *
 * Caller awaits Promise; resolve = ceremony complete + cleanup done.
 * Distinct from j-04 JackpotCeremony: no dim bg, no wings, no shine,
 * shorter duration, upper position. Avoids visual competition with JP.
 */
export async function playBigWinCeremony(
  parent: Container,
  tier: 'bigwin' | 'megawin',
  amount: number,
): Promise<void> {
  const cfg = TIER_CONFIG[tier];

  const root = new Container();
  root.zIndex = 2200;          // below JP 2500, above HUD 1100
  parent.addChild(root);

  // Flare (behind text)
  const flare = FXAtlas.sprite(cfg.flareKey);
  flare.x = CANVAS_WIDTH / 2;
  flare.y = CEREMONY_Y;
  flare.alpha = 0;
  flare.scale.set(0.5);
  root.addChild(flare);

  // Tier text
  const txt = FXAtlas.sprite(cfg.txtKey);
  txt.x = CANVAS_WIDTH / 2;
  txt.y = CEREMONY_Y;
  txt.alpha = 0;
  txt.scale.set(0.5);
  root.addChild(txt);

  // Amount text
  const amountText = goldText(`NT$${Math.floor(amount).toLocaleString()}`, {
    fontSize: 36, withShadow: true,
  });
  amountText.anchor.set(0.5, 0.5);
  amountText.x = CANVAS_WIDTH / 2;
  amountText.y = CEREMONY_Y + 80;
  amountText.alpha = 0;
  amountText.filters = [new GlowFilter({
    color: 0xFFD37A, distance: 12, outerStrength: 1.5, innerStrength: 0.4,
  })];
  root.addChild(amountText);

  // Coin shower
  const coinKeys = Array.from({ length: 9 }, (_, i) =>
    `sos2-bigwin:Coin/Coin_0${i + 1}`,
  );
  const coinTextures = coinKeys.map(k => FXAtlas.sprite(k).texture);
  const coins: CoinState[] = [];
  const start = performance.now();
  const spawnCoin = () => {
    const c: CoinState = {
      sprite: new Sprite(coinTextures[0]),
      vx: (Math.random() - 0.5) * 10,
      vy: -6 - Math.random() * 4,
      birth: performance.now(),
    };
    c.sprite.anchor.set(0.5);
    c.sprite.x = CANVAS_WIDTH / 2;
    c.sprite.y = CEREMONY_Y;
    c.sprite.scale.set(0.4 + Math.random() * 0.3);
    root.addChild(c.sprite);
    coins.push(c);
  };

  // Stage 1: flare + text fade-in (250ms)
  const fadeFlare = tween(250, t => {
    flare.alpha = t;
    flare.scale.set(0.5 + t * 0.5);
  }, Easings.easeOut);
  const fadeTxt = tween(250, t => {
    txt.alpha = t;
    txt.scale.set(0.5 + t * 0.6 + 0.08 * Math.sin(Math.PI * t));   // overshoot
  }, Easings.easeOut);
  await Promise.all([fadeFlare, fadeTxt]);

  // Stage 2: amount fade-in (200ms)
  void tween(200, t => { amountText.alpha = t; }, Easings.easeOut);

  // Stage 3: coin shower spawn over 400ms
  const spawnInterval = 400 / cfg.coinCount;
  for (let i = 0; i < cfg.coinCount; i++) {
    setTimeout(spawnCoin, i * spawnInterval);
  }

  // Stage 4: ticker drives physics + frame cycle
  const ticker = Ticker.shared;
  const tickFn = (tk: Ticker) => {
    const dt = tk.deltaTime;
    const now = performance.now();
    for (const c of coins) {
      c.vy += 0.4 * dt;
      c.sprite.x += c.vx * dt;
      c.sprite.y += c.vy * dt;
      const age = now - c.birth;
      const frameIdx = Math.floor(age / COIN_FRAME_MS) % 9;
      c.sprite.texture = coinTextures[frameIdx];
      const remaining = cfg.duration - (now - start);
      if (remaining < 400) c.sprite.alpha = Math.max(0, remaining / 400);
    }
  };
  ticker.add(tickFn);

  // Hold remaining time
  await delay(cfg.duration - 250);

  // Stage 5: fade out (300ms)
  await tween(300, t => { root.alpha = 1 - t; }, Easings.easeIn);

  // Cleanup
  ticker.remove(tickFn);
  root.destroy({ children: true });
}
```

**Commit 1**: `feat(d-07a): BigWinCeremony module — BigWin tier`
**Commit 2**: `feat(d-07b): MegaWin tier added (TIER_CONFIG entry)`

### 3b. BattleScreen integration

加 import：

```ts
import { playBigWinCeremony } from '@/fx/BigWinCeremony';
```

加 class 常數（near other thresholds）：

```ts
private static readonly BIGWIN_THRESHOLD_X  = 25;   // 25x bet → BigWin
private static readonly MEGAWIN_THRESHOLD_X = 100;  // 100x bet → MegaWin
```

在 loop() 內，**streak/resonance 計算完、damage settle 前**（line ~660 之後、distributeDamage 之前），**或 Promise.all(fx) 之後**選一處（建議後者，讓 wayHit highlight 先播完才接 BigWin overlay）：

```ts
// d-07: Non-JP BigWin / MegaWin overlay (after wayHit + dmg fx)
const bigwinTierA = this._classifyBigWinTier(coinA, this.cfg.betA);
const bigwinTierB = this._classifyBigWinTier(coinB, this.cfg.betB);
// Pick higher tier (max one ceremony per spin to avoid stacking)
const bigwinTier =
  (bigwinTierA === 'megawin' || bigwinTierB === 'megawin') ? 'megawin' :
  (bigwinTierA === 'bigwin' || bigwinTierB === 'bigwin')   ? 'bigwin'  : null;
if (bigwinTier) {
  // Pick the side that triggered (higher coin) for amount display
  const amount = Math.max(coinA, coinB);
  await playBigWinCeremony(this.container, bigwinTier, amount);
  if (import.meta.env.DEV) console.log(`[BigWin] tier=${bigwinTier} amount=${amount}`);
}
```

加 helper：

```ts
private _classifyBigWinTier(coin: number, bet: number): 'bigwin' | 'megawin' | null {
  if (bet <= 0) return null;
  const x = coin / bet;
  if (x >= BattleScreen.MEGAWIN_THRESHOLD_X) return 'megawin';
  if (x >= BattleScreen.BIGWIN_THRESHOLD_X)  return 'bigwin';
  return null;
}
```

**Commit 3**: `feat(d-07c): BattleScreen integration — threshold detection + ceremony dispatch`

### 3c. 檔案範圍（嚴格）

**新增**：
- `src/fx/BigWinCeremony.ts`（new file ~140 lines）

**修改**：
- `src/screens/BattleScreen.ts`（+import + 2 static constants + 1 helper method + 1 dispatch block ~25 行）

**禁止**：
- JackpotCeremony.ts（j-04 鎖定）
- main.ts atlas preload（已 OK）
- LoadingScreen（不需新 preload）
- DesignTokens
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool
- scripts/sim-rtp.mjs（純視覺 PR，不改 sim）
- 加 SuperWin tier（JP 已蓋）
- 改 j-04 ceremony 邏輯
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **3 個 commit**（per `incremental-implementation`）
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle 跑數十 spin，自然觸發頻率：~3-5% spin 看到 BigWin、~0.5% 看到 MegaWin
   - 若耐心不夠，可手動把 `BIGWIN_THRESHOLD_X = 5` 暫時降低**只在本機測試**（commit 之前還原 25）
   - 看到 BigWin 時：頂部 (y=400) 文字 + 4 顆金幣，沒有全螢幕 dim，~1.2s 結束
   - MegaWin 時：同位置但更亮 + 8 顆金幣，~2s
   - **BigWin 與 JP ceremony 不會同時出現**（JP 走 j-04，BigWin 走 d-07，sequential await）
   - 截圖 1-2 張（最少 1 張 BigWin，若湊到 MegaWin 加 1 張）
5. **效能**：FPS 全程 ≥ 50（ceremony 期間 DevTools Performance）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖（BigWin / MegaWin）
- 是否手動降低 threshold 才測到 MegaWin
- BigWin 與 JP 觸發**順序衝突**有沒有發生（兩個都在 Promise.all 之後 await，理論上 sequential 不衝突）
- ticker leak 觀察
- Spec deviations：預期 0
- **Sprint 7 closure 確認**：PR body / Handoff 兩處標記「Sprint 7 COMPLETE — Demo Polish 4/4 — ready for Sprint 8 (Pitch Prep) or owner direction」
