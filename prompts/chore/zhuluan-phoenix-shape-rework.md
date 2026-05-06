# Chore — 朱鸞 phoenix 形狀重畫成展翅鳥俯視圖（chore #222 follow-up）

## 1. Context

Owner 試玩 chore #222 (PR #224 / commit b9c0480) 反映：「這形狀不像鳳凰，畫成展翅鳥的俯視圖吧」。

當前 phoenix Graphics 是「中間橢圓 body + 2 個獨立 fan-shape 翼」，視覺上像兩個分離的 blob，缺少「鳥」的整體感。

### Fix

重畫成**俯視展翅鳥** silhouette：
- **頭**朝上（pointed beak）
- **身體**沿垂直軸（橢圓+尖頭）
- **尾巴**朝下（fan-tail 帶羽毛分叉）
- **兩翼**水平展開（leading edge swept forward + trailing edge feather-notched）
- Wingspan 仍 ~250px

純 Graphics polygon 重寫 — 不動位置 / size / 動畫 timing / glow filter / call site。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 改 phoenix block 內 polygon 定義

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts`](src/screens/SpiritAttackChoreographer.ts) `_sigDualFireball` chore #222 phoenix block 仍存
2. 確認 PHX_BODY 0xff8a6a / PHX_EDGE 0xffd37a 顏色定義
3. 確認 phoenixCx / phoenixCy 位置計算 + GlowFilter + 動畫 timing 仍存

---

## 3. Task

### Single commit — Replace phoenix Graphics shape

`src/screens/SpiritAttackChoreographer.ts` `_sigDualFireball` 內 chore #222 phoenix block，**保留**：
- `const phoenixCx / phoenixCy`
- `const PHX_BODY / PHX_EDGE`
- `const phoenix = new Graphics();`
- 後段 phoenix.x = phoenixCx ... 動畫 + applyGlow + tween + destroy

**重寫**：phoenix.ellipse + 兩個 leftPath / rightPath fan polygon + 尾焰 → 改成 5-part 俯視鳥 silhouette。

當前要替換的 block（從 `// Body — vertical ellipse` 到 `// Tail — 3 flame strokes pointing down` 整段，含 6 個 fill + stroke calls）：

```ts
    // Body — vertical ellipse (head/torso)
    phoenix.ellipse(0, 0, 16, 28).fill({ color: PHX_BODY, alpha: 0.85 });
    phoenix.ellipse(0, 0, 16, 28).stroke({ width: 2, color: PHX_EDGE, alpha: 1 });

    // Left wing — fan polygon sweeping out + up
    const leftPath: number[] = [-6, -8];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = Math.PI * (0.5 + t * 0.5);
      const r = 110 + Math.sin(t * Math.PI) * 30;
      leftPath.push(Math.cos(angle) * r, Math.sin(angle) * r * 0.6 - 30);
    }
    leftPath.push(-12, 12);
    phoenix.poly(leftPath).fill({ color: PHX_BODY, alpha: 0.65 });
    phoenix.poly(leftPath).stroke({ width: 2, color: PHX_EDGE, alpha: 0.9 });

    // Right wing — mirror
    const rightPath: number[] = [6, -8];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = -t * Math.PI * 0.5;
      const r = 110 + Math.sin(t * Math.PI) * 30;
      rightPath.push(Math.cos(angle) * r, Math.sin(angle) * r * 0.6 - 30);
    }
    rightPath.push(12, 12);
    phoenix.poly(rightPath).fill({ color: PHX_BODY, alpha: 0.65 });
    phoenix.poly(rightPath).stroke({ width: 2, color: PHX_EDGE, alpha: 0.9 });

    // Tail — 3 flame strokes pointing down
    phoenix.moveTo(-9, 28).lineTo(-4, 60).lineTo(0, 38).lineTo(4, 60).lineTo(9, 28)
           .fill({ color: PHX_BODY, alpha: 0.7 });
```

替換成：

```ts
    // chore #222 polish: spread-winged bird (top-down view).
    // Layered draw order: wings (back) → body (mid) → tail-feathers (front overlap)

    // Layer 1: LEFT WING — swept outward (leading edge top, trailing edge feather-notched)
    const leftWing = [
      -8,  -10,    // shoulder top (attach to body)
      -55, -28,    // leading edge — sweep forward + up
      -120, -18,   // wing tip (outer)
      -110, 0,     // outer corner (kink down)
      -90, 5,      // feather 1 outer
      -82, -2,     //   notch
      -68, 8,      // feather 2
      -60, 0,      //   notch
      -42, 12,     // feather 3 (trailing edge)
      -30, 6,      //   notch
      -16, 14,     // wing root bottom
      -8,  16,     // shoulder bottom (attach back to body)
    ];
    phoenix.poly(leftWing).fill({ color: PHX_BODY, alpha: 0.75 });
    phoenix.poly(leftWing).stroke({ width: 2, color: PHX_EDGE, alpha: 0.9 });

    // Layer 2: RIGHT WING — mirror of left (flip x)
    const rightWing = leftWing.map((v, i) => i % 2 === 0 ? -v : v);
    phoenix.poly(rightWing).fill({ color: PHX_BODY, alpha: 0.75 });
    phoenix.poly(rightWing).stroke({ width: 2, color: PHX_EDGE, alpha: 0.9 });

    // Layer 3: BODY — vertical pointed oval (head up, tail down)
    const body = [
       0,  -34,    // beak / head tip
       8,  -22,    // head right
       10, -8,     // neck right
       9,   8,     // shoulder right
       12,  20,    // body right
       8,   30,    // tail base right
       0,   38,    // tail centre lower
      -8,   30,    // tail base left
      -12,  20,
      -9,   8,
      -10, -8,
      -8,  -22,
    ];
    phoenix.poly(body).fill({ color: PHX_BODY, alpha: 0.95 });
    phoenix.poly(body).stroke({ width: 2, color: PHX_EDGE, alpha: 1 });

    // Layer 4: TAIL FEATHERS — 5-fan splay below body (overlay)
    const tail = [
       0,   28,    // attach to body bottom
      -18,  56,    // far-left feather
      -10,  46,    // feather 1 mid
      -4,   62,    // feather 2 mid-down
       0,   50,    // centre feather tip
       4,   62,    // feather 3 mid-down
      10,   46,    // feather 4 mid
      18,   56,    // far-right feather
       0,   28,    // close back to attach
    ];
    phoenix.poly(tail).fill({ color: PHX_BODY, alpha: 0.7 });
    phoenix.poly(tail).stroke({ width: 1.5, color: PHX_EDGE, alpha: 0.85 });

    // Layer 5: HEAD HIGHLIGHT — small white circle for "eye/beak" depth
    phoenix.circle(0, -22, 3).fill({ color: 0xffffff, alpha: 0.6 });
```

> **視覺結構**：
> - 翼: 12-vertex polygon 雙翼水平展開含 leading-edge 前掠 + trailing edge 3 個羽毛凹凸
> - 主體: 垂直橢圓 12-vertex 含尖頭 + 漸寬 torso + 尖尾
> - 尾翼: 5-fan polygon overlay 帶分叉羽毛
> - 整體 wingspan ~240px (-120 → +120)，頭尾跨距 ~72px (-34 → +38)
> - 從上方俯視像「飛鳥剪影」

> **不動**：phoenixCx / phoenixCy / scale / alpha 動畫 / GlowFilter / fire-and-forget tween chain。

**Commit**: `tune(chore #222 polish): 朱鸞 phoenix shape rework — top-down spread-winged bird silhouette (was 2 disconnected fan blobs)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigDualFireball` 內 chore #222 phoenix block 內的 6 個 polygon/ellipse calls 替換成新 5-layer bird

**禁止**：
- 動 phoenixCx / phoenixCy 位置邏輯
- 動 scale / alpha 動畫 timing (240ms pulse-in / 100ms settle / 280ms fade)
- 動 applyGlow / removeFilter
- 動 PHX_BODY / PHX_EDGE 顏色常數
- 動其他 7 個 signature
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "leftWing\|rightWing\|tail\|spread-winged" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigDualFireball` 內
   - `grep "leftPath\|rightPath" src/screens/SpiritAttackChoreographer.ts` — 應為空（已 replace）
5. **Preview 驗證**：
   - dev mode 進 picker 按 `3` 朱鸞
   - **應看到**俯視展翅鳥 silhouette：兩翼水平展開帶羽毛凹凸 + 直立身體（頭尖朝上 + 尾朝下）+ 5-fan 尾羽 + 白色小頭眼
   - 動畫 timing / position / 顏色 不變
   - 其他 7 個 spirit FX 不變

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（新鳥形 phoenix）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**
