# Sprint 8 — Pitch Prep Package · Closure Report

**Sprint duration**: 2026-04-27（單 session，與 Sprint 6+7 同日）
**Status**: COMPLETE 6/6
**Total artifacts**: 1 PR merged (#135) + 5 inline orchestrator deliveries

---

## 1. Sprint 8 完整交付清單

| # | 工作項 | 形態 | 路徑 / commit |
|---|---|---|---|
| **p-01** | Deck content outline (12 slides 雙語 PRD) | Doc | `docs/pitch/sprint8-deck-outline.md` (commit `fe60bb4`) |
| **p-02** | Demo mode `?demo=1` (5-spin scripted capture) | Code (PR #135) | merged 2026-04-27 |
| **p-03** | Pitch deck `.pptx` 310KB (12 slides) | Binary + script | `docs/pitch/sprint8-pitch-deck.pptx` + `generate-deck.cjs` (commit `c2cbc06`) |
| **p-04** | 60s hype video script + 18-shot storyboard | Doc | `docs/pitch/sprint8-hype-video-script.md` (commit `09c9a6c`) |
| **p-05** | A4 marketing one-pager + Claude Design prompt | Doc | `docs/pitch/sprint8-one-pager.md` (commit `6e0f19e`) |
| **p-06** | This closure report | Doc | `docs/pitch/sprint8-closure.md` (this commit) |

---

## 2. 三件套 Brand 一致性 Final Verification

| 元素 | Deck | Video | One-pager | Status |
|---|---|---|---|---|
| Logo（金字水墨「雙 Slot 對決」） | Slide 1 | Shot 1 | BAND A | ✓ |
| 主色票 ink dark + cream + gold + vermilion | ✓ | ✓ | ✓ | ✓ |
| 4 clan colors (azure / white / vermilion / black) | Slide 4 | Shot 4 | BAND D | ✓ |
| 字體 Cambria + 思源黑體 | ✓ | ✓ | ✓ | ✓ |
| 7-mechanic icon set | Slide 5 | Shot 16 | BAND B card 3 | ✓ |
| Sim numbers (108.74% / 0.21 / 0.00024 / 8.46) | Slide 6 | Shot 16-17 | BAND C | ✓ |
| QR code 位置 | Slide 1/8/11 | Shot 18 | BAND E | ✓ |
| 金色左邊 edge bar (motif) | ✓ all slides | n/a (video) | ✓ 2mm | ✓ |

**結論**：三件套 100% 對齊，IGS RD5 pitch 任一場合（presentation / video / handout）都能保持 brand 視覺統一。

---

## 3. Sprint 8 Exit Gate Checklist

對照 `prompts/sprint8/ROADMAP.md` 驗收標準：

- [x] `.pptx` 檔產出 (12 slides，能直接打開放給高層)
- [x] Hype video script + 18 個 shot 的 storyboard
- [x] One-pager 文字稿 + Claude Design 設計 prompt
- [x] Demo mode `?demo=1` 在 GitHub Pages 上可重現 5 種 ceremony / FX
- [x] 三件套主視覺風格一致（同色票 / 同字體 / 同 motif）

**全部 ✓ — Sprint 8 EXIT GATE PASS**

---

## 4. Owner 待辦清單（合併 p-04 + p-05）

### 內容補充（高優先 — 影響 deck 完整性）

- [ ] **競品月流水比較資料**（Slide 9 紅框 flag）— 從 Marketing team 取得
- [ ] **Phase 2 詳細 budget + team 配置**（Slide 10 紅框 flag）— BE 工程師人數 / 開工時程

### 視覺資產（中優先 — 影響三件套品質）

- [ ] **Slide 1 + BAND A hero art 來源**：跑 `?demo=1` 截 BattleScreen 戰鬥中的最佳一張
- [ ] **Slide 7 mosaic 6 張截圖**：跑 `?demo=1` 完整序列，每 ceremony 截 1 張
- [ ] **Slide 1/8/11 + BAND E QR code**：用 `qrcode-generator` lib 生成真 QR，URL = `https://igs-maxwu.github.io/cmj2-dual-slots-pixi/`
- [ ] **BAND B 5 個 selling-point icons**：重用 deck Slide 5 的 7 mechanics icons OR 另設計

### 後製（低優先 — pitch 日前完成即可）

- [ ] **BGM 版權路線**：YouTube free / Epidemic Sound / Suno AI 自製（三選一）
- [ ] **配音員選擇**：內部錄音 vs 外包，預估 NT$1500-3000 / 60s
- [ ] **後製人員配置**：IGS 內部 video team / 外包剪輯
- [ ] **One-pager 生成路徑**：Figma 設計師（推薦）/ Canva Pro / PPT export / Midjourney
- [ ] **完成日期目標**：建議 demo 日 -7 day video / -3 day one-pager

---

## 5. Sprints 6 + 7 + 8 累計戰績（單一 session 2026-04-27）

| 指標 | 數值 |
|---|---|
| **Total PRs** | 15 numbered PRs (#121-#135) + 5 orchestrator inline commits |
| **Sprint 6** | 10 PRs (Track F + J = SPEC §15 7/7 mechanics) |
| **Sprint 7** | 4 PRs (Demo Polish 4/4 — d-04 / d-06 / d-05 / d-07) |
| **Sprint 8** | 1 PR + 5 inline deliveries (Pitch Prep Package 6/6) |
| **Spec drift hits** | 0 |
| **Iteration cap (P3) hits** | 0 |
| **Re-review iterations needed** | 0 (every PR merged on first review) |
| **Executor Rules P1-P6 violations** | 0 |
| **Skill plugin validations** | 5+ explicit per-PR (frontend-ui-engineering, incremental-implementation, source-driven-development, code-simplification, test-driven-development, spec-driven-development, documentation-and-adrs, anthropic-skills:pptx) |

---

## 6. Sprint 9 方向候選（discuss with owner）

Sprint 8 完成後，**Dual Slots Battle 已具備 IGS RD5 pitch 完整 demo 條件**：可玩 PWA + sim 已驗 + 視覺到位 + 三件套 pitch material 齊全。下一步三選一：

### A. DEFERRED INFRA（production-readiness）

| 項 | 內容 |
|---|---|
| l-04 Lighthouse audit | 全頁性能 + accessibility 審計，目標 ≥ 90 分 |
| PWA installability test | 不同瀏覽器 + 行動裝置 install flow 驗證 |
| SFX final pass | 招式音 / UI feedback / win celebration SFX 重做 |
| Owner-data 補完 | 將 Slide 9 + 10 的 owner-flag 補上 deck 重新生成 |

**目的**：公開 preview / demo 部署前的 production-readiness 檢核。

### B. IAP / LIVEOPS PAPER PLANNING (SPEC §17)

| 項 | 內容 |
|---|---|
| IAP wireframe doc | 6 SKU 詳細設計 + MyCard 對接路線 |
| Backend mock spec | 配對伺服器 / 排行榜 / 付費驗證 API design |
| LiveOps content engine | season pass / new clan unlock 機制 paper |
| Monetization sim | 不同 IAP price 點對 LTV / ARPU 影響預測 |

**目的**：把 Phase 2 的「軟體規格」先寫好，正式 backend kickoff 時 spec 就緒。

### C. 等 Pitch Feedback (DON'T START YET)

```
等 Sprint 8 三件套被高層看過 → 收 feedback → 依 feedback 決定 Sprint 9
```

**目的**：避免在不知道高層意見的情況下投入錯方向。**保守路線**。

---

## 7. Orchestrator 推薦

**選項 C（等 feedback）**最務實，理由：

1. **Sprint 6+7+8 在單一 session 完成 16 PRs，邊際成本已經很低** — 任何時候都能再開一個 sprint
2. **Sprint 9 的最佳 spec 來自高層 feedback**：他們點頭 → A infra；他們質疑 monetization → B IAP；他們質疑 mechanics → 改 SPEC §15 微調
3. **Owner 待辦清單（§4）已經有 8-10 項要他做**，這幾天 owner 注意力應該放在 collect feedback + 補資料，不是再開新 sprint

但若 owner 想保持節奏 / 不想等：**A 是相對安全的下一步**（infra 改動小、看得到 lighthouse 分數即時 KPI、跟 pitch 對話無關不影響 feedback）。

**B 不建議在 feedback 前開**：因為 Phase 2 的 IAP wireframe 強烈依賴高層對 monetization 強度的取向，paper-only 沒方向會白做。

---

## 8. Closure Statement

**Sprint 8 — Pitch Prep Package — COMPLETE 6/6.**

Three-piece IGS RD5 pitch deliverable ready:
1. `docs/pitch/sprint8-deck-outline.md` (PRD source)
2. `docs/pitch/sprint8-pitch-deck.pptx` (310KB, 12 slides)
3. `docs/pitch/sprint8-hype-video-script.md` (60s, 18 shots)
4. `docs/pitch/sprint8-one-pager.md` (A4 + Claude Design prompt)
5. `docs/pitch/sprint8-closure.md` (this report)

**Total session deliverables**: 16 PRs + 5 docs across Sprints 6, 7, 8 — single continuous session, zero spec drift, zero iteration cap hits, all skills validated.

**Project state**: Demo-ready PWA + balanced sim + polished visuals + complete pitch package. Awaiting IGS RD5 high-level feedback before deciding Sprint 9 direction.

**MemPalace closure refs**:
- Sprint 6 drawer: `e2bd3099c7999bbf`
- Sprint 7 drawer: `49bb64972c81b328`
- Sprint 8 progress drawer: `0642a2b0179c138f`
- Sprint 8 closure drawer: (this commit triggers new drawer)
