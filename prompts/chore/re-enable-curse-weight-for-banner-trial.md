# Chore #211 — 重啟 curse weight (chore Path L → 3) 給 chore #209 banner 試玩

## 1. Context

chore #209 ([PR #208](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/pull/208) merged b9f11a4) 加了「詛咒發動」banner + 紫色 -N + 紫色 flash，但 **正常 play 永遠看不到** — 因為 chore Path L 把 curse weight 設為 0（[SymbolsConfig.ts:37](src/config/SymbolsConfig.ts#L37)），curse 符號從不 spawn，curseStack 永遠 < 3，banner 永不 fire。

Owner 2026-05-05 試玩決定：**重啟 curse weight = 3**（chore Path L 之前的值），讓 chore #209 banner 在實機觸發，owner 評估視覺後再決定保留還 disable。

純 config tune — 不動 chore #209 banner 邏輯 / curse proc 條件 / distributeDamage。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit，只動 1 個 weight value
- **`source-driven-development`** — 確認 chore Path L 註解保留歷史，不刪

---

## 2. Spec drift check (P6)

1. 確認 [`src/config/SymbolsConfig.ts:37`](src/config/SymbolsConfig.ts#L37) curse symbol weight 仍為 0
2. 確認 chore #209 banner ([BattleScreen.ts playCurseBanner](src/screens/BattleScreen.ts)) 已 merged
3. 確認 [BattleScreen.ts:1810-1828](src/screens/BattleScreen.ts#L1810) curse stack accumulator 邏輯（每 spin 掃 grid 數 isCurse 符號 → curseStackA/B）

---

## 3. Task

### Single commit — Re-enable curse weight 3

`src/config/SymbolsConfig.ts` line 37：

當前：
```ts
{ id:9, name:'Curse',  shape:'curse',    color:0x8b3aaa, weight:0,    // chore Path L: disabled (was 3); M6 mechanic preserved, simply never spawns
  spiritKey:'curse',         spiritName:'咒符',     clan:'black',    isCurse:true },
```

改成：
```ts
{ id:9, name:'Curse',  shape:'curse',    color:0x8b3aaa, weight:3,    // chore #211: re-enabled (chore Path L was weight=0 disable). Owner trial 2026-05-05 to validate chore #209 banner visual.
  spiritKey:'curse',         spiritName:'咒符',     clan:'black',    isCurse:true },
```

> 只改 `weight: 0` → `weight: 3` + 更新 inline 註解（保留 chore Path L 歷史 reference）。

> **沒其他改動**：M6 curse mechanic 邏輯保持原樣（chore #209 已 wire），只是 curse 符號終於會 spawn 到 grid 上。

> **預期**：spin 中 grid 偶爾出現 isCurse 紫色咒符 (id=9) → 每 spin 累 curseStack → 滿 3 時 chore #209 banner + 500 dmg + 紫色 popDamage。

**Commit**: `tune(chore): re-enable curse weight 0→3 (chore Path L disable lift) for chore #209 banner trial`

---

### 檔案範圍（嚴格）

**修改**：
- `src/config/SymbolsConfig.ts` 1 行 + 註解

**禁止**：
- 動 chore #209 banner / playDamageEvents source param
- 動 curseStack 累積邏輯 / proc 條件 / CURSE_PROC_DMG = 500
- 動 SlotEngine spin 邏輯
- 動其他 symbol weights
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "weight:0\|weight: 0" src/config/SymbolsConfig.ts` — 應只剩本來就 0 的（如有其他），curse 那行應 weight: 3
   - `grep "isCurse:true" src/config/SymbolsConfig.ts` — 確認 curse 仍標 isCurse
   - `grep "chore #211\|chore Path L" src/config/SymbolsConfig.ts` — 註解 history 保留
5. **Preview 驗證**：
   - 進 BattleScreen，AUTO 25 spins
   - 觀察 grid 偶爾出現紫色 curse 符號 (shape=curse)
   - 累積 stack 看 curseHud 數字變化（A 累到 3 / B 累到 3）
   - 觸發 proc 看 chore #209「詛咒發動」banner + 紫色 -N + 紫色 spirit flash
   - 確認 win-line dmg 仍紅色（沒 affect）
6. **Audit per chore #203 lesson**：grep 全 codebase 確認沒其他 curse weight reference 需 sync

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（curse 符號出現在 grid 上）+ 1 張 chore #209 banner 觸發瞬間
- spec deviations: 1 (chore Path L weight=0 → 3 — owner trial 2026-05-05，可能 revert 視 owner 試玩感受)
- Process check：`git log --oneline origin/master | head -3` 確認 commit on master
