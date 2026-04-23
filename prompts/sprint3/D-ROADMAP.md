# Sprint 3 D · SOS2 Asset Integration Roadmap

> Sprint 3 D = SOS2 資產整合（Symbols + FX atlases）接續在 3A signature / 3B passive / 3C clan UI 之後，把「現成資產」注入 FX 層 + Symbol 視覺層，快速拉高製作價值。SOS2 專案雖為埃及奇幻主題，但其**形狀 + 金框 + 灰階可 tint FX** 的設計語言與我方東亞仙境金調完全相容。

---

## 總目標

- **Symbol**：把 reel 上的純 Graphics 幾何圖形換成 SOS2 帶金框的 3D 寶石（立即提升手感）
- **FX Atlas**：建立 `FXAtlas` loader 系統，讓所有 signature / near-win / big-win / passive 效果 reuse 同一批 SOS2 FX 素材
- **Per-clan tint**：SOS2 FX 多為灰階或白色，搭配 Pixi 8 `sprite.tint` 可一圖四色（azure/white/vermilion/black）

素材來源（`download_picture/slot-sos2-client-main/game/`）：

| 路徑 | 內容 | 用法 |
|---|---|---|
| `Img/Symbol/Symbol_00.png` ~ `Symbol_04.png` | 5 顆帶金框 3D 寶石（三角/菱/五邊/方/六邊） | 替換現有 Graphics 形狀符號 |
| `Img/Symbol/Symbol_05.png` ~ `Symbol_12_1.png` | 金幣/戒指/水晶/Horus eye | WILD / JP / Scatter 備用 |
| `Spine/BigWin/BigWin.png` | SUPER / MEGA BIG WIN 字樣 + 彩虹 halo + 金幣集 | Sprint 6 BigWin ceremony |
| `Spine/NearWin/FX_NearWin.png` | 金色粒子塵 + 拖尾 + 光束 | R3 anticipation 升級 |
| `Spine/Declare/FG_Declare_Fire.png` | 3 態煙/火（灰階） | dragon 吐息 + phoenix 火羽 + tortoise 煙塵 |
| `Spine/Scene/FX_Fly_Multiplier.png` | 彩虹環 + ring + sparkle | 倍率飛行（Sprint 5 Resonance） |
| `Spine/Scene/FX_Fly_Spawn.png` | 火柱 + halo + burst | 符號 spawn / 連擊 trail |
| `Spine/Scene/FX_WinFrame.png` | 星爆 + 光框 | 贏分 cell 外框閃光 |
| `Img/Win/OLD/Jpg/FX_Coins_1.png` | 金幣粒子 | phoenix coin-on-kill |
| `Img/Win/OLD/Jpg/FX_Particles_1.png` | 黃色 spark 粒子 | 通用 win 粒子 |
| `Img/Win/OLD/Jpg/FX_RainbowHalo_1.png` | 彩虹放射環 | JP 主視覺 |
| `Img/Win/OLD/Jpg/Win_FX_RadialLights.png` | 白色放射光線 | MegaWin 背景光束 |
| `Img/Win/OLD/Jpg/Win_FX_Wave.png` | 火焰波 | dragon 斬擊火光拖尾 |

---

## 工作項目序列

| # | 項目 | 檔案範圍 | 所屬 | 優先級 |
|---|---|---|---|---|
| **d-00** | **SOS2 資產匯入 chore** — 切片 + WebP Q82 壓縮 + commit 到 `public/assets/` | `public/assets/fx/` + `public/assets/symbols/gems/` | orchestrator | P0（本 sprint 前置） |
| **d-01** | FX Atlas Loader 系統 — 新 `src/fx/FXAtlas.ts`、preload 整合進 LoadingScreen、Sprite factory、tint helper | `src/fx/FXAtlas.ts` + `src/main.ts` + `src/screens/LoadingScreen.ts`（僅整合） | executor | P1 |
| **d-02** | Symbol reskin — SlotReel 用 SOS2 Symbol_00~04 取代現有幾何 Graphics（5 顆，形狀對應 SymbolsConfig） | `src/screens/SlotReel.ts` + `src/components/SpiritPortrait.ts` | executor | P1 |
| **d-03** | Phoenix coin-on-kill 視覺 — FX_Coins_1 金幣粒子從被擊殺 unit 噴向攻擊方 wallet，600ms | `src/screens/BattleScreen.ts`（`playPhoenixBonus` helper） | executor | P2 |
| **d-04** | Signature FX 升級（dragon / phoenix / tortoise）— FG_Declare_Fire 替代現有 Graphics 火焰/煙塵，per-clan tint | `src/screens/SpiritAttackChoreographer.ts` | executor | P2 |
| **d-05** | Near-win gold-dust teaser — R3 即將 hit 時 FX_NearWin 金色拖尾從 R2/R4 尾端飄向 R3，接 SPEC §5.2 條件延長 | `src/screens/SlotReel.ts`（`hasPreMatch` 條件分支內） | executor | P3 |
| **d-06** | Way highlight frame — FX_WinFrame 星爆外框替代現有 line highlight，持續 300ms 每 cell | `src/screens/SlotReel.ts`（`highlightWays` method） | executor | P3 |
| **d-07** | BigWin / MegaWin ceremony（預備 Sprint 6）— BigWin.png atlas + Win_FX_RadialLights 背景光束 + 金幣雨 | `src/fx/BigWinOverlay.ts`（新檔） | executor | P4（Sprint 6 再派） |

---

## 依賴鏈

```
d-00 (asset import chore)
  │
  └── d-01 (FXAtlas loader)
         │
         ├── d-03 (phoenix coin)         ◄─ depends on FX_Coins_1 + FXAtlas API
         ├── d-04 (signature FX upgrade) ◄─ depends on FG_Declare_Fire + FXAtlas API
         ├── d-05 (near-win dust)        ◄─ depends on FX_NearWin + FXAtlas API
         ├── d-06 (way highlight frame)  ◄─ depends on FX_WinFrame + FXAtlas API
         └── d-07 (big-win ceremony)     ◄─ depends on BigWin atlas + FXAtlas API
         
d-00 ──► d-02 (symbol reskin)            ◄─ Symbol_00~04 PNG，不需 FXAtlas
```

- **d-02** 與 **d-01** 可**並行**（不同檔案領域）
- **d-03~d-07** 必須等 **d-01** merge 後才能動

---

## Orchestrator 行動（d-00）

1. **切片** (sharp)：原 PNG 可能帶 meta padding，用 sharp `.extract()` 或直接 `.resize().webp({q:82})`
2. **命名**：`public/assets/fx/sos2-{kind}.webp`（kind ∈ coins / particles / rainbow-halo / radial-lights / fire-wave / near-win / declare-fire / fly-multiplier / fly-spawn / win-frame / bigwin）
3. **Symbol**：`public/assets/symbols/gems/gem-{shape}.webp`（triangle/diamond/pentagon/square/hexagon）
4. **Spine 切片注意**：`BigWin.png`、`FX_NearWin.png` 等是 spine atlas，有 `.atlas` 伴檔描述 region UV。**保留 .atlas 一起 commit**，讓 FXAtlas loader 解析 region 名稱定位
5. 壓完總大小目標：< 1 MB（現有 `public/assets/` 已 1.1 MB，Sprint 2 壓縮過；新增不得 > 30%）
6. Commit 到 seed branch `chore/sos2-assets-import` 後**直接提 chore PR**（orchestrator 可 admin-merge）
7. 更新 `prompts/README.md` + `public/assets/INDEX.md`（若有）記錄新資產

---

## 進度追蹤

| # | Status | PR |
|---|---|---|
| d-00 | pending | — |
| d-01 | prompt pending (after d-00 merge) | — |
| d-02 | prompt pending | — |
| d-03 ~ d-07 | roadmap only, prompts written after dependencies merge | — |
