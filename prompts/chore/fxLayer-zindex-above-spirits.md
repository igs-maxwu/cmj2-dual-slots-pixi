# Chore — fxLayer zIndex 提到 spirit 之上（dmg 數字總在最上層）

## 1. Context

Owner 試玩 chore #188 後反映：dmg 數字「-21」**被 spirit 蓋住**（截圖示意）。

### Root cause

`fxLayer` 是 dmg 數字 + hit burst 的容器：
```ts
this.container.addChild(this.fxLayer);   // line 329
```

預設 `fxLayer.zIndex = 0`。但 chore #182 attack avatar 設 `avatar.zIndex = 1500` + `parent.sortableChildren = true`：
- attack 期間 spirit container z=1500
- fxLayer z=0
- spirit 蓋住 fxLayer 所有內容（dmg 數字 / hit burst）

### Fix

`fxLayer.zIndex = 3000`（> 1500 attack avatar），確保 dmg 數字 + hit burst 永遠在最上層。

純視覺修正，1 行改動。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 對齊 chore #182 zIndex 1500 + JP/Free Spin ceremony 2000-2500 範圍

---

## 2. Spec drift check (P6)

1. 確認 chore #182 `avatar.zIndex = 1500` 仍存在
2. 確認 既有 ceremony zIndex (j-04 JP / s13-fx-01 / etc) — 通常 2000-2500
3. fxLayer 應該在 ceremony 之下，spirit attack 之上

---

## 3. Task

### Single commit — Set fxLayer.zIndex + sortableChildren

`src/screens/BattleScreen.ts`：

#### 3a. fxLayer 宣告

當前 line ~152：
```ts
private fxLayer = new Container();
```

加 zIndex：
```ts
private fxLayer = (() => {
  const c = new Container();
  c.zIndex = 3000;   // chore #189: above all spirits + attack avatar (z=1500), below ceremonies (2000-2500 OK since fxLayer dmg numbers also need to be visible during ceremony)
  return c;
})();
```

> **Decision**：fxLayer 跟 ceremony 哪個高？
> - dmg 數字應在 ceremony 後消失（dmg 屬於 round flow，ceremony 是 rare event）
> - 但 hit burst (spawnHitBurst) 是 attack 期間用，attack 不重疊 ceremony
> - **建議 fxLayer.zIndex = 3000**（最上層，覆蓋一切包括 ceremony）— dmg 數字短暫，不會干擾 ceremony 視覺太久

#### 3b. parent (this.container) sortableChildren

當前 line 329：
```ts
this.container.addChild(this.fxLayer);
```

確保 `this.container.sortableChildren = true`（或既有 chore #182 已透過 spirit attack 設過了）：

```ts
// chore #189: ensure parent sorts children by zIndex (fxLayer z=3000 must render above)
this.container.sortableChildren = true;
this.container.addChild(this.fxLayer);
```

**Commit**: `fix(chore): fxLayer zIndex 3000 — dmg numbers + hit burst always render above spirits (chore #182 attack avatar z=1500)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（fxLayer 宣告 + sortableChildren）

**禁止**：
- 動 chore #182 attack avatar zIndex 1500 / sortableChildren
- 動 chore #185 spawnHitBurst / defenderHitReact / popDamage
- 動 chore #188 sparseToDense map
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "fxLayer" src/screens/BattleScreen.ts` — 確認 zIndex 設置
   - `grep "sortableChildren" src/screens/BattleScreen.ts` — 確認 parent 加上
5. **Preview 驗證 critical**：
   - 攻擊時 dmg 數字「-N」浮現於 spirit **之上**（不再被蓋）
   - hit burst (chore #185 12-ray) 也在 spirit 之上
   - chore #182 attack avatar 仍正常飛 + clash
   - JP / Free Spin / retrigger ceremony 仍正常顯示（zIndex 2000-2500 區，被 fxLayer 蓋是 trade-off）
   - 無 console error

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（dmg 數字浮在 spirit 上方確認）
- ceremony 期間 fxLayer 是否會干擾 ceremony 視覺（若是 → 改 fxLayer z=1800 在 ceremony 之下）
- Spec deviations：預期 0
