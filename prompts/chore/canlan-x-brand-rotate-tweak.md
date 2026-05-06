# Chore — 蒼嵐 X-brand 旋轉 tweak（chore #220 follow-up polish）

## 1. Context

Owner 試玩 chore #220 (PR #218 / commit 7f7fef5) 蒼嵐 X 烙印後反饋：「**X 一邊縮小的同時一邊旋轉**」。

當前 X-brand 動畫（[`SpiritAttackChoreographer.ts:_sigLightningXCross`](src/screens/SpiritAttackChoreographer.ts#L267) chore #220 加入區塊）：
1. Phase A 180ms — pulse-in scale 0.5→1.2 + alpha 0→1
2. Phase B 80ms — settle scale 1.2→1.0（**縮小階段**）
3. Phase C 190ms — hold + fade alpha 1→0

無 rotation。Owner 希望縮小 + 淡出階段（Phase B+C 共 270ms）順帶旋轉，增加「雷光烙印散去」的動感。

純 1 屬性微調 — 不動其他現有動畫 / 共 220 行 _sigLightningXCross 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — Phase B+C tween callback 加 `xBrand.rotation` 設定

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts`](src/screens/SpiritAttackChoreographer.ts) X-brand block (chore #220) 仍存
2. 確認 Phase B 80ms tween + Phase C 190ms tween 結構
3. 確認 chore #210 clash uniform scale 不影響此 tweak

---

## 3. Task

### Single commit — Add rotation through shrink + fade

`src/screens/SpiritAttackChoreographer.ts` `_sigLightningXCross` 內 chore #220 X-brand block 內：

當前（pulse-in 完之後的 then chain）：
```ts
}, Easings.easeOut).then(async () => {
  // Settle: 1.2x→1.0x in 80ms
  await tween(80, p => { xBrand.scale.set(1.2 - 0.2 * p); }, Easings.easeOut);
  // Hold + fade: 1.0x scale, alpha 1→0 in 190ms
  await tween(190, p => { xBrand.alpha = 1 - p; }, Easings.easeIn);
  removeFilter(xBrand, xBrandGlow);
  xBrand.destroy();
});
```

改成：
```ts
}, Easings.easeOut).then(async () => {
  // chore #220 polish: rotate while shrinking + fading (owner trial 2026-05-06).
  // Phase B (settle 80ms): scale 1.2→1.0, rotation 0 → π/4 (45°)
  // Phase C (fade 190ms): alpha 1→0, rotation π/4 → π/2 (90° total)
  await tween(80, p => {
    xBrand.scale.set(1.2 - 0.2 * p);
    xBrand.rotation = p * Math.PI / 4;
  }, Easings.easeOut);
  await tween(190, p => {
    xBrand.alpha    = 1 - p;
    xBrand.rotation = Math.PI / 4 + p * Math.PI / 4;
  }, Easings.easeIn);
  removeFilter(xBrand, xBrandGlow);
  xBrand.destroy();
});
```

> **總旋轉**：0 → 90° clockwise (Pixi y-down convention) 共 270ms。
>
> **Phase A (pulse-in)** 不動 — 維持「正 X 撞擊出現」的銳利感。
>
> **Phase B+C** 才旋轉 — 配合縮小 + 淡出，視覺像「烙印旋風散去」。

**Commit**: `tune(chore): 蒼嵐 X-brand rotate during shrink + fade (0→90° over 270ms; chore #220 follow-up polish)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigLightningXCross` X-brand block Phase B + Phase C tween callback 加 `xBrand.rotation`

**禁止**：
- 動 Phase A pulse-in
- 動其他 7 個 signature
- 動 shockwave / cyan flash / lightning bolts / hitstop
- 動 旋轉以外 X-brand 屬性 (scale / alpha 已有不動)
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "xBrand.rotation" src/screens/SpiritAttackChoreographer.ts` — 應 2 處（Phase B + Phase C）
   - `grep "Math.PI / 4\|Math.PI/4" src/screens/SpiritAttackChoreographer.ts` — 應有
   - 其他 7 個 signature 完全沒動
5. **Preview 驗證**：
   - 開 `?fx=lightning-xcross`（或 picker 按 1）
   - X 烙印 pulse-in 仍**正 X**
   - 縮小階段 X 開始**順時針旋轉**
   - 淡出消失時旋轉到約 90°
   - 其他 spirit FX 完全不變

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 GIF 或截圖（X 旋轉中）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**
