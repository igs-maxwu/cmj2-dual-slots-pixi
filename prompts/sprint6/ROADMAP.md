# Sprint 6 — Free Spin (M10) + 3-tier Jackpot (M12)

## 總目標（SPEC §11 / §15.7-§15.8）

兩個 SPEC 鎖定機制：

### M10 Free Spin (靈氣爆發)
- 3+ Scatter symbol 同 spin → 觸發
- **5 free spins**, bet=0, win ×2 multiplier
- 對手照常 spin，仍可造成傷害
- Target freq: ~1 per 5 matches（Actuary tunes）

### M12 3-tier Progressive Jackpot (天地人獎)
- 1% of every bet → JP pool accrual
- JP symbol 5-of-a-kind 觸發（Wild 可代替）
- 抽獎機率：Grand 3% / Major 12% / Minor 85%
- 賠率（at bet=100）：
  - 人獎 Minor：500× = **NT$50,000**
  - 地獎 Major：5,000× = **NT$500,000**
  - 天獎 Grand：50,000× = **NT$5,000,000**
- localStorage 持久化（cross-match + cross-session）

---

## 工作項目

### Track F: Free Spin

| # | 項目 | 檔案 | Who |
|---|---|---|---|
| **f-01** | Scatter symbol (id:10, weight:2, isScatter:true) — pool 出現但不 score way | `SymbolsConfig.ts` + `SlotEngine.ts` skip + `GemMapping.ts` + `LoadingScreen.ts` filter | executor |
| **f-02** | Free Spin mode state — `freeSpinsRemaining`, `inFreeSpin`, win ×2 multiplier | `BattleScreen.ts` loop() | executor |
| **f-03** | Free Spin trigger — count scatters per spin, ≥3 enters mode | `BattleScreen.ts` + sim | executor |
| **f-04** | Free Spin UI overlay — top banner `FREE SPINS N/5`, gold background tint | `BattleScreen.ts` HUD | executor |
| **f-05** | sim 驗證 free spin 觸發頻率 ~1/5 match + RTP impact | `scripts/sim-rtp.mjs` | executor |

### Track J: Jackpot

| # | 項目 | 檔案 | Who |
|---|---|---|---|
| **j-01** | JP symbol (id:11, weight:1, isJackpot:true) — 5-of-a-kind triggers JP（Wild assists per existing wild logic） | `SymbolsConfig.ts` + `GemMapping.ts` + filter | executor |
| **j-02** | JP pool 數據結構 + localStorage 持久化 + 1% accrual per bet | new `src/systems/JackpotPool.ts` + `BattleScreen.ts` | executor |
| **j-03** | JP trigger 偵測 + tier 抽獎（3% Grand / 12% Major / 85% Minor）+ 賠付 | `BattleScreen.ts` post-spin | executor |
| **j-04** | JP 觸發 ceremony — overlay 全螢幕「天獎 / 地獎 / 人獎」顯示 + SOS2 BigWin atlas FX | new `src/fx/JackpotCeremony.ts` | executor |
| **j-05** | JP marquee live counter — 取代既有 hardcoded 50k/500k/5M，改為動態讀 pool | `BattleScreen.ts` `drawJackpotMarquee` | executor |

---

## 依賴鏈

```
f-01 Scatter symbol           j-01 JP symbol
   ↓                             ↓
f-02 Free Spin state          j-02 JP pool persist
   ↓                             ↓
f-03 trigger detection        j-03 trigger + draw
   ↓                             ↓
f-04 UI overlay               j-04 ceremony FX     j-05 live marquee
   ↓                             ↓
f-05 sim verify              （j-05 與 j-04 並行）
```

兩軌**獨立**，f-01 與 j-01 可平行（不同 symbol id）。

---

## 驗收標準（Sprint 6 exit gate）

- [ ] Free Spin 觸發頻率 sim 顯示 ~0.15-0.25/match（≈ 1/5 match SPEC 目標）
- [ ] Free Spin 期間 win ×2 確實生效（sim 量到 free_spin_pct_of_total_coin）
- [ ] JP pool 跨 session 累加（reload page 後 NT$ 數值維持）
- [ ] JP 觸發頻率 sim 顯示 < 0.01/match（5-of-a-kind 1 weight 罕見事件）
- [ ] JP 觸發顯示 ceremony 動畫 + 對應 NT$ 金額加 wallet
- [ ] Coin RTP 整體 sim 結果 95-110%（最終目標）
- [ ] `npm run build` 過

---

## 暫不動清單

- M5 Resonance（Sprint 5 已完）
- M6 Curse（Sprint 5 已完）
- 美術 polish d-04~07（留 Sprint 6 之後）
- l-04 Lighthouse（部署後驗）
- Backend / IAP / LiveOps（SPEC §17 paper-only）
