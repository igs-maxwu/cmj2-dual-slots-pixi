# Chore #FX-BURST — 加入漫畫式爆破 helper + 套用 8 隻 signature（FX 升級 baseline）

## 1. Context

Owner 提醒 (2026-05-06)：「請記得我要每隻都改成這種大又明顯的動畫效果」+ 附 3 張螢幕截圖：受擊側出現**畫面 30% 大小的白光尖角爆破**（comic POW! 風）。

### 現況分析

chore #220 蒼嵐 X 烙印（70px arm = 140px 直徑）— 對 owner 來說**還不夠大**。
chore #221 珞洛 speed lines + 三層虎爪 + 6 顆塵粒 — **太收斂**，沒有「BAM!」感。

owner 期待：每隻 spirit fire-impact 瞬間，受擊位置出現 ~250-280px 直徑的**白光 + 主色尖角**爆破，視覺上立刻「打到了」的衝擊感。

### Fix 策略

**Foundation chore**：
1. 在 SpiritAttackChoreographer.ts 寫 `playComicBurst(stage, x, y, color)` helper — 16 點尖角 star polygon (outer R 130 / inner R 50)，白心 + 主色 6px 描邊，scale 0.3→1.4→1.1 + alpha 0→1→0 共 380ms
2. 8 個 signature function 在 fire-impact 時各 call 一次 `playComicBurst` 於 target 位置（多 target 時用 first/main target）
3. 既有 character flair（X-brand / dash / fireball / 等）保留 — comic burst 是疊加 layer，不是取代

純視覺加強 — 不動 Phase 1-5 結構、personality config、damage 邏輯。

### 之後的計畫

完成本 chore 後 8 隻 signature 都有「大又明顯」基礎爆破。後續 #222-#227 per-spirit 個性 flair 在這基礎上疊：
- #222 朱鸞: 鳳凰展翼幻影
- #223 朝雨: 巨大蛇眼凝視
- #224 孟辰璋: 龍頭虛影
- #225 寅: 寅字虎面圖騰
- #226 玄墨: **龜甲六邊形大石**
- #227 凌羽: 火焰箭尾貫穿線 + 鳳凰羽光

並 backfill 蒼嵐(chore #220) / 珞洛 (chore #221) 因本 chore 已加大爆破，現有 X-brand / claw 保留為輔助 layer。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 加 1 helper + 8 處 1-line 呼叫

---

## 2. Spec drift check (P6)

1. 確認 [`SpiritAttackChoreographer.ts`](src/screens/SpiritAttackChoreographer.ts) 結構 — 8 個 `_sig*` function (line 267~)
2. 確認 helper section 在 file 上半部（~line 21+），可放新 `playComicBurst`
3. 確認 8 signature function 位置：
   - `_sigLightningXCross` line 267
   - `_sigTripleDash` line 348
   - `_sigDualFireball` line ~410+
   - `_sigPythonSummon` line ~480+
   - `_sigDragonDualSlash` line ~550+
   - `_sigTigerFistCombo` line ~620+
   - `_sigTortoiseHammerSmash` line ~720+
   - `_sigPhoenixFlameArrow` line ~830+
4. 確認 chore #FX-PICK / clash override / placeholder spirit 在 FXPreviewScreen 可看到 8 個 signature

---

## 3. Task

### Single commit — Comic burst foundation + apply 8x

#### 3a. 加入 `playComicBurst` helper

`src/screens/SpiritAttackChoreographer.ts` 在現有 helper section 之後（建議放在 `_makeFxSprite` helper 之下，~line 38 之後 / signature types section 之上）：

```ts
/**
 * chore #FX-BURST: comic-style "BAM!" impact burst.
 *
 * Draws a 16-point jagged starburst polygon at (x, y):
 * - White core (alpha 0.95) for screen-dominant pop
 * - Coloured 6px stroke (spirit's particleColor) for character flavour
 *
 * Animation (380ms total):
 * - Pulse-in 180ms: scale 0.3 → 1.4, alpha 0 → 1
 * - Settle 80ms: scale 1.4 → 1.1
 * - Fade 120ms: alpha 1 → 0 (scale stays 1.1)
 *
 * Peak visual diameter ≈ 260px. Fire-and-forget (caller does not await).
 *
 * @param stage  Container to add burst to
 * @param x      Burst centre X (in stage coords)
 * @param y      Burst centre Y
 * @param color  Stroke colour (typically personality.particleColor)
 * @param scale  Optional size multiplier (default 1.0)
 */
function playComicBurst(stage: Container, x: number, y: number, color: number, scale: number = 1.0): void {
  const POINTS = 16;          // alternating outer/inner = 16 vertices
  const OUTER_R = 130 * scale;
  const INNER_R = 50 * scale;
  const STROKE_W = 6 * scale;

  const burst = new Graphics();
  // Build star polygon path
  for (let i = 0; i < POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2 - Math.PI / 2;   // start pointing up
    const r = i % 2 === 0 ? OUTER_R : INNER_R;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) burst.moveTo(px, py);
    else         burst.lineTo(px, py);
  }
  burst.closePath();
  burst.fill({ color: 0xffffff, alpha: 0.95 });
  burst.stroke({ width: STROKE_W, color, alpha: 1 });

  burst.x = x;
  burst.y = y;
  burst.alpha = 0;
  burst.scale.set(0.3);
  stage.addChild(burst);

  // Pulse-in 180ms
  void tween(180, p => {
    burst.alpha = p;
    burst.scale.set(0.3 + 1.1 * p);     // 0.3 → 1.4
  }, Easings.easeOut).then(async () => {
    // Settle 80ms
    await tween(80, p => {
      burst.scale.set(1.4 - 0.3 * p);    // 1.4 → 1.1
    }, Easings.easeOut);
    // Fade 120ms
    await tween(120, p => {
      burst.alpha = 1 - p;
    }, Easings.easeIn);
    burst.destroy();
  });
}
```

#### 3b. 套用到 8 個 signature function

每個 signature function 在 **fire-impact 時刻**插入一行 `playComicBurst(...)` call。位置：

##### 蒼嵐 `_sigLightningXCross` (line 267-)
在 line 277 (slashGlow) **之前** 插入（fire 開始瞬間）：
```ts
  // chore #FX-BURST: comic burst at clash centre
  playComicBurst(stage, cx, cy, color);
```

##### 珞洛 `_sigTripleDash` (line 348-)
**每個 dash 命中時**都觸發。在 chore #221 dust burst block **之前**（impact 時刻）：
```ts
    // chore #FX-BURST: comic burst at impact
    playComicBurst(stage, tp.x, tp.y, color, 0.85);   // slightly smaller — 3 hits per attack
```

> scale 0.85 = 3 個夠連發但不會搶 final 4-radial burst 戲份。

##### 朱鸞 `_sigDualFireball`
找 fire-impact moment（fireball 命中 target 處），加：
```ts
    playComicBurst(stage, tp.x, tp.y, color);
```

##### 朝雨 `_sigPythonSummon`
找 python summon 觸發 target 處，加：
```ts
    playComicBurst(stage, tp.x, tp.y, color);
```

##### 孟辰璋 `_sigDragonDualSlash`
找 sword slash impact moment，加：
```ts
    playComicBurst(stage, tp.x, tp.y, color);
```

##### 寅 `_sigTigerFistCombo`
**每個 punch 命中**加：
```ts
    playComicBurst(stage, tp.x, tp.y, color, 0.85);
```

##### 玄墨 `_sigTortoiseHammerSmash`
hammer smash 命中時刻，加（**單發大爆破**）：
```ts
    playComicBurst(stage, lastTp.x, lastTp.y, color, 1.2);   // 1.2x scale — 重武器更大爆
```

##### 凌羽 `_sigPhoenixFlameArrow`
arrow impact moment，加：
```ts
    playComicBurst(stage, tp.x, tp.y, color);
```

> 上面的「fire-impact moment」每個 signature 細節不同。executor 應 read 整個 function 找最接近 target/clash 命中的時刻插入。如果 function 已 destroy graphics 過早，新 burst 會在那之後仍 render（fire-and-forget）。

#### 3c. 不動其他

- helper 之外的既有 helpers（_makeFxSprite, _lightningPath 等）保留
- 8 個 signature function 既有邏輯（X-brand / claw / fireball / 等）全部保留
- attackTimeline 主流程不動
- 既有 chore #220 / #221 改動保留
- BattleScreen / FXPreviewScreen 不動（call site 不變）

**Commit**: `feat(chore): playComicBurst helper + apply to 8 signatures (foundation FX baseline — owner reminder 2026-05-06: 大又明顯的動畫效果)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts` — 1 helper + 8 處 single-line call

**禁止**：
- 動 BattleScreen / FXPreviewScreen / FXDevHook
- 動 attackTimeline / Phase 1-5 / personality
- 動 GlowWrapper / FXAtlas / tween / Easings
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "playComicBurst" src/screens/SpiritAttackChoreographer.ts | wc -l` — 應 ≥ 9 (1 declare + 8 call sites)
   - `grep "playComicBurst" src/screens/BattleScreen.ts` — 應為空
   - `grep "playComicBurst" src/screens/FXPreviewScreen.ts` — 應為空（不直接呼叫，透過 attackTimeline）
5. **Preview 驗證 (critical)**：
   - dev mode 進 picker，按 `1-8` 切過 8 個 spirit
   - **每隻 fire-impact 時都應出現「白光 + 主色尖角」大爆破**（直徑 ~260px 占畫面顯眼比例）
   - 蒼嵐: X-brand 旋轉 + comic burst 同時出現
   - 珞洛: 3-dash 各自 comic burst (0.85x) + 既有 claw + dust + speed lines + final 4-radial burst
   - 玄墨: hammer smash 1.2x 大爆破
   - 其他 5 隻 burst 在 target 位置正常顯示
   - BattleScreen 內 spirit 攻擊也有 comic burst（picker 與 game 都用 attackTimeline）

## 5. Handoff

- PR / commit URL
- 1 行摘要 + 8 個 spirit 截圖 / GIF（picker 切換看每隻 burst）
- spec deviations: 0
- Process check：照新 pattern — git 操作串在**單一 Bash call**

---

## 6. orchestrator note — 系列重組

| chore | spirit | 狀態 | 說明 |
|---|---|---|---|
| #220 | 蒼嵐 | ✅ + polish ✅ | X-brand + 旋轉 |
| #221 | 珞洛 | ✅ | speed lines + 三層虎爪 + dust |
| **#FX-BURST** | **all 8** | **⏳ this** | **大爆破 baseline** |
| #222 | 朱鸞 | next | 鳳凰展翼幻影 |
| #223 | 朝雨 | | 巨大蛇眼凝視 |
| #224 | 孟辰璋 | | 龍頭虛影 |
| #225 | 寅 | | 寅字虎面圖騰 |
| #226 | 玄墨 | | 龜甲六邊形大石（owner spec）|
| #227 | 凌羽 | | 火焰箭尾貫穿線 + 鳳凰羽光 |

完成本 chore 後 owner 用 picker 看 8 個 spirit 的「大又明顯」baseline，然後決定 #222 起 per-spirit flair 順序。
