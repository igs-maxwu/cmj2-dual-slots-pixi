# Sprint 9 · res-01 — 戰鬥結算畫面 ResultScreen（勝負 banner + 雙方統計 + 返回 Draft）

## 1. Context

PR: **新檔 `src/screens/ResultScreen.ts`，實作 `Screen` interface。BattleScreen.loop() 對戰結束後從原本「log winner + return」改成 `screenManager.show(new ResultScreen(...))` 跳結算畫面，顯示勝負 banner、雙方 wallet 終值、累計傷害、回合數，附 button 返回 DraftScreen。**

Why: Sprint 8 試玩 + mockup review 後 owner feedback 第 3 條：「**希望新增戰鬥結算畫面，顯示玩家的勝負與輸贏金額等資訊**」。當前 BattleScreen.loop() 結束只 log `>>> Player A WINS <<<` 然後 return，玩家沒看到正式的 result screen — 體感像「跑完就斷掉」，無 closure。新加 ResultScreen 給對戰一個正式落幕。

設計：

### ResultScreen 構造（720×1280 portrait）

```
┌─────────────────────────────────────┐  y=0
│         Top UI Bar (45px gradient)  │  ← 與 BattleScreen 視覺延續
├─────────────────────────────────────┤  y=45
│                                     │
│        勝利 / 失敗 / 平手             │  ← y~150 大型 banner
│        VICTORY / DEFEAT / DRAW      │     fontSize 64-72 + 強 GlowFilter
│                                     │
├─────────────────────────────────────┤
│   PLAYER A           PLAYER B       │  ← y~300 stats split
│   azure tint         vermilion tint │
│                                     │
│   錢包 NT$ X         錢包 NT$ Y      │
│   傷害 X             傷害 Y          │
│   勝率 W/L           勝率 W/L        │
│                                     │
├─────────────────────────────────────┤  y~700
│         回合數：N                    │  ← match summary
│         對戰時長：M:SS               │
├─────────────────────────────────────┤
│                                     │
│   ┌───────────────────┐             │
│   │   返回 DRAFT      │             │  ← y~1100 大型 button
│   └───────────────────┘             │
│                                     │
└─────────────────────────────────────┘  y=1280
```

### MatchResult interface（contract-first design）

```ts
export type MatchOutcome = 'A_WIN' | 'B_WIN' | 'A_OVERKILL' | 'B_OVERKILL' | 'DRAW';

export interface MatchResult {
  outcome: MatchOutcome;
  // Wallet
  walletA_start: number;
  walletA_end: number;
  walletB_start: number;
  walletB_end: number;
  // Damage cumulative
  dmgDealtAtoB: number;    // A 對 B 累計傷害
  dmgDealtBtoA: number;    // B 對 A 累計傷害
  // Match metadata
  roundCount: number;
  durationMs: number;
}
```

### 勝負 banner 文字 + 配色

| outcome | 中文大字 | 副字 | 主色 |
|---|---|---|---|
| A_WIN | **PLAYER A 勝利！** | VICTORY | T.CLAN.azureGlow |
| B_WIN | **PLAYER B 勝利！** | VICTORY | T.CLAN.vermilionGlow |
| A_OVERKILL | **PLAYER A 完勝！** | OVERKILL VICTORY | T.GOLD.base + 紅 outline |
| B_OVERKILL | **PLAYER B 完勝！** | OVERKILL VICTORY | T.GOLD.base + 紅 outline |
| DRAW | **平手** | DRAW | T.GOLD.shadow |

### 返回 Draft button

- 位置 y~1100，centered
- 大小 240×64，rounded 12
- 配色 gold gradient bg + 中文「返回 DRAFT」+ EN「Back to Draft」
- onClick → `this.onReturn()` callback

### BattleScreen 端整合

需要：
1. **追蹤雙方累計傷害**：新加 fields `totalDmgDealtAtoB` / `totalDmgDealtBtoA`，每 round 在 `dmgA / dmgB` 計算後 accumulate
2. **追蹤對戰開始時間**：`matchStartTime = performance.now()` 在 `onMount` 末尾或 `loop()` 開頭設置
3. **追蹤起始 wallet**：`startWalletA / startWalletB` 在 onMount 設
4. **既有 winner 計算邏輯** (line 1391-1408) 改成生成 `MatchResult` 物件
5. **替換 log + return** → `await screenManager.show(new ResultScreen(matchResult, this.onReturn))`

### ScreenManager access

- BattleScreen 既有 `goToDraft` callback（main.ts line 44 傳入）
- ResultScreen 也需要 `onReturn` callback — 直接 reuse 同一個 callback
- ScreenManager instance：BattleScreen 沒直接 reference，需從 main.ts 改 — 或讓 ResultScreen 由 BattleScreen owner 建構傳入

**簡化方案**：BattleScreen 既有 `private onReturn: () => void` (constructor 第二參數 `goToDraft`)。ResultScreen 的 `onReturn` callback 觸發即等同走 `goToDraft` flow。
- BattleScreen 跳 ResultScreen 的方式：**直接 constructor 收 ScreenManager reference**（最乾淨）— 但要改 main.ts 把 sm 傳給 BattleScreen
- **替代**：用 callback chain — BattleScreen 不直接 transition，把 result 透過 `onMatchEnd: (result) => void` callback 給 main.ts，由 main.ts 決定下一個 screen
- **最替代**：BattleScreen 既有 `goToDraft()` callback 改名 `onMatchEnd(result?: MatchResult)`，無 result 表 user click back，有 result 表 match 自然結束 → main.ts 處理跳 ResultScreen

**選項分析**：
- (A) BattleScreen 直接持 sm reference：簡單但耦合 sm 進入 screen，違背 ScreenManager 「screen 不知道 sm」設計（當前 LoadingScreen / DraftScreen 沒持 sm reference，只持 callback）
- (B) callback chain 從 main.ts orchestrate：保持解耦但要改 main.ts + signature 升級
- (C) BattleScreen 直接 import 並使用 ScreenManager 全域 singleton：簡單但破壞 DI

**推薦 (B)** — 與既有 pattern 對齊。main.ts 改：

```ts
const goToDraft = (): void => {
  sm.show(new DraftScreen((cfg: DraftResult) => {
    sm.show(new BattleScreen(cfg, (result?: MatchResult) => {
      if (result) {
        sm.show(new ResultScreen(result, goToDraft));
      } else {
        goToDraft();   // user back without result (e.g. ESC during match)
      }
    }));
  }));
};
```

BattleScreen constructor 第二參數 signature 升級：
- 舊：`(cfg, onReturn: () => void)`
- 新：`(cfg, onMatchEnd: (result?: MatchResult) => void)`

---

## Skills suggested for this PR

- **`api-and-interface-design`** — `MatchResult` interface 是 contract，定下後 BattleScreen 跟 ResultScreen 都依此實作。考慮 versioning（未來加 MVP / 統計時不破壞 caller）。**禁止**讓 ResultScreen 直接 dependency BattleScreen（保持 screen 之間解耦）。
- **`frontend-ui-engineering`** — 新 screen 完整 onMount / onUnmount lifecycle，container 階層、destroy({children:true}) 紀律。Button onClick 用 Pixi 8 `eventMode: 'static'` + cursor pointer + 'pointertap' event。
- **`incremental-implementation`** — **3 commits**：(1) MatchResult interface + ResultScreen 純 file 第一版，(2) BattleScreen tracking fields 加 + winner 計算改 MatchResult，(3) main.ts callback chain 升級 + 整合測試。

---

## 2. Spec drift check (P6)

1. `mempalace_search "result screen battle end MatchResult res-01 sprint 9"`
2. 確認 `Screen` interface in `ScreenManager.ts` (onMount / onUnmount)
3. 確認 main.ts line 42-46 既有 `goToDraft` callback chain
4. 確認 BattleScreen constructor signature `(cfg: BattleConfig, goToDraft: () => void)`（line 80 區）— 本 PR 升級此 signature
5. 確認 `isTeamAlive`, `teamHpTotal`, `lastDmgA / lastDmgB / lastPreHpA / lastPreHpB` 等變數已存在（line 1391-1408）

## 3. Task

### 3a. 新檔 `src/screens/ResultScreen.ts`

```ts
import { Application, Container, Graphics, Text } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import type { Screen } from './ScreenManager';
import { goldText } from '@/components/GoldText';
import * as T from '@/config/DesignTokens';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { tween, Easings } from '@/systems/tween';

export type MatchOutcome = 'A_WIN' | 'B_WIN' | 'A_OVERKILL' | 'B_OVERKILL' | 'DRAW';

export interface MatchResult {
  outcome: MatchOutcome;
  walletA_start: number;
  walletA_end:   number;
  walletB_start: number;
  walletB_end:   number;
  dmgDealtAtoB:  number;
  dmgDealtBtoA:  number;
  roundCount:    number;
  durationMs:    number;
}

const BANNER_LABELS: Record<MatchOutcome, { 中: string; en: string; color: number }> = {
  A_WIN:        { 中: 'PLAYER A 勝利！',   en: 'VICTORY',          color: T.CLAN.azureGlow },
  B_WIN:        { 中: 'PLAYER B 勝利！',   en: 'VICTORY',          color: T.CLAN.vermilionGlow },
  A_OVERKILL:   { 中: 'PLAYER A 完勝！',   en: 'OVERKILL VICTORY', color: T.GOLD.base },
  B_OVERKILL:   { 中: 'PLAYER B 完勝！',   en: 'OVERKILL VICTORY', color: T.GOLD.base },
  DRAW:         { 中: '平手',              en: 'DRAW',             color: T.GOLD.shadow },
};

export class ResultScreen implements Screen {
  private container = new Container();

  constructor(
    private result: MatchResult,
    private onReturn: () => void,
  ) {}

  async onMount(_app: Application, stage: Container): Promise<void> {
    stage.addChild(this.container);
    this.drawBackground();
    await this.drawBanner();           // 含 fade-in
    this.drawStatsPanel();
    this.drawMatchSummary();
    this.drawReturnButton();
  }

  async onUnmount(): Promise<void> {
    this.container.destroy({ children: true });
  }

  private drawBackground(): void {
    // Dark ink-wash full screen
    const bg = new Graphics()
      .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .fill({ color: 0x0D1421 });
    this.container.addChild(bg);

    // Golden vertical accent bar (left edge, consistent with deck/onepager)
    const goldBar = new Graphics()
      .rect(0, 0, 6, CANVAS_HEIGHT)
      .fill({ color: T.GOLD.base });
    this.container.addChild(goldBar);
  }

  private async drawBanner(): Promise<void> {
    const cfg = BANNER_LABELS[this.result.outcome];
    const banner = new Container();
    banner.x = CANVAS_WIDTH / 2;
    banner.y = 200;
    banner.alpha = 0;
    banner.scale.set(0.7);

    const mainText = goldText(cfg.中, { fontSize: 56, withShadow: true });
    mainText.anchor.set(0.5, 0.5);
    mainText.style.fill = cfg.color;
    mainText.filters = [new GlowFilter({
      color: cfg.color, distance: 18, outerStrength: 3, innerStrength: 0.5, quality: 0.4,
    })];
    banner.addChild(mainText);

    const subText = new Text({
      text: cfg.en,
      style: {
        fontFamily: T.FONT.body, fontWeight: '700', fontSize: 22,
        fill: T.GOLD.base, letterSpacing: 6,
      },
    });
    subText.anchor.set(0.5, 0.5);
    subText.y = 50;
    banner.addChild(subText);

    this.container.addChild(banner);

    // Fade-in + scale-up 400ms
    await tween(400, t => {
      banner.alpha = t;
      banner.scale.set(0.7 + 0.3 * t + 0.05 * Math.sin(Math.PI * t));
    }, Easings.easeOut);
  }

  private drawStatsPanel(): void {
    const panelY = 380;
    const colWidth = (CANVAS_WIDTH - 60) / 2;
    const colA_X = 30;
    const colB_X = CANVAS_WIDTH / 2 + 15;

    // Two side-by-side stat boxes
    this.drawStatColumn('A', colA_X, panelY, colWidth, T.CLAN.azureGlow);
    this.drawStatColumn('B', colB_X, panelY, colWidth, T.CLAN.vermilionGlow);
  }

  private drawStatColumn(side: 'A' | 'B', x: number, y: number, w: number, accent: number): void {
    const r = this.result;
    const wallet_start = side === 'A' ? r.walletA_start : r.walletB_start;
    const wallet_end   = side === 'A' ? r.walletA_end   : r.walletB_end;
    const dmgDealt     = side === 'A' ? r.dmgDealtAtoB  : r.dmgDealtBtoA;
    const dmgTaken     = side === 'A' ? r.dmgDealtBtoA  : r.dmgDealtAtoB;
    const walletDelta  = wallet_end - wallet_start;

    // Box bg
    const bg = new Graphics()
      .roundRect(x, y, w, 320, 14)
      .fill({ color: 0x000000, alpha: 0.5 })
      .stroke({ width: 2, color: accent, alpha: 0.7 });
    this.container.addChild(bg);

    // PLAYER label
    const label = new Text({
      text: `PLAYER ${side}`,
      style: {
        fontFamily: T.FONT.body, fontWeight: '700', fontSize: 16,
        fill: accent, letterSpacing: 4,
      },
    });
    label.anchor.set(0.5, 0);
    label.x = x + w / 2;
    label.y = y + 16;
    this.container.addChild(label);

    // Stats list
    const rows = [
      { 中: '錢包',     val: `${Math.round(wallet_end).toLocaleString()} NTD` },
      { 中: '輸贏',     val: `${walletDelta >= 0 ? '+' : ''}${Math.round(walletDelta).toLocaleString()} NTD`,
        color: walletDelta >= 0 ? 0x4ade80 : 0xff6b6b },
      { 中: '造成傷害', val: Math.round(dmgDealt).toLocaleString() },
      { 中: '承受傷害', val: Math.round(dmgTaken).toLocaleString() },
    ];

    let rowY = y + 60;
    for (const row of rows) {
      const labelTxt = new Text({
        text: row.中,
        style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 13, fill: 0xB8AC92 },
      });
      labelTxt.anchor.set(0, 0.5);
      labelTxt.x = x + 16;
      labelTxt.y = rowY;
      this.container.addChild(labelTxt);

      const valTxt = new Text({
        text: row.val,
        style: { fontFamily: T.FONT.num ?? T.FONT.body, fontWeight: '700', fontSize: 18,
                 fill: row.color ?? T.GOLD.base },
      });
      valTxt.anchor.set(1, 0.5);
      valTxt.x = x + w - 16;
      valTxt.y = rowY;
      this.container.addChild(valTxt);

      rowY += 60;
    }
  }

  private drawMatchSummary(): void {
    const r = this.result;
    const minutes = Math.floor(r.durationMs / 60000);
    const seconds = Math.floor((r.durationMs % 60000) / 1000);
    const summaryText = new Text({
      text: `回合數 ${r.roundCount}    對戰時長 ${minutes}:${seconds.toString().padStart(2, '0')}`,
      style: {
        fontFamily: T.FONT.body, fontWeight: '500', fontSize: 14,
        fill: 0xB8AC92, letterSpacing: 3,
      },
    });
    summaryText.anchor.set(0.5, 0);
    summaryText.x = CANVAS_WIDTH / 2;
    summaryText.y = 770;
    this.container.addChild(summaryText);
  }

  private drawReturnButton(): void {
    const btnW = 280, btnH = 72;
    const btnX = (CANVAS_WIDTH - btnW) / 2;
    const btnY = 1080;

    const bg = new Graphics()
      .roundRect(btnX, btnY, btnW, btnH, 14)
      .fill({ color: T.GOLD.base })
      .stroke({ width: 2, color: T.GOLD.shadow });
    bg.eventMode = 'static';
    bg.cursor    = 'pointer';
    bg.on('pointertap', () => this.onReturn());
    this.container.addChild(bg);

    const txt中 = new Text({
      text: '返回 DRAFT',
      style: {
        fontFamily: T.FONT.body, fontWeight: '700', fontSize: 22,
        fill: 0x0D1421, letterSpacing: 4,
      },
    });
    txt中.anchor.set(0.5, 0.5);
    txt中.x = btnX + btnW / 2;
    txt中.y = btnY + btnH / 2 - 6;
    this.container.addChild(txt中);

    const txtEn = new Text({
      text: 'Back to Draft',
      style: {
        fontFamily: T.FONT.body, fontWeight: '500', fontSize: 11,
        fill: 0x0D1421, letterSpacing: 2, fontStyle: 'italic',
      },
    });
    txtEn.anchor.set(0.5, 0.5);
    txtEn.x = btnX + btnW / 2;
    txtEn.y = btnY + btnH / 2 + 14;
    this.container.addChild(txtEn);
  }
}
```

**Commit 1**: `feat(res-01a): ResultScreen new file + MatchResult interface`

### 3b. BattleScreen — 追蹤統計 + 改 winner block

**新 class fields**：

```ts
private totalDmgDealtAtoB = 0;
private totalDmgDealtBtoA = 0;
private startWalletA = 0;
private startWalletB = 0;
private matchStartMs = 0;
```

**onMount**：

```ts
this.startWalletA = this.cfg.walletA;
this.startWalletB = this.cfg.walletB;
this.matchStartMs = performance.now();
```

**loop() 內 dmg 累計**（在既有 dmgA / dmgB 計算之後 + 進 distributeDamage 之前）：

```ts
this.totalDmgDealtAtoB += Math.max(0, dmgA);
this.totalDmgDealtBtoA += Math.max(0, dmgB);
```

**winner 計算改成生成 MatchResult**（line 1391-1413 替換）：

```ts
let outcome: MatchOutcome;
if (aAlive && !bAlive)        outcome = 'A_WIN';
else if (!aAlive && bAlive)   outcome = 'B_WIN';
else if (!aAlive && !bAlive) {
  const overkillA = Math.max(0, lastDmgA - lastPreHpB);
  const overkillB = Math.max(0, lastDmgB - lastPreHpA);
  if      (overkillA > overkillB) outcome = 'A_OVERKILL';
  else if (overkillB > overkillA) outcome = 'B_OVERKILL';
  else                             outcome = 'DRAW';
} else {
  outcome = 'DRAW';
}

const result: MatchResult = {
  outcome,
  walletA_start: this.startWalletA,
  walletA_end:   this.walletA,
  walletB_start: this.startWalletB,
  walletB_end:   this.walletB,
  dmgDealtAtoB:  this.totalDmgDealtAtoB,
  dmgDealtBtoA:  this.totalDmgDealtBtoA,
  roundCount:    this.round,
  durationMs:    performance.now() - this.matchStartMs,
};

this.onMatchEnd(result);   // ← 新 callback signature
```

**Commit 2**: `feat(res-01b): BattleScreen track stats + emit MatchResult on end`

### 3c. main.ts — callback chain 升級

```ts
import { ResultScreen, type MatchResult } from '@/screens/ResultScreen';

const goToDraft = (): void => {
  sm.show(new DraftScreen((cfg: DraftResult) => {
    sm.show(new BattleScreen(cfg, (result?: MatchResult) => {
      if (result) {
        sm.show(new ResultScreen(result, goToDraft));
      } else {
        goToDraft();
      }
    }));
  }));
};
```

**Commit 3**: `feat(res-01c): main.ts wire ResultScreen into screen chain`

### 3d. BattleScreen constructor signature 升級

舊：

```ts
constructor(public cfg: BattleConfig, private onReturn: () => void) {}
```

新：

```ts
import type { MatchResult } from '@/screens/ResultScreen';

constructor(public cfg: BattleConfig, private onMatchEnd: (result?: MatchResult) => void) {}
```

既有 BACK button 等位置原本 call `this.onReturn()` → 現在 call `this.onMatchEnd()`（無 result 等於玩家中途返回）。

### 3e. 檔案範圍（嚴格）

**新增**：
- `src/screens/ResultScreen.ts`（new file ~250 lines）

**修改**：
- `src/screens/BattleScreen.ts`（+5 fields + onMount tracking init + loop dmg accumulation + winner block → MatchResult emit + constructor signature）
- `src/main.ts`（callback chain 升級）

**禁止**：
- `Screen` interface in ScreenManager（既有契約不動）
- DraftScreen / LoadingScreen / FXPreviewScreen
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool
- 加新 asset
- DesignTokens 加新 token
- scripts/sim-rtp.mjs（純前端 PR）
- v-01 / v-02 / v-03 / pace-01 範疇
- SPEC.md
- ResultScreen 加進階功能（MVP spirit / dmg breakdown by symbol / etc — 留 future PR）

## 4. DoD

1. `npm run build` 過
2. **3 commits**（per `incremental-implementation`）：interface + screen / BattleScreen tracking / main.ts wiring
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle 跑一場到底（讓某側 HP 全歸 0）
   - 對戰結束 → 自動跳 ResultScreen
   - 看到對應 outcome 的 banner（VICTORY / DEFEAT / OVERKILL / DRAW）
   - 雙方 stats panel 顯示 wallet 終值 / 輸贏 / 傷害造成 / 傷害承受
   - Match summary 顯示回合數 + 時長
   - 點「返回 DRAFT」按鈕回到 DraftScreen，不 crash
   - **再玩一場**確認 stats reset 正確（不殘留前場數據）
5. 截圖 1 張 ResultScreen（mid-FX 後 banner + stats 都顯示）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 哪個 outcome 測試到（A_WIN / B_WIN / OVERKILL / DRAW）— 至少測 1 種，OVERKILL 較難自然觸發可選用 DEV 'F' 鍵或調整 pace-01 const 加速
- Stats 數字是否合理（dmg dealt + wallet delta 對得起來）
- 返回 DRAFT 後再進 Battle，stats 是否 reset（**critical** — 防 zombie state）
- Spec deviations：預期 0
