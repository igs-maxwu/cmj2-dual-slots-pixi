# Chore — SYMBOL_VISUAL 重設計（同 clan 同色 / 末字 unique / W·S·JP / Curse weight=0）

## 1. Context

Owner discovery 2026-04-30：當前 `SYMBOL_VISUAL` map 跟 SymbolsConfig 的 spiritName/clan 對應**不一致** — 同一隻 spirit 在 reel 上顯示的字跟 ball 顏色都跟它的 clan 不對。8 隻 spirit 只看到 4 個字（青/白/朱/玄），玩家無法視覺區分 8 隻角色。

Owner 確認的新 spec（單 PR Path L 輕量版）：

### 變更內容
1. **8 spirit ball：同 clan 同色 + 末字 unique 字**
2. **特殊符號重命名**：Wild「替」→「**W**」/ Scatter「散」→「**S**」/ Jackpot「寶」→「**JP**」
3. **Curse 取消（Path L 輕量）**：`SYMBOLS[9].weight = 3 → 0` → reel 永不出現；機制 code / SPEC §15 M6 / DamageDistributor curse 路徑全保留可恢復

機制零改動 — SlotEngine 仍依 symbolId 配對，「同 clan 不同字」（寅+洛）依然不中獎。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（visual map / weight=0）
- **`source-driven-development`** — 確認 SymbolsConfig spiritName 對應後再下末字；DesignTokens CLAN palette 顏色照抓不發明

---

## 2. Spec drift check (P6)

1. `mempalace_search "SYMBOL_VISUAL clan color spec drift end-char proposal Path L"`
2. 確認 既 `src/screens/SlotReel.ts` line 13-26 SYMBOL_VISUAL 結構
3. 確認 既 `src/config/SymbolsConfig.ts` line 19-42 SYMBOLS array — 12 個 entry
4. 確認 既 `src/config/DesignTokens.ts` line 67-77 CLAN palette colors
5. 確認 既 chore #161 + #172 對 SlotReel 改動仍存在（resetGemBallFilter / drawWinRing / popCell 等）

---

## 3. Task

### 3a. Commit 1 — SYMBOL_VISUAL map 重寫

`src/screens/SlotReel.ts` line 13-26：

當前：
```ts
const SYMBOL_VISUAL: Record<number, { char: string; color: number }> = {
  0: { char: '青', color: T.CLAN.azureGlow },
  1: { char: '青', color: T.CLAN.azureGlow },
  2: { char: '白', color: T.CLAN.whiteGlow },
  3: { char: '白', color: T.CLAN.whiteGlow },
  4: { char: '朱', color: T.CLAN.vermilionGlow },
  5: { char: '朱', color: T.CLAN.vermilionGlow },
  6: { char: '玄', color: T.CLAN.blackGlow },
  7: { char: '玄', color: T.CLAN.blackGlow },
  8:  { char: '替', color: T.GOLD.glow },      // Wild
  9:  { char: '咒', color: 0xc77fe0 },          // Curse
  10: { char: '散', color: 0xff3b6b },          // Scatter
  11: { char: '寶', color: T.GOLD.base },       // Jackpot
};
```

改成：
```ts
// chore: SYMBOL_VISUAL redesign — same-clan same-color (spirit ID 0-7 mapped to clan from SymbolsConfig)
// Each spirit gets unique last-char of spiritName for player ID; specials use clear labels.
// Curse retained at id 9 visually for safety but weight=0 means never spawns (Path L; M6 mechanic preserved).
const SYMBOL_VISUAL: Record<number, { char: string; color: number }> = {
  0: { char: '寅',  color: T.CLAN.whiteGlow     },   // 寅 (white tiger)
  1: { char: '鸞',  color: T.CLAN.vermilionGlow },   // 朱鸞 (vermilion bird)
  2: { char: '雨',  color: T.CLAN.blackGlow     },   // 朝雨 (black tortoise)
  3: { char: '璋',  color: T.CLAN.azureGlow     },   // 孟辰璋 (azure dragon)
  4: { char: '嵐',  color: T.CLAN.azureGlow     },   // 蒼嵐 (azure dragon)
  5: { char: '洛',  color: T.CLAN.whiteGlow     },   // 珞洛 (white tiger)
  6: { char: '羽',  color: T.CLAN.vermilionGlow },   // 凌羽 (vermilion bird)
  7: { char: '墨',  color: T.CLAN.blackGlow     },   // 玄墨 (black tortoise)
  8:  { char: 'W',  color: T.GOLD.glow          },   // Wild
  9:  { char: '咒', color: 0xc77fe0             },   // Curse — kept for code safety, weight=0 in config
  10: { char: 'S',  color: 0xff3b6b             },   // Scatter
  11: { char: 'JP', color: T.GOLD.base          },   // Jackpot
};
```

> **Important**：執行前 grep 確認 `T.CLAN.azureGlow / whiteGlow / vermilionGlow / blackGlow` 都存在於 DesignTokens（既有 Sprint 6+ palette），照抓不發明。
> **末字選擇**：寅(單字保留) / 鸞 / 雨 / 璋 / 嵐 / 洛 / 羽 / 墨 — owner 確認的 final list。

### 3a-2. setCellSymbol 內 charText style 微調（W/JP 寬字）

`SlotReel.setCellSymbol` 內 `charText` 創建處，目前 fontSize 固定 `Math.round(r * 0.95)`。

「**JP**」是 2 字寬，可能塞不下圓球；「**W**」/「**S**」單字 OK。

```ts
const isMultiChar = visual.char.length > 1;
const charText = new Text({
  text: visual.char,
  style: {
    fontFamily: 'Noto Serif TC, "Ma Shan Zheng", serif',
    fontWeight: '700',
    fontSize: Math.round(r * (isMultiChar ? 0.65 : 0.95)),   // chore: shrink for "JP" 2-char fit
    fill: 0x2a1a05,
    stroke: { color: visual.color, width: 1.5 },
    dropShadow: { color: visual.color, alpha: 0.5, blur: 6, distance: 0 },
  },
});
```

> 若 SlotReel 目前已有條件式（chore #161 isWhiteClan），inline 加 isMultiChar 檢查即可，不破壞既有 conditional。

**Commit 1**: `feat(chore): SYMBOL_VISUAL redesign — 8 spirit unique last-char + same-clan color + W/S/JP labels`

---

### 3b. Commit 2 — Curse weight 設 0（Path L）

`src/config/SymbolsConfig.ts` line 37：

當前：
```ts
{ id: 9, name:'Curse',  shape:'curse',    color:0x8b3aaa, weight:3,
  spiritKey:'curse',         spiritName:'咒符',     clan:'black',    isCurse:true },
```

改成：
```ts
{ id: 9, name:'Curse',  shape:'curse',    color:0x8b3aaa, weight:0,    // chore Path L: disabled (was 3); M6 mechanic preserved, simply never spawns
  spiritKey:'curse',         spiritName:'咒符',     clan:'black',    isCurse:true },
```

> **無其他改動**。SlotEngine / DamageDistributor / BattleScreen 內所有 Curse 相關 code 全保留 — weight=0 自然代表 SymbolPool 不會選中 → reel 永不出現 → 邏輯路徑不觸發。

> **驗證 sim**：`npm run sim:rtp`（若有）跑一次確認 RTP 仍 95-110% 範圍。Curse weight 變 0 會影響 expected payout 計算 — 預期 RTP 微升（少了 Curse 干擾正向 way）。若超出 SPEC range 上限，flag 給 owner（不立即修，先 report）。

**Commit 2**: `tune(chore): Curse weight 3→0 (Path L) — disable spawn, preserve M6 mechanic code`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（SYMBOL_VISUAL map + setCellSymbol charText fontSize conditional）
- `src/config/SymbolsConfig.ts`（id 9 weight 3→0）

**禁止**：
- 動 SlotEngine / DamageDistributor / JackpotPool / FreeSpin / Streak 邏輯
- 移除 SYMBOLS id 9 entry（保留以防未來 weight 改回）
- 動 SPEC §15 M6 標記 deprecated（Path L 是「停用不刪除」）
- 動 BattleScreen curse-related event handling
- 動 spirit webp / asset
- 動 DraftScreen
- 改 main.ts / SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 5x3 reel **8 隻 spirit 都看得到末字**（寅/鸞/雨/璋/嵐/洛/羽/墨）
   - **同 clan 同色**（白虎兩字米黃 / 朱雀兩字橘 / 青龍兩字亮藍 / 玄武兩字 mint）
   - **無 Curse「咒」字出現** in 100+ spin（weight=0 sanity check）
   - Wild 顯示「W」/ Scatter 顯示「S」/ JP 顯示「JP」（雙字縮小不超圈）
   - 連連看 trace + ring + arrow 正常（chore #171 + #172 邏輯不影響）
   - 中獎邏輯依然 symbolId 配對：寅+寅+寅 中 / 寅+洛+寅 不中（雖然同色）
5. 截圖 1 張：reel 滿盤 8 spirit + 1-2 special（無 curse）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 末字視覺辨識度（玩家是否能看出 8 隻 spirit）
- 「JP」雙字在圈內視覺是否 OK（or 需更小 fontSize）
- 100+ spin 確認 0 個 curse 出現（weight=0 work）
- sim RTP 跑一次結果（Curse weight=0 後 RTP 預期變化）
- Spec deviations：預期 0
