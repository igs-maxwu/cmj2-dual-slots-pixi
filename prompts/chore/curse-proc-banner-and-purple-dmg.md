# Chore #209 — 詛咒發動 banner + 紫色 -N + 紫色 shake flash

## 1. Context

Owner 試玩反映：「沒連線卻扣血」搞不懂為什麼。

### 機制澄清
M6 詛咒 (curse) 是雙邊對稱機制：
- 每 spin 掃 grid，col 0-1 詛咒符號 → `curseStackB`，col 3-4 → `curseStackA`，col 2 中立
- 任一邊 stack ≥ 3 → 該邊扣 500 固定 dmg + reset stack
- 不需要任何 win line — 因此會出現「沒連線卻扣血」

當前視覺：curseHud 短暫 flash + popDamage 紅 `-N` (跟 win-line dmg 同色) — 玩家無法區分 curse vs win-line 傷害來源。

### Fix 目標
1. **Banner**：curse proc 時顯示大字「詛咒發動」+ 紫光 + 暗紫 vignette → 玩家清楚知道發生什麼
2. **紫色 popDamage `-N`**：curse 傷害用紫色文字 (vs win-line 紅色) → 視覺區分傷害來源
3. **紫色 shake flash**：defenderHitReact overlay 用紫色 (vs win-line 紅色)
4. **保留** win-line dmg 視覺完全不動 (default `source='win'`)

純視覺/UX fix — 不動 distributeDamage / curseStack 累積邏輯 / proc 條件。

### 參考已 reverted 過的實作
[a11be73](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/commit/a11be73) 是 reverted 的 [7f226ac](https://github.com/igs-maxwu/cmj2-dual-slots-pixi/commit/7f226ac)，可以 reference 完整實作 diff (`git show 7f226ac`)，但**請當作 reference，不要 cherry-pick** — orchestrator 想走 executor PR flow。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — modify 既有 popDamage / defenderHitReact / playDamageEvents signature

---

## 2. Spec drift check (P6)

1. 確認 chore #208 fix `defenderHitReact` (line ~2629) 已 lift cell zIndex 3500 during shake
2. 確認 chore #208 `playDamageEvents` (line ~2486) 已 call defenderHitReact + popDamage
3. 確認 curse proc 在 spinLoop line ~2148-2185 (curseStack ≥ 3 → distributeDamage + curseHud flash + playDamageEvents)
4. 確認 SYMBOLS curse color 為 `0x8b3aaa` (palette 參考)
5. 確認 `playSideResonanceBanner` (line ~1667) 為 banner pattern 範本

---

## 3. Task

### Single commit — Curse proc visual distinction

#### 3a. `defenderHitReact` 加 source param + 紫色 overlay

`src/screens/BattleScreen.ts` line ~2629：

當前：
```ts
private defenderHitReact(side: 'A' | 'B', slotIndex: number): void {
  const cells = side === 'A' ? this.cellsA : this.cellsB;
  const ref = cells[slotIndex];
  if (!ref) return;
  const c = ref.container;
  const origX = c.x;
  const origZ = c.zIndex;

  c.zIndex = 3500;

  const overlay = new Graphics()
    .rect(-NINE_CELL_SIZE / 2, -SPIRIT_H, NINE_CELL_SIZE, SPIRIT_H)
    .fill({ color: 0xff2020, alpha: 0.85 });
  c.addChild(overlay);

  void tween(350, p => {
    const shakeAmp = 10 * (1 - p);
    c.x = origX + Math.sin(p * Math.PI * 8) * shakeAmp;
    overlay.alpha = 0.85 * (1 - p);
  }, Easings.easeOut).then(() => {
    c.x = origX;
    c.zIndex = origZ;
    if (!overlay.destroyed) overlay.destroy();
  });
}
```

改成：
```ts
private defenderHitReact(side: 'A' | 'B', slotIndex: number, source: 'win' | 'curse' = 'win'): void {
  const cells = side === 'A' ? this.cellsA : this.cellsB;
  const ref = cells[slotIndex];
  if (!ref) return;
  const c = ref.container;
  const origX = c.x;
  const origZ = c.zIndex;

  c.zIndex = 3500;

  // chore #209: purple flash for curse, red for win-line
  const overlayColor = source === 'curse' ? 0x9933ee : 0xff2020;
  const overlay = new Graphics()
    .rect(-NINE_CELL_SIZE / 2, -SPIRIT_H, NINE_CELL_SIZE, SPIRIT_H)
    .fill({ color: overlayColor, alpha: 0.85 });
  c.addChild(overlay);

  void tween(350, p => {
    const shakeAmp = 10 * (1 - p);
    c.x = origX + Math.sin(p * Math.PI * 8) * shakeAmp;
    overlay.alpha = 0.85 * (1 - p);
  }, Easings.easeOut).then(() => {
    c.x = origX;
    c.zIndex = origZ;
    if (!overlay.destroyed) overlay.destroy();
  });
}
```

#### 3b. `popDamage` 加 source param + 紫色 fill

`src/screens/BattleScreen.ts` line ~2658：

當前 fill 為 `T.CTA.red`，改成：

```ts
private async popDamage(side: 'A' | 'B', slotIndex: number, amount: number, source: 'win' | 'curse' = 'win'): Promise<void> {
  if (amount <= 0) return;
  const pos = this.slotToArenaPos(side, slotIndex);
  const cx  = pos.x;
  const cy  = pos.y - SPIRIT_H / 2;

  // chore #209: purple `-N` for curse, red for win-line
  const dmgFill = source === 'curse' ? 0xc266ff : T.CTA.red;
  const txt = new Text({
    text: `-${amount}`,
    style: {
      fontFamily: T.FONT.num, fontWeight: '700',
      fontSize: 34,
      fill: dmgFill,
      stroke: { color: 0x000, width: 5 },
      dropShadow: { color: 0x000000, alpha: 0.7, blur: 6, distance: 2 },
    },
  });
  // ... rest unchanged (anchor / x / y / scale / fxLayer.addChild + 3 stages tween)
}
```

#### 3c. `playDamageEvents` 加 source param + forward 給 defenderHitReact + popDamage

`src/screens/BattleScreen.ts` line ~2486：

```ts
private async playDamageEvents(events: DmgEvent[], targetSide: 'A' | 'B', source: 'win' | 'curse' = 'win'): Promise<void> {
  // ... sparseToDense unchanged ...

  const pops = events.map(e => {
    const dense = sparseToDense.get(e.slotIndex);
    if (dense === undefined) {
      if (import.meta.env.DEV) {
        console.warn(`[BattleScreen] popDamage skipped — sparse slot ${e.slotIndex} not in formation`, e);
      }
      return Promise.resolve();
    }
    // chore #209: forward source for curse vs win visual differentiation
    this.defenderHitReact(targetSide, dense, source);
    return this.popDamage(targetSide, dense, e.damageTaken, source);
  });
  await Promise.all(pops);
}
```

#### 3d. 新增 `playCurseBanner(side)` helper

放在 `playDamageEvents` 後（line ~2515 附近）：

```ts
/**
 * chore #209: Curse proc banner — large "詛咒發動" with purple glow + dark vignette.
 * Plays before playDamageEvents so player sees WHY HP drops without a win line.
 */
private async playCurseBanner(side: 'A' | 'B'): Promise<void> {
  const wrap = new Container();
  wrap.zIndex = 3600;   // above resonance banner (3500) + fxLayer (3000)

  const sideX = side === 'A' ? Math.round(CANVAS_WIDTH * 0.27) : Math.round(CANVAS_WIDTH * 0.73);

  // Dark side-vignette so banner pops against arena
  const vignette = new Graphics()
    .rect(sideX - 200, 320, 400, 140)
    .fill({ color: 0x1a0033, alpha: 0.65 });
  wrap.addChild(vignette);

  const banner = new Text({
    text: '詛咒發動',
    style: {
      fontFamily: T.FONT.title,
      fontWeight: '900',
      fontSize: T.FONT_SIZE.h1,
      fill: 0xc266ff,
      stroke: { color: 0x2a0044, width: 5, join: 'round' },
      dropShadow: { color: 0x9933ee, blur: 8, distance: 0, alpha: 0.9 },
      letterSpacing: 6,
    },
  });
  banner.anchor.set(0.5, 0.5);
  banner.x = sideX;
  banner.y = 390;
  wrap.addChild(banner);

  wrap.alpha = 0;
  this.container.addChild(wrap);

  // Pulse-in + scale punch
  banner.scale.set(0.6);
  await tween(220, t => {
    wrap.alpha = t;
    banner.scale.set(0.6 + 0.4 * t);
  }, Easings.easeOut);
  banner.scale.set(1);

  await delay(700);
  await tween(280, t => { wrap.alpha = 1 - t; }, Easings.easeIn);
  wrap.destroy({ children: true });
}
```

#### 3e. 在 spinLoop curse proc 處 wire banner + source='curse'

`src/screens/BattleScreen.ts` line ~2178：

當前：
```ts
if (curseEventsOnA.length > 0) {
  this.logLines.push(`R${this.round.toString().padStart(2, '0')}  ⚡ Curse proc A −${CURSE_PROC_DMG}`);
  await this.playDamageEvents(curseEventsOnA, 'A');
}
if (curseEventsOnB.length > 0) {
  this.logLines.push(`R${this.round.toString().padStart(2, '0')}  ⚡ Curse proc B −${CURSE_PROC_DMG}`);
  await this.playDamageEvents(curseEventsOnB, 'B');
}
```

改成：
```ts
if (curseEventsOnA.length > 0) {
  this.logLines.push(`R${this.round.toString().padStart(2, '0')}  ⚡ Curse proc A −${CURSE_PROC_DMG}`);
  // chore #209: banner first so player sees WHY HP drops without a win line
  await this.playCurseBanner('A');
  await this.playDamageEvents(curseEventsOnA, 'A', 'curse');
}
if (curseEventsOnB.length > 0) {
  this.logLines.push(`R${this.round.toString().padStart(2, '0')}  ⚡ Curse proc B −${CURSE_PROC_DMG}`);
  await this.playCurseBanner('B');
  await this.playDamageEvents(curseEventsOnB, 'B', 'curse');
}
```

> **Trade-off**：banner sequential await (1.2s 共 220+700+280) 加長 round 時間，但 owner 試玩明確要求「更明顯」— UX 優先。

> **不動**：existing curseHudA/B HUD scale flash (line 2156-2163, 2168-2175) — 保留作為次要回饋。

**Commit**: `feat(chore): curse proc visual distinction — '詛咒發動' banner + purple -N + purple shake flash (vs red for win-line dmg)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/BattleScreen.ts` —
  - `defenderHitReact` 加 source param + overlayColor
  - `popDamage` 加 source param + dmgFill
  - `playDamageEvents` 加 source param + forward
  - 新增 `playCurseBanner(side)` helper
  - spinLoop curse proc 處 wire banner + source='curse'

**禁止**：
- 動 `distributeDamage` / `DmgEvent` 結構
- 動 curseStack 累積邏輯 / proc 條件
- 動 win-line dmg 路徑視覺（default source='win' 必須行為跟現在 100% 一致）
- 動 chore #208 cell zIndex 3500 lift 邏輯
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "source.*=.*'win'\|source.*=.*'curse'" src/screens/BattleScreen.ts` — 應有 4 個 default 'win' (defenderHitReact / popDamage / playDamageEvents 三個 signature + 一個 spinLoop call 用 'curse')
   - `grep "playCurseBanner\|詛咒發動" src/screens/BattleScreen.ts` — banner helper + spinLoop 兩個 call site
   - `grep "0xc266ff\|0x9933ee" src/screens/BattleScreen.ts` — purple text + purple overlay
5. **Preview 驗證**：
   - 連續 spin 累 curseStack 到 3 (col 0-1 或 col 3-4 多 curse 符號)
   - proc 時：「詛咒發動」banner 在該側出現（A 左 / B 右）+ 紫光 + scale punch
   - HP 扣血 popDamage 是**紫色** `-N`（不是紅色）
   - 受擊 spirit shake + **紫色** flash（不是紅色）
   - win-line dmg（沒 curse proc 時）仍**紅色** + 紅 flash（unchanged）
6. **Audit per chore #203 lesson**：grep 全 codebase 確認沒其他 popDamage / defenderHitReact 直接 call 漏 forward source

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 截圖（curse proc banner + 紫色 -N + 紫色 flash 對比 win-line 紅色）
- spec deviations: 1 (curse proc 視覺加 banner — owner-approved 2026-05-05)
- Process check：`git log --oneline origin/master | head -3` 確認 commit on master
