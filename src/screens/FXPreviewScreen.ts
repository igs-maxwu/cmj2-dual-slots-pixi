import { Application, Assets, Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import * as T from '@/config/DesignTokens';
import { SYMBOLS } from '@/config/SymbolsConfig';
import { attackTimeline } from './SpiritAttackChoreographer';

// chore #FX-PICK: ordered list with display data for picker
interface PickerEntry {
  num:        number;             // 1-8 keyboard shortcut
  signature:  string;             // signature name (existing key)
  spiritKey:  string;             // texture asset key
  symbolId:   number;
  cnName:     string;             // 中文名 for picker display
}

const PICKER_ENTRIES: PickerEntry[] = [
  { num: 1, signature: 'lightning-xcross',      spiritKey: 'canlan',        symbolId: 4, cnName: '蒼嵐' },
  { num: 2, signature: 'triple-dash',           spiritKey: 'luoluo',        symbolId: 5, cnName: '珞洛' },
  { num: 3, signature: 'dual-fireball',         spiritKey: 'zhuluan',       symbolId: 1, cnName: '朱鸞' },
  { num: 4, signature: 'python-summon',         spiritKey: 'zhaoyu',        symbolId: 2, cnName: '朝雨' },
  { num: 5, signature: 'dragon-dual-slash',     spiritKey: 'mengchenzhang', symbolId: 3, cnName: '孟辰璋' },
  { num: 6, signature: 'tiger-fist-combo',      spiritKey: 'yin',           symbolId: 0, cnName: '寅' },
  { num: 7, signature: 'tortoise-hammer-smash', spiritKey: 'xuanmo',        symbolId: 7, cnName: '玄墨' },
  { num: 8, signature: 'phoenix-flame-arrow',   spiritKey: 'lingyu',        symbolId: 6, cnName: '凌羽' },
];

// Backward compat: keep SIG_SPIRIT map for any caller still using it (e.g. FXDevHook)
const SIG_SPIRIT: Record<string, { spiritKey: string; symbolId: number }> =
  Object.fromEntries(PICKER_ENTRIES.map(e => [e.signature, { spiritKey: e.spiritKey, symbolId: e.symbolId }]));

export const FX_SIGNATURES: string[] = PICKER_ENTRIES.map(e => e.signature);

export class FXPreviewScreen implements Screen {
  private container = new Container();
  private stage!: Container;
  private looping = false;
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _pauseResolve: (() => void) | null = null;

  // chore #FX-PICK: picker state
  private currentIdx = 0;
  private pickerRows: Container[] = [];
  private pickerHighlight!: Graphics;
  private previewSpirit: Container | null = null;
  private loopGen = 0;

  constructor(
    signatureName: string,
    private onExit: () => void,
  ) {
    // chore #FX-PICK: resolve initial idx from URL signature name
    const idx = PICKER_ENTRIES.findIndex(e => e.signature === signatureName);
    this.currentIdx = idx >= 0 ? idx : 0;
  }

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

  onUnmount(): void {
    this.looping = false;
    if (this._pauseResolve) { this._pauseResolve(); this._pauseResolve = null; }
    if (this._onKeyDown) { window.removeEventListener('keydown', this._onKeyDown); this._onKeyDown = null; }
    this.container.destroy({ children: true });
  }

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

      // Signature name (smaller, below cn)
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
      row.on('pointertap', () => { void this.switchTo(i); });

      this.container.addChild(row);
      this.pickerRows.push(row);
    });

    // Subtle radial glow at preview-area centre (right side)
    const previewLeft = 280;
    const previewCx = previewLeft + (CANVAS_WIDTH - previewLeft) / 2;
    const glow = new Graphics();
    for (let i = 3; i >= 0; i--) {
      glow.circle(previewCx, CANVAS_HEIGHT / 2, 200 + i * 60)
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
      text: 'FX PREVIEW',
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

  private showError(msg: string): void {
    const err = new Text({
      text: msg,
      style: { fontFamily: T.FONT.body, fontSize: T.FONT_SIZE.md, fill: 0xff4444 },
    });
    err.anchor.set(0.5, 0.5);
    err.x = CANVAS_WIDTH / 2;
    err.y = CANVAS_HEIGHT / 2;
    this.container.addChild(err);
  }

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

  private async switchTo(idx: number): Promise<void> {
    if (idx === this.currentIdx) return;
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

    // Load asset + restart loop under new generation
    const entry = PICKER_ENTRIES[idx];
    const sym = SYMBOLS[entry.symbolId];
    const base = import.meta.env.BASE_URL;
    await Assets.load([{ alias: sym.spiritKey, src: `${base}assets/spirits/${sym.spiritKey}.webp` }]);

    this.looping = true;
    void this.playSignatureLoop(entry.spiritKey, entry.symbolId, this.loopGen);
  }

  private async playSignatureLoop(spiritKey: string, symbolId: number, gen: number): Promise<void> {
    while (this.looping && gen === this.loopGen) {
      // chore: attackTimeline animates a spiritContainer directly — use temp container for preview
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

      // 800 ms pause; Space key resolves early via _pauseResolve
      await new Promise<void>(resolve => {
        this._pauseResolve = resolve;
        setTimeout(() => { this._pauseResolve = null; resolve(); }, 800);
      });
      this._pauseResolve = null;
    }
  }

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
}

// Suppress unused-variable warning — SIG_SPIRIT kept for FXDevHook backward compat
void SIG_SPIRIT;
