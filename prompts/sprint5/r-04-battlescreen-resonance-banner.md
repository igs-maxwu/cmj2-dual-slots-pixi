# Sprint 5 · r-04 — BattleScreen 開戰時 Resonance 橫幅

## 1. Context

PR: **進入 BattleScreen 時若 A 側有 Resonance，短暫浮現橫幅 `♪ 青龍共鳴 ×1.5` 提示玩家**

Why: r-02/r-03 已加 Resonance 數值 + DraftScreen HUD，但戰場開打沒「儀式感」— 玩家進入 Battle 後沒任何提示說「你這場有 ×1.5 加成」。本 PR 補一個 1.5 秒的金色橫幅。

設計：
- 進 BattleScreen 後，FXAtlas preload 完成 + overlay 消失之後 700ms，浮現橫幅
- 橫幅內容隨 tier 不同：
  - SOLO[clan]：`♪ {clan中文}共鳴 ×1.5`
  - DUAL[clan1, clan2]：`♪ {clan1中文} × {clan2中文} 雙重共鳴 ×1.5`
  - NONE：不顯示
- 動畫：fade-in 200ms → hold 1000ms → fade-out 300ms（總 1.5 秒）
- 位置：螢幕中央偏上 y=380（戰場上方，不擋雀靈）
- 樣式：金色 GoldText + 中度 GlowFilter

Source:
- PR #105 r-01 `detectResonance` 結果在 `this.resonanceA`
- PR #107 r-02 已預算進 onMount
- BattleScreen.onMount 既有 overlay teardown 流程
- DesignTokens `T.GOLD.glow / T.CLAN.{azure/white/vermilion/black}`

Base: master HEAD（k-04 merged）
Target: `feat/sprint5-r-04-resonance-banner`

## 2. Spec drift check (P6)

1. 確認 BattleScreen 有 `this.resonanceA` field（PR #107 加的）
2. 確認 import.meta.env.DEV gate 不需用（這是正式 feature）
3. 中文 clan 名 mapping：`T.CLAN_META[clanId].cn` 已存在（c-01 加的）

## 3. Task

### 3a. 加 method `playResonanceBanner()`

```ts
import * as T from '@/config/DesignTokens';
import { tween, delay, Easings } from '@/systems/tween';

private async playResonanceBanner(): Promise<void> {
  if (this.resonanceA.tier === 'NONE') return;

  const meta = T.CLAN_META;
  let bannerText: string;
  if (this.resonanceA.tier === 'SOLO') {
    const clan = this.resonanceA.boostedClans[0];
    bannerText = `♪ ${meta[clan].cn} 共鳴  ×1.5`;
  } else {
    // DUAL
    const c1 = this.resonanceA.boostedClans[0];
    const c2 = this.resonanceA.boostedClans[1];
    bannerText = `♪ ${meta[c1].cn} × ${meta[c2].cn}  雙重共鳴  ×1.5`;
  }

  const banner = goldText(bannerText, { fontSize: T.FONT_SIZE.h2, withShadow: true });
  banner.anchor.set(0.5, 0.5);
  banner.x = CANVAS_WIDTH / 2;
  banner.y = 380;
  banner.alpha = 0;
  banner.zIndex = 1000;
  this.container.addChild(banner);

  // Fade-in 200ms
  await tween(200, t => { banner.alpha = t; }, Easings.easeOut);
  // Hold 1000ms
  await delay(1000);
  // Fade-out 300ms
  await tween(300, t => { banner.alpha = 1 - t; }, Easings.easeIn);

  banner.destroy();
}
```

### 3b. onMount 整合

在 onMount 既有「overlay teardown 後、`AudioManager.init()` 之前」位置，加：

```ts
// Show resonance banner if applicable (fire-and-forget — don't block AudioManager init)
this.playResonanceBanner();   // intentionally not awaited
```

或 await 完再 init audio — 取決於想不想讓 audio 與橫幅同時。建議**不 await**（fire-and-forget），讓 BGM 立刻響、橫幅自浮自消。

### 3c. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔。

**禁止**：
- Resonance.ts / 其他 systems
- DesignTokens（既有 token 用）
- DraftScreen
- SPEC.md
- 加新 asset（純 goldText + tween）

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL
4. **Preview 驗證**：
   - SOLO config（默認 [0,1,2,3,4]）→ 進 Battle 看到「青龍 共鳴 ×1.5」浮現 + 消失
   - DUAL config 換 draft 試（例如 RANDOM 5+5 跑幾次直到 DUAL）→ 看「白虎 × 朱雀 雙重共鳴」橫幅
   - 截圖至少 1 張橫幅顯示時刻

## 5. Handoff

- PR URL
- 1 行摘要
- 截圖（橫幅顯示中）
- DUAL 配置是否有測到（若難湊到，講明）
- Spec deviations：預期 0
