# Sprint 9 · pace-01 — 戰鬥節奏 Sequenced Reveal（轉輪 → 對獎 → 出招 → 算傷害 4 段落）

## 1. Context

PR: **BattleScreen.loop() 既有 line 874-1014 把 reel.spin / highlightWays / fireJackpots / attackFx / damage events 全塞進 `Promise.all(fx)` 平行執行 → 玩家視覺上感受不到「段落感」。本 PR 把這段改成 sequenced await chain，每段間加 configurable delay，明確呈現 4 個戰鬥階段。**

Why: Sprint 8 後 owner 親身試玩 feedback：「**戰鬥的節奏太快，我希望有轉輪 → 對獎 → 出招 → 算傷害，等畫面呈現**」。當前所有 fx 平行播導致大概 0.6-1s 內所有事情擠在一起，玩家無法吸收。改 sequenced 給玩家節奏感（slot juice 核心 — 期待感 / 高潮分離）。

設計：

### 4-stage 節奏（每段時長 + 之間 delay）

| Stage | 內容 | 既有實作 | 新時長 | 段後 delay |
|---|---|---|---|---|
| **1. 轉輪 SPIN** | reel column 旋轉 + 停輪 | 既有 `await this.reel.spin(spin.grid)` | 不動（既有 timing） | **700ms** |
| **2. 對獎 REVEAL** | wayHit highlight + JP particle burst | 既有 `lineFx + jackpotFx` 平行 | 不動（兩個視覺同類，可平行） | **400ms** |
| **3. 出招 ATTACK** | Spirit signature attack 動畫 | 既有 `attackFx` | 不動 | **300ms** |
| **4. 算傷害 DAMAGE** | HP drain + damage number floats | 既有 `playDamageEvents` | 不動 | **300ms** |

總增加：700 + 400 + 300 + 300 = **1700ms / round**。當前 ~3-5min match 變 ~5-7min — owner 反映「太快」，這個 trade-off 接受。

### 不動的 timing

- reel.spin 內部時長（既有）
- highlightWays.pulseWay 330ms（d-06）
- attackTimeline 5-phase（既有 SpiritAttackChoreographer）
- HP tween（既有 cascadeWallet 風）

只在**這些 await 之間插 delay()**，不改任何 effect 內部 timing。

### 可調整 const

class 內 static readonly 集中管理：

```ts
private static readonly PACE_AFTER_REEL_STOP    = 700;   // 轉輪停 → 對獎
private static readonly PACE_AFTER_REVEAL       = 400;   // 對獎 → 出招
private static readonly PACE_AFTER_ATTACK       = 300;   // 出招 → 傷害
private static readonly PACE_AFTER_DAMAGE       = 300;   // 傷害 → 下一回合
```

便於後續 tune（先用這組，sim 不影響、preview 微調即可）。

### Free Spin / JP / BigWin 期間的處理

- **Free Spin 期間**：節奏**不縮短**（free spin 是高潮場，慢更有 ceremony 感）
- **JP ceremony**：本身已是 await playJackpotCeremony 5s，與本 PR 改動互補不衝突
- **BigWin / MegaWin**：既有 await playBigWinCeremony 在 damage 之後，本 PR 不動

### 視覺 sanity 確認點

- reel 停下後玩家有 0.7s 看清結果（vs 現在 0s 直接同時 highlight）
- highlightWays 結束後 0.4s 看清楚「贏了哪幾條 way」（vs 現在馬上接 attack 蓋掉）
- attack 結束後 0.3s 看招式 FX 餘韻（vs 現在馬上扣 HP）

---

## Skills suggested for this PR

- **`incremental-implementation`** — 1 PR 但**1 個 commit 就好**（純 timing 改動，沒邏輯分裂可能）。改完先 build 過、preview 玩 1 場確認節奏感、再 push。
- **`frontend-ui-engineering`** — 動 await chain 順序時要小心**不打破既有 fx 觸發路徑**（例如 attackFx 內部會觸發 spirit signature `_sigDragonDualSlash` 等 — 這些不能變動 timing）。本 PR **只動 BattleScreen.loop() 的 4 個 await 之間的 delay**，不動 attackFx 內部。
- **`code-simplification`** — 既有 `const fx: Promise<void>[] = [lineFx, jackpotFx, attackFx]` + push damage events + Promise.all 結構是「平行所有 fx」。本 PR 改成 sequential await chain，**結構變清晰但行數可能略增**，這是合理 trade-off。

---

## 2. Spec drift check (P6)

1. `mempalace_search "battle pacing sequenced reveal feedback Sprint 9 pace-01"`
2. 確認 BattleScreen.ts line 874-1014 結構（spin → fx 構建 → Promise.all）
3. 確認 `tween` 系統有 `delay(ms): Promise<void>` helper（既有，r-04 / j-04 / k-04 都用過）
4. 確認 sim-rtp.mjs 不依賴 BattleScreen pacing（**已知不依賴** — sim 走 SlotEngine pure path）

## 3. Task

### 3a. 加 timing 常數

class 上方（near line ~85 fields 區）：

```ts
// ── pace-01: Sequenced reveal timing (轉輪 → 對獎 → 出招 → 算傷害) ──
private static readonly PACE_AFTER_REEL_STOP = 700;
private static readonly PACE_AFTER_REVEAL    = 400;
private static readonly PACE_AFTER_ATTACK    = 300;
private static readonly PACE_AFTER_DAMAGE    = 300;
```

### 3b. 改寫 loop() line ~874-1014 區段

**既有結構（簡化）**：

```ts
await this.reel.spin(spin.grid);
this.playWinTierSfx(...);
const lineFx    = this.reel.highlightWays(...);
const jackpotFx = this.fireJackpots(...);
const attackFx  = this.playAttackAnimations(...);
// ... lots of dmg calc / accumulators ...
const fx: Promise<void>[] = [lineFx, jackpotFx, attackFx];
if (eventsOnB.length) fx.push(this.playDamageEvents(eventsOnB, 'B'));
if (eventsOnA.length) fx.push(this.playDamageEvents(eventsOnA, 'A'));
await Promise.all(fx);
```

**改成 sequenced**：

```ts
// Stage 1: 轉輪 SPIN (既有)
await this.reel.spin(spin.grid);
if (!this.running) return;
this.playWinTierSfx(spin.sideA.wayHits, spin.sideB.wayHits);

// Pace gap before REVEAL (let player see stopped reel)
await delay(BattleScreen.PACE_AFTER_REEL_STOP);

// Stage 2: 對獎 REVEAL — wayHit highlight + JP particle burst (parallel — same conceptual stage)
await Promise.all([
  this.reel.highlightWays(spin.sideA.wayHits, spin.sideB.wayHits),
  this.fireJackpots(spin.sideA.wayHits, spin.sideB.wayHits),
]);

// ... 既有 dmg 計算 / accumulator block 維持原位 ...
// (Resonance / Dragon / Streak / wallet credit / Underdog / consecutive miss / streak update / overkill state)
// ↑ 這段純計算，不產生視覺，可放在 reveal 之後 attack 之前都 OK
//   建議放在 await Promise.all([reveal]) 之後、attack 之前 — 數值在 attack 動畫前算完，attack/damage 用最終值

// Pace gap before ATTACK
await delay(BattleScreen.PACE_AFTER_REVEAL);

// Stage 3: 出招 ATTACK — spirit signatures
await this.playAttackAnimations(spin.sideA.wayHits, spin.sideB.wayHits);

// Pace gap before DAMAGE
await delay(BattleScreen.PACE_AFTER_ATTACK);

// Stage 4: 算傷害 DAMAGE — distribute + HP drain animations
const eventsOnB = dmgA > 0 ? distributeDamage(this.formationB, dmgA, 'A') : [];
const eventsOnA = dmgB > 0 ? distributeDamage(this.formationA, dmgB, 'B') : [];

// Phoenix coin-on-kill (既有，不動)
if (hasAliveOfClan(this.formationA, 'vermilion')) { /* ...既有 phoenix coin... */ }
if (hasAliveOfClan(this.formationB, 'vermilion')) { /* ...既有... */ }

const dmgFx: Promise<void>[] = [];
if (eventsOnB.length) dmgFx.push(this.playDamageEvents(eventsOnB, 'B'));
if (eventsOnA.length) dmgFx.push(this.playDamageEvents(eventsOnA, 'A'));
await Promise.all(dmgFx);

// Pace gap before next round
await delay(BattleScreen.PACE_AFTER_DAMAGE);

// ... 既有 Curse proc / Free Spin decrement / etc 維持原位 ...
```

**注意**：原 line 1014 之前有 dmg 計算邏輯（Resonance / Dragon / Streak / wallet / Underdog / consecutive-miss / streak update / overkill state） — 這段是純數值計算，**可放在 stage 2 對獎之後、stage 3 出招之前**（執行時序合理：對完獎才知道 wayHits 怎麼算，算完數值才能 attack 動畫顯示對的傷害數字）。executor 自己判斷最佳放置位置，建議放在 reveal Promise.all 結束之後、`await delay(PACE_AFTER_REVEAL)` 之前。

### 3c. 確認 distributeDamage 移位影響

既有 distributeDamage 在 Promise.all 之前計算 eventsOnA / eventsOnB（line ~1007-1009）。**本 PR 把 distributeDamage 移到 stage 4 內**（attack 動畫播完後才算）— 邏輯上是「攻擊命中才扣血」更自然。但要確認：
- Phoenix coin-on-kill 邏輯（line ~1018-1042 既有）依賴 events 結果 → 移到 distributeDamage 之後即可
- Overkill tiebreaker 用的 `lastPreHpA / lastPreHpB / lastDmgA / lastDmgB` 紀錄是在 distributeDamage **之前**取的（既有 line ~1003-1006），這個位置**不變**

executor 細看現行 line 區段並調整。

### 3d. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔（loop() 內 line ~874-1014 重排 + 4 個 timing 常數）

**禁止**：
- `src/systems/` 任何檔（SlotEngine / DamageDistributor 不動）
- `src/screens/SlotReel.ts`（reel.spin / highlightWays 內部 timing 不動）
- `src/screens/SpiritAttackChoreographer.ts`（attack 內部不動）
- `src/fx/JackpotCeremony.ts` / `BigWinCeremony.ts` / `NearWinTeaser.ts`（不動）
- `scripts/sim-rtp.mjs`（純 timing PR，不影響 sim）
- DesignTokens / SymbolsConfig / SPEC.md
- 加新 asset
- 改 v-01 / v-02 / v-03 / res-01 範疇的東西

## 4. DoD

1. `npm run build` 過
2. **1 commit**（純 timing 改動，per `incremental-implementation` 不需多 commit）
3. push + PR URL
4. **Preview 驗證（必做）**：
   - 進 Battle，玩 1 場（5-10 round），主觀感受 4 段落感
   - 觀察點：
     1. reel 停下後**有看到清楚的停輪畫面**（700ms）
     2. wayHit highlight 結束後**有看到亮框餘韻**（400ms）
     3. spirit attack 結束後**有看到 FX 殘留**（300ms）
     4. HP drain 完**有 0.3s 喘息**才下回合
   - 若任何一段感覺**仍太快**，flag specific stage + 建議延長值（e.g. PACE_AFTER_REEL_STOP 700 → 900）
   - 若任何一段感覺**太慢**（像 5min match 變 10min），同 flag
5. 一場完整對戰**總時長**估算（粗估即可）— 預期從 ~3-5min 變 ~5-7min

## 5. Handoff

- PR URL
- 1 行摘要
- 4 段落的主觀感受（每段「OK / 太快 / 太慢」三選一）
- 一場對戰總時長變動觀察
- 是否有破壞既有 fx 觸發路徑（任何 spirit / JP / Curse / FreeSpin ceremony 不正常播放）— 預期 0
- Spec deviations：預期 0
