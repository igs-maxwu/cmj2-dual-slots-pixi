# Sprint 10 · p10-bug-01 — 3 P0 bugs（標題切斷 + 角落白塊 + HP bar 浸 JP）+ zIndex sortableChildren 啟用

## 1. Context

PR: **修 the-stylist audit 列出的 3 個 P0 demo-killer bug + 1 個 hidden zIndex 失效問題。完整 audit 在 `docs/pitch/sprint10-visual-audit.md`。**

Why: Owner Sprint 9 試玩截圖顯示明顯視覺 artifacts。**任何 stakeholder 看到的截圖 / 影片有這些 bug 會直接 read 為「unshipped prototype」**，Sprint 10 必須立刻修。本 PR 純 bug fix，無 design decision，zero mockup dependency。

Bug 列表：

### P0-A：標題被 VS badge 切斷
- `drawHeader()` 創建 title「雀靈戰記·BATTLE」at `y=49`
- VS badge at `y=99`, width=96, bbox y=51..147
- Badge disc 直接打在 title 上 → 「雀靈戰」+ 「ATTLE」拆開
- **Fix（the-stylist 推薦 R1）**：完全移除 BattleScreen 的 title — VS badge 已是「1v1 對戰」最強訊號，title 多餘

### P0-B：Reel 四角白塊（dragon-corner asset 未載入）
- `SlotReel.buildFrame()` 嘗試 `Assets.get<Texture>('dragon-corner')`
- Asset 沒載入 → fallback 到 `Texture.WHITE` → 4 個 120×120 白方塊
- **Fix（the-stylist 推薦 B1）**：當 cornerTex null 時改用程式化 L-bracket Graphics 畫，不再有 white-box artifact

### P0-C：HP bar 綠 fill 浸入 JP 區
- `ARENA_Y_BACK = 426`, `UNIT_HP_BAR_Y_OFF = -(SPIRIT_H+22) = -152`
- 後排 spirit HP bar 位置 `426 - 152 = 274`
- JP panel `y=138..338` → 274 在 panel 正中
- **Fix**：`UNIT_HP_BAR_Y_OFF` 改為 `-(SPIRIT_H/2 + 8)` = `-73`
- 後排 HP 落 `426 - 73 = 353`，JP panel bottom 338 之下安全
- **副 fix**：`hpFill.visible = unit !== null` guard 加在 `drawFormation()`，避免 unused slot 5-8 殘留

### P2-A：zIndex 80 但 sortableChildren 未啟用（隱藏 bug）
- 既有 `topBar.zIndex = 80` 是 cosmetic 沒效（Pixi 8 需 parent `sortableChildren=true`）
- 不立即觸發 visual bug 但 Sprint 9 多個 zIndex 設都失效
- **Fix**：`this.container.sortableChildren = true` in `onMount` 開頭

---

## Skills suggested for this PR

- **`debugging-and-error-recovery`** — 4 個 bug 的 root cause 已由 the-stylist 詳盡分析。執行不需重新 reproduce/triage，直接 fix 即可。但**驗收必做 reproduce 確認**（preview 看 4 個 bug 都不見）。
- **`frontend-ui-engineering`** — fallback Graphics drawing 沿用既有 d-04 / d-06 pattern（純 Pixi.Graphics + chained API）。
- **`incremental-implementation`** — **單 PR 但 4 atomic commits**，方便任一個 fix 出問題單獨 revert：
  - commit 1: P0-A title removal
  - commit 2: P0-B dragon-corner fallback
  - commit 3: P0-C HP bar position + visible guard
  - commit 4: P2-A sortableChildren

---

## 2. Spec drift check (P6)

1. `mempalace_search "p10 bug-01 title VS badge dragon-corner HP bar JP bleed"`
2. 確認 `BattleScreen.ts` `drawHeader()` line 340-354 仍存在（v-01 改過字級但邏輯架構未變）
3. 確認 `SlotReel.ts` `buildFrame()` 有 dragon-corner Sprite 創建邏輯
4. 確認 `UNIT_HP_BAR_Y_OFF` const 在 BattleScreen.ts（搜「HP_BAR_Y_OFF」）
5. 確認 audit report `docs/pitch/sprint10-visual-audit.md` 已 commit

## 3. Task

### 3a. P0-A — 移除 title（commit 1）

`BattleScreen.drawHeader()` 整個 method 留著但**移除 title creation block**：

既有 line 340-354（v-01 留下的 drawHeader）：

```ts
private drawHeader(): void {
  const title = new Text({
    text: '雀靈戰記 · BATTLE',
    style: { ... },
  });
  title.anchor.set(0.5, 0);
  title.x = CANVAS_WIDTH / 2;
  title.y = TOP_BAR_H + 4;
  this.container.addChild(title);
  // roundText is now created in drawTopBar() inside the ROUND pill
}
```

改成：

```ts
private drawHeader(): void {
  // p10-bug-01: title removed — VS badge is the 1v1 identity signal
  // ROUND counter is in drawTopBar's pill; nothing else needed here
  // Method kept for caller compatibility (onMount calls drawHeader)
}
```

或更乾脆：**直接從 onMount 移除 `drawHeader()` 呼叫**（line ~225 區），整個 method 也刪。

**選項 (b) 更乾淨**，但要確認 `drawHeader()` 沒被其他地方 call（搜尋 `drawHeader` 確認唯一 call site）。

**Commit 1**: `fix(p10-bug-01a): remove BattleScreen title (collides with VS badge)`

### 3b. P0-B — dragon-corner fallback（commit 2）

`SlotReel.buildFrame()` 既有 dragon-corner Sprite 創建（搜「dragon-corner」）：

```ts
const cornerTex = Assets.get<Texture>('dragon-corner');
if (cornerTex) {
  const positions = [...];
  for (const p of positions) {
    const s = new Sprite(cornerTex);
    // ... apply scale, anchor, alpha ...
    this.frameContainer.addChild(s);
  }
}
```

加 `else` 用 Graphics 畫程式化 L-bracket：

```ts
const cornerTex = Assets.get<Texture>('dragon-corner');
if (cornerTex) {
  // ... existing sprite path ...
} else {
  // p10-bug-01: programmatic L-bracket fallback when dragon-corner asset missing
  const positions: Array<[number, number, number, number]> = [
    [-8, -8, 1, 1],                    // top-left
    [REEL_W + 8, -8, -1, 1],           // top-right
    [-8, REEL_H + 8, 1, -1],           // bottom-left
    [REEL_W + 8, REEL_H + 8, -1, -1],  // bottom-right
  ];
  for (const [x, y, sx, sy] of positions) {
    const bracket = new Graphics()
      .moveTo(0, 24).lineTo(0, 0).lineTo(24, 0)
      .stroke({ width: 3, color: T.GOLD.shadow, alpha: 0.7 });
    bracket.x = x;
    bracket.y = y;
    bracket.scale.set(sx, sy);
    this.frameContainer.addChild(bracket);
  }
}
```

**注意**：常數 `REEL_W` / `REEL_H` 應已存在於 SlotReel.ts。若不確定，搜尋確認。

**Commit 2**: `fix(p10-bug-01b): SlotReel dragon-corner Graphics fallback (no white box on missing asset)`

### 3c. P0-C — HP bar 位置 + visible guard（commit 3）

`BattleScreen.ts` 搜尋 `UNIT_HP_BAR_Y_OFF` 找定義位置：

既有：
```ts
const UNIT_HP_BAR_Y_OFF = -(SPIRIT_H + 22);   // 後排 426 - 152 = 274 浸入 JP
```

改為：
```ts
const UNIT_HP_BAR_Y_OFF = -(SPIRIT_H / 2 + 8);   // 後排 426 - 73 = 353，安全在 JP bottom 之下
```

`drawFormation()` 內找 hpFill 創建區，加 visible guard：

```ts
// 既有大概樣子（per slot）：
const hpFill = new Graphics();
// ... draw hp ...
container.addChild(hpFill);

// 改成：
const hpFill = new Graphics();
// ... draw hp ...
hpFill.visible = unit !== null;   // p10-bug-01: don't render fill for empty slots
container.addChild(hpFill);
```

**注意**：`refreshFormation()` 也要對 `hpFill.visible` 在每次 update 時 reflect `unit !== null`，避免後續 unit 死亡或補上時狀態錯。executor 細看 refreshFormation 對 unit 變化的處理。

**Commit 3**: `fix(p10-bug-01c): HP bar position offset + null-unit visible guard`

### 3d. P2-A — sortableChildren（commit 4）

`BattleScreen.ts` `onMount()` 開頭加：

```ts
async onMount(_app: Application, stage: Container): Promise<void> {
  stage.addChild(this.container);
  this.container.sortableChildren = true;   // p10-bug-01: enable zIndex respect
  // ... rest of onMount ...
}
```

**Commit 4**: `fix(p10-bug-01d): enable container.sortableChildren for zIndex correctness`

### 3e. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（移 title, UNIT_HP_BAR_Y_OFF, hpFill guard, sortableChildren）
- `src/screens/SlotReel.ts`（dragon-corner fallback）

**禁止**：
- DesignTokens / SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin
- DraftScreen / LoadingScreen / ResultScreen / FXPreviewScreen
- main.ts
- 加新 asset
- DesignTokens 加新 token（用既有 T.GOLD.shadow 等）
- scripts/sim-rtp.mjs（純視覺 PR）
- 改 v-01 / v-02 / v-03 / pace-01 / res-01 邏輯
- 加新 layout 改動（這些是 p10-v01 工作）
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **4 個 commits**（per `incremental-implementation`，每 fix 一個 commit 方便 revert isolation）
3. push + PR URL
4. **Preview 驗證 critical**（每個 bug 都要實測確認消失）：
   - P0-A：進 Battle 看 top 區 — 不應該還看到「雀靈戰記·BATTLE」title 殘留
   - P0-B：reel 四角不該有任何白色方塊（看角落應該是金色 L-bracket OR 既有 dragon-corner sprite 載入了）
   - P0-C：開戰開始 spin 後 — JP marquee 區（138-338）不該出現任何綠色 fill
   - P2-A：在 console 加暫時 `console.log(this.container.sortableChildren)` 確認 true（commit 之前 cleanup 此 log）
5. 截圖 1 張（4 bugs 都修好的 BattleScreen）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（after fix）
- 4 個 bug 是否都實測消失（一句話）
- 任何意外發現（例如「dragon-corner 其實有載入只是某條件下 null」）
- `drawHeader()` 採取 (a) empty method 還是 (b) 完全移除 + onMount 不 call
- Spec deviations：預期 0
