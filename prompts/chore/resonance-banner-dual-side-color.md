# Chore — Resonance banner 雙側分顯（A 藍 / B 紅）

## 1. Context

當前 `playResonanceBanner` (BattleScreen.ts L1647-1675)：
- 只 check `this.resonanceA.tier !== 'NONE'` → **只顯示 A 側 banner**
- 位置：CANVAS_WIDTH/2 中央
- 顏色：goldText（金色）

問題：玩家不知道 banner 是誰的 resonance（A 或 B 同時觸發時更糊）。

### Owner spec change

兩 banner 分顯：
- **A 側**：在畫面**左側**（A formation 位置上方）+ **藍色** (T.TEAM.azureGlow `0x6ab7ff`)
- **B 側**：在畫面**右側**（B formation 位置上方）+ **紅色** (T.TEAM.vermilionGlow `0xff8a6a`)
- 各自獨立檢查 resonance tier → 各自 fire-and-forget

純視覺改動 — 不動 Resonance 機制 / detectResonance 邏輯。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用既有 T.TEAM.azureGlow / vermilionGlow + 既有 banner pattern，goldText 不適用（金色）改 native Text

---

## 2. Spec drift check (P6)

1. 確認 `resonanceA / resonanceB` 都已 detected (BattleScreen.onMount line ~265 area)
2. 確認 既有 playResonanceBanner 簽名（沒參數）— 改動內部結構，呼叫點不動

---

## 3. Task

### Single commit — Dual-side resonance banner

`src/screens/BattleScreen.ts` `playResonanceBanner` (line 1647-1675)：

當前：
```ts
private async playResonanceBanner(): Promise<void> {
  if (this.resonanceA.tier === 'NONE') return;
  // ... build bannerText for A only ...
  banner.x = CANVAS_WIDTH / 2;
  banner.y = 380;
  // fade in / hold / fade out / destroy
}
```

改成：
```ts
private async playResonanceBanner(): Promise<void> {
  // chore #191: dual-side display — A on left blue / B on right red
  const promises: Promise<void>[] = [];
  if (this.resonanceA.tier !== 'NONE') {
    promises.push(this.playSideResonanceBanner('A'));
  }
  if (this.resonanceB.tier !== 'NONE') {
    promises.push(this.playSideResonanceBanner('B'));
  }
  await Promise.all(promises);
}

/** chore #191: helper for one side's resonance banner — side determines x + color */
private async playSideResonanceBanner(side: 'A' | 'B'): Promise<void> {
  const meta = T.CLAN_META;
  const reso = side === 'A' ? this.resonanceA : this.resonanceB;
  const teamColor = side === 'A' ? T.TEAM.azureGlow : T.TEAM.vermilionGlow;

  let bannerText: string;
  if (reso.tier === 'SOLO') {
    const clan = reso.boostedClans[0];
    bannerText = `♪ ${meta[clan].cn} 共鳴  ×1.5`;
  } else {
    const c1 = reso.boostedClans[0];
    const c2 = reso.boostedClans[1];
    bannerText = `♪ ${meta[c1].cn} × ${meta[c2].cn}  雙重共鳴  ×1.5`;
  }

  // chore: native Text with team-glow color (was goldText gold) — A blue / B red
  const banner = new Text({
    text: bannerText,
    style: {
      fontFamily: T.FONT.title,
      fontWeight: '900',
      fontSize: T.FONT_SIZE.h2,
      fill: teamColor,
      stroke: { color: 0x000000, width: 4, join: 'round' },
      dropShadow: { color: 0x000000, blur: 2, distance: 2, alpha: 0.6 },
    },
  });
  banner.anchor.set(0.5, 0.5);
  // A side at left half, B side at right half
  banner.x = side === 'A' ? CANVAS_WIDTH * 0.27 : CANVAS_WIDTH * 0.73;
  banner.y = 380;
  banner.alpha = 0;
  banner.zIndex = 1000;
  this.container.addChild(banner);

  await tween(200, t => { banner.alpha = t; }, Easings.easeOut);
  await delay(1000);
  await tween(300, t => { banner.alpha = 1 - t; }, Easings.easeIn);

  banner.destroy();
}
```

> **Note**：`CANVAS_WIDTH * 0.27 ≈ 194` (A 左) / `* 0.73 ≈ 525` (B 右)。中央 360 留空（不撞到 VS badge）。
> **fontSize T.FONT_SIZE.h2** 看是多大（可能 ~32）— 兩個 banner 並列要確認沒互撞，視覺 trial 後微調 x 位置。

### 驗證

`npm run build` + 試玩：
- A 觸發 resonance → 左側看到藍色 banner「♪ XX 共鳴 ×1.5」
- B 觸發 resonance → 右側看到紅色 banner
- 雙方同時觸發 → 兩個 banner 並列顯示
- 兩個都不觸發 → 無 banner（既有行為）
- 只有 A 或只有 B 觸發 → 只顯示該側

**Commit**: `feat(chore): resonance banner dual-side display — A left blue / B right red (was single golden centred)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts`（playResonanceBanner 重構 + 新 helper playSideResonanceBanner）

**禁止**：
- 動 Resonance detection / detectResonance / resonanceMultForClan
- 動 SlotEngine / WayHit / damage logic
- 改 SPEC §15 M5 Resonance mechanic
- 改 GoldText component（其他地方仍用）
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Pre-merge audit**：
   - `grep "playResonanceBanner\|playSideResonanceBanner" src/screens/BattleScreen.ts` — 兩 method exist
   - `grep "azureGlow\|vermilionGlow" src/screens/BattleScreen.ts | head -5` — 確認 team color reference
5. **Preview 驗證 critical**：
   - 進 Battle，draft 含 SOLO 或 DUAL resonance combo（如 5 same clan = SOLO，2+2 different clans = DUAL）
   - A 側 resonance → 左側藍色 banner
   - B 側 resonance → 右側紅色 banner
   - 雙方同時 resonance → 兩 banner 並列
   - 文字內容正確（「♪ {clan} 共鳴 ×1.5」/ 「♪ {c1} × {c2} 雙重共鳴 ×1.5」）
   - fade in / hold / fade out 流暢

## 5. Handoff

- PR URL
- 1 行摘要
- 1-2 張截圖（A only / B only / 雙側 同時）
- x 位置 0.27 / 0.73 是否合適（or 需要更外側 0.20 / 0.80）
- 字體 size T.FONT_SIZE.h2 並列時是否合適
- Spec deviations：預期 0
