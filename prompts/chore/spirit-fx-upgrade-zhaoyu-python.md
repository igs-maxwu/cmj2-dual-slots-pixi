# Chore #223 — 朝雨攻擊特效升級（翠綠巨蟒大張口 + 移除通用 comic burst）

## 1. Context

per-spirit FX 重做系列第 2 個（朱鸞 #222 已 ship）。朝雨 (zhaoyu) = 蟒蛇召喚角色。

當前 [`_sigPythonSummon`](src/screens/SpiritAttackChoreographer.ts#L696)：
1. 召喚圈（同心環 + 五芒星）在 tp
2. **line 720-721 通用 playComicBurst** ← 移除
3. shockwave 90px ring
4. Serpent zigzag 升起 120px（細條 zigzag）
5. 3 道翠綠 tint 環
6. cleanup

### 升級重點 — 翠綠巨蟒大張口咬下

加入**俯衝下咬大蟒蛇** silhouette ~240-270px 高 + 開口含尖牙：
- 從 target 上方 240px 處 S-curve coiled body 蜿蜒下垂
- 蛇頭在 target 位置張開大嘴
- 上下顎含 2 顆白色尖牙
- 金色眼 + 黑瞳孔

純視覺重做 — 不動 attackTimeline / personality / damage 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 加 1 個 python Graphics block + 移除 1 個 call

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:696-773`](src/screens/SpiritAttackChoreographer.ts#L696) `_sigPythonSummon` 結構
2. 確認 line 720-721 `playComicBurst(stage, tp.x, tp.y, color)`
3. 確認 PERSONALITIES.zhaoyu.particleColor = 0x4adb8e
4. 確認 既有 serpent zigzag (line 727-748) — **保留** as 細部 detail，不取代

---

## 3. Task

### Single commit — 朝雨 python jaws climax + remove generic burst

#### 3a. 移除通用 comic burst

`src/screens/SpiritAttackChoreographer.ts` line 720-721：

當前：
```ts
  // chore #FX-BURST: comic burst at target
  playComicBurst(stage, tp.x, tp.y, color);

  // 2. Shockwave ring at target (substitutes for DisplacementFilter distortion)
  const swPromise = applyShockwave(stage, tp.x, tp.y, 90, 180);
```

改成：
```ts
  // chore #223: removed generic comic burst — replaced by giant python jaws climax (see below)

  // 2. Shockwave ring at target (substitutes for DisplacementFilter distortion)
  const swPromise = applyShockwave(stage, tp.x, tp.y, 90, 180);
```

> 純刪 2 行（comment + call）。

#### 3b. 加入巨蟒大張口（fire-and-forget）

在 line 718（既有 `tween(200, p => { circle.clear(); ... });` 之後，line 720 改動處之前）插入：

```ts
  // chore #223: 翠綠巨蟒大張口咬下 — vertical S-curve body + open jaws + fangs descending onto target.
  // Programmatic Graphics ~240px tall, fire-and-forget overlapping serpent + impact pulses.
  {
    const PYT_BODY = 0x4adb8e;
    const PYT_LITE = 0x8ff5c0;
    const PYT_DARK = 0x1a4030;

    const python = new Graphics();

    // Layer 1: BODY — S-curve coiled tail descending from above (bezier stroke)
    // Path origin = python centre = tp; body extends upward to y=-240
    python.moveTo(0, -240);
    python.bezierCurveTo(60, -200, -60, -120, 0, -10);
    python.stroke({ width: 32, color: PYT_BODY, alpha: 0.85 });
    // Inner brighter core
    python.moveTo(0, -240);
    python.bezierCurveTo(60, -200, -60, -120, 0, -10);
    python.stroke({ width: 18, color: PYT_LITE, alpha: 0.7 });

    // Layer 2: HEAD — ellipse at (0, -8), 32×24
    python.ellipse(0, -8, 32, 24).fill({ color: PYT_BODY, alpha: 0.95 });
    python.ellipse(0, -8, 32, 24).stroke({ width: 2.5, color: PYT_DARK, alpha: 1 });

    // Layer 3: UPPER JAW — wide-open V-shape extending down from head
    // Points: left mouth corner → right mouth corner → mouth back centre
    python.poly([
      -28,  5,     // left mouth corner
       28,  5,     // right mouth corner
       18, 28,     // right inner mouth
        0, 35,     // mouth back tip (deepest point)
      -18, 28,     // left inner mouth
    ]).fill({ color: PYT_DARK, alpha: 0.95 });
    python.poly([
      -28,  5,
       28,  5,
       18, 28,
        0, 35,
      -18, 28,
    ]).stroke({ width: 2, color: PYT_BODY, alpha: 1 });

    // Layer 4: TWO FANGS — white triangles pointing down from upper jaw
    python.poly([-14, 5, -10, 22, -6, 5]).fill({ color: 0xffffff, alpha: 0.95 });
    python.poly([-14, 5, -10, 22, -6, 5]).stroke({ width: 1, color: PYT_DARK, alpha: 0.7 });
    python.poly([ 14, 5,  10, 22,  6, 5]).fill({ color: 0xffffff, alpha: 0.95 });
    python.poly([ 14, 5,  10, 22,  6, 5]).stroke({ width: 1, color: PYT_DARK, alpha: 0.7 });

    // Layer 5: EYE — gold iris + black pupil (offset on head)
    python.circle(-13, -10, 5).fill({ color: 0xffd700, alpha: 0.95 });
    python.circle(-13, -10, 2.5).fill({ color: 0x000000, alpha: 1 });
    // Highlight on eye
    python.circle(-12, -11, 1).fill({ color: 0xffffff, alpha: 0.9 });

    python.x = tp.x;
    python.y = tp.y;
    python.alpha = 0;
    python.scale.set(0.3);
    stage.addChild(python);

    const pythonGlow = applyGlow(python, PYT_LITE, 5, 22);

    // Pulse-in 260ms: scale 0.3→1.4, alpha 0→1
    void tween(260, p => {
      python.alpha = p;
      python.scale.set(0.3 + 1.1 * p);
    }, Easings.easeOut).then(async () => {
      // Settle 100ms: scale 1.4→1.0
      await tween(100, p => { python.scale.set(1.4 - 0.4 * p); }, Easings.easeOut);
      // Hold + fade 300ms: alpha 1→0
      await tween(300, p => { python.alpha = 1 - p; }, Easings.easeIn);
      removeFilter(python, pythonGlow);
      python.destroy();
    });
  }
```

> **視覺結構**：
> - 蛇身從 target 上方 240px S-curve 蜿蜒下垂
> - 外層 32px 寬主體 + 內層 18px 亮綠核心（雙層 stroke 質感）
> - 頭部橢圓 32×24 在 target 上方 8px
> - 大張嘴 5-vertex polygon 開口朝下（target 落在嘴中）
> - 兩顆白色尖牙從上顎垂下 ~17px
> - 金色眼 + 黑瞳 + 白點高光
> - 整體 wingspan(高度) ~270px

> **Animation**: scale 0.3→1.4→1.0 + alpha pulse + fade，660ms 共。蓋過既有 serpent zigzag (~160ms) + 3 個 tint pulse (~390ms)。蓋下來 = 「巨蟒突然出現咬下」高潮感。

#### 3c. 不動其他

- 既有 summoning circle (line 702-718) — 保留（前置鋪陳）
- shockwave (line 724) — 保留
- Serpent zigzag (line 726-748) — 保留（小蛇先行，巨蟒climax 後到）
- 3 tint pulses (line 750-762) — 保留
- hitstop + cleanup — 保留

**Commit**: `feat(chore #223): 朝雨 python-summon — replace generic comic burst with giant python jaws climax (~270px tall S-curve body + open mouth + fangs + eye, programmatic Graphics 660ms)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigPythonSummon` 內：
  - 刪 line 720-721 playComicBurst call
  - line 718 後插入 python jaws block

**禁止**：
- 動其他 7 個 signature
- 動 `playComicBurst` helper（其他 spirit 仍用，等系列尾 cleanup）
- 動 summoning circle / shockwave / serpent zigzag / tint pulses
- 動 BattleScreen / FXPreviewScreen
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "PYT_BODY\|PYT_LITE\|PYT_DARK" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigPythonSummon` 內
   - `grep "playComicBurst" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應 ≤ 8 (10→9→8，朝雨被移除)
5. **Preview 驗證**：
   - dev mode 進 picker 按 `4` 朝雨
   - **應看到**：
     - 召喚圈（既有）
     - **巨蟒從上方 S-curve 下垂咬向 target**：大蛇身 + 蛇頭 + 大張嘴 + 2 尖牙 + 金眼
     - 既有 small serpent zigzag + tint pulses 保留
   - **不應看到**通用白星 comic burst
   - 切其他 7 個 spirit 不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（巨蟒大張口）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**

---

## 6. 系列進度

| chore | spirit | 狀態 |
|---|---|---|
| #220 | 蒼嵐 | ✅ + polish ✅ |
| #221 | 珞洛 | ✅ |
| FX-BURST | foundation | ✅（per-spirit 重做中）|
| #222 | 朱鸞 | ✅ + polish ✅ |
| **#223** | **朝雨** | **⏳ this** |
| #224 | 孟辰璋 | next |
| #225 | 寅 | |
| #226 | 玄墨（**龜甲六邊形大石**）| |
| #227 | 凌羽 | |
| cleanup | 移除 playComicBurst helper + 蒼嵐/珞洛 殘留 | 系列收尾 |
