# Sprint 10 — BattleScreen 視覺 Audit Report

**Author**: the-stylist subagent (orchestrator dispatched 2026-04-27)
**Trigger**: Owner Sprint 9 完成後親身試玩，視覺不滿意，提供截圖
**Output**: P0-P2 audit findings + 改善方向 + Sprint 10 polish PR 規劃 + 2 個 Claude Design mockup prompts

---

## §1 Audit Findings

### P0 — Blocking bugs（demo-killer，立即修）

#### P0-A：標題被 VS badge 切斷（readability = 0）
- `drawHeader()` 的 title text `雀靈戰記 · BATTLE` 在 `y=49`，VS badge 在 `y=99` width 96
- Title 渲染寬 ~280px (x=220..500)，badge bbox 312..408
- **Badge disc 直接打在 title 中段** → 「雀靈戰」+「ATTLE」被切開
- 兩元素競爭同水平帶（y≈49-99），無 z-order 分隔

#### P0-B：Reel 四角白塊
- `SlotReel.buildFrame()` 嘗試載入 `dragon-corner` texture
- 若 asset 沒載入或 key 不對 → `cornerTex` 為 null → 走 `if` 條件下跳過
- **但 `Sprite(Texture.WHITE)` fallback 可能在 `gemSprite` 初始化或 dragon-corner 構建時殘留**
- 結果：所有四角出現 120×120 白色方塊 = missing-asset fallback

#### P0-C：綠色 HP bar 浸入 JP 區
- 詳細根因：`ARENA_Y_BACK = 426`, `UNIT_HP_BAR_Y_OFF = -(SPIRIT_H+22) = -152`
- 後排 spirit HP bar 位置：`426 - 152 = 274`
- JP panel 範圍 `JP_AREA_Y=138` 到 `138+200=338`
- **274 在 JP 範圍正中間** → green `HP.high=0x39d274` 染色 fill 浸入 JP 區
- 副因：9-slot loop 為 unused slots 5-8 也建 container，`hpFill` 缺 `visible=false` guard 時會殘留

---

### P1 — Significant polish gaps

#### P1-A：Reel cells 稀疏（gem 佔 cell 不足）
- `targetSize = 0.80 × min(128,150) = 102px`，cell 128×150 portrait → 上下死空間 48px
- Gem 看起來「漂浮」在大格中，無 secondary decoration

#### P1-B：無視覺 weight hierarchy
- Spirit zone (y=360-610, 250px) 跟 reel zone (y=610-1150, 540px) 雖然 reel 高 2.16×，但兩者背景一致 → 視覺上等量
- 沒有「battle stage」vs「slot machine」的識別感
- 從 y=50 到 y=1150 是一整塊不分區的暗矩形

#### P1-C：太多 gold accent 同時競爭（8 個）
- ROUND pill border / title text / JP marquee panel border / JP grand text + glow / JP major + glow / JP minor + glow / reel frame ornament / dragon-corner / 「BACK TO DRAFT」
- Gold 失去 hierarchy 信號意義 — 無法回答「現在最該注意什麼？」

#### P1-D：Perspective floor 太弱（contrast < 3:1）
- 8 條收束線 `GOLD.shadow alpha=0.15` 在 `SEA.abyss` 上對比 ~1.3:1（人眼閾值以下）
- 加上 grid overlay + vignette 三個 sub-threshold layer 競爭 → 視覺噪音不貢獻深度

#### P1-E：Spirit 站位擁擠
- Front row span ~32-320 (A) / 400-688 (B)，back row 84-268 / 452-636
- 兩側 back row 中央僅 184px gap，5v5 chibi 在這空間擠

---

### P2 — Minor polish

| ID | 問題 | 建議 |
|---|---|---|
| P2-A | `zIndex=80` 但 container `sortableChildren` 未啟用 → zIndex 是 cosmetic 沒效 | 加 `this.container.sortableChildren = true` |
| P2-B | ROUND pill 「ROUND 00」字數冗餘（5 字 label + 數字共 8 字塞 140px pill） | 拆 `R` muted + `01` 大字 |
| P2-C | logText `FG.muted` 11px 在暗 bg 對比 ~2.8:1（WCAG AA 不過）→ 看不到 | `FG.cream` 13px |
| P2-D | 「BACK TO DRAFT」字串太工程感 | 改「RETREAT」或「END BATTLE」 |
| P2-E | JP 區跟 spirit 區之間無視覺分隔 | 加既有 `divider` sprite at y=346 |

---

## §2 Sprint 10 Polish Track — PR 規劃

### Dependency map

```
[p10-bug-01] (no dep) ──┐
[p10-v03]    (no dep) ──┤
                         ▼
                  [Claude Design mockup approval]
                         ▼
                  [p10-v01 layout reset]
                         ▼
                  [p10-v02 reel cells]
                         ▼
                  [p10-v04 gem art upgrade] (art-gated)
```

### PR list

| PR | Size | Scope | Dependencies | Mockup gated? |
|---|---|---|---|---|
| **p10-bug-01** | S (1 day) | 3 P0 bugs + zIndex sortableChildren | 無 | 否 |
| **p10-v03** | S (1 day) | Gold budget (8→3) + colour reassign + ROUND pill 拆 + log contrast + button copy | 無（可平行 mockup review）| 否 |
| **p10-v01** | M (2 day) | Layout hierarchy reset — arena panel + reel warm bed + 重新限制 perspective floor + zone separator | mockup approved | **是** |
| **p10-v02** | S (1 day) | Reel cell polish — targetSize 0.80→0.90 + inner ring + tier pip | p10-v01 merged | 否 |
| **p10-v04** | L (1 sprint) | 客製 8 spirit gem PNG art 取代 programmatic tint | p10-v02 + 美術 asset 交付 | **是**（gem art mockup） |

### 推薦 dispatch 順序

1. **p10-bug-01 立刻 dispatch**（零依賴，純修）
2. **p10-v03 平行 dispatch**（無 design risk，純 colour/copy）
3. **同時跑 Claude Design mockup review**（mockup 1 in §3）
4. mockup approved → **p10-v01 dispatch**
5. p10-v01 merged → **p10-v02 dispatch**
6. 美術 asset 交付 → **p10-v04 dispatch**（可能 Sprint 11）

預計 4-6 dev-day 跑完 p10-bug-01 + p10-v03 + p10-v01 + p10-v02。p10-v04 視美術交付決定是 Sprint 10 收尾還是 Sprint 11。

---

## §3 Claude Design Mockup Prompts

### Mockup 1：For p10-v01 layout hierarchy reset

完整 prompt 已寫好（見 the-stylist 報告），可直接複製貼到 `claude.ai/design`：

> 設計 720×1280 portrait mobile game battle screen，Chinese mythological 1v1 slot-battle game「雀靈戰記」。輸出 2 variant：A 強調 JP marquee / B 強調 battle arena。
>
> 完整 palette + 各 zone y 座標 + content + spirit aesthetic + 安全區規範...
>
> （詳細見本檔 `prompts/sprint10/p10-v01-prompt.md` 提取版）

### Mockup 2：For p10-v04 gem art upgrade

8 spirit gem 100×100 sprite sheet，puzzle-and-dragons 等級品質，dark outline 2px，inner light bloom，transparent bg。

完整 prompt 同上。

---

## §4 Orchestrator Action Items

### 立刻（in this session）
- [ ] 寫 `prompts/sprint10/ROADMAP.md`
- [ ] 寫 `prompts/sprint10/p10-bug-01-arena-bleed-asset-fix.md`（dispatch ready）
- [ ] 寫 `prompts/sprint10/p10-v03-gold-budget.md`（可平行 dispatch）
- [ ] 把 mockup 1 prompt 提取到 `prompts/sprint10/p10-v01-mockup-prompt.md` 給 owner 跑 Claude Design
- [ ] 把 audit report 跟 mockup 都 commit 到 master

### Owner 待辦
- [ ] 跑 mockup 1 prompt → review variant A vs B → 選一個方向給我
- [ ] 跑 mockup 2 prompt（若決定要做 p10-v04 gem art upgrade）→ 拿圖
- [ ] 找美術 / Midjourney 生成 8 個 gem 對應 art（p10-v04 需要）

### 不在 Sprint 10 scope 的問題
- 即時對戰 backend / matchmaking（SPEC §17 Phase 2）
- spirit 角色重繪（用既有 art）
- Sound / SFX 重做

---

## Stylist 結論摘要

> Sprint 10 應優先做 **p10-bug-01** 立刻 — 因為角落白塊 + JP 區綠 bar 是 demo-killer，**任何 stakeholder 看到的截圖 / 影片有這些 bug，會直接 read 為「unshipped prototype」**。
>
> 第二優先 **p10-v03 (gold budget)** 可以平行跑（無 design risk），把 8 個金色 accent 砍到 3 個就能整體拉一個檔次。
>
> 第三優先 **p10-v01 (layout hierarchy)** 嚴格 **mockup-gated** — 在 p10-bug-01 dispatch 同時 owner 應該跑 Claude Design mockup review，等 bug 修好時 design 已經批准。
>
> p10-v02、p10-v04 是 polish 不是 fix，可以排到 Sprint 11 若美術沒到位。
