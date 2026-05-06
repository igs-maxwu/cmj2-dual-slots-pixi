# Chore #225 — 寅攻擊特效升級（寅字虎面圖騰大字 + 移除通用 comic burst）

## 1. Context

per-spirit FX 重做系列第 4 個（朱鸞 #222 ✅，朝雨 #223 ✅，孟辰璋 #224 ✅）。寅 (yin) = 三連虎拳角色。

當前 [`_sigTigerFistCombo`](src/screens/SpiritAttackChoreographer.ts#L1192)：
1. (a) 0-120ms: 蓄力 charge glow + foot ring
2. (b) 120-300ms: 1st heavy punch → tp0
3. **line 1263 playComicBurst at tp0** ← 移除
4. (c) 300-480ms: 2nd punch → tp1
5. **line 1266 playComicBurst at tp1** ← 移除
6. (d) 480-560ms: 3rd decisive blow → tp0
7. **line 1269 playComicBurst at tp0** ← 移除
8. (d cont) earth crack cross + shockwave + screen shake
9. (e) tiger ghost dual-ring flash
10. cleanup

### 升級重點 — 寅字虎面圖騰大字

owner spec: 「寅字虎面圖騰命中刹那爆現 1.4× 然後消」

3 拳結束後（line 1269 之後）爆現**正面虎臉 + 寅字額印**：
1. 圓臉橙紅虎面（含粗黑斑紋、寬額、雙圓臉）
2. 雙金黃虎眼 + 黑直線瞳孔（虎眼特徵）
3. 三角虎耳 + 內粉紅
4. 粉紅鼻 + W 嘴
5. 6 道白色鬍鬚
6. **「寅」漢字毛筆刻印在額頭**（取代傳統虎頭「王」字）

純視覺重做 — 不動 punch logic / earth crack / tiger ghost / shake / cleanup。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — Container 包 Graphics + Text，加 9-layer tiger face

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:1192-1296`](src/screens/SpiritAttackChoreographer.ts#L1192) `_sigTigerFistCombo` 結構
2. 確認 line 1263 / 1266 / 1269 三個 playComicBurst calls
3. 確認 PERSONALITIES.yin.particleColor = 0xff8c33（橙紅）→ 既有 `color: TIGER` 別名
4. 確認 既有 doPunch + earth crack + tiger ghost 保留

---

## 3. Task

### Single commit — 寅 tiger face emblem + remove 3 generic bursts

#### 3a. 移除 3 個通用 comic burst

`src/screens/SpiritAttackChoreographer.ts` line 1263 / 1266 / 1269：

當前：
```ts
  // (b) 120–300ms: 1st heavy punch → target 0
  await doPunch(tp0, 180);
  playComicBurst(stage, tp0.x, tp0.y, TIGER, 0.85);   // chore #FX-BURST
  // (c) 300–480ms: 2nd heavy punch → target 1
  await doPunch(tp1, 180);
  playComicBurst(stage, tp1.x, tp1.y, TIGER, 0.85);   // chore #FX-BURST
  // (d) 480–560ms: 3rd decisive blow (faster)
  await doPunch(tp0, 80);
  playComicBurst(stage, tp0.x, tp0.y, TIGER, 0.85);   // chore #FX-BURST
```

改成：
```ts
  // (b) 120–300ms: 1st heavy punch → target 0
  await doPunch(tp0, 180);
  // (c) 300–480ms: 2nd heavy punch → target 1
  await doPunch(tp1, 180);
  // (d) 480–560ms: 3rd decisive blow (faster)
  await doPunch(tp0, 80);

  // chore #225: removed 3 generic comic bursts — replaced by single climax 寅字虎面圖騰 (added below)
```

> 純刪 3 行 + comment（不留 TODO 不留 dead code）。

#### 3b. 加入寅字虎面圖騰大字（fire-and-forget after 3rd punch）

在 line 1269 (3rd punch) **之後**，line 1271 (`// (d cont) 560–620ms: earth crack...`) **之前**插入：

```ts
  // chore #225: 寅字虎面圖騰大字 — frontal tiger face emblem with 寅 character on forehead.
  // Container wraps Graphics + Text (Text can't be Graphics child). Fire-and-forget overlapping
  // earth crack + tiger ghost. ~260px tall.
  {
    const TIGER_BODY = TIGER;       // 0xff8c33 orange
    const TIGER_DARK = 0x3a1a04;
    const TIGER_LITE = 0xffd4a0;
    const NOSE_PINK  = 0xc94545;
    const EAR_PINK   = 0xff9999;

    const tigerWrap = new Container();
    const tigerCx = (tp0.x + tp1.x) / 2;
    const tigerCy = (tp0.y + tp1.y) / 2 - 30;
    tigerWrap.x = tigerCx;
    tigerWrap.y = tigerCy;
    tigerWrap.alpha = 0;
    tigerWrap.scale.set(0.3);

    const tg = new Graphics();
    tigerWrap.addChild(tg);

    // Layer 1: BACKGROUND HALO — soft circle behind face
    tg.circle(0, 0, 130).fill({ color: TIGER_LITE, alpha: 0.25 });

    // Layer 2: FACE — round angular outline
    const face = [
      -75, -75,   // forehead-left
      -85, -45,
      -88, -10,
      -80,  25,
      -65,  55,
      -40,  78,
      -10,  88,
        0,  90,
       10,  88,
       40,  78,
       65,  55,
       80,  25,
       88, -10,
       85, -45,
       75, -75,
       55, -82,   // forehead between ears
       30, -78,
        0, -78,   // forehead centre
      -30, -78,
      -55, -82,
    ];
    tg.poly(face).fill({ color: TIGER_BODY, alpha: 0.95 });
    tg.poly(face).stroke({ width: 3, color: TIGER_DARK, alpha: 1 });

    // Layer 3: EARS — 2 triangles + inner pink
    tg.poly([-72, -78, -110, -125, -52, -98]).fill({ color: TIGER_BODY, alpha: 0.95 });
    tg.poly([-72, -78, -110, -125, -52, -98]).stroke({ width: 3, color: TIGER_DARK, alpha: 1 });
    tg.poly([-68, -82, -98, -115, -58, -100]).fill({ color: EAR_PINK, alpha: 0.85 });
    tg.poly([ 72, -78,  110, -125,  52, -98]).fill({ color: TIGER_BODY, alpha: 0.95 });
    tg.poly([ 72, -78,  110, -125,  52, -98]).stroke({ width: 3, color: TIGER_DARK, alpha: 1 });
    tg.poly([ 68, -82,  98, -115,  58, -100]).fill({ color: EAR_PINK, alpha: 0.85 });

    // Layer 4: STRIPES — black curves on cheeks (3 each side) + forehead pair
    // Left cheek
    tg.moveTo(-65, -50).bezierCurveTo(-72, -32, -75, -10, -68, 8).stroke({ width: 4, color: TIGER_DARK, alpha: 0.95 });
    tg.moveTo(-50, -62).bezierCurveTo(-58, -42, -62, -22, -55, -2).stroke({ width: 4, color: TIGER_DARK, alpha: 0.95 });
    tg.moveTo(-35, -70).bezierCurveTo(-38, -55, -42, -38, -38, -22).stroke({ width: 3, color: TIGER_DARK, alpha: 0.95 });
    // Right cheek (mirror)
    tg.moveTo( 65, -50).bezierCurveTo( 72, -32,  75, -10,  68, 8).stroke({ width: 4, color: TIGER_DARK, alpha: 0.95 });
    tg.moveTo( 50, -62).bezierCurveTo( 58, -42,  62, -22,  55, -2).stroke({ width: 4, color: TIGER_DARK, alpha: 0.95 });
    tg.moveTo( 35, -70).bezierCurveTo( 38, -55,  42, -38,  38, -22).stroke({ width: 3, color: TIGER_DARK, alpha: 0.95 });
    // Forehead vertical pair (bracketing 寅 character area)
    tg.moveTo(-22, -70).lineTo(-18, -45).stroke({ width: 3.5, color: TIGER_DARK, alpha: 0.95 });
    tg.moveTo( 22, -70).lineTo( 18, -45).stroke({ width: 3.5, color: TIGER_DARK, alpha: 0.95 });

    // Layer 5: WHITE MUZZLE — ellipse around mouth area
    tg.ellipse(0, 30, 38, 24).fill({ color: 0xffeeee, alpha: 0.9 });
    tg.ellipse(0, 30, 38, 24).stroke({ width: 1.5, color: TIGER_DARK, alpha: 0.7 });

    // Layer 6: NOSE — pink triangle
    tg.poly([-11, 8, 11, 8, 0, 22]).fill({ color: NOSE_PINK, alpha: 1 });
    tg.poly([-11, 8, 11, 8, 0, 22]).stroke({ width: 2, color: TIGER_DARK, alpha: 1 });

    // Layer 7: MOUTH — W-shape + lower jaw line
    tg.moveTo(-15, 30).lineTo(-8, 38).lineTo(0, 32).lineTo(8, 38).lineTo(15, 30)
      .stroke({ width: 2.5, color: TIGER_DARK, alpha: 1 });
    tg.moveTo(0, 22).lineTo(0, 32).stroke({ width: 2, color: TIGER_DARK, alpha: 1 });

    // Layer 8: EYES — 2 large yellow with vertical slit pupils (TIGER feature)
    tg.circle(-32, -28, 14).fill({ color: 0xffffff, alpha: 1 });
    tg.circle(-32, -28, 14).stroke({ width: 2.5, color: TIGER_DARK, alpha: 1 });
    tg.circle(-32, -28, 11).fill({ color: 0xffd700, alpha: 1 });    // yellow iris
    tg.ellipse(-32, -28, 2.5, 9).fill({ color: 0x000000, alpha: 1 });// vertical slit
    tg.circle(-29, -32, 2).fill({ color: 0xffffff, alpha: 0.95 });   // highlight
    tg.circle( 32, -28, 14).fill({ color: 0xffffff, alpha: 1 });
    tg.circle( 32, -28, 14).stroke({ width: 2.5, color: TIGER_DARK, alpha: 1 });
    tg.circle( 32, -28, 11).fill({ color: 0xffd700, alpha: 1 });
    tg.ellipse( 32, -28, 2.5, 9).fill({ color: 0x000000, alpha: 1 });
    tg.circle( 35, -32, 2).fill({ color: 0xffffff, alpha: 0.95 });

    // Layer 9: WHISKERS — 6 white curves (3 each side)
    tg.moveTo(-32, 30).bezierCurveTo(-65, 28, -90, 30, -110, 33).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    tg.moveTo(-32, 35).bezierCurveTo(-65, 38, -90, 43, -105, 48).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    tg.moveTo(-32, 40).bezierCurveTo(-60, 50, -85, 60, -100, 65).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    tg.moveTo( 32, 30).bezierCurveTo( 65, 28,  90, 30,  110, 33).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    tg.moveTo( 32, 35).bezierCurveTo( 65, 38,  90, 43,  105, 48).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    tg.moveTo( 32, 40).bezierCurveTo( 60, 50,  85, 60,  100, 65).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });

    // Layer 10: 寅 CHARACTER — calligraphy-style Text on forehead (replaces tiger 王)
    const yinChar = new Text({
      text: '寅',
      style: {
        fontFamily: '"Noto Serif TC", "Ma Shan Zheng", serif',
        fontWeight: '900',
        fontSize: 36,
        fill: TIGER_DARK,
        stroke: { color: TIGER_BODY, width: 2 },
      },
    });
    yinChar.anchor.set(0.5, 0.5);
    yinChar.x = 0;
    yinChar.y = -55;   // forehead position
    tigerWrap.addChild(yinChar);

    stage.addChild(tigerWrap);
    const tigerGlow = applyGlow(tigerWrap, TIGER_BODY, 5, 22);

    // Pulse-in 240ms: scale 0.3→1.4 + alpha 0→1
    void tween(240, p => {
      tigerWrap.alpha = p;
      tigerWrap.scale.set(0.3 + 1.1 * p);
    }, Easings.easeOut).then(async () => {
      // Settle 100ms: scale 1.4→1.0
      await tween(100, p => { tigerWrap.scale.set(1.4 - 0.4 * p); }, Easings.easeOut);
      // Hold + fade 300ms: alpha 1→0
      await tween(300, p => { tigerWrap.alpha = 1 - p; }, Easings.easeIn);
      removeFilter(tigerWrap, tigerGlow);
      tigerWrap.destroy({ children: true });
    });
  }
```

> **10-layer composition**：背景 halo + 圓臉 + 雙耳 + 黑斑紋 + 白唇圈 + 粉鼻 + W嘴 + **金黃眼含直瞳**（虎眼識別）+ 6 鬚 + **寅字額印**（取代傳統虎頭「王」）。
>
> ~260px wide × 240px tall。位置 midpoint(tp0, tp1) 上方 30px。

> **不動**：earth crack cross / shockwave / screen shake / tiger ghost dual-ring / cleanup。

**Commit**: `feat(chore #225): 寅 tiger-fist-combo — replace 3 generic comic bursts with single 寅字虎面圖騰 climax (10-layer frontal tiger face + 寅 character forehead seal, ~260×240px Container of Graphics+Text, 640ms anim)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigTigerFistCombo` 內：
  - 刪 line 1263 / 1266 / 1269 三個 playComicBurst calls (+ inline comments)
  - line 1269 後 / earth crack 之前插入 tigerWrap block

**禁止**：
- 動其他 7 個 signature
- 動 `playComicBurst` helper
- 動 doPunch / earth crack / tiger ghost / screen shake / cleanup
- 動 BattleScreen / FXPreviewScreen
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "TIGER_BODY\|TIGER_DARK\|tigerWrap\|yinChar" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigTigerFistCombo` 內
   - `grep "playComicBurst" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應 ≤ 5（10→9→8→7→5，寅 3 處全移除）
5. **Preview 驗證**：
   - dev mode 進 picker 按 `6` 寅
   - 應看到：
     - 既有 charge glow + foot ring + 3 連拳（保留）
     - **3 拳結束後爆現正面虎臉**：橙紅圓臉 + 黑斑紋 + 三角虎耳含粉紅內 + 雙金眼直瞳 + 粉鼻 + W嘴 + 6 鬚 + **「寅」字額印**
     - 既有 earth crack cross + shockwave + tiger ghost 後續正常（保留）
   - **不應看到**通用白星 comic burst
   - 切其他 6 個 spirit 不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（虎臉 + 寅字額印）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**

---

## 6. 系列進度

| chore | spirit | 狀態 |
|---|---|---|
| #220 | 蒼嵐 | ✅ + polish ✅ |
| #221 | 珞洛 | ✅ |
| #222 | 朱鸞 | ✅ + polish ✅ |
| #223 | 朝雨 | ✅ |
| #224 | 孟辰璋 | ✅ + polish ✅ + polish 2 ✅ |
| **#225** | **寅** | **⏳ this** |
| #226 | 玄墨（**龜甲六邊形大石**）| next |
| #227 | 凌羽 | |
| cleanup | 移除 helper + 蒼嵐/珞洛 殘留 | 系列收尾 |
