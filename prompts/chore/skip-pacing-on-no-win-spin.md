# Chore #216 — 沒中獎 spin 跳過 pacing 直接下一輪（快感優化）

## 1. Context

Owner 試玩 2026-05-06 反映：「如果沒中獎，馬上開始轉下一個盤面，不必等寫下面的 log」。

### 現況
[BattleScreen spinLoop](src/screens/BattleScreen.ts#L1875) 每 round 不論有無中獎，都跑同樣 5 個 pace delays：

| Delay | 位置 | 時長 |
|---|---|---|
| `PACE_AFTER_REEL_STOP` | line 1875（停輪→對獎）| 700ms |
| `PACE_AFTER_REVEAL` | line 2054（對獎→出招）| 400ms |
| `PACE_AFTER_ATTACK` | line 2060（出招→傷害）| 300ms |
| `PACE_AFTER_DAMAGE` | line 2093（傷害→下一輪）| 300ms |
| `ROUND_GAP_MS` | line 2175（round 間 gap）| 500ms |
| **總計** | — | **2200ms** |

沒中獎時：highlightWays/playAttackAnimations/dmg events 全 no-op（空陣列），但 5 個 delay 仍照跑 → AUTO 連 spin 體感慢。

### Owner 決策（2026-05-06）
沒中獎 = 跳過 5 個 pace delays + 跳過 log line push（`R## A→B dmg 0 (0 ways)` 純 0 噪音）→ 直接下一 spin。

### 例外保留：Curse Proc
chore #209 詛咒發動 banner + 紫色 dmg 在 curseStack ≥ 3 時觸發，**獨立於 wayHits**。即使沒中獎，curse 仍可能 proc。Curse proc 那一輪需保留 pacing + log（banner 1.2s + dmg events 才看得清）。

→ Skip 條件 = `noWin && !curseProcced`。

純 timing 優化 — 不動 SlotEngine / win 偵測 / damage / curse / JP / BigWin 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用既有 wayHits + curseStack 條件，加 5 個 if-gate

---

## 2. Spec drift check (P6)

1. 確認 [`BattleScreen.ts:1875`](src/screens/BattleScreen.ts#L1875) PACE_AFTER_REEL_STOP delay 仍存
2. 確認 [`BattleScreen.ts:2054, 2060, 2093, 2175`](src/screens/BattleScreen.ts#L2054) 4 個 delay
3. 確認 [`BattleScreen.ts:2156-2160`](src/screens/BattleScreen.ts#L2156) 「R## A→B dmg ... ways」log line
4. 確認 [`BattleScreen.ts:2117-2152`](src/screens/BattleScreen.ts#L2117) curse proc block (chore #209 banner + dmg)
5. 確認 chore #214/#215 已 merged（pulseWay + near-win FX 移除）

---

## 3. Task

### Single commit — Skip pacing + log on no-win-no-curse spins

#### 3a. 算 `hasAnyWin` flag

`src/screens/BattleScreen.ts` 在 spin 計算後（line ~1820 area，spin = this.engine.spin(...) 之後）加：

```ts
// chore #216: skip pacing + log when nothing happened this round
const hasAnyWin = spin.sideA.wayHits.length > 0 || spin.sideB.wayHits.length > 0;
```

> 位置：放在 spin 計算結束、進入 stage 1 delay 之前。確切 line 由 executor 決定（找 `await delay(BattleScreen.PACE_AFTER_REEL_STOP)` 之前最近的 spin 變數可用點）。

#### 3b. Gate 4 個 PACE delays

把 4 個 `await delay(PACE_*)` 包成條件：

`BattleScreen.ts:1875`：
```ts
// before: await delay(BattleScreen.PACE_AFTER_REEL_STOP);
if (hasAnyWin) await delay(BattleScreen.PACE_AFTER_REEL_STOP);
```

`BattleScreen.ts:2054`：
```ts
if (hasAnyWin) await delay(BattleScreen.PACE_AFTER_REVEAL);
```

`BattleScreen.ts:2060`：
```ts
if (hasAnyWin) await delay(BattleScreen.PACE_AFTER_ATTACK);
```

`BattleScreen.ts:2093`：
```ts
if (hasAnyWin) await delay(BattleScreen.PACE_AFTER_DAMAGE);
```

> 4 處 gate 統一用同一個 `hasAnyWin` flag。空 wayHits 時 highlightWays / playAttackAnimations / dmg events 都自然 no-op，所以**跳 delay 不影響執行順序**。

#### 3c. 算 `curseProcced` + gate log push + ROUND_GAP

curse proc block (line 2117-2152) 結束後，需要知道 curse 是否 procced 過。

加 flag：
```ts
let curseProcced = false;

if (this.curseStackA >= 3) {
  // ... existing curseEventsOnA 邏輯 ...
  this.curseStackA = 0;
  curseProcced = true;
}
if (this.curseStackB >= 3) {
  // ... existing curseEventsOnB 邏輯 ...
  this.curseStackB = 0;
  curseProcced = true;
}
```

> 位置：`curseEventsOnA/B` 兩個 if-block 內各加 `curseProcced = true;` 一行（在 stack reset 之後）。

接著 gate log push (line 2154-2160):
```ts
// chore #216: skip log line on dead rounds (no win, no curse) to keep log focused
if (hasAnyWin || curseProcced) {
  const tagA = ratioA < 0.30 ? '↑' : '';
  const tagB = ratioB < 0.30 ? '↑' : '';
  this.logLines.push(
    `R${this.round.toString().padStart(2, '0')}  ` +
    `A→B dmg ${dmgA}${tagA} (${spin.sideA.wayHits.length} ways)   ` +
    `B→A dmg ${dmgB}${tagB} (${spin.sideB.wayHits.length} ways)`,
  );
}
```

> `this.refresh()` (line 2161) **保留** — HP bar / curse HUD / round counter 仍要更新。

最後 gate ROUND_GAP (line 2175):
```ts
// chore #216: skip round gap on dead rounds — go directly to next spin
if (hasAnyWin || curseProcced) {
  await delay(ROUND_GAP_MS);
}
```

#### 3d. 不動其他

- `playWinTierSfx`（line 1873）— SFX 觸發保留（empty wayHits → SFX 內部 no-op）
- `highlightWays` / `playAttackAnimations` / `popDamage` — 既有 no-op 行為保留
- `detectAndAwardJackpot` (line 2096) — 5-reel JP/Wild detect 跟 wayHits 獨立，保留
- `_classifyBigWinTier` (line 2100) — coin=0 → null tier → no-op，保留
- `inFreeSpin` decrement (line 2163-2171) — 保留（FS 模式不論是否中獎都消耗 1 次）
- `refreshFreeSpinOverlay` (line 2172) — 保留
- chore #209 curse banner + dmg events — 保留（在 curseProcced=true 路徑）
- chore #211 curse weight 3 — 不動

### 預期 net 體感

| 情境 | Before | After |
|---|---|---|
| 沒中獎、沒 curse proc | 2200ms 等待 + 噪音 log | **0ms 直接下一輪** |
| 中獎 1+ way | 2200ms 含特效 | 同前（不動）|
| 沒中獎但 curse proc | 2200ms + 1.2s banner | 同前（curse 路徑保留）|

AUTO 25 spins 預計可省下 ~30+ 秒（假設 60% no-win rate × 2.2s × 25）。

**Commit**: `feat(chore): skip pacing + log on no-win-no-curse spins (2.2s saved per dead round; chore #216 owner trial 2026-05-06)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts` —
  - 加 `hasAnyWin` flag 在 spin 計算後
  - 4 處 PACE delays 加 `if (hasAnyWin)` gate
  - 加 `curseProcced` flag + 兩處 set true 在 curseStack >= 3 if-block 內
  - log push + ROUND_GAP 加 `if (hasAnyWin || curseProcced)` gate

**禁止**：
- 動 SlotEngine spin 邏輯
- 動 highlightWays / playAttackAnimations / playDamageEvents 函式內部
- 動 curse proc dmg / banner / chore #209 邏輯
- 動 detectAndAwardJackpot / BigWin classify / Phoenix coin / Streak FlyText
- 動 inFreeSpin decrement / refreshFreeSpinOverlay / refresh()
- 動 PACE_AFTER_* 常數值（700/400/300/300）— 只 gate 不改值
- 動 ROUND_GAP_MS 常數值（500）— 只 gate
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "hasAnyWin\|curseProcced" src/screens/BattleScreen.ts` — 應有 6+ 處（1 declare + 4 PACE gate + 2 log/gap gate + 2 curseProcced=true）
   - `grep -B1 "PACE_AFTER" src/screens/BattleScreen.ts | grep -i "if.*hasAnyWin\|hasAnyWin"` — 4 個 PACE delay 都 gate
   - 4 個 PACE 常數值不動 (700 / 400 / 300 / 300)
   - ROUND_GAP_MS 值不動 (500)
5. **Preview 驗證 critical**：
   - AUTO 25 spins，肉眼確認大量 spin 之間**沒有 2.2s 停頓** — 沒中獎那 spin reel 立刻轉下一個
   - 中獎 spin pacing 仍正常（pulse + attack + damage 都看得到）
   - curse proc 那 spin（curseStack 累到 3）banner + 紫色 dmg + log 仍正常
   - jackpot trigger 仍正常
   - BigWin overlay 仍正常
   - HP bar / round counter / wallet 仍正確更新
6. **Audit per chore #203 lesson**：grep 全 codebase 確認沒其他 PACE_AFTER_* / ROUND_GAP_MS 用法漏 gate

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 個 GIF 或描述 — AUTO 連 spin 流暢度對比
- spec deviations: 1 (chore pace-01 PACE_* 5 個 delay 在 no-win-no-curse 條件下跳過 — owner approved 2026-05-06)
- Process check：照新 pattern 把 `git checkout feat/<slug>` + `add` + `commit` + `push -u` 串在**單一 Bash call**
