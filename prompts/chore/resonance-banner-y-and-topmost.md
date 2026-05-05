# Chore — Resonance banner 位置上移 + 確保最上層

## 1. Context

Owner 試玩 chore #193 後反映：
1. 共鳴 banner 想顯示在**最上層圖層**
2. 位置高一點 — 截圖顯示在 JP marquee 下方 / 「戰」 zone separator 附近

當前 (chore #191/#193):
- `banner.y = 380` (mid-arena)
- `banner.zIndex = 3500` (above fxLayer 3000)

Owner 期望：
- y ≈ 262 (ZONE_SEP_Y) 或 270 — JP marquee 下緣 / 「戰」 separator 區
- zIndex 最高（不被任何其他 layer 覆蓋）

純視覺位置 + zIndex 調整。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用既有 ZONE_SEP_Y const

---

## 2. Spec drift check (P6)

1. 確認 `playSideResonanceBanner` 仍在 BattleScreen.ts (chore #191)
2. 確認 `ZONE_SEP_Y = 262` const (line 53)
3. 確認 chore #193 banner.zIndex = 3500

---

## 3. Task

### Single commit — Move banner higher + bump zIndex

`src/screens/BattleScreen.ts` `playSideResonanceBanner` (line ~1670 area)：

當前：
```ts
banner.x = side === 'A' ? CANVAS_WIDTH * 0.27 : CANVAS_WIDTH * 0.73;
banner.y = 380;
banner.alpha = 0;
banner.zIndex = 3500;
this.container.addChild(banner);
```

改成：
```ts
banner.x = side === 'A' ? CANVAS_WIDTH * 0.27 : CANVAS_WIDTH * 0.73;
// chore #196: move higher to zone separator area (was 380 = mid-arena)
banner.y = ZONE_SEP_Y;   // 262 — at 「戰」 gold separator line, just below JP marquee
banner.alpha = 0;
// chore #196: topmost layer — above all fxLayer (3000) / ceremonies (2000-2500) / attack (1500)
banner.zIndex = 5000;
this.container.addChild(banner);
```

### 視覺驗證

`npm run build` + 試玩：
- 觸發共鳴 → banner 出現在「戰」 separator 上方/重疊位置
- A side blue 在左 / B side red 在右
- 文字**不被任何 element 蓋**（包括 fxLayer dmg numbers / ceremony / attack avatar）
- fade in/out 仍正常

**Commit**: `tune(chore): resonance banner y 380→ZONE_SEP_Y(262) + zIndex 3500→5000 (topmost)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（playSideResonanceBanner 內 banner.y + banner.zIndex）

**禁止**：
- 動 chore #191 banner 顏色 / x / 文字
- 動 fxLayer / ceremony / attack zIndex
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL（PR or direct master）
4. **Pre-merge audit**：
   - `grep "banner.y\|banner.zIndex" src/screens/BattleScreen.ts | head` — 確認 ZONE_SEP_Y + 5000
5. **Preview 驗證**：
   - 共鳴觸發 → banner 在「戰」separator 區（y=262）顯示
   - A 藍/B 紅 雙側 (chore #191) 仍正確
   - 文字在最上層（試 dmg 數字 + attack avatar 同時觸發 → banner 在最上）

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（共鳴觸發瞬間）
- y=262 視覺感受 OK 還是太靠 JP marquee（or 試 y=275 / 270 微調）
- zIndex=5000 確認 banner 真的不被覆蓋
- Spec deviations：預期 0
- **重要 process check**：cherry-pick 後 `git log --oneline origin/master | head -3` 確認 source 真上 master（chore #194/#195 教訓）
