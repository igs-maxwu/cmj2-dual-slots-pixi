# Chore — ROUND pill 簡化（Sprint 10 the-stylist deferred audit）

## 1. Context

Sprint 10 the-stylist subagent audit 留下 deferred item：BattleScreen header 的 ROUND pill 視覺**過設計**。

當前 (BattleScreen.ts line 636-651)：
```ts
const pillBg = new Graphics()
  .roundRect(-52, -14, 104, 28, 14)
  .fill({ color: 0x000000, alpha: 0.4 })
  .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
this.roundText = goldText('ROUND 00', { fontSize: 14, withShadow: true });
this.roundText.style.letterSpacing = 2;
```

「過設計」points：
- goldText (gradient 3-stop + dropShadow style) 對 14pt header 字偏重
- pillBg 黑底 + 金 stroke 雙層裝飾
- letterSpacing 2 比較密

簡化後 HUD 較俐落。

純視覺微調 — 不動 ROUND counter logic / round increment / refresh。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用 native Text 替代 goldText (簡化字)

---

## 2. Spec drift check (P6)

1. 確認 BattleScreen.drawCompactHeader line 636-651 ROUND pill 結構
2. 確認 chore p10-v01 既有 hdr 高度 / 位置不動

---

## 3. Task

### Single commit — Simplify ROUND pill

`src/screens/BattleScreen.ts` line 636-651：

當前：
```ts
// Center: ROUND pill
this.roundPill = new Container();
this.roundPill.x = CANVAS_WIDTH / 2;
this.roundPill.y = midY;

const pillBg = new Graphics()
  .roundRect(-52, -14, 104, 28, 14)
  .fill({ color: 0x000000, alpha: 0.4 })
  .stroke({ width: 1, color: T.GOLD.shadow, alpha: 0.6 });
this.roundPill.addChild(pillBg);

this.roundText = goldText('ROUND 00', { fontSize: 14, withShadow: true });
this.roundText.anchor.set(0.5, 0.5);
this.roundText.style.letterSpacing = 2;
this.roundPill.addChild(this.roundText);
hdr.addChild(this.roundPill);
```

改成（chore #207 simplified）：
```ts
// Center: ROUND pill — chore #207 simplified (was goldText gradient + double-stroke pill)
this.roundPill = new Container();
this.roundPill.x = CANVAS_WIDTH / 2;
this.roundPill.y = midY;

// Subtler pill bg — slim line above + below, no fill
const pillBg = new Graphics()
  .rect(-44, -10, 88, 1)                                // top hairline
  .fill({ color: T.GOLD.shadow, alpha: 0.5 })
  .rect(-44, 9, 88, 1)                                  // bottom hairline
  .fill({ color: T.GOLD.shadow, alpha: 0.5 });
this.roundPill.addChild(pillBg);

// Plain Text replaces goldText — lighter, more HUD-like
this.roundText = new Text({
  text: 'ROUND 00',
  style: {
    fontFamily: T.FONT.body,
    fontWeight: '600',
    fontSize: 13,                                       // was 14
    fill: T.GOLD.glow,
    letterSpacing: 2.5,
  },
});
this.roundText.anchor.set(0.5, 0.5);
this.roundPill.addChild(this.roundText);
hdr.addChild(this.roundPill);
```

> **變化**：
> - pillBg：roundRect 黑底+金 stroke → 上下 1px hairline（簡潔 HUD 風）
> - roundText：goldText (gradient + shadow) → plain Text + T.GOLD.glow fill（一致 HUD 風 vs walletA/B label）
> - fontSize 14 → 13
> - letterSpacing 2 → 2.5
>
> **net effect**：HUD 各 element 風格更統一（之前 ROUND pill 視覺偏重，跟 wallet 文字風格不同）。

**Commit**: `polish(chore): ROUND pill simplified — Sprint 10 the-stylist deferred audit (goldText→plain Text, double-stroke→hairlines)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（drawCompactHeader 內 ROUND pill 段）

**禁止**：
- 動 ROUND counter logic（this.round increment / refresh()）
- 動 hdr 整體 layout（COMPACT_HDR_H / midY / x positions）
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "ROUND.*pill\|roundPill" src/screens/BattleScreen.ts | head -5` — 確認 pill drawing 簡化
5. **Preview 驗證**：
   - HUD 中央 ROUND pill 視覺較輕（vs 之前金底 pill）
   - ROUND 數字仍清楚（fontSize 13 + 金色 + hairline 框）
   - ROUND counter 仍正確 increment（每 spin 加 1）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（HUD 對比）
- 簡化版 vs 原版視覺接受度
- Spec deviations：預期 0
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3` + close stale PR
