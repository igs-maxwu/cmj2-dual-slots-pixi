# Chore — DraftScreen tile 微調：W/% 字級、Gem 大小、玄墨紫色淡化

## 1. Context

Owner 試玩 chore #200 後 3 微調：

### Issue 1: W:N N% meta 字仍偏小
chore #200 已從 9pt → 12pt，但 owner 仍覺看不清。再 bump 到 14pt。

### Issue 2: Gem icon 偏小
chore #200 INFO_GEM_R = 18（直徑 36px）。Owner 想再大些。bump 到 24（直徑 48px）。

### Issue 3: 玄墨「墨」字看不清
chore #198 set 玄墨 color = `0x9a4adb`（深紫）。寶石上的字 fill = `0x2a1a05`（深棕）— 深紫 + 深棕 對比不足，墨字糊。

→ 紫色淡化到 `0xb567f0` 或 `0xc77fe0`（較亮紫），dark text 更清楚。

純視覺微調 — 不動結構 / 機制。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 直接改 const + color hex

---

## 2. Spec drift check (P6)

1. 確認 chore #200 INFO_GEM_R 18 + meta fontSize 12 仍是當前值
2. 確認 chore #198/#199 GemSymbol SYMBOL_VISUAL 8 colors map（玄墨 id 7 = 0x9a4adb）
3. 確認 char fill in setCellSymbol = 0x2a1a05 (chore #173 dark warm-brown)

---

## 3. Task

### Single commit — 三個微調

#### 3a. INFO_GEM_R 18 → 24

`src/screens/DraftScreen.ts` line 56：
```ts
// chore #201: gem icon larger (was 18)
const INFO_GEM_R = 24;
```

> 直徑 48px，仍在 INFO_COL_W=100 範圍。Gem center y = INFO_GEM_Y + R = 74 + 24 = 98。Gem 底部 = 98 + 24 = 122。BTN_Y = 143，仍剩 21px gap → OK。

#### 3b. Meta fontSize 12 → 14

`src/screens/DraftScreen.ts` line 416：
```ts
style: { fontFamily: T.FONT.num, fontSize: 14, fill: T.FG.cream, letterSpacing: 1, align: 'center' },
```

> 字稍大但仍在 INFO_META_H=18 範圍。

#### 3c. 玄墨 color 0x9a4adb → 0xb567f0

`src/components/GemSymbol.ts` line 32：
```ts
// chore #201: lighten 玄墨 purple (was 0x9a4adb too dark for char text contrast)
7: { char: '墨', color: 0xb567f0 },
```

並更新 line 19 註解：
```
* 6 羽 (朱雀2) 0xff8a3a 橘紅 · 7 墨 (玄武2) 0xb567f0 亮紫
```

> **Contrast check**：char text fill 0x2a1a05 vs 寶石 0xb567f0 對比 ~4.5:1（WCAG AA）— 改善 vs 之前 0x9a4adb 約 2:1（不可讀）。

**Commit**: `tune(chore): DraftScreen tile — meta 12→14pt + gem r 18→24 + 玄墨 0x9a4adb→0xb567f0 brighter`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/DraftScreen.ts`（const INFO_GEM_R + metaTxt fontSize）
- `src/components/GemSymbol.ts`（id 7 color + comment）

**禁止**：
- 動 chore #200 結構（GemSymbol component / DraftScreen tile layout)
- 動其他 7 個 spirit 顏色 (chore #198 8 unique colors)
- 動 SlotReel / setCellSymbol（chore #199 4-shape preserved）
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "INFO_GEM_R" src/screens/DraftScreen.ts` — 應 24
   - `grep "fontSize: 14" src/screens/DraftScreen.ts | head -2` — 應有 meta 14pt
   - `grep "0xb567f0\|0x9a4adb" src/components/GemSymbol.ts` — 0x9a4adb 應 0 hits, 0xb567f0 應有 1 hit
5. **Preview 驗證**：
   - W:N N% 字明顯更易讀（vs 12pt）
   - Gem icon r=24 視覺平衡（不擠壓 button）
   - 玄墨「墨」字清楚（dark text on lighter purple gem）
   - SlotReel reel cells 玄墨也用同新色（GemSymbol shared）— 確認 reel 內 玄墨 ball 也亮紫

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（DraftScreen + reel 玄墨 對比）
- 字級 14pt 是否合適 (or 16？)
- gem r=24 是否合適 (or 26 過大？)
- 玄墨 0xb567f0 對比是否清楚（or 改 0xc77fe0 更淡？）
- Spec deviations：預期 0
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3` 確認 source on master
