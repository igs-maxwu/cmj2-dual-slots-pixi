# Chore #227 — 凌羽攻擊特效升級（巨型鳳凰展翼 + 移除通用 burst + 取代簡版 silhouette）

## 1. Context

per-spirit FX 重做系列**最後一個**（朱鸞 #222 / 朝雨 #223 / 孟辰璋 #224 / 寅 #225 / 玄墨 #226 已 ship）。凌羽 (lingyu) = 火焰箭 + 鳳凰 spirit。

當前 [`_sigPhoenixFlameArrow`](src/screens/SpiritAttackChoreographer.ts#L1647)：
1. (a) 0-200ms: 弓 + 箭出現
2. (b) 200-280ms: charge flicker
3. (c) 280-480ms: 箭沿 bezier 飛 + 火焰 trail
4. (d) **line 1759 playComicBurst** ← 移除
5. shockwave + screen shake
6. **line 1770-1778 既有簡版 phoenix**（2 rings + 2 wing rects）← 取代
7. white flash + bloom + 5 ember
8. (e) phoenix fade + cleanup

### 升級重點 — 巨型鳳凰展翼 ~300px wingspan + flame tail

owner spec: 「巨型鳳凰展翼從天降（橙紅鳳凰 silhouette ~300px 寬）」

跟 chore #222 朱鸞區別：
- 朱鸞 = top-down 對稱靜態鳥（5-layer 含 12-vertex 翼）
- 凌羽 = **V-spread 向上展翼鳳凰**（垂直軸 vertical body + 火焰尾流向下 + flame aura halo），更動態 + 火焰 themed

刪掉現有簡版 (pxOuter / pxInner / wingL / wingR)，換成 6-layer 火鳳凰。

純視覺重做 — 不動 弓 / 箭 / 飛行 bezier / shockwave / screen shake / cleanup 主體結構。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 加 phoenix Graphics block + 移除 1 個 call + 取代簡版

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:1647-1817`](src/screens/SpiritAttackChoreographer.ts#L1647) `_sigPhoenixFlameArrow` 結構
2. 確認 line 1759 `playComicBurst(stage, tp0.x, tp0.y, color)`
3. 確認 line 1770-1778 既有簡版 phoenix (`pxOuter` / `pxInner` / `wingL` / `wingR` 4 個 Graphics)
4. 確認 line 1796-1809 既有 phoenix fade tween + line 1812-1813 cleanup destroy
5. 確認 PERSONALITIES.lingyu.particleColor = 0xFF4500（橙紅）

---

## 3. Task

### Single commit — 凌羽 巨型鳳凰 + remove generic burst + replace simple phoenix

#### 3a. 移除通用 comic burst

`src/screens/SpiritAttackChoreographer.ts` line 1758-1761：

當前：
```ts
  AudioManager.playSfx('damage-crit');
  playComicBurst(stage, tp0.x, tp0.y, color);          // chore #FX-BURST

  const swPromise = applyShockwave(stage, tp0.x, tp0.y, 90, 100);
```

改成：
```ts
  AudioManager.playSfx('damage-crit');
  // chore #227: removed generic comic burst — replaced by 巨型鳳凰展翼 (added below)

  const swPromise = applyShockwave(stage, tp0.x, tp0.y, 90, 100);
```

#### 3b. 取代簡版 phoenix silhouette (line 1769-1778)

當前：
```ts
  // Phoenix silhouette: 2 rings + 2 wing rects
  const pxOuter = new Graphics().circle(0, 0, 60).fill({ color: 0xff8844, alpha: 0.35 });
  pxOuter.x = tp0.x; pxOuter.y = tp0.y;
  const pxInner = new Graphics().circle(0, 0, 30).fill({ color, alpha: 0.65 });
  pxInner.x = tp0.x; pxInner.y = tp0.y;
  const wingL = new Graphics().rect(-60, -10, 60, 20).fill({ color, alpha: 0.50 });
  wingL.x = tp0.x; wingL.y = tp0.y; wingL.rotation = -0.4;
  const wingR = new Graphics().rect(0, -10, 60, 20).fill({ color, alpha: 0.50 });
  wingR.x = tp0.x; wingR.y = tp0.y; wingR.rotation = 0.4;
  stage.addChild(pxOuter, pxInner, wingL, wingR);
```

改成：
```ts
  // chore #227: 巨型鳳凰展翼 — replaces simple "2 rings + 2 wing rects" silhouette.
  // 6-layer composition: BG flame aura + V-spread wings + vertical body + flame tail + beak/eye + sparks.
  // ~300px wingspan, ~290px tall (head -55 to flame tail tip 145).
  const PHX_WING   = 0xff6a3a;
  const PHX_BODY   = 0xff8a3a;
  const PHX_TRIM   = 0xffd37a;
  const PHX_FLAME  = 0xff5520;
  const PHX_HALO   = 0xffaa44;

  const phoenix = new Graphics();

  // Layer 1: BG FLAME AURA — 3 concentric circles for fire halo
  phoenix.circle(0, 0, 140).fill({ color: PHX_HALO,  alpha: 0.15 });
  phoenix.circle(0, 0, 100).fill({ color: 0xff8844, alpha: 0.22 });
  phoenix.circle(0, 0,  70).fill({ color: PHX_FLAME, alpha: 0.25 });

  // Layer 2: V-SPREAD WINGS — 2 wings angled upward, flame-feather outline
  const leftWing = [
     -8, -10,    // shoulder attach
    -45, -65,    // upper feather curve
    -90, -110,   // wing tip 1
   -130, -130,   // wing tip 2 (highest)
   -150, -100,   // outer wing edge
   -130,  -70,
   -100,  -40,
    -75,  -10,   // wing back outer
    -55,    0,   // wing back inner
    -25,    5,   // shoulder bottom attach
  ];
  phoenix.poly(leftWing).fill({ color: PHX_WING, alpha: 0.85 });
  phoenix.poly(leftWing).stroke({ width: 2, color: PHX_TRIM, alpha: 1 });
  const rightWing = leftWing.map((v, i) => i % 2 === 0 ? -v : v);
  phoenix.poly(rightWing).fill({ color: PHX_WING, alpha: 0.85 });
  phoenix.poly(rightWing).stroke({ width: 2, color: PHX_TRIM, alpha: 1 });

  // Layer 3: BODY — vertical phoenix body (head up, tail down)
  const body = [
     0, -55,
     8, -42,
    10, -25,
    12,  -5,
    10,  10,
     8,  25,
    10,  40,
     5,  55,    // body bottom (where flame tail starts)
    -5,  55,
   -10,  40,
    -8,  25,
   -10,  10,
   -12,  -5,
   -10, -25,
    -8, -42,
  ];
  phoenix.poly(body).fill({ color: PHX_BODY, alpha: 0.95 });
  phoenix.poly(body).stroke({ width: 2, color: PHX_TRIM, alpha: 1 });

  // Layer 4: FLAME TAIL — 5 flame curl strokes extending downward
  const flameStrokes: number[][] = [
    [0, 55,  -8,  80,  -3, 100, -10, 130,   0, 148],   // central flame
    [0, 55, -28,  75, -22, 100, -34, 120, -25, 140],   // left-mid flame
    [0, 55,  28,  75,  22, 100,  34, 120,  25, 140],   // right-mid flame
    [0, 55, -50,  70, -55, 100, -60, 125],              // outer-left flame
    [0, 55,  50,  70,  55, 100,  60, 125],              // outer-right flame
  ];
  // Flame outer (orange-red, thick)
  for (const path of flameStrokes) {
    phoenix.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) phoenix.lineTo(path[i], path[i + 1]);
    phoenix.stroke({ width: 5, color: PHX_FLAME, alpha: 0.92 });
  }
  // Flame inner core (light, thin highlight)
  for (const path of flameStrokes) {
    phoenix.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) phoenix.lineTo(path[i], path[i + 1]);
    phoenix.stroke({ width: 1.8, color: 0xffeec0, alpha: 0.85 });
  }

  // Layer 5: BEAK + EYE
  phoenix.poly([0, -55, -3, -45, 3, -45]).fill({ color: 0xffd700, alpha: 1 });
  phoenix.circle(-3, -38, 2).fill({ color: 0x000000, alpha: 1 });
  phoenix.circle( 3, -38, 2).fill({ color: 0x000000, alpha: 1 });

  // Layer 6: SPARKS — 8 small ember dots scattered around phoenix
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = 135 + (i % 3) * 8;
    phoenix.circle(Math.cos(angle) * r, Math.sin(angle) * r, 3).fill({ color: PHX_HALO, alpha: 0.85 });
  }

  phoenix.x = tp0.x;
  phoenix.y = tp0.y - 20;     // slightly above target to centre wings
  phoenix.alpha = 0;
  phoenix.scale.set(0.3);
  stage.addChild(phoenix);
  const phoenixGlow = applyGlow(phoenix, PHX_TRIM, 5, 24);
```

#### 3c. 取代既有 phoenix fade tween (line 1796-1809)

當前：
```ts
  await Promise.all([
    tween(120, p => {
      pxOuter.alpha = 0.35 * (1 - p);
      pxInner.alpha = 0.65 * (1 - p);
      wingL.alpha   = 0.50 * (1 - p);
      wingR.alpha   = 0.50 * (1 - p);
      for (let i = 0; i < embers.length; i++) {
        embers[i].x = tp0.x + emberVX[i] * p * 60;
        embers[i].y = tp0.y - p * 60;
        embers[i].alpha = 0.7 * (1 - p);
      }
    }),
    delay(60),
  ]);
```

改成：
```ts
  // chore #227: phoenix fade — replaces 4 simple Graphics fades. Embers untouched.
  await Promise.all([
    tween(120, p => {
      phoenix.alpha = 1 - p;
      for (let i = 0; i < embers.length; i++) {
        embers[i].x = tp0.x + emberVX[i] * p * 60;
        embers[i].y = tp0.y - p * 60;
        embers[i].alpha = 0.7 * (1 - p);
      }
    }),
    delay(60),
  ]);
```

#### 3d. 取代 cleanup destroy (line 1812-1813)

當前：
```ts
  // Cleanup
  pxOuter.destroy(); pxInner.destroy();
  wingL.destroy();   wingR.destroy();
  for (const em of embers) em.destroy();
```

改成：
```ts
  // Cleanup
  removeFilter(phoenix, phoenixGlow);
  phoenix.destroy();
  for (const em of embers) em.destroy();
```

#### 3e. 加入 phoenix pulse-in 動畫

`phoenix` 創建後（3b 末尾）已 set `alpha = 0` / `scale = 0.3`。需要在 white flash 之後加 pulse-in tween。

在 line 1781 (`await tween(80, p => { flash.alpha = 0.5 * (1 - p); });`) **之前**（即 phoenix Graphics 創建之後 + flash 之前）插入：

```ts
  // chore #227: phoenix pulse-in (fire-and-forget, overlaps with flash + bloom)
  void tween(240, p => {
    phoenix.alpha = p;
    phoenix.scale.set(0.3 + 1.2 * p);   // 0.3 → 1.5
  }, Easings.easeOut).then(async () => {
    await tween(100, p => {
      phoenix.scale.set(1.5 - 0.4 * p);  // 1.5 → 1.1
    }, Easings.easeOut);
  });
```

> phoenix 在 240ms 內 pulse-in，settle 100ms 後 hold @ scale 1.1。
>
> 既有 (e) `await tween(120, p => phoenix.alpha = 1 - p)` 接著淡出。

#### 3f. 不動其他

- 弓 + 箭 (line 1655-1694) — 保留
- 箭飛行 bezier + flame trail (line 1696-1753) — 保留
- shockwave + screen shake — 保留
- white flash + bloom — 保留（既有 flash.destroy + removeFilter bloom 仍在）
- ember 5 顆粒 (line 1786-1794) — 保留
- (e) phoenix fade tween + 60ms delay — 保留結構
- AudioManager / hitstop — 保留

**Commit**: `feat(chore #227): 凌羽 phoenix-flame-arrow — replace generic burst + simple silhouette with 巨型鳳凰展翼 (6-layer ~300px wingspan: BG flame aura + V-spread wings + vertical body + 5-flame tail + beak/eye + 8 sparks, 700ms anim. SERIES FINALE 8/8.)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigPhoenixFlameArrow` 內：
  - 刪 line 1759 playComicBurst
  - 取代 line 1770-1778 簡版 phoenix → 6-layer 巨型鳳凰
  - 加 phoenix pulse-in tween (在 white flash 之前)
  - 取代 line 1796-1809 fade refs
  - 取代 line 1812-1813 cleanup

**禁止**：
- 動其他 7 個 signature
- 動 `playComicBurst` helper（cleanup chore 統一處理）
- 動 弓 / 箭 / bezier 飛行 / flame trail / shockwave / shake / flash / bloom / ember
- 動 BattleScreen / FXPreviewScreen
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "PHX_WING\|PHX_BODY\|PHX_FLAME\|leftWing\|flameStrokes" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigPhoenixFlameArrow` 內
   - `grep "playComicBurst" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應 ≤ 3（4→3，凌羽移除）
   - `grep "pxOuter\|pxInner\|wingL\|wingR" src/screens/SpiritAttackChoreographer.ts` — 應為空（已 replaced）
5. **Preview 驗證**：
   - dev mode 進 picker 按 `8` 凌羽
   - 應看到：
     - 既有 弓 + 箭 + bezier 飛行 + 火焰 trail（保留）
     - **巨型鳳凰展翼**：火焰 halo 背景 + V-spread 雙翼向上 + 垂直 body + 5 道火焰尾流向下 + 金喙黑眼 + 8 顆閃光火星
     - 既有 shockwave + flash + bloom + 5 顆 ember 上飄（保留）
   - **不應看到**通用白星 comic burst
   - **不應看到**舊版簡 phoenix（2 rings + 2 wing rects）
   - 切其他 7 個 spirit 不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（巨型火鳳凰）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**

---

## 6. 系列進度（本 chore 結束後 8/8 spirit FX 全升級）

| chore | spirit | 狀態 |
|---|---|---|
| #220 | 蒼嵐 | ✅ + polish ✅ |
| #221 | 珞洛 | ✅ |
| #222 | 朱鸞 | ✅ + polish ✅ |
| #223 | 朝雨 | ✅ |
| #224 | 孟辰璋 | ✅ + polish ✅ + polish 2 ✅ |
| #225 | 寅 | ✅ |
| #226 | 玄墨 龜甲六邊形大石 | ✅ |
| **#227** | **凌羽 巨型鳳凰展翼** | **⏳ this — SERIES FINALE** |
| **cleanup** | 移除 playComicBurst helper + 蒼嵐/珞洛 殘留 calls | next chore (close series) |
