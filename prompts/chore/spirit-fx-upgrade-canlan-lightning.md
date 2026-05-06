# Chore #220 — 蒼嵐攻擊特效升級（雷光 X 烙印 + 青光閃）

## 1. Context

Owner 試玩 2026-05-06 反映：「我想要把所有角色的攻擊特效都改成類似這樣明顯的動畫，依每個角色特性來設計」。本 chore 是 8 個 spirit FX 升級系列的**第 1 個**（蒼嵐 lightning-xcross）。

### 升級方向（owner-approved）

蒼嵐 = 雷電青嵐角色，現有 [`_sigLightningXCross`](src/screens/SpiritAttackChoreographer.ts#L267) 已有：
- X-cross slash 46px 對角線
- Shockwave ring (radius 130)
- Staggered lightning bolts to targets
- 白色全螢幕 flash (α=0.55)

### 增強重點 — 「巨大 X 字形雷光烙印 + 螢幕短暫青光閃」

1. **巨大 X 烙印**：在現有 slash 之外，**Phase 4 fire 命中刹那** 多疊一個 1.5× 大小 X-shape 烙印（arm 70px，白色核心 4px 粗 + 青色 outerStrength glow 描邊），scale 0.5→1.2→1.0 + alpha 0→1→0 共 450ms，fxLayer 上方
2. **螢幕青光閃**：現有 white flash (α=0.55, 110ms) → **改成 cyan 0x6ab7ff α=0.40，120ms** — 跟蒼嵐 personality.particleColor 一致，character 感比純白強
3. **Shockwave radius 130 → 180**：現有 shockwave 加大 38%，視覺存在感更強

純視覺升級 — 不動 personality 設定 / Phase 4 dispatch / hitstop / damage 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 在 `_sigLightningXCross` 內加 1 個 Graphics + 改 2 個既有參數

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:267-310`](src/screens/SpiritAttackChoreographer.ts#L267) `_sigLightningXCross` 結構
2. 確認 line 280 `applyShockwave(stage, cx, cy, 130, duration)` radius=130
3. 確認 line 297-302 white screen flash α=0.55 / 110ms
4. 確認 chore #210 clash uniform scale 仍 in place (CLASH_SCALE = 1.0/posScale)
5. 確認 [BattleScreen `attackTimeline` call](src/screens/BattleScreen.ts#L2319) 不需動

---

## 3. Task

### Single commit — Upgrade 蒼嵐 lightning-xcross

#### 3a. 加大 X 烙印（new step 1.5 - between current step 1 slash and step 2 shockwave）

`src/screens/SpiritAttackChoreographer.ts` line 270-310 內，**在 line 277 (`const slashGlow = applyGlow(...)`) 之後，line 280 (shockwave) 之前** 插入：

```ts
  // chore #220: giant X-brand burst — 1.5× larger than slash, white core + cyan glow stroke
  const xBrand = new Graphics();
  const brandArm = 70;
  xBrand.x = cx; xBrand.y = cy;
  // White core: thick centre line
  xBrand.moveTo(-brandArm, -brandArm).lineTo(brandArm, brandArm).stroke({ width: 4, color: 0xffffff, alpha: 1 });
  xBrand.moveTo( brandArm, -brandArm).lineTo(-brandArm, brandArm).stroke({ width: 4, color: 0xffffff, alpha: 1 });
  xBrand.alpha = 0;
  xBrand.scale.set(0.5);
  stage.addChild(xBrand);
  const xBrandGlow = applyGlow(xBrand, color, 5, 18);

  // Pulse-in: 0.5x→1.2x scale + alpha 0→1 in 180ms
  void tween(180, p => {
    xBrand.alpha = p;
    xBrand.scale.set(0.5 + 0.7 * p);
  }, Easings.easeOut).then(async () => {
    // Settle: 1.2x→1.0x in 80ms
    await tween(80, p => { xBrand.scale.set(1.2 - 0.2 * p); }, Easings.easeOut);
    // Hold + fade: 1.0x scale, alpha 1→0 in 190ms
    await tween(190, p => { xBrand.alpha = 1 - p; }, Easings.easeIn);
    removeFilter(xBrand, xBrandGlow);
    xBrand.destroy();
  });
```

#### 3b. Shockwave radius 130 → 180

`src/screens/SpiritAttackChoreographer.ts` line 280：

當前：
```ts
const swPromise = applyShockwave(stage, cx, cy, 130, duration);
```

改成：
```ts
// chore #220: bigger shockwave for more presence (was radius=130)
const swPromise = applyShockwave(stage, cx, cy, 180, duration);
```

#### 3c. White flash → cyan flash

`src/screens/SpiritAttackChoreographer.ts` line 297-302：

當前：
```ts
const flash = new Graphics()
  .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  .fill({ color: 0xffffff, alpha: 0.55 });
stage.addChild(flash);
await tween(110, p => { flash.alpha = 0.55 * (1 - p); });
flash.destroy();
```

改成：
```ts
// chore #220: cyan-tinted flash (was generic white) — matches 蒼嵐 personality.particleColor
const flash = new Graphics()
  .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  .fill({ color: 0x6ab7ff, alpha: 0.40 });
stage.addChild(flash);
await tween(120, p => { flash.alpha = 0.40 * (1 - p); });
flash.destroy();
```

#### 3d. 不動其他

- 既有 slash (line 271-277) — 保留 as-is（短促 X-cross 對角線打擊感）
- staggered bolts (line 283-294) — 保留
- hitstop delay 60ms (line 305) — 保留
- slash glow + cleanup (line 307-308) — 保留

**Commit**: `feat(chore): 蒼嵐 lightning-xcross FX upgrade — giant X-brand burst (70px arm, white core + cyan glow) + shockwave radius 130→180 + cyan-tinted screen flash`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigLightningXCross` 內
  - 加 X-brand burst block（在 slash glow 之後 / shockwave 之前）
  - shockwave radius 130 → 180
  - flash 0xffffff α 0.55 → 0x6ab7ff α 0.40
  - flash duration 110 → 120ms

**禁止**：
- 動其他 7 個 signature function (`_sigTripleDash`, `_sigDualFireball`, etc.) — **本 chore 只升級蒼嵐**
- 動 `attackTimeline` 主流程 / personality config / Phase 1/2/3/5
- 動 `applyShockwave` / `applyGlow` / `removeFilter` GlowWrapper helpers
- 動 BattleScreen attackTimeline call site
- 動 chore #210 clash uniform scale
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "xBrand\|brandArm" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigLightningXCross` 內
   - `grep "applyShockwave.*180" src/screens/SpiritAttackChoreographer.ts` — 蒼嵐 shockwave 加大
   - `grep "0x6ab7ff" src/screens/SpiritAttackChoreographer.ts` — flash cyan
   - `grep "0xffffff, alpha: 0.55" src/screens/SpiritAttackChoreographer.ts` — 應為空（已 replace 成 cyan）
   - 確認其他 7 個 signature function 完全沒動 (`_sigTripleDash` 等)
5. **Preview 驗證**：
   - 蒼嵐 (canlan) 在 BattleScreen 攻擊 — 應看到：
     - 既有 X-cross slash + 雷電 bolts（保留）
     - **巨大 X 烙印**從 0.5× scale punch up 到 1.0×，450ms 後消散
     - **Shockwave** 比之前明顯大一圈
     - **螢幕青光閃**（不再是純白）
   - 其他 7 個 spirit 攻擊**完全不變**（chore #220 只動蒼嵐）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張 GIF 或截圖（蒼嵐攻擊 X 烙印 + 青光閃對比）
- spec deviations: 0
- Process check：照新 pattern — `git checkout feat/<slug>` + `git add` + `git commit` + `git push -u` 串在**單一 Bash call**

---

## 6. 後續 (orchestrator note)

本 chore 是 8-spirit FX 升級系列第 1 個。後續：
- chore #221 — 珞洛 triple-dash 升級
- chore #222 — 朱鸞 dual-fireball 升級
- chore #223 — 朝雨 python-summon 升級
- chore #224 — 孟辰璋 dragon-dual-slash 升級
- chore #225 — 寅 tiger-fist-combo 升級
- chore #226 — 玄墨 tortoise-hammer-smash 升級（**owner spec：龜甲六邊形大石，不要 comic 砰字**）
- chore #227 — 凌羽 phoenix-flame-arrow 升級

每個 chore 1 個 PR，owner 試玩確認後再開下一個。
