# Sprint 8 — Pitch Prep Package（IGS RD5 demo presentation deliverables）

## 總目標

Sprint 6+7 已 ship 一個玩得起來、視覺到位的 demo（GitHub Pages live URL）。Sprint 8 把這個 demo 「**包裝成 IGS 高層 5 分鐘看懂的提案**」。產出三件套：(1) 8-12 頁 PPT，(2) 60s hype video，(3) 一頁式行銷文宣。

**形態差異**：本 sprint **多 orchestrator-driven**（content writing / 設計 prompt 撰寫 / 工具整合），少 executor code work。動用既有 subagents（the-stylist、the-visionary）+ MCP skills（anthropic-skills:pptx、Claude_Preview）。

---

## 工作項目（6 PRs total）

| # | 項目 | 形態 | 主執行 |
|---|---|---|---|
| **p-01** | Pitch deck **content outline**（8-12 slides 文字稿 + 結構 + slide-by-slide narrative） | Doc | orchestrator + the-visionary（中英對照） |
| **p-02** | Demo mode（URL param `?demo=1`）— 腳本化 spin sequence 保證 capture 到 BigWin / MegaWin / JP / FreeSpin / NearWin 各 1 次 | Code | executor（小 PR） |
| **p-03** | 用 anthropic-skills:pptx 生成實際 `.pptx` 檔（基於 p-01 outline + p-02 截圖） | File | orchestrator inline（pptx skill） |
| **p-04** | 60s hype video **script + storyboard + shot list**（中文 VO + BGM 配置） | Doc | orchestrator + the-visionary |
| **p-05** | Marketing **one-pager** content + Claude Design mockup prompt（hero art + 5 selling points + 機制 infographic + QR code） | Doc + design | orchestrator + the-stylist |
| **p-06** | Sprint 8 closure — 三件套整合、final review、跟既有 GitHub Pages live demo 串聯 | Meta | orchestrator |

---

## 依賴鏈

```
p-01 deck content ──┐
                    ├─→ p-03 generate .pptx
p-02 demo mode ─────┘     ↓
                          p-06 closure
p-04 video script ────────┘
                          ↑
p-05 one-pager ───────────┘
```

p-01 / p-02 / p-04 / p-05 可平行；p-03 等 p-01 + p-02；p-06 等全部。

---

## 驗收標準（Sprint 8 exit gate）

- [ ] `.pptx` 檔產出（8-12 slides，能直接打開放給高層）
- [ ] Hype video script + 6-12 個 shot 的 storyboard
- [ ] One-pager 文字稿 + Claude Design 設計 prompt（owner 跑 prompt 拿圖即可）
- [ ] Demo mode `?demo=1` 在 GitHub Pages 上可重現 5 種 ceremony / FX
- [ ] 三件套**主視覺風格一致**（同調性、同字體、同色票）

---

## 暫不動清單

- 真正 video 剪輯（需要 DaVinci Resolve / Premiere — 外部工具）
- 音樂正版授權（demo 階段用 royalty-free 即可）
- IGS 內部 review feedback 修訂（看完高層意見後另開 sprint）
- 中文配音錄音（先用 TTS 占位）

---

## Sprint 6+7 → Sprint 8 銜接 fact

Sprint 6 closure: drawer `e2bd3099c7999bbf`（M10 Free Spin + M12 Jackpot）
Sprint 7 closure: drawer `49bb64972c81b328`（4 男性靈 FX + win-frame + near-win + BigWin）
Live demo URL: https://igs-maxwu.github.io/cmj2-dual-slots-pixi/
14 PRs merged in single session（#121-134）SPEC §15 7/7 + Demo Polish 4/4 complete

Pitch package 主訴求三點（Sprint 8 全程貫穿）：
1. **完整可玩**：不是 mockup，是真的能玩的 PWA（QR code 立刻試）
2. **業界級數值**：sim 跑 500k spin RTP 95-110%，trigger rate 全部命中 SPEC
3. **視覺品質**：SOS2 atlas FX + 4-beast clan system + 8 spirit signatures

這三點是高層 5 分鐘判決的 anchor。
