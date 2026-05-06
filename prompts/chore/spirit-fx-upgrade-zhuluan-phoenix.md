# Chore #222 — 朱鸞攻擊特效升級（鳳凰展翼大幻影 + 移除通用 comic burst）

## 1. Context

Owner 試玩 chore #FX-BURST 後反饋：「我的 BAM 效果只是示意動畫的位置、範圍、大小，不是全部都要做成這樣，請依照角色招式來製作動畫」。

→ chore #FX-BURST 通用白星 comic burst 套到 8 隻 = **錯誤方向**。每隻 spirit 應該在那個 size/位置做**符合角色招式風格**的大爆破。

本 chore 是 **per-spirit 重做系列第 1 個**（朱鸞 dual-fireball），同時：
1. 移除 _sigDualFireball 內的通用 `playComicBurst` call (line 575-576)
2. 加入**鳳凰展翼大幻影**（朱鸞 = 鳳凰角色，翅膀展開幻影 ~250px wingspan）

`playComicBurst` helper 暫保留（其他 7 隻仍 call 中），等系列 #223-#227 都重做完再 cleanup chore 刪除。

純視覺重做 — 不動 attackTimeline / personality / damage 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 加 1 個 phoenix Graphics block + 移除 1 個 call

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts:539-597`](src/screens/SpiritAttackChoreographer.ts#L539) `_sigDualFireball` 結構
2. 確認 line 575-576 `playComicBurst(stage, tp.x, tp.y, color)` (chore #FX-BURST 加入)
3. 確認 line 559-588 launchPromises block + line 590-593 bloom 處理
4. 確認 `applyGlow` / `removeFilter` 從 GlowWrapper 仍可用

---

## 3. Task

### Single commit — 朱鸞 phoenix wings climax + remove generic comic burst

#### 3a. 移除通用 comic burst call

`src/screens/SpiritAttackChoreographer.ts` line 575-576：

當前：
```ts
    // chore #FX-BURST: comic burst at impact
    playComicBurst(stage, tp.x, tp.y, color);

    // Impact burst
    const burst = new Graphics().circle(0, 0, 22).fill({ color, alpha: 0.72 });
```

改成：
```ts
    // chore #222: removed generic comic burst — replaced by phoenix-themed climax (see top of fn)

    // Impact burst (existing — small fireball impact effect)
    const burst = new Graphics().circle(0, 0, 22).fill({ color, alpha: 0.72 });
```

> 純刪 2 行（comment + call），保留下面的既有 fireball impact burst（小圓 scale up）。

#### 3b. 加入鳳凰展翼大幻影 (fire-and-forget)

`src/screens/SpiritAttackChoreographer.ts` `_sigDualFireball` 內，**Phase 2 launch 開始前**（line 559 `const launchMs = ...` 之後，line 561 `const launchPromises = ...` 之前）插入：

```ts
  // chore #222: 鳳凰展翼大幻影 — phoenix wings spread climax at target row centre
  // Programmatic Graphics — body + 2 fan-shape wings + tail flame, ~250px wingspan.
  // Fire-and-forget; overlaps with fireball launch + outlasts impact burst.
  {
    const phoenixCx = (targets[0].x + targets[targets.length - 1].x) / 2;
    const phoenixCy = targets[0].y - 50;
    const PHX_BODY  = 0xff8a6a;
    const PHX_EDGE  = 0xffd37a;

    const phoenix = new Graphics();

    // Body — vertical ellipse (head/torso)
    phoenix.ellipse(0, 0, 16, 28).fill({ color: PHX_BODY, alpha: 0.85 });
    phoenix.ellipse(0, 0, 16, 28).stroke({ width: 2, color: PHX_EDGE, alpha: 1 });

    // Left wing — fan polygon sweeping out + up
    const leftPath: number[] = [-6, -8];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = Math.PI * (0.5 + t * 0.5);   // 90° → 180° sweep
      const r = 110 + Math.sin(t * Math.PI) * 30;
      leftPath.push(Math.cos(angle) * r, Math.sin(angle) * r * 0.6 - 30);
    }
    leftPath.push(-12, 12);     // close near body bottom
    phoenix.poly(leftPath).fill({ color: PHX_BODY, alpha: 0.65 });
    phoenix.poly(leftPath).stroke({ width: 2, color: PHX_EDGE, alpha: 0.9 });

    // Right wing — mirror
    const rightPath: number[] = [6, -8];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const angle = -t * Math.PI * 0.5;          // 0° → -90° sweep
      const r = 110 + Math.sin(t * Math.PI) * 30;
      rightPath.push(Math.cos(angle) * r, Math.sin(angle) * r * 0.6 - 30);
    }
    rightPath.push(12, 12);
    phoenix.poly(rightPath).fill({ color: PHX_BODY, alpha: 0.65 });
    phoenix.poly(rightPath).stroke({ width: 2, color: PHX_EDGE, alpha: 0.9 });

    // Tail — 3 flame strokes pointing down
    phoenix.moveTo(-9, 28).lineTo(-4, 60).lineTo(0, 38).lineTo(4, 60).lineTo(9, 28)
           .fill({ color: PHX_BODY, alpha: 0.7 });

    phoenix.x = phoenixCx;
    phoenix.y = phoenixCy;
    phoenix.alpha = 0;
    phoenix.scale.set(0.3);
    stage.addChild(phoenix);

    const phoenixGlow = applyGlow(phoenix, PHX_EDGE, 5, 22);

    // Pulse-in 240ms: scale 0.3→1.4, alpha 0→1
    void tween(240, p => {
      phoenix.alpha = p;
      phoenix.scale.set(0.3 + 1.1 * p);
    }, Easings.easeOut).then(async () => {
      // Settle 100ms: scale 1.4→1.0
      await tween(100, p => { phoenix.scale.set(1.4 - 0.4 * p); }, Easings.easeOut);
      // Hold + fade 280ms: alpha 1→0
      await tween(280, p => { phoenix.alpha = 1 - p; }, Easings.easeIn);
      removeFilter(phoenix, phoenixGlow);
      phoenix.destroy();
    });
  }
```

> 視覺：朱鸞 personality color 0xff8a6a 主體 + 0xffd37a 金邊。Wingspan 直徑 ~250px (110×2 + body 16) 落在 targets 中央上方 50px，跟 BAM 截圖 size 接近。
>
> 三段動畫共 620ms，蓋過 launch (~145ms) + impact burst (240ms) — 鳳凰幻影是「climax」貫穿整段。

#### 3c. 不動其他

- Phase 1 fireball charge (line 542-557) — 保留
- launchPromises (line 561-588) — 保留（除 3a 改動）
- Phase 3 bloom (line 590-593) — 保留
- Phase 4 screen shake (line 596) — 保留

**Commit**: `feat(chore #222): 朱鸞 dual-fireball — replace generic comic burst with phoenix wings climax (programmatic Graphics ~250px wingspan, fire-and-forget 620ms)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` `_sigDualFireball` 內：
  - 刪 line 575-576 playComicBurst call
  - line 559 後插入 phoenix wings block

**禁止**：
- 動其他 7 個 signature
- 動 `playComicBurst` helper（其他 7 隻仍 call 中，等 #FX-BURST cleanup）
- 動 fireball charge / launch / bloom / shake 邏輯
- 動 BattleScreen / FXPreviewScreen
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "phoenix\|PHX_BODY\|PHX_EDGE" src/screens/SpiritAttackChoreographer.ts` — 應在 `_sigDualFireball` 內
   - `grep "playComicBurst" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應 ≤ 9 (10→9，朱鸞被移除)
   - 其他 7 個 signature 內 `playComicBurst` 仍存在
5. **Preview 驗證**：
   - dev mode 進 picker 按 `3` 朱鸞
   - **不應再看到** 通用白星 comic burst 在 fireball 命中時刻
   - **應看到** 鳳凰展翼大幻影：紅色身體 + 兩翼大張 + 尾焰，從 target 上方 ~250px wingspan 浮現 → pulse + fade
   - 既有 fireball charge + launch + impact circle burst 仍正常
   - 切換其他 7 個 spirit FX 不變（仍有通用 comic burst）
6. **Audit per chore #203 lesson**：grep `playComicBurst` 確認朱鸞已乾淨無此 call

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 1 GIF（鳳凰展翼幻影）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**

---

## 6. 系列進度

| chore | spirit | 狀態 | 下一步 |
|---|---|---|---|
| #220 | 蒼嵐 | ✅ + polish ✅ | （review 是否需更大化）|
| #221 | 珞洛 | ✅ | （review 是否需更大化）|
| FX-BURST | foundation | ✅（生命短暫，per-spirit 重做中）| cleanup |
| **#222** | **朱鸞** | **⏳ this** | |
| #223 | 朝雨 | next | 翠綠巨蟒大張口 |
| #224 | 孟辰璋 | | 龍頭虛影 + 巨大十字劍光 |
| #225 | 寅 | | 寅字虎面圖騰大字 |
| #226 | 玄墨 | | **龜甲六邊形大石** |
| #227 | 凌羽 | | 巨型鳳凰 silhouette |
| cleanup | — | | 移除 playComicBurst helper + 蒼嵐/珞洛 內殘留 call |
