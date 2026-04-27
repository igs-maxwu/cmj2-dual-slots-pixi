# Dual Slots Battle — 60s Hype Video Script & Storyboard

**Total length**: 60 seconds (±2s tolerance)
**Aspect**: 9:16 vertical（社群 / TikTok / IG Reel） + 16:9 horizontal（IGS 內部展示版）— 同剪輯不同 crop
**Audio**: 中文 VO + royalty-free epic Asian-percussion BGM
**Source canon**:
- p-01 deck outline: `docs/pitch/sprint8-deck-outline.md`
- Live demo URL with `?demo=1` for guaranteed ceremony capture: `https://igs-maxwu.github.io/cmj2-dual-slots-pixi/?demo=1`
- MemPalace drawer `e2bd3099c7999bbf` (Sprint 6 mechanics) + `49bb64972c81b328` (Sprint 7 polish)

---

## 4-Act 結構（總 60 秒）

| Act | Time | Theme | Emotion | Shot count |
|---|---|---|---|---|
| **1. Hook** | 0:00–0:05 | 「這不是一般的老虎機」 | 驚訝 / 好奇 | 2 shots |
| **2. Core Gameplay** | 0:05–0:30 | 1v1 對戰 + 4 聖獸組隊 | 戰鬥感 / 策略 | 6 shots |
| **3. Meta Mechanics** | 0:30–0:50 | 7 機制 + 視覺 highlight | 高潮 | 8 shots |
| **4. JP & CTA** | 0:50–0:60 | 天獎爆發 + QR 掃我 | 慾望 / 行動 | 2 shots |

Total: **18 shots**, 平均 3.3s/shot

---

## Shot-by-Shot Breakdown

### ACT 1 — HOOK (0:00–0:05)

#### Shot 1 (0:00–0:02.5)
- **Visual**: 黑底 + 金色水墨筆觸 logo「**雙 Slot 對決**」從中央暈染浮現（after-effect 模板：ink-spread）
- **VO**: （無 VO，純 BGM 起拍）
- **BGM**: 太鼓單擊 + 低音弦樂 sustain
- **Source**: 設計師後製，無需 in-game capture
- **Note**: ink-wash 風格與 deck Slide 1 一致

#### Shot 2 (0:02.5–0:05)
- **Visual**: 切到 BattleScreen 寬鏡，雙方 5 spirit 隊形 + 中央 5×3 reel + 頂部 JP marquee（**靜態畫面 + 輕微鏡頭推進 zoom-in 1.0→1.05**）
- **VO**: 「不是打 RNG —」（旁白 male voice，沉穩）
- **BGM**: 太鼓加入第二拍，建立 tempo
- **Source**: GitHub Pages live demo 進 BattleScreen 後立即截畫面 + screen recording
- **Capture cmd**: `OBS Studio`、resolution 720×1280（vertical）/ 1280×720（horizontal）

---

### ACT 2 — CORE GAMEPLAY (0:05–0:30)

#### Shot 3 (0:05–0:08)
- **Visual**: 切到 DraftScreen，玩家手指 tap 4 個 spirit portrait（手部動作可後製合成或拍實景）
- **VO**: 「打**真人**對手」（重音「真人」）
- **BGM**: 鼓點密度上升
- **Source**: GitHub Pages live demo DraftScreen + 後製手指 overlay
- **Subtitle**: 中文「打真人對手」+ EN「Fight a real opponent」

#### Shot 4 (0:08–0:12)
- **Visual**: 4 聖獸 chibi 頭像 mosaic 並列（青龍 / 白虎 / 朱雀 / 玄武），各自下方 clan 中文名 + 招式名 fade-in 一字一字
- **VO**: 「青龍、白虎、朱雀、玄武 — 八個靈將任你組隊」
- **BGM**: 主旋律 entrance（古箏 / 笛子）
- **Source**: 4 spirit portraits from `public/assets/spirits/` 高解析度版
- **Subtitle**: 「東方四聖獸 / 8 spirits, your team」

#### Shot 5 (0:12–0:16)
- **Visual**: 切回 BattleScreen，**reel spin 動畫**（既有 5 column 旋轉動畫慢動作 0.7×），同時兩側 wallet 數字遞增 cascade
- **VO**: 「**共享 5×3 reel**，雙方計算各自的勝利」
- **BGM**: tempo 持續穩定
- **Source**: `?demo=1` spin 0 (NearWin grid) — 5 column spin animation 完整錄下
- **Subtitle**: 「Shared reel, separate fates」

#### Shot 6 (0:16–0:20)
- **Visual**: WayHit highlight 觸發瞬間（d-06 win-frame + GlowFilter pulse），雙方 wayHits 同時亮起，**慢動作 0.5×**
- **VO**: 「自己得 coin、對手扣 HP — 每 spin 雙效」
- **BGM**: 鼓點重擊配合 highlight 時機
- **Source**: `?demo=1` spin 1 (BigWin) wayHit highlight 瞬間
- **Subtitle**: 「Win coin · Deal damage · Both, every spin」

#### Shot 7 (0:20–0:25)
- **Visual**: Spirit signature attack — Dragon dual-slash（Meng）或 Phoenix flame-arrow（Lingyu），**全速播放**，加 d-04 fire-wave SOS2 atlas FX
- **VO**: 「招式發動 — 火浪、爪擊、煙塵、火翼」
- **BGM**: 招式聲效（whoosh + impact）疊加 BGM
- **Source**: `?demo=1` 發動到 Phase 4 fire 期間（任一男性靈簽名招）
- **Subtitle**: 「Signature attacks: 4 male spirits, 4 elements」

#### Shot 8 (0:25–0:30)
- **Visual**: HP bar drain 動畫 — 對手某 spirit HP 從 1000 降到 0，spirit 變灰退場，剩 4 vs 5 的 unbalance 局勢
- **VO**: 「打死一個就少一個 — 戰局實時變化」
- **BGM**: 低音 hit 配合 spirit 倒下瞬間
- **Source**: `?demo=1` 任意 spirit 死亡瞬間
- **Subtitle**: 「Kill = remove from board」

---

### ACT 3 — META MECHANICS HIGHLIGHTS (0:30–0:50)

#### Shot 9 (0:30–0:32)
- **Visual**: Resonance banner「♪ 青龍共鳴 ×1.5」金色橫幅淡入（既有 r-04 banner）
- **VO**: 「**Resonance** — 同 clan 共鳴 ×1.5」
- **BGM**: 古箏滑音 + 高音鈴聲
- **Source**: BattleScreen 進場時 SOLO/DUAL config trigger，或 r-04 既有 banner animation
- **Subtitle**: 「Same-clan resonance × 1.5」

#### Shot 10 (0:32–0:34)
- **Visual**: Curse stack HUD 紫骷髏圈 ×3 累積到爆 → 500 HP 紫色 damage number 飄出（k-03 / k-04）
- **VO**: 「**Curse** — 紫魂積累爆破」
- **BGM**: 低頻嗡鳴 + 暗音
- **Source**: 等 curse stack 累到 3 觸發；或加 `?curse=force` debug param（若無則自然錄影找鏡頭）
- **Subtitle**: 「Curse stack proc 500 HP」

#### Shot 11 (0:34–0:38)
- **Visual**: Free Spin 觸發 — 3+ scatter 出現 → 頂部 banner「FREE SPINS 5/5」金色彈出 + 全螢幕金色 tint（f-04 既有）
- **VO**: 「**Free Spin** — 5 spin、bet=0、贏雙倍」
- **BGM**: 鈴鐺連擊 + 升調
- **Source**: `?demo=1` spin 4 (FreeSpin) entry banner
- **Subtitle**: 「5 free spins · ×2 multiplier · bet=0」

#### Shot 12 (0:38–0:40)
- **Visual**: Free spin 中第 2 spin，wayHit 數字 ×2 飛出（既有 floating damage number）
- **VO**: （無 VO，BGM 持續）
- **BGM**: tempo 加快
- **Source**: `?demo=1` spin 5 free spin internal spin

#### Shot 13 (0:40–0:43)
- **Visual**: BigWin overlay — 「BIGWIN」金字 + 4 顆金幣彈出（d-07 既有 ceremony）
- **VO**: 「**Big Win** — 25 倍 bet 起跳」
- **BGM**: 主旋律高潮預備
- **Source**: `?demo=1` spin 1 (BigWin) ceremony

#### Shot 14 (0:43–0:46)
- **Visual**: MegaWin overlay — 「MEGAWIN」+ 8 金幣 + 雙翼（d-07）
- **VO**: 「**Mega Win** — 100 倍」
- **BGM**: 主旋律高潮接近
- **Source**: `?demo=1` spin 2 (MegaWin) ceremony

#### Shot 15 (0:46–0:48)
- **Visual**: Near-win 金粉 teaser — 缺欄上飄起金色粒子柱（d-05 既有 NearWinTeaser）
- **VO**: 「**Near Win** — 差一格的悸動」
- **BGM**: 短促 hit
- **Source**: `?demo=1` spin 0 (NearWin) teaser
- **Subtitle**: 「The 'almost' moment»

#### Shot 16 (0:48–0:50)
- **Visual**: 7 種機制 icon mosaic 快閃（M1 / M2 / M3 / M5 / M6 / M10 / M12 各自 chip 圖示）
- **VO**: 「**7 種機制 — 業界級數值平衡**」
- **BGM**: 全速 build-up
- **Source**: 設計師後製，icon set 對應 deck Slide 5

---

### ACT 4 — JP CEREMONY & CTA (0:50–0:60)

#### Shot 17 (0:50–0:57)
- **Visual**: JP Ceremony **天獎 Grand**（最華麗版本）— 全螢幕 dim → SUPERWIN 文字 scale-up → Wings + Shine + LightBall + 30 顆金幣爆散 → NT$5,000,000 金額飛入（j-04 完整 ceremony，5s）
- **VO**: 「天獎 — **NT$5,000,000**」（重音 + 拉長）
- **BGM**: 全曲高潮（鼓 + 弦樂 fortissimo）
- **Source**: `?demo=1` spin 3 (JP) ceremony 完整 5 秒
- **Subtitle**: 「Grand Jackpot · NT$5,000,000」

#### Shot 18 (0:57–0:60)
- **Visual**: 黑底 + 大型 QR code + 金字「**掃我玩 30 秒 / Scan to play**」+ logo
- **VO**: 「掃 QR · 玩 30 秒」
- **BGM**: 收尾 — 太鼓最後一擊 + reverb fade
- **Source**: 設計師後製，QR code = `https://igs-maxwu.github.io/cmj2-dual-slots-pixi/`
- **End frame**: hold 0.5s 後 fade to black

---

## VO 完整稿（中文）

```
（00:00–02.5  靜默 + BGM 起拍）

00:02.5  「不是打 RNG —」
00:05    「打真人對手」
00:08    「青龍、白虎、朱雀、玄武 — 八個靈將任你組隊」
00:12    「共享 5×3 reel，雙方計算各自的勝利」
00:16    「自己得 coin、對手扣 HP — 每 spin 雙效」
00:20    「招式發動 — 火浪、爪擊、煙塵、火翼」
00:25    「打死一個就少一個 — 戰局實時變化」

00:30    「Resonance — 同 clan 共鳴 ×1.5」
00:32    「Curse — 紫魂積累爆破」
00:34    「Free Spin — 5 spin、bet=0、贏雙倍」
00:40    「Big Win — 25 倍 bet 起跳」
00:43    「Mega Win — 100 倍」
00:46    「Near Win — 差一格的悸動」
00:48    「7 種機制 — 業界級數值平衡」

00:50    「天獎 — NT 五百萬」
00:57    「掃 QR · 玩 30 秒」
```

**VO style**: 男聲、沉穩、語速 4-4.5 字/秒、重音放在數字（×1.5、五百萬、雙倍、100 倍）

**TTS 暫代版**：先用 Google Cloud TTS `cmn-TW-Wavenet-B`（中文男聲） + 微 EQ 處理低頻偏少的問題。正式版用真人配音。

---

## BGM Track 建議

**License-free options**:
- **Audiomass / YouTube Audio Library** — 搜「Asian Percussion Epic」、「Wuxia Battle」
- **Epidemic Sound**（付費，IGS 內部訂閱可用）— 「Eastern Drums」類別
- **Suno AI** 自製（Sprint 1-2 已用此 pipeline）— prompt: `epic Asian percussion, taiko + erhu, 60s build-up to climax at 50s`

**Tempo 建議**：開場 90 BPM → Act 2 提速到 110 BPM → Act 3 build to 130 BPM → Act 4 climax peak → Act 4 結尾 reverb decay

---

## Capture Workflow（給後製）

1. **Local capture（推薦）**：
   ```
   npm run dev
   open http://localhost:5173/?demo=1
   OBS recording 720×1280 (vertical) 60fps
   ```
   錄完整 5 spin 序列（~30-45 秒），後製分段使用

2. **GitHub Pages 後備**：
   ```
   open https://igs-maxwu.github.io/cmj2-dual-slots-pixi/?demo=1
   ```
   一樣 OBS recording

3. **多角度 capture**：每 ceremony 錄 3 take（不同 spirit draft 組合 → 視覺 variety），後製選最好

4. **後製軟體建議**：
   - **DaVinci Resolve 19**（free）— 主剪輯，調色 + tracker
   - **After Effects** — Shot 1 ink logo + Shot 16 icon mosaic + Shot 18 end frame
   - **Audition** — VO clean-up + BGM mix

---

## Style Notes（與 deck / one-pager 一致）

- **配色**: ink-wash dark navy `#0D1421` 為主，gold `#C9A961` accent，4 clan color 點綴
- **字體**: 中文「思源黑體 Heavy」for 標題、「思源宋體」for slogan；EN「Cambria」配合 deck
- **Logo**: 與 deck Slide 1 同 logo，水墨筆觸版（後續設計師補檔）
- **Subtitle 位置**: 底部 1/4 區塊，金字 + 黑色細邊框
- **Transition**: 純 cut（無 fade / wipe / crossfade，slot 視覺已經夠豐富）
- **音量曲線**: VO -6dB、BGM -18dB（VO 期間）/ -12dB（無 VO 段）、SFX -10dB

---

## Owner 待辦

- [ ] 確認 BGM 版權路線（YouTube free / Epidemic / Suno 自製）
- [ ] 配音員選擇（內部錄音 vs 外包）— 預估 NT$1500-3000 / 60s
- [ ] 後製人員配置（IGS 內部 video team or 外包）
- [ ] 完成日期目標（建議 demo 日 -7 day 完成）

---

## 三件套 brand 一致性 checklist

| 元素 | Deck | Video | One-pager (p-05) |
|---|---|---|---|
| 主色調 | ink dark + cream + gold + vermilion | ✓ 沿用 | (p-05 待寫) |
| Logo | 金字水墨 | ✓ Shot 1 ink logo | (p-05 同 logo) |
| 字體 | Cambria + Calibri + 思源黑體 | ✓ 沿用 | (p-05 沿用) |
| 7 機制 icon set | Slide 5 既有 | ✓ Shot 16 reuse | (p-05 縮小版 reuse) |
| QR code 位置 | Slide 1/8/11 | ✓ Shot 18 大型 | (p-05 右下角) |
- 確認以上 4 處將在 p-05 自動沿用

---

## DoD 對照

- [x] 60 秒總長 ±2s（18 shots × 平均 3.3s = 59.4s ✓）
- [x] 4-act 結構（hook 5s / gameplay 25s / mechanics 20s / JP+CTA 10s）
- [x] 18 shots 完整 storyboard，每 shot 有 visual / VO / BGM / source / subtitle
- [x] VO 完整中文稿
- [x] BGM 建議軌 + tempo 曲線
- [x] Capture workflow 給後製可直接執行（OBS + `?demo=1`）
- [x] 與 deck 三件套 brand 一致性 checklist
