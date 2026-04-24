# Sprint 5 — PvP Differentiation: Resonance (M5) + Curse (M6)

## 總目標（SPEC §11）

> Sprint 5: PvP differentiation — Spirit Resonance (4-beast ×2.0 open) + Curse stacking (500 HP proc). PvP-specific HUD indicators.

## SPEC 差異校正

### Resonance 配置：5-pick vs SPEC 4-pick

SPEC §15.5 原 table 寫給 **4 抽**，但實作 `MAX_PICKS=5`，且每 clan 只有 2 隻雀靈。

**5 抽從 8 隻（clan: azure/white/vermilion/black each × 2）的唯一兩種分布**：

| 內部代號 | 分布 | 實際意義 |
|---|---|---|
| `SOLO` | (2,1,1,1) | 全 4 clan 覆蓋 + 1 對 |
| `DUAL` | (2,2,1,0) | 2 對 + 1 孤 + 1 缺 clan |
| ~~4-of-a-kind~~ | 不可能（2-per-clan 上限）| **drop** |

### Resonance 效果 map

| 分布 | Resonance tier | 效果 |
|---|---|---|
| (2,1,1,1) SOLO | ×1.5 on paired clan | 1 clan 的 wayHit 贏分 + 傷害 ×1.5 |
| (2,2,1,0) DUAL | ×1.5 on BOTH paired clans | 2 clan 的 wayHit ×1.5 |
| 4-of-a-kind | ✗ not achievable | drop（待將來擴 clan roster 再談）|

### 策略決策（40% strategy weight, SPEC C4）

玩家 draft 時面臨：
- **SOLO**：全 clan 覆蓋（passive 全開：tiger/tortoise/dragon/phoenix 都能觸發），但只有 1 clan ×1.5
- **DUAL**：犧牲 1 clan 換 2 clan ×1.5 買傷害集中，但少 1 passive 層

兩者都是合法選擇，體現戰略厚度。

---

## 工作項目

### Track R: Resonance (M5)

| # | 項目 | 檔案 | Who |
|---|---|---|---|
| r-01 | 資料層：`detectResonance(selected: number[]): ResonanceResult` 函式 + ResonanceTier type | `src/systems/Resonance.ts`（新）+ `src/config/SymbolsConfig.ts` | executor |
| r-02 | SlotEngine / BattleScreen 套用 ×1.5：對 resonated clan 的 wayHit rawCoin/rawDmg × 1.5 | `src/systems/SlotEngine.ts` 或 BattleScreen.loop() 後處理 | executor |
| r-03 | DraftScreen HUD：banner 右側 `◇ RESONANCE` 占位（Sprint 3C-01 留的 hook）加 pip 指示器顯示 SOLO / DUAL 狀態 | `src/screens/DraftScreen.ts` | executor |
| r-04 | BattleScreen HUD：開戰時短暫浮現 resonance 文字橫幅 `♪ 青龍共鳴 ×1.5` | `src/screens/BattleScreen.ts` | executor |
| r-05 | sim-rtp.mjs 計入 Resonance（預期 RTP ~+8% per SPEC §15.3）| `scripts/sim-rtp.mjs` | executor |
| r-06 | 實測校準（可能需要再降 DEFAULT_TARGET_RTP）| `src/config/SymbolsConfig.ts` | executor |

### Track K: Curse (M6)

| # | 項目 | 檔案 | Who |
|---|---|---|---|
| k-01 | 新 curse symbol `id:9 weight:3 isCurse:true`，SymbolsConfig 擴充 | `src/config/SymbolsConfig.ts` | executor |
| k-02 | curse tracking：每 spin 掃各側 grid 數 curse cells，累加 opponent 的 `curseStackA/B` | `src/screens/BattleScreen.ts` | executor |
| k-03 | 3-stack proc：opponent 下一回合先扣 500 HP flat dmg，stacks 歸零 | BattleScreen.loop() | executor |
| k-04 | HUD：對手 HP bar 旁顯示紫色骷髏 stack icon（1/2 警告 + 3 閃光 proc）| `src/screens/BattleScreen.ts` | executor |
| k-05 | sim-rtp.mjs 加 curse tracking（不影響 Coin RTP，但影響 dmg/match）| `scripts/sim-rtp.mjs` | executor |
| k-06 | GemMapping.ts 加 curse gem（用紫色 pentagon + 暗色 tint）| `src/config/GemMapping.ts` | executor |

---

## 依賴鏈

```
r-01 (Resonance data layer)
  ↓
r-02 (SlotEngine apply ×1.5)    k-01 (curse symbol id:9)
  ↓                                ↓
r-05 (sim verify)             k-02 (stack tracking)
  ↓                                ↓
r-06 (retune if needed)       k-03 (proc dmg)
                                   ↓
r-03 / r-04 (HUD)             k-04 (HUD stacks)     k-06 (curse gem visual)
                                   ↓
                              k-05 (sim verify)
```

兩軌**可並行**（Resonance 改 Ways eval + DraftScreen/BattleScreen HUD；Curse 加 symbol + 另一塊 HUD）。建議順序：先 r-01 + r-02 + k-01（基礎），再並行 r-05 / k-02，最後 HUD + retune。

---

## 驗收標準（Sprint 5 exit gate）

- [ ] 10k sim: Coin RTP 100% ± 5%（Resonance + Curse 加入後）
- [ ] Curse proc 頻率 ≥ 1/10 match（不太稀有也不太頻繁）
- [ ] Resonance SOLO/DUAL 兩種配置都可跑（sim 分別驗）
- [ ] DraftScreen banner 右側顯示當前 Resonance tier
- [ ] BattleScreen curse stack icon 清楚可讀
- [ ] `npm run build` 過
- [ ] Preview 視覺驗證兩個 HUD 都出

---

## 暫不動清單

- M10 Free Spin / M12 JP pool — Sprint 6
- d-04 ~ d-07 美術 polish — 留 Sprint 5 後期或 Sprint 6
- Lighthouse l-04 — 部署後驗
- Backend spec — SPEC §18 paper only, Sprint 7 不做實作
