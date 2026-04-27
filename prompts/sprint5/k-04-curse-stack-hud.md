# Sprint 5 · k-04 — Curse Stack HUD（紫骷髏 + 數字 stack indicator）

## 1. Context

PR: **BattleScreen 加 curse stack 即時 HUD：每側顯示自己累積的 stack 數，3+ 觸發時閃紫**

Why: k-02 累 stack、k-03 觸發 500 HP proc，但玩家**看不到 stack 累到哪裡**。SPEC §15.6 「Stacks 1-2: visual warning only (purple skull icon)」— 本 PR 補 HUD。

定位（m-00 後拿掉 top HP bar，原 SPEC 寫的「對手 HP bar 旁」位置不存在）：
- A 側 stack indicator：`x = 16, y = 130`（A wallet 下方靠左）
- B 側 stack indicator：`x = CANVAS_WIDTH - 16, y = 130`（B wallet 下方靠右）

視覺：
- stack 0：完全隱藏（`visible = false`）
- stack 1-2：顯示 `🟣☠×N`（紫圓底 + 骷髏 emoji 或 ☠ 字 + 數字），alpha 0.7
- stack 3+（proc 當回合 1 frame 內看到）：放大 1.3× + 紫色 GlowFilter pulse 250ms 後歸 0

注意：因 k-03 在同一回合就 reset stack，玩家看不到「3」這個數字實際停留 — 只看到 1 → 2 → flash 後消失。可接受。

Source:
- PR #115 k-03 proc 邏輯
- BattleScreen.refresh() 已有每回合呼叫點
- DesignTokens `T.SYM.scatter` (#ff3b6b) / 自訂紫色 `0x8b3aaa` (k-01 用過)
- 既有 `tween` 系統可用做 pulse

Base: master HEAD（k-03 merged）
Target: `feat/sprint5-k-04-curse-hud`

## 2. Spec drift check (P6)

1. `mempalace_search "Curse HUD stack icon BattleScreen 紫"`
2. 確認 BattleScreen 有 `curseStackA/B` fields
3. 確認 BattleScreen 有 refresh() 在每回合呼叫
4. 若 m-00 文件已寫過「對手 HP bar 旁」字眼，flag spec drift（已不存在 HP bar）

## 3. Task

### 3a. 加 class fields

```ts
// New fields (add near curseStackA/B):
private curseHudA!: Container;
private curseHudAText!: Text;
private curseHudAIcon!: Graphics;
private curseHudB!: Container;
private curseHudBText!: Text;
private curseHudBIcon!: Graphics;
```

### 3b. 新 method `drawCurseHud()` 在 onMount 呼叫

```ts
private drawCurseHud(): void {
  // A side
  this.curseHudA = new Container();
  this.curseHudA.x = 16;  this.curseHudA.y = 130;
  this.curseHudAIcon = new Graphics()
    .circle(0, 0, 9).fill({ color: 0x8b3aaa, alpha: 0.85 })
    .stroke({ width: 1.5, color: 0xffaaff, alpha: 0.9 });
  this.curseHudA.addChild(this.curseHudAIcon);
  this.curseHudAText = new Text({
    text: '×0',
    style: { fontFamily: T.FONT.num, fontSize: 12, fontWeight: '700', fill: 0xffaaff, letterSpacing: 1 },
  });
  this.curseHudAText.anchor.set(0, 0.5);
  this.curseHudAText.x = 14;  this.curseHudAText.y = 0;
  this.curseHudA.addChild(this.curseHudAText);
  this.curseHudA.visible = false;
  this.container.addChild(this.curseHudA);

  // B side mirror
  this.curseHudB = new Container();
  this.curseHudB.x = CANVAS_WIDTH - 16;  this.curseHudB.y = 130;
  this.curseHudBIcon = new Graphics()
    .circle(0, 0, 9).fill({ color: 0x8b3aaa, alpha: 0.85 })
    .stroke({ width: 1.5, color: 0xffaaff, alpha: 0.9 });
  this.curseHudB.addChild(this.curseHudBIcon);
  this.curseHudBText = new Text({
    text: '×0',
    style: { fontFamily: T.FONT.num, fontSize: 12, fontWeight: '700', fill: 0xffaaff, letterSpacing: 1 },
  });
  this.curseHudBText.anchor.set(1, 0.5);
  this.curseHudBText.x = -14;  this.curseHudBText.y = 0;
  this.curseHudB.addChild(this.curseHudBText);
  this.curseHudB.visible = false;
  this.container.addChild(this.curseHudB);
}
```

在 onMount 呼叫（位置：drawHpBars 拿掉後騰出的位置 OK）：

```ts
this.drawCurseHud();
```

### 3c. refresh() 加更新邏輯

`refresh()` method（既有，每回合呼叫）末尾加：

```ts
private refresh(): void {
  // ... existing code ...

  // Curse HUD update
  this.updateCurseHud('A', this.curseStackA);
  this.updateCurseHud('B', this.curseStackB);
}

private updateCurseHud(side: 'A' | 'B', stack: number): void {
  const hud  = side === 'A' ? this.curseHudA     : this.curseHudB;
  const text = side === 'A' ? this.curseHudAText : this.curseHudBText;
  if (stack <= 0) {
    hud.visible = false;
    return;
  }
  hud.visible = true;
  text.text = `×${stack}`;
  // Higher stack → more saturated alpha
  hud.alpha = stack >= 2 ? 1.0 : 0.7;
}
```

### 3d. Proc 閃光（選配）

k-03 在 proc 當回合直接把 stack 歸零，所以 refresh 看到的會是 0 → HUD 隱藏。要在 proc 當下短暫 flash：

在 BattleScreen.loop() k-03 proc 區塊內，在 `this.curseStackA = 0` **之前**加：

```ts
// Flash HUD before reset
const hud = side === 'A' ? this.curseHudA : this.curseHudB;
hud.visible = true;
const origScale = hud.scale.x;
hud.scale.set(1.3);
tween(250, t => {
  hud.scale.set(1.3 - 0.3 * t);
  hud.alpha = 1 - t;
}, Easings.easeOut).then(() => {
  hud.scale.set(origScale);
  hud.alpha = 1;
  hud.visible = false;
});
```

（若閃光太花時間 / >15 行，跳過接受 instant disappear，這是選配）

### 3e. onUnmount 清理

既有 `this.container.destroy({ children: true })` 會自動清掉 HUD（因為 `addChild(this.container)`），不需額外清理。

### 3f. 檔案範圍（嚴格）

**修改**：`src/screens/BattleScreen.ts` 唯一檔案。

**禁止**：
- DamageDistributor / Formation / SlotEngine / Resonance
- DesignTokens（紫色 hardcoded 0x8b3aaa 是 k-01 既有 pattern，不需新加 token）
- SymbolsConfig
- 視覺資產（純 Graphics circle）
- SPEC.md
- scripts/sim-rtp.mjs（HUD 不影響 sim）

## 4. DoD

1. `npm run build` 過
2. commit + push
3. PR URL
4. **Preview 驗證**：
   - 進 Battle 兩側 HUD 不可見（stack=0）
   - 跑幾回合，看到紫色骷髏圈出現 ×1 / ×2
   - proc 當回合 HUD 短暫消失（k-03 reset）
   - 附 1 張 mid-match 螢幕截圖（最好兩側都有 stack）

## 5. Handoff

- PR URL
- 1 行摘要
- 是否做了 §3d proc 閃光
- 截圖 link 或 inline
- Spec deviations：m-00 拿掉 top HP bar 後改放 wallet 旁，flag 此 spec adapt
