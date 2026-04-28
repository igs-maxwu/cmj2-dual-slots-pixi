# Chore — MAJOR/MINOR 字級放大 + 5v5 spirit 站位 debug + 白虎 ball 文字對比修正

## 1. Context

Owner 試玩 Sprint 12 後反映 3 個 issue（截圖佐證）：

1. **MAJOR/MINOR 文字 + 數字太小** — 既有 p11-vA-01 hero spec 是 label 9pt / value 16pt，玩家看不清
2. **選 5v5 但只看到 3v2** — 5-pick draft 但 BattleScreen 只顯示 A 側 3 個 spirit / B 側 2 個 spirit（**真實 bug 或 visual overlap 不確定**，需 console debug）
3. **白虎 ball 配色太淺白字看不清** — `T.CLAN.whiteGlow = 0xfff0b3`（米黃）+ 白色 ball 文字 → 對比 < 2:1 不可讀（WCAG fail）

3 個 issue 一起在 single PR 處理（皆視覺 / decoration 層，不動機制）。

---

## Skills suggested for this PR

- **`debugging-and-error-recovery`** — Issue 2 必走 5-step（reproduce / instrument / localize / fix / guard）— 過去 #150-#152 SPIN bug 證明猜測沒用，本 PR 必 console-driven。
- **`incremental-implementation`** — 3 atomic commits per issue。每個 commit 自包含 + verify。
- **`source-driven-development`** — 對 white-clan 文字色用 contrast checker（WCAG AA 4.5:1 小字 / 3:1 大字）+ T.CLAN.whiteGlow hex 0xfff0b3 對黑色 0x000000 對比 ~12:1 OK。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 12 BattleScreen 3v2 spirit count formation NineGrid debug major minor font"`
2. 確認 既有 p11-vA-01 `drawJackpotMarquee` MAJOR/MINOR text 字級 (應為 9 / 16)
3. 確認 既有 p11-vA-02 `slotToArenaPos` NineGrid 5-of-9 placement
4. 確認 既有 p11-vA-03 `SYMBOL_VISUAL` map for white clan id 2,3 → char '白' + color T.CLAN.whiteGlow
5. 確認 既有 chore #150 spirit shadow + drawFormation 邏輯（chore #146 1-2-2 已被 p11-vA-02 NineGrid 取代）

## 3. Task

### 3a. Commit 1 — MAJOR/MINOR 字級放大

`BattleScreen.ts` `drawJackpotMarquee()` 內找 MAJOR/MINOR text 創建（既有 p11-vA-01 留下）：

當前：
- label「MAJOR」/「MINOR」: fontSize 9pt
- value 數字: fontSize 16pt

改成：
- label: fontSize **12pt**（+3）
- value: fontSize **22pt**（+6）

對應 letterSpacing 也微調（label 從 2 → 3）。

**注意**：這個 zone 已被 owner 反映過 —「太小」的訴求要顯著改變才 satisfy（不是 +1pt cosmetic bump）。

**Commit 1**: `tune(chore): MAJOR/MINOR fontSize 9→12 label / 16→22 value`

### 3b. Commit 2 — Spirit 5v5 站位 debug + fix

#### Step 1: Reproduce + instrument

`BattleScreen.onMount` 早期（formation 創建後）加 DEV log：

```ts
if (import.meta.env.DEV) {
  console.log('[Chore] formationA length:', this.formationA.length,
              'items:', this.formationA.map((u, i) => u ? `${i}:${u.spiritKey}` : `${i}:null`));
  console.log('[Chore] formationB length:', this.formationB.length,
              'items:', this.formationB.map((u, i) => u ? `${i}:${u.spiritKey}` : `${i}:null`));
  console.log('[Chore] gridPlacementA:', this.gridPlacementA);
  console.log('[Chore] gridPlacementB:', this.gridPlacementB);
}
```

`drawFormation` 開頭加：

```ts
private drawFormation(side: 'A' | 'B'): void {
  const formation = side === 'A' ? this.formationA : this.formationB;
  if (import.meta.env.DEV) {
    console.log(`[Chore] drawFormation ${side} — formation.length=${formation.length}`);
  }
  // ... existing ...
  for (const { slot, pos } of sortedSlots) {
    const unit = formation[slot];
    if (import.meta.env.DEV) {
      console.log(`[Chore]   slot ${slot}: unit=${unit ? unit.spiritKey : 'null'} pos=(${pos.x}, ${pos.y}) row=${pos.row}`);
    }
    if (!unit) continue;
    // ... existing drawing ...
  }
}
```

#### Step 2: Reproduce in incognito browser

進 Battle，看 console：
- formationA 是否真有 5 non-null entries
- gridPlacementA 是否 length 5
- 5 個 slot 的 pos.x / pos.y 是否 distinct（無重疊）

#### Step 3: Localize 從 console evidence

可能 cause：

##### Case A: formation 真的少 spirit（draft → battle 傳遞 bug）
console 顯示 `formationA.items: 0:meng, 1:lingyu, 2:null, 3:null, 4:null` → DraftScreen 沒傳 5 個或 createFormation bug。

##### Case B: NineGrid placement 重疊（cellIdx collision）
console 顯示 5 slot 全 non-null 但 pos.x/y 有重複 → Fisher-Yates collision 不可能（cells.slice 0,5 sorted distinct）→ 排除這 case。

##### Case C: 兩 spirit pos 計算結果相同（mirror logic bug）
A 側 mirroredCol = col；B 側 mirroredCol = 2-col。若 mirror 邏輯錯，B 側 spirit 可能跟 A 側同 x → 視覺上 overlap。需檢查 NINE_B_GRID_LEFT_X 是否 440（CANVAS_WIDTH - NINE_GRID_TOTAL - 32）。

##### Case D: 視覺 overlap 不是 bug
front row scale 1.10 比 back row scale 0.78 大很多 — front 蓋 back，owner 視覺上**算不到**其實渲染 5 個。

#### Step 4: Fix

依 Case 結果修。**禁止憑感覺改**。

最可能 fix：
- **Case D（視覺 overlap）**：增加 cell 之間 horizontal gap，讓 5 spirit 不互相遮擋。在 NineGrid x 計算加 spacing。具體 implementation by executor 看 pos.x 重疊狀況。

#### Step 5: Cleanup

修完**移除所有 DEV console.log**（保留乾淨 production code）。

**Commit 2**: `fix(chore): spirit 5v5 visibility — [actual root cause + fix from debugging]`

### 3c. Commit 3 — 白虎 ball 文字對比修正

`SlotReel.ts` `setCellSymbol()` 內找 charText style 創建。當前所有 symbol 都用：

```ts
fill: 0xFFFFFF,   // white text
stroke: { color: visual.color, width: 2 },   // clan stroke
```

問題：白虎 ball 顏色 `T.CLAN.whiteGlow = 0xfff0b3`（米黃）+ 文字白色 = 對比不足。

**Fix**：對 white-clan symbol（id 2, 3）使用**深色文字 + 米黃 stroke**反轉：

```ts
const isWhiteClan = symId === 2 || symId === 3;

const charText = new Text({
  text: visual.char,
  style: {
    fontFamily: 'Noto Serif TC, "Ma Shan Zheng", serif',
    fontWeight: '700',
    fontSize: Math.round(r * 0.95),
    fill: isWhiteClan ? 0x4a3a1a : 0xFFFFFF,                // 白虎用深棕 / 其他用白
    stroke: { color: visual.color, width: isWhiteClan ? 1 : 2 },   // stroke 變細
    dropShadow: {
      color: visual.color,
      alpha: isWhiteClan ? 0.4 : 0.6,
      blur: 6,
      distance: 0,
    },
  },
});
```

**深棕 0x4a3a1a 對 0xfff0b3 對比 ~7:1 ✓ WCAG AAA**。

**Commit 3**: `fix(chore): white-clan ball use dark text for WCAG contrast (>= 7:1)`

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（drawJackpotMarquee MAJOR/MINOR fontSize + spirit debug log + fix per Case）
- `src/screens/SlotReel.ts`（setCellSymbol charText fill conditional）

**禁止**：
- 動 機制（SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool / FreeSpin）
- 動 createFormation logic（若 Case A 真實 bug，flag 不重寫）
- 動 NineGrid `gridPlacementA/B` Fisher-Yates 算法（若 Case B/C 真實 bug，調 const 不改邏輯）
- 動 SYMBOL_VISUAL map（只動 charText style，不改 char + color mapping）
- DesignTokens
- 加新 asset
- 改 res-01 / pace-01 / 既有 ceremony / fx
- main.ts
- scripts/sim-rtp.mjs（純視覺）
- SPEC.md

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**（per `incremental-implementation`）
3. push + PR URL
4. **Preview 驗證 critical**：
   - JP marquee MAJOR/MINOR 文字明顯變大易讀
   - 進 Battle 5-pick draft 後 BattleScreen 看到**雙方各 5 spirit**（無 overlap，無消失）
   - Reel 內白虎 ball「白」字深色清楚可讀（vs 之前白字看不清）
   - 其他 clan ball（青/朱/玄/特殊）文字仍白色清楚（不影響）
   - 無 DEV console log 殘留（production cleanup 過）
5. 截圖 1 張（含 JP marquee 大字 + 5v5 完整站位 + 白虎 ball 對比）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- **Issue 2 真實 root cause**（一句話從 console evidence 寫清楚 — Case A/B/C/D 哪個）
- 5v5 是否實際所有 10 個 spirit 都可見
- 白虎 ball 對比改善程度（主觀感覺 OK / 仍有點淺）
- MAJOR/MINOR 22pt 是否足夠大（or 還要再放大？）
- Spec deviations：預期 0
