# Sprint 9 — Pitch Feedback Response（視覺升級 + 戰鬥節奏 + 結算畫面）

## 總目標

Sprint 8 三件套交付後，owner 跑了 mockup review + 親身試玩，回 3 條具體 feedback：

1. **視覺升級**（reference: `download_picture/high_quality_mockup.html` + `mockup_reference.jpg`）
   - Top UI bar（menu / coin / store / round counter / player labels）
   - JP marquee 2-row 重排（GRAND 獨佔上行，MEGA + MAJOR 並列下行）
   - 戰場背景深度感（perspective floor 風格）
2. **戰鬥節奏太快** — 想要明確的「轉輪 → 對獎 → 出招 → 算傷害」段落感
3. **新增戰鬥結算畫面** — 顯示勝負 + 輸贏金額 + 統計

---

## 工作項目（6 PRs total）

| # | Track | 項目 | 檔案 | Skills suggested |
|---|---|---|---|---|
| **v-01** | Visual | Top UI bar：menu / coin balance / store / round counter / player A/B labels | `BattleScreen.ts` (HUD 區) | frontend-ui-engineering, code-simplification |
| **v-02** | Visual | JP marquee 2-row 重排（GRAND solo top + MEGA/MAJOR row）+ tier 名稱本地化（天地人）| `BattleScreen.ts` `drawJackpotMarquee` | frontend-ui-engineering |
| **v-03** | Visual | 戰場背景深度 — perspective floor + 漸層 vignette + spirit shadow | `BattleScreen.ts` 背景層 + 可能新增 asset | frontend-ui-engineering, source-driven-development |
| **pace-01** | Pacing | 戰鬥節奏 sequenced reveal：reel-stop → 700ms 喘息 → wayHit highlight → attack → damage drain，每段 await + delay 中斷 Promise.all 平行 | `BattleScreen.ts` `loop()` line 608-725 | incremental-implementation, frontend-ui-engineering |
| **res-01** | Result | 新 `ResultScreen` — 勝負 banner + 雙方 wallet final + dmg dealt/taken 統計 + MVP spirit + return-to-draft button | new `src/screens/ResultScreen.ts` + `BattleScreen` transition | frontend-ui-engineering, api-and-interface-design, incremental-implementation |
| **close** | Meta | Sprint 9 closure | `docs/pitch/sprint9-closure.md` orchestrator inline | documentation-and-adrs |

---

## 依賴鏈

```
v-01 Top UI bar ──┐
v-02 JP reorg    ─┼──→ pace-01 sequenced reveal ──→ res-01 Result screen ──→ closure
v-03 Background  ─┘
```

v-01 / v-02 / v-03 三個視覺 PR **獨立**，可平行 dispatch。pace-01 不依賴視覺改動但**先做完視覺較好觀察節奏**。res-01 是 BattleScreen 終局接續，建議放最後。

---

## 驗收標準（Sprint 9 exit gate）

- [ ] 進 Battle 後 top UI bar 顯示（menu icon + coin + store + round + 雙方 player labels）
- [ ] JP marquee 改成 GRAND 上 MEGA/MAJOR 下兩列布局
- [ ] 戰場背景有 perspective floor 感（不再是純水墨平鋪）
- [ ] 每 spin **明顯感覺到 4 個段落**：reel 停 → 對獎 → 出招 → 扣 HP（owner 親測「節奏感」OK）
- [ ] 對戰結束後跳 ResultScreen，顯示勝負 + 統計，可 button 返回 DraftScreen
- [ ] `npm run build` 過
- [ ] sim coin_rtp 維持 95-110%（**本 sprint 不動數值**，pace-01 只動 timing）

---

## 暫不動清單

- 即時對戰 backend / matchmaking（SPEC §17 Phase 2）
- Spirit 重新繪製（用既有 art）
- Bottom bar 重新設計（mockup 的 bet control 是 single-player slot UI，與我們 PvP auto-loop 不符 — 暫不動）
- Spin button（同上 — 我們 auto-loop，no manual spin）
- Mockup 的 store button click 行為（HUD only，無 store screen — Phase 2）

---

## 關鍵設計選擇（mockup 取捨）

從 `high_quality_mockup.html` 取**轉得進來**的元素：
- ✅ Top UI bar（HUD 升級）
- ✅ JP marquee 2-row 排版
- ✅ Round counter 「ROUND 04」風
- ✅ Background 深度感
- ✅ Player A / Player B 標籤

**不轉**的元素（mockup 是 single-player slot UI，不適合 PvP auto-loop）：
- ❌ Bet control + Spin button（PvP 不需手動觸發，bet 在 draft 已選定）
- ❌ Tree button / Max Bet circle button（slot 流派功能，本作不適用）
- ❌ Diamond store integration（後端依賴）

---

## Sprints 6+7+8 → 9 銜接

- 機制層 frozen（不動 SlotEngine / DamageDistributor / JackpotPool / FreeSpin）
- 視覺資產：sos2-* atlas 全部已 preloaded（main.ts），**不需新加 asset**（除非 v-03 真的需要新 background webp）
- Closure refs:
  - Sprint 6 drawer: `e2bd3099c7999bbf`
  - Sprint 7 drawer: `49bb64972c81b328`
  - Sprint 8 drawer: `853bf3da05ffdbfd`
- Live demo: https://igs-maxwu.github.io/cmj2-dual-slots-pixi/?demo=1
