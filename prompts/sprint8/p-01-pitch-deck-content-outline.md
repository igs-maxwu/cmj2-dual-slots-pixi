# Sprint 8 · p-01 — Pitch deck content outline（8-12 slides 文字稿 + slide-by-slide narrative）

## 1. Context

**目標**：產出 `docs/pitch/sprint8-deck-outline.md` — IGS RD5 高層提案 deck 的完整文字內容。每 slide 有：標題、bullet 重點、speaker note、視覺暗示（給後續 p-03 生成 pptx 用）。

**對象**：IGS RD5 / 內部高層（已知 Dual Slots Battle 專案歷史，要看「成果到哪」、「下一步什麼」）。

**長度**：**8-12 slides**，5 分鐘宣讀過完。

**語言**：每 slide 中文主、英文副（**雙語**，IGS 國際 demo / 投資簡報通用）。

**Why p-01 先做**：deck content 是 Sprint 8 三件套的**敘事骨幹** — 一頁式 (p-05) 跟 60s 影片 (p-04) 都會引用 deck 的核心訊息。content 定後其他 PR 才能對齊風格與 selling points。

---

## Skills suggested for this PR

- **`spec-driven-development`** —寫 deck **就是寫一份 PRD（Product Requirements Document）的對外版本**。Skills 教的「objectives / commands / structure / boundaries」對應到 deck 的「what we built / how it plays / business case / what's next」。
- **`documentation-and-adrs`** — 對外文件需要 sourced facts（不能寫憑感覺的數字），所有 RTP / trigger rate / sim 結果都引用 MemPalace drawer `49bb64972c81b328` 與 `e2bd3099c7999bbf`。
- **`idea-refine`**（可選）— deck 第一稿後再走一輪 divergent / convergent，找出最強的「一句話 hook」。

---

## 2. 產出規格

**檔案**：`docs/pitch/sprint8-deck-outline.md`（新增 `docs/pitch/` 目錄）

**結構**：每 slide 單獨 H2 區塊，含 5 個 fields：

```markdown
## Slide N — [中文標題] / [English title]

### 主旨
1-2 句話 takeaway（高層該記住什麼）

### Bullet 重點（中英對照）
- [中] 重點一    | [EN] point one
- [中] 重點二    | [EN] point two
- ...（每 slide 3-5 bullets）

### Speaker note
60-90 秒講稿（中文）— 上台時實際口頭內容

### 視覺暗示（for p-03 pptx 生成）
- Layout: title-only / split-2col / image-full / chart / hero-shot
- 主視覺: 描述要放什麼 image（從既有 build 截圖、SOS2 atlas、design tokens 等）
- 配色: 沿用 GAME color palette（4 beast clan colors / gold / ink-wash dark）
```

---

## 3. 建議 slide structure（8-12 slides）

依「**hook → context → product → numbers → vision**」順序：

### Slide 1 — Hook / Cover
**主旨**：一句話讓高層 **5 秒就懂這是什麼遊戲** + **為什麼值得看**。
- 中文 Hook 範例：「**東方四聖獸 × Vegas 對戰老虎機 — IGS 第一款 1v1 PvP slot battle**」
- Hero shot：BattleScreen 戰鬥中 + 頂部 JP marquee + 雙方靈體對峙

### Slide 2 — Why now / Context
**主旨**：為什麼這個產品現在要做？
- IGS 既有 slot 產品線都是 single-player vs RNG
- 競品分析：1v1 social slot 在亞洲市場仍空白
- 這個專案 prove 出可行的設計 + tech foundation

### Slide 3 — Core gameplay loop
**主旨**：玩家**一場 5 分鐘**會做什麼？
- 5-pick draft（從 8 spirits 選 5 個）
- 雙方同時 5×3 reel spin（共享 grid，獨立 ways evaluation）
- 5-15 round 對打到分勝負
- HP 在角色身上，每 spirit 1000 HP

### Slide 4 — 4-Beast clan system / 視覺主題
**主旨**：藝術 / IP 主軸 — 不是另一款 generic slot。
- 青龍 / 白虎 / 朱雀 / 玄武 四聖獸
- 每 clan 兩 spirit（共 8 角色）
- Clan 各自被動 passive：dragon +20% dmg on 4+ way、tiger -10% taken、tortoise last-alive shield、phoenix coin-on-kill
- 視覺 reference：水墨 ink-wash + SOS2 atlas FX

### Slide 5 — 7 SPEC §15 meta mechanics
**主旨**：技術深度 — 不只是 prototype，是業界級 slot engine。
- M1 Wild × 2 multiplier
- M2 Scatter（觸發 Free Spin）
- M3 Streak multiplier table
- M5 Resonance（共鳴 ×1.5 boost）
- M6 Curse stack（紫魂積累 → 500 HP proc）
- M10 Free Spin（5 spins, ×2, bet=0）
- M12 3-tier Progressive Jackpot（天/地/人 NT$5M/500k/50k localStorage 持久）

### Slide 6 — Numbers（這頁是 demo 信用感的來源）
**主旨**：數據說話 — sim 跑 500k spin 證實平衡。
- coin RTP: **108.74%**（SPEC 95-110% ✓）
- Free Spin trigger: **0.2152 / match**（SPEC 0.15-0.30 ✓）
- JP trigger: **0.00024 / match**（SPEC <0.01 ✓）
- avg rounds per match: **8.46**
- 圖表：bar chart 4 metric + SPEC band 對照

### Slide 7 — Visual quality showcase
**主旨**：demo 視覺品質直接給高層**情緒衝擊**。
- 4 男性靈 signature 動作 mosaic（dragon fire / tiger flash / tortoise smoke / phoenix arrow）
- JP ceremony screenshot（grand 天獎全螢幕）
- BigWin / MegaWin / NearWin teaser 對比
- Way highlight win-frame demonstration

### Slide 8 — Tech foundation
**主旨**：交付能力 — 不是 wireframe 是真實 PWA。
- Pixi.js 8 + TypeScript + Vite
- PWA installable（manifest + workbox 162 entry precache）
- 13MB → 5.9MB asset 壓縮（audio mp3 48kbps + webp）
- GitHub Pages auto-deploy via GitHub Actions
- **QR code → live demo URL**

### Slide 9 — Business case（**選配**，視高層興趣放）
**主旨**：商業可行性簡報。
- Target：30-45 歲亞洲市場男性（IGS 既有客群延伸）
- Monetization preview：bet sizes、JP pool 累積、daily bonus、IAP gem packs（SPEC §17 paper）
- Comparable：competitor X 月流水參考
- LiveOps roadmap（season pass / new clan unlock）

### Slide 10 — Roadmap / What's next
**主旨**：下一步要什麼資源？
- Phase 1 (done)：core mechanics + visual polish + sim 平衡 [Sprint 1-7]
- Phase 2 (next)：backend + IAP + matchmaking [人月: 4-6 月]
- Phase 3：LiveOps content engine + 海外市場
- 投資要求 / 團隊配置（若 deck 給高層批預算）

### Slide 11 — Closing / CTA
**主旨**：明確下一步行動。
- 現在請大家**用手機掃 QR code 親自玩 30 秒**
- 期待 feedback：mechanics 哪個最有感？最大顧慮？
- 聯絡 / 後續會議

### Slide 12（**選配**）— Appendix / FAQ
- 技術細節（給 RD 高層問）
- Sim 報告 raw data
- 競業比較表
- License / 美術授權狀況

---

## 4. 撰寫指引

### 中英對照規則
- 每個 bullet 中文 + 英文同義句（不是直譯，是各自為母語讀者寫）
- Slide title 中文為主、英文副標較小
- Speaker note **只用中文**（reduce cognitive load on speaker）

### 數字引用守則
- **所有量化數字必須引用 source**：
  - sim 結果 → `MemPalace drawer e2bd3099c7999bbf, 49bb64972c81b328`
  - SPEC 機制 → `SPEC.md §15.X`
  - 開發歷程 → `git log` PR 編號
- 禁止憑感覺寫的數字（例如「市場約 X 億」要有 source 否則拿掉）

### 風格 voice
- **避免**「全球首款」「業界唯一」「革命性」這類 marketing fluff
- **要有**具體的「N PRs in Y days」「sim 500k spins」「14 PRs single session」這種交付證據
- 高層討厭 buzzword，喜歡 numbers + screenshots

### 視覺 anchor
全 deck 沿用既有 design tokens：
- 4 clan color：azure 0x4a90e2 / white 0xffffff / vermilion 0xff5722 / black 0x2c2c2c
- Gold accent：0xFFD37A
- Ink-wash dark bg：T.SEA.deep
- Font：Noto Sans CJK / 思源黑體（既有 GoldText 用）

---

## 5. DoD

1. `docs/pitch/sprint8-deck-outline.md` 完整 8-12 slides，每 slide 5 fields 齊全
2. **所有量化數字**有 source 註解
3. commit + push 到 master（直 push 因 doc-only）
4. 1 行摘要 + slide count + 中英對照 100% 覆蓋確認

## 6. Handoff

- 檔案路徑（`docs/pitch/sprint8-deck-outline.md`）
- 8 / 9 / 10 / 11 / 12 slides 哪個版本（含 appendix 與否）
- 哪些 bullet 引用了 MemPalace drawer / SPEC §
- 任何**找不到 source 但需要 owner 補資料**的點（例如 Slide 9 商業比較若無資料就 flag）
- Spec deviations：預期 0
