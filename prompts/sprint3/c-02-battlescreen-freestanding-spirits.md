# Sprint 3 C · 02 — BattleScreen 場上雀靈 free-standing 重設計（拿掉圓框，全身站姿）

## 1. Context

PR: **BattleScreen 的 3×3 formation 圓形 portrait 框設計太呆板，改為自然站姿群像（JRPG/Clash Royale 式）+ 無圓框**

Why: Owner reviews 2026-04-23 指出「原來的圓框中放角色好醜」。參考 mockup 顯示兩邊各 5 隻雀靈**像隊伍站在戰場上**，有前後排錯落感、無任何圓盤遮罩、角色看得到全身（頭到腳）。這是 Sprint 3 C「T7 4-beast theme depth」視覺升級的核心動作。

Source:
- Owner mockup image: `download_picture/dual-slot-pixi/battle-redesign/mockup.png`（⚠️ 執行前 Owner 會放進來；若找不到，STOP 等 owner）
- 既有 `src/screens/BattleScreen.ts` line 350-409 `drawFormation()` method 是主要改點
- 既有雀靈全身圖素材：`public/assets/spirits/{yin,canlan,zhuluan,...}.webp`（8 隻，已預 load 進 Pixi Assets）
- 既有 Formation 資料模型：`src/systems/Formation.ts` 3×3 grid（**不動**，只改視覺層）
- 既有 HP / glow / cross-mark / label 邏輯（**保留**，只是位置要重新對齊新 layout）

Base: master HEAD
Target: `feat/sprint3c-02-battlescreen-freestanding`

## 2. Spec drift check (P6 — mandatory)

1. `mempalace_search "BattleScreen formation redesign free standing spirits no circular frame"`
2. `Read download_picture/dual-slot-pixi/battle-redesign/mockup.png` — **必做**，這是 visual truth。若找不到該檔案，STOP 回報 owner 還沒放。
3. 確認 `SpiritPortrait` 類別仍被 **DraftScreen** (c-01 merged) 與 **SlotReel** 使用 — **本 PR 不能砍 `SpiritPortrait`**，只是 BattleScreen 不用它
4. 確認雀靈 webp asset key 格式：用 `Assets.get<Texture>(SYMBOLS[id].spiritKey)` 拿 texture（grep 既有 `SpiritPortrait.ts` line 74 `setSymbol()` 可看 pattern）

## 3. Task

### 3a. `drawFormation()` 重寫 — 拿掉 circular portrait + cell bg

**Before** (line 356-408 現狀要丟的)：
- 3×3 Container grid，每格 cell 含 `cell: Graphics` 底 + `SpiritPortrait` 圓框 + `label` HP 數字 + `crossMark` 死亡 ×
- `FORMATION_CELL` 正方形固定大小（約 68px 每格）

**After**：
- 每側 5 隻已選雀靈（3x3 grid 只填 5 格，data model 不變）放在**staggered two-row layout**：
  - Row "front"（靠近中央 VS）：3 隻（對應 formation col=0 對 A 側 / col=2 對 B 側 — 靠中軸）
  - Row "back"（靠外側）：2 隻（對應 col=2 對 A 側 / col=0 對 B 側 — 靠畫面邊緣）
  - 垂直 y 交錯：前排 y0，後排 y0-30（後排角色上移 30px 模擬深度）
- **不畫** cell 底、**不用** SpiritPortrait（拿掉圓 + ring + mask）
- **改用** 直接 `Sprite(Assets.get<Texture>(sym.spiritKey))`，`anchor.set(0.5, 1)` 底部中心 anchor 讓角色「站立」
- Size：**雀靈高 120~140px**（由 sprite 原始高度算 scale：`sprite.height = 130` 或維持 aspect）
- A 側雀靈 `scale.x` 維持正值；B 側 `scale.x = -1` 鏡像面向 A 側（**若雀靈素材原本面向左則反過來**）

### 3b. 新 Layout 常數（取代既有 FORMATION_* 常數中 CELL 相關）

```ts
// Two-row free-standing arena layout (replaces 3x3 grid visuals; data remains 3x3)
const SPIRIT_H              = 130;            // rendered sprite height
const ARENA_Y_FRONT         = 460;            // front-row baseline y (y=1 anchor)
const ARENA_Y_BACK          = ARENA_Y_FRONT - 34; // back row 34px higher
const ARENA_SPACING_FRONT_X = 72;             // horizontal gap between front-row spirits
const ARENA_SPACING_BACK_X  = 92;             // back-row wider gap
const ARENA_A_CENTER_X      = 176;            // A side front-row center
const ARENA_B_CENTER_X      = CANVAS_WIDTH - 176; // B side mirror
```

（若既有 `FORMATION_A_X` / `FORMATION_B_X` / `FORMATION_Y` / `FORMATION_CELL` 被**其他 method**使用，例如 coin burst getFormationUnitWorldPos，要同步更新該 method 回傳新 layout 的座標 — 不能留舊常數）

### 3c. Slot-to-position 對應

Formation grid 3×3 flat index = `row*3 + col`。本 PR 只畫 5 隻已選（`unit.alive === true` 或 `unit !== null` 的 5 格）。

A 側（5 隻自左上起往右下填）→ visual position 建議：

| Slot idx | Data (row, col) | Visual row | Visual x offset from A_CENTER |
|---|---|---|---|
| 0 | (0,0) | back  | -ARENA_SPACING_BACK_X  |
| 1 | (0,1) | front | -ARENA_SPACING_FRONT_X |
| 2 | (0,2) | front |  0                     |
| 3 | (1,0) | back  |  +ARENA_SPACING_BACK_X |
| 4 | (1,1) | front | +ARENA_SPACING_FRONT_X |
| (5,6,7,8 若存在) | back row 繼續延伸 | — | 若 drafted 額外雀靈落在這幾格，以同 pattern 往外擴 |

B 側 mirror（center X 相反方向，scale.x=-1 鏡像素材）。

**若 data 中 slot 不含雀靈（null），不畫**。既有 SPEC §4 規定每側必 5 隻，邏輯上不會有空洞，但防禦性檢查仍保留。

### 3d. HP label 與 death cross 重新定位

- HP 數字：顯示在雀靈**頭頂**（`y = -SPIRIT_H - 12` 相對 sprite，因 anchor=(0.5,1)）。12px Cinzel，alpha 0.75。
- Death cross ✕：覆蓋 sprite 中心（`y = -SPIRIT_H/2`），dim 色，alpha 0.85，寬度約 SPIRIT_H * 0.5
- Breathing glow（A3 既有）：改為**腳下圓形光環**（ellipse 底部地板，寬 SPIRIT_H*0.9、高 14，clan 色，alpha 0.3~0.6 呼吸）

### 3e. `cellsA` / `cellsB` 陣列結構

既有 `cells: CellRef[]` 陣列保留，但 `CellRef` 欄位更新：

```ts
interface CellRef {
  container: Container;      // anchor point
  sprite:    Sprite | null;  // spirit full-body (replaces portrait)
  label:     Text;
  glowRing:  Graphics;        // ground ellipse now (not roundRect ring)
  crossMark: Graphics;
}
```

既有 `redrawFormationCell(side, slot, hp)` 若存在繼續 reuse，只是 clear/fill 目標換成新 glow + label y。

### 3f. coin burst 位置 helper 對應（若存在）

若 `BattleScreen.ts` 已有 `getFormationUnitWorldPos(side, slotIdx)`（d-03 phoenix coin 可能加進來），**更新其計算方式以對應新 staggered layout**，保持金幣能正確飛到被殺雀靈位置。

### 3g. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts`（drawFormation 重寫 + 新 layout 常數 + cell struct 更新，淨變動約 +80 / −60 行）

**禁止**：
- `src/components/SpiritPortrait.ts` — 不動，DraftScreen + SlotReel 還在用
- `src/systems/Formation.ts` — data model 不動
- SlotReel / DraftScreen — 分屬 d-02 與 c-01 完畢
- 新增 asset（用既有 `spiritKey` webp）
- SPEC.md / DesignTokens.ts

**若發現 mockup 與 spec 衝突（例如兩邊各超過 5 隻），STOP 回報**。

### 3h. §3 進階（選配，若 >15 行請跳過）

- 雀靈待機動作：緩慢 `y += sin(t)*2` 浮動（呼吸）
- clan 顏色腳下光環擴散 pulse（已在 3d 提到）
- 死亡時 sprite 變灰 (ColorMatrixFilter saturation 0) + 半透明

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- Mockup image 是 visual truth — 若你讀到的圖跟 prompt 描述有衝突以 mockup 為準
- anchor (0.5, 1) = 底部中心 — 對角色 y 座標代表地板線，算 HP label 位置要反向
- B 側 `scale.x = -1` 鏡像是為了朝向 A 中央（多數雀靈素材朝左）— 若執行中發現某個雀靈是朝右，STOP 回報，這表示素材面向不一致（應該由 orchestrator 修，不是你）
- `BattleScreen.ts` 編輯 ≥ 3 次無法過 build → STOP 回報
- onUnmount 時 sprite / label / glowRing / crossMark 都要透過 container.destroy({children:true}) 連根拔起（既有 pattern 保持）

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：預期 0（若有 mockup 細節取捨差異列出）
- Dependencies：無
- 是否有做 §3h 進階（呼吸浮動 / 地板 pulse / 死亡變灰）
- 確認 `npm run build` + preview 啟動零 console error
- 附 1 張 preview 截圖（若便利）或描述 staggered layout 實際看起來位置對不對
