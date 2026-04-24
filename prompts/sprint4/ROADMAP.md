# Sprint 4 — Math Foundation + Lightweight Optimization

## 總目標（SPEC §11）

> Meta math foundation: Wild + Scatter + Streak Multiplier + Actuarial calibration (10k sims, RTP ≈ 100%, hit freq ≈ 60%) + Lightweight optimization pass (L1–L10, target ≤ 5 MB bundle, PWA scaffolding)

Sprint 4 拆成**兩軌並行**：

### Track M：Math Calibration
目的：把 Sprint 3 加完 4 passive 後的**真實 RTP / 命中率**量出來，對齊 SPEC §15 鎖定值：
- Base Ways Coin RTP = 60%
- 命中頻率 ≈ 60%（40% miss / 35% 1-3 ways / 18% 4-10 / 5.5% 11-30 / 1.5% 30+）
- 戰鬥平均 ~10 round → ~400 HP/round baseline
- 若需加 Wild / Scatter / Streak Multiplier，**先量再加**

### Track L：Lightweight Optimization
目的：**Bundle ≤ 5 MB page-1 load** + PWA scaffolding。當前狀況：
- `public/assets/audio` = **11 MB**（最大痛點）
- `public/assets/spirits` = 744 KB
- `public/assets/fx` = 596 KB
- `public/assets/ui` = 516 KB
- `public/assets/symbols` = 24 KB
- 總計約 **12.9 MB**，**距目標 5 MB 差 2.6×**

---

## Track M 工作項目

| # | 項目 | 產出 | Who |
|---|---|---|---|
| **m-00** | the-actuary subagent 產出 baseline measurement 規格（純 TS sim 腳本設計 + metrics table + 校準路線）| `prompts/sprint4/MATH-BASELINE.md` 規劃文件 | orchestrator（sub-agent） |
| **m-01** | Sim 腳本實作（`scripts/sim-rtp.mjs` 或 `scripts/sim-rtp.ts` — 純 SlotEngine + Formation + DamageDistributor，不載 Pixi，10k rounds × 2 sides，輸出 JSON）| scripts + CLI output | executor |
| **m-02** | 依 m-01 結果調整 `coinScale` / `dmgScale` / `fairnessExp` 常數 — 若偏差 > 5%，收斂 | SymbolsConfig or ScaleCalculator tweak | executor |
| **m-03** | M1 Wild symbol（`神獸化身`，weight 3，any-sub + ways ×2）| SlotEngine / SymbolsConfig 擴充 | executor |
| **m-04** | M2 Scatter（`靈脈晶`，weight 2，3+ trigger Free Spin flag — 但 Free Spin 模式留 Sprint 6） | SlotEngine 加 scatter tracking | executor |
| **m-05** | M3 Streak Multiplier（連勝倍率 ×1 / ×1.2 / ×1.5 / ×2 cap）| BattleScreen loop + HUD | executor |
| **m-06** | 重跑 sim 驗證加上 meta 機制後 RTP 仍在 ~100% coin target | scripts 擴充 | executor |

依賴鏈：`m-00 → m-01 → m-02 → m-03 / m-04 / m-05 (可並行) → m-06`

---

## Track L 工作項目

| # | 項目 | 目標 | Who |
|---|---|---|---|
| **l-01** | Audio 壓縮 — BGM 3 首 + SFX 30 個改用 `opus` 或 aggressive ogg Q3，目標 audio folder 11 MB → ~3 MB | ffmpeg batch script + 新 webp 配套 | orchestrator |
| **l-02** | Asset lazy-loading — DraftScreen 階段只載 `ui/` + `symbols/gems/`（~600 KB），Battle 階段才載 `spirits/` + `fx/` | LoadingScreen + ScreenManager 改 stage preload | executor |
| **l-03** | PWA manifest + service worker — offline cache + install prompt | `public/manifest.webmanifest` + `vite-plugin-pwa` | executor |
| **l-04** | Lighthouse / bundle 分析 baseline + 改善後對照 | 報告紀錄於 SPEC §16 | executor |

依賴：l-01 先做（asset 層）→ l-02 / l-03 並行 → l-04 驗證

---

## 建議時序（本 sprint）

```
Day 1  (orchestrator)
  m-00 actuary baseline spec
  l-01 audio compression chore

Day 2-3 (executor)
  m-01 sim harness script
  l-02 lazy-loading
  l-03 PWA scaffold

Day 4  (orchestrator + executor)
  m-02 constants tune
  l-04 Lighthouse report

Day 5-7 (executor, parallel)
  m-03 Wild / m-04 Scatter / m-05 Streak

Day 8  m-06 re-sim validate
```

---

## 驗收標準（Sprint 4 exit gate）

- [ ] 10k sim: Coin RTP = 100% ± 2%, Dmg RTP 符合 §15 dual-scale
- [ ] 命中頻率 60% ± 3%
- [ ] Wild / Scatter / Streak 三機制 coded + sim 驗過（Free Spin / JP 留 Sprint 6）
- [ ] Bundle size: page-1 load ≤ 5 MB（含 audio 壓縮 + lazy-load）
- [ ] PWA installable（iOS Safari + Android Chrome）
- [ ] Lighthouse: Performance ≥ 90, PWA installable ✓

---

## 暫不動清單（本 sprint 明確排除）

- d-04 ~ d-07 美術 polish（Signature FX / Near-win / Way frame / BigWin ceremony）— Sprint 3D 尾，留後續插入
- Sprint 5 Resonance / Curse 機制（M5 / M6）— Sprint 5 專責
- Sprint 6 Free Spin / JP pool（M10 / M12）— Sprint 6 專責
- 角色平衡 / 匹配 / AI 難度（Sprint 7）
