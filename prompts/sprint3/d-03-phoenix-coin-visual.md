# Sprint 3 D · 03 — Phoenix coin-on-kill 視覺（Coin burst from dying unit → attacker wallet）

> **Note on d-02 skip**: 原 roadmap d-02「Symbol reskin」假設 reel 有幾何 Graphics 占位，但 Sprint 1 已放上 Midjourney spirit portraits — 沒有 placeholder 要換。`public/assets/symbols/gems/` 5 顆 SOS2 寶石保留，之後 Sprint 5 Resonance pip / Sprint 6 JP/Scatter 再派用。本 PR 直接跳到 d-03。

## 1. Context

PR: **Sprint 3 D · 朱雀 coin-on-kill 加上視覺 feedback — 被殺單位位置噴出金幣，拋物線飛向攻擊方 wallet，600~800ms**

Why: Sprint 3B b-04（PR #57）只加了 wallet 數字的 coin bonus 邏輯，**玩家看不到為什麼錢會跳**。加上視覺後「朱雀連殺 = 金幣爆炸飛錢包」的爽感才完整，也呼應 SPEC §8「phoenix coin-on-kill」的主題詞「火鳳吐金」。

Source:
- PR #57 b-04 朱雀 passive（邏輯已存在於 `BattleScreen.ts` 第 615-630 行）
- PR #62 d-00 SOS2 資產：`sos2-bigwin.webp` atlas 包含 `Coin/Coin_01` ~ `Coin/Coin_09`（9 個旋轉 frame）
- PR #65 d-01 FXAtlas：`FXAtlas.sprite('sos2-bigwin:Coin/Coin_01')` 可直接拿到 89×89 spin-frame sprite
- 既有 `src/systems/tween.ts` 有 `tween` / `tweenValue` / `Easings` 可用

Base: master HEAD（d-01 merged）
Target: `feat/sprint3d-03-phoenix-coin-visual`

## 2. Spec drift check (P6 — mandatory)

1. `mempalace_search "phoenix coin kill vermilion bonus"` + `"FXAtlas sos2-bigwin Coin"`
2. 確認 `src/fx/FXAtlas.ts` 有 `sprite()` method 與 `clanTint()` helper
3. 確認 `src/screens/BattleScreen.ts` 第 615-630 行附近的 phoenix passive 區塊未被改動
4. `FXAtlas.listRegions('sos2-bigwin')` 執行時期應含 `Coin/Coin_01` ~ `Coin/Coin_09`（atlas parser 若壞會拿不到）
5. 若發現 phoenix 邏輯位置已變動（被 refactor），STOP 回報先對齊

## 3. Task

### 3a. 新增 `playPhoenixCoinBurst` method 到 `BattleScreen.ts`

在既有 phoenix passive 區塊之後、`this.cascadeWallet(...)` 呼叫**之前**，或取代現有單次 cascade 呼叫。簽章：

```ts
/**
 * Phoenix coin-on-kill visual feedback.
 * Spawns `coinCount` spinning gold coins at each `killPos` tile,
 * each coin arcs toward the attacker's wallet label and fades out.
 * Fire-and-forget (non-blocking): caller does NOT await.
 *
 * @param side        attacker side whose wallet receives bonus ('A' | 'B')
 * @param killPositions world-space {x, y} of each killed enemy tile (use this.getFormationUnitWorldPos)
 */
private playPhoenixCoinBurst(side: 'A' | 'B', killPositions: { x: number; y: number }[]): void
```

邏輯：

```ts
private playPhoenixCoinBurst(side: 'A' | 'B', killPositions: { x: number; y: number }[]): void {
  const wallet = side === 'A' ? this.walletTextA : this.walletTextB;
  const target = { x: wallet.x, y: wallet.y };

  const COINS_PER_KILL = 5;        // 5 coins per killed unit
  const FLIGHT_DUR = 700;          // 700ms arc duration
  const SPAWN_JITTER = 80;         // ±40px random spawn spread
  const ROTATION_CYCLE = ['Coin/Coin_01','Coin/Coin_03','Coin/Coin_05','Coin/Coin_07','Coin/Coin_09'];

  for (const pos of killPositions) {
    for (let i = 0; i < COINS_PER_KILL; i++) {
      const key = ROTATION_CYCLE[i % ROTATION_CYCLE.length];
      const coin = FXAtlas.sprite(`sos2-bigwin:${key}`);
      coin.x = pos.x + (Math.random() - 0.5) * SPAWN_JITTER;
      coin.y = pos.y + (Math.random() - 0.5) * SPAWN_JITTER;
      coin.scale.set(0.35);
      coin.alpha = 1;
      coin.zIndex = 500;          // above formations + HP bars
      this.container.addChild(coin);

      // Bezier arc parameters
      const startX = coin.x, startY = coin.y;
      const endX = target.x + (Math.random() - 0.5) * 30;
      const endY = target.y;
      // Control point: midpoint lifted 80-140px for arc feel
      const midX = (startX + endX) / 2;
      const midY = Math.min(startY, endY) - 80 - Math.random() * 60;

      const delayMs = i * 40 + Math.random() * 60;   // stagger fire

      // Arc + scale up + fade out
      tween({
        from: 0, to: 1, duration: FLIGHT_DUR, delay: delayMs,
        easing: Easings.easeOut,
        update: (t: number) => {
          // Quadratic bezier B(t) = (1-t)^2 P0 + 2(1-t)t Ctrl + t^2 P2
          const inv = 1 - t;
          coin.x = inv * inv * startX + 2 * inv * t * midX + t * t * endX;
          coin.y = inv * inv * startY + 2 * inv * t * midY + t * t * endY;
          coin.scale.set(0.35 + 0.35 * t);          // 0.35 → 0.70
          coin.rotation += 0.25;                     // slight continuous spin
          if (t > 0.75) coin.alpha = (1 - t) * 4;   // fade in last 25%
        },
        complete: () => coin.destroy(),
      });
    }
  }
}
```

### 3b. 呼叫接線

改 `BattleScreen.loop()` 第 615-630 行 phoenix passive 區塊：

```ts
// ── Vermilion Phoenix passive: +500 coin per enemy kill + visual burst ──
const PHOENIX_COIN_PER_KILL = 500;

if (hasAliveOfClan(this.formationA, 'vermilion')) {
  const kills = eventsOnB.filter(e => e.died);
  if (kills.length > 0) {
    this.walletA += kills.length * PHOENIX_COIN_PER_KILL * (this.cfg.betA / 100);
    this.cascadeWallet('A');
    const positions = kills.map(e => this.getFormationUnitWorldPos('B', e.slotIndex));
    this.playPhoenixCoinBurst('A', positions);
  }
}
if (hasAliveOfClan(this.formationB, 'vermilion')) {
  const kills = eventsOnA.filter(e => e.died);
  if (kills.length > 0) {
    this.walletB += kills.length * PHOENIX_COIN_PER_KILL * (this.cfg.betB / 100);
    this.cascadeWallet('B');
    const positions = kills.map(e => this.getFormationUnitWorldPos('A', e.slotIndex));
    this.playPhoenixCoinBurst('B', positions);
  }
}
```

### 3c. 新增 `getFormationUnitWorldPos` helper（若不存在）

檢查 `BattleScreen.ts` 是否已有類似 method。若無，新增：

```ts
/** World-space {x, y} of the unit at slotIndex in the given formation. */
private getFormationUnitWorldPos(side: 'A' | 'B', slotIndex: number): { x: number; y: number } {
  const grid = side === 'A' ? this.formationContainerA : this.formationContainerB;
  const row = Math.floor(slotIndex / 3);
  const col = slotIndex % 3;
  // Use existing FORMATION_CELL_W / FORMATION_CELL_H constants (grep them in BattleScreen)
  const cellCenterX = grid.x + col * FORMATION_CELL_W + FORMATION_CELL_W / 2;
  const cellCenterY = grid.y + row * FORMATION_CELL_H + FORMATION_CELL_H / 2;
  return { x: cellCenterX, y: cellCenterY };
}
```

**注意**：若 `FORMATION_CELL_W/H` 常數名稱在 BattleScreen.ts 裡叫別的（例如 `CELL_SIZE`、`UNIT_W`），用既有名稱。**不要**新增重複常數。若 `formationContainerA` 也叫別的名（例如 `formationA` 是 grid data 而 container 是 `formationSpritesA`），用既有 Container 欄位名。查現有 `playDamageEvents` method 大概能看到正確 position 計算方式，**優先 reuse 那裡的邏輯**。

### 3d. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts`（新 method + 呼叫接線，淨變動約 +60 行）

**Import**（若尚未）：`FXAtlas` from `@/fx/FXAtlas`

**禁止**：
- `FXAtlas.ts` / `SlotEngine.ts` / `Formation.ts` / `DamageDistributor.ts`
- SPEC.md
- 任何新素材 import（sos2-coins.webp 本 PR 可略過，因為 BigWin atlas 的 Coin_01~09 更漂亮）
- 阻塞 phoenix burst — **必須 fire-and-forget**，不加入 `fx: Promise[]` array，不 await

**若發現 phoenix passive 區塊位置不是第 615 行（檔案已改動），STOP 回報**。

### 3e. §3c 進階（選配，若 >15 行請跳過）

- 金幣落入 wallet 時加個 `+500` 金色 popup
- 播 SFX `AudioManager.playSfx('win-big')`（若存在）或 `'win'`

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- **Fire-and-forget 關鍵**：coin burst 不能擋住既有 HP tween / round gap，否則節奏亂掉
- Coin sprite 建立後記得 `addChild`，tween `complete` 時記得 `destroy()`，否則會 leak（SPEC §6.3 onUnmount 規則）
- zIndex=500 確保蓋過 formation tiles + HP bar（現有元素大多 < 200）
- 若一回合擊殺 5 個 × 5 coins = 25 sprites 同時飛，建議 scale 0.35~0.7 避免畫面太亂
- 編輯 `BattleScreen.ts` ≥ 3 次無法過 build → STOP 回報
- 若 formation 座標查找邏輯與既有 `playDamageEvents` 有衝突，**複用那邊的 pattern**，不要自己算

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：預期 0
- Dependencies：FXAtlas (PR #65) / Phoenix passive (PR #57)
- 是否有做 §3e 進階 popup / SFX
- 確認 coin burst 是 fire-and-forget（不 await）
- 若你發現 `FORMATION_CELL_W` / formation container 欄位名稱與 prompt 描述不符，說明實際用的是什麼
