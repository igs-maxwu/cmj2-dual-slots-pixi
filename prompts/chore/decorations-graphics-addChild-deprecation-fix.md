# Chore — Pixi v9 deprecation fix: Decorations.addCornerOrnaments Graphics→Container parent

## 1. Context

Owner 提供 console stack trace：
```
PixiJS Deprecation Warning: addChild: Only Containers will be allowed to add children in v8.0.0
  at upgradeToDecoratedLoadingScreen (LoadingScreen)
  at lm.show (ScreenManager)
```

定位真實 culprit（chore #190 audit 漏掉）：`src/components/Decorations.ts` `addCornerOrnaments` line 48 + 54：

```ts
const corner = new Graphics();           // ← parent = Graphics
corner.moveTo(...).lineTo(...).stroke(...);
// ...
const inner = new Graphics();
corner.addChild(inner);                  // ← Graphics.addChild ❌ deprecated
const dot = new Graphics().circle(...);
corner.addChild(dot);                    // ← Graphics.addChild ❌ deprecated
container.addChild(corner);
```

Pixi 8: Graphics extends Container so works + warns。Pixi 9: Graphics 不再 extends Container → break。

### Fix
把 corner 從 `Graphics` 改成 `Container`，把 outer L bracket 拆成獨立 Graphics 加到 Container。

純 refactor — 視覺零變化。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 沿用既有 mockup CornerOrnament 視覺（line 38-54 的 stroke + dot），只重組 parent

---

## 2. Spec drift check (P6)

1. 確認 `addCornerOrnaments` 仍被多處 caller 使用（LoadingScreen / DraftScreen / BattleScreen 等）
2. 確認 chore #190 audit 對 Pixi addChild deprecation 結論 "no culprit found, defer to v9 migration" — **本 chore 修正該結論**

---

## 3. Task

### Single commit — Wrap corner in Container

`src/components/Decorations.ts` line 33-62：

當前：
```ts
for (const p of places) {
  const corner = new Graphics();

  // Outer L bracket: horizontal + vertical arms + diagonal accent
  corner.moveTo(2 * s, 2 * s).lineTo(20 * s, 2 * s);
  corner.moveTo(2 * s, 2 * s).lineTo(2 * s, 20 * s);
  corner.moveTo(2 * s, 2 * s).lineTo(12 * s, 12 * s);
  corner.stroke({ width: 1.5, color: T.GOLD.base, alpha: 0.9 });

  // Inner highlight L
  const inner = new Graphics();
  inner.moveTo(6 * s, 6 * s).lineTo(14 * s, 6 * s);
  inner.moveTo(6 * s, 6 * s).lineTo(6 * s, 14 * s);
  inner.stroke({ width: 1, color: T.GOLD.glow, alpha: 0.6 });
  corner.addChild(inner);                   // ❌ Graphics.addChild

  // Corner dot
  const dot = new Graphics()
    .circle(2 * s, 2 * s, 1.5 * s)
    .fill({ color: T.GOLD.base });
  corner.addChild(dot);                     // ❌ Graphics.addChild

  corner.scale.set(p.sx, p.sy);
  corner.x = p.x;
  corner.y = p.y;
  corner.alpha = alpha;
  container.addChild(corner);
}
```

改成：
```ts
for (const p of places) {
  // chore #195: Pixi v9 deprecation fix — corner parent was Graphics (extends Container in v8 only).
  // Use Container as parent so Graphics children attach via Container.addChild (proper API).
  const corner = new Container();

  // Outer L bracket — own Graphics, child of Container
  const outer = new Graphics();
  outer.moveTo(2 * s, 2 * s).lineTo(20 * s, 2 * s);   // horizontal arm
  outer.moveTo(2 * s, 2 * s).lineTo(2 * s, 20 * s);   // vertical arm
  outer.moveTo(2 * s, 2 * s).lineTo(12 * s, 12 * s);  // diagonal accent
  outer.stroke({ width: 1.5, color: T.GOLD.base, alpha: 0.9 });
  corner.addChild(outer);

  // Inner highlight L
  const inner = new Graphics();
  inner.moveTo(6 * s, 6 * s).lineTo(14 * s, 6 * s);
  inner.moveTo(6 * s, 6 * s).lineTo(6 * s, 14 * s);
  inner.stroke({ width: 1, color: T.GOLD.glow, alpha: 0.6 });
  corner.addChild(inner);

  // Corner dot at L origin
  const dot = new Graphics()
    .circle(2 * s, 2 * s, 1.5 * s)
    .fill({ color: T.GOLD.base });
  corner.addChild(dot);

  // Mirror to the correct corner via negative scale
  corner.scale.set(p.sx, p.sy);
  corner.x = p.x;
  corner.y = p.y;
  corner.alpha = alpha;
  container.addChild(corner);
}
```

### 視覺驗證

`npm run build` 過 → owner 試玩確認 corner ornaments 視覺**無差別**（只是 parent type 變 Container）。

**Commit**: `fix(chore): Decorations corner parent Graphics→Container — Pixi v9 deprecation (chore #190 audit miss)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/components/Decorations.ts`（addCornerOrnaments 內 for-loop body）

**禁止**：
- 動 caller signatures (LoadingScreen / DraftScreen / BattleScreen 等仍 call addCornerOrnaments(container, w, h, size?, alpha?))
- 改視覺（stroke widths / colors / alpha 都不變）
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "Graphics().*\.addChild\|graphic\.addChild" src/components/Decorations.ts` — 應 0 hits
   - F12 console 進 LoadingScreen 應**無 Pixi addChild deprecation warning**
5. **Preview 驗證**：
   - LoadingScreen 4 角 ornament 仍正常顯示（金色 L bracket + dot + inner highlight）
   - 其他 caller (DraftScreen / BattleScreen) 4 角 ornament 仍 OK
   - Console 乾淨（chore #190 留下的 PixiJS deprecation 真消失）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（LoadingScreen 角落 ornaments + console 無 warning）
- 確認 4 角 ornament 視覺零變化
- chore #190 audit 結論修正 — culprit 已找到並修
- Spec deviations：預期 0
