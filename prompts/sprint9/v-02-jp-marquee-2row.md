# Sprint 9 · v-02 — JP marquee 2-row 重排（GRAND 獨佔上行 + MEGA/MAJOR 並列下行 + 天地人 tier 中文標籤）

## 1. Context

PR: **既有 `drawJackpotMarquee()` (line 476-512) 三 tier NT$ 數字並排**單列**。改成 mockup 風格：GRAND 獨佔頂行（大字），MEGA + MAJOR 並列底行（中字）。同時加入「天獎/地獎/人獎」中文 tier 標籤呼應 j-04 ceremony 既有用語。**

Why: Sprint 8 試玩 + mockup review，owner feedback 第 1 條「視覺升級」對應 mockup `high_quality_mockup.html` line 498-520 的 jackpot-area 排版 — Grand 獨佔上排是 slot 視覺常規（讓玩家**最大目標 always visible 最大字**）。當前 3 tier 一字排開沒有層次感。

設計：

### 視覺結構（mockup line 498-520 對應）

```
┌─────────────────────────────────────┐  JP_AREA_Y = 138
│         天獎  GRAND                  │  ← row 1 (~38% of total H)
│      NT$ 5,000,000                   │     大字 fontSize 28-30
├─────────────────────────────────────┤
│  地獎 MAJOR  │   人獎 MINOR          │  ← row 2 (~62% of total H)
│ NT$ 500,000  │  NT$ 50,000           │     中字 fontSize 18-20
└─────────────────────────────────────┘  JP_AREA_Y + JP_AREA_H = 338
```

### 既有 JP_AREA_H = 200 拆分

```ts
const JP_GRAND_H = 70;    // 上行 GRAND（佔 35%）
const JP_BOTTOM_H = 130;  // 下行 MAJOR + MINOR（佔 65%）
```

### Tier 中文標籤（與 j-04 ceremony 對齊）

j-04 既有 `JackpotCeremony.TIER_CONFIG` 用：
- minor → `人獎 MINOR`
- major → `地獎 MAJOR`
- grand → `天獎 GRAND`

v-02 marquee 用同樣命名 — UX consistency。

### 三個 tier 視覺差異化

| Tier | Position | Font size | Glow strength |
|---|---|---|---|
| GRAND 天獎 | 全寬 row 1 | 30pt | outerStrength 2.5（最強） |
| MAJOR 地獎 | row 2 left half | 20pt | 1.5 |
| MINOR 人獎 | row 2 right half | 20pt | 1.5 |

### 配色

- GRAND text：`T.GOLD.base` + GlowFilter `0xFFD37A`（最金最亮）
- MAJOR text：`T.GOLD.base` + GlowFilter `0xC9A961`（深金）
- MINOR text：`T.GOLD.base` + GlowFilter `0xC9A961`（深金）
- Tier 中文標籤：`T.GOLD.shadow`（暗金，6-7pt 字）放在 NT$ 數字上方
- Row 1 / Row 2 之間用一條金色 hairline（1px alpha 0.3）分隔

### 既有 marquee asset 處理

當前 `'jp-marquee'` PNG sprite 是設計好的單列框 — 跟新 2-row 結構不符。**選項**：
- (A) **保留 marquee asset**，但只當作背景紋理，疊加新 2-row text（可能視覺紊亂）
- (B) **拿掉 marquee asset Sprite**，純 Graphics + Text 重畫 frame
- (C) **替換成 SOS2 atlas region**（jp-marquee 已是金色框，可換 sos2-bigwin atlas 的 `Frame_Base` 之類）

**建議 (B)** — 最乾淨。bg panel 既有 `roundRect(16, JP_AREA_Y, CANVAS_WIDTH - 32, JP_AREA_H)` 保留即可，純掉 sprite 改純 Graphics border。

---

## Skills suggested for this PR

- **`frontend-ui-engineering`** — Container hierarchy（marquee 整體放一個 sub-container 方便 z-order 管理）、GlowFilter 三 tier 用三個獨立 instance（避免 cross-talk）、tier label 跟數字各自 anchor 對齊。
- **`code-simplification`** — 既有 line 476-512 邏輯線性塞 6 個 addChild + 3 個 cache references → 重寫成清楚分組（row 1 / row 2）。**保留 3 個既有 class fields 名稱不改**（`jpMinorText / jpMajorText / jpGrandText`）— j-05 既有 `refreshJackpotMarquee()` + `pulseJackpotText()` 仍能 reuse。
- **`source-driven-development`** — Pixi 8 Text + GlowFilter pulse coexist 對照 既有 d-06 / r-04 / j-04 pattern。

---

## 2. Spec drift check (P6)

1. `mempalace_search "JP marquee 2-row reorganize tier 天地人 v-02"`
2. 確認 `drawJackpotMarquee()` line 476-512 結構
3. 確認 `j-05` 既有 `refreshJackpotMarquee()` 跟 `pulseJackpotText()` method 用 `jpMinorText/jpMajorText/jpGrandText` reference — **本 PR 必須保留這 3 個 class fields name**（不可重命名，否則 j-05 邏輯壞掉）
4. 確認 `JackpotCeremony.ts` `TIER_CONFIG.minor.label = '人獎 MINOR'` 等已存在 — v-02 沿用同 label 命名

## 3. Task

### 3a. 加 const

near 既有 const（line 45）：

```ts
const JP_GRAND_H = 70;
const JP_BOTTOM_H = JP_AREA_H - JP_GRAND_H;   // 130
```

### 3b. 改寫 `drawJackpotMarquee()` line 476-512

```ts
private drawJackpotMarquee(): void {
  // Background panel — opaque ink-wash dark blue, gold border
  const bgPanel = new Graphics()
    .roundRect(16, JP_AREA_Y, CANVAS_WIDTH - 32, JP_AREA_H, T.RADIUS.lg)
    .fill({ color: T.SEA.deep, alpha: 0.85 })
    .stroke({ width: 1.5, color: T.GOLD.shadow, alpha: 0.7 });
  this.container.addChild(bgPanel);

  // Hairline separator between row 1 (GRAND) and row 2 (MAJOR + MINOR)
  const sepY = JP_AREA_Y + JP_GRAND_H;
  const separator = new Graphics()
    .rect(40, sepY, CANVAS_WIDTH - 80, 1)
    .fill({ color: T.GOLD.shadow, alpha: 0.3 });
  this.container.addChild(separator);

  // Vertical separator between MAJOR and MINOR (in row 2)
  const vSepX = CANVAS_WIDTH / 2;
  const vSeparator = new Graphics()
    .rect(vSepX, sepY + 12, 1, JP_BOTTOM_H - 24)
    .fill({ color: T.GOLD.shadow, alpha: 0.3 });
  this.container.addChild(vSeparator);

  // ── Row 1: GRAND 天獎 (full-width, large) ───────────────────────────────
  const grandRowCenterY = JP_AREA_Y + JP_GRAND_H / 2;

  const grandLabel = new Text({
    text: '天獎  GRAND',
    style: {
      fontFamily: T.FONT.body, fontWeight: '700',
      fontSize: 11, fill: T.GOLD.shadow, letterSpacing: 4,
    },
  });
  grandLabel.anchor.set(0.5, 0.5);
  grandLabel.x = CANVAS_WIDTH / 2;
  grandLabel.y = grandRowCenterY - 14;
  this.container.addChild(grandLabel);

  this.jpGrandText = goldText('5,000,000', { fontSize: 30, withShadow: true });
  this.jpGrandText.anchor.set(0.5, 0.5);
  this.jpGrandText.x = CANVAS_WIDTH / 2;
  this.jpGrandText.y = grandRowCenterY + 12;
  this.jpGrandText.filters = [new GlowFilter({
    color: 0xFFD37A, distance: 14, outerStrength: 2.5, innerStrength: 0.5, quality: 0.4,
  })];
  this.container.addChild(this.jpGrandText);

  // ── Row 2: MAJOR 地獎 (left half) + MINOR 人獎 (right half) ─────────────
  const bottomRowCenterY = sepY + JP_BOTTOM_H / 2;
  const majorX = CANVAS_WIDTH * 0.25;
  const minorX = CANVAS_WIDTH * 0.75;

  const majorLabel = new Text({
    text: '地獎  MAJOR',
    style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 10, fill: T.GOLD.shadow, letterSpacing: 3 },
  });
  majorLabel.anchor.set(0.5, 0.5);
  majorLabel.x = majorX;
  majorLabel.y = bottomRowCenterY - 12;
  this.container.addChild(majorLabel);

  this.jpMajorText = goldText('500,000', { fontSize: 20, withShadow: true });
  this.jpMajorText.anchor.set(0.5, 0.5);
  this.jpMajorText.x = majorX;
  this.jpMajorText.y = bottomRowCenterY + 10;
  this.jpMajorText.filters = [new GlowFilter({
    color: 0xC9A961, distance: 10, outerStrength: 1.5, innerStrength: 0.4, quality: 0.4,
  })];
  this.container.addChild(this.jpMajorText);

  const minorLabel = new Text({
    text: '人獎  MINOR',
    style: { fontFamily: T.FONT.body, fontWeight: '700', fontSize: 10, fill: T.GOLD.shadow, letterSpacing: 3 },
  });
  minorLabel.anchor.set(0.5, 0.5);
  minorLabel.x = minorX;
  minorLabel.y = bottomRowCenterY - 12;
  this.container.addChild(minorLabel);

  this.jpMinorText = goldText('50,000', { fontSize: 20, withShadow: true });
  this.jpMinorText.anchor.set(0.5, 0.5);
  this.jpMinorText.x = minorX;
  this.jpMinorText.y = bottomRowCenterY + 10;
  this.jpMinorText.filters = [new GlowFilter({
    color: 0xC9A961, distance: 10, outerStrength: 1.5, innerStrength: 0.4, quality: 0.4,
  })];
  this.container.addChild(this.jpMinorText);
}
```

**注意**：既有 `jp-marquee` PNG sprite 載入 `Assets.get<Texture>('jp-marquee')` 跟 `Sprite` 創建（line 484-491）**整段刪除** — 純 Graphics + Text 替代。LoadingScreen 仍可保留 jp-marquee preload（不影響 build），後續可選 chore PR 清掉。

### 3c. 既有 j-05 邏輯**保留不動**

`refreshJackpotMarquee()` 跟 `pulseJackpotText()` 都用 3 個 class fields name，本 PR 不改 fields name，自然 reuse。

### 3d. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔（drawJackpotMarquee 改寫 + 2 const 加）

**禁止**：
- DesignTokens（用既有 T.GOLD / T.SEA / T.RADIUS / T.FONT — 0xFFD37A / 0xC9A961 是既有 j-04 / d-04 用過顏色，可硬寫）
- LoadingScreen（jp-marquee preload 可保留，不本 PR 清，避免 spec drift）
- JackpotCeremony.ts / JackpotPool.ts（j-04 / j-05 邏輯不動）
- SymbolsConfig / SlotEngine 等
- scripts/sim-rtp.mjs（純 UI PR）
- v-01 / v-03 / pace-01 / res-01 範疇
- 改 j-05 既有 refreshJackpotMarquee / pulseJackpotText method
- 重命名 jpMinorText / jpMajorText / jpGrandText 三個 class fields
- 加新 asset
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. 1 個 commit（純視覺重排）
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle，看到 marquee 上行只顯示「天獎 GRAND  5,000,000」大字
   - 下行兩半「地獎 MAJOR  500,000」+「人獎 MINOR  50,000」並列
   - 中央有金色細線分隔上下行 + 下行中央分隔線
   - 跑 ~10 spin 看 pool 累積（minor 漲最快 — j-05 既有邏輯不變）
   - 按 'J' 觸發 JP（DEV）→ 對應 tier 數字跳回 seed + 既有 pulseJackpotText shrink 效果仍動作
5. 截圖 1 張 marquee（最好 mid-game pool 累積中）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 既有 j-05 refresh / pulse 行為是否完整保留（grow on accrual / shrink on reset 兩種 pulse 都要還在）
- jp-marquee PNG sprite 拿掉後 LoadingScreen 是否有 warning（預期無，preload 失敗也 graceful）
- Spec deviations：預期 0
