# Chore — FXPreviewScreen 加 placeholder spirit body（dash-style FX 看不到的修法）

## 1. Context

Owner 試玩 chore #FX-PICK + clash position fix 後反映：「珞洛還是空的」。

### 根因

[`FXPreviewScreen.ts:265-269`](src/screens/FXPreviewScreen.ts#L265) `playSignatureLoop` 用空 Container 當 previewSpirit：

```ts
const previewSpirit = new Container();
previewSpirit.x = 340;
previewSpirit.y = Math.round(CANVAS_HEIGHT * 0.55);
this.stage.addChild(previewSpirit);
```

attackTimeline 內 `avatar = previewSpirit`，Phase 1-3 / Phase 5 動的是 avatar 本身（scale / x / y / rotation），但 previewSpirit **沒 Sprite child** → avatar 完全隱形。

**蒼嵐能看到** 是因為 _sigLightningXCross 在 clash centre 畫**靜態 70px X 烙印**400ms+。

**珞洛看不到** 是因為 _sigTripleDash 的 FX 跟 avatar 同步移動（speed lines 在 avatar 起點、claw/dust 在 target 命中時瞬發 100-240ms）。沒可視化的 avatar 主體，dash 軌跡完全消失。

朱鸞、朝雨、孟辰璋、寅、玄墨、凌羽 都會有相同問題（任何 avatar-relative FX 都看不到）。

### Fix

給 previewSpirit 加一個可視化的占位 body：金色圓形 + 角色 personality color 邊框 + dropShadow。這樣：
1. Phase 1-3 prepare/leap/hold 看得到 avatar 移動
2. dash-style FX (珞洛) 軌跡視覺化
3. 8 個 spirit 都受惠

純 dev tool fix — 不動 attackTimeline / 8 個 signature。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 在 playSignatureLoop 加 1 個 Graphics

---

## 2. Spec drift check (P6)

1. 確認 [`FXPreviewScreen.ts:262-291`](src/screens/FXPreviewScreen.ts#L262) `playSignatureLoop` 結構
2. 確認 line 265-268 previewSpirit 創建（後面的 chore #FX-PICK polish 已加 clashX/Y）
3. 確認 PERSONALITIES particleColor 可從 SpiritAttackChoreographer 取得（如不能 export，就 hardcode 8 色）

---

## 3. Task

### Single commit — Add placeholder spirit body

`src/screens/FXPreviewScreen.ts` `playSignatureLoop` (line 262-291) 內：

當前 (line 265-268)：
```ts
const previewSpirit = new Container();
previewSpirit.x = 280 + 60;                              // ≈ 340
previewSpirit.y = Math.round(CANVAS_HEIGHT * 0.55);      // ≈ 704
this.stage.addChild(previewSpirit);
```

改成：
```ts
const previewSpirit = new Container();
previewSpirit.x = 280 + 60;                              // ≈ 340
previewSpirit.y = Math.round(CANVAS_HEIGHT * 0.55);      // ≈ 704

// chore #FX-PICK polish 2: visible placeholder body — needed so dash-style FX
// (e.g. 珞洛 triple-dash speed lines + per-impact claw/dust) have a visible
// attacker. attackTimeline animates avatar (this container) but without a child
// the motion is invisible. Picks colour from spirit's gem visual.
const visualColor = SYMBOLS[symbolId]?.color ?? 0xFFD700;
const body = new Graphics()
  .circle(0, 0, 24)
  .fill({ color: visualColor, alpha: 0.85 })
  .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
// White inner highlight (gem-style)
body.circle(-7, -7, 7).fill({ color: 0xffffff, alpha: 0.5 });
previewSpirit.addChild(body);

this.stage.addChild(previewSpirit);
```

> `SYMBOLS[symbolId].color` 已 import 自 `@/config/SymbolsConfig`（line 5），各 spirit 8 個 unique color 已定義。

> 視覺：每個 spirit body 圓形帶該 spirit gem 顏色（蒼嵐藍 / 珞洛橘 / 朱鸞紅 / etc.）+ 白邊 + 左上白光，有「魂體」感不會搶 FX 戲份。

#### 不動其他

- attackTimeline call (line 271-277) — 保留（已 chore #FX-PICK polish 加 clashX/Y）
- previewSpirit cleanup (line 279) — 保留（destroy 自動帶走 child Graphics）
- 800ms gap pause — 保留

**Commit**: `fix(chore): FXPreviewScreen placeholder spirit body — fixes invisible avatar problem on dash-style signatures (珞洛/朱鸞/etc. FX was tied to avatar position but body was empty Container)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/FXPreviewScreen.ts` `playSignatureLoop` 內 previewSpirit 創建後加 placeholder Graphics

**禁止**：
- 動 attackTimeline / SpiritAttackChoreographer
- 動 8 個 signature function
- 動 BattleScreen
- 動 picker layout / clashX/Y / targetPositions
- 動 SYMBOLS / SpiritsConfig
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "placeholder\|visualColor\|previewSpirit.addChild" src/screens/FXPreviewScreen.ts` — 應有 placeholder body 加進 previewSpirit
5. **Preview 驗證**：
   - `?fx=lightning-xcross` 進 picker
   - 按 `1` 蒼嵐：應看到藍色魂體 + X 烙印（仍正常）
   - 按 `2` 珞洛：應看到橘色魂體**從 (340, 704) leap 到 clash (500, 576)** + dash 到 target 位置 + speed lines 跟著起點 + claw/dust 在 target 顯現
   - 按 `3-8` 其他 spirit：每個都有對應 personality color 的占位魂體可見
   - BattleScreen 內 spirit 攻擊不變（FXPreviewScreen 改不影響 game）

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF (珞洛 dash 全程可見)
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**
