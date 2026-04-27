# Sprint 6 · j-04 — JP ceremony FX 全螢幕（SOS2 BigWin/MegaWin/SuperWin atlas + 三 tier 差異化）

## 1. Context

PR: **新建 `src/fx/JackpotCeremony.ts`，export `playJackpotCeremony(container, tier, amount): Promise<void>`。BattleScreen 既有 `showJackpotPlaceholder()`（j-03 加的 goldText 占位）替換成這個 module。三 tier 視覺差異化使用 SOS2 BigWin atlas 已 preloaded 的 region。**

Why: SPEC §15.8 M12 「JP 觸發顯示 ceremony 動畫」是 Sprint 6 exit gate 驗收項目之一。j-03 用 goldText 占位，本 PR 換成全螢幕 ceremony — 有 dim background、tier 文字 sprite、coin shower 動畫、NT$ 金額顯示。

Tier mapping（atlas region 既有區隔）：

| JP tier | SOS2 atlas region | Total duration | 額外裝飾 |
|---|---|---|---|
| Minor 人獎 | `TXT_01_Big`（BIGWIN）+ `FX/BigWin_Main_light` | ~3.0s | 8 顆 coin |
| Major 地獎 | `TXT_01_Mega`（MEGAWIN）+ `FX/MegaWin_Main_light_01` | ~4.0s | 16 coin + `Wing_L/R` |
| Grand 天獎 | `TXT_01_Super`（SUPERWIN）+ `FX/SuperWin_Main_light_01` | ~5.0s | 30 coin + Wings + `FX/Shine_02/03` + `FX/LightBall_02` |

Coin shower：所有 tier 共用 `Coin/Coin_01..09` frame sequence（9 frames，loop 播 ~80ms/frame = 720ms/cycle，多顆 coin 隨機 phase 出現）。

設計選擇：

### 模組化（Pixi-aware FX module）

新檔 `src/fx/JackpotCeremony.ts` 不 import BattleScreen，但 import Pixi + FXAtlas + DesignTokens + tween。Single export：

```ts
export async function playJackpotCeremony(
  container: Container,
  tier: 'grand' | 'major' | 'minor',
  amount: number
): Promise<void>
```

回傳 Promise resolve 表示 ceremony 結束、container 內所有 ceremony 物件 destroy 完畢。BattleScreen.loop() await 此 Promise 後再進下回合。

### Container hierarchy（cleanup-friendly）

```
ceremony root Container (zIndex 2500, anchored center)
├── dim bg (Graphics black 0.55 alpha)
├── light flare sprite
├── tier text sprite
├── coin shower Container (8/16/30 sprites)
├── decorative wings (major/grand only)
├── shine/lightball (grand only)
└── amount goldText (NT$X,XXX,XXX)
```

`ceremony root` 結束時統一 destroy({children:true})，零 leak。

### Coin shower 物理（隨機散射）

每個 coin sprite：
- 起始 (CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 100)
- 速度向量：random angle (-π/2 ± 60°)，random speed 5-12 px/frame
- gravity 0.4 px/frame²
- 透過 Ticker tick 更新位置；alpha 線性 fade over duration
- frame index `Math.floor(elapsed / 80) % 9` → 換 region texture（用 `FXAtlas.sprite()` 重建或 swap texture）

效率：用 swap texture（少建少 destroy），參考 BattleScreen line 1155 既有 fireJackpots pattern。

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Container hierarchy、zIndex 排序、tween cleanup、destroy({children:true}) 紀律。**特別注意**：Ticker callback 必須在 ceremony 結束時 `app.ticker.remove(callback)`，否則 zombie callback leak。
- **`incremental-implementation`** — 三 tier 漸進實作：先做 Minor（只有 text + coin，最簡）→ build 過 → Major（加 wings）→ Grand（加 shine + lightball）。每 tier 一個 commit。
- **`source-driven-development`** — Pixi.js 8 Ticker API（`app.ticker.add` 簽名變了，從 v7 的 `delta: number` 改成 v8 的 `ticker: Ticker`）對照官方 docs；Sprite texture swap 對照 FXAtlas.ts 既有 pattern（line 60-78）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Jackpot ceremony BigWin MegaWin SuperWin SOS2 atlas tier visual"`
2. 確認 `src/main.ts` line 34-37 sos2-bigwin atlas 在 app boot 已 preload — j-04 可直接 `FXAtlas.sprite()`，不需自己 load
3. 確認 BattleScreen.ts line 1155 既有 fireJackpots 用法 `FXAtlas.sprite('sos2-bigwin:${key}')` — j-04 沿用同 pattern
4. 確認 j-03 PR #128 已 merge，`detectAndAwardJackpot()` + `showJackpotPlaceholder()` 存在
5. 確認 `BigWin_Main_light` 等 region 確實在 atlas 內（用 `Read` 看 `public/assets/fx/sos2-bigwin.atlas` head 驗證 region name 拼字）

## 3. Task

### 3a. 新檔 `src/fx/JackpotCeremony.ts`

```ts
import { Container, Sprite, Graphics, Text, Ticker } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { FXAtlas } from '@/fx/FXAtlas';
import { goldText } from '@/components/GoldText';
import * as T from '@/config/DesignTokens';
import { tween, delay, Easings } from '@/systems/tween';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/screen';

const TIER_CONFIG = {
  minor: {
    txtKey:    'sos2-bigwin:TXT_01_Big',
    flareKey:  'sos2-bigwin:FX/BigWin_Main_light',
    coinCount: 8,
    duration:  3000,
    label:     '人獎 MINOR',
    hasWings:  false,
    hasShine:  false,
  },
  major: {
    txtKey:    'sos2-bigwin:TXT_01_Mega',
    flareKey:  'sos2-bigwin:FX/MegaWin_Main_light_01',
    coinCount: 16,
    duration:  4000,
    label:     '地獎 MAJOR',
    hasWings:  true,
    hasShine:  false,
  },
  grand: {
    txtKey:    'sos2-bigwin:TXT_01_Super',
    flareKey:  'sos2-bigwin:FX/SuperWin_Main_light_01',
    coinCount: 30,
    duration:  5000,
    label:     '天獎 GRAND',
    hasWings:  true,
    hasShine:  true,
  },
} as const;

interface CoinState {
  sprite: Sprite;
  vx: number;
  vy: number;
  birth: number;
}

/**
 * j-04: Full-screen JP ceremony driven by SOS2 BigWin atlas.
 *
 * Caller awaits the returned Promise; on resolve, the ceremony Container
 * is destroyed and removed from the parent.
 */
export async function playJackpotCeremony(
  parent: Container,
  tier: 'grand' | 'major' | 'minor',
  amount: number,
): Promise<void> {
  const cfg = TIER_CONFIG[tier];

  // Root
  const root = new Container();
  root.zIndex = 2500;
  parent.addChild(root);

  // Dim bg (full screen)
  const bg = new Graphics()
    .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    .fill({ color: 0x000000, alpha: 0.55 });
  bg.alpha = 0;
  root.addChild(bg);

  // Flare (behind text)
  const flare = FXAtlas.sprite(cfg.flareKey);
  flare.x = CANVAS_WIDTH / 2;
  flare.y = CANVAS_HEIGHT / 2 - 80;
  flare.alpha = 0;
  flare.scale.set(0.6);
  root.addChild(flare);

  // Tier text sprite
  const txt = FXAtlas.sprite(cfg.txtKey);
  txt.x = CANVAS_WIDTH / 2;
  txt.y = CANVAS_HEIGHT / 2 - 80;
  txt.alpha = 0;
  txt.scale.set(0.4);
  root.addChild(txt);

  // Wings (major/grand)
  let wingL: Sprite | null = null;
  let wingR: Sprite | null = null;
  if (cfg.hasWings) {
    wingL = FXAtlas.sprite('sos2-bigwin:Wing_L');
    wingR = FXAtlas.sprite('sos2-bigwin:Wing_R');
    wingL.x = CANVAS_WIDTH / 2 - 200;  wingL.y = CANVAS_HEIGHT / 2 - 80;
    wingR.x = CANVAS_WIDTH / 2 + 200;  wingR.y = CANVAS_HEIGHT / 2 - 80;
    wingL.alpha = wingR.alpha = 0;
    root.addChild(wingL);
    root.addChild(wingR);
  }

  // Shine + LightBall (grand only)
  let shine: Sprite | null = null;
  let lightBall: Sprite | null = null;
  if (cfg.hasShine) {
    shine = FXAtlas.sprite('sos2-bigwin:FX/Shine_02');
    shine.x = CANVAS_WIDTH / 2;  shine.y = CANVAS_HEIGHT / 2 - 80;
    shine.alpha = 0;
    root.addChildAt(shine, 1);   // behind flare
    lightBall = FXAtlas.sprite('sos2-bigwin:FX/LightBall_02');
    lightBall.x = CANVAS_WIDTH / 2;  lightBall.y = CANVAS_HEIGHT / 2 - 80;
    lightBall.alpha = 0;
    root.addChild(lightBall);
  }

  // Amount text (below)
  const amountText = goldText(`NT$${Math.floor(amount).toLocaleString()}`, {
    fontSize: 56, withShadow: true,
  });
  amountText.anchor.set(0.5, 0.5);
  amountText.x = CANVAS_WIDTH / 2;
  amountText.y = CANVAS_HEIGHT / 2 + 100;
  amountText.alpha = 0;
  amountText.filters = [new GlowFilter({ color: 0xFFD37A, distance: 16, outerStrength: 2, innerStrength: 0.5 })];
  root.addChild(amountText);

  // Coin shower
  const coinKeys = Array.from({ length: 9 }, (_, i) =>
    `sos2-bigwin:Coin/Coin_0${i + 1}`,
  );
  const coins: CoinState[] = [];
  // Stagger coin births over first 800ms
  const startTime = performance.now();
  const spawnCoin = () => {
    const c: CoinState = {
      sprite: FXAtlas.sprite(coinKeys[0]),
      vx: (Math.random() - 0.5) * 14,
      vy: -8 - Math.random() * 6,
      birth: performance.now(),
    };
    c.sprite.x = CANVAS_WIDTH / 2;
    c.sprite.y = CANVAS_HEIGHT / 2;
    c.sprite.scale.set(0.5 + Math.random() * 0.5);
    root.addChild(c.sprite);
    coins.push(c);
  };

  // Stage 1: bg + flare fade in (300ms)
  const fadeBg = tween(300, t => { bg.alpha = 0.55 * t; }, Easings.easeOut);
  const fadeFlare = tween(400, t => {
    flare.alpha = t;
    flare.scale.set(0.6 + 0.4 * t);
  }, Easings.easeOut);
  await Promise.all([fadeBg, fadeFlare]);

  // Stage 2: txt scale-up (300ms easeOut + slight overshoot)
  await tween(300, t => {
    txt.alpha = t;
    txt.scale.set(0.4 + 0.6 * t + 0.1 * Math.sin(Math.PI * t));
  }, Easings.easeOut);

  // Stage 3: wings + shine + lightball stagger
  if (cfg.hasWings && wingL && wingR) {
    void tween(400, t => { wingL!.alpha = t; wingR!.alpha = t; }, Easings.easeOut);
  }
  if (cfg.hasShine && shine && lightBall) {
    void tween(500, t => { shine!.alpha = 0.7 * t; lightBall!.alpha = t; }, Easings.easeOut);
  }

  // Stage 4: amount text fade-in (300ms)
  void tween(300, t => { amountText.alpha = t; }, Easings.easeOut);

  // Stage 5: coin shower — spawn over first 800ms
  const coinSpawnInterval = 800 / cfg.coinCount;
  for (let i = 0; i < cfg.coinCount; i++) {
    setTimeout(spawnCoin, i * coinSpawnInterval);
  }

  // Stage 6: ticker drives coin physics + frame animation
  const ticker = Ticker.shared;
  const tickFn = (tk: Ticker) => {
    const dt = tk.deltaTime;
    const now = performance.now();
    for (const c of coins) {
      c.vy += 0.4 * dt;
      c.sprite.x += c.vx * dt;
      c.sprite.y += c.vy * dt;
      const age = now - c.birth;
      const frameIdx = Math.floor(age / 80) % 9;
      const tex = FXAtlas.sprite(coinKeys[frameIdx]).texture;
      c.sprite.texture = tex;
      // Fade out near end
      const remaining = cfg.duration - (now - startTime);
      if (remaining < 600) c.sprite.alpha = Math.max(0, remaining / 600);
    }
  };
  ticker.add(tickFn);

  // Hold ceremony for the rest of duration (already used ~700ms in stages 1-2)
  await delay(cfg.duration - 700);

  // Stage 7: fade out everything (500ms)
  await tween(500, t => {
    root.alpha = 1 - t;
  }, Easings.easeIn);

  // Cleanup: remove ticker, destroy root (children with textures recycled by atlas)
  ticker.remove(tickFn);
  root.destroy({ children: true });
}
```

### 3b. BattleScreen.ts integration

**imports** 加：

```ts
import { playJackpotCeremony } from '@/fx/JackpotCeremony';
```

**替換** 既有 `showJackpotPlaceholder()` method **整段刪除**。在 `detectAndAwardJackpot()` 內把：

```ts
// j-03:
await this.showJackpotPlaceholder(tier, award);
```

換成：

```ts
// j-04:
await playJackpotCeremony(this.container, tier, award);
```

### 3c. 檔案範圍（嚴格）

**新增**：
- `src/fx/JackpotCeremony.ts`（new file ~150 lines）

**修改**：
- `src/screens/BattleScreen.ts`（+import + 替換 1 行 await call + 刪除整段 showJackpotPlaceholder method ~20 行 → 淨變動約 -15 行）

**禁止**：
- JackpotPool.ts / SymbolsConfig / SlotEngine
- DraftScreen / LoadingScreen / GemMapping
- main.ts（atlas preload 已存在，本 PR 不動）
- 改 j-01 / j-02 / j-03 邏輯（特別是 detectAndAwardJackpot 內的賠付 / reset 邏輯）
- scripts/sim-rtp.mjs（純視覺 PR）
- 加新 atlas 檔（用既有 sos2-bigwin）
- SPEC.md
- DEV 'J' force trigger（j-03 prompt 標記選配，本 PR 不需）

## 4. DoD

1. `npm run build` 過
2. **3 個 commit**（per `incremental-implementation` skill）：
   - (1) JackpotCeremony.ts new module — Minor tier only（最簡），build 過
   - (2) Major tier wings 加入
   - (3) Grand tier shine + lightball 加入 + BattleScreen integration
3. push + PR URL
4. **Preview 驗證（DEV 'J' 鍵 — 本 PR 加上以方便 demo）**：
   - 進 Battle，按 'J' 鍵走 DEV manual trigger（**本 PR 加 'J' keypress**：`if (DEV) on('J')` → 抽 tier、call `playJackpotCeremony`）
   - 連按 'J' 三次（每次抽不同 tier 的機會），各看一次三 tier 視覺差異
   - 截圖 3 張：每 tier 的 ceremony 中段
5. **效能**：ceremony 期間 FPS ≥ 50（DevTools Performance tab 觀察）

## 5. Handoff

- PR URL
- 1 行摘要
- 3 張截圖（minor / major / grand 各一）
- 是否有 atlas region 名稱拼字錯誤（FXAtlas throw 過嗎）
- DEV 'J' 鍵實測抽到的 tier 分布（按 10 次大概多少 minor/major/grand）— 用來 sanity check Math.random 跟 j-03 的 3/12/85 邏輯
- ceremony 期間 FPS 觀察
- 任何 Pixi 8 Ticker API（v7→v8 簽名變化）卡到的地方（source-driven-development skill 觸發）
- Spec deviations：預期 0
