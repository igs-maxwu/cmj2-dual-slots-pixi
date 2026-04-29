# Sprint 13 / fx-02 — Streak multiplier fly-text + JP NT$ fly-in to wallet

## 1. Context

Sprint 13 中段任務（s13-fx-01 已 merged in #159 — Free Spin entry ceremony）。本 PR 升級 2 個機制觸發瞬間的視覺戲劇性：

### 既有狀態
- **M3 Streak**：`streakA/B` counter 累積 → `streakMult(streak)` 倍率 ×1.0/×1.5/×2.0 直接乘 coinA / coinB / dmgA / dmgB（line 1897-1902）。**機制有效但無視覺反饋** — 玩家看不到「現在連勝 ×2 中」
- **M12 JP**：JackpotCeremony 跑完後 `walletA += amount`（直加），數字直接跳到 wallet。**沒過渡動畫**

### 升級目標（純視覺，機制零改動）
1. **Streak multiplier fly-text** — 連勝 streak ≥ 2 時，每 round 結束後從該側 reel 飛出「×1.5」/「×2.0」magic-particle 字 → 軌跡 → 該側 wallet。1.0s ceremony
2. **JP NT$ fly-in** — Jackpot ceremony 結束後，NT$ 數字從畫面中央 trail-fly 進入該側 wallet（替代「直加」）。1.2s ceremony

### Inventory（已驗 grep）
- `public/assets/fx/sos2-fly-multiplier.webp` — multiplier 字符 + 數字 atlas（×1.5 / ×2.0 / ×3.0 frame regions）
- `public/assets/fx/sos2-particles.webp` — 粒子軌跡 (chore d-04 已預載)
- 既 j-04 JackpotCeremony 模組可借 pattern

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（StreakFlyText / JackpotFlyIn / wire-up）
- **`source-driven-development`** — 沿用 j-04 既有 ceremony pattern（`Promise<void>` + ticker callback + `destroy({children:true})`）
- **`debugging-and-error-recovery`** — ticker leak / Container destroy 雙保險

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 13 streak multiplier fly text JP fly-in inventory sos2-fly-multiplier"`
2. `mempalace_search "JackpotCeremony pattern j-04 ticker cleanup"`
3. 確認 既有 SPEC §15 M3 Streak（streakMult 表 1.0/1.5/2.0/3.0）+ M12 JP `jackpotPools.grand/major/minor`
4. 確認 既 j-04 `JackpotCeremony.ts` 是 `playJackpotCeremony(parent, tier, amount): Promise<void>` 還是 instance class（影響 fly-in 接點）
5. 確認 既 chore #150 `streakA/B` counter 更新點（line 1953-1956）

---

## 3. Task

### 3a. Commit 1 — 新模組 StreakFlyText.ts

**新檔案**：`src/fx/StreakFlyText.ts`

API：
```ts
export async function playStreakFlyText(
  parent: Container,
  multiplier: number,        // 1.5 / 2.0 / 3.0
  startX: number, startY: number,   // 起點（reel 該側中心）
  endX: number, endY: number        // 終點（wallet 文字位置）
): Promise<void>
```

Implementation 流程：
1. Container 加到 parent
2. 創建 multiplier text — `goldText(`×${multiplier.toFixed(1)}`, { fontSize: 36, withShadow: true })` + GlowFilter
3. Stage 1 (0.0-0.2s): scale 0 → 1.2 + alpha 0 → 1（pop-in）at start position
4. Stage 2 (0.2-0.7s): scale 1.2 → 0.9 + 軌跡 from (startX,startY) → (endX,endY)，使用 `ease: cubicBezier(0.4, 0.0, 0.2, 1)` smooth fly。路徑上每 50ms spawn 一個 sos2-particles sprite trail（淡出 300ms）
5. Stage 3 (0.7-1.0s): scale 0.9 → 0 + alpha 1 → 0（fade at endpoint，模擬被 wallet 吸收）
6. Cleanup: `mainContainer.destroy({ children: true })`，所有 ticker callback `ticker.remove(fn)`

**Use existing tween util**：`import { tween, delay, Easings } from '@/systems/tween'`

**Verify**：1.0s 內完整跑完，無 ticker leak（DevTools Performance 觀察 listener count）

**Commit 1**: `feat(fx): StreakFlyText module — multiplier×N.N fly from reel to wallet`

---

### 3b. Commit 2 — 新模組 JackpotFlyIn.ts

**新檔案**：`src/fx/JackpotFlyIn.ts`

API：
```ts
export async function playJackpotFlyIn(
  parent: Container,
  amount: number,           // NT$ 金額
  startX: number, startY: number,    // 起點（畫面中央 — JP marquee 中心）
  endX: number, endY: number         // 終點（該側 wallet）
): Promise<void>
```

Implementation：
1. Container at start position
2. 數字 text：`goldText(`+${amount.toLocaleString()}`, { fontSize: 48, withShadow: true })` + 強 GlowFilter
3. Stage 1 (0.0-0.3s): scale 0 → 1.4 + alpha 0 → 1（dramatic pop）+ 短停在中央
4. Stage 2 (0.3-1.0s): 軌跡 fly + scale 1.4 → 0.7。**長軌跡 trail**：每 30ms spawn sos2-particles sprite (alpha 0.8 → 0 over 400ms)
5. Stage 3 (1.0-1.2s): 進終點時 scale → 0.3 + alpha → 0（被 wallet 吃進去）
6. Cleanup 同 j-04 pattern

**Critical**：1.2s 內完整跑完。**ticker callback 必須 `ticker.remove(fn)` 清** — 失敗會 leak。

**Commit 2**: `feat(fx): JackpotFlyIn module — NT$ trail-fly from center to wallet`

---

### 3c. Commit 3 — Wire-up in BattleScreen.ts

#### 3c-1. Streak fly trigger

`loop()` 內 line 1897-1902 附近（`streakMult` apply 後）：

```ts
// Existing:
coinA = Math.floor(coinA * streakMult(this.streakA));
coinB = Math.floor(coinB * streakMult(this.streakB));
if (dmgA > 0) dmgA = Math.floor(dmgA * streakMult(this.streakA));
if (dmgB > 0) dmgB = Math.floor(dmgB * streakMult(this.streakB));

// NEW (s13-fx-02):
const multA = streakMult(this.streakA);
const multB = streakMult(this.streakB);
const flyPromises: Promise<void>[] = [];
if (multA > 1.0) {
  flyPromises.push(playStreakFlyText(
    this.fxLayer,
    multA,
    CANVAS_WIDTH * 0.30, REEL_TOP_Y + REEL_H / 2,   // A side reel center
    CANVAS_WIDTH * 0.20, WALLET_A_Y                  // A wallet position
  ));
}
if (multB > 1.0) {
  flyPromises.push(playStreakFlyText(
    this.fxLayer,
    multB,
    CANVAS_WIDTH * 0.70, REEL_TOP_Y + REEL_H / 2,
    CANVAS_WIDTH * 0.80, WALLET_B_Y
  ));
}
// Don't await — fire-and-forget so coin cascade + battle continues
// (但若 owner 想 await 等動畫跑完才下一 round，改用 await Promise.all(flyPromises);)
```

> **設計選擇**：fire-and-forget vs await。預設 **fire-and-forget**（不阻 round loop），讓 streak fly 跟 win cascade 同時跑。若視覺評估後 fire-and-forget 太雜亂，改 `await Promise.all(flyPromises)`。Executor 用 fire-and-forget 即可，handoff 註明可調。

#### 3c-2. JP fly-in trigger

當前 JP win 流程（grep `jackpotPools.grand` / `playJackpotCeremony` 找 trigger 點）：

當前可能是：
```ts
await playJackpotCeremony(this.fxLayer, tier, amount);
this.walletA += amount;
this.refresh();
```

改成：
```ts
await playJackpotCeremony(this.fxLayer, tier, amount);
// NEW (s13-fx-02): NT$ trail-fly from center to winning side wallet
const winnerSide = ... // existing logic determines A or B winner
const endX = winnerSide === 'A' ? CANVAS_WIDTH * 0.20 : CANVAS_WIDTH * 0.80;
const endY = winnerSide === 'A' ? WALLET_A_Y : WALLET_B_Y;
await playJackpotFlyIn(
  this.fxLayer,
  amount,
  CANVAS_WIDTH / 2, JP_MARQUEE_Y + JP_MARQUEE_H / 2,   // start at JP marquee center
  endX, endY
);
this.walletA += winnerSide === 'A' ? amount : 0;
this.walletB += winnerSide === 'B' ? amount : 0;
this.refresh();
```

> 確切位置 + winner 邏輯 by executor grep 既有 JP code 確認。**不改既 JP win 判定邏輯**，只插 fly-in await。

**Commit 3**: `feat(fx): wire StreakFlyText after streak mult + JackpotFlyIn before wallet credit`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/fx/StreakFlyText.ts`（NEW）
- `src/fx/JackpotFlyIn.ts`（NEW）
- `src/screens/BattleScreen.ts`（import + 2 trigger 點 wire-up）

**禁止**：
- 動 SPEC §15 機制（streakMult 表 / JP win 判定 / wallet credit 計算）
- 動 j-04 JackpotCeremony 既有檔案
- 動 SymbolsConfig / SlotEngine / DamageDistributor / JackpotPool
- 動 createFormation / NineGrid layout
- 加新 asset（用既有 sos2-fly-multiplier + sos2-particles）
- 動 streakA/B counter 計算邏輯
- 改 main.ts / SPEC.md / sim-rtp.mjs / DesignTokens / ScreenManager
- 改 ResultScreen / DraftScreen / LoadingScreen
- 改 chore #162 AUTO 流程（fly-text 不該 block AUTO countdown）

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 連勝 ≥ 2 round（streak ≥ 2）→ 該側看到「×1.5」/「×2.0」金字 fly from reel center → wallet（1.0s）
   - 連勝 ≥ 5 round（streak ≥ 5）→ 看到「×3.0」字（最高倍率）
   - JP win（demo mode 第 4 spin trigger）→ JackpotCeremony 跑完後看到 NT$ amount 數字飛入 wallet（1.2s）
   - DevTools Performance：fly 動畫期間 FPS ≥ 50
   - 無 ticker leak — pause 5s 後 listener count 不增長
   - AUTO 跑時 streak fly 不阻塞 spin chain
5. 截圖 2 張：streak fly mid-flight + JP fly-in mid-flight

## 5. Handoff

- PR URL
- 1 行摘要
- 2 張截圖
- 實際 streak fly 起點 / 終點座標（驗證視覺軌跡 OK）
- JP fly-in 1.2s 是否合適（or 太快/太慢）
- fire-and-forget 視覺感受 OK 還是改 await（streak）
- DevTools FPS / listener count 觀察結果
- Spec deviations：預期 0
- Sprint 13 進度：fx-01 ✓ → fx-02 ✓ → fx-03 待
