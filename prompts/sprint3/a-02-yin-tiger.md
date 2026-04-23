# Sprint 3 A · 02 — Yin signature（白虎猛拳重擊）

## 1. Context

PR: **Sprint 3 A · 寅 tiger-fist-combo signature**

Why: Sprint 3 A 四男 signature 第二支（孟辰璋 dragon-dual-slash 已於 PR #42 合併）。寅是白虎男，肌肉派中年武者（SPEC §4），本 PR 做**重拳三連擊 + 虎影 + 地裂**，跟 Luoluo 的 triple-dash（白虎女，靈動速擊）明顯區分：**Luoluo = 速度 + 細緻**，**寅 = 力量 + 粗暴**。

Source:
- SPEC §7.4（male spirits signatures Sprint 3 預留）
- PR #42 `_sigDragonDualSlash` as structural template
- SpiritAttackChoreographer.ts 現有 `_sigTripleDash`（Luoluo）作為「同 clan 不同風格」對照

Base: `master` (HEAD `dff73ce` or later)
Target: `feat/sprint3a-yin-tiger-fist`

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "Sprint 3 C4 male spirit signatures"` + `"Yin white tiger fist signature"`.

Known:
- 寅 Pinyin 識別符 `yin`（不可改）
- Luoluo 已佔用 `'triple-dash'` signature — 寅不得複用，需新 `'tiger-fist-combo'`
- Meng 已佔用 `'dragon-dual-slash'`
- 現有 `PERSONALITIES.yin` 走 `'generic'` + `particleColor: 0xFFD700`（黃金）— 本 PR 改為 `'tiger-fist-combo'` + 白虎橘黃色 `0xff8c33`

## 3. Task

### 3a. `src/screens/SpiritAttackChoreographer.ts`

**新增 signature type**（在 `'dragon-dual-slash'` 之後、`'generic'` 之前）：

```ts
| 'tiger-fist-combo'    // 寅 — 3× heavy punch + tiger ghost + earth crack
```

**PERSONALITIES 更新** `yin` 那筆：
- `particleColor: 0xFFD700` → `0xff8c33`（tiger 橘）
- `signature: 'generic'` → `'tiger-fist-combo'`
- `duration.fire`: 調整到 **720** ms（signature 總長度對齊）

**`generic` comment** 同步移除 `寅`：
```ts
| 'generic';           // 凌羽, 玄墨 (pending Sprint 3 C/D)
```

**新增 `_sigTigerFistCombo(ctx: Phase4Ctx): Promise<void>`**（放在 `_sigDragonDualSlash` 之後、`_screenShake` helper 之前）。

Phase 4 choreography（0.72 s 視覺重心）：

| t (ms) | 動作 |
|---|---|
| 0–120 | Charge pose：avatar 周圍 GlowFilter（橘 `0xff8c33`，outerStrength 2.5）拉起來；腳下畫一個半徑 30 擴張圓（alpha 0.6→0）暗示蓄力 |
| 120–300 | **第 1 拳**：avatar 向 target 1 微向前 10 px → 拳面衝擊 ring Graphics（半徑 16→28, alpha 0.9→0）於 target 1；afterimage 複製 avatar 當前 portrait 的 Container snapshot（scale 1.05 + alpha 0.4），150 ms 自動 fade + destroy |
| 300–480 | **第 2 拳**：同樣結構但 target 2（若無則同 target 1）；第二個 afterimage |
| 480–620 | **第 3 拳 + 地裂**：最後一擊後，地面生一個**十字地裂** Graphics — 兩條 60 × 6 的橘黃色 rect 交叉在中心 target 下方 (y 偏移 +40)，alpha 0.9→0 搭配 ShockwaveFilter（用 `applyShockwave`）100 ms |
| 620–720 | **虎影**：avatar 後方疊一個半透明白虎側影（簡化為兩層 radial gradient Graphics：外層 `0xffffff` alpha 0.25 直徑 180，內層 `0xff8c33` alpha 0.4 直徑 100）100 ms 快閃淡出 |

**實作要點**：
- 參考 `_sigTripleDash`（Luoluo）的 afterimage 節奏**但放慢 2×**（每拳 ~180 ms，不是 Luoluo 的 130 ms），強調沉重感
- 參考 `_sigDragonDualSlash` 的 Graphics 建立 + Glow + 清理模式
- **地裂十字**用兩個 rect 簡單疊，不要追求真實裂紋
- 虎影**簡化為雙層圓形 alpha 漸層**，不要嘗試畫實際虎身 — 120 ms 一閃而過，觀眾感受到「猛獸加持感」即可
- `AudioManager.playSfx('skill-yin')` 在 signature 開頭播（已在音訊 manifest）

**重用 helpers**（不重造）：
- `tween`, `delay`, `Easings` from `@/systems/tween`
- `applyGlow`, `applyShockwave`, `removeFilter` from `@/fx/GlowWrapper`
- `_screenShake` 已在檔裡
- `AudioManager.playSfx`

**Cleanup**：所有 Graphics / filters 在 signature Promise resolve 前 destroy / removeFilter。

### 3b. 檔案範圍（嚴格）

**修改**：`src/screens/SpiritAttackChoreographer.ts` 唯一檔案

**禁止**：其他任何檔案。SPEC.md 不動（§7.4 留白）。若想改 SPEC，合併後另開 docs PR。

**若發現其他檔案 bug，STOP 回報，不要自己改。**

## 4. DoD (P1 — 逐字)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

特別提醒：
- Signature 總長 ≤ 0.9 s（目標 0.72 s），不得讓 Phase 5 被推遲
- afterimage 每個自動 fade 150 ms 自 destroy；不得留殘留 Graphics 在 stage
- `SpiritAttackChoreographer.ts` 編輯 ≥ 3 次未收斂 → STOP 回報
- AudioManager.playSfx('skill-yin') 必加（不是 optional，Yin 這支 SFX 很有特色）

## 5. Handoff

- PR URL
- 1 行摘要
- Spec deviations：0
- Dependencies：`pixi-filters` GlowFilter + ShockwaveFilter、`@/systems/tween`、`AudioManager`
- afterimage 實作方式（snapshot Container clone vs 重建 Graphics — 用哪個）
