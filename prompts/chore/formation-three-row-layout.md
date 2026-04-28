# Chore — Spirit formation 改三排「九宮格」站位（owner 試玩 feedback）

## 1. Context

PR: **Spirit formation 從現有「2 back + 3 front」兩排改成「1 back + 2 mid + 2 front」三排，強化 depth illusion + 解前排擁擠問題。**

Why: Owner 試玩 Sprint 10 升級後 BattleScreen，反映「**雀靈的排列應該是九宮格，感覺下面兩排疊在一起**」。截圖顯示 3 個前排 spirit (SPIRIT_H=130) 在 ARENA_SPACING_FRONT_X=80 spacing 下**互相重疊** — 80px 中心距 < 130px 寬度。同時兩排的 visual depth 感不夠（用戶心中期望 3 排陣型）。

當前狀態：
```
LAYOUT[5] (slotToArenaPos line 860-879):
  slot 0: BACK,  xOff: -60       // 後排左
  slot 1: FRONT, xOff: -80       // 前排左 ← 與 slot 2 互疊（80 < 130/2+130/2=130）
  slot 2: FRONT, xOff: 0         // 前排中 ← 與 slot 1, 4 互疊
  slot 3: BACK,  xOff: +60       // 後排右
  slot 4: FRONT, xOff: +80       // 前排右 ← 與 slot 2 互疊
ARENA_Y_FRONT=510, ARENA_Y_BACK=290 (220px gap, 兩排明顯)
```

設計目標（三排）：
```
新 LAYOUT[5]:
  slot 0: BACK,  xOff: 0          // 後排中 (孤獨大將，最遠)
  slot 1: MID,   xOff: -ARENA_SPACING_MID
  slot 2: MID,   xOff: +ARENA_SPACING_MID
  slot 3: FRONT, xOff: -ARENA_SPACING_FRONT
  slot 4: FRONT, xOff: +ARENA_SPACING_FRONT
```

3-row 視覺分層（depth scaling）：
- **Back row**：1 spirit 中央，**最小** size 60px，y=260（最遠）
- **Mid row**：2 spirits 對稱，medium size 90px，y=380
- **Front row**：2 spirits 對稱，largest size 130px，y=540（最近）

垂直排佈（**不重疊** check）：
- Back: head 200, feet 260（60px 高）
- Mid: head 290, feet 380（90px 高）
- Front: head 410, feet 540（130px 高）
- Back↔Mid gap: 260→290 = **30px** ✓
- Mid↔Front gap: 380→410 = **30px** ✓

VS shield 衝突避免：
- 既有 VS shield at `vsY=380` — 跟 mid-row feet 在同一 Y！會撞臉
- **解**：VS shield 移到 `vsY=475`（mid feet 380 與 front head 410 中段）— 視覺上 VS 站在 mid/front 之間，更合理

---

## Skills suggested for this PR

- **`debugging-and-error-recovery`** — 5-step：reproduce（看 owner 截圖證實重疊）→ localize（slotToArenaPos LAYOUT array）→ reduce（純 const + LAYOUT 重排）→ fix → guard（preview 確認無 spirit overlap, 無 VS 衝突）
- **`code-simplification`** — 既有 LAYOUT 已是清楚的 ReadonlyArray pattern，本 PR 改 entries + 加 'mid' row type 即可，**不需重寫 method 結構**
- **`source-driven-development`** — drawFormation line 787-820 區段對 row 判斷依賴 `pos.y === ARENA_Y_BACK`（line 802）— 加第三 row 時要改成 enum-style 判斷（pos.row property），**先理解既有 code path 再改**

---

## 2. Spec drift check (P6)

1. `mempalace_search "formation 3-row layout 九宮格 chore"`
2. 確認 BattleScreen.ts line 56-65 是 ARENA / SPIRIT 常數區
3. 確認 line 787-820 drawFormation method
4. 確認 line 860-879 slotToArenaPos method
5. 確認 line 540-552 drawSpiritShadows 也用 ARENA_Y_FRONT/BACK（**需同步加 ARENA_Y_MID 處理**）
6. 確認 VS shield 位置 const（搜「vsY」或「VS_Y」）

## 3. Task

### 3a. 加 const + 改既有 const

```ts
// p10-v01 既有:
const SPIRIT_H_BACK         = Math.round(SPIRIT_H * 0.54);  // ≈70px
const ARENA_Y_FRONT         = 510;
const ARENA_Y_BACK          = 290;
const ARENA_SPACING_FRONT_X = 80;
const ARENA_SPACING_BACK_X  = 60;

// 改為:
const SPIRIT_H_BACK         = Math.round(SPIRIT_H * 0.46);  // ≈60px (更小，最遠)
const SPIRIT_H_MID          = Math.round(SPIRIT_H * 0.69);  // ≈90px (medium)
const ARENA_Y_FRONT         = 540;                          // 510 -> 540 (留 gap)
const ARENA_Y_MID           = 380;                          // NEW (between back/front)
const ARENA_Y_BACK          = 260;                          // 290 -> 260 (拉更遠)
const ARENA_SPACING_FRONT_X = 110;                          // 80 -> 110 (2 spirits @ 130 width 不重疊)
const ARENA_SPACING_MID_X   = 95;                           // NEW (mid 90 width)
// ARENA_SPACING_BACK_X 廢除 (back 只有 1 spirit center)
```

### 3b. 改 LAYOUT array

```ts
private slotToArenaPos(side: 'A' | 'B', slot: number): { x: number; y: number; row: 'front' | 'mid' | 'back' } {
  const LAYOUT: ReadonlyArray<{ row: 'front' | 'mid' | 'back'; xOff: number }> = [
    { row: 'back',  xOff: 0                        },  // slot 0 — back center (solo)
    { row: 'mid',   xOff: -ARENA_SPACING_MID_X     },  // slot 1 — mid left
    { row: 'mid',   xOff: +ARENA_SPACING_MID_X     },  // slot 2 — mid right
    { row: 'front', xOff: -ARENA_SPACING_FRONT_X   },  // slot 3 — front left
    { row: 'front', xOff: +ARENA_SPACING_FRONT_X   },  // slot 4 — front right
    // 廢除既有 5-8 extra slots（5-pick draft 上限 5 — 這些 unused）
  ];
  const entry   = LAYOUT[slot] ?? LAYOUT[0];
  const centerX = side === 'A' ? ARENA_A_CENTER_X : ARENA_B_CENTER_X;
  const mirror  = side === 'B' ? -1 : 1;
  const yMap    = { back: ARENA_Y_BACK, mid: ARENA_Y_MID, front: ARENA_Y_FRONT };
  return {
    x: centerX + entry.xOff * mirror,
    y: yMap[entry.row],
    row: entry.row,                  // NEW — return row identifier explicitly
  };
}
```

**注意 return type 加 `row` 欄位** — 後續 drawFormation 用此判斷 spirit size。

### 3c. 改 drawFormation row 判斷

既有 line 802：
```ts
const isBackRow = pos.y === ARENA_Y_BACK;
const spiritH   = isBackRow ? SPIRIT_H_BACK : SPIRIT_H;
```

改成：
```ts
const sizeMap: Record<'back'|'mid'|'front', number> = {
  back:  SPIRIT_H_BACK,
  mid:   SPIRIT_H_MID,
  front: SPIRIT_H,
};
const spiritH = sizeMap[pos.row];
```

### 3d. drawSpiritShadows 加 mid row

既有 line 540-552：
```ts
for (const x of A_FRONT_X) shadow.ellipse(x, ARENA_Y_FRONT + 8, 34, 9).fill({ color: 0x000000, alpha: 0.45 });
for (const x of A_BACK_X)  shadow.ellipse(x, ARENA_Y_BACK  + 8, 22, 6).fill({ color: 0x000000, alpha: 0.35 });
```

加 mid row：
```ts
for (const x of A_MID_X)   shadow.ellipse(x, ARENA_Y_MID   + 8, 28, 7).fill({ color: 0x000000, alpha: 0.40 });
for (const x of B_MID_X)   shadow.ellipse(x, ARENA_Y_MID   + 8, 28, 7).fill({ color: 0x000000, alpha: 0.40 });
```

X 位置從新 LAYOUT 算（mid 是 ±ARENA_SPACING_MID_X 對 centerX）。Back row 改成只有 1 個 shadow（centerX）。

### 3e. VS shield 位置 — 380 → 475

既有：
```ts
const vsX = CANVAS_WIDTH / 2;
const vsY = 380;
```

改：
```ts
const vsX = CANVAS_WIDTH / 2;
const vsY = 475;   // chore: between mid-feet (380) and front-head (410-410), avoid spirit collision
```

### 3f. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔
- const 區（+SPIRIT_H_MID + ARENA_Y_MID + ARENA_SPACING_MID_X，改 ARENA_Y_FRONT/BACK + SPIRIT_H_BACK + SPACING_FRONT_X，廢 SPACING_BACK_X）
- slotToArenaPos return type 加 row + LAYOUT 重排
- drawFormation row 判斷邏輯改
- drawSpiritShadows 加 mid row
- VS shield vsY 380→475

**禁止**：
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- DraftScreen（draft 仍 5-pick，formation 改 row 不影響 draft）
- LoadingScreen / ResultScreen
- main.ts
- 加新 asset
- DesignTokens
- scripts/sim-rtp.mjs（純視覺）
- 改 5-pick draft SPEC（仍是 5 unit）
- 改 SPEC.md

## 4. DoD

1. `npm run build` 過
2. **1 個 commit**（per `code-simplification` — 純視覺 layout 重排，atomic）
3. push + PR URL
4. **Preview 驗證**（user 截圖比對）：
   - 進 Battle，看 spirit formation：每側**清楚 3 排**（1 back center / 2 mid 對稱 / 2 front 對稱）
   - **無 spirit overlap** — 同 row 內 spirit 之間有清楚 gap
   - 不同 row 之間有 vertical depth 感（size 變化 60→90→130）
   - VS shield at y=475 不被任何 spirit 遮 / 不擋任何 spirit
   - HP bar 仍對齊每個 spirit 頭頂
   - Active spirit ring（若 v-01 有實作）位置仍合理
5. 截圖 1 張（含 5v5 三排陣型 + VS shield）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- VS shield 位置是否最終 475 或調整（若被 spirit 擋到可能再 tune）
- mid row 的 SPIRIT_H 90px 視覺感（太小 / OK / 太大）
- spirit shadow 是否每排都有對應 ellipse（back 1 / mid 2 / front 2 = 5 個 shadow per side = 10 total）
- 任何意外 LAYOUT collision（front spacing 110 vs spirit 130 邊距 110-65*2=-20 ← 看似擠，但兩 front 中心相距 110*2=220 > 130 = OK 不重疊；executor 驗證一下）
- Spec deviations：預期 0（5-pick draft 仍 5 unit，只改 visual row 分配）
