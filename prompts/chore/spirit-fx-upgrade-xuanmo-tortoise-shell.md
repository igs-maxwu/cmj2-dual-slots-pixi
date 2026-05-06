# Chore #226 — 玄墨攻擊特效升級（龜甲六邊形大石 + 移除通用 comic burst）

## 1. Context

per-spirit FX 重做系列第 5 個（朱鸞 #222 / 朝雨 #223 / 孟辰璋 #224 / 寅 #225 已 ship）。玄墨 (xuanmo) = 重鎚地裂 + 龜甲光環角色。

當前 [`_sigTortoiseHammerSmash`](src/screens/SpiritAttackChoreographer.ts#L1436)：
1. (a) 0-250ms: hammer 升空 + 銀色螺旋粒子
2. (b) 250-400ms: overhead dive smash
3. (c) **line 1489 playComicBurst 1.2×** ← 移除
4. shockwave + screen shake + 煙霧柱 + radial glow
5. white flash + 8 道地裂
6. (d) 480-600ms: hitstop + 既有 hex shell halo (細圈)
7. (e) cracks fade
8. cleanup

### 升級重點 — 龜甲六邊形大石

owner spec (2026-05-05)：「玄墨的不要寫砰，直接用龜甲形狀大石」。owner 後續確認 (2026-05-06)「依照角色招式來製作」— 玄墨 = 玄武 / 龜甲 spirit。

3 拳結束後（hammer impact 處）爆現**龜甲紋路六邊形大石**：
- 主六邊形大石（~250px wide, 灰藍金邊）
- 龜甲蜂巢狀 shell pattern（中心 hex + 6 周圍 hex tessellation）
- 邊緣金色 trim + 應力 crack lines

純視覺重做 — 不動 hammer charge / dive / shockwave / smoke plume / 8 cracks / hex shell halo / cleanup。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 加 hex stone Graphics block + 移除 1 個 call

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:1436-1567`](src/screens/SpiritAttackChoreographer.ts#L1436) `_sigTortoiseHammerSmash` 結構
2. 確認 line 1489 `playComicBurst(stage, tp0.x, tp0.y, color, 1.2)`
3. 確認 既有 CRACK / GOLD 顏色常數 (line 1439-1440)
4. 確認 既有 hex shell halo (line 1539-1554) 細圈不動

---

## 3. Task

### Single commit — 龜甲六邊形大石 + remove generic burst

#### 3a. 移除通用 comic burst

`src/screens/SpiritAttackChoreographer.ts` line 1488-1490：

當前：
```ts
  AudioManager.playSfx('hit-heavy');
  playComicBurst(stage, tp0.x, tp0.y, color, 1.2);    // chore #FX-BURST: 1.2x scale — 重武器更大爆
  const swPromise = applyShockwave(stage, tp0.x, tp0.y, 120, 150);
```

改成：
```ts
  AudioManager.playSfx('hit-heavy');
  // chore #226: removed generic comic burst — replaced by tortoise shell hex stone (added below)
  const swPromise = applyShockwave(stage, tp0.x, tp0.y, 120, 150);
```

> 純刪 1 行（playComicBurst call）。

#### 3b. 加入龜甲六邊形大石

在 line 1490 (shockwave) **之後**，line 1493 (smoke plume `// d-04`) **之前**插入：

```ts
  // chore #226: 龜甲六邊形大石 — frontal hex stone with tortoise shell tessellation
  // Programmatic Graphics ~250px wide. Fire-and-forget overlapping smoke + flash + cracks.
  {
    const STONE_BODY = 0x4a5066;
    const STONE_DARK = 0x252a3d;
    const STONE_LITE = 0x7a8298;
    const SHELL_GOLD = GOLD;          // existing 0xd4af37

    const stone = new Graphics();

    // Helper: hex polygon centered at (cx, cy) with circumradius r, pointy-top
    const hexPath = (cx: number, cy: number, r: number): number[] => {
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
        pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      return pts;
    };

    // Layer 1: SHADOW — offset hex down-right (depth feel)
    stone.poly(hexPath(8, 10, 122)).fill({ color: 0x000000, alpha: 0.45 });

    // Layer 2: STONE BODY — main hex 250px diameter (r=120)
    stone.poly(hexPath(0, 0, 120)).fill({ color: STONE_BODY, alpha: 0.95 });
    stone.poly(hexPath(0, 0, 120)).stroke({ width: 4, color: STONE_DARK, alpha: 1 });

    // Layer 3: INNER STONE HIGHLIGHT — top-left light catch
    stone.poly(hexPath(-12, -14, 102)).stroke({ width: 2, color: STONE_LITE, alpha: 0.6 });

    // Layer 4: TORTOISE SHELL — 7-hex tessellation (1 center + 6 around)
    // Center hex
    stone.poly(hexPath(0, 0, 36)).fill({ color: STONE_DARK, alpha: 0.4 });
    stone.poly(hexPath(0, 0, 36)).stroke({ width: 2.5, color: SHELL_GOLD, alpha: 0.85 });
    // 6 surrounding hexes (distance ~62 from centre, angles 30/90/150/210/270/330°)
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
      const sx = Math.cos(a) * 62;
      const sy = Math.sin(a) * 62;
      stone.poly(hexPath(sx, sy, 32)).fill({ color: STONE_DARK, alpha: 0.35 });
      stone.poly(hexPath(sx, sy, 32)).stroke({ width: 2, color: SHELL_GOLD, alpha: 0.75 });
    }

    // Layer 5: GOLD RIM — outer hex with gold edge stroke
    stone.poly(hexPath(0, 0, 116)).stroke({ width: 2, color: SHELL_GOLD, alpha: 0.9 });

    // Layer 6: STRESS CRACKS — 3 thin lines radiating from centre (suggests heavy stone)
    stone.moveTo(-30, -50).lineTo(40, 60).stroke({ width: 1.5, color: STONE_DARK, alpha: 0.7 });
    stone.moveTo(50, -30).lineTo(-60, 40).stroke({ width: 1.5, color: STONE_DARK, alpha: 0.7 });
    stone.moveTo(-15, 70).lineTo(20, -65).stroke({ width: 1.5, color: STONE_DARK, alpha: 0.55 });

    stone.x = tp0.x;
    stone.y = tp0.y;
    stone.alpha = 0;
    stone.scale.set(0.3);
    stone.rotation = -0.05;             // slight tilt — heavy stone landed askew
    stage.addChild(stone);
    const stoneGlow = applyGlow(stone, SHELL_GOLD, 4, 18);

    // Pulse-in 220ms: scale 0.3 → 1.5 + alpha 0 → 1 (heavy thud feel)
    void tween(220, p => {
      stone.alpha = p;
      stone.scale.set(0.3 + 1.2 * p);
      stone.rotation = -0.05 + 0.04 * p;
    }, Easings.easeOut).then(async () => {
      // Settle 100ms: scale 1.5 → 1.0
      await tween(100, p => {
        stone.scale.set(1.5 - 0.5 * p);
      }, Easings.easeOut);
      // Hold + fade 320ms: alpha 1 → 0
      await tween(320, p => { stone.alpha = 1 - p; }, Easings.easeIn);
      removeFilter(stone, stoneGlow);
      stone.destroy();
    });
  }
```

> **6-layer composition**：陰影 + 主石 + 內光 + 7-hex 龜甲蜂巢 + 金邊 + 應力 crack。
>
> ~250px diameter（hex r=120），位置 tp0，slight 旋轉 -0.05→0.0 重物落下感。動畫 640ms（重武器較長停留）。

#### 3c. 不動其他

- hammer charge + spiral (line 1444-1474) — 保留
- overhead dive (line 1476-1485) — 保留
- AudioManager skill-xuanmo / hit-heavy — 保留
- shockwave + screen shake — 保留
- smoke plume + radial glow — 保留
- white flash + 8 radial cracks — 保留
- hex shell halo (line 1539-1554) — 保留（這是細圈，跟新加的大石不衝突）
- cracks fade + cleanup — 保留

**Commit**: `feat(chore #226): 玄墨 tortoise-hammer-smash — replace generic comic burst with 龜甲六邊形大石 (hex stone with tortoise shell 7-hex tessellation + gold rim + stress cracks, ~250px, 640ms anim, owner spec)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigTortoiseHammerSmash` 內：
  - 刪 line 1489 playComicBurst call
  - line 1490 後 / line 1493 前插入 hex stone block

**禁止**：
- 動其他 7 個 signature
- 動 `playComicBurst` helper
- 動 hammer charge / dive / shockwave / smoke / flash / 8 cracks / hex shell halo / cleanup
- 動 BattleScreen / FXPreviewScreen
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "STONE_BODY\|STONE_DARK\|hexPath\|tortoise shell" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigTortoiseHammerSmash` 內
   - `grep "playComicBurst" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應 ≤ 4（5→4，玄墨移除）
5. **Preview 驗證**：
   - dev mode 進 picker 按 `7` 玄墨
   - 應看到：
     - 既有 hammer 升空 + 螺旋粒子（保留）
     - hammer overhead dive smash（保留）
     - **龜甲六邊形大石爆現**：灰藍 hex 大石 + 金色蜂巢 7-hex shell pattern + 金邊 + 3 道應力 crack + slight tilt
     - 既有 smoke + flash + 8 radial cracks + hex shell halo（保留）
   - **不應看到**通用白星 comic burst
   - 切其他 6 個 spirit 不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（龜甲大石）
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
| #225 | 寅 | ✅ |
| **#226** | **玄墨 龜甲六邊形大石** | **⏳ this** |
| #227 | 凌羽 | next |
| cleanup | 移除 helper + 蒼嵐/珞洛 殘留 | 系列收尾 |
