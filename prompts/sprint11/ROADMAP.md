# Sprint 11 — Variant A Migration（從 Sprint 10 Variant B 切到 Claude Design Variant A）

## 總目標

Owner Sprint 10 試玩後決定改採 Claude Design **新版 Variant A** mockup（檔案在 `download_picture/Dual Slot Pixi/`）。新 Variant A 與之前的 Variant A / Sprint 10 採用的 Variant B 都不同 — 視覺重排：

- JP marquee 從 Sprint 10 thin 64px → **HERO 178px**（高 emphasis，「THE POOL OF EIGHT SEAS」字樣）
- Spirit formation 從 1-2-2 三排 → **3×3 NineGrid 九宮格**（5 spirit 隨機站 5 cells，render back-to-front depth scale 0.78→1.10）
- Reel cells 從 5 gem-shape PNG + tint → **glossy 圓球 + 青/白/朱中文字**（更清楚 clan 識別）
- 「戰」字 zone separator 進場（Variant A 簽名元素）

Owner 兩個前置決策：
- ✅ Spirit 立繪保留既有 `public/assets/spirits/*.webp`（同一批角色，不換）
- ✅ Gem 從 5 shape PNG → glossy 圓球 + 中文字（**接受 d-02 5-shape 廢棄**）

---

## 工作項目（3 PRs + closure）

| # | 範圍 | 主要動 | Skills |
|---|---|---|---|
| **p11-vA-01** | Layout reset | JP marquee 64px→178px hero / 加「戰」字 separator / arena container 重排 / VS shield 縮 50px / 移 SPIN/AUTO/SKIP / 移 PAYLINES / battle log 185px | frontend-ui-engineering, code-simplification |
| **p11-vA-02** | NineGrid formation | 3×3 grid 5-cell 確定性放置 (Fisher-Yates seeded) / depth scale 0.78→1.10 / B 側 col mirror / render back-to-front z-order / 廢 1-2-2 LAYOUT | frontend-ui-engineering, source-driven-development |
| **p11-vA-03** | Gem reskin | 取代 setCellSymbol gem-shape sprite → Pixi Graphics 圓球 + Chinese text + dashed inner ring + tier pip corner / 廢 GemMapping shape lookup / pip 邏輯整合進 cell | frontend-ui-engineering, code-simplification |
| closure | Sprint 11 closure | inline | documentation-and-adrs |

---

## 依賴鏈

```
p11-vA-01 (layout) ──→ p11-vA-02 (formation) ──→ p11-vA-03 (gem reskin) ──→ closure
```

嚴格 sequential — 每個 PR 視覺都要 preview 確認後才接下一個。

---

## 驗收標準（Sprint 11 exit gate）

- [ ] BattleScreen layout 對照 Variant A mockup 整體相似度 ≥ 80%（zone hierarchy / 配色 / 字體 / 元素位置都對齊）
- [ ] 9-cell formation per side，5 spirit 的位置在多次 mount 看起來「**有變化但合理**」（seeded random，per-match 固定但 across-match 不同）
- [ ] Reel gem 是「glossy 圓球 + 中文字」風格，看一眼就能識別 clan（青龍/白虎/朱雀/玄武）
- [ ] 「戰」字 separator 在 JP 與 arena 之間視覺區隔明顯
- [ ] 沒有 SPIN/AUTO/SKIP 按鈕（auto-loop 模式不需）
- [ ] 沒有 PAYLINES indicator（243-Ways 不適用）
- [ ] `npm run build` 過
- [ ] sim coin_rtp 維持 95-110%（純視覺 sprint）

---

## 暫不動清單

- 即時對戰 backend / matchmaking
- Spirit 立繪重做（用既有 webp）
- 「A · YOUR TURN / B · WAITING」turn-based label（auto-loop 同步 spin，無回合制 — 改成靜態「A · 我方 / B · 對手」標籤）

---

## Sprint 10 → Sprint 11 銜接 fact

- Sprint 10 closure: drawer `6877a864bb5bf100`
- Variant A mockup source: `download_picture/Dual Slot Pixi/battle-variant-a.jsx` + `battle-shared.jsx`
- NineGrid component reference: `battle-shared.jsx` line 429-540
- ReelCell glossy ball reference: `battle-shared.jsx` line 161-210
- Sprint 10 已 ship 的 Variant B 視覺元素**多數需要重做** — formation / JP marquee / VS shield / reel cells 全改
- Sprint 9 pace-01 (4-stage reveal) + Sprint 9 res-01 (ResultScreen) **保留不動**
