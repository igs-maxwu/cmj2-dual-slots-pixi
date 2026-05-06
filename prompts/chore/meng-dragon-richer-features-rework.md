# Chore — 孟辰璋龍頭加特徵讓更像中國龍（chore #224 polish 2）

## 1. Context

Owner 試玩 chore #224 polish (PR #228 / commit 3409ddd) 反映：「這龍長得不像龍...線條可以參考我剛剛上傳的嗎?」附中國龍正面繪畫範例。

當前正面龍版本問題：
- 鬃毛只是 12-vertex 環繞鋸齒 — 不像「火焰流動」感
- 雙角太簡（單一 V-shape）— 中國龍是分叉鹿角（2-3 branches）
- 臉橢圓沒角度 — 缺額頭/眉骨/顴骨
- 眼睛只是 circle — 缺粗眉（中國龍標誌特徵）
- 沒有寬鼻 + 鼻孔
- 嘴內沒有舌頭/火焰
- 鬚毛只 3 條過細

### Fix

加入中國龍特徵 elements，從 5-layer → 8-layer：
1. **MANE** flame-curl 火焰流動曲線（不是直角鋸齒）
2. **HORNS** 分叉鹿角（main stem + 2 branches each）
3. **FACE** 角度面相含眉骨/額頭/顴骨
4. **BUSHY BROWS** 粗眉曲線（中國龍核心識別特徵）
5. **EYES** 大眼 + 虹膜紋路
6. **NOSE** 寬鼻含 2 鼻孔
7. **MOUTH + TONGUE** 大張口 + 火舌
8. **WHISKERS** 多道流動鬚（鼻側 + 嘴角 + 下巴）

純 Graphics rework — 不動位置 / 動畫 timing / cross sword light / call site。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 改 dragon block 8-layer 重畫

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts`](src/screens/SpiritAttackChoreographer.ts) `_sigDragonDualSlash` chore #224 polish dragon block 仍存（5-layer frontal）
2. 確認 DRG_BODY 0x4a90e2 / DRG_LITE 0xa0d8ff / DRG_DARK 0x1a3a6a 顏色常數
3. 確認 cross sword light Layer B 完整保留
4. 確認 dragon.x = cx / dragon.y = cy - 70 / scale 0.4→1.4→1.0 / 動畫 timing

---

## 3. Task

### Single commit — Replace dragon polygon block with 8-layer richer Chinese dragon

`src/screens/SpiritAttackChoreographer.ts` `_sigDragonDualSlash` 內 chore #224 polish dragon block，**保留**：
- 顏色常數 / dragon Graphics 創建 / dragon.x/y/scale/alpha 動畫 / GlowFilter / cleanup tween chain
- Layer B cross sword light 完全不動

**重寫**：5-layer block (MANE + HORNS + FACE + MOUTH + EYES/NOSE/BEARD) → 8-layer Chinese dragon。

替換成：

```ts
    // chore #224 polish 2: richer Chinese dragon — 8-layer composition based on owner reference

    // Layer 1: MANE — flame-curl spikes (10 around head, each a flame teardrop)
    const maneSpikes: Array<[number, number, number]> = [
      // [angle (rad), distance, length]
      [-Math.PI*0.50, 100, 50],   // top centre
      [-Math.PI*0.35, 100, 55],   // top-right
      [-Math.PI*0.20, 105, 50],   // upper-right
      [-Math.PI*0.05,  110, 45],  // right
      [ Math.PI*0.10,  110, 40],  // lower-right
      [ Math.PI*0.30,  105, 50],  // bottom-right
      [ Math.PI*0.65,  105, 50],  // bottom-left (mirror)
      [ Math.PI*0.85,  110, 40],  // lower-left
      [-Math.PI*0.95, 110, 45],   // left
      [-Math.PI*0.80, 105, 50],   // upper-left
      [-Math.PI*0.65, 100, 55],   // top-left
    ];
    for (const [ang, dist, len] of maneSpikes) {
      const baseX = Math.cos(ang) * (dist - 30);
      const baseY = Math.sin(ang) * (dist - 30);
      const tipX  = Math.cos(ang) * (dist + len);
      const tipY  = Math.sin(ang) * (dist + len);
      const sideX = -Math.sin(ang) * 12;
      const sideY = Math.cos(ang) * 12;
      // Curl: flame teardrop with sweep
      dragon.poly([
        baseX - sideX, baseY - sideY,
        baseX + sideX, baseY + sideY,
        tipX  + sideX * 0.3, tipY + sideY * 0.3,
        tipX,                tipY,
      ]).fill({ color: DRG_BODY, alpha: 0.65 });
      dragon.poly([
        baseX - sideX, baseY - sideY,
        baseX + sideX, baseY + sideY,
        tipX  + sideX * 0.3, tipY + sideY * 0.3,
        tipX,                tipY,
      ]).stroke({ width: 1.5, color: DRG_DARK, alpha: 0.6 });
    }

    // Layer 2: HORNS — branched antlers (each: main stem + 2 forks)
    const drawAntler = (mirror: number) => {
      const m = mirror;
      // Main stem stroke
      dragon.moveTo(m * 22, -82).bezierCurveTo(m * 35, -110, m * 40, -130, m * 50, -150)
            .stroke({ width: 7, color: DRG_DARK, alpha: 0.95 });
      dragon.moveTo(m * 22, -82).bezierCurveTo(m * 35, -110, m * 40, -130, m * 50, -150)
            .stroke({ width: 3, color: DRG_LITE, alpha: 0.85 });
      // Branch 1 (outer fork at mid-stem)
      dragon.moveTo(m * 36, -115).bezierCurveTo(m * 55, -118, m * 70, -128, m * 78, -138)
            .stroke({ width: 5, color: DRG_DARK, alpha: 0.95 });
      dragon.moveTo(m * 36, -115).bezierCurveTo(m * 55, -118, m * 70, -128, m * 78, -138)
            .stroke({ width: 2, color: DRG_LITE, alpha: 0.85 });
      // Branch 2 (inner fork near tip)
      dragon.moveTo(m * 44, -135).bezierCurveTo(m * 38, -148, m * 35, -158, m * 30, -165)
            .stroke({ width: 4, color: DRG_DARK, alpha: 0.95 });
      dragon.moveTo(m * 44, -135).bezierCurveTo(m * 38, -148, m * 35, -158, m * 30, -165)
            .stroke({ width: 1.5, color: DRG_LITE, alpha: 0.85 });
    };
    drawAntler(-1);
    drawAntler( 1);

    // Layer 3: FACE — angular polygon with brow ridge + cheekbones
    const face = [
       0,  -88,    // forehead top
      24,  -82,    // forehead-right
      52,  -68,    // brow ridge right
      72,  -42,    // cheekbone right (angular bump)
      80,  -10,    // cheek mid
      75,   18,    // cheek lower
      62,   42,    // jaw upper-right
      42,   62,    // jaw lower-right
      18,   78,
       0,   82,    // chin
     -18,   78,
     -42,   62,
     -62,   42,
     -75,   18,
     -80,  -10,
     -72,  -42,
     -52,  -68,
     -24,  -82,
    ];
    dragon.poly(face).fill({ color: DRG_BODY, alpha: 0.95 });
    dragon.poly(face).stroke({ width: 2.5, color: DRG_DARK, alpha: 1 });

    // Layer 4: BUSHY BROWS — 2 thick curved strokes above eyes (key Chinese dragon feature)
    dragon.moveTo(-50, -38).bezierCurveTo(-42, -52, -22, -52, -10, -42)
          .stroke({ width: 8, color: DRG_DARK, alpha: 0.95 });
    dragon.moveTo(-50, -38).bezierCurveTo(-42, -52, -22, -52, -10, -42)
          .stroke({ width: 4, color: DRG_LITE, alpha: 0.7 });
    dragon.moveTo( 50, -38).bezierCurveTo( 42, -52,  22, -52,  10, -42)
          .stroke({ width: 8, color: DRG_DARK, alpha: 0.95 });
    dragon.moveTo( 50, -38).bezierCurveTo( 42, -52,  22, -52,  10, -42)
          .stroke({ width: 4, color: DRG_LITE, alpha: 0.7 });

    // Layer 5: EYES — large round with iris + pupil + highlight
    dragon.circle(-30, -22, 13).fill({ color: 0xffffff, alpha: 1 });
    dragon.circle(-30, -22, 13).stroke({ width: 2, color: DRG_DARK, alpha: 1 });
    dragon.circle(-30, -22, 9).fill({ color: 0xffd700, alpha: 1 });    // gold iris
    dragon.circle(-30, -22, 4.5).fill({ color: 0x000000, alpha: 1 });  // pupil
    dragon.circle(-27, -25, 2.5).fill({ color: 0xffffff, alpha: 0.95 });// highlight
    dragon.circle( 30, -22, 13).fill({ color: 0xffffff, alpha: 1 });
    dragon.circle( 30, -22, 13).stroke({ width: 2, color: DRG_DARK, alpha: 1 });
    dragon.circle( 30, -22, 9).fill({ color: 0xffd700, alpha: 1 });
    dragon.circle( 30, -22, 4.5).fill({ color: 0x000000, alpha: 1 });
    dragon.circle( 33, -25, 2.5).fill({ color: 0xffffff, alpha: 0.95 });

    // Layer 6: NOSE — wide round nose + 2 nostril dots
    dragon.ellipse(0, 8, 18, 12).fill({ color: DRG_BODY, alpha: 1 });
    dragon.ellipse(0, 8, 18, 12).stroke({ width: 2, color: DRG_DARK, alpha: 1 });
    dragon.circle(-7, 10, 2.5).fill({ color: DRG_DARK, alpha: 1 });    // left nostril
    dragon.circle( 7, 10, 2.5).fill({ color: DRG_DARK, alpha: 1 });    // right nostril

    // Layer 7: MOUTH — open V + tongue/flame + 2 fangs + small teeth
    // Mouth interior dark
    dragon.poly([
     -32,  32,
      32,  32,
      24,  60,
       0,  72,
     -24,  60,
    ]).fill({ color: DRG_DARK, alpha: 0.95 });
    // Tongue/flame (orange-red curl in mouth)
    dragon.poly([
      -8, 38,
       8, 38,
       6, 55,
       0, 65,
      -6, 55,
    ]).fill({ color: 0xff6a3a, alpha: 0.9 });
    // 5 small teeth (upper jaw)
    for (let i = 0; i < 5; i++) {
      const tx = -24 + i * 12;
      dragon.poly([tx - 3, 33, tx, 41, tx + 3, 33]).fill({ color: 0xffffff, alpha: 0.95 });
    }
    // 2 large fangs
    dragon.poly([-18, 33, -13, 56, -8, 33]).fill({ color: 0xffffff, alpha: 1 });
    dragon.poly([-18, 33, -13, 56, -8, 33]).stroke({ width: 1, color: DRG_DARK, alpha: 0.6 });
    dragon.poly([ 18, 33,  13, 56,  8, 33]).fill({ color: 0xffffff, alpha: 1 });
    dragon.poly([ 18, 33,  13, 56,  8, 33]).stroke({ width: 1, color: DRG_DARK, alpha: 0.6 });

    // Layer 8: WHISKERS — 6 flowing curves (2 nose-side + 2 mouth-corner + 2 chin-beard)
    // Nose-side whiskers (long, sweep down + outward)
    dragon.moveTo(-15, 12).bezierCurveTo(-50, 35, -85, 80, -50, 145)
          .stroke({ width: 3, color: DRG_LITE, alpha: 0.85 });
    dragon.moveTo( 15, 12).bezierCurveTo( 50, 35,  85, 80,  50, 145)
          .stroke({ width: 3, color: DRG_LITE, alpha: 0.85 });
    // Mouth-corner whiskers (medium, sweep down)
    dragon.moveTo(-32, 35).bezierCurveTo(-58, 75, -38, 115, -25, 140)
          .stroke({ width: 2.5, color: DRG_LITE, alpha: 0.8 });
    dragon.moveTo( 32, 35).bezierCurveTo( 58, 75,  38, 115,  25, 140)
          .stroke({ width: 2.5, color: DRG_LITE, alpha: 0.8 });
    // Chin beard (2 short central whiskers)
    dragon.moveTo(-8, 78).bezierCurveTo(-12, 100, -8, 120, -5, 138)
          .stroke({ width: 2.5, color: DRG_LITE, alpha: 0.85 });
    dragon.moveTo( 8, 78).bezierCurveTo( 12, 100,  8, 120,  5, 138)
          .stroke({ width: 2.5, color: DRG_LITE, alpha: 0.85 });
```

> **8-layer 中國龍特徵齊全**：
> - L1 Mane 火焰流動曲線（10 spikes radial 含 curl，alpha 0.65 半透柔感）
> - L2 雙分叉鹿角（main stem + 2 forks each, bezier curves）
> - L3 角度面相含 cheekbone + brow ridge
> - **L4 粗眉**（中國龍核心識別）— 雙層 stroke (8px DRG_DARK + 4px DRG_LITE)
> - L5 大眼含 iris/pupil/highlight 4 層
> - L6 寬鼻 ellipse + 2 鼻孔
> - L7 嘴 + 火舌（橘紅 0xff6a3a 撞色）+ 5 牙 + 2 fangs
> - L8 6 道鬚毛流動 bezier (鼻側 2 + 嘴角 2 + 下巴 2)
>
> 整體 ~260×320px (含 mane + 鬚毛底部)

> **不動**: dragon.x/y/scale/alpha 動畫 / GlowFilter / Layer B cross sword light。

**Commit**: `tune(chore #224 polish 2): 孟辰璋 dragon richer Chinese dragon features — 8-layer composition (flame-curl mane + branched antlers + angular face + bushy brows + detailed eyes + wide nose with nostrils + tongue + 6 whiskers)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigDragonDualSlash` chore #224 dragon polygon block 整段替換成 8-layer

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
   - `grep "drawAntler\|maneSpikes\|BUSHY BROWS\|tongue\|nostril" src/screens/SpiritAttackChoreographer.ts` — 應齊全
   - `grep "dragon\.poly\|dragon\.circle\|dragon\.moveTo" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應 30+ entries (8 layers 各多筆)
5. **Preview 驗證**：
   - dev mode 進 picker 按 `5` 孟辰璋
   - **應看到中國龍特徵齊全**：分叉鹿角 + 火焰流動鬃毛 + 角度面相 + **粗眉** + 大眼 + 寬鼻含鼻孔 + 大張口含火舌 + 6 道流動鬚毛
   - 整體更像中國神龍 vs 之前簡化版
   - X-cross sword light 仍正常
   - 其他 7 個 spirit 不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（新中國龍）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**
