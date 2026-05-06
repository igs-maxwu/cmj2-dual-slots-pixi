# Chore #221 — 珞洛攻擊特效升級（speed line + 加深虎爪 + 塵土爆破）

## 1. Context

8-spirit FX 升級系列第 **2/8**（前序 chore #220 蒼嵐已 ship）。

### 升級方向（owner-approved）

珞洛 = 烈日紋虎爪角色，現有 [`_sigTripleDash`](src/screens/SpiritAttackChoreographer.ts#L348)：
- 3× dash 含起點 afterimage 圓圈
- 每次 dash 命中加 3-line claw slash (width 3.5, length 56)
- 最後 4-radial 爆破 burst + glow

### 增強重點

1. **Speed line per dash**（NEW）— 每次 dash 起飛瞬間，避擊起點留 4-5 條短橫線（manga ⟫⟫⟫ 風）alpha 0.7→0 共 200ms，強化「衝刺」速度感
2. **加深虎爪痕**（UPGRADE）— 原 3 線 `width 3.5 / length 56 / α 0.85` → 雙描邊：黑底 width 6 + 主色 width 4 + 白核 width 1.5，length 80，α 0.95。形成「真實爪痕割肉」深刻感
3. **塵土爆破 per impact**（NEW）— 每次 dash 命中爆 6 個小塵粒 (r=3-5)，輻射狀飛散 + 重力下墜 + scale 1→1.3 + alpha 1→0 共 240ms。配色 0xc8804a（土黃）α 0.85

純視覺升級 — 不動 personality config / dash logic / Phase 4 dispatch / final burst。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 在 `_sigTripleDash` 內 dash loop 加 3 個輔助效果

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:348-405`](src/screens/SpiritAttackChoreographer.ts#L348) `_sigTripleDash` 結構
2. 確認 dash loop line 353-385（3× dash + ghost afterimage + claw slash）
3. 確認 final 4-radial burst line 387-404
4. 確認 chore #220 蒼嵐升級 in 上方（#267-344）— 不影響珞洛
5. 確認 chore #220 polish (X-brand rotation) 已 merge — picker 可看 8 個 spirit FX

---

## 3. Task

### Single commit — 珞洛 upgrade

#### 3a. Speed line per dash

`src/screens/SpiritAttackChoreographer.ts` `_sigTripleDash` 內，**dash loop 開頭** (line 353 `for (let dash = 0; dash < 3; dash++) {` 之後，line 360 ghost afterimage 之前)：

加入：
```ts
    // chore #221: speed lines — 4 short horizontal streaks behind dash start
    const speedLines = new Graphics();
    const dirX = endX > startX ? -1 : 1;       // streaks point away from target direction
    for (let s = 0; s < 4; s++) {
      const sy = startY - 24 + s * 12;          // vertical spread
      const sx = startX + dirX * 8;
      speedLines.moveTo(sx, sy)
                .lineTo(sx + dirX * 32, sy)
                .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
    }
    stage.addChild(speedLines);
    void tween(200, p => { speedLines.alpha = 1 - p; })
         .then(() => speedLines.destroy());
```

#### 3b. 加深虎爪痕

替換 line 373-384 既有 `claw slash marks at impact` block：

當前：
```ts
    // Claw slash marks at impact
    const claw = new Graphics();
    for (let i = 0; i < 3; i++) {
      const angle = (-0.4 + i * 0.4) + Math.PI / 2;
      claw
        .moveTo(tp.x - Math.cos(angle) * 8, tp.y - Math.sin(angle) * 28)
        .lineTo(tp.x + Math.cos(angle) * 8, tp.y + Math.sin(angle) * 28)
        .stroke({ width: 3.5, color, alpha: 0.85 });
    }
    stage.addChild(claw);
    await tween(110, p => { claw.alpha = 1 - p; });
    claw.destroy();
```

改成：
```ts
    // chore #221: deeper claw gash — triple-stroke (dark base + colored mid + white core)
    // length 56→80 / width 3.5→4 (mid) / 6 (base) / 1.5 (core)
    const claw = new Graphics();
    for (let i = 0; i < 3; i++) {
      const angle = (-0.4 + i * 0.4) + Math.PI / 2;
      const x1 = tp.x - Math.cos(angle) * 12;
      const y1 = tp.y - Math.sin(angle) * 40;
      const x2 = tp.x + Math.cos(angle) * 12;
      const y2 = tp.y + Math.sin(angle) * 40;
      // Dark base stroke (depth)
      claw.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 6, color: 0x000000, alpha: 0.7 });
      // Main coloured stroke
      claw.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 4, color, alpha: 0.95 });
      // White core highlight
      claw.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: 1.5, color: 0xffffff, alpha: 1 });
    }
    stage.addChild(claw);
    await tween(140, p => { claw.alpha = 1 - p; });    // 110→140ms 多看一下
    claw.destroy();
```

#### 3c. 塵土爆破 per impact

在 3b claw destroy 後（同一個 for-loop iteration 結束前），加：

```ts
    // chore #221: dust burst at impact — 6 radial particles + gravity
    const dustParts: { g: Graphics; vx: number; vy: number }[] = [];
    for (let d = 0; d < 6; d++) {
      const angle = (d / 6) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.8 + Math.random() * 1.4;
      const dust = new Graphics()
        .circle(0, 0, 3 + Math.random() * 2)
        .fill({ color: 0xc8804a, alpha: 0.85 });
      dust.x = tp.x;
      dust.y = tp.y;
      stage.addChild(dust);
      dustParts.push({
        g: dust,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,        // slight upward bias
      });
    }
    void tween(240, p => {
      for (const dp of dustParts) {
        dp.g.x += dp.vx;
        dp.g.y += dp.vy;
        dp.vy += 0.18;                            // gravity
        dp.g.scale.set(1 + p * 0.3);
        dp.g.alpha = 0.85 * (1 - p);
      }
    }).then(() => {
      for (const dp of dustParts) dp.g.destroy();
    });
```

> 上面 dustParts tween 是 fire-and-forget（用 `void tween(...)` 不 await），不阻擋下一輪 dash。

#### 3d. 不動其他

- ghost afterimage (line 360-365) — 保留
- dash movement tween (line 367-371) — 保留
- final 4-radial burst (line 387-404) — 保留
- hitstop placeholder — 保留（在 line 406+ 區塊）

**Commit**: `feat(chore): 珞洛 triple-dash FX upgrade — speed lines per dash + triple-stroke claw gash + dust burst at each impact (chore #221, FX-2/8)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigTripleDash` 內 dash loop:
  - 加 speedLines block (loop 開頭)
  - 替換 claw block (triple-stroke)
  - 加 dust burst block (claw destroy 後)

**禁止**：
- 動其他 7 個 signature function
- 動 `attackTimeline` 主流程 / personality / Phase 1/2/3/5
- 動 ghost afterimage / dash tween / final 4-radial burst
- 動 BattleScreen attackTimeline call site
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "speedLines\|dustParts" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigTripleDash` 內
   - `grep "0xc8804a" src/screens/SpiritAttackChoreographer.ts` — dust 顏色
   - `grep "width: 6, color: 0x000000" src/screens/SpiritAttackChoreographer.ts` — claw 黑底
   - `grep "width: 1.5, color: 0xffffff" src/screens/SpiritAttackChoreographer.ts` — claw 白核（蒼嵐 X-brand 也用 width:4 0xffffff，若衝突 grep 確認限定 _sigTripleDash 區段）
   - 其他 7 個 signature 完全沒動 (#267-344 蒼嵐 / #406+ 朱鸞 etc.)
5. **Preview 驗證**：
   - 開 picker 按 `2` 切到珞洛 (triple-dash) 看：
     - 每次 dash 起飛 → **白色 speed lines** 從起點往後延伸短暫消失
     - 每次命中 → **三層描邊深刻虎爪** (黑底 + 主色 + 白核)
     - 每次命中 → **6 顆土黃塵粒**輻射爆飛 + 下墜
     - 最後 4-radial 爆破 burst 仍正常
   - 切 `1` 蒼嵐 X-brand 旋轉仍 OK
   - 切其他 6 個 spirit 完全不變

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 GIF 或截圖（珞洛升級 vs 之前對比）
- spec deviations: 0
- Process check：照新 pattern — 把 git 操作串在**單一 Bash call**

---

## 6. 系列進度

| # | Spirit | Status |
|---|---|---|
| #220 | 蒼嵐 lightning-xcross | ✅ + polish ✅ |
| **#221** | **珞洛 triple-dash** | **⏳ this** |
| #222 | 朱鸞 dual-fireball | next |
| #223 | 朝雨 python-summon | |
| #224 | 孟辰璋 dragon-dual-slash | |
| #225 | 寅 tiger-fist-combo | |
| #226 | 玄墨 tortoise-hammer-smash（**龜甲六邊形大石**）| |
| #227 | 凌羽 phoenix-flame-arrow | |
