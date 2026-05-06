# Chore #FX-PICK — FXPreviewScreen 加 spirit picker UI（一鍵切換 8 個 signature）

## 1. Context

Owner 試玩 2026-05-06 反映：「能不能另外做個檢視器，來檢視這些動畫，不必每次開遊戲碰運氣?」

### 現況

[`FXPreviewScreen.ts`](src/screens/FXPreviewScreen.ts) 已存在（chore d-04 留下），dev mode URL `?fx=<signature>` 進入查看。**但限制**：
- 一次只看 1 個 signature
- 切換需改 URL 重整頁面
- 對審 chore #220-#227 系列 FX 升級不順手

### Fix 目標

擴充 FXPreviewScreen：左側加 8-row spirit picker，click row 或按鍵盤 1-8 即時切換，**不必改 URL 不必重整**。

純 dev tool 升級 — 不動 attackTimeline / signature 函式 / SpiritPersonality / production 流程。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit
- **`source-driven-development`** — 用既有 `SIG_SPIRIT` map + `attackTimeline`，加 picker layout + switch logic

---

## 2. Spec drift check (P6)

1. 確認 [`FXPreviewScreen.ts`](src/screens/FXPreviewScreen.ts) 結構：constructor signature / drawStaticUI / playSignatureLoop / installKeys
2. 確認 line 9-19 `SIG_SPIRIT` map 含 8 個 signature
3. 確認 [`main.ts:56-60`](src/main.ts#L56) `?fx=` URL param 進入 FXPreviewScreen
4. 確認 [`SpiritsConfig`](src/config/SymbolsConfig.ts) 內 spiritName 中文（例 `'凌羽'`）可用
5. 確認 chore #220+ 系列 FX 升級會修改 SpiritAttackChoreographer 內 signature function — picker 改完後審 #220 起會用 picker

---

## 3. Task

### Single commit — FXPreviewScreen picker upgrade

#### 3a. SIG_SPIRIT 加排序 + 中文名

`src/screens/FXPreviewScreen.ts` line 8-21：

當前是 `Record<string, ...>` 純 map。改成：

```ts
// chore #FX-PICK: ordered list with display data for picker
interface PickerEntry {
  num:        number;             // 1-8 keyboard shortcut
  signature:  string;             // signature name (existing key)
  spiritKey:  string;             // texture asset key
  symbolId:   number;
  cnName:     string;             // 中文名 for picker display
}

const PICKER_ENTRIES: PickerEntry[] = [
  { num: 1, signature: 'lightning-xcross',     spiritKey: 'canlan',        symbolId: 4, cnName: '蒼嵐' },
  { num: 2, signature: 'triple-dash',          spiritKey: 'luoluo',        symbolId: 5, cnName: '珞洛' },
  { num: 3, signature: 'dual-fireball',        spiritKey: 'zhuluan',       symbolId: 1, cnName: '朱鸞' },
  { num: 4, signature: 'python-summon',        spiritKey: 'zhaoyu',        symbolId: 2, cnName: '朝雨' },
  { num: 5, signature: 'dragon-dual-slash',    spiritKey: 'mengchenzhang', symbolId: 3, cnName: '孟辰璋' },
  { num: 6, signature: 'tiger-fist-combo',     spiritKey: 'yin',           symbolId: 0, cnName: '寅' },
  { num: 7, signature: 'tortoise-hammer-smash',spiritKey: 'xuanmo',        symbolId: 7, cnName: '玄墨' },
  { num: 8, signature: 'phoenix-flame-arrow',  spiritKey: 'lingyu',        symbolId: 6, cnName: '凌羽' },
];

// Backward compat: keep SIG_SPIRIT map for any caller still using it
const SIG_SPIRIT: Record<string, { spiritKey: string; symbolId: number }> =
  Object.fromEntries(PICKER_ENTRIES.map(e => [e.signature, { spiritKey: e.spiritKey, symbolId: e.symbolId }]));

export const FX_SIGNATURES: string[] = PICKER_ENTRIES.map(e => e.signature);
```

> 'generic' signature 從 picker 移除（不是 spirit 真正用的，作 fallback only）。SIG_SPIRIT map 保留 8 entries (不含 generic) 給 FXDevHook compat。

#### 3b. FXPreviewScreen 加 currentIdx 狀態

class fields 加：
```ts
private currentIdx = 0;            // index into PICKER_ENTRIES
private pickerRows: Container[] = []; // for highlight redraw
private pickerHighlight!: Graphics;   // movable highlight box
private previewSpirit: Container | null = null;  // current loop's spirit container ref
private loopGen = 0;               // generation counter — switch increments to invalidate old loops
```

constructor 改：
```ts
constructor(
  signatureName: string,
  private onExit: () => void,
) {
  // chore #FX-PICK: resolve initial idx from URL signature name
  const idx = PICKER_ENTRIES.findIndex(e => e.signature === signatureName);
  this.currentIdx = idx >= 0 ? idx : 0;
}
```

刪掉 `private signatureName: string;` field（用 `PICKER_ENTRIES[currentIdx].signature` 計算）。

#### 3c. drawStaticUI 加 picker panel + 改 layout

把 picker 放螢幕左側 (x 20-260)，preview 區挪到右側 (x 280+ centered)。

```ts
private drawStaticUI(): void {
  const bg = new Graphics().rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill(T.SEA.abyss);
  this.container.addChild(bg);

  // chore #FX-PICK: picker panel — left side, 8 rows
  const pickerX = 20;
  const pickerY = 80;
  const rowH = 56;
  const rowW = 240;

  // Picker title
  const pickerTitle = new Text({
    text: 'SPIRITS',
    style: {
      fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.md,
      fill: T.GOLD.base, letterSpacing: 4,
    },
  });
  pickerTitle.x = pickerX;
  pickerTitle.y = pickerY - 32;
  this.container.addChild(pickerTitle);

  // Highlight box (moves to current row)
  this.pickerHighlight = new Graphics()
    .roundRect(0, 0, rowW, rowH - 4, 6)
    .fill({ color: T.GOLD.base, alpha: 0.15 })
    .stroke({ width: 2, color: T.GOLD.glow, alpha: 0.85 });
  this.pickerHighlight.x = pickerX;
  this.pickerHighlight.y = pickerY + this.currentIdx * rowH;
  this.container.addChild(this.pickerHighlight);

  // 8 picker rows
  this.pickerRows = [];
  PICKER_ENTRIES.forEach((entry, i) => {
    const row = new Container();
    row.x = pickerX;
    row.y = pickerY + i * rowH;

    // Number badge (left)
    const num = new Text({
      text: String(entry.num),
      style: {
        fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.lg,
        fill: T.GOLD.glow,
      },
    });
    num.anchor.set(0.5, 0.5);
    num.x = 20;
    num.y = (rowH - 4) / 2;
    row.addChild(num);

    // Chinese name (mid)
    const cn = new Text({
      text: entry.cnName,
      style: {
        fontFamily: T.FONT.title, fontWeight: '700', fontSize: T.FONT_SIZE.md,
        fill: T.FG.cream,
      },
    });
    cn.anchor.set(0, 0.5);
    cn.x = 50;
    cn.y = (rowH - 4) / 2 - 8;
    row.addChild(cn);

    // Signature name (right, smaller)
    const sig = new Text({
      text: entry.signature,
      style: {
        fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.xs,
        fill: T.FG.muted, letterSpacing: 1,
      },
    });
    sig.anchor.set(0, 0.5);
    sig.x = 50;
    sig.y = (rowH - 4) / 2 + 10;
    row.addChild(sig);

    // Click handler
    row.eventMode = 'static';
    row.cursor    = 'pointer';
    row.hitArea   = new Rectangle(0, 0, rowW, rowH - 4);
    row.on('pointertap', () => this.switchTo(i));

    this.container.addChild(row);
    this.pickerRows.push(row);
  });

  // Subtle radial glow at preview-area centre (right side)
  const previewCx = 280 + (CANVAS_WIDTH - 280) / 2;
  const previewCy = CANVAS_HEIGHT / 2;
  const glow = new Graphics();
  for (let i = 3; i >= 0; i--) {
    glow.circle(previewCx, previewCy, 200 + i * 60)
      .fill({ color: T.SEA.deep, alpha: 0.10 });
  }
  this.container.addChild(glow);

  // Target position markers on right preview area
  for (const tp of this.targetPositions()) {
    const marker = new Graphics();
    marker.circle(tp.x, tp.y, 18).fill({ color: T.SEA.rim, alpha: 0.50 });
    marker.circle(tp.x, tp.y, 18).stroke({ width: 1.5, color: T.SEA.mid, alpha: 0.70 });
    this.container.addChild(marker);
  }

  // Header
  const header = new Text({
    text: `FX PREVIEW`,
    style: {
      fontFamily: T.FONT.num, fontWeight: '700', fontSize: T.FONT_SIZE.lg,
      fill: T.GOLD.base, letterSpacing: 4,
    },
  });
  header.anchor.set(0.5, 0);
  header.x = previewCx;
  header.y = 32;
  this.container.addChild(header);

  // Footer hint
  const footer = new Text({
    text: '1-8 switch · SPACE replay · ESC return',
    style: {
      fontFamily: T.FONT.num, fontSize: T.FONT_SIZE.sm,
      fill: T.FG.muted, letterSpacing: 2,
    },
  });
  footer.anchor.set(0.5, 1);
  footer.x = CANVAS_WIDTH / 2;
  footer.y = CANVAS_HEIGHT - 24;
  this.container.addChild(footer);
}
```

> 加 import：`import { Rectangle } from 'pixi.js';`

#### 3d. targetPositions 改右側 preview area

```ts
private targetPositions(): { x: number; y: number }[] {
  // chore #FX-PICK: shifted right to make room for picker panel on left
  const previewLeft = 280;
  const previewW = CANVAS_WIDTH - previewLeft;
  const previewCx = previewLeft + previewW / 2;
  const y = Math.round(CANVAS_HEIGHT * 0.72);
  return [
    { x: previewCx - 60, y },
    { x: previewCx,      y },
    { x: previewCx + 60, y },
  ];
}
```

> spiritContainer 起點也要改右側：playSignatureLoop 內 `previewSpirit.x = previewLeft + 80`（左 quartile of preview area）。

#### 3e. switchTo 邏輯

```ts
private async switchTo(idx: number): Promise<void> {
  if (idx === this.currentIdx) return;       // already on this spirit
  if (idx < 0 || idx >= PICKER_ENTRIES.length) return;

  this.currentIdx = idx;
  this.loopGen++;                            // invalidate old loop iteration
  this.looping = false;                      // signal current loop to break
  if (this._pauseResolve) {                  // skip 800ms gap
    this._pauseResolve();
    this._pauseResolve = null;
  }

  // Move highlight box
  const rowH = 56;
  this.pickerHighlight.y = 80 + idx * rowH;

  // Wait a frame for current loop to exit (or just start new — old loop will see gen mismatch and exit)
  // Then load asset + restart
  const entry = PICKER_ENTRIES[idx];
  const sym = SYMBOLS[entry.symbolId];
  const base = import.meta.env.BASE_URL;
  await Assets.load([{ alias: sym.spiritKey, src: `${base}assets/spirits/${sym.spiritKey}.webp` }]);

  this.looping = true;
  void this.playSignatureLoop(entry.spiritKey, entry.symbolId, this.loopGen);
}
```

#### 3f. playSignatureLoop 加 generation guard

```ts
private async playSignatureLoop(spiritKey: string, symbolId: number, gen: number): Promise<void> {
  while (this.looping && gen === this.loopGen) {
    const previewSpirit = new Container();
    previewSpirit.x = 280 + 80;     // chore #FX-PICK: left of preview area, right of picker
    previewSpirit.y = Math.round(CANVAS_HEIGHT * 0.50);
    this.stage.addChild(previewSpirit);
    this.previewSpirit = previewSpirit;

    await attackTimeline({
      stage:           this.stage,
      spiritContainer: previewSpirit,
      symbolId,
      spiritKey,
      targetPositions: this.targetPositions(),
    });

    if (!previewSpirit.destroyed) previewSpirit.destroy();
    this.previewSpirit = null;

    if (!this.looping || gen !== this.loopGen) break;

    await new Promise<void>(resolve => {
      this._pauseResolve = resolve;
      setTimeout(() => { this._pauseResolve = null; resolve(); }, 800);
    });
    this._pauseResolve = null;
  }
}
```

> `gen === this.loopGen` 確保切換時舊 loop 自動退出，新 loop 接手。

#### 3g. installKeys 加 1-8 key handler

```ts
private installKeys(): void {
  this._onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      this.onExit();
    } else if (e.code === 'Space') {
      if (this._pauseResolve) {
        this._pauseResolve();
        this._pauseResolve = null;
      }
    } else if (e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= 8) {
        e.preventDefault();
        void this.switchTo(num - 1);
      }
    }
  };
  window.addEventListener('keydown', this._onKeyDown);
}
```

#### 3h. onMount 改用 currentIdx 啟動

```ts
async onMount(_app: Application, stage: Container): Promise<void> {
  this.stage = stage;
  stage.addChild(this.container);
  this.drawStaticUI();

  const entry = PICKER_ENTRIES[this.currentIdx];
  const sym = SYMBOLS[entry.symbolId];
  const base = import.meta.env.BASE_URL;
  await Assets.load([{ alias: sym.spiritKey, src: `${base}assets/spirits/${sym.spiritKey}.webp` }]);

  this.installKeys();
  this.looping = true;
  this.loopGen = 0;
  void this.playSignatureLoop(entry.spiritKey, entry.symbolId, this.loopGen);
}
```

> showError 路徑保留（萬一 PICKER_ENTRIES 索引異常）。

#### 3i. main.ts URL param 處理（不動）

[`main.ts:57-60`](src/main.ts#L57) 仍接 `?fx=<name>`，FXPreviewScreen constructor resolve idx 自動處理 — 不必動 main.ts。

**Commit**: `feat(chore): FXPreviewScreen picker UI — left-side 8-row spirit list, click/1-8 keys to switch instantly without URL change`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/FXPreviewScreen.ts` — 整段 picker UI + switchTo + loopGen guard + key handler

**禁止**：
- 動 `attackTimeline` 函式 / signature dispatch
- 動 `SpiritAttackChoreographer.ts` 內任何 signature 實作（chore #220+ 各自負責）
- 動 `FXDevHook.ts` (window.__DEV_FX) — 仍可獨立用
- 動 `main.ts` URL param routing
- 動 SymbolsConfig
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + commit URL
4. **Pre-merge audit**：
   - `grep "PICKER_ENTRIES\|switchTo\|loopGen" src/screens/FXPreviewScreen.ts` — 應齊全
   - `grep "FX_SIGNATURES\|SIG_SPIRIT" src/screens/FXPreviewScreen.ts` — backward compat 保留
5. **Preview 驗證**：
   - 進 `?fx=lightning-xcross` (蒼嵐) — 左側顯示 8-row picker，蒼嵐 row 1 highlighted
   - 動畫在右側 preview area loop 播放
   - 按鍵盤 `3` → 即時切到朱鸞 (dual-fireball) loop
   - Click row 「玄墨」 → 切到 tortoise-hammer-smash loop
   - SPACE 按下 → 跳過 800ms gap 立即重播當前 spirit
   - ESC 返回 game
   - 切換 8 個 signature 全跑一遍無 crash / asset load OK / 動畫順
6. **Audit per chore #203 lesson**：grep 全 codebase 確認 FX_SIGNATURES / SIG_SPIRIT 仍可被 FXDevHook 用 (line 38 attackTimeline call)

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1 張截圖（FXPreviewScreen 新 picker UI）
- spec deviations: 0 (純 dev tool 升級)
- Process check：照新 pattern — 把 git 操作串在**單一 Bash call**

---

## 6. orchestrator note

本 chore 完成後，chore #220 (蒼嵐 FX upgrade) 才開始 dispatch。owner 用 picker 一鍵切看 8 個 spirit 動畫，審 FX 變得快速。
