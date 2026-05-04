# Chore — Mercenary Wild 出來打 + 死靈不扣血（damage alive-gate spec change）

## 1. Context

Owner 試玩 chore #185 後 spec 變更（owner-approved 2026-05-04）：

### 現行行為
- Drafted hit + alive matching attacker → spirit 出來打 + dmg 給 defender
- Drafted hit + dead matching attacker → 不出來打 + **dmg 仍給 defender**（owner 認為這不合理）
- Mercenary (Wild) hit → 只 mercenaryWeakFx flash + dmg 給 defender（owner 想要 Wild 也戲劇化）

### Owner-approved 新 spec

| 情境 | Coin | Damage | Visual |
|---|---|---|---|
| Drafted + alive matching | 加 | 加 | spirit 出（既有）|
| Drafted + 對應 spirit **全死** | **加** | **0**（new）| 不出（既有）|
| Mercenary + 至少 1 活 | 加 | 加 | **任一活 spirit 出**（new）|
| Mercenary + 全死 | 加 | **0**（new）| 不出（既有 mercenaryWeakFx）|

### 關鍵理念
- **Coin 只看 reel 連線**（玩家「中獎」，跟 formation 無關）
- **Damage 須有可動的 attacker**（spirit 真的「出手」才扣對方血）

機制變更但保持簡單 — alive-check + 代理 attacker。

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（damage gate / mercenary attackTimeline / wire-up + alive helper）
- **`debugging-and-error-recovery`** — 確認 SlotEngine / DamageDistributor 不需動，只 BattleScreen 加 gate
- **`source-driven-development`** — 用既有 `formation.filter(u => u && u.alive)` pattern 不發明

---

## 2. Spec drift check (P6) + Pre-merge audit checklist

### Spec drift check
1. 確認 chore #185 onFireImpact callback pattern 仍用
2. 確認 BattleScreen.ts loop() 內 dmgA/dmgB 計算位置 (line 1854-1899)
3. 確認 distributeDamage call 點 (line 1997-1998)
4. 確認 mercenary path 在 addSide 內 (line 2277-2289)
5. 確認 mercenaryWeakFx 仍 import 但本 PR 後不再用（可保留 dead code 若 dispatch script 還用，否則 remove）

### Pre-merge audit
- [ ] Damage alive-gate 不影響 coin 計算（coin 仍按 reel 連線）
- [ ] Drafted gate: `activeAttackers.findIndex(u => u.alive && u.symbolId === wh.symbolId) >= 0` 才 add dmg
- [ ] Mercenary gate: `activeAttackers.some(u => u.alive)` 才 add dmg
- [ ] Mercenary visual: 用任一活 spirit container 跑 attackTimeline
- [ ] mercenary signature fx 用該 proxy spirit 的 spiritKey（讓視覺感受跟代理 spirit 一致）
- [ ] chore #181 SLOT_TO_POS_SPEC / chore #182 spiritContainer / chore #183 baseSign / chore #185 onFireImpact 全保留兼容

---

## 3. Task

### 3a. Commit 1 — Damage alive-gate

`src/screens/BattleScreen.ts` `loop()` 內 line 1854+（dmg 累加區）：

當前：
```ts
let dmgA = spin.sideA.dmgDealt;
let dmgB = spin.sideB.dmgDealt;
// ...
for (const wh of spin.sideA.wayHits) {
  if (wh.isMercenary) {
    coinA += Math.floor(wh.rawCoin * 0.5 * (this.cfg.betA / 100));
    dmgA  += Math.floor(wh.rawDmg  * 0.5 * (this.cfg.betA / 100));
  }
}
// 同樣 sideB...

for (const wh of spin.sideA.wayHits) {
  if (!wh.isMercenary) {
    dmgA += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betA / 100));
  }
}
// 同樣 sideB...
```

改成（加 alive-gate）：
```ts
// chore #186: alive-gate — only add dmg if attacker can be visualized
// Coin unchanged (player wins regardless of formation alive state)
const aliveA = this.formationA.filter(u => u !== null && u.alive);
const aliveB = this.formationB.filter(u => u !== null && u.alive);
const aliveASymbols = new Set(aliveA.map(u => u!.symbolId));
const aliveBSymbols = new Set(aliveB.map(u => u!.symbolId));

let dmgA = spin.sideA.dmgDealt;
let dmgB = spin.sideB.dmgDealt;
// ...
for (const wh of spin.sideA.wayHits) {
  if (wh.isMercenary) {
    coinA += Math.floor(wh.rawCoin * 0.5 * (this.cfg.betA / 100));
    // chore #186: dmg only if any A spirit alive (Wild proxies any alive)
    if (aliveA.length > 0) {
      dmgA += Math.floor(wh.rawDmg * 0.5 * (this.cfg.betA / 100));
    }
  }
}
// 同樣 sideB（用 aliveB.length > 0）...

for (const wh of spin.sideA.wayHits) {
  if (!wh.isMercenary) {
    // chore #186: dmg only if A has alive spirit with matching symbolId
    if (aliveASymbols.has(wh.symbolId)) {
      dmgA += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betA / 100));
    }
  }
}
// 同樣 sideB（用 aliveBSymbols.has(wh.symbolId)）...
```

> **重要**：`spin.sideA.dmgDealt` 是 SlotEngine 算出的 base damage（無 alive check）。本 PR 不動 SlotEngine，只在 BattleScreen 端 gate。
>
> **Note**：base `spin.sideA.dmgDealt` 包含**所有**wayHits 的 base damage。本 chore 在 wayHits loop 加 0.5×/0.2× incremental，但 base 沒 gate。
> **Decision**：保守做法 — base `dmgDealt` 也 gate。若 `aliveA.length === 0` → `dmgA = 0`（先 reset）。具體 by executor 看 base 計算邏輯定。

**Commit 1**: `feat(chore): damage alive-gate — drafted requires matching alive symbolId, mercenary requires any alive (coin unchanged)`

---

### 3b. Commit 2 — Mercenary 改用 attackTimeline + 代理 spirit

`addSide` 內 mercenary path (line 2277-2289)：

當前：
```ts
for (const mh of mercenaryHits) {
  const targets = defenderCells
    .filter((_, i) => activeDefenders[i]?.alive)
    .slice(0, 3)
    .map(c => ({ x: c.container.x, y: c.container.y }));
  if (targets.length > 0) {
    animations.push(mercenaryWeakFx(
      this.container,
      targets,
      Math.max(1, Math.floor(mh.rawDmg)),
      SYMBOLS[mh.symbolId].color,
    ));
  }
}
```

改成：
```ts
for (const mh of mercenaryHits) {
  const targets = defenderCells
    .filter((_, i) => activeDefenders[i]?.alive)
    .slice(0, 3)
    .map(c => ({ x: c.container.x, y: c.container.y }));

  // chore #186: pick any alive attacker spirit as proxy for Wild mercenary
  const proxyAttackerSlot = activeAttackers.findIndex(u => u && u.alive);
  if (targets.length > 0 && proxyAttackerSlot >= 0) {
    // Pre-compute target slots for defenderHitReact
    const targetSlots = defenderCells
      .map((_, i) => (activeDefenders[i]?.alive ? i : -1))
      .filter(i => i >= 0)
      .slice(0, 3);
    const targetSide = side === 'A' ? 'B' : 'A';
    const proxyUnit = activeAttackers[proxyAttackerSlot]!;

    animations.push(attackTimeline({
      stage:           this.container,
      spiritContainer: attackerCells[proxyAttackerSlot].container,
      symbolId:        proxyUnit.symbolId,    // use proxy spirit's symbolId for personality
      spiritKey:       SYMBOLS[proxyUnit.symbolId].spiritKey,
      targetPositions: targets,
      side,
      onFireImpact: () => {
        const color = SYMBOLS[mh.symbolId].color;   // mercenary wild color
        targets.forEach((tp, i) => {
          this.spawnHitBurst(tp.x, tp.y, color);
          const targetSlot = targetSlots[i];
          if (targetSlot !== undefined) {
            this.defenderHitReact(targetSide, targetSlot);
          }
        });
      },
    }));
  } else if (targets.length > 0) {
    // chore #186: all attackers dead → fall back to mercenaryWeakFx (visual only, dmg already 0 from gate)
    animations.push(mercenaryWeakFx(
      this.container,
      targets,
      Math.max(1, Math.floor(mh.rawDmg)),
      SYMBOLS[mh.symbolId].color,
    ));
  }
}
```

> **Proxy spirit 選法**：`activeAttackers.findIndex(u => u && u.alive)` — 第一個活 spirit。簡單可靠。Future 升級可改 random / 戰績最強。
>
> **Visual 一致性**：用 proxy spirit 的 `personality` (spiritKey) → spirit 出 + 自己的 signature fx；hit burst 用 mercenary 的 color (Wild gold)。

**Commit 2**: `feat(chore): mercenary path — attackTimeline with first-alive proxy spirit (Wild fires player's signature fx)`

---

### 3c. Commit 3 — Cleanup + spec note

#### 3c-1. mercenaryWeakFx fallback 是否保留？
本 PR 後 mercenaryWeakFx 只在「全死」case 用。若 `aliveA.length === 0` 同時也 dmg=0（gate 套）→ visual 只 flash 不掉血，OK。

#### 3c-2. SPEC drift comment

`BattleScreen.ts` loop() 上方加 inline comment：
```ts
// chore #186 spec note (2026-05-04 owner-approved):
//   Coin: based on reel matches (no formation alive check)
//   Damage:
//     - Drafted hit: only if A has alive spirit with matching symbolId
//     - Mercenary hit: only if A has any alive spirit (Wild proxies)
//   Visual:
//     - Drafted hit: matching alive spirit leaps (chore #182)
//     - Mercenary hit: first-alive spirit proxy leaps (chore #186)
```

#### 3c-3. MemPalace KG （由 orchestrator 負責持久化，executor 跳過）

Executor 不負責 KG — 我會在 PR merge 後 lock。

**Commit 3**: `docs(chore): inline spec note for damage alive-gate + mercenary visual upgrade`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（loop dmg gate + addSide mercenary path + spec comment）

**禁止**：
- 動 SlotEngine（spin.sideA.dmgDealt 不變）
- 動 DamageDistributor / Formation
- 動 SymbolsConfig / Resonance
- 動 chore #181/#182/#183/#185 結構（attack avatar / formation / hit fx）
- 改 SPEC.md（chore #186 spec note 留 inline，未來 sprint closure 再正式 docs）
- 改 sim-rtp.mjs / DesignTokens / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "aliveASymbols\|aliveBSymbols\|aliveA\.length\|aliveB\.length" src/screens/BattleScreen.ts` — 應在 dmg 累加 + mercenary block 各 ~2-3 處
   - `grep "mercenaryWeakFx" src/screens/BattleScreen.ts` — 仍存在但只在 fallback (else) branch
5. **Preview 驗證 critical**：
   - **Drafted + alive**: spirit 出來打 + 對方扣血（既有）
   - **Drafted + 對應 spirit 全死**: 不出來 + 對方**不扣血** + **己方仍加 coin**
   - **Mercenary (Wild) + 至少 1 活**: **代理 spirit 出來打**（用 proxy spirit 的 signature fx）+ 對方扣血
   - **Mercenary + 全死**: mercenaryWeakFx fallback flash + 對方**不扣血** + 己方仍加 coin
   - 連 5+ spin 確認上面 4 個 case 都 work（demo mode）
   - chore #185 hit reaction (burst + shake + popDamage punch) 仍正常觸發
   - 8 signature fx 仍正常
   - 無 console error
5. 截圖 1-2 張：(a) Wild 出來打 + (b) 試 dead spirit 情境（如果 demo 容易觸發）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖
- proxy spirit 選 first-alive 視覺感受 OK 嗎（or 想要 random / 看戰績選）
- mercenary 走 attackTimeline 後仍保留 mercenaryWeakFx fallback 是否合理
- 4 個 damage case 是否都驗到
- Spec deviations：1（mechanic 變更，owner-approved 2026-05-04）
