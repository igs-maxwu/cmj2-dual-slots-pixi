# Sprint 10 · p10-v03 — Gold budget 收尾（corner ornament alpha + JP border 去金 + 細節）

## 1. Context

PR: **p10-v01 跟 p10-v02 已搬 Variant B layout 跟 cell polish。本 PR 收尾 the-stylist audit P1-C「8 個金色 accent 競爭」剩下的去金項目 — 主要是 corner ornament alpha 降低 + JP marquee 外邊框從 gold 改 sea-mid。**

Why: P1-C 推薦的 gold budget = 簡同時 ≤ 3 個 gold-emitting elements。當前狀態：
- ✅ 已去：title、JP Major/Minor GlowFilter、log text 改 cream（v-01 完成）
- ⏳ **本 PR 處理**：corner ornament alpha + JP outer border + JP 內部分隔線

剩下的金 = JP Grand glow + reel frame + ROUND pill = **3 個 gold focal points**（命中 budget）。

設計（精準的 alpha + color 改動）：

| 元素 | 檔案:line | 既有 | 改成 |
|---|---|---|---|
| BattleScreen corner ornament call | `BattleScreen.ts:233` | `addCornerOrnaments(..., 130, 0.55)` | `addCornerOrnaments(..., 130, 0.25)` |
| SlotReel dragon-corner sprite alpha | `SlotReel.ts:~99-107` | implicit alpha = 1.0 | `corner.alpha = 0.30` |
| JP marquee outer border | `BattleScreen.ts:684` | `stroke({ color: T.GOLD.shadow, alpha: 0.5 })` | `stroke({ color: T.SEA.mid, alpha: 0.6 })` |
| JP vDiv (vertical divider) | `BattleScreen.ts:691` | `T.GOLD.shadow alpha 0.3` | `T.SEA.mid alpha 0.4` |
| JP hHair (horizontal hairline) | `BattleScreen.ts:726` | `T.GOLD.shadow alpha 0.2` | `T.SEA.mid alpha 0.3` |

**注意**：JP Grand 的 GlowFilter 保留（`outerStrength: 2.0` line 710）— 它是 budget 的 3 個 gold 之一（**主要**）。

---

## Skills suggested for this PR

- **`code-simplification`** — 純 colour/alpha tuning，5 行精準改動。**禁止**任何 layout 變更（layout 是 v-01 工作）。
- **`source-driven-development`** — `T.SEA.mid` 已 grep 確認存在於 DesignTokens line 24（`0x1b5a8a` blue-grey）。Audit P1-C 推薦此 token。

---

## 2. Spec drift check (P6)

1. `mempalace_search "gold budget P1-C corner ornament JP border sea mid p10-v03"`
2. 確認 BattleScreen.ts line 233 addCornerOrnaments 呼叫存在（**executor 用 grep 找精準 line**）
3. 確認 SlotReel.ts line 88-108 dragon-corner sprite 創建 4 個 corner 的 for loop 仍存在（p10-bug-01 後）
4. 確認 BattleScreen.ts `drawJackpotMarquee()` line 670+ 結構（v-01 後 thin strip 版本）
5. 確認 `T.SEA.mid` 存在於 DesignTokens（grep 已驗）

## 3. Task

### 3a. BattleScreen — corner ornament alpha 0.55 → 0.25

`src/screens/BattleScreen.ts` line 233：

```ts
addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 130, 0.55);
```

改成：

```ts
addCornerOrnaments(this.container, CANVAS_WIDTH, CANVAS_HEIGHT, 130, 0.25);
```

**Commit 1**: `tune(p10-v03a): corner ornament alpha 0.55→0.25 (de-gold P1-C)`

### 3b. SlotReel — dragon-corner sprite 加 alpha 0.30

`src/screens/SlotReel.ts` 在 dragon-corner sprite for loop（既有）內，每個 sprite 創建後加：

```ts
const corner = new Sprite(cornerTex);
corner.anchor.set(ax, ay);
corner.width = 120;
corner.height = 120;
corner.x = x;
corner.y = y;
corner.scale.x = Math.sign(sx) * Math.abs(corner.scale.x);
corner.scale.y = Math.sign(sy) * Math.abs(corner.scale.y);
corner.alpha = 0.30;   // p10-v03: de-gold P1-C
this.addChild(corner);
```

**注意**：此 alpha 只 apply 到 dragon-corner sprite 路徑（asset loaded path），**不需動 fallback path（programmatic L-bracket）** — fallback 已是 `alpha: 0.7` 的 stroke，且很少出現（asset 載入了就走 sprite path）。

**Commit 2**: `tune(p10-v03b): dragon-corner sprite alpha 0.30 (de-gold P1-C)`

### 3c. BattleScreen — JP marquee 外邊框 + 內部分隔線去金

`drawJackpotMarquee()` 內三處：

**Outer panel border** (line 684)：
```ts
.stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.5 });
```
改成：
```ts
.stroke({ width: 1, color: T.SEA.mid, alpha: 0.6 });
```

**Vertical divider** (line 691)：
```ts
.fill({ color: T.GOLD.shadow, alpha: 0.3 });
```
改成：
```ts
.fill({ color: T.SEA.mid, alpha: 0.4 });
```

**Horizontal hairline** (line 726)：
```ts
.fill({ color: T.GOLD.shadow, alpha: 0.2 });
```
改成：
```ts
.fill({ color: T.SEA.mid, alpha: 0.3 });
```

**Commit 3**: `tune(p10-v03c): JP marquee borders gold→sea-mid (de-gold P1-C)`

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（2 處：corner alpha + JP marquee 3 colour 改動）
- `src/screens/SlotReel.ts`（1 處：corner.alpha = 0.30）

**禁止**：
- DesignTokens（用既有 T.SEA.mid，**禁加新 token**）
- Layout 變動（v-01 工作 — 不動 zone y/x）
- Cell 視覺（v-02 工作 — 不動 gem fill / pip / inner ring）
- p10-bug-01 既有 fallback 路徑（不動 L-bracket alpha）
- ROUND pill 簡化（P2-B audit 項，本 PR 不做 — 留 future micro-PR）
- JP Grand GlowFilter 移除（**保留** — 是 3 個 gold budget 之一）
- 加新 asset
- scripts/sim-rtp.mjs / SPEC.md
- 其他 audit 項（P1-A/B/D/E、P2-* 已在前序 PR 處理或不在本 PR scope）

## 4. DoD

1. `npm run build` 過
2. **3 個 commits**（per `incremental-implementation` — corner alpha / dragon-corner alpha / JP border 三段獨立 fix）
3. push + PR URL
4. **Preview 驗證**（前後對比）：
   - 4 個畫面 corner 的金色裝飾**明顯變淡**（0.55→0.25 = ~55% 亮度降）
   - Reel 4 個 dragon corner 變得較**低調**（從幾乎全亮 → 30% alpha）
   - JP marquee 外框從**金邊**變**藍灰邊**（subtle 但明顯）
   - JP marquee 內部分隔線（垂直 + 水平）也變藍灰 tone
   - **JP Grand 數字仍然發金光**（GlowFilter 保留）— 這是視覺焦點
   - **Reel ornate frame 仍然金**（未動）— 視覺焦點 2
   - **ROUND pill 仍然金**（未動）— 視覺焦點 3
5. 截圖 1 張（看 gold budget 命中 ≤ 3 — Grand glow / reel frame / ROUND pill）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（前後對比可選）
- Gold budget 估算：螢幕同時可見的 gold-emitting elements 數量（目標 ≤ 3）
- 任何視覺**過度去金**（變得太冷 / 太藍灰）的觀察 — 若有，flag tweaking value
- Spec deviations：預期 0
