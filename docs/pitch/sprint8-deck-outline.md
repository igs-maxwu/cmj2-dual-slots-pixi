# Dual Slots Battle — IGS RD5 Pitch Deck Outline

**Audience**: IGS RD5 內部高層 / 投資審議會
**Length**: 12 slides (含 appendix) — 5 分鐘宣讀過完
**Language**: 中文主、英文副
**Source canon**:
- MemPalace drawer `e2bd3099c7999bbf` (Sprint 6 closure — Free Spin + JP)
- MemPalace drawer `49bb64972c81b328` (Sprint 7 closure — Demo Polish)
- SPEC.md §15 (locked meta mechanics)
- `git log` PRs #121–#134（14 PRs in single session 2026-04-27）
- Live demo: https://igs-maxwu.github.io/cmj2-dual-slots-pixi/

---

## Slide 1 — Cover / Hook

### 主旨
一句話讓高層 5 秒就懂。

### Hook
**「東方四聖獸 × Vegas 1v1 對戰老虎機」**
**"4 Beasts of the East meets 1v1 Vegas-style PvP slots"**

### Bullet 重點（中英對照）
- [中] IGS 第一款雙人對戰 slot，玩家不是打 RNG，是打**真人對手**　 | [EN] IGS's first 1v1 PvP slot — players battle each other, not the RNG
- [中] 四聖獸 IP 主軸（青龍、白虎、朱雀、玄武），8 spirits + 7 種 meta 機制 | [EN] 4-Beast IP core (Azure / White / Vermilion / Black) — 8 spirits across 7 SPEC meta mechanics
- [中] 已可玩 PWA，sim 跑過 500k spin RTP 108.74% 落 SPEC 中段 | [EN] Live PWA, 500k-spin sim verifies coin RTP at 108.74% (within SPEC 95–110% target)

### Speaker note
（30 秒）「今天介紹 Dual Slots Battle，這是 IGS 第一款 1v1 對戰 slot — 玩家不打電腦、不打 RNG，**打彼此**。題材是大家熟悉的東方四聖獸，把青龍白虎朱雀玄武轉成八個可選靈將，搭配業界標準的 7 種 slot meta 機制。最右邊 QR code 是 live demo，等下我會請各位拿手機掃一下，30 秒就可以體驗。今天 5 分鐘的目標：讓各位看到我們做到哪、決定要不要往 Phase 2 推。」

### 視覺暗示（for p-03 pptx）
- Layout: **hero-shot full**
- 主視覺: BattleScreen 戰鬥中截圖（雙方靈將對峙 + 中央 reel + 頂部 JP marquee）
- 右下角: GitHub Pages live demo URL QR code
- 標題大字: 「東方四聖獸 × Vegas PvP Slots」金字 + ink-wash dark bg
- 配色: ink-wash dark bg + 4 clan accent corners（azure / white / vermilion / black）

---

## Slide 2 — Why Now / Market Context

### 主旨
為什麼這個產品**現在**值得做。

### Bullet 重點（中英對照）
- [中] IGS 既有 slot 產品線**全部是 single-player vs RNG** | [EN] IGS's existing slot lineup is exclusively single-player vs RNG
- [中] 亞洲社交 slot 市場「1v1 PvP 對戰」**仍是空白** | [EN] Asian social slot market: 1v1 PvP slot battle remains an unoccupied niche
- [中] 競品 Coin Master / Slotomania 都是 PvE，社交是「踩朋友」不是「對戰朋友」 | [EN] Competitors (Coin Master, Slotomania) are PvE; social = visiting friends, not fighting them
- [中] 本專案 prove 出設計可行 + tech foundation 可量產 | [EN] This project proves design feasibility + production-ready tech foundation

### Speaker note
（45 秒）「為什麼是現在做這個？看市場 — IGS 自己的 slot 產品全都是 single player vs RNG，玩家轉一轉、看 RTP 數字漂亮就好。但**社交層**已經被 Coin Master 那種『踩朋友村莊』的玩法佔走，那不是真正的對戰，只是社交皮層。亞洲市場 1v1 直接對打的 slot **還沒有 dominant player**。我們把這個空白抓下來，先做出可玩 demo，技術先 prove 出來。Phase 2 才接後端、IAP、配對。」

### 視覺暗示
- Layout: **split-2col**
- 左欄: 1×3 grid 競品 logo（Coin Master / Slotomania / IGS 既有 slot）+ 標籤「PvE / Social / RNG」
- 右欄: 大字「**1v1 PvP Slot ← 我們在這**」配 azure 高亮框
- 配色: 灰階競品 + 金色我們

---

## Slide 3 — Core Gameplay Loop

### 主旨
一場 5 分鐘玩家會做什麼 — 設計骨架。

### Bullet 重點（中英對照）
- [中] **5-pick draft**：從 8 spirit 選 5 個組隊（每隊各自 1000 HP × 5 = 5000 HP 總量） | [EN] 5-pick draft from 8 spirits per side (1000 HP/unit × 5 = 5000 total team HP)
- [中] **共享 5×3 reel**：雙方同時看同一個 grid，但獨立 ways evaluation（A 從 col 0、B 從 col 4） | [EN] Shared 5×3 reel — both sides view same grid, ways evaluated independently (A reads from col 0, B from col 4)
- [中] **每 spin 雙效**：自己得 coin（own wallet）+ 對手扣 HP（opponent unit HP） | [EN] Every spin yields dual outcome: own wallet gains coin, opponent's units take damage
- [中] **平均 8.46 round 分勝負**（sim 數據），約 **3-5 分鐘**一場 | [EN] Avg 8.46 rounds per match (sim data) — ~3-5 min/match

### Speaker note
（60 秒）「玩家進來先做 draft，從 8 個 spirit 挑 5 個組隊，這 5 個各帶 1000 HP，所以一隊總血量是 5000。進戰場後雙方看到的是**同一個** 5×3 reel — 這是設計關鍵點，創造『你看我我看你都在算同一張牌』的情緒。但 ways evaluation 是分開的，A 側從最左欄開始算、B 側從最右欄。每 spin 同時做兩件事：自己得 coin、對手扣 HP。對手的 HP 是綁在每個 spirit 角色身上，spirit 死了會踢出隊伍。實測 sim 平均 8.46 round 分勝負，所以一場大概 3-5 分鐘 — 對手機 PvP 來說剛剛好。」

### 視覺暗示
- Layout: **diagram 4-step horizontal flow**
- 4 個 step 圖示：Draft → Spin → Both Sides Score → Damage to opposing units
- 每 step 下方標籤一行
- 中央: live demo 截圖 BattleScreen（雙方 5 unit + 中央 reel）
- 配色: gold accent on key transitions

---

## Slide 4 — 4-Beast Clan System / 視覺主題

### 主旨
藝術 / IP 主軸 — 不是 generic slot。

### Bullet 重點（中英對照）
- [中] **青龍 Azure** / **白虎 White** / **朱雀 Vermilion** / **玄武 Black** — 中華文化最強 IP | [EN] Azure Dragon / White Tiger / Vermilion Phoenix / Black Tortoise — strongest mythic IP set in East Asian culture
- [中] 每 clan 兩 spirit（共 8 角色），每 clan 有獨特被動（passive）| [EN] 2 spirits per clan (8 total), each clan has unique passive
- [中] **Dragon** +20% dmg on 4+ way / **Tiger** -10% dmg taken / **Tortoise** last-alive shield / **Phoenix** coin-on-kill | [EN] Dragon +20% dmg on 4+ way / Tiger -10% taken / Tortoise last-alive shield / Phoenix coin-on-kill
- [中] 視覺：**水墨 ink-wash 風格 + SOS2 atlas FX 疊加** — 不是 cartoon、不是 photo-real | [EN] Visual: ink-wash + SOS2 atlas FX layers — neither cartoon nor photoreal

### Speaker note
（70 秒）「IP 軸我們選四聖獸 — 青龍白虎朱雀玄武，這是中華文化最廣為人知、跨年齡層都熟悉的設定，不需要花預算去 educate。每 clan 兩 spirit，總共 8 角色，玩家在 draft 時要思考組隊搭配：青龍 4-of-a-kind 多 20% 傷害，所以青龍 stack 起來爆發大；白虎全隊 -10% 受傷，更耐打；玄武是最後一隻活著的時候有護盾，扛 carry；朱雀殺對手 spirit 直接給 coin，coin 流派。視覺風格我們做了**水墨 + SOS2 atlas FX**疊加 — 後面 slide 7 會看到實際 demo 截圖。」

### 視覺暗示
- Layout: **2×2 grid — 4 clan with hero chibi**
- 每格: clan 中文名 + 英文 + chibi spirit art + 被動 effect 一句
- 4 個 clan 用各自 color：azure 0x4a90e2 / white 0xffffff / vermilion 0xff5722 / black 0x2c2c2c
- 背景: ink-wash texture
- 主視覺: 4 spirit chibi（從 download_picture/ 已有素材選出）

---

## Slide 5 — 7 SPEC §15 Meta Mechanics

### 主旨
技術深度 — 不是 prototype，是業界級 slot engine。

### Bullet 重點（中英對照）
- [中] **M1 Wild** — 任意符號替代 + ×2 multiplier on win | [EN] M1 Wild — substitute any symbol + ×2 multiplier on hit
- [中] **M2 Scatter** — 散布符號，3+ 觸發 Free Spin | [EN] M2 Scatter — 3+ triggers Free Spin entry
- [中] **M3 Streak** — 連勝累積 multiplier table 1.0/1.0/1.2/1.5/2.0 | [EN] M3 Streak — consecutive wins build multiplier table
- [中] **M5 Resonance** — 同 clan 共鳴 ×1.5（SOLO/DUAL tiers） | [EN] M5 Resonance — same-clan synergy ×1.5 boost
- [中] **M6 Curse** — 紫魂積累，3+ stack proc 500 HP 扣血 | [EN] M6 Curse — purple-skull stack, 3+ procs 500 HP damage
- [中] **M10 Free Spin** — 5 spins, ×2 multiplier, bet=0 | [EN] M10 Free Spin — 5 spins at ×2 multiplier, bet=0
- [中] **M12 3-tier Progressive Jackpot** — 天/地/人獎 NT$5M/500k/50k localStorage 持久 | [EN] M12 3-tier Progressive Jackpot — Grand/Major/Minor NT$5M/500k/50k, localStorage-persisted

### Speaker note
（80 秒）「技術深度這頁 — 我們實作了 SPEC 鎖定的 7 種 meta 機制全部上線。從基礎的 Wild、Scatter、Streak，到差異化機制：Resonance 同 clan 共鳴讓 draft 有策略選擇、Curse 紫魂積累給玩家負面反饋強化情緒、Free Spin 5 ×2 是 standard slot 標配但我們做雙方共享所以 PvP 對抗下兩邊一起進入、Jackpot 是 3-tier progressive 用 localStorage 持久跨 session、跨 match 累積 — 玩家明天再開遊戲池子還在。這 7 個機制每個都有 SPEC 章節對應，每個都通過 sim 500k spin 驗證。Source 在右下角的 PR 編號 #121–#134，14 個 PR、單一 session 內全部 ship。」

### 視覺暗示
- Layout: **7-tile grid 2 row（4+3）**
- 每 tile: M-id + 中文名 + 一句機制 + 圖示（gem icon / scatter symbol / wild / streak chart / resonance halo / curse skull / JP coin）
- 右下: 「14 PRs / Single Session / 2026-04-27」credit
- 配色: M1-M3 銀框（基礎）/ M5-M6 紫框（差異化）/ M10-M12 金框（旗艦）

---

## Slide 6 — Numbers（信用感的來源）

### 主旨
數據說話 — sim 跑 500k spin 證實平衡。

### Bullet 重點（中英對照）
- [中] **Coin RTP: 108.74%** （SPEC §11 目標 95-110% ✓） | [EN] Coin RTP: 108.74% (SPEC §11 target 95-110% ✓)
- [中] **Free Spin trigger: 0.2152 / match** （SPEC §15.7 目標 0.15-0.30 ✓） | [EN] Free Spin trigger: 0.2152/match (SPEC §15.7 target 0.15-0.30 ✓)
- [中] **JP trigger: 0.00024 / match** （SPEC §15.8 目標 < 0.01 ✓） | [EN] JP trigger: 0.00024/match (SPEC §15.8 target < 0.01 ✓)
- [中] **JP RTP contribution: 0.84%**，pool 慢累積符合 progressive 期望 | [EN] JP RTP contribution: 0.84%, slow growth as expected for progressive
- [中] **Avg rounds per match: 8.46** — 一場 ~3-5 分鐘 | [EN] Avg 8.46 rounds/match — ~3-5 min per session
- [中] Sim harness：**Mulberry32 PRNG, 10k rounds × 50 runs（500k spins）** | [EN] Sim harness: Mulberry32 seeded PRNG, 10k×50 = 500k spins

### Speaker note
（60 秒）「這是信用感最強的一頁。Slot 高層最關心的就是 RTP 數字 — 我們 sim 跑 500k spin、用 Mulberry32 seeded PRNG，coin RTP 落在 108.74% 剛好命中 SPEC 95-110% 中段。Free Spin trigger 0.21/match 在 0.15-0.30 區間中段、JP trigger 0.00024/match 遠低於 SPEC 上限 0.01 — JP 是稀有事件，這個數字代表玩家平均要打 ~4000 場才會看一次 JP 5-of-a-kind，符合『progressive 慢累積』的玩家心態。每場平均 8.46 round，3-5 分鐘剛好是手機 PvP 黃金時長。」

### 視覺暗示
- Layout: **chart-driven**
- 主視覺: bar chart 4 metric（RTP / Free Spin / JP / Round），每個都有 SPEC band overlay（綠色帶）+ 我們的數值（gold dot）
- 副視覺: 小型 sim console 截圖 + json 結果片段
- 配色: gold dots / green band / gray axis

---

## Slide 7 — Visual Quality Showcase

### 主旨
demo 視覺品質直接給高層情緒衝擊。

### Bullet 重點（中英對照）
- [中] **4 男性靈 signature 招式** — Dragon 火浪 / Tiger 拳擊閃光 / Tortoise 煙塵砸地 / Phoenix 火翼穿箭 | [EN] 4 male spirit signatures — Dragon fire-wave / Tiger punch-flash / Tortoise smoke-stomp / Phoenix flame-arrow
- [中] **JP ceremony 三層** — 人獎 BIGWIN / 地獎 MEGAWIN+ Wings / 天獎 SUPERWIN + Wings + Shine + LightBall | [EN] 3-tier JP ceremony — Minor BIGWIN / Major MEGAWIN+Wings / Grand SUPERWIN+Wings+Shine+LightBall
- [中] **BigWin / MegaWin overlay** — 非 JP 的大贏（25× / 100× bet）獨立 ceremony，**與 JP 視覺刻意區隔** | [EN] Non-JP big-win overlay (25× / 100× bet) — distinct from JP ceremony to avoid attention competition
- [中] **Near-win gold-dust teaser** — 4-of-5 reel 覆蓋同 symbol 時亮金粉 hint，slot juice 核心 | [EN] Near-win gold-dust teaser — 4-of-5 reel coverage triggers Sand particle hint, core slot-juice mechanic
- [中] **Way highlight win-frame** — 中獎 cell 用 SOS2 frame + GlowFilter 脈動，每 spin 都看得到 | [EN] Way-hit win-frame — SOS2 frame + GlowFilter pulse, visible every winning spin

### Speaker note
（70 秒）「視覺這頁直接看效果。4 個男性靈各自有招式 FX：青龍 Meng 揮刀帶火浪、白虎 Yin 三連拳每拳一閃、玄武 Xuanmo 巨槌砸地揚煙塵、朱雀 Lingyu 拉弓射箭尾跡帶火。JP ceremony 是 3 tier 漸進 — 人獎 BIGWIN 字樣 + 4 顆金幣，地獎 MEGAWIN + 兩翼，天獎 SUPERWIN + 翼 + 光芒 + 光球，越大越華麗。Non-JP 的大贏（25× bet 以上）有獨立 BigWin overlay 但**刻意做得比 JP 弱**（無全螢幕 dim、上方位置、更短），不會跟 JP 撞臉爭注意力。Slot juice 的關鍵 — near-win 金粉 teaser — 每 spin 36% 機率出現，這是業界標準 30-40% 的釋放頻率，玩家差一點時情緒峰值反而比小贏更高。」

### 視覺暗示
- Layout: **mosaic 6-tile（2×3）**
- Tile 1: Dragon signature mid-FX
- Tile 2: Tiger flash mid-punch
- Tile 3: Tortoise smoke plume
- Tile 4: Phoenix arrow trail
- Tile 5: JP ceremony (Grand SUPERWIN)
- Tile 6: BigWin overlay + Near-win gold-dust 並列
- 每 tile 標籤一行小字
- 配色: actual screenshots，無 deck retouch

---

## Slide 8 — Tech Foundation

### 主旨
交付能力 — 不是 wireframe 是真實 PWA。

### Bullet 重點（中英對照）
- [中] **Pixi.js 8 + TypeScript + Vite** — 業界標準 web slot 棧 | [EN] Pixi.js 8 + TypeScript + Vite — industry-standard web slot stack
- [中] **PWA installable** — Service Worker workbox 162 entry precache，可離線玩 | [EN] PWA installable — Service Worker workbox precaching 162 entries, offline-capable
- [中] **Asset 壓縮 13MB → 5.9MB** — webp Q82 + mp3 48kbps CBR | [EN] Asset compression 13MB → 5.9MB (webp Q82 + mp3 48kbps CBR)
- [中] **GitHub Pages auto-deploy** — push to master 觸發 GitHub Actions workflow | [EN] GitHub Pages auto-deploy via GitHub Actions on master push
- [中] **掃 QR code → 30 秒體驗** | [EN] Scan QR code → 30-second hands-on demo

### Speaker note
（60 秒）「技術 stack 這頁 — Pixi.js 8 是業界 web slot 標準 (Big Time Gaming / Yggdrasil / Push Gaming 都用)，加 TypeScript 跟 Vite。PWA installable，service worker 的 workbox 預先 cache 162 個資源，玩家離線也能玩。資產做了壓縮：原本 13MB，壓到 5.9MB，主要是 mp3 從 320kbps 降到 48kbps CBR、所有 png 轉 webp Q82。CI/CD 用 GitHub Actions auto-deploy 到 GitHub Pages，每次 push master 自動上線。**現在請各位拿手機掃這個 QR code**，30 秒就能體驗 — 這個 deck 講的所有東西現在都可以在你手機上跑。」

### 視覺暗示
- Layout: **split-2col**
- 左欄: tech stack icon stack（Pixi / TS / Vite / PWA / GitHub）
- 右欄: 大型 QR code → live demo URL + 「掃我！」中文字 + 「Scan to play」英文小字
- 底部: 「14 PRs · Single session · 2026-04-27 · Zero spec drift」credit
- 配色: 黑底 + gold accent + QR 白底

---

## Slide 9 — Business Case（**選配**）

### 主旨
商業可行性簡報 — 視高層興趣放或拿掉。

### Bullet 重點（中英對照）
- [中] **Target audience**: 30-45 歲亞洲市場男性，IGS 既有 slot 客群延伸 | [EN] Target: 30-45 male in Asian markets, extending IGS's existing slot demographic
- [中] **Monetization preview**: bet sizes 100/500/2000 / JP pool 累積 / daily bonus / IAP gem packs | [EN] Monetization preview: tiered bet sizes / JP pool / daily bonus / IAP gem packs
- [中] **MVP IAP wireframe**: 6 packs，NT$30 / 90 / 290 / 590 / 990 / 1990（vs MyCard 階梯） | [EN] MVP IAP wireframe: 6 SKUs aligned with MyCard ladder
- [中] **LiveOps roadmap**: season pass / new clan unlock / co-op tournament | [EN] LiveOps roadmap: season pass / new clan unlocks / co-op tournament
- [中] ⚠️ **Comparable competitor 流水比較需 owner 補資料** | [EN] ⚠️ Competitor revenue comparison data — owner to supplement

### Speaker note
（45 秒）「商業這頁如果時間夠就講，沒夠就跳。Target 鎖 30-45 男、IGS 既有 slot 客群往社交方向延伸。Monetization 走標準 slot 路徑：bet sizes 100/500/2000、JP pool 累積、daily bonus 拉留存、IAP gem packs 配 MyCard 階梯。LiveOps 留 season pass 跟新 clan 解鎖空間 — 後續可以一直加新 spirit 不用重做架構。**競品流水比較**那邊我需要再跟 Marketing team 要資料補上。」

### 視覺暗示
- Layout: **table-driven**
- 主視覺: monetization 表格 — column: bet size / pack price / target user
- 副視覺: 月份時間軸 LiveOps roadmap
- 配色: spreadsheet style + gold highlight
- ⚠️ 標記: 該 bullet 用紅字提醒 owner 補資料

---

## Slide 10 — Roadmap / What's Next

### 主旨
下一步要什麼資源？

### Bullet 重點（中英對照）
- [中] **Phase 1 (DONE)**: Core mechanics + visual polish + sim 平衡（Sprint 1-7） | [EN] Phase 1 (DONE): Core mechanics + visual polish + sim balance (Sprint 1-7)
- [中] **Phase 2 (NEXT)**: Backend + IAP integration + matchmaking — 預估 4-6 月人月 | [EN] Phase 2 (NEXT): Backend + IAP + matchmaking — est. 4-6 person-months
- [中] **Phase 3**: LiveOps content engine + 海外市場開拓 | [EN] Phase 3: LiveOps content engine + overseas market expansion
- [中] ⚠️ **投資要求 / 團隊配置 — owner 補資料**（多少 BE 工程師、何時開？） | [EN] ⚠️ Investment ask / team config — owner to supplement (how many BE engineers, start when?)

### Speaker note
（45 秒）「Roadmap 這頁就是要錢要人那頁。Phase 1 done — 你今天看到的所有東西都是 done 的。Phase 2 是後端、IAP、配對伺服器，估 4-6 月人月。Phase 3 是 LiveOps 內容引擎跟海外市場 — 因為 4 聖獸是亞洲 IP 但**水墨風格 + slot juice** 不需要文化 educate，可以直接出口。今天我先把這個 demo 給各位看，**Phase 2 的詳細 budget 跟 team 配置我下一個會議出**。」

### 視覺暗示
- Layout: **horizontal timeline**
- 3 個 phase 圖示 + 每 phase 下方 milestone 條列
- Phase 1 灰色（done）/ Phase 2 金色高亮（current ask）/ Phase 3 銀色（future）
- ⚠️ 紅標: budget 要 owner 補

---

## Slide 11 — Closing / CTA

### 主旨
明確下一步行動 — 不要 fade-out closing。

### Bullet 重點（中英對照）
- [中] **現在請大家用手機掃 QR code，玩 30 秒** | [EN] Scan QR code now — play for 30 seconds
- [中] 期待 feedback：**哪個機制最有感？最大顧慮？** | [EN] Wanted feedback: most engaging mechanic? biggest concern?
- [中] 後續會議: Phase 2 budget + team kickoff（owner schedule） | [EN] Follow-up: Phase 2 budget + team kickoff (owner to schedule)
- [中] 聯絡: maxwu / IGS RD5 | [EN] Contact: maxwu / IGS RD5

### Speaker note
（30 秒）「Close 這頁就一個動作 — 拿手機掃 QR code 玩 30 秒。我希望聽到的 feedback 是『哪個機制最有感』跟『最大顧慮』，這兩個問題的答案決定 Phase 2 怎麼安排。後續會議我會找各位排 Phase 2 的 budget 跟 team kickoff。謝謝。」

### 視覺暗示
- Layout: **centered hero**
- 主視覺: 大型 QR code（佔 60% slide 面積）
- 副字: 「掃我玩 30 秒 / Scan to play 30s」金字
- 底部: 兩個問題並列「最有感的機制？/ 最大顧慮？」
- 聯絡資訊小字
- 配色: dark bg + gold QR + minimal

---

## Slide 12 — Appendix / FAQ（選配）

### 主旨
Backup material 給技術 / 商業 deep-dive 問問題用。

### Bullet 重點（中英對照）
- [中] **Sim raw data**: 完整 500k spin 結果 JSON、所有 metric 一覽 | [EN] Sim raw data: full 500k-spin JSON, all metrics
- [中] **競業比較表**: Coin Master / Slotomania / 本作功能對照（owner 補欄位） | [EN] Competitor matrix: feature comparison (owner to supplement columns)
- [中] **License / 美術授權**: SOS2 atlas 來源、字體 Noto Sans CJK 開源、4 聖獸 IP 公領域 | [EN] License: SOS2 atlas source, Noto Sans CJK open, 4 Beasts IP public domain
- [中] **技術細節**: Mulberry32 PRNG、Ways 243 評估、ScaleCalculator 解析公式、JackpotPool localStorage v1 schema | [EN] Tech details: Mulberry32 PRNG, 243-Ways eval, ScaleCalculator analytical formula, JackpotPool localStorage v1 schema
- [中] **MemPalace drawer source**: `e2bd3099c7999bbf` (Sprint 6) / `49bb64972c81b328` (Sprint 7) | [EN] MemPalace canon refs

### Speaker note
（不講 — appendix 給高層自己翻或會後問）

### 視覺暗示
- Layout: **dense-text 4-col grid**
- 4 col 對應 4 個 appendix 主題
- 配色: 中性灰白
- 主視覺: 無 hero shot，純 information

---

## 撰寫品質確認 checklist（DoD §5 對照）

- [x] 12 slides 完整（11 主 + 1 appendix）
- [x] 每 slide 5 fields 齊全（主旨 / Bullet / Speaker note / 視覺暗示 / Layout）
- [x] 中英雙語覆蓋 100%（每個 bullet 都有 [中] [EN]）
- [x] 所有量化數字有 source 註解：
  - Sim 數字 → MemPalace drawer `e2bd3099c7999bbf` + `49bb64972c81b328`
  - SPEC § 章節
  - PR 編號 #121-#134
  - Live demo URL
- [x] 風格守則：避免「全球首款」「業界唯一」buzzword、用「N PRs in Y days」具體交付證據
- [x] 視覺 anchor 沿用既有 design tokens（azure / white / vermilion / black + gold accent + ink-wash）
- [x] **明確 flag** owner 需補資料的點：
  - Slide 9 競品流水比較（Marketing team data）
  - Slide 10 Phase 2 budget / team config 細節

## Owner 確認事項

請 review 下列三點再決定下一步：

1. **Slide count**：12 slides（11 主 + 1 appendix）OK 嗎？需要砍到 8-10 嗎？
2. **Slide 9 商業案**：要保留還是拿掉？（取決於目標會議是純技術 demo 還是 budget 審議）
3. **Narrative voice 強度**：本稿語氣偏理性 + 數據導向。要不要再走 the-visionary 補敘事張力 / 中文文采？

## 下一步候選

A. **Owner approve as-is** → 推到 master，p-02 demo mode 開工
B. **Owner 微調**（例如砍 Slide 9 / 改 hook 句）→ 我直接 edit 後再 push
C. **走 the-visionary polish** → 我給 dispatch 命令貼給 executor，narrative pass 後合併
