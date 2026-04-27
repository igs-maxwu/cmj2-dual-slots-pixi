# Sprint 10 — BattleScreen Visual Polish（the-stylist audit response）

## 總目標

Owner Sprint 9 試玩後對 BattleScreen 視覺不滿意，提供截圖 → orchestrator dispatch the-stylist subagent → 完整 audit 出 3 個 P0 bugs + 5 個 P1 polish gaps + 5 個 P2 minor。Sprint 10 修 P0 + 解 P1 主要部分，把 demo 從 prototype 拉到 polish-ready。

完整 audit 報告：[`docs/pitch/sprint10-visual-audit.md`](../../docs/pitch/sprint10-visual-audit.md)

---

## 工作項目（5 PRs total）

| # | Track | 項目 | Mockup gated? | Skills |
|---|---|---|---|---|
| **p10-bug-01** | Bug | 3 P0 bugs（標題切斷 / 角落白塊 / HP bar 浸 JP）+ sortableChildren 啟用 | 否 | debugging-and-error-recovery, frontend-ui-engineering |
| **p10-v03** | Polish | Gold budget 8→3 + ROUND pill 拆字 + log contrast + button copy | 否（可平行）| code-simplification, frontend-ui-engineering |
| **p10-v01** | Layout | Arena panel + reel warm bed + perspective floor 限定 arena 區 + zone separator | **是** | frontend-ui-engineering, code-simplification |
| **p10-v02** | Polish | Reel cell — targetSize 0.80→0.90 + inner ring + tier pip | 否 | frontend-ui-engineering |
| **p10-v04** | Art | 8 spirit gem 客製 PNG art 取代 programmatic tint | **是**（gem mockup + 美術 asset）| incremental-implementation |
| closure | Meta | Sprint 10 closure | — | documentation-and-adrs |

---

## 依賴鏈

```
p10-bug-01 ──┐
p10-v03    ──┼──→ p10-v01 (mockup approved) ──→ p10-v02 ──→ p10-v04 (art delivered) ──→ closure
             │
   [Claude Design mockup review by owner]
```

---

## 推薦 dispatch 順序

1. **p10-bug-01** — 立刻 dispatch（零依賴）
2. **p10-v03** — 平行 dispatch（zero design risk，純 colour/copy）
3. **同時 owner 跑 mockup 1**（Claude Design）→ 選 variant A 或 B
4. p10-bug-01 + p10-v03 都 merged → **p10-v01 dispatch**（mockup-gated）
5. p10-v01 merged → **p10-v02 dispatch**
6. 美術交付 8 個 gem art → **p10-v04 dispatch**（or Sprint 11）

---

## 驗收標準（Sprint 10 exit gate）

- [ ] 進 Battle 看不到任何 P0 artifact（標題完整可讀 / 角落沒白塊 / JP 區無綠 bar）
- [ ] 螢幕同時 ≤ 3 個 gold-emitting 元素（gold budget 守住）
- [ ] Battle arena 與 reel zone 視覺上明確分隔（arena panel + warm bed）
- [ ] Perspective floor 對比 ≥ 3:1（teal caustic 取代 dark gold shadow）
- [ ] Reel cells 不再「稀疏漂浮」感（gem 90% fill + tier pips）
- [ ] `npm run build` 過
- [ ] sim coin_rtp 維持 95-110%（純視覺 sprint，sim 不該動）

---

## Sprint 9 → Sprint 10 銜接 fact

- Sprint 6+7+8+9 累積 21 PRs merged + 6 inline docs，zero spec drift
- Sprint 9 完成的 v-01/v-02/v-03/pace-01/res-01 沒解所有視覺問題 — owner 試玩仍不滿意 → Sprint 10 是 mockup-gated polish round 2
- the-stylist subagent 首次 deeper involvement（前面 sprint 主要靠 prompt 內 skill hints，這次走 full audit）
- Closure refs:
  - Sprint 9 closure: drawer `59902644ee9a2098`
  - Visual audit: `docs/pitch/sprint10-visual-audit.md`
