# Chore #215 — 移除 Near-win Teaser「沙塵煙」動畫（chore d-05 disable）

## 1. Context

Owner 試玩 2026-05-06 反映：「我看到攻擊後 reel 區有動態往上飄的煙」— 經反覆 trace，確認來源是 [`playNearWinTeaser`](src/fx/NearWinTeaser.ts)（chore d-05），不是 chore #214 popCell GlowFilter（已移除）也不是 chore #202/203 facet highlight。

### Near-win teaser 機制
- [BattleScreen.ts:2099-2132](src/screens/BattleScreen.ts#L2099) 偵測：某非特殊符號 (非 Wild/Curse/Scatter/JP) 蓋滿 4/5 column → 缺的那 column 噴 sand sprite
- [`NearWinTeaser.ts`](src/fx/NearWinTeaser.ts) 動畫：sand sprite 上升 120px / 800ms + sin x-jitter ±15px + alpha 0→0.7→0 + frame cycle Sand_01..04 + blendMode='add' + clan tint
- 視覺結果 = 「整 column 沙塵雲一起往上飄」感 → 玩家覺得**時間點奇怪、跟攻擊無關卻緊接著表演**

### Owner 決策（2026-05-06）
**E 選項：完全移除 near-win teaser 動畫**。slot industry 經典「差一點」teaser 拉留存，但 owner 覺得時序突兀（停輪→連線→攻擊→受擊→**這個煙**），破壞節奏感，價值不及干擾。

純 FX 砍除 — 不動 SlotEngine win 偵測 / damage / curse / jackpot / bigwin / streak 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — clean removal，不留 dead code / commented-out

---

## 2. Spec drift check (P6)

1. 確認 [`src/screens/BattleScreen.ts:2099-2132`](src/screens/BattleScreen.ts#L2099) `// ── d-05: Near-win detection ──` block 仍存
2. 確認 [`BattleScreen.ts:34`](src/screens/BattleScreen.ts#L34) `import { playNearWinTeaser } from '@/fx/NearWinTeaser'` 仍存
3. 確認 [`src/fx/NearWinTeaser.ts`](src/fx/NearWinTeaser.ts) 仍存（本 chore 不刪檔，留 module 以便未來 revive）
4. 確認 LoadingScreen 是否預載 sos2-near-win atlas（如有需保留 asset preload，因 atlas 仍可能其他地方用）

---

## 3. Task

### Single commit — Remove near-win teaser call + import

#### 3a. 移除 BattleScreen d-05 detection block

`src/screens/BattleScreen.ts` line 2099-2132 整段 `// ── d-05: Near-win detection — ... ──` block + outer `{ ... }` 區塊**完整刪除**（不要 comment-out，留 dead code 違反 CLAUDE.md 規範）。

#### 3b. 移除 import

`src/screens/BattleScreen.ts` line 34：

```ts
import { playNearWinTeaser } from '@/fx/NearWinTeaser';
```

**刪除這行**。

#### 3c. NearWinTeaser.ts module 保留

`src/fx/NearWinTeaser.ts` **不動** — 留 module file 以便未來 owner 改決定可以 revive (重新加 import + call site)。

> 注意：保留 module = 保留 unused export warning？— Vite/TS strict 不會 fail (export 視為 entry point)。如果 lint warning 出現，flag 給 reporter 不在本 chore 修。

#### 3d. sos2-near-win atlas preload 保留

`src/screens/LoadingScreen.ts` 內的 sos2-near-win atlas preload（如果有）**保留**，asset 跟 module 一起留作 revival 後備。

#### 3e. main.ts FXAtlas.load sos2-near-win 保留

`src/main.ts:37` `'sos2-near-win'` atlas load **保留**，理由同上。

> **不動 asset 檔案** (`public/assets/fx/sos2-near-win.atlas/.webp`)。

**Commit**: `tune(chore): remove near-win teaser FX (chore d-05 disabled — owner trial 2026-05-06: timing felt jarring after attack/hit fx). Module + atlas preload kept for revival.`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts` —
  - 刪 line 34 import
  - 刪 line 2099-2132 d-05 detection block

**禁止**：
- 動 `src/fx/NearWinTeaser.ts` module
- 動 sos2-near-win atlas / webp asset 檔
- 動 main.ts FXAtlas preload list
- 動 LoadingScreen FX preload (如 sos2-near-win 在裡面)
- 動 SlotEngine win 偵測 / detectAndAwardJackpot / d-07 BigWin
- 動 chore #214 popCell / chore #202 facet highlight
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過 — 確認沒 unused-import error / dead code warning blocking
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "playNearWinTeaser\|NearWinTeaser" src/screens/BattleScreen.ts` — 應為空
   - `grep "d-05" src/screens/BattleScreen.ts` — 應為空（chore 標記也清掉）
   - `grep "playNearWinTeaser" src` — 只剩 `src/fx/NearWinTeaser.ts` 的 export definition (module 保留)
   - `npm run build` exits 0
5. **Preview 驗證**：
   - 進 BattleScreen，AUTO 25 spins，確認**沒有任何 sand 沙塵動畫上升**在 reel 任何 column
   - chore #214 中獎 cell pulse + ring + arrow trace 仍正常
   - chore #209 詛咒發動 banner + chore #210 clash uniform scale 仍正常
   - JP burst (jackpot 時) 仍正常
   - BigWin/MegaWin overlay 仍正常
6. **Audit per chore #203 lesson**：grep 全 codebase 沒其他 `playNearWinTeaser` call site 漏處理

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張 AUTO spin 截圖（攻擊後 reel 區應乾淨無 sand 動畫）
- spec deviations: 1 (chore d-05 near-win teaser disabled — owner approved 2026-05-06; module/atlas kept for future revival)
- Process check：照新 pattern — 把 `git checkout feat/<slug>` + `git add <files>` + `git commit` + `git push -u` 串在**單一 Bash call**避免 working tree race
