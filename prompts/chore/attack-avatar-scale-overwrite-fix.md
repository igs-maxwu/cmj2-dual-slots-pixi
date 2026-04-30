# Chore — Attack avatar scale.set 覆寫 size 修正（chore #177 hotfix）

## 1. Context

Owner 試玩 chore #177 後 (截圖佐證) — attack 動畫中 avatar **變超大**（~10× 預期尺寸），擋住整個盤面。

### Root cause

chore #177 line ~155 設 sprite 大小：
```ts
avatar.height = 120;
avatar.width  = 120 / aspect;
```

但 Pixi 8 的 `Sprite.width / .height` setter **內部寫法是 `this.scale.y = newHeight / texture.height`**（透過 scale 縮放 texture）。

接著 Phase 1 line ~167：
```ts
avatar.scale.set(faceDir * s, s);   // ← 直接覆寫 scale，size 被砍掉
```

此時 `s = 1.0`（phase 1 起始），avatar 變成 native texture size (e.g. 512×800 webp 真實尺寸) → 巨大 → 蓋整個畫面。

### Fix 方案：Container wrap + base scale 計算

**Option A**（推薦）：用 Container 包 Sprite。Sprite 設定 size 不變，Phase scale 套到 outer Container。
**Option B**：算 base scale，每 phase scale.set 都乘 base。

Option A 較乾淨，Sprite 內部 scale 不被擾。

純 hotfix — 不改其他 chore #177 設計（side、facing、120px target、5-phase tween 全保留）。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit hotfix
- **`debugging-and-error-recovery`** — root cause 已從 Pixi 8 API 確認，直接修

---

## 2. Spec drift check (P6)

1. `mempalace_search "chore 177 attack avatar SpiritAttackChoreographer scale set"`
2. 確認 chore #177 既有結構：avatar Sprite + 5 phase tween + faceDir mirror 仍存在
3. 確認 Pixi 8 `Sprite.width/.height` setter 透過 scale 實作（standard Pixi 行為）

---

## 3. Task

### Single commit — Container wrap + scale on outer

`src/screens/SpiritAttackChoreographer.ts` `attackTimeline` 內 sprite 創建段 + 全 phase tween 重構。

當前（chore #177，bug 版）：
```ts
const avatar = new Sprite(tex);
avatar.anchor.set(0.5, 1);
const aspect = tex.height / tex.width || 1.6;
avatar.height = 120;
avatar.width  = 120 / aspect;
const originYAdj = originY + 60;
avatar.x = originX;
avatar.y = originYAdj;
const faceDir = side === 'A' ? 1 : -1;
stage.addChild(avatar);

// Phase 1
await tween(D.prepare, p => {
  const s = 1.0 + Easings.easeOut(p) * 0.20;
  avatar.scale.set(faceDir * s, s);   // ← 覆寫 width/height 設定
});
// ... Phase 2-5 同樣 pattern ...
```

改成：
```ts
// chore: wrap Sprite in Container so phase scale doesn't overwrite size setting
const avatarSprite = new Sprite(tex);
avatarSprite.anchor.set(0.5, 1);
const aspect = tex.height / tex.width || 1.6;
avatarSprite.height = 120;
avatarSprite.width  = 120 / aspect;

const avatar = new Container();              // ← outer container for phase animation
avatar.addChild(avatarSprite);
const originYAdj = originY + 60;
avatar.x = originX;
avatar.y = originYAdj;
const faceDir = side === 'A' ? 1 : -1;
stage.addChild(avatar);

// Phase 1 — scale on outer Container, sprite size stays 120px
await tween(D.prepare, p => {
  const s = 1.0 + Easings.easeOut(p) * 0.20;
  avatar.scale.set(faceDir * s, s);   // ← 改 outer container scale，不影響 sprite 內部 scale
});

// Phase 2-5 同樣（avatar.scale 套外層 container，內部 sprite size 保持 120px）
```

> **Important**：avatar 變數型態從 `Sprite` 變成 `Container`。但既有 `_sigXxx` signatures 用 `ctx.avatar` reference — 需確認它們不依賴 Sprite-only API（如 .texture / .tint），若有則 ctx.avatar 改成內部 sprite reference。

> **Quick check**：grep `_sig*` 看是否 access avatar.texture / avatar.tint / avatar.alpha 等。若只 access x/y/scale → 改 Container OK。Alpha 是 Container 共用屬性，OK。

```bash
grep "avatar\." src/screens/SpiritAttackChoreographer.ts | grep -v "avatar\.\(x\|y\|scale\|alpha\|destroy\|filters\)" | head
```

> **destroy() 連帶**：`avatar.destroy()` 在 line ~208 → 改 `avatar.destroy({ children: true })` cleanup 內部 Sprite。

### 驗證

`npm run build` + 試玩：
- 單側 attack：spirit 全身 sprite 顯示**正常 120px 高**（不再巨大）
- 雙側 clash：兩 spirit 仍正常 face-to-face（左右 mirror 保留）
- 5 phases scale animation 仍 visible（prepare 1.0→1.2 / leap 1.2→1.3 / hold 1.3 / return 1.3→0.75 等視覺感受）
- 8 signature fx 仍正常射出

**Commit**: `fix(chore): SpiritAttackChoreographer wrap Sprite in Container — phase scale no longer overwrites size (chore #177 hotfix)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts`（avatar 創建 + Phase 1-5 scale 全部基於 outer container + destroy 加 children:true）

**禁止**：
- 動 chore #177 side / faceDir / clash offset / 120px target / 5-phase 結構
- 動 PERSONALITIES / 8 個 _sigXxx signatures（除非 grep 發現 avatar.texture/tint 引用必須改 ref）
- 動 BattleScreen / SymbolsConfig / SlotEngine
- 改 SPEC.md / DesignTokens / sim-rtp.mjs

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 單側 attack：spirit 顯示**約 120px 高**（chibi 比例，不擋住盤面 / JP marquee）
   - 雙側 clash：兩 spirit 同樣 120px size + 面對面 + 站位 ±70px
   - 5 phase scale animation 視覺感受仍 OK（prepare → leap → hold → fire → return）
   - 8 signature fx 仍正常
   - 無 console error
5. 截圖 1 張：attack 中（正常大小證明）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 確認 5 phase scale 動畫仍合理（or 因為 Container 包覆需重 tune scale 數值）
- 確認 _sigXxx 信號特效起點仍正確（ctx.centerX/Y 跟 avatar 位置一致）
- 任何 destroy 後 leak 監測（DevTools listener count）
- Spec deviations：預期 0
