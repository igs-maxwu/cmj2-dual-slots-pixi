# Chore #217 — PAYLINES indicator 重新定位（避開 reel 重疊）

## 1. Context

Owner 試玩 2026-05-06 反映：「這 PAYLINES 的圖示跟盤面重疊了，請幫它規畫更好的位置」。

### 現況分析

[BattleScreen.ts:79](src/screens/BattleScreen.ts#L79) `PAYLINES_Y = 935` — 但 reel 區域：
- `REEL_ZONE_Y = 615` ([BattleScreen.ts:60](src/screens/BattleScreen.ts#L60))
- `REEL_H = 3*100 + 2*8 + 16*2 = 348` ([SlotReel.ts:21-24](src/screens/SlotReel.ts#L21))
- Reel **下緣 = 615 + 348 = 963**

→ PAYLINES 在 y=935 落在 **reel 內部 28px 處**（最下排 gem 上方），文字+10 個 cell 都跟 gem 重疊。

### 螢幕 vertical layout (720×1280)

| 元素 | y range | 高 |
|---|---|---|
| Compact header (ROUND / wallet) | 0-COMPACT_HDR_H | ~60 |
| JP marquee | JP_MARQUEE_Y..+H | ~80 |
| Formation A/B (5-row zigzag) | 320-560 | 240 |
| Reel header strip (chore: dot strip) | 587-609 | 22 |
| **REEL** (5×3 cells + frame) | **615-963** | **348** |
| (gap) | 963-970 | **7** ← 太窄塞 PAYLINES |
| SPIN / AUTO / SKIP buttons | 970-1030 | 60 |
| **(gap)** | **1030-1055** | **25** ← 適合放 PAYLINES |
| LOG panel | 1055+ | ~200 |

### 結論

把 PAYLINES_Y 從 **935** 改 **1042**（SPIN button 下緣 1030 + 12px breathing；indicator 中心在 1042，cell -7..+7 → 1035..1049，剛好落在 gap 中央）。

純座標調整 — 不動 indicator 結構 / cell size / label / updatePaylinesIndicator 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 改 1 const

---

## 2. Spec drift check (P6)

1. 確認 [`BattleScreen.ts:79`](src/screens/BattleScreen.ts#L79) `PAYLINES_Y = 935`
2. 確認 [`BattleScreen.ts:60`](src/screens/BattleScreen.ts#L60) `REEL_ZONE_Y = 615`
3. 確認 [`SlotReel.ts:21-24`](src/screens/SlotReel.ts#L21) reel cell sizes 不動
4. 確認 [`BattleScreen.ts:63`](src/screens/BattleScreen.ts#L63) `LOG_Y = 1055`
5. 確認 [`BattleScreen.ts:70`](src/screens/BattleScreen.ts#L70) `SPIN_BTN_Y = 970` + line 71 `SPIN_BTN_H = 60` → SPIN 下緣 1030
6. 確認 `drawPaylinesIndicator` (line 1452) + `updatePaylinesIndicator` (line 1503) 結構

---

## 3. Task

### Single commit — Move PAYLINES_Y 935 → 1042

`src/screens/BattleScreen.ts` line 78-82：

當前：
```ts
// ── chore: PAYLINES decorative indicator (mockup variant-a alignment) ────────
const PAYLINES_Y      = 935;   // just above SPIN_BTN_Y=970
const PAYLINES_CELL_W = 14;
const PAYLINES_CELL_H = 14;
const PAYLINES_GAP    = 4;
```

改成：
```ts
// ── chore: PAYLINES decorative indicator (chore #217 relocated 2026-05-06) ────
// Old PAYLINES_Y=935 overlapped reel bottom (615 + 348 = 963). Moved to gap
// between SPIN buttons (end 1030) and LOG panel (start 1055). 12px breathing
// from button bottom; cell extents 1035..1049 fit cleanly in 25px gap.
const PAYLINES_Y      = 1042;
const PAYLINES_CELL_W = 14;
const PAYLINES_CELL_H = 14;
const PAYLINES_GAP    = 4;
```

### 變動摘要

| 項目 | Before | After |
|---|---|---|
| `PAYLINES_Y` | 935 (reel 內部，重疊 gem) | **1042** (SPIN button 下方 gap) |
| cell 高 / 寬 / gap | 14 / 14 / 4 | 不動 |
| label 文字 / 字體 | "PAYLINES" 9pt | 不動 |
| 10 cell 結構 | 不動 | 不動 |
| `updatePaylinesIndicator` 行為 | 不動 | 不動 |

> **視覺效果**：PAYLINES 從 reel 中央下方位置移到「SPIN button 與 log 之間」的橫向 strip 區，仍水平置中，仍跟 spin 結果連動（active count gold 填充）。reel 區終於乾淨。

**Commit**: `tune(chore): PAYLINES_Y 935→1042 — relocate from reel-internal overlap (chore #217 owner trial 2026-05-06)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts` line 79（`PAYLINES_Y` 值 + inline 註解）

**禁止**：
- 動 `PAYLINES_CELL_W` / `PAYLINES_CELL_H` / `PAYLINES_GAP`
- 動 `drawPaylinesIndicator` 函式內部結構
- 動 `updatePaylinesIndicator` 邏輯
- 動 `SPIN_BTN_Y` / `SPIN_BTN_H` / `LOG_Y` / `REEL_ZONE_Y`
- 動 reel cell sizes / formation positions / log panel
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "PAYLINES_Y" src/screens/BattleScreen.ts | head -3` — 應 declare = 1042，無 935 殘留
   - `grep "REEL_ZONE_Y\|SPIN_BTN_Y\|LOG_Y" src/screens/BattleScreen.ts | head -5` — 其他常數不動
5. **Preview 驗證**：
   - 進 BattleScreen
   - reel 區（y 615-963）**乾淨無 PAYLINES 重疊**
   - SPIN button 下方（y 1035-1049）出現 "PAYLINES 1 2 3 ... 10" 橫排 indicator
   - 跑幾 spin 看 active count 仍正常 gold 填充（中獎時）
   - 不擋 LOG panel（LOG_Y=1055 之下）
   - AUTO mode 下 indicator 仍正常更新
6. **Audit per chore #203 lesson**：grep 全 codebase 沒其他 `PAYLINES_Y` 用法漏 sync (本 chore 只有 line 79 + line 1499 用，後者讀常數沒問題)

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（PAYLINES 新位置 + reel 區乾淨對比）
- spec deviations: 0（純 1 const 值改動）
- Process check：照 chore #214+ pattern — 把 `git checkout feat/<slug>` + `add` + `commit` + `push -u` 串在**單一 Bash call**
