# Sprint 7 — Demo Polish (deferred d-04 ~ d-07 from Sprint 3 D-track)

## 總目標

Sprint 6 把所有 SPEC §15 機制全部 ship（Free Spin + Jackpot 收尾，7/7 locked meta mechanics complete）。本 sprint 純做**視覺品質**升級，以 SOS2 atlas（已 preloaded）替換 / 加層既有 placeholder 視覺，讓 IGS RD5 pitch demo 能直接拿到漂亮的 gameplay 截圖跟 60s hype video 素材。

**不碰邏輯**：本 sprint 所有 PR 都不動 SlotEngine / DamageDistributor / JackpotPool / FreeSpin state。Hands-off 機制層。

---

## 工作項目（4 PRs total）

| # | 項目 | 檔案 | Skills suggested |
|---|---|---|---|
| **d-04** | 4 男性靈簽名招式 FX 升級 — Meng dragon 加 fire-wave 層、Lingyu phoenix 加 fire trail + embers、Xuanmo tortoise 加 smoke plume + ground crack glow、Yin tiger 加 dust sparks 衝擊 | `SpiritAttackChoreographer.ts` (4 signature 區塊) | frontend-ui-engineering, incremental-implementation, source-driven-development |
| **d-05** | Near-win 金粉 teaser — 當 spin 結果差 1 個 cell 就湊到 4-of-a-kind way 時，亮起金粉 hint（SOS2 sos2-near-win atlas + sos2-particles） | new `src/fx/NearWinTeaser.ts` + `BattleScreen.ts` 接 trigger | frontend-ui-engineering, incremental-implementation |
| **d-06** | Way highlight win-frame — 既有 wayHit 高亮替換成 SOS2 sos2-win-frame.webp 框，加 GlowFilter 脈動 | `BattleScreen.ts` highlightWays method（line ~612 區） | frontend-ui-engineering, code-simplification |
| **d-07** | BigWin / MegaWin ceremony for **non-JP** big payouts — 當 wayHits 總 coinWon 超過 threshold（500x bet / 5000x bet）觸發 BigWin / MegaWin 文字飛入（SOS2 bigwin atlas，與 JackpotCeremony 共用 atlas region） | new `src/fx/BigWinCeremony.ts` + `BattleScreen.ts` 接 trigger | frontend-ui-engineering, incremental-implementation, source-driven-development |

---

## 依賴鏈

```
d-04 Signature FX        d-05 Near-win teaser
        ↓                        ↓
d-06 Way highlight        d-07 BigWin (non-JP)
```

四個皆**獨立**，原則上可以平行（不同模組），但 executor session 一次跑一張比較好控品質。建議順序：d-04 → d-06 → d-05 → d-07（先大後小，視覺改動 weight 高的先做以利 demo 截圖採集）。

---

## 驗收標準（Sprint 7 exit gate）

- [ ] 4 男性靈使出招時皆有 SOS2 atlas FX 層（不再是純 Pixi Graphics 線條）
- [ ] Near-win 出現次數 sim 統計 — 期望 ~10-20% spins（teaser 不應太罕見）
- [ ] Way highlight 不再是 Graphics 框，改成 win-frame.webp
- [ ] Big payout 觸發 BigWin / MegaWin 飛入，與 JP ceremony 視覺有區隔
- [ ] **截圖 set**：每張 PR 至少 1 張 mid-FX 截圖 + 4 張 Sprint 7 整體 highlight reel（後續 pitch deck 用）
- [ ] `npm run build` 過
- [ ] 所有 PR 不影響 sim coin_rtp / dmg / trigger metrics（本 sprint 不動數值）

---

## 暫不動清單

- M11 神靈技 / M13 連線 PvP（SPEC §11 paper-only）
- l-04 Lighthouse audit（公開部署後再驗）
- IAP / LiveOps（SPEC §17）
- Sound / SFX 重做（先用既有 audio）

---

## Sprint 6 → Sprint 7 銜接 fact

Sprint 6 closure record 在 MemPalace drawer `e2bd3099c7999bbf`。Sprint 7 不需重複載入該 record，直接以「機制層 frozen / 視覺層 polish」作為前提。
