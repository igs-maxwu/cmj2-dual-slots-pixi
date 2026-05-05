# Chore #213 — ResultScreen 返回 DRAFT button hit-test 結構性修正（wrapper Container pattern）

## 1. Context

Owner 試玩 2026-05-05 反映：「`返回 DRAFT` button 還是常常按了沒反應」。

### 為什麼 chore #176 (84b2cf7) 已加 explicit hitArea 仍不穩

[`ResultScreen.ts:222-261`](src/screens/ResultScreen.ts#L222) `drawReturnButton`：

```ts
const bg = new Graphics().roundRect(btnX, btnY, btnW, btnH, 14).fill(...).stroke(...);
bg.hitArea   = new Rectangle(btnX, btnY, btnW, btnH);
bg.eventMode = 'static';
bg.on('pointertap', () => this.onReturn());
this.container.addChild(bg);

const txt中 = new Text({ text: '返回 DRAFT', ... });
txt中.x = btnX + btnW / 2;
this.container.addChild(txt中);   // ← sibling of bg

const txtEn = new Text({ text: 'Back to Draft', ... });
txtEn.x = btnX + btnW / 2;
this.container.addChild(txtEn);   // ← sibling of bg
```

**結構性問題**：bg + 2 texts **三個 sibling** 同 parent (`this.container`)。Pixi 8 hit-test 從子物件 reverse order 開始（後加入的先檢查）：

1. 點到 button → 先 hitTest `txtEn` (Back to Draft)
2. txtEn 預設 `eventMode='auto'` — 理論上不該擋，但 text glyph bounds **常常吞 click**（chore #176 實測 fix 不徹底就是這原因）
3. 即使透過，下一個是 `txt中`，同樣可能擋
4. 最後才 reach `bg` — 但很多 click 在 1/2 步驟就被吃掉

對比 [SPIN button](src/screens/BattleScreen.ts#L1148-1213) (運作正常)：
```ts
this.spinButton = new Container();   // ← wrapper
this.spinButton.addChild(this.spinButtonBg);
this.spinButton.addChild(this.spinButtonText);
this.spinButton.addChild(this.spinButtonSubText);
this.spinButton.hitArea = new Rectangle(0, 0, SPIN_BTN_W, SPIN_BTN_H);
this.spinButton.eventMode = 'static';
this.spinButton.on('pointertap', () => this.onSpinClick());
this.container.addChild(this.spinButton);
```

→ wrapper Container 設 hitArea + eventMode='static'，hit-test 把整個 Container 當 atomic interactive target，**children 不參與獨立 hit-test 競爭**，所以 100% 穩定。

### Fix

把 `drawReturnButton` 重構成 wrapper Container pattern（mirror SPIN button），belt-and-suspenders 加 texts `eventMode='none'`。

純結構 fix — 不動視覺 / 文字 / size / position。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — copy SPIN button pattern verbatim

---

## 2. Spec drift check (P6)

1. 確認 [`src/screens/ResultScreen.ts:222-261`](src/screens/ResultScreen.ts#L222) `drawReturnButton` 仍是 sibling layout
2. 確認 chore #176 (84b2cf7) 已 merge — `bg.hitArea = new Rectangle` 已存在
3. 確認 [SPIN button pattern](src/screens/BattleScreen.ts#L1148-1213) 仍 wrapper Container
4. 確認 onReturn callback 仍是 `() => void` signature

---

## 3. Task

### Single commit — Wrapper Container refactor

`src/screens/ResultScreen.ts` line 222-261 整段 `drawReturnButton` 改成：

```ts
private drawReturnButton(): void {
  const btnW = 280, btnH = 72;
  const btnX = (CANVAS_WIDTH - btnW) / 2;
  const btnY = 1080;

  // chore #213: wrapper Container pattern (mirror BattleScreen SPIN button) — atomic hit-test target.
  // Was sibling layout (bg + 2 Texts → this.container) which let text glyph bounds intermittently
  // swallow clicks despite chore #176 explicit hitArea. The wrapper makes children non-competing.
  const btn = new Container();
  btn.x = btnX;
  btn.y = btnY;

  const bg = new Graphics()
    .roundRect(0, 0, btnW, btnH, 14)            // local coords (was offset roundRect)
    .fill({ color: T.GOLD.base })
    .stroke({ width: 2, color: T.GOLD.shadow });
  btn.addChild(bg);

  const txt中 = new Text({
    text: '返回 DRAFT',
    style: {
      fontFamily: T.FONT.body, fontWeight: '700', fontSize: 22,
      fill: 0x0D1421, letterSpacing: 4,
    },
  });
  txt中.anchor.set(0.5, 0.5);
  txt中.x = btnW / 2;
  txt中.y = btnH / 2 - 6;
  txt中.eventMode = 'none';                     // chore #213 belt-and-suspenders
  btn.addChild(txt中);

  const txtEn = new Text({
    text: 'Back to Draft',
    style: {
      fontFamily: T.FONT.body, fontWeight: '500', fontSize: 11,
      fill: 0x0D1421, letterSpacing: 2, fontStyle: 'italic',
    },
  });
  txtEn.anchor.set(0.5, 0.5);
  txtEn.x = btnW / 2;
  txtEn.y = btnH / 2 + 14;
  txtEn.eventMode = 'none';                     // chore #213 belt-and-suspenders
  btn.addChild(txtEn);

  // chore #213: hit-test on wrapper Container (atomic target), not on bg sibling
  btn.hitArea   = new Rectangle(0, 0, btnW, btnH);
  btn.eventMode = 'static';
  btn.cursor    = 'pointer';
  btn.on('pointertap', () => this.onReturn());

  this.container.addChild(btn);
}
```

### 變動摘要

| 項目 | Before | After |
|---|---|---|
| Layout | bg + 2 texts as siblings of `this.container` | wrapper `Container btn` 內含 bg + 2 texts |
| Hit target | `bg` (Graphics) | `btn` (wrapper Container) |
| bg 座標 | absolute (btnX, btnY) | local (0, 0) — wrapper 處理 offset |
| Text positions | absolute | local (btnW/2, btnH/2 ± offset) |
| Text eventMode | default 'auto' (可能擋 click) | 顯式 'none' |
| this.container 加入 | bg + txt中 + txtEn (3 children) | btn (1 child) |

> **視覺零變動**：button 在 (btnX, btnY) 同位置，size/style 完全一樣，只是 child hierarchy 改了。

> **保留**：bg.fill T.GOLD.base / stroke T.GOLD.shadow / 字體 22pt + 11pt italic / 顏色 0x0D1421 / letterSpacing — 不動。

**Commit**: `fix(chore): ResultScreen 返回 DRAFT button — wrapper Container pattern (was sibling layout where text bounds intermittently swallowed clicks; chore #176 hitArea fix was structurally incomplete)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/ResultScreen.ts` `drawReturnButton` 內部 — 整段重構但 signature 不變

**禁止**：
- 動 `onReturn` callback signature
- 動 `MatchResult` interface
- 動 `drawMatchSummary` / `drawBackground` / 其他 ResultScreen draw 函式
- 動 button size (280×72) / position (btnY=1080) / 字體 / 顏色
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep -A2 "drawReturnButton" src/screens/ResultScreen.ts | head -5` — 確認新結構
   - `grep "btn = new Container\|btn.hitArea\|btn.eventMode" src/screens/ResultScreen.ts` — wrapper Container pattern 三要素
   - `grep "txt中.eventMode\|txtEn.eventMode" src/screens/ResultScreen.ts` — 兩個 'none' 設定
   - `grep "bg.hitArea\|bg.eventMode = 'static'" src/screens/ResultScreen.ts` — 應為空（已從 bg 拿掉）
5. **Preview 驗證 (critical)**：
   - 跑 1-2 場 match 到 ResultScreen
   - 連續快速點擊 `返回 DRAFT` button **10 次** — 應 100% 都觸發 onReturn (不再有「沒反應」)
   - 點擊 button 中文字「返回」glyph 上 — 應觸發
   - 點擊 button 英文字「Back to Draft」glyph 上 — 應觸發
   - 點擊 button 邊緣空白區 — 應觸發
   - 視覺零變化（button 外觀同 chore #176）
6. **Audit per chore #203 lesson**：grep `src/screens/` 確認沒其他 sibling-layout button 也需 sync（DraftScreen / BattleScreen / FXPreviewScreen 應已是 wrapper pattern；如有發現 flag 不在本 chore 修）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 說明連點 10 次驗證結果（100% 觸發）
- spec deviations: 0（純結構 fix，視覺/邏輯不變）
- Process check：`git log --oneline origin/master | head -3` 確認 commit on master
