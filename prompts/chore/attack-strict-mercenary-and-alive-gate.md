# Chore — 嚴格 mercenary 移除（沒選中 = 0 coin + 0 dmg + 無連線）+ damage alive-gate

## 1. Context

Owner 試玩 chore #185 後 spec 變更（owner-approved 2026-05-04 strict version）：

### 之前的 mercenary 機制（SlotEngine.ts:181-185）
```ts
const isMercenary   = !isDrafted.has(symId);
const mercenaryMult = isMercenary ? 0.30 : 1.0;   // 30% reward for unpicked spirits
const wildMult      = wildUsed ? 2.0 : 1.0;
const rawCoin       = base × numWays × coinMult × mercenaryMult × wildMult;
const rawDmg        = base × numWays × dmgMult  × mercenaryMult × wildMult;
```

→ 沒選中的 spirit 連線可獲 **30% coin + 30% dmg**（被 SlotEngine 自動處理）。

### Owner 新 spec — 最嚴格
> 「沒選中就不會打 + 沒錢」

| 情境 | Coin | Damage | Visual |
|---|---|---|---|
| Drafted + alive matching spirit | 加 | 加 | spirit 出（既有） |
| Drafted + 對應 spirit **全死** | **加** | **0**（new alive-gate）| 不出 |
| Mercenary（不論 alive）| **0** | **0** | **無連線**（reel 不顯示）|

**Wild 替代仍正常**：5×W 之外，Wild 在 way 中替代 drafted spirit 時，wayHit 的 symId = drafted spirit（isMercenary=false），仍給 100% × 2.0 reward。

### 關鍵理解
- 改 `SlotEngine.ts` **不 push mercenary wayHit**（連 reel 連線都不顯示）
- BattleScreen damage alive-gate 處理 drafted-but-all-dead 情況
- Mercenary 流程在 BattleScreen 變 dead code（無事可做）

### RTP impact
此變更**會降 RTP**（少了 mercenary 30% 額外 reward）。可能需後續調整 base coin / dmg 補償，但本 PR **只動 spec 邏輯不調 base mult**。Sim 結果待 owner 確認後決定下一步。

---

## Skills suggested

- **`incremental-implementation`** — 3 atomic commits（SlotEngine drop mercenary / BattleScreen alive-gate / mercenary dead code cleanup）
- **`debugging-and-error-recovery`** — sim RTP 變化需 verify
- **`source-driven-development`** — 沿用 isDrafted Set 不發明

---

## 2. Spec drift check (P6) + Pre-merge audit

### Spec drift check
1. **重大 SPEC 變更** — 動 SlotEngine 機制（前所未動）
2. 確認 Wild 替代 path：line 168 `wildUsed = true` + symId 仍是 drafted symbol → isMercenary=false → 不被新 filter 篩掉 ✓
3. 確認 SymbolPool / SymbolsConfig 不變
4. RTP target spec 須記錄變化（先記 spec note，sim RTP 之後驗證）

### Pre-merge audit
- [ ] SlotEngine.ts: mercenary wayHit 不 push 進 wayHits 陣列
- [ ] BattleScreen `mercenaryHits` filter 結果為空 → mercenary visual path 永不觸發
- [ ] `spin.sideA.dmgDealt / coinWon` base 累加在 SlotEngine line 188-189，mercenary 跳過後 base 也只 drafted
- [ ] BattleScreen damage alive-gate（drafted-only）：`aliveSymbols.has(wh.symbolId)` 才 add dmg
- [ ] coin 不受 alive-gate 影響（owner spec：己方仍加錢）
- [ ] Wild ×2 multiplier 仍正常（drafted 路徑）
- [ ] chore #181/#182/#183/#185 結構保留兼容

---

## 3. Task

### 3a. Commit 1 — SlotEngine: drop mercenary scoring entirely

`src/systems/SlotEngine.ts` 約 line 175-189：

當前：
```ts
if (matchCount < 3) continue;

const base            = PAYOUT_BASE[matchCount] ?? 0;
const mult            = SlotEngine.scaledMult(symId, ...);
const isMercenary     = !isDrafted.has(symId);
const mercenaryMult   = isMercenary ? 0.30 : 1.0;
const wildMult        = wildUsed ? 2.0 : 1.0;
const rawCoin         = base * numWays * mult.coinMult * mercenaryMult * wildMult;
const rawDmg          = base * numWays * mult.dmgMult  * mercenaryMult * wildMult;

wayHits.push({ symbolId: symId, matchCount, numWays, hitCells, rawCoin, rawDmg, isMercenary, wildUsed });
totalCoin += rawCoin;
totalDmg  += rawDmg;
```

改成：
```ts
if (matchCount < 3) continue;

// chore #186 (owner-approved 2026-05-04, strict spec):
// Mercenary spirits (not drafted) score nothing — no wayHit, no coin, no dmg, no reel trace.
// Wild substitution path preserved: when Wild substitutes for a drafted symbol, wayHit symId
// is the drafted spirit (not Wild itself), so isMercenary=false → still scores normally.
const isMercenary = !isDrafted.has(symId);
if (isMercenary) continue;

const base     = PAYOUT_BASE[matchCount] ?? 0;
const mult     = SlotEngine.scaledMult(symId, ...);
const wildMult = wildUsed ? 2.0 : 1.0;   // SPEC §15 M1 — way with wild ×2
const rawCoin  = base * numWays * mult.coinMult * wildMult;
const rawDmg   = base * numWays * mult.dmgMult  * wildMult;

wayHits.push({ symbolId: symId, matchCount, numWays, hitCells, rawCoin, rawDmg, isMercenary: false, wildUsed });
totalCoin += rawCoin;
totalDmg  += rawDmg;
```

> `isMercenary: false` 永遠是 false（保留 field 給 backward compat）。

> **Note**：`mercenaryMult` const 移除，`isMercenary` const 仍計算用於 early-continue。

**Commit 1**: `feat(chore): SlotEngine drop mercenary scoring — only drafted spirits score (owner-approved strict spec)`

---

### 3b. Commit 2 — BattleScreen damage alive-gate for drafted

`src/screens/BattleScreen.ts` `loop()` line ~1854-1899（dmg 累加區）：

當前（chore #186 之前）：
```ts
let dmgA = spin.sideA.dmgDealt;
let dmgB = spin.sideB.dmgDealt;
// ... wayHits loop ...
for (const wh of spin.sideA.wayHits) {
  if (wh.isMercenary) {  // post-#186 always false, dead branch
    coinA += Math.floor(wh.rawCoin * 0.5 * (this.cfg.betA / 100));
    dmgA  += Math.floor(wh.rawDmg  * 0.5 * (this.cfg.betA / 100));
  }
}

for (const wh of spin.sideA.wayHits) {
  if (!wh.isMercenary) {
    dmgA += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betA / 100));
  }
}
```

改成：
```ts
// chore #186: damage alive-gate — drafted hit dmg only if matching alive spirit exists
// Coin unchanged (player wins regardless of formation alive state)
const aliveASymbols = new Set(
  this.formationA.filter(u => u !== null && u.alive).map(u => u!.symbolId)
);
const aliveBSymbols = new Set(
  this.formationB.filter(u => u !== null && u.alive).map(u => u!.symbolId)
);

let dmgA = spin.sideA.dmgDealt;
let dmgB = spin.sideB.dmgDealt;

// chore #186: gate base dmg on alive — if no alive spirit matches any drafted hit's symbolId,
// base dmg should also be 0 (since base is sum of drafted hits — chore #186 dropped mercenary)
const draftedAliveA = spin.sideA.wayHits.some(wh => !wh.isMercenary && aliveASymbols.has(wh.symbolId));
const draftedAliveB = spin.sideB.wayHits.some(wh => !wh.isMercenary && aliveBSymbols.has(wh.symbolId));
if (!draftedAliveA) dmgA = 0;
if (!draftedAliveB) dmgB = 0;

// chore #186: mercenary block removed — wayHits contain only drafted (post SlotEngine fix)
// for (const wh of spin.sideA.wayHits) { if (wh.isMercenary) ... } ← REMOVED, dead code

for (const wh of spin.sideA.wayHits) {
  // wh.isMercenary now always false post-chore #186 SlotEngine fix
  // alive-gate: only add incremental dmg if A has matching alive spirit
  if (aliveASymbols.has(wh.symbolId)) {
    dmgA += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betA / 100));
  }
}

for (const wh of spin.sideB.wayHits) {
  if (aliveBSymbols.has(wh.symbolId)) {
    dmgB += Math.floor(wh.rawDmg * 0.2 * (this.cfg.betB / 100));
  }
}
```

> **Coin**：保留 `coinA += spin.sideA.coinWon`（base 計算）— SlotEngine drafted-only 後 coin base 自然只含 drafted。Owner spec：coin 永遠加，無 alive check。

> **Note**：Mercenary 0.5 incremental block 移除（dead code，wayHits 全 drafted 後）。

**Commit 2**: `feat(chore): damage alive-gate — drafted hit dmg=0 if no matching alive spirit (coin unchanged)`

---

### 3c. Commit 3 — Mercenary visual path cleanup + spec note

`addSide` 內 mercenary block (line 2277-2289)：

當前：
```ts
const mercenaryHits = hits.filter(h => h.isMercenary);
// ...
for (const mh of mercenaryHits) {
  const targets = ...;
  if (targets.length > 0) {
    animations.push(mercenaryWeakFx(...));
  }
}
```

改成：
```ts
// chore #186 (strict spec): mercenary wayHits no longer exist post-SlotEngine fix.
// This block is intentional dead code preserved for safety + clarity.
const mercenaryHits = hits.filter(h => h.isMercenary);
if (import.meta.env.DEV && mercenaryHits.length > 0) {
  console.warn('[BattleScreen] Unexpected mercenary wayHits after chore #186 strict spec', mercenaryHits);
}
// for-of loop removed — no visual fired for mercenary
```

或更激進：完全移除 `mercenaryHits` 變數 + import。Executor 用 `grep` 確認不影響其他地方再決定。

#### Spec note inline

`BattleScreen.ts` loop() 上方加：
```ts
// chore #186 spec note (2026-05-04 owner-approved STRICT mercenary):
//   Mercenary (unpicked spirits) score nothing — no coin, no dmg, no reel trace.
//   Drafted hit damage gated on matching alive spirit (coin unchanged).
//   Wild ×2 multiplier preserved (Wild substitutes drafted symbol → not mercenary).
//   RTP impact: ~30% downgrade for mercenary base layer; sim verification post-merge required.
```

**Commit 3**: `chore: remove mercenary visual path + inline spec note (RTP verification post-merge)`

---

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/systems/SlotEngine.ts`（mercenary early-continue + 移除 mercenaryMult）
- `src/screens/BattleScreen.ts`（loop dmg alive-gate + addSide mercenary cleanup + spec note）

**禁止**：
- 動 SymbolsConfig / Resonance / DamageDistributor / Formation
- 動 chore #181/#182/#183/#185 結構
- 動 SymbolPool（draft pool 不變）
- 改 SPEC.md（chore #186 留 inline note，未來 sprint closure 補正式 SPEC §15 update）
- 改 sim-rtp.mjs（**必須**只動 SlotEngine 不動 sim — 確認 sim 共用同 SlotEngine 自然反映新 spec）
- 改 DesignTokens / main.ts / ResultScreen / DraftScreen

---

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "mercenaryMult\|mercenaryHits" src/` — mercenaryMult 應 0 hits, mercenaryHits 仍存在但只 dev warn fallback
   - `grep "isMercenary" src/` — 仍存在於 SlotEngine field + BattleScreen 條件，但 wayHits 全 false
   - `grep "aliveASymbols\|aliveBSymbols\|draftedAliveA\|draftedAliveB" src/screens/BattleScreen.ts` — alive-gate 邏輯
5. **Preview 驗證 critical**：
   - **Drafted + alive**: spirit 出來打 + 對方扣血（既有，不變）
   - **Drafted + 對應 spirit 全死**: 不出來 + 對方**不扣血** + 己方仍加 coin
   - **Mercenary (沒選中) 連線**: **reel 不顯示連線** + 0 coin + 0 dmg + 無視覺
   - **Wild 替代 drafted**: 仍 100% reward + ×2 wild bonus（unchanged）
   - 試 5 spin demo mode 確認 4 case 都 work
   - 無 console error
   - 無 TypeScript error
6. 觀察 sim coin RTP（chore 後預期 ~70% 之前的；若超 SPEC range 上下界 flag 給 owner）

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖（drafted alive normal + sim RTP 結果若有跑）
- mercenary 連線 reel 真的不顯示？(SlotReel.highlightWays 應自然 OK 因為 wayHits 沒 mercenary)
- chore #185 hit reaction (burst + popDamage punch) 仍正常觸發（drafted path）
- 8 signature fx 仍正常
- Spec deviations：1 重大（SlotEngine mercenary mechanic 移除，owner-approved 2026-05-04 strict spec）
- **Audit lessons applied**：
  - SlotEngine 動到 = 機制變更，需 SPEC drift 註記
  - sim 共用 SlotEngine 自然反映（不分支 prod/sim 邏輯）
- **Post-merge follow-up**：sim RTP 跑一次，若超 SPEC range 範圍（95-110%）owner 決定是否補 base mult
