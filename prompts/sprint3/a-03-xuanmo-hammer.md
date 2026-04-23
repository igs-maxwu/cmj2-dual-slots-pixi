# Sprint 3 A · 03 — Xuanmo signature（玄武戰鎚裂地）

## 1. Context

PR: **Sprint 3 A · 玄墨 tortoise-hammer-smash signature**

Why: Sprint 3 A 四男 signature 第三支（Meng 孟辰璋 已在 #42，Yin 寅 已在 #44）。玄墨是玄武男，重裝戰鎚武者（SPEC §4），本 PR 做**蓄力高舉 → 單發重擊 → 放射狀裂紋 → 龜甲護盾光環**，跟 Zhaoyu 朝雨（玄武女，召蛇）明顯區分：**朝雨 = 召喚 + 纏繞**，**玄墨 = 單擊 + 震碎**。節奏也跟 Meng / Yin 不同：不是連擊，**一擊定音**。

Source:
- SPEC §7.4（male spirits signatures Sprint 3 預留）
- PR #44 `_sigTigerFistCombo`（Yin）結構模板 — 類似地裂元素可參考，但玄墨要放大 3x 強度
- FX preview 工具（PR #46）可邊改邊看 `?fx=tortoise-hammer-smash`

Base: `master` (HEAD 最新)
Target: `feat/sprint3a-xuanmo-tortoise-hammer`

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "Sprint 3 C4 male spirit signatures"` + `"Xuanmo tortoise black hammer signature"`.

Known:
- 玄墨 Pinyin 識別符 `xuanmo`（不可改）
- 當前 `PERSONALITIES.xuanmo` 走 `'generic'` + `particleColor: 0x9400D3`（紫）— 本 PR 改為 `'tortoise-hammer-smash'` + 玄武**銀黑色** `0xa0a8c0`（甲冑質感）或保留紫色也可，你決定
- Zhaoyu 朝雨已佔用 `'python-summon'`；玄墨**不得**用相近名，需新 `'tortoise-hammer-smash'`

## 3. Task

### 3a. `src/screens/SpiritAttackChoreographer.ts`

**新增 signature type**（在 `'tiger-fist-combo'` 之後、`'generic'` 之前）：

```ts
| 'tortoise-hammer-smash' // 玄墨 — charge → overhead smash → radial crack + shell halo
```

**更新 `'generic'` 註解**：`// 凌羽 (pending Sprint 3 D)`

**PERSONALITIES 更新** `xuanmo` 那筆：
- `particleColor: 0x9400D3` → `0xa0a8c0`（銀灰，甲冑質感）或試試 `0x5a4d8c`（玄武幽紫）
- `signature: 'generic'` → `'tortoise-hammer-smash'`
- `shakeIntensity: 12`（最重，顯示「單擊定音」的力量）
- `duration.fire: 750` ms（稍長於 Yin 720，強化蓄力感）

**新增 `_sigTortoiseHammerSmash(ctx: Phase4Ctx): Promise<void>`**（放在 `_sigTigerFistCombo` 之後）。

Phase 4 choreography（0.75 s 視覺重心，節奏沉重）：

| t (ms) | 動作 |
|---|---|
| 0–250 | **蓄力高舉**：avatar 略後退 5 px + 一支大戰鎚 Graphics 從 avatar 身後逐漸升起到頭頂（長度 72 px、寬 22 px 的矩形，深色漸層 `#3a4055 → #6a7288`），尾端加 1 顆金色圓形球頭（radius 8，金色 `0xd4af37`）模擬鎚頭配飾；同時銀灰粒子（6 顆小圓）繞 avatar 緩慢螺旋上升 |
| 250–400 | **俯衝劈擊**：鎚頭從頭頂劃弧往 target 0 下劈（rotation 0 → 1.5 rad，位移 y 從 -60 → tp0.y - avatar.y）；全程 150 ms `Easings.easeIn`（先慢後快） |
| 400–480 | **impact 爆炸**：鎚頭接觸地面瞬間 → (1) 白色全螢幕 flash alpha 0.5 → 0，80 ms； (2) 放射狀裂紋：**8 條 rect**（長 90，寬 4，alpha 0.9，深灰色 `#3a4055`）從 impact 點往 8 個方向（每 45°）展開；(3) ShockwaveFilter `applyShockwave(stage, impactX, impactY, 120, 150)`；(4) `_screenShake(stage, 12)`（重震） |
| 480–600 | **龜甲光環**：avatar 後方顯示六角形光環（取一個 `Graphics().moveTo + 6 邊 polygon`，radius 90, alpha 0.5 stroke 4px 金色），快速放大到 130 + alpha 0.5 → 0，120 ms |
| 600–750 | **裂紋 fade out + hitstop 60 ms**：8 條 rect 同步 alpha 0.9 → 0（120 ms），hitstop 60 ms 在 480–540 的衝擊瞬間插入 |

**實作要點**：
- **鎚頭質感**：深色金屬漸層 body + 金色圓球端飾 — 讓戰鎚看起來像「寶器」不是簡單棍棒
- **8 條放射裂紋**：用一個 for 迴圈產 8 支 Graphics，各自 rotation `i * π/4`，transform pivot 在 impact 點
- **龜甲光環**：用六邊形 Graphics stroke 不 fill（只要輪廓線，象徵「堅固」），配合 scale tween 做「瞬間護盾」效果
- 參考 Yin 的 `applyShockwave + screenShake + fire-and-forget` 模式
- **AudioManager.playSfx('skill-xuanmo')** 在蓄力階段開頭播（0ms）+ 可選在 impact 瞬間（400ms）播 `hit-heavy` 疊音

**重用 helpers**（不重造）：
- `tween`, `delay`, `Easings` from `@/systems/tween`
- `applyGlow`, `applyShockwave`, `removeFilter` from `@/fx/GlowWrapper`
- `_screenShake` 已在檔裡
- `AudioManager.playSfx`

**Cleanup**：所有 Graphics / filters 在 signature Promise resolve 前 destroy / removeFilter。鎚頭 + 8 條裂紋 + 六角光環共 ~11 個 Graphics 要清。

### 3b. 檔案範圍（嚴格）

**修改**：`src/screens/SpiritAttackChoreographer.ts` 唯一檔案

**禁止**：其他任何檔案。SPEC.md 不動（§7.4 留白）。

**若發現其他檔案 bug，STOP 回報，不要自己改。**

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- Signature 總長 ≤ 0.9 s（目標 0.75 s），不得讓 Phase 5 被推遲
- 8 條裂紋用 for 迴圈產生 + 陣列儲存，最後一起 destroy（不要 11 個變數分別管）
- `SpiritAttackChoreographer.ts` 編輯 ≥ 3 次未收斂 → STOP 回報
- AudioManager.playSfx('skill-xuanmo') 必加

**可以邊開 `?fx=tortoise-hammer-smash` 邊調**（FX preview 工具 PR #46 已合併）。

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：0
- Dependencies：`pixi-filters` ShockwaveFilter、`@/systems/tween`、`AudioManager`
- particleColor 最終用了哪個（銀灰 / 玄紫 / 保留原紫）
- 鎚頭渲染方式（Graphics rect vs 其他）
