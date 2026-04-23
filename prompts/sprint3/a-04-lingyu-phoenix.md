# Sprint 3 A · 04 — Lingyu signature（朱雀火弓穿雲箭）

## 1. Context

PR: **Sprint 3 A · 凌羽 phoenix-flame-arrow signature**

Why: Sprint 3 A 四男 signature 最後一支（Meng #42、Yin #44、Xuanmo #PRTBD 已在前）。凌羽是朱雀男，弓箭手（SPEC §4），本 PR 做**拉弓蓄力 → 火焰箭飛行 → 擊中爆鳳凰虛影**，跟 Zhuluan 朱鸞（朱雀女，雙火球）明顯區分：**朱鸞 = 近距雙發投擲**，**凌羽 = 遠程單發精準**。節奏類似玄墨（單擊為主），但靠**射擊軌跡的貝茲曲線 + 燃燒尾跡**拉開差異。

Source:
- SPEC §7.4（male spirits signatures Sprint 3 預留）
- PR #39（Zhuluan `_sigDualFireball`）貝茲軌跡 + BloomFilter 模式作為對照
- PR #42 Meng dragon-dual-slash 的 particle trail 模式
- FX preview 工具 `?fx=phoenix-flame-arrow` 即時預覽

Base: `master` (HEAD 最新，需含 Xuanmo PR 合併後)
Target: `feat/sprint3a-lingyu-phoenix-arrow`

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "Sprint 3 C4 male spirit signatures"` + `"Lingyu phoenix arrow signature"`.

Known:
- 凌羽 Pinyin 識別符 `lingyu`（不可改）
- 當前 `PERSONALITIES.lingyu` 走 `'generic'` + `particleColor: 0xFF4500`（橘紅）— 保留此 color 合適，朱雀主題
- Zhuluan 已佔用 `'dual-fireball'`；凌羽**不得**複用，需新 `'phoenix-flame-arrow'`

## 3. Task

### 3a. `src/screens/SpiritAttackChoreographer.ts`

**新增 signature type**（在 `'tortoise-hammer-smash'` 之後、`'generic'` 之前）：

```ts
| 'phoenix-flame-arrow' // 凌羽 — bow draw → bezier flame arrow → phoenix burst
```

**更新 `'generic'` 註解**：`// (no remaining spirits — all signatures landed)`

**PERSONALITIES 更新** `lingyu` 那筆：
- `particleColor: 0xFF4500` **保留**
- `signature: 'generic'` → `'phoenix-flame-arrow'`
- `shakeIntensity: 7`（單箭命中，不比 Xuanmo 鎚重）
- `duration.fire: 700` ms

**新增 `_sigPhoenixFlameArrow(ctx: Phase4Ctx): Promise<void>`**（放在 `_sigTortoiseHammerSmash` 之後）。

Phase 4 choreography（0.7 s 視覺重心，穿透感）：

| t (ms) | 動作 |
|---|---|
| 0–200 | **拉弓蓄力**：avatar 身前出現一把弓（3 段 Graphics：中心豎桿 40×3 金色、上弧 + 下弧各 2 個 quadraticCurveTo）+ 弦上一支箭（44×2 深紅色 rect）；箭尖前端微微發光（applyGlow 橘紅 `0xff4500` outerStrength 1.5）；整組從 scale 0.8 + alpha 0 → scale 1 + alpha 1，200 ms `Easings.backOut`（帶張力感） |
| 200–280 | **蓄力閃爍**：弓身 + 箭整體 alpha 在 0.7 ↔ 1.0 之間脈動 2 次（每 40 ms 一閃），暗示「蓄滿」 |
| 280–480 | **箭矢飛行**：箭與弓分離（弓殘留原地半秒後清掉） → 箭沿**貝茲曲線**飛向 target 0：起點（avatar 身前）、控制點（target x/2, avatar.y - 80）形成「向上拋」的弧、終點 target 0；200 ms `Easings.easeIn`；飛行中每 20 ms spawn 1 顆**橘紅火焰粒子**（circle radius 3-5 隨機，alpha 0.9 → 0 fade 120 ms 後 destroy），總計約 10 顆尾焰 |
| 480–580 | **命中爆炸**：箭接觸 target 0 瞬間 — (1) 箭 + 所有尾焰 destroy；(2) 白色 flash alpha 0.5 → 0，80 ms；(3) **鳳凰虛影**：用 2 個 radial alpha Graphics 疊：外層直徑 120 `#ff8844` alpha 0.35、內層直徑 60 `#ff4500` alpha 0.65，搭配左右兩個「翅膀」rect（60×20 橘紅 alpha 0.5 stroke 1px，分別 rotation -0.4 / +0.4）模擬展翅剪影；(4) `applyShockwave(stage, tp0.x, tp0.y, 90, 100)`；(5) `_screenShake(stage, 7)` |
| 580–700 | **鳳凰虛影 fade + 餘燼粒子**：鳳凰 3 個 Graphics 同時 alpha 1 → 0，120 ms；期間 spawn 5 顆橘紅粒子從 impact 點向上飛（vy = -1, vx ±0.5 random），alpha 0.7 → 0，自動 destroy |

**實作要點**：
- **貝茲曲線軌跡**：`tween(200, p => { const ep = Easings.easeIn(p); const bx = (1-ep)*(1-ep)*startX + 2*(1-ep)*ep*ctrlX + ep*ep*endX; const by = 同理; arrow.x = bx; arrow.y = by; arrow.rotation = Math.atan2(dy, dx) ... })`
- **尾焰粒子**：用一個 spawn timer（在 tween callback 裡累積 elapsed 每 20 ms spawn 一次），獨立 `Graphics` 各自 `void tween(120, alpha fade).then(destroy)`
- **鳳凰翅膀**：2 個 rect anchored 在鳳凰中心，rotation 左右對稱 — 簡單但視覺有辨識度
- 參考 Zhuluan dual-fireball 的 BloomFilter 用法（可套在箭身 + 鳳凰）
- **AudioManager.playSfx('skill-lingyu')** 在拉弓階段 0ms 播 + 可選在 impact 480ms 播 `damage-crit` 疊音（朱雀爆擊感）

**重用 helpers**（不重造）：
- `tween`, `delay`, `Easings` from `@/systems/tween`
- `applyGlow`, `applyBloom`, `applyShockwave`, `removeFilter` from `@/fx/GlowWrapper`
- `_screenShake`, `AudioManager.playSfx`

**Cleanup**：所有 Graphics / filters 在 signature resolve 前清。弓 3 段 + 箭 + 尾焰 ~10 + 鳳凰 3 個 + 餘燼 5 + flash 1 = 約 23 個 Graphics 生命週期。

### 3b. 檔案範圍（嚴格）

**修改**：`src/screens/SpiritAttackChoreographer.ts` 唯一檔案

**禁止**：其他任何檔案。

**若發現其他檔案 bug，STOP 回報，不要自己改。**

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- Signature 總長 ≤ 0.9 s（目標 0.7 s）
- 尾焰粒子 spawn 用 tween callback 內 elapsed 累積，**不要**另開 `setInterval`
- 弓殘留 0.5s 後清 — 不要卡在 stage 上
- `SpiritAttackChoreographer.ts` 編輯 ≥ 3 次未收斂 → STOP 回報
- AudioManager.playSfx('skill-lingyu') 必加

**可以邊開 `?fx=phoenix-flame-arrow` 邊調**。

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：0
- Dependencies：`pixi-filters` BloomFilter + ShockwaveFilter、`@/systems/tween`、`AudioManager`
- 貝茲曲線實作方式（手寫 vs 其他）
- 鳳凰虛影簡化程度（用 2 ring + 2 wing rect 或你找到更好 approx）

---

## 🎉 Sprint 3 A 收尾標記

本 PR 合併後 Sprint 3 A 四男 signature **4/4 全收**，`SpiritSignature` union 內 `'generic'` 將無 spirit 使用（僅保留當 fallback）。可在 Handoff 回報順便：
- 建議下一 sprint 方向（Sprint 3B 聖獸 passive？還是 Sprint 3C 4-beast theme depth / trailer？）
