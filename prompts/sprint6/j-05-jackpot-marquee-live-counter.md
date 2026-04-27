# Sprint 6 · j-05 — JP marquee live counter（取代 hardcoded 50k/500k/5M，改讀 `this.jackpotPools` 動態顯示）

## 1. Context

PR: **BattleScreen 既有 `drawJackpotMarquee()` (line ~315) 三個 hardcoded NT$ 數字 (50,000 / 500,000 / 5,000,000) 改成 dynamic Text，每回合與每次 JP trigger 後讀取 `this.jackpotPools` 即時更新顯示。同時在數字明顯改變時做小幅 pulse / 顏色變化，讓玩家感受到「pool 在漲」。**

Why: Sprint 6 ROADMAP 收官項目。j-02 已加 pool 持久化、j-03 已賠付 + reset、j-04 已加 ceremony，但 marquee **還是固定數字** — 玩家看不到 pool 在累積也看不到 pool 被觸發後 reset。本 PR 補上這條線。**Sprint 6 最後一個 PR，完工後 Track J 5/5 + Track F 5/5 全收**。

設計：
- **動態文字**：3 個 Text 物件 cache 為 class field（`jpMinorText / jpMajorText / jpGrandText`），refresh method 每次呼叫時 set `text.text` 為當前 pool 值
- **格式化**：用 `Math.floor(amount).toLocaleString('en-US')`（與 wallet 一致），不顯示小數（pool 累積是分計，但 marquee 顯示整數）
- **更新時機**：3 處
  - onMount 內 `drawJackpotMarquee()` 之後立即 refresh 一次（顯示載入後的初始值）
  - loop() 每回合 accrual 後 refresh（pool 慢慢漲）
  - `detectAndAwardJackpot()` 在 `resetPool` 之後 + ceremony 之前 refresh（pool 從 award 跌回 seed，玩家看到「跳回」效果）
- **小 pulse 效果（選配）**：當 pool 增量 ≥ 1 NTD 時，做 1.0→1.05→1.0 的 120ms scale pulse；reset 時做 1.0→0.85→1.0 的 200ms 反向 pulse 暗示「被掏空」。**若覺得太雜，可省略，回歸純 set text**。

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — 動態 Text refresh、scale pulse 動畫、避免每回合呼叫造成 Text rebuild（save references、只 update `.text` property）。**特別注意**：Pixi 8 `Text.text =` setter 會 internally rebuild 字形，每回合 1 次無感，但若放 Ticker 內每幀 set 會卡。
- **`incremental-implementation`** — 兩 commit：(1) class field + refresh method + onMount/loop integration（純功能），(2) pulse 效果（選配）。每個都先 build 過。
- **`code-simplification`** — 既有 `drawJackpotMarquee()` line 332-345 是 for loop 一次建 3 個 Text，本 PR 拆成 3 段直寫並 cache 各自 reference，**理清結構不增加複雜度**。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Jackpot marquee live counter pool dynamic Sprint 6"`
2. 確認 BattleScreen.ts 有 `this.jackpotPools` field（j-02 加的）
3. 確認 `drawJackpotMarquee()` 在 line ~315，hardcoded 數字在 line ~334-336
4. 確認 j-04 PR #129 已 merge，`detectAndAwardJackpot()` + `playJackpotCeremony()` 都存在

## 3. Task

### 3a. Class fields

near 既有 wallet text fields（line ~85-90 區域）加：

```ts
/** JP marquee live counter texts (j-05) — dynamic from this.jackpotPools */
private jpMinorText!: Text;
private jpMajorText!: Text;
private jpGrandText!: Text;
```

### 3b. 改 `drawJackpotMarquee()` — 拆 for loop、cache references

既有：

```ts
// Line ~333-345:
const tiers: [number, string][] = [
  [CANVAS_WIDTH * 0.22, '50,000'],
  [CANVAS_WIDTH * 0.50, '500,000'],
  [CANVAS_WIDTH * 0.78, '5,000,000'],
];
for (const [x, val] of tiers) {
  const t = goldText(val, { fontSize: 22, withShadow: true });
  t.anchor.set(0.5, 0.5);
  t.x = x;
  t.y = numY;
  // ... addChild
}
```

改成：

```ts
const numY = JP_AREA_Y + JP_AREA_H / 2 + 14;

this.jpMinorText = goldText('50,000', { fontSize: 22, withShadow: true });
this.jpMinorText.anchor.set(0.5, 0.5);
this.jpMinorText.x = CANVAS_WIDTH * 0.22;
this.jpMinorText.y = numY;
this.container.addChild(this.jpMinorText);

this.jpMajorText = goldText('500,000', { fontSize: 22, withShadow: true });
this.jpMajorText.anchor.set(0.5, 0.5);
this.jpMajorText.x = CANVAS_WIDTH * 0.50;
this.jpMajorText.y = numY;
this.container.addChild(this.jpMajorText);

this.jpGrandText = goldText('5,000,000', { fontSize: 22, withShadow: true });
this.jpGrandText.anchor.set(0.5, 0.5);
this.jpGrandText.x = CANVAS_WIDTH * 0.78;
this.jpGrandText.y = numY;
this.container.addChild(this.jpGrandText);
```

### 3c. 新 method `refreshJackpotMarquee()`

```ts
/**
 * j-05: Refresh marquee NT$ text from current jackpotPools state.
 * Called after pool load (onMount), after each spin's accrual (loop),
 * and after JP win pool reset (detectAndAwardJackpot).
 */
private refreshJackpotMarquee(): void {
  this.jpMinorText.text = Math.floor(this.jackpotPools.minor).toLocaleString('en-US');
  this.jpMajorText.text = Math.floor(this.jackpotPools.major).toLocaleString('en-US');
  this.jpGrandText.text = Math.floor(this.jackpotPools.grand).toLocaleString('en-US');
}
```

### 3d. 三個 call sites

**(1) onMount**：在 `drawJackpotMarquee()` 之後、`this.jackpotPools = loadPools()` 之後即可呼叫（順序確認：先 loadPools 再 draw 再 refresh）。建議的 onMount 順序：

```ts
// existing:
this.jackpotPools = loadPools();
// ...other init...
this.drawJackpotMarquee();
// NEW:
this.refreshJackpotMarquee();   // immediately reflect loaded pools
```

**(2) loop() per-spin accrual 之後**：

```ts
// existing j-02:
if (totalBetThisSpin > 0) {
  this.jackpotPools = accrueOnBet(this.jackpotPools, totalBetThisSpin);
  savePools(this.jackpotPools);
}
// NEW:
this.refreshJackpotMarquee();
```

**(3) detectAndAwardJackpot — 在 pool reset 之後、ceremony 之前**：

```ts
// existing j-03:
this.jackpotPools = resetPool(this.jackpotPools, tier);
savePools(this.jackpotPools);
// NEW:
this.refreshJackpotMarquee();   // marquee shows reset value before ceremony plays
// existing j-04:
await playJackpotCeremony(this.container, tier, award);
```

### 3e. Pulse 效果（選配 — commit 2）

若覺得單純 text update 不夠醒目，加 pulse method：

```ts
private pulseJackpotText(text: Text, mode: 'grow' | 'shrink'): void {
  const target = mode === 'grow' ? 1.05 : 0.85;
  const dur    = mode === 'grow' ? 120 : 200;
  void tween(dur / 2, t => { text.scale.set(1 + (target - 1) * t); }, Easings.easeOut)
    .then(() => tween(dur / 2, t => { text.scale.set(target - (target - 1) * t); }, Easings.easeIn));
}
```

呼叫點：
- accrual refresh 內：若 minor/major/grand 任一 increased ≥ 1 NTD → pulse 'grow' 對應那個 Text
- reset refresh 內：對 reset 的 tier Text → pulse 'shrink'

**若 pulse 實作 >30 行 / 視覺太花 / 影響 FPS，跳過**（pure text update 也接受，這是選配）。

### 3f. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts` 唯一檔
  - +3 class fields
  - 改 drawJackpotMarquee 內 for loop 拆 3 段（淨變動 ~ +5 行）
  - +refreshJackpotMarquee method ~6 行
  - +pulseJackpotText method ~8 行（選配）
  - +3 個 call site 各 1 行

**禁止**：
- JackpotPool.ts / JackpotCeremony.ts（j-02/j-04 鎖定）
- main.ts / DraftScreen / LoadingScreen
- DesignTokens / GoldText component（用既有 goldText helper 即可）
- scripts/sim-rtp.mjs（純視覺 PR）
- SPEC.md
- 改 j-01 / j-02 / j-03 / j-04 / f-track 邏輯
- 加新 asset

## 4. DoD

1. `npm run build` 過
2. 1-2 個 commit（合併或分功能 + pulse 兩段都接受）
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle，marquee 三個數字一開始顯示 50,000 / 500,000 / 5,000,000（首次 install）
   - 跑 ~10 spin，看數字慢慢漲（minor 漲最快、grand 漲最慢，因 weight 50/30/20）
   - 按 'J' 觸發 JP（DEV，j-04 加的）→ 看 marquee 對應 tier 的數字「跳回 seed」（reset 視覺）
   - 重整 page → marquee 顯示 reload 後的 pool 值（持久化生效，j-02 鎖定）
5. **截圖**：1 張初始 / 1 張 ~50 spin 後 / 1 張 JP 觸發後（共 3 張）
6. **Sprint 6 Track J 5/5 + Track F 5/5 = Sprint 6 全收 flag**：PR body 結尾寫一行「**Sprint 6 COMPLETE — Track F 5/5 + Track J 5/5 — ready for Sprint 7 / Demo Polish & Pitch Prep**」

## 5. Handoff

- PR URL
- 1 行摘要
- 3 張截圖
- 是否做了 §3e pulse 效果（一句話）
- 任何 Text rebuild 性能觀察（frontend-ui-engineering skill 觸發）
- Spec deviations：預期 0
- **Sprint 6 closure 確認**：PR body / Handoff 兩處都標記 Sprint 6 COMPLETE，方便 orchestrator 寫 closing diary entry
