# Chore — 孟辰璋龍頭重畫成正面中國龍（chore #224 follow-up）

## 1. Context

Owner 試玩 chore #224 (PR #227 / commit 276a7b7) 反映：「這個龍感覺畫成正面比較適合，像我給的範例（只是示意不要直接拿去用）」。

附範例圖：中國龍正面臉，雙眼對稱、鬃毛輻射、雙角、鬚毛、大嘴。

當前 dragon 是 30-vertex 側臉（snout 朝右 + 4 mane spikes 朝後左），視覺像卡通恐龍頭，不夠「龍」。

### Fix

改成 5-layer 正面中國龍 silhouette：
1. **MANE 鬃毛輻射** (背層 6-8 jagged spikes 環繞臉部)
2. **HORNS 雙角** (頂部 2 V-shape branching antlers)
3. **FACE 對稱面相** (16-vertex 正面橢圓)
4. **MOUTH 大嘴 + 牙齒** (V 開口 + 5 顆 teeth row + 2 顆 fangs)
5. **EYES + NOSE + BEARD** (雙金眼 + 鼻紋 + 3 道鬚毛 bezier)

純 Graphics polygon 重寫 — 不動位置 / size / 動畫 timing / cross sword light / call site。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 改 dragon block 內 polygon 定義

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts`](src/screens/SpiritAttackChoreographer.ts) `_sigDragonDualSlash` chore #224 dragon block 仍存（含 30-vertex side polygon + V mouth + 2 fangs + eye + 2 whiskers）
2. 確認 DRG_BODY / DRG_LITE / DRG_DARK 顏色常數
3. 確認 cross sword light Layer B 完整保留
4. 確認 動畫 timing (220ms pulse + 100ms settle + 320ms fade)

---

## 3. Task

### Single commit — Rework dragon to frontal Chinese dragon

`src/screens/SpiritAttackChoreographer.ts` `_sigDragonDualSlash` 內 chore #224 dragon block，**保留**：
- `const DRG_BODY / DRG_LITE / DRG_DARK`
- `const dragon = new Graphics();`
- 後段 dragon.x = cx ... 動畫 + applyGlow + tween + destroy
- Layer B cross sword light 完全不動

**重寫**：dragon polygon 30-vertex 側臉 + 嘴 + 牙 + 眼 + 鬚 整段 → 改成 5-layer 正面龍。

當前要替換的 block（從 `// Outline (side view facing right` 到雙鬚 bezier `dragon.moveTo(118, 12).bezierCurveTo(...).stroke(...);`）：

替換成：

```ts
    // chore #224 polish: frontal Chinese dragon face — 5-layer composition
    // Layer 1: MANE — 12-vertex jagged radial spikes (back layer)
    dragon.poly([
       0, -110,    // top notch
      45, -125,    // top-right spike tip
      55, -85,
     105, -75,    // upper-right spike
      85, -45,
     130, -20,    // right horizontal spike
      95,   5,
     120,  45,    // lower-right spike
      55,  60,
      45,  95,    // lower-right-down spike
       0,  78,
     -45,  95,    // lower-left-down spike
     -55,  60,
    -120,  45,    // lower-left spike
     -95,   5,
    -130, -20,    // left horizontal spike
     -85, -45,
    -105, -75,    // upper-left spike
     -55, -85,
     -45, -125,   // top-left spike tip
       0, -110,
    ]).fill({ color: DRG_BODY, alpha: 0.55 });

    // Layer 2: HORNS — 2 antler-like V-shapes at top
    dragon.poly([
     -22, -82,
     -38, -130,
     -42, -100,
     -58, -148,
     -32, -90,
    ]).fill({ color: DRG_DARK, alpha: 0.95 });
    dragon.poly([
      22, -82,
      38, -130,
      42, -100,
      58, -148,
      32, -90,
    ]).fill({ color: DRG_DARK, alpha: 0.95 });

    // Layer 3: FACE — frontal oval (16-vertex symmetric)
    const face = [
       0, -85,
      28, -82,
      52, -65,
      70, -38,
      78,   0,
      70,  35,
      52,  60,
      28,  76,
       0,  82,    // chin
     -28,  76,
     -52,  60,
     -70,  35,
     -78,   0,
     -70, -38,
     -52, -65,
     -28, -82,
    ];
    dragon.poly(face).fill({ color: DRG_BODY, alpha: 0.95 });
    dragon.poly(face).stroke({ width: 2.5, color: DRG_DARK, alpha: 1 });

    // Layer 4: MOUTH — V opening + teeth row + 2 fangs
    // Open mouth interior (dark)
    dragon.poly([
     -28, 32,
      28, 32,
      20, 58,
       0, 68,
     -20, 58,
    ]).fill({ color: DRG_DARK, alpha: 0.95 });

    // Teeth row (5 small triangles on upper jaw line)
    for (let i = 0; i < 5; i++) {
      const tx = -22 + i * 11;
      dragon.poly([tx - 3, 33, tx, 42, tx + 3, 33]).fill({ color: 0xffffff, alpha: 0.95 });
    }
    // 2 large fangs (lower)
    dragon.poly([-15, 33, -10, 55, -5, 33]).fill({ color: 0xffffff, alpha: 1 });
    dragon.poly([ 15, 33,  10, 55,  5, 33]).fill({ color: 0xffffff, alpha: 1 });

    // Layer 5: EYES + NOSE + BEARD WHISKERS
    // Two eyes (symmetric — gold iris + black pupil + white highlight)
    dragon.circle(-25, -12, 11).fill({ color: 0xffd700, alpha: 1 });
    dragon.circle(-25, -12, 5).fill({ color: 0x000000, alpha: 1 });
    dragon.circle(-23, -14, 2.5).fill({ color: 0xffffff, alpha: 0.95 });
    dragon.circle( 25, -12, 11).fill({ color: 0xffd700, alpha: 1 });
    dragon.circle( 25, -12, 5).fill({ color: 0x000000, alpha: 1 });
    dragon.circle( 27, -14, 2.5).fill({ color: 0xffffff, alpha: 0.95 });

    // Nose ridge (small triangle pointing down between eyes)
    dragon.poly([-7, 8, 7, 8, 0, 20]).fill({ color: DRG_DARK, alpha: 0.85 });

    // Beard whiskers — 3 bezier curves flowing down from face
    dragon.moveTo(-45, 55).bezierCurveTo(-70, 95, -55, 135, -22, 150).stroke({ width: 3, color: DRG_LITE, alpha: 0.85 });
    dragon.moveTo( 45, 55).bezierCurveTo( 70, 95,  55, 135,  22, 150).stroke({ width: 3, color: DRG_LITE, alpha: 0.85 });
    dragon.moveTo(  0, 80).bezierCurveTo( -5, 105,  5, 122,  0, 138).stroke({ width: 2.5, color: DRG_LITE, alpha: 0.85 });
```

> **視覺結構**：
> - **MANE**: 12-vertex 鋸齒輻射在臉部背層（α 0.55 較淡，呈現霧化感）
> - **HORNS**: 雙 5-vertex 角 V-shape 朝外上 (~y -150 至 -82)
> - **FACE**: 16-vertex 對稱橢圓 (~156×170px)
> - **MOUTH**: 大張口 + 5 牙 + 2 fangs
> - **EYES**: 雙 11px 金眼平行
> - **BEARD**: 3 道 bezier 鬚毛 down to ~y 150
> - 整體 ~260×300px（含 mane）正面中國龍

> **位置**: dragon.x = cx (置中)，dragon.y = cy - 70（既有，不動）— 龍臉正面浮現於 clash 上方

> **不動**: 動畫 timing / scale 0.4→1.4→1.0 / GlowFilter / cleanup / Layer B cross sword light。

**Commit**: `tune(chore #224 polish): 孟辰璋 dragon frontal view rework — 5-layer Chinese dragon face (mane radial + 2 antlers + symmetric face + mouth with teeth + 2 eyes + 3 beard whiskers, ~260×300px)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigDragonDualSlash` chore #224 dragon block 內 polygon block 替換成 5-layer frontal

**禁止**：
- 動 dragon.x/y/scale/alpha 動畫 timing
- 動 applyGlow / removeFilter
- 動 DRG_BODY / DRG_LITE / DRG_DARK 常數
- 動 Layer B cross sword light
- 動其他 7 個 signature
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "dragon\.poly\|dragon\.circle" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應有 ~10+ entries (face + mane + 2 horns + mouth + 5 teeth + 2 fangs + 6 eye circles + nose)
   - `grep "Chinese dragon\|frontal" src/screens/SpiritAttackChoreographer.ts` — 應有 chore #224 polish 註解
5. **Preview 驗證**：
   - dev mode 進 picker 按 `5` 孟辰璋
   - **應看到**正面中國龍：對稱雙眼 + 鬃毛輻射 + 雙角 + 大嘴含齒 + 鬚毛
   - 動畫 timing / position / 顏色不變
   - Layer B X-cross sword light 仍正常
   - 其他 7 個 spirit FX 不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（正面中國龍臉）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**
