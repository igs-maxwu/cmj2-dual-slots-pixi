# Chore — FXPreviewScreen 動畫看不到（clash 位置 hardcoded fix）

## 1. Context

Owner 試玩 chore #FX-PICK (PR #217) 後反映：「什麼都看不到」— 切到任一 spirit picker row，preview area 空白。

### 根因分析

[`SpiritAttackChoreographer.ts:144-150`](src/screens/SpiritAttackChoreographer.ts#L144) `attackTimeline` clash 中心 **hardcoded** 在 game arena layout：
```ts
const centerX = side === 'A'
  ? Math.round(CANVAS_WIDTH / 2 - 70)   // = 290 (game: 落在 A 側 inner col 與 VS 之間)
  : Math.round(CANVAS_WIDTH / 2 + 70);  // = 430
const centerY = 420;                    // game: formation 中段
```

但 chore #FX-PICK 把 picker panel 放左側 (x 0-260)，preview area 在右側 (x 280-720, mid = 500)。FX 卻畫在 (290, 420) — 落在 **picker 第 6-7 row 邊界區**（picker 右緣 260, X-brand arm 70 延伸到 x range [220, 360]），被 picker 蓋住或落在 gap 裡。

### Fix

讓 `AttackOptions` 多 2 個 optional `clashX?` / `clashY?` 欄位，FXPreviewScreen 可指定 clash 中心於 preview area 中央。BattleScreen 不傳 → 維持既有 hardcoded default → game 行為不變。

純 dev tool fix — 不影響 production game。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 加 2 個 optional 欄位 + 改 default fallback

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:120-133`](src/screens/SpiritAttackChoreographer.ts#L120) `AttackOptions` interface
2. 確認 [`SpiritAttackChoreographer.ts:144-150`](src/screens/SpiritAttackChoreographer.ts#L144) centerX/centerY 計算
3. 確認 [`FXPreviewScreen.ts:271-277`](src/screens/FXPreviewScreen.ts#L271) `playSignatureLoop` attackTimeline call
4. 確認 [`BattleScreen.ts:2319`](src/screens/BattleScreen.ts#L2319) attackTimeline call site **不需動**（continue using default）

---

## 3. Task

### Single commit — Override clash position via AttackOptions

#### 3a. AttackOptions 加 clashX / clashY

`src/screens/SpiritAttackChoreographer.ts` `AttackOptions` interface (line ~120-133)：

當前：
```ts
export interface AttackOptions {
  stage:           Container;
  spiritContainer: Container;
  symbolId:        number;
  spiritKey:       string;
  targetPositions: { x: number; y: number }[];
  particleColor?:  number;
  shakeIntensity?: number;
  side?: 'A' | 'B';
  posScale?: number;
  onFireImpact?: () => void;
}
```

改成：
```ts
export interface AttackOptions {
  stage:           Container;
  spiritContainer: Container;
  symbolId:        number;
  spiritKey:       string;
  targetPositions: { x: number; y: number }[];
  particleColor?:  number;
  shakeIntensity?: number;
  side?: 'A' | 'B';
  posScale?: number;
  /** chore #FX-PICK polish: override clash centre (default uses game arena hardcoded values).
   *  FXPreviewScreen uses this to draw FX in preview area instead of picker overlap. */
  clashX?: number;
  clashY?: number;
  onFireImpact?: () => void;
}
```

#### 3b. centerX / centerY 用 opts override

`src/screens/SpiritAttackChoreographer.ts` line 144-150：

當前：
```ts
const side = opts.side ?? 'A';
const CLASH_OFFSET = 70;
const centerX = side === 'A'
  ? Math.round(CANVAS_WIDTH / 2 - CLASH_OFFSET)
  : Math.round(CANVAS_WIDTH / 2 + CLASH_OFFSET);
const centerY = 420;
```

改成：
```ts
const side = opts.side ?? 'A';
const CLASH_OFFSET = 70;
const centerX = opts.clashX ?? (side === 'A'
  ? Math.round(CANVAS_WIDTH / 2 - CLASH_OFFSET)
  : Math.round(CANVAS_WIDTH / 2 + CLASH_OFFSET));
const centerY = opts.clashY ?? 420;
```

#### 3c. FXPreviewScreen pass clashX/clashY

`src/screens/FXPreviewScreen.ts` `playSignatureLoop` attackTimeline call (line ~271-277)：

當前：
```ts
await attackTimeline({
  stage:           this.stage,
  spiritContainer: previewSpirit,
  symbolId,
  spiritKey,
  targetPositions: this.targetPositions(),
});
```

改成：
```ts
// chore #FX-PICK polish: override clash centre to fall in right-side preview area
// (default hardcoded 290/420 lands behind picker panel)
const previewLeft = 280;
const previewCx = previewLeft + (CANVAS_WIDTH - previewLeft) / 2;
await attackTimeline({
  stage:           this.stage,
  spiritContainer: previewSpirit,
  symbolId,
  spiritKey,
  targetPositions: this.targetPositions(),
  clashX:          previewCx,                              // ≈ 500
  clashY:          Math.round(CANVAS_HEIGHT * 0.45),       // ≈ 576 (upper-mid preview area)
});
```

#### 3d. previewSpirit 起點 + targetPositions 配合 clash 中心調整

[`FXPreviewScreen.ts:265-267`](src/screens/FXPreviewScreen.ts#L265) previewSpirit position:

當前：
```ts
previewSpirit.x = 280 + 80;     // 360
previewSpirit.y = Math.round(CANVAS_HEIGHT * 0.50);  // 640
```

改成（拉近 clash centre，符合 game 中 spirit 起點到 clash centre ~140px arc 距離）：
```ts
// chore #FX-PICK polish: align with new clashY so spirit can leap visibly to clash centre
previewSpirit.x = 280 + 60;                              // ≈ 340 (60px left of clash 500)
previewSpirit.y = Math.round(CANVAS_HEIGHT * 0.55);      // ≈ 704 (below clash 576)
```

[`FXPreviewScreen.ts:targetPositions`](src/screens/FXPreviewScreen.ts#L223) Y：

當前：
```ts
const y = Math.round(CANVAS_HEIGHT * 0.72);  // 922
```

改成（拉近 clash centre）：
```ts
// chore #FX-PICK polish: target row closer to clash so attack lines visible together
const y = Math.round(CANVAS_HEIGHT * 0.62);  // ≈ 794
```

> Net effect: spirit (340, 704) → leaps to clash (500, 576) → fires at targets (440/500/560, 794)。整套動畫都落在 preview area 視覺範圍內。

#### 3e. BattleScreen 不動

[`BattleScreen.ts:2319`](src/screens/BattleScreen.ts#L2319) attackTimeline call **不傳** clashX/clashY → 用 default → game 行為 100% 不變。

**Commit**: `fix(chore): FXPreviewScreen clash position — add AttackOptions.clashX/Y override (default game-arena positions hardcoded; preview was drawing FX behind picker panel)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` —
  - AttackOptions 加 `clashX?` `clashY?`
  - centerX / centerY 用 `opts.clashX ??` / `opts.clashY ??` fallback
- `src/screens/FXPreviewScreen.ts` —
  - playSignatureLoop attackTimeline call 加 clashX / clashY
  - previewSpirit y 0.50 → 0.55 + x 360 → 340
  - targetPositions y 0.72 → 0.62

**禁止**：
- 動 `attackTimeline` 主流程 / Phase 1-5 邏輯
- 動 BattleScreen attackTimeline call (game 不變)
- 動 8 個 signature function 內部
- 動 FXDevHook
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "clashX\|clashY" src/screens/SpiritAttackChoreographer.ts` — interface + 2 fallback 共 4-5 處
   - `grep "clashX\|clashY" src/screens/FXPreviewScreen.ts` — call site 傳值
   - `grep "clashX\|clashY" src/screens/BattleScreen.ts` — **應為空**（game 不動）
5. **Preview 驗證**：
   - dev mode `?fx=lightning-xcross` 進 picker
   - 蒼嵐動畫 **應在右側 preview area 可見**：spirit leap → 巨大 X 烙印 + 雷電 bolts → 螢幕青光閃 → fade
   - picker 按 2 切珞洛 — speed lines + 虎爪 + 塵土爆破都應在右側 preview area 可見
   - 切其他 spirit 全部都應動畫可見
   - 開遊戲（不帶 ?fx）— BattleScreen 內 spirit 攻擊位置完全不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（picker 切換看到 FX 在 preview area 動）
- spec deviations: 0（純 dev tool fix，game 不變）
- Process check：照新 pattern 把 git 操作串在**單一 Bash call**
