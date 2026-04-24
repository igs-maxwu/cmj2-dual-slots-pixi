# Sprint 4 · m-01 — RTP Simulation Harness（scripts/sim-rtp.mjs）

## 1. Context

PR: **建立 10k+ rounds 的純 TS sim 腳本，測出 Sprint 3B 4 passive 加完後的真實 RTP / 命中率 / 對戰長度 / passive 觸發率**

Why: Sprint 3 完成後，數學參數（`DEFAULT_TARGET_RTP=97` vs SPEC §15 Base Ways 60% / `DEFAULT_TARGET_DMG=300` vs SPEC 「10 round match」）存在 2 個已知不一致。必須先有實測數字才能決定調哪個。Sprint 4 Track M 的第一站。

Source:
- `prompts/sprint4/MATH-BASELINE.md`（the-actuary 產出的完整規格，本 prompt 是其「Recommendation」章節的執行版）
- `prompts/sprint4/ROADMAP.md`
- 既有 pure TS modules：
  - `src/systems/SlotEngine.ts` — `new SlotEngine().spin(...)`
  - `src/systems/Formation.ts` — `createFormation`, `hasAliveOfClan`, `teamHpTotal`, `isTeamAlive`
  - `src/systems/DamageDistributor.ts` — `distributeDamage`
  - `src/systems/SymbolPool.ts` — `buildFullPool`
  - `src/systems/ScaleCalculator.ts` — `calculateScales`
  - `src/config/SymbolsConfig.ts` — SYMBOLS + DEFAULT_* constants

Base: master HEAD
Target: `feat/sprint4-m-01-sim-harness`

## 2. Spec drift check (P6)

1. `Read prompts/sprint4/MATH-BASELINE.md` 全文
2. 確認 `scripts/` 資料夾存在（已有 `crop-jp-marquee.mjs` + `import-sos2-assets.mjs` 範例）
3. `cat package.json` 確認 `tsx` 在 devDependencies（若無，加 `tsx`）
4. 確認無既有 `scripts/sim-rtp.*`（若有，STOP 回報）

## 3. Task

### 3a. 新增 `scripts/sim-rtp.mjs`（單檔 Node.js ESM）

**執行方式**：`npx tsx scripts/sim-rtp.mjs --rounds 10000 --seed 42 --runs 50 --config symmetric`

**必需實作**：

1. **CLI 參數解析**：
   - `--rounds N`（default 10000）
   - `--seed S`（default 1234）
   - `--runs R`（default 50；連續 R 次 seed=seed..seed+R，aggregate）
   - `--config [symmetric|azure|white|vermilion|black]`（default symmetric，即 `[0,1,2,3,4]`；其餘 clan-homogenous drafts 之後擴充）
   - 不需 yargs 等 lib，用 `process.argv` 解析即可

2. **Mulberry32 seeded PRNG**（self-contained，no npm）：
   ```ts
   function mulberry32(seed: number): () => number {
     let a = seed >>> 0;
     return () => {
       a = (a + 0x6D2B79F5) >>> 0;
       let t = a;
       t = Math.imul(t ^ (t >>> 15), t | 1);
       t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
       return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
     };
   }
   ```

3. **Sim loop（每 round）**：
   ```
   spin = engine.spin(selectedA, selectedB, bet, poolTotalW, coinScaleA, dmgScaleA, coinScaleB, dmgScaleB, fairnessExp, rng)
   
   // Apply game-loop-level passives (NOT in SlotEngine):
   
   // Azure Dragon +20% on 4+ match
   let dmgA = spin.sideA.dmgDealt, dmgB = spin.sideB.dmgDealt
   if (hasAliveOfClan(formationA, 'azure')) {
     for wh of spin.sideA.wayHits:
       if wh.matchCount >= 4 && SYMBOLS[wh.symbolId].clan === 'azure':
         dmgA += Math.floor(wh.rawDmg * 0.2 * bet/100)
   }
   // (same for B)
   
   // Underdog buff
   if teamHpRatioA < 0.30 && dmgA > 0: dmgA = Math.ceil(dmgA * 1.3)
   // (same for B)
   
   // Chip damage floor
   if 3 consecutive 0-way spins: dmgA = max(dmgA, minGuaranteedDmg)
   
   // Distribute (White Tiger passive applied inside by hasAliveOfClan check)
   // Black Tortoise passive applied inside via shieldUsed flag
   eventsOnB = distributeDamage(formationB, dmgA, 'A')
   eventsOnA = distributeDamage(formationA, dmgB, 'B')
   
   // Vermilion Phoenix coin-on-kill
   if (hasAliveOfClan(formationA, 'vermilion')) {
     const kills = eventsOnB.filter(e => e.died).length
     walletA += kills * 500 * (bet/100)
   }
   // (same for B)
   ```

4. **Match termination**：任一側 `!isTeamAlive(formation)` → match end，reset formations；記錄 match 的 `rounds`, `winner` (A/B/draw), `overkill_dmg_delta`。chip miss counter 也要 reset。

5. **Metrics accumulation**（參 MATH-BASELINE §2）：
   - `coin.totalBet`, `coin.totalWon` → `coinRTP`
   - Hit frequency histogram（分 0 / 1-3 / 4-10 / 11-30 / 30+ 五桶）
   - Per-passive stats：tiger_reduction_rate, tortoise_shield_activations_per_match, dragon_bonus_dmg_pct, phoenix_coin_pct
   - match stats：draw_rate, overkill_A/B_wins, avg_rounds_per_match, underdog_buff_fire_rate

6. **Output**：
   - stdout 印 JSON（參 MATH-BASELINE §1 output format）
   - 同時寫 `scripts/output/sim-baseline.json`（mkdir -p）
   - Optional 文字 summary 印到 stderr（不影響 JSON pipe）

### 3b. 處理 createFormation 非決定性

MATH-BASELINE §5 旗標：`createFormation()` 用未 seeded `Math.random()`。**本 PR 不改 Formation.ts**（那是 pure module，要動就要另開 PR）。解法：sim 腳本在 loop 開始前用 `const origRandom = Math.random; Math.random = rng;` monkey-patch，loop 結束後還原。註解清楚為什麼。

（若 monkey-patch 太 hack，也可以提小 PR 改 `createFormation(selected, teamHp, rng?)` 支援選填 rng，**但超出本 PR 範圍**，列進 handoff 未來動作）

### 3c. 新增 `tsx` 至 devDependencies（若未安裝）

`npm install --save-dev tsx`，commit `package.json` + `package-lock.json`。

若已有 `tsx`，跳過本步驟。

### 3d. 檔案範圍（嚴格）

**新增**：
- `scripts/sim-rtp.mjs`（~300-400 行）
- `scripts/output/.gitignore`（內容：`*.json` — sim output 別 commit）
- `package.json`（可能加 tsx dep + 新 script entry `"sim": "tsx scripts/sim-rtp.mjs"`）

**禁止**：
- `src/**`（本 PR 零 src 改動 — 只增 tooling）
- `tsconfig.json`（若必要微調就 STOP 回報）
- SPEC.md / ROADMAP.md / MATH-BASELINE.md

**若發現既有 sim 相關工具，STOP 回報**。

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` 不會受影響因 sim 不在 src/)
2. 執行 `npx tsx scripts/sim-rtp.mjs --rounds 10000 --runs 5` 不 crash，產出合法 JSON
3. No `console.log` 在 src/ 內
4. `git commit` + `git push`
5. PR URL + JSON 截段貼到 PR summary（前 80 行）

特別提醒：
- **sim 必須跑完整 10k × 5 次**（~5-10 分鐘），不准用 100 rounds 糊弄通關。PR summary 要貼真實 metrics。
- 任何「sim 跑出來 RTP = 15000%」之類荒謬值先別急著修 SlotEngine，**把數字照實貼 PR**。orchestrator 會解讀。
- 若發現 SlotEngine/Formation/DamageDistributor 需要改才能測（例如 SlotEngine 不接受 rng 參數），STOP 回報 — 不擅自動 src/

## 5. Handoff

- PR URL
- **貼上 `scripts/output/sim-baseline.json`（10k × 5 runs, seed 1234）到 PR summary**
- 執行時間實測（ms / 10k rounds）
- 碰到的 SPEC drift 或程式坑（例如 SlotEngine.spin 簽章不吻合、某 import path 失敗）
- 是否 monkey-patch Math.random 處理 createFormation 非決定性，還是走了其他路
- 未來動作清單（例如 "Formation.createFormation() 應該加 rng 參數"）
