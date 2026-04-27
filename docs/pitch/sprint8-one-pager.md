# Dual Slots Battle — Marketing One-Pager

**Format**: A4 portrait (210×297 mm / 8.27×11.69 in) primary
**Adaptable**: 同 layout 微調可切 Letter portrait / 1080×1920 social poster
**Audience**: IGS RD5 高層 review、合作夥伴 first-touch、demo 會議手冊
**Source canon**:
- p-01 deck outline `docs/pitch/sprint8-deck-outline.md`
- p-04 video script `docs/pitch/sprint8-hype-video-script.md`
- MemPalace drawers `e2bd3099c7999bbf` (Sprint 6) / `49bb64972c81b328` (Sprint 7)

---

## 1. Layout 結構（5 帶式）

A4 portrait 297mm 高，由上而下分 5 個帶（band），每帶高度比例固定：

```
┌─────────────────────────────────────┐  0mm
│                                     │
│   BAND A — Hero (75mm, ~25%)        │  ← logo + tagline + hero art
│                                     │
├─────────────────────────────────────┤  75mm
│                                     │
│   BAND B — 5 Selling Points (90mm)  │  ← 5 個機制卡片
│                                     │
├─────────────────────────────────────┤  165mm
│                                     │
│   BAND C — Numbers & Validation (50mm)│  ← 4 個 metric callouts
│                                     │
├─────────────────────────────────────┤  215mm
│                                     │
│   BAND D — 4-Beast Strip (40mm)     │  ← 4 clan icon mosaic
│                                     │
├─────────────────────────────────────┤  255mm
│                                     │
│   BAND E — CTA + Tech sidebar (42mm)│  ← QR + contact + tech specs
│                                     │
└─────────────────────────────────────┘  297mm
```

左右 margin 各 12mm（content 寬 186mm），上下 margin 各 6mm。

---

## 2. Band-by-Band Content

### BAND A — Hero (75mm)

**Visual**: 全寬 ink-wash dark navy 背景 + 金色水墨 logo + hero key art（BattleScreen 戰鬥中截圖佔右半）

**Content**:
```
[LOGO 水墨字「雙 Slot 對決」金色] —— 佔左 1/3，垂直中央

[Tagline 中]   東方四聖獸 × Vegas 1v1 對戰老虎機
[Tagline EN]   "4 Beasts of the East meets 1v1 Vegas-style PvP slots"

[Hero art]     BattleScreen 截圖佔右 2/3（雙方靈體對峙 + 中央 reel + 頂部 JP marquee）
```

**字體**: 中文「思源黑體 Heavy」42pt（tagline 中）+ 「Cambria Italic」14pt（tagline EN）

---

### BAND B — 5 Selling Points (90mm)

5 張橫排卡片，每張 32×88mm（含 5mm gap），cream 背景 + gold accent 框 + 圖示 + 標題 + 一句說明。

| # | 標題（中）| 標題（EN）| 一句話 | 圖示參考 |
|---|---|---|---|---|
| 1 | 真人對戰 | Real PvP | 不是打 RNG，是打彼此 — 1v1 即時對戰 | 兩 spirit 對峙剪影 |
| 2 | 5-pick Draft | Strategic Draft | 8 spirit 選 5 個組隊，clan 共鳴 ×1.5 加成 | DraftScreen 4 chips 圖 |
| 3 | 7 種 Slot Meta | 7 SPEC Mechanics | Wild/Scatter/Streak/Resonance/Curse/Free Spin/Jackpot | 7 個 chip icon mosaic |
| 4 | 3-Tier 漸進 JP | Progressive JP | 天/地/人獎 NT$5M/500k/50k localStorage 持久 | JP marquee + ceremony 截圖 |
| 5 | 業界級平衡 | Industry-grade RTP | sim 跑 500k spin RTP 108.74% 落 SPEC | Sim 數字疊加 chart |

**每卡格式**：
```
┌──────────────┐
│ [Icon 24×24] │  ← 上方居中
│              │
│ 真人對戰     │  ← 中文標題 16pt 思源黑體 Heavy
│ Real PvP     │  ← EN 11pt Cambria Italic
│              │
│ 不是打 RNG，  │
│ 是打彼此 —    │  ← 說明 9pt 思源黑體 Regular
│ 1v1 即時對戰  │
└──────────────┘
```

---

### BAND C — Numbers & Validation (50mm)

4 個大型 stat callout 並排，每個 42×44mm，cream 背景 + 大數字 + 標籤 + 「✓ SPEC」綠 mark。

| # | 大數字 | 標籤 | SPEC band |
|---|---|---|---|
| 1 | **108.74%** | Coin RTP | SPEC 95-110% ✓ |
| 2 | **0.21** | Free Spin / match | SPEC 0.15-0.30 ✓ |
| 3 | **0.00024** | JP / match | SPEC < 0.01 ✓ |
| 4 | **8.46** | Round / match | Target ~8 ✓ |

**字體**: 大數字 42pt Cambria Bold gold；標籤 11pt 思源黑體 Regular；SPEC 8pt italic 灰色。

副標題小字：「Mulberry32 PRNG · 10k×50 = 500k spins · 全 metric 命中 SPEC」

---

### BAND D — 4-Beast Strip (40mm)

四 clan icon 並排 + 中文名 + 一句被動，全寬 186mm 拆 4 等分（每格 ~46mm）。

| 青龍 Azure | 白虎 White | 朱雀 Vermilion | 玄武 Black |
|---|---|---|---|
| Dragon | Tiger | Phoenix | Tortoise |
| +20% dmg on 4+ way | -10% dmg taken | Coin-on-kill | Last-alive shield |

每 clan 用各自 color 做背景框：
- Azure `#4A90E2` 帶
- White `#E8E4D8` 帶（off-white 較沉穩）
- Vermilion `#C73E1D` 帶
- Black `#2C2C2C` 帶

中文 clan 名 18pt 思源黑體 Heavy 白字、EN 11pt Cambria Italic、被動 9pt Regular。

---

### BAND E — CTA + Tech Sidebar (42mm)

左右 split：
- **左 60%**: QR code（30×30mm）+ 「掃我玩 30 秒 / Scan to play 30s」+ live URL
- **右 40%**: tech specs 8 點 stack

**左欄內容**：
```
[QR code 30×30mm]         掃我玩 30 秒
                          Scan to play 30 seconds

                          igs-maxwu.github.io/
                          cmj2-dual-slots-pixi
```

**右欄內容**（tech specs，9pt 條列）：
```
TECH STACK
Pixi.js 8 + TypeScript + Vite
PWA · workbox 162 entries
Asset 13MB → 5.9MB compressed
GitHub Pages auto-deploy
14 PRs · single session
Zero spec drift
500k spin sim verified
4-Beast IP · 8 spirits · 7 mechanics
```

底部一行極小字 footer（7pt）：
```
Dual Slots Battle  ·  IGS RD5 Pitch  ·  2026  ·  maxwu  ·  drawer e2bd3099c7999bbf + 49bb64972c81b328
```

---

## 3. 配色 & 字體（與 deck / video 一致）

| 元素 | 色值 |
|---|---|
| Background dark | `#0D1421` (ink-wash navy) |
| Background light | `#F5EDE0` (cream) |
| Primary text dark | `#1A1F2E` |
| Primary text on dark | `#F5EDE0` |
| Accent gold | `#C9A961` |
| Accent vermilion | `#C73E1D` |
| Clan azure | `#4A90E2` |
| Clan white | `#E8E4D8` |
| Clan vermilion | `#C73E1D` |
| Clan black | `#2C2C2C` |
| SPEC pass green | `#8FBF7F` |

| 用途 | 字型 | 大小 |
|---|---|---|
| 大標題 | 思源黑體 Heavy | 42pt |
| 段標題 | Cambria Bold | 18pt |
| 中文 body | 思源黑體 Regular | 9-11pt |
| EN body | Cambria | 9-11pt |
| Stat number | Cambria Bold | 42pt |
| Footer | Calibri | 7pt |

---

## 4. Claude Design / Midjourney mockup prompt

下面這段 **整段複製貼到 Claude Design** 或 Midjourney（v6+），生成 A4 mockup：

````
Generate a single-page A4 portrait marketing one-pager (210×297 mm)
for a slot game pitch deck. Layout is divided into 5 horizontal bands:

BAND A (top, 75mm): Hero band with ink-wash dark navy background
(#0D1421). Left third holds a gold ink-brushed Chinese-style logo
reading "雙 Slot 對決" (large 42pt, gold #C9A961). Right two-thirds
shows a screenshot of a mobile slot battle scene — two character
parties facing each other across a 5×3 reel, with a gold marquee
banner across the top displaying jackpot amounts. Below the logo,
a tagline in two lines: Chinese "東方四聖獸 × Vegas 1v1 對戰老虎機"
14pt cream, then English italic "4 Beasts of the East meets 1v1
Vegas-style PvP slots" 11pt gold.

BAND B (middle-upper, 90mm): 5 horizontal cards on cream background
(#F5EDE0), each card 32×88mm with thin gold border. Card content top
to bottom: small icon 24×24mm, Chinese title 16pt heavy black,
English subtitle 11pt italic Cambria gray, one-line description
9pt regular. Cards in order:
1. 真人對戰 / Real PvP — 不是打 RNG，是打彼此 — 1v1 即時對戰
2. 5-pick Draft / Strategic Draft — 8 spirit 選 5 個組隊，clan 共鳴 ×1.5 加成
3. 7 種 Slot Meta / 7 SPEC Mechanics — Wild/Scatter/Streak/Resonance/Curse/Free Spin/Jackpot
4. 3-Tier 漸進 JP / Progressive JP — 天/地/人獎 NT$5M/500k/50k localStorage 持久
5. 業界級平衡 / Industry-grade RTP — sim 跑 500k spin RTP 108.74% 落 SPEC

BAND C (middle, 50mm): 4 large stat callouts on cream, each 42×44mm.
Big number in gold Cambria Bold 42pt, label below in 11pt heavy black,
SPEC tag in 8pt italic gray with green ✓:
- 108.74% / Coin RTP / SPEC 95-110% ✓
- 0.21 / Free Spin / match / SPEC 0.15-0.30 ✓
- 0.00024 / JP / match / SPEC < 0.01 ✓
- 8.46 / Round / match / Target ~8 ✓

Below in tiny italic gray: "Mulberry32 PRNG · 10k×50 = 500k spins · 全 metric 命中 SPEC"

BAND D (middle-lower, 40mm): 4 equal-width clan tiles spanning full
width. Each tile uses its clan color as background:
- Azure tile (#4A90E2): "青龍 Azure / Dragon / +20% dmg on 4+ way"
- White tile (#E8E4D8): "白虎 White / Tiger / -10% dmg taken"
- Vermilion tile (#C73E1D): "朱雀 Vermilion / Phoenix / Coin-on-kill"
- Black tile (#2C2C2C): "玄武 Black / Tortoise / Last-alive shield"
Each tile shows clan name 18pt heavy white, English 11pt italic, passive
description 9pt regular.

BAND E (bottom, 42mm): Split into two columns:
- Left 60%: QR code 30×30mm centered, with text "掃我玩 30 秒 /
  Scan to play 30s" 14pt heavy + URL "igs-maxwu.github.io/
  cmj2-dual-slots-pixi" 9pt gray
- Right 40%: Tech stack as 9pt bullet list — Pixi.js 8 + TypeScript +
  Vite / PWA · workbox 162 entries / Asset 13MB → 5.9MB compressed /
  GitHub Pages auto-deploy / 14 PRs · single session / Zero spec drift /
  500k spin sim verified / 4-Beast IP · 8 spirits · 7 mechanics

Visual motif: thin 2mm gold vertical bar (#C9A961) on the left edge
running the full 297mm height, signaling brand identity. Use Chinese
fonts 思源黑體 (Source Han Sans) for Chinese, Cambria for English.
Style: premium pitch document for an Asian gaming company, ink-wash
texture allowed in BAND A background only, all other bands clean cream.

Output format: A4 portrait, 300 DPI, PDF or PNG. Provide 2 versions:
(1) full color, (2) print-friendly grayscale.
````

---

## 5. 替代方案 — 若無 Claude Design 訂閱

| 工具 | 路線 | 預期時程 |
|---|---|---|
| **Figma** + 上面內容手動排 | 設計師 1 天 | NT$0（內部）/ NT$3000-5000（外包）|
| **Canva Pro** + A4 模板 | 套模板，手動填內容 | 3-4 小時，semi-pro 結果 |
| **PowerPoint** export to PDF | 用 deck Slide 4 + 6 + 7 拼貼 | 30 分鐘，最快 |
| **Midjourney v6** + 上面 prompt | AI 直接生圖，可能需 2-3 次 iteration | 1 小時，創意感較強 |

**推薦**: Figma 路線（IGS 內部設計師應有訂閱）— 上述 prompt 可直接給設計師當 brief，layout / 色票 / 字體 / 內容全部明確不需 back-and-forth。

---

## 6. 三件套 brand 一致性 Final Check

| 元素 | Deck (p-03) | Video (p-04) | One-pager (p-05) |
|---|---|---|---|
| Logo | 金字水墨「雙 Slot 對決」 | ✓ Shot 1 | ✓ BAND A |
| Primary palette | ink dark + cream + gold | ✓ | ✓ |
| Vermilion accent | 朱雀 + warning | ✓ | ✓ BAND D |
| Cambria + 思源黑體 | ✓ | ✓ | ✓ |
| 4-clan colors | Slide 4 grid | ✓ Shot 4 | ✓ BAND D |
| 7 mechanics | Slide 5 tiles | ✓ Shot 16 mosaic | ✓ BAND B card 3 |
| Sim numbers | Slide 6 | ✓ Shot 16 + 17 | ✓ BAND C |
| QR code | Slide 1/8/11 | ✓ Shot 18 | ✓ BAND E |
| Gold edge bar | ✓ all slides | (video 無) | ✓ left 2mm |

**Brand consistency: 100% — 三件套同色票同字體同 motif。**

---

## DoD 對照

- [x] A4 portrait 5-band 完整 layout
- [x] 每 band 內容文字稿（標題 / body / 一句說明）
- [x] 配色 / 字體規格表（hex + pt 全列）
- [x] Claude Design / Midjourney prompt 可直接複製
- [x] 替代方案表（Figma / Canva / PPT export / MJ）
- [x] 三件套 brand 一致性 final checklist

## Owner 待辦

- [ ] 選擇生成路徑（Claude Design / Figma 設計師 / Canva 自製 / PPT export）
- [ ] BAND A 的 hero art 來源確認（用 ?demo=1 capture 哪一場景？）
- [ ] BAND B card 1-5 的 icon set（重用 deck Slide 5 的 7 mechanics icons 或另設計）
- [ ] 完成日期目標（建議 demo 日 -3 day 完成）
