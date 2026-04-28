# Sprint 13 — SOS2 動畫升級（Free Spin entry / Streak fly / JP fly-in / retrigger）

## 總目標

Owner Sprint 12 後選擇 Path A — 3 個 polish PR 用既有 SOS2 atlas / webp 升級「機制觸發瞬間」的視覺戲劇性。

**Inventory 確認**：所有需要的 SOS2 資產**已在 `public/assets/fx/`**，不需新增 asset：
- `sos2-declare-fire.atlas` + `.webp`（含 Fire_1..7 regions — Free Spin entry 用）
- `sos2-fly-multiplier.webp`（Streak / JP fly-text 用）
- `sos2-particles.webp`（粒子軌跡用，d-04 既加）
- `sos2-rainbow-halo.webp`（Free Spin retrigger celebratory ring 用）
- `sos2-bigwin.atlas`（既 j-04 在用，retrigger 可借 Coin/LightBall regions）

**機制不動** — 純視覺 ceremony 升級，FreeSpin / Streak / JP / Retrigger 機制邏輯零改動。

---

## 工作項目（3 PRs + closure）

| # | Track | 範圍 | 既有狀態 → 升級後 |
|---|---|---|---|
| **s13-fx-01** | Free Spin entry | f-04 既有 simple banner + gold tint → 全螢幕 fire-text 「FREE SPIN」 declaration ceremony | banner 1.5s → ceremony 2.5s with fire flames + scale animation |
| **s13-fx-02** | Streak fly-text + JP fly-in | M3 Streak 連勝 ×1.5/×2.0 沒視覺 / JP NT$ 直加 wallet 沒過渡 | Streak「×N.N」magic-particle 飛字 + JP 數字 trail-fly into wallet |
| **s13-fx-03** | Free Spin retrigger | f-03 既有 console log + banner pulse | 全螢幕「MORE SPINS!」rainbow-halo ceremony |
| closure | Sprint 13 closure | inline | — |

---

## 依賴鏈

```
s13-fx-01 (Free Spin entry) ──→ s13-fx-02 (Streak/JP fly) ──→ s13-fx-03 (retrigger) ──→ closure
```

依賴 strict sequential — 每 PR preview 確認後接下一個。

---

## 新檔案結構

```
src/fx/
├── JackpotCeremony.ts          (j-04 既有)
├── BigWinCeremony.ts           (d-07 既有)
├── NearWinTeaser.ts            (d-05 既有)
├── FreeSpinEntryCeremony.ts    (s13-fx-01 NEW)
├── StreakFlyText.ts            (s13-fx-02 NEW)
├── JackpotFlyIn.ts             (s13-fx-02 NEW)
└── FreeSpinRetriggerCeremony.ts (s13-fx-03 NEW)
```

每 fx module 採 j-04 既有 pattern：
- export `playXxxCeremony(parent, ...args): Promise<void>`
- Caller `await` for sequential gameplay flow
- Container `destroy({children: true})` cleanup
- Ticker callback 必須 `ticker.remove(fn)` 清

---

## 驗收標準（Sprint 13 exit gate）

- [ ] Free Spin 觸發瞬間 fire-text ceremony 戲劇性（vs 既有 simple banner）
- [ ] Streak multiplier ×1.5/×2.0 連勝時飛字過渡（vs 既有不顯示）
- [ ] JP 觸發後 NT$ amount 從 ceremony 飛入 wallet（vs 既有直加）
- [ ] Free Spin retrigger 全螢幕「MORE SPINS!」celebratory（vs 既有 console-only）
- [ ] `npm run build` 過
- [ ] sim coin_rtp 維持 95-110%（純視覺，sim 路徑零變動）
- [ ] FPS ≥ 50 during ceremony（DevTools Performance）
- [ ] 無 ticker leak（既有 j-04 pattern 已驗證）

---

## 暫不動清單

- 既有 f-04 / d-05 / d-07 / j-04 ceremony 邏輯（保留 / fx-01/02/03 是**新加層**或**取代**）
- 機制（SlotEngine / DamageDistributor / JackpotPool / FreeSpin state）
- Spine runtime（不需要 — 用 atlas 為 static frame source 即可）
- 新增 SOS2 asset（用既有）

---

## Sprint 12 → Sprint 13 銜接 fact

- Sprint 12 closure: drawer `b859f3b2648d3d84`
- public/assets/fx/ inventory 已 grep-confirmed 含必要 atlas / webp
- f-04 既有 FreeSpin overlay (`drawFreeSpinOverlay` + `refreshFreeSpinOverlay`) 邏輯保留 — fx-01 是進場瞬間 ceremony 加層，不替換 N/5 banner
