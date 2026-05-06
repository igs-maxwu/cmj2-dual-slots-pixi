# Chore #219 — UiButton 文字改深色（金底白字對比差，readability 修正）

## 1. Context

Owner 試玩 2026-05-06 反映：DraftScreen toolbar 4 顆按鈕（CLEAR / MIRROR A→B / RANDOM 5+5 / START BATTLE）的字「不好讀」。

### 現況分析

[UiButton.ts:54-56](src/components/UiButton.ts#L54)：
```ts
fill: opts.color ?? T.FG.white,                                  // 白色字
letterSpacing: 2,
stroke: { color: 0x000, width: opts.stroke ?? 2 },               // 2px 黑邊
```

底色（[UiButton.ts:146-149](src/components/UiButton.ts#L146)，normal state 漸層）：
- top: `#ffe488` (亮金)
- mid: `#d4a020` (中金)
- bot: `#7a5408` (深金)

→ **白字在亮金頂端**對比極差（~1.5:1，遠低於 WCAG AA 4.5:1）；**白字在深金底部**才勉強看得清。2px 黑 stroke 撐不起整塊白色 fill。

### Owner 決策（2026-05-06）— 選項 A

**深色 fill 0x2a1a05 (dark warm-brown) + 移除 stroke**。理由：
1. 0x2a1a05 在金漸層上 contrast ratio ~9-11:1 (WCAG AAA)
2. 跟 reel gem 中央漢字 ([SlotReel.ts:262](src/screens/SlotReel.ts#L262)) 同色，**已驗證讀得清**
3. 跟 SPIN button 文字 0x0D1421 同類深色 ([BattleScreen.ts:1173](src/screens/BattleScreen.ts#L1173)) — 風格一致
4. 深字本身對比夠，stroke 變成多餘髒邊

純文字樣式調整 — 不動 button bg / FillGradient / hit-test / animation。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 改 default + 清掉 unused opts

---

## 2. Spec drift check (P6)

1. 確認 [UiButton.ts:48-58](src/components/UiButton.ts#L48) Text style 仍 fill=T.FG.white + stroke 2px
2. 確認 [UiButton.ts:18-22](src/components/UiButton.ts#L18) `UiButtonOpts` interface 含 `color?` `stroke?`
3. **Audit per chore #203 lesson**：grep 全 codebase `new UiButton` call sites，確認無人傳 `color:` 或 `stroke:` opts
   - 預期結果：[DraftScreen.ts:535](src/screens/DraftScreen.ts#L535) + [DraftScreen.ts:543](src/screens/DraftScreen.ts#L543) 都只傳 `fontSize`
4. 確認 chore #204/#205 button bg 結構不動 (FillGradient + 3-layer shadow + corner dots + top highlight)

---

## 3. Task

### Single commit — Dark text + clean unused opts

#### 3a. 改 default fill + 移除 default stroke

`src/components/UiButton.ts` line 48-58：

當前：
```ts
this.lbl = new Text({
  text,
  style: {
    fontFamily: T.FONT.title,
    fontWeight: '700',
    fontSize: opts.fontSize ?? Math.round(height * 0.42),
    fill: opts.color ?? T.FG.white,
    letterSpacing: 2,
    stroke: { color: 0x000, width: opts.stroke ?? 2 },
  },
});
```

改成：
```ts
// chore #219: dark warm-brown fill on gold gradient (was T.FG.white — poor contrast on light top
// of gradient ~1.5:1). 0x2a1a05 matches reel gem char + SPIN button style; ~9:1 WCAG AAA contrast.
// Stroke removed — dark fill on gold needs no outline (stroke became visual noise).
this.lbl = new Text({
  text,
  style: {
    fontFamily: T.FONT.title,
    fontWeight: '700',
    fontSize: opts.fontSize ?? Math.round(height * 0.42),
    fill: 0x2a1a05,
    letterSpacing: 2,
  },
});
```

#### 3b. 清掉 UiButtonOpts unused fields

`src/components/UiButton.ts` line 18-22：

當前：
```ts
export interface UiButtonOpts {
  fontSize?: number;
  color?: number;
  stroke?: number;
}
```

改成：
```ts
// chore #219: removed color + stroke — neither was used by callers, defaults moved into Text style.
export interface UiButtonOpts {
  fontSize?: number;
}
```

> **理由**：chore #203 audit lesson — no unused options。color/stroke 都沒 caller 傳，dead interface field 留著只會混淆。如果未來真的要 override 再加。

#### 3c. 確認沒其他 caller 漏處理

grep `new UiButton(.*color:|.*stroke:` 全 src — 應為空。

`new UiButton(...)` 只在 DraftScreen 兩處被 call，都只傳 `fontSize`，本 chore 不影響其他 screen。

**Commit**: `tune(chore): UiButton text fill 0x2a1a05 + remove default stroke (white-on-gold poor contrast; matches reel gem char + SPIN button); clean unused UiButtonOpts.color/stroke`

---

### 檔案範圍（嚴格）

**修改**：
- `src/components/UiButton.ts` —
  - line 18-22 `UiButtonOpts` 移除 `color?` `stroke?`
  - line 48-58 Text style 改 fill + 移除 stroke + 加註解

**禁止**：
- 動 `drawBg` 函式 (FillGradient / shadows / corner dots / top highlight 全保留)
- 動 hover / pressed / disabled state 邏輯
- 動 hitArea / eventMode / pointer events
- 動 AudioManager.playSfx / scale tween
- 動 `T.FG.white` / `T.GOLD.*` DesignTokens
- 動 DraftScreen call sites (signature 不變，只 default 變)
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過 — TypeScript 應 happy（移除 interface field 後沒 caller 影響）
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "fill: 0x2a1a05" src/components/UiButton.ts` — 應 1 處
   - `grep "T.FG.white" src/components/UiButton.ts` — 應為空
   - `grep "stroke:" src/components/UiButton.ts` — 應為空（drawBg 內 stroke 是 Graphics border 不算 Text stroke）
   - `grep "color\|stroke" src/components/UiButton.ts | head -10` — 確認 UiButtonOpts 沒 color/stroke 欄位
   - `grep "new UiButton" src` — 仍 2 call sites + signature 沒變
5. **Preview 驗證**：
   - 進 DraftScreen
   - 4 顆按鈕（CLEAR / MIRROR A→B / RANDOM 5+5 / START BATTLE）字**清晰可讀**（深棕在金底）
   - hover state（漸層更亮金）字仍清楚
   - pressed state（漸層更暗金）字仍清楚
   - disabled state (`SELECT 5 EACH` 灰底）字 alpha 0.4 仍可讀
   - chore #204 button polish 視覺保留（金板 + 角點 + 頂高光 + drop shadow 都在）
6. **Audit per chore #203 lesson**：grep 全 codebase 確認沒地方還在傳 `color:` 或 `stroke:` opts 給 UiButton

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張 DraftScreen 截圖（按鈕字清楚對比）
- spec deviations: 0（純文字樣式 + 清 dead interface field）
- Process check：照新 pattern — 把 `git checkout feat/<slug>` + `git add` + `git commit` + `git push -u` 串在**單一 Bash call**
