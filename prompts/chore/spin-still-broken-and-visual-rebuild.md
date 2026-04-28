# Chore — SPIN button 終極 debug + 雀靈數量驗證 + 視覺對齊 mockup variant A

## 1. Context

**這是 critical PR — 連續第三次同類問題**：

- PR #150 加 SPIN button + manual loop
- PR #151 加 hitArea fix（hypothesis A，orchestrator 預測命中）
- **本 PR**：owner 仍反映 SPIN 不會動 + 雀靈數量錯。**證據**：截圖 reel 顯示 `青/青/白` 行行重複初始 pattern（buildCells line 161 `setCellSymbol(colCells[r], r % SYMBOLS.length)` 的結果），代表 **SPIN 從沒成功 fire 過**。

Owner 訴求：
1. **SPIN 終極修好** — 不是「猜原因」，是進 preview console 看真實行為
2. **驗證雀靈數量正確** — owner 反映「跟一開始選入場的不同」，需 console 確認 formation length
3. **視覺對齊 mockup variant A** — 「**重建遊戲場景、刪除不必要的圖，讓遊戲畫面跟右邊的示意圖一模一樣**」

Mockup reference: `download_picture/Dual Slot Pixi/Battle Screen Mockup.html`（**executor 必開瀏覽器看 mockup live**，跟 game preview side-by-side 比對）

---

## 2. Skills suggested for this PR

- **`debugging-and-error-recovery`** — Issue 1 + 2 必走完整 5-step：**禁止跳到 fix 前先做 instrument**。Console.log 是必備。執行不通的 SPIN 行為要明確 capture（fire vs not fire / promise resolve vs not）。
- **`incremental-implementation`** — 這 PR 大但**不該 1 commit 全做**。每個 issue 一個 commit + verify 後 push next：
  1. SPIN bug 真實 root cause + fix
  2. Spirit count debug + fix
  3. Visual cleanup（mockup 對齊）
- **`source-driven-development`** — Pixi 8 event system 細節（`pointertap` vs `pointerdown` + `pointerup`、`stage.eventMode` 是否需 set、`hitArea` interaction with sortableChildren）— 對照 https://pixijs.com/8.x/guides/components/events 官方 docs。

---

## 3. Spec drift check (P6)

1. `mempalace_search "SPIN button bug Pixi 8 event system Container hitArea third attempt"`
2. 確認 BattleScreen.ts 既有 drawSpinButton + waitForSpinClick + onSpinClick (PR #150 + #151 加的)
3. 確認 既有 `this.container.sortableChildren = true` (p10-bug-01 + #142)
4. 確認 `void this.loop()` 在 onMount line ~311
5. 確認 stage 跟 app.stage 之間有沒有 eventMode 設定

---

## 4. Task — Issue 1: SPIN button 終極 debug

### Step 1: REPRODUCE in fresh preview

**Mandatory steps**：
```bash
npm run dev
```
1. **開瀏覽器 incognito mode**（避免 cache）→ http://localhost:5173/
2. **F12 開 DevTools console**（看到 console 才繼續）
3. 進 Battle screen
4. 點 SPIN button
5. **記錄 console 完整輸出**（or screenshot）

### Step 2: INSTRUMENT — 加詳盡 DEV log

`drawSpinButton` 創建後加：

```ts
if (import.meta.env.DEV) {
  console.log('[SPIN] button created:', {
    x: this.spinButton.x,
    y: this.spinButton.y,
    eventMode: this.spinButton.eventMode,
    cursor: this.spinButton.cursor,
    hitArea: this.spinButton.hitArea,
    visible: this.spinButton.visible,
    alpha: this.spinButton.alpha,
    zIndex: this.spinButton.zIndex,
    parentSortable: (this.container as any).sortableChildren,
    listenerCount: this.spinButton.listenerCount('pointertap'),
  });
}
```

`onSpinClick` 開頭加：

```ts
private onSpinClick(): void {
  if (import.meta.env.DEV) {
    console.log('[SPIN] click event fired! spinClickResolve=', this.spinClickResolve, 'autoMode=', this.autoMode);
  }
  // ... existing ...
}
```

`waitForSpinClick` 末加：

```ts
private waitForSpinClick(): Promise<void> {
  this.enableSpinButton();
  if (import.meta.env.DEV) {
    console.log('[SPIN] waitForSpinClick promise armed');
  }
  return new Promise(resolve => {
    this.spinClickResolve = resolve;
  });
}
```

`loop` 重起時加：

```ts
private async loop(): Promise<void> {
  if (import.meta.env.DEV) console.log('[LOOP] entered, formation lengths A/B:', this.formationA.length, this.formationB.length);
  this.running = true;
  // ... existing ...
}
```

### Step 3: LOCALIZE — 看 console 輸出

可能情境：

#### Case A: Click fired but `spinClickResolve` is null
→ Loop 沒 await（沒進 `waitForSpinClick`）OR 已被 cleared by previous click。**Root cause**: loop entry timing OR double-click race condition。

#### Case B: Click fired, resolve called, but loop doesn't progress
→ Promise resolve 後 `await this.waitForSpinClick()` 後面卡住。**Root cause**: `await this.reel.spin(spin.grid)` 或 attack/damage hang。

#### Case C: Click event doesn't fire at all
→ button 真的點不到。**Root cause** 子情境：
- C1: `eventMode` not 'static' (button 印 console 顯示)
- C2: `hitArea` not set or wrong size (button 印 console 顯示)
- C3: parent container's `sortableChildren=true` not set or zIndex 排序 issue
- C4: 上層 element 攔截 (例如 reel container with eventMode='static')
- C5: `app.stage.eventMode` not 'static' (Pixi 8 有時需顯式啟用)

### Step 4: FIX

依 console 結果決定 fix。**禁止憑感覺亂改**。

可能 fix 集合（按 case）：
- **Case A**: spinClickResolve clearing too eagerly → 不 clear 在 onSpinClick，let loop iteration 完成自動 clear
- **Case B**: reel.spin 內部 hang → 看 SlotEngine / SlotReel.spinColumn 是否有異步 chain 斷
- **Case C5**: `app.stage.eventMode = 'static'` 加在 main.ts 或 BattleScreen onMount
- **Case C3/C4**: zIndex / addChild 順序調整 — SPIN button 最後 addChild 確保最上層
- **Case C2**: hitArea 已加（#151）— 但如果 hitArea Rectangle dimensions 不對也會失效，verify 是 (0,0,200,60)

### Step 5: GUARD

修完 **拿掉所有 DEV console.log**（保留乾淨 production code）。Verify 連續 5 次 SPIN click 都正常 fire round。

**Commit 1**: `fix(chore): SPIN button third-attempt — [actual root cause from debugging]`

---

## 5. Task — Issue 2: Spirit count 驗證

### Step 1: Instrument

`drawFormation` 開頭加：

```ts
if (import.meta.env.DEV) {
  console.log(`[Formation] ${side} length=${formation.length}, items:`, formation.map((u, i) => u ? `${i}: ${u.spiritKey}` : `${i}: null`));
}
```

`onMount` 早期（formation 創建後）加：

```ts
if (import.meta.env.DEV) {
  console.log('[onMount] cfg.selectedA=', this.cfg.selectedA);
  console.log('[onMount] cfg.selectedB=', this.cfg.selectedB);
  console.log('[onMount] formationA length:', this.formationA.length);
  console.log('[onMount] formationB length:', this.formationB.length);
}
```

### Step 2: Verify

- `cfg.selectedA` should be array of 5 symbol IDs (from DraftScreen 5-pick)
- `formationA.length` should be 5
- 每 unit 是 `{ unitId, spiritKey, hp, ... }` non-null

### Step 3: Fix if mismatch

可能 issue：
- (a) `createFormation` 把 cfg.selectedA 跟 5 個 unit 放不對 row → 重新 verify createFormation logic
- (b) NineGrid placement 5-of-9 placement 跟 formation slot 0-4 mapping 錯 → 已在 PR #148 review，理應 OK
- (c) Draft 沒真的傳 5 個 → DraftScreen bug

**Commit 2**: `fix(chore): formation length / draft cfg verification`

---

## 6. Task — Issue 3: Visual rebuild 對齊 mockup

### Approach: Side-by-side mockup vs game

Open in browser:
- Mockup: `file:///C:/Users/maxwu/Documents/ClaudeAI/DualSlot-Pixi/download_picture/Dual%20Slot%20Pixi/Battle%20Screen%20Mockup.html`
- Game: http://localhost:5173/?demo=1

For each mockup zone, **list discrepancies** vs game:

| Zone | Mockup expected | Game current | Action |
|---|---|---|---|
| Header | Compact RETREAT/ROUND/wallet | (verify) | (note diff) |
| JP HERO | 178px panel with bulbs | (verify) | (note diff) |
| 「戰」 separator | Centered 戰 over hairline | (verify) | (note diff) |
| Side labels | A·我方 / 對手·B | (verify match) | (note diff) |
| Spirit formation | 5 per side, NineGrid 3×3 cells, ~5/9 randomly placed | (verify count + position) | (note diff) |
| VS shield | 50px circle at center between A/B grids | (verify) | (note diff) |
| Reel header | ● A · YOUR TURN  ◇ SHARED BOARD ◇  B · WAITING ○ | (verify) | (note diff) |
| Reel grid | 5×3 glossy clan balls | (verify) | (note diff) |
| PAYLINES | 1-10 cells horizontal | (verify positioning) | (note diff) |
| Action bar | AUTO / SPIN / SKIP centered | (verify match) | (note diff) |
| Battle log | Dark panel with cream text | (verify) | (note diff) |
| **不該有的元素** | (none in mockup) | (list anything visible) | DELETE |

### 「不該有的元素」候選（可能該刪）

Owner 截圖看到 LEFT 比 RIGHT mockup 多的東西：
- ❓ 4 角 corner ornament（addCornerOrnaments 在 onMount line 245 加）— mockup 也有但較小
- ❓ Background grid overlay (drawGridOverlay) — mockup 沒這 grid
- ❓ Edge vignette (drawEdgeVignette) — mockup 沒這 vignette
- ❓ Perspective floor 在 arena 外延伸 — mockup 只在 arena 區
- ❓ 「BACK TO DRAFT」button — mockup 沒（已用 RETREAT in header）
- ❓ AmbientBackground particles — mockup 沒

**Executor 自己 visual diff 後決定**：哪些要刪 / 哪些保留 / 哪些調整。

### Step: Visual rewrite per finding

每個 discrepancy 一個 commit OR 集中數個合併（executor 判斷）。**禁止 1 commit 全改**。

**Commits 3-N**: `feat(chore): visual cleanup — [specific item]`

---

## 7. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 為主，可能需動：
- `src/screens/SlotReel.ts`（若 reel cell 視覺對 mockup 不齊需微調）
- `src/components/Decorations.ts`（若 corner ornament 要刪減 / 改小）

**禁止**：
- SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin（**機制層 frozen**）
- DraftScreen / LoadingScreen / ResultScreen / FXPreviewScreen
- main.ts callback chain
- DesignTokens
- 加新 asset
- scripts/sim-rtp.mjs
- SPEC.md
- 改 createFormation 邏輯（如 verification 顯示 formation length 錯，flag 給 owner，本 PR 不重寫 mechanic）
- 加 Spine runtime / 新 atlas（純既有元素 cleanup + bug fix）

---

## 8. DoD

1. `npm run build` 過
2. **3+ 個 commits**（per `incremental-implementation`）：
   - commit 1: SPIN bug debug + fix（含 console log instrument 過程記錄在 commit message OR PR body）
   - commit 2: spirit count verification（若 OK 不 fix，僅 instrument 後 cleanup）
   - commit 3+: visual cleanup per finding
3. push + PR URL
4. **Preview 驗證 critical**：
   - 在 incognito browser 開 game preview
   - **點 SPIN：reel 真的旋轉 + 結果出現 + ROUND counter 從 00 變 01**
   - 連點 SPIN 5 次，wallet / HP / round 皆正確 update
   - **每側 spirit 數量 = 5**（match draft picks）
   - 視覺對齊 mockup（PR body 列每 zone diff vs mockup）
5. 截圖 **3 張**：
   - 1 張 game preview side-by-side mockup（高度相似度）
   - 1 張 mid-spin（看 reel actually 在轉）
   - 1 張 console log（看 SPIN click fire + loop run）

---

## 9. Handoff — REQUIRED 詳述

- PR URL
- 1 行摘要
- **SPIN bug 真實 root cause（一句話寫清楚 from console evidence）**
- Spirit count verification 結果（formation length 是否真 5 / cfg.selectedA 是否真 5）
- Visual diff list — 每 zone「mockup vs game」對比 + 哪些動了 / 哪些保留 / 哪些刪
- 3 張截圖
- 任何 mockup 對不上的硬限制（例如 Pixi 8 沒 native gradient，模擬偏差）
- Spec deviations：本 PR 純 visual + bug fix，無新 SPEC drift（auto-loop → manual 已是 #150 既存）
