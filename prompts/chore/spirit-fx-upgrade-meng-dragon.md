# Chore #224 — 孟辰璋攻擊特效升級（龍頭虛影 + 巨大十字劍光 + 移除通用 comic burst）

## 1. Context

per-spirit FX 重做系列第 3 個（朱鸞 #222 ✅，朝雨 #223 ✅）。孟辰璋 (mengchenzhang) = 雙翠劍 + 龍鱗角色。

當前 [`_sigDragonDualSlash`](src/screens/SpiritAttackChoreographer.ts#L850)：
1. 0-120ms: 雙翠劍出現
2. 120-400ms: 雙劍斜斬 → tp0/tp1 + hex 粒子尾跡
3. **400ms line 931-932 playComicBurst** ← 移除
4. 400-520ms: impact flash + 2 個 azure 圓爆破
5. 520-640ms: swords fade + hitstop

### 升級重點 — 龍頭虛影 + 巨大十字劍光

owner spec: 「龍頭虛影怒吼 + 200px 寬交叉劍氣」

加 2 層大 FX：
1. **龍頭虛影**: 側臉龍頭 silhouette (~250px wide × 180px tall) 浮現於 clash 上方，半透明 azure 色，怒吼姿態
2. **巨大十字劍光**: 兩道交叉劍氣 (~200px 各 arm) 在 tp0/tp1 中點，白心 + azure 描邊，劍光交鋒瞬間

純視覺重做 — 不動 attackTimeline / personality / damage 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 加 2 個 Graphics block + 移除 1 個 call

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:850-966`](src/screens/SpiritAttackChoreographer.ts#L850) `_sigDragonDualSlash` 結構
2. 確認 line 931-932 `playComicBurst(stage, tp0.x, tp0.y, color)`
3. 確認 既有 `AZURE = 0x4a90e2` / `AZURE_LITE = 0xa0d8ff` 顏色常數可重用
4. 確認 既有 sword swing + impact flash + 2 azure circles 保留

---

## 3. Task

### Single commit — 孟辰璋 dragon head + cross sword light + remove generic burst

#### 3a. 移除通用 comic burst

`src/screens/SpiritAttackChoreographer.ts` line 931-932：

當前：
```ts
  // (d) 400–520ms: impact flash + glow rings
  // chore #FX-BURST: comic burst at primary sword impact
  playComicBurst(stage, tp0.x, tp0.y, color);

  const flash = new Graphics()
```

改成：
```ts
  // (d) 400–520ms: impact flash + glow rings
  // chore #224: removed generic comic burst — replaced by dragon head + cross sword light (added below)

  const flash = new Graphics()
```

#### 3b. 加入龍頭虛影 + 巨大十字劍光（fire-and-forget）

在 line 928 (`tween(280, p => {...})`) **之後**，line 930 註解 `// (d) 400–520ms` **之前**插入：

```ts
  // chore #224: 龍頭虛影 + 巨大十字劍光 — twin climax effects fire-and-forget at sword impact moment
  {
    const DRG_BODY = AZURE;       // 0x4a90e2
    const DRG_LITE = AZURE_LITE;  // 0xa0d8ff
    const DRG_DARK = 0x1a3a6a;

    // ── Layer A: Dragon head silhouette (side profile, ~250px wide × 180px tall) ──
    const dragon = new Graphics();
    // Outline (side view facing right — snout tip on right, mane on left)
    dragon.poly([
      // Lower jaw + throat
       128,  -8,    // snout tip
       118,  10,    // upper lip front
       100,  18,    // jaw bend
        72,  28,    // jaw mid
        40,  38,    // jaw back
        10,  48,    // throat front
       -30,  55,    // throat back
       -70,  40,    // neck under
      -110,  50,    // body trail
      -135,  20,    // mane lower spike start
      // Mane trailing (jagged spikes pointing back-left)
      -145, -10,
      -155, -38,    // spike 1
      -120, -22,
      -130, -55,    // spike 2
       -95, -38,
      -100, -75,    // spike 3
       -65, -48,
       -55, -85,    // spike 4
       -25, -58,
        -5, -78,    // front horn
        20, -58,    // forehead
        45, -68,    // brow horn
        72, -42,
        95, -35,    // upper jaw front ridge
       115, -25,
       128, -8,     // close back to snout
    ]).fill({ color: DRG_BODY, alpha: 0.75 });
    dragon.poly([
       128,  -8, 118, 10, 100, 18, 72, 28, 40, 38, 10, 48, -30, 55, -70, 40,
      -110,  50, -135, 20, -145, -10, -155, -38, -120, -22, -130, -55, -95, -38,
      -100, -75, -65, -48, -55, -85, -25, -58, -5, -78, 20, -58, 45, -68,
        72, -42, 95, -35, 115, -25, 128, -8,
    ]).stroke({ width: 2, color: DRG_DARK, alpha: 1 });

    // Mouth interior (dark V opening)
    dragon.poly([72, 5, 122, 0, 110, 22, 80, 25])
          .fill({ color: DRG_DARK, alpha: 0.9 });

    // 2 sharp fangs (upper jaw)
    dragon.poly([88, 5, 92, 18, 96, 5]).fill({ color: 0xffffff, alpha: 0.95 });
    dragon.poly([108, 5, 112, 16, 116, 5]).fill({ color: 0xffffff, alpha: 0.95 });

    // Eye (gold iris + black pupil + white highlight)
    dragon.circle(45, -42, 6).fill({ color: 0xffd700, alpha: 1 });
    dragon.circle(45, -42, 3).fill({ color: 0x000000, alpha: 1 });
    dragon.circle(46, -43, 1.5).fill({ color: 0xffffff, alpha: 0.95 });

    // Whiskers (2 thin curves trailing from snout)
    dragon.moveTo(120, 5).bezierCurveTo(140, 25, 130, 50, 100, 60).stroke({ width: 2, color: DRG_LITE, alpha: 0.85 });
    dragon.moveTo(118, 12).bezierCurveTo(135, 35, 115, 65, 80, 70).stroke({ width: 2, color: DRG_LITE, alpha: 0.85 });

    dragon.x = cx;
    dragon.y = cy - 70;
    dragon.alpha = 0;
    dragon.scale.set(0.4);
    stage.addChild(dragon);
    const dragonGlow = applyGlow(dragon, DRG_LITE, 4, 22);

    // Pulse-in 220ms + settle 100ms + fade 320ms (~640ms total)
    void tween(220, p => {
      dragon.alpha = p * 0.9;
      dragon.scale.set(0.4 + p);    // 0.4 → 1.4
    }, Easings.easeOut).then(async () => {
      await tween(100, p => { dragon.scale.set(1.4 - 0.4 * p); }, Easings.easeOut);
      await tween(320, p => { dragon.alpha = 0.9 * (1 - p); }, Easings.easeIn);
      removeFilter(dragon, dragonGlow);
      dragon.destroy();
    });

    // ── Layer B: Giant cross sword light at midpoint(tp0, tp1) ──
    const swordCx = (tp0.x + tp1.x) / 2;
    const swordCy = (tp0.y + tp1.y) / 2;

    const swordLight = new Graphics();
    const ARM = 100;   // half-length each (full length 200px)

    // X-cross outer azure (thick)
    swordLight.moveTo(-ARM, -ARM).lineTo(ARM, ARM).stroke({ width: 18, color: DRG_BODY, alpha: 0.85 });
    swordLight.moveTo(ARM, -ARM).lineTo(-ARM, ARM).stroke({ width: 18, color: DRG_BODY, alpha: 0.85 });

    // X-cross white core (thin)
    swordLight.moveTo(-ARM, -ARM).lineTo(ARM, ARM).stroke({ width: 6, color: 0xffffff, alpha: 1 });
    swordLight.moveTo(ARM, -ARM).lineTo(-ARM, ARM).stroke({ width: 6, color: 0xffffff, alpha: 1 });

    swordLight.x = swordCx;
    swordLight.y = swordCy;
    swordLight.alpha = 0;
    swordLight.scale.set(0.5);
    swordLight.rotation = Math.PI / 8;   // slight tilt for dynamic feel
    stage.addChild(swordLight);
    const swordGlow = applyGlow(swordLight, DRG_LITE, 5, 18);

    // Faster pulse-in for sword light (cross flashes brighter than dragon)
    void tween(140, p => {
      swordLight.alpha = p;
      swordLight.scale.set(0.5 + 0.8 * p);   // 0.5 → 1.3
    }, Easings.easeOut).then(async () => {
      await tween(80, p => {
        swordLight.scale.set(1.3 - 0.2 * p);   // 1.3 → 1.1
        swordLight.rotation += 0.01;
      }, Easings.easeOut);
      await tween(220, p => { swordLight.alpha = 1 - p; }, Easings.easeIn);
      removeFilter(swordLight, swordGlow);
      swordLight.destroy();
    });
  }
```

> **視覺結構**：
> - **龍頭** at (cx, cy-70)，~250×180px，30-vertex 側臉（含尖牙 + 金眼 + 雙鬚），半透明 azure，640ms 浮現/淡出
> - **十字劍光** at midpoint(tp0, tp1)，~200px 雙臂，白心+azure 邊，slight tilt 帶動感，440ms 短促 flash
> - 兩個 fire-and-forget，跟既有 impact flash + impactA/B 圓爆破同時起，組成「劍光交鋒 + 龍威壓陣」高潮

#### 3c. 不動其他

- 既有 dual fire-wave (line 856-875) — 保留
- 雙翠劍 (line 877-890) — 保留
- 斜斬粒子尾跡 (line 891-928) — 保留
- impact flash + impactA/B 圓爆破 (line 934-950) — 保留
- swords fade + hitstop + cleanup — 保留

**Commit**: `feat(chore #224): 孟辰璋 dragon-dual-slash — replace generic comic burst with dragon head silhouette (~250px side profile + fangs + eye + whiskers) + giant X-cross sword light (200px arms, programmatic Graphics dual climax)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigDragonDualSlash` 內：
  - 刪 line 931-932 playComicBurst call (+ inline comment)
  - line 928 後 / line 930 之前插入 dragon + cross sword block

**禁止**：
- 動其他 7 個 signature
- 動 `playComicBurst` helper（其他 spirit 仍用）
- 動既有 dual fire-wave / 雙翠劍 / 斜斬粒子 / impact flash / impactA/B
- 動 BattleScreen / FXPreviewScreen
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "DRG_BODY\|dragon\.\|swordLight" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigDragonDualSlash` 內
   - `grep "playComicBurst" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應 ≤ 7（10→9→8→7，孟辰璋移除）
5. **Preview 驗證**：
   - dev mode 進 picker 按 `5` 孟辰璋
   - 應看到：
     - 既有雙翠劍出現 → 斜斬軌跡 → 粒子尾跡（保留）
     - **龍頭虛影**側臉浮現於 clash 上方 (含尖牙 + 金眼 + 雙鬚)，半透明 azure，怒吼姿態
     - **十字劍光**X-cross 200px 在 target 中點短促 flash
     - 既有 impact flash + 2 azure 圓爆破 + screen shake（保留）
   - **不應看到**通用白星 comic burst
   - 切其他 6 個 spirit 不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（龍頭 + 劍光）
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
| **#224** | **孟辰璋** | **⏳ this** |
| #225 | 寅 | next |
| #226 | 玄墨（**龜甲六邊形大石**）| |
| #227 | 凌羽 | |
| cleanup | 移除 helper + 蒼嵐/珞洛 殘留 | 系列收尾 |
