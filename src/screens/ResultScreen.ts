import { Application, Container, Graphics, Rectangle, Text } from 'pixi.js';
import type { Screen } from './ScreenManager';
import { goldText } from '@/components/GoldText';
import * as T from '@/config/DesignTokens';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/config/GameConfig';
import { tween, Easings } from '@/systems/tween';

// ── res-01: Battle result contract ───────────────────────────────────────────

export type MatchOutcome = 'A_WIN' | 'B_WIN' | 'A_OVERKILL' | 'B_OVERKILL' | 'DRAW';

export interface MatchResult {
  outcome:       MatchOutcome;
  walletA_start: number;
  walletA_end:   number;
  walletB_start: number;
  walletB_end:   number;
  /** Cumulative damage A dealt to B across all rounds */
  dmgDealtAtoB:  number;
  /** Cumulative damage B dealt to A across all rounds */
  dmgDealtBtoA:  number;
  roundCount:    number;
  durationMs:    number;
}

// ── Banner config per outcome ─────────────────────────────────────────────────

const BANNER_LABELS: Record<MatchOutcome, { 中: string; en: string; color: number }> = {
  A_WIN:      { 中: 'PLAYER A 勝利！',  en: 'VICTORY',          color: T.CLAN.azureGlow },
  B_WIN:      { 中: 'PLAYER B 勝利！',  en: 'VICTORY',          color: T.CLAN.vermilionGlow },
  A_OVERKILL: { 中: 'PLAYER A 完勝！',  en: 'OVERKILL VICTORY', color: T.GOLD.base },
  B_OVERKILL: { 中: 'PLAYER B 完勝！',  en: 'OVERKILL VICTORY', color: T.GOLD.base },
  DRAW:       { 中: '平手',             en: 'DRAW',             color: T.GOLD.shadow },
};

// ── ResultScreen ──────────────────────────────────────────────────────────────

export class ResultScreen implements Screen {
  private container = new Container();

  constructor(
    private result:   MatchResult,
    private onReturn: () => void,
  ) {}

  async onMount(_app: Application, stage: Container): Promise<void> {
    stage.addChild(this.container);
    this.drawBackground();
    await this.drawBanner();     // contains fade-in tween
    this.drawStatsPanel();
    this.drawMatchSummary();
    this.drawReturnButton();
  }

  async onUnmount(): Promise<void> {
    this.container.destroy({ children: true });
  }

  // ── Background ──────────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Full-screen ink-wash dark base
    const bg = new Graphics()
      .rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .fill({ color: 0x0D1421 });
    this.container.addChild(bg);

    // Left-edge gold accent bar (consistent with deck / onepager visual language)
    const goldBar = new Graphics()
      .rect(0, 0, 6, CANVAS_HEIGHT)
      .fill({ color: T.GOLD.base });
    this.container.addChild(goldBar);
  }

  // ── Victory / Defeat banner ─────────────────────────────────────────────────

  private async drawBanner(): Promise<void> {
    const cfg    = BANNER_LABELS[this.result.outcome];
    const banner = new Container();
    banner.x     = CANVAS_WIDTH / 2;
    banner.y     = 200;
    banner.alpha = 0;
    banner.scale.set(0.7);

    // Main 中文 outcome text
    // chore #218: remove GlowFilter (owner trial 2026-05-06: 文字光暈不好看). Keep goldText gradient + withShadow dropShadow as base polish.
    const mainText = goldText(cfg.中, { fontSize: 56, withShadow: true });
    mainText.anchor.set(0.5, 0.5);
    mainText.style.fill = cfg.color;
    banner.addChild(mainText);

    // Sub English label
    const subText = new Text({
      text: cfg.en,
      style: {
        fontFamily: T.FONT.body, fontWeight: '700', fontSize: 22,
        fill: T.GOLD.base, letterSpacing: 6,
      },
    });
    subText.anchor.set(0.5, 0.5);
    subText.y = 50;
    banner.addChild(subText);

    this.container.addChild(banner);

    // Fade-in + scale-up 400ms with slight overshoot bounce
    await tween(400, t => {
      banner.alpha = t;
      banner.scale.set(0.7 + 0.3 * t + 0.05 * Math.sin(Math.PI * t));
    }, Easings.easeOut);
  }

  // ── Stats panel ─────────────────────────────────────────────────────────────

  private drawStatsPanel(): void {
    const panelY   = 380;
    const colWidth = (CANVAS_WIDTH - 60) / 2;
    const colA_X   = 30;
    const colB_X   = CANVAS_WIDTH / 2 + 15;

    this.drawStatColumn('A', colA_X, panelY, colWidth, T.CLAN.azureGlow);
    this.drawStatColumn('B', colB_X, panelY, colWidth, T.CLAN.vermilionGlow);
  }

  private drawStatColumn(
    side:   'A' | 'B',
    x:      number,
    y:      number,
    w:      number,
    accent: number,
  ): void {
    const r            = this.result;
    const wallet_start = side === 'A' ? r.walletA_start : r.walletB_start;
    const wallet_end   = side === 'A' ? r.walletA_end   : r.walletB_end;
    const dmgDealt     = side === 'A' ? r.dmgDealtAtoB  : r.dmgDealtBtoA;
    const dmgTaken     = side === 'A' ? r.dmgDealtBtoA  : r.dmgDealtAtoB;
    const walletDelta  = wallet_end - wallet_start;

    // Box background
    const bg = new Graphics()
      .roundRect(x, y, w, 320, 14)
      .fill({ color: 0x000000, alpha: 0.5 })
      .stroke({ width: 2, color: accent, alpha: 0.7 });
    this.container.addChild(bg);

    // PLAYER A / B label
    const playerLabel = new Text({
      text: `PLAYER ${side}`,
      style: {
        fontFamily: T.FONT.body, fontWeight: '700', fontSize: 16,
        fill: accent, letterSpacing: 4,
      },
    });
    playerLabel.anchor.set(0.5, 0);
    playerLabel.x = x + w / 2;
    playerLabel.y = y + 16;
    this.container.addChild(playerLabel);

    // Stat rows
    const rows: Array<{ 中: string; val: string; color?: number }> = [
      { 中: '錢包',     val: `${Math.round(wallet_end).toLocaleString()} NTD` },
      { 中: '輸贏',     val: `${walletDelta >= 0 ? '+' : ''}${Math.round(walletDelta).toLocaleString()} NTD`,
                        color: walletDelta >= 0 ? 0x4ade80 : 0xff6b6b },
      { 中: '造成傷害', val: Math.round(dmgDealt).toLocaleString() },
      { 中: '承受傷害', val: Math.round(dmgTaken).toLocaleString() },
    ];

    let rowY = y + 60;
    for (const row of rows) {
      const labelTxt = new Text({
        text: row.中,
        style: { fontFamily: T.FONT.body, fontWeight: '600', fontSize: 13, fill: 0xB8AC92 },
      });
      labelTxt.anchor.set(0, 0.5);
      labelTxt.x = x + 16;
      labelTxt.y = rowY;
      this.container.addChild(labelTxt);

      const valTxt = new Text({
        text: row.val,
        style: {
          fontFamily: T.FONT.num,
          fontWeight: '700',
          fontSize: 18,
          fill: row.color ?? T.GOLD.base,
        },
      });
      valTxt.anchor.set(1, 0.5);
      valTxt.x = x + w - 16;
      valTxt.y = rowY;
      this.container.addChild(valTxt);

      rowY += 60;
    }
  }

  // ── Match summary ────────────────────────────────────────────────────────────

  private drawMatchSummary(): void {
    const r       = this.result;
    const minutes = Math.floor(r.durationMs / 60000);
    const seconds = Math.floor((r.durationMs % 60000) / 1000);

    const summaryText = new Text({
      text: `回合數 ${r.roundCount}    對戰時長 ${minutes}:${seconds.toString().padStart(2, '0')}`,
      style: {
        fontFamily: T.FONT.body, fontWeight: '500', fontSize: 14,
        fill: 0xB8AC92, letterSpacing: 3,
      },
    });
    summaryText.anchor.set(0.5, 0);
    summaryText.x = CANVAS_WIDTH / 2;
    summaryText.y = 770;
    this.container.addChild(summaryText);
  }

  // ── Return button ────────────────────────────────────────────────────────────

  private drawReturnButton(): void {
    const btnW = 280, btnH = 72;
    const btnX = (CANVAS_WIDTH - btnW) / 2;
    const btnY = 1080;

    // chore #213: wrapper Container pattern (mirror BattleScreen SPIN button) — atomic hit-test target.
    // Was sibling layout (bg + 2 Texts → this.container) which let text glyph bounds intermittently
    // swallow clicks despite chore #176 explicit hitArea. The wrapper makes children non-competing.
    const btn = new Container();
    btn.x = btnX;
    btn.y = btnY;

    const bg = new Graphics()
      .roundRect(0, 0, btnW, btnH, 14)            // local coords (wrapper handles offset)
      .fill({ color: T.GOLD.base })
      .stroke({ width: 2, color: T.GOLD.shadow });
    btn.addChild(bg);

    const txt中 = new Text({
      text: '返回 DRAFT',
      style: {
        fontFamily: T.FONT.body, fontWeight: '700', fontSize: 22,
        fill: 0x0D1421, letterSpacing: 4,
      },
    });
    txt中.anchor.set(0.5, 0.5);
    txt中.x = btnW / 2;
    txt中.y = btnH / 2 - 6;
    txt中.eventMode = 'none';                     // chore #213 belt-and-suspenders
    btn.addChild(txt中);

    const txtEn = new Text({
      text: 'Back to Draft',
      style: {
        fontFamily: T.FONT.body, fontWeight: '500', fontSize: 11,
        fill: 0x0D1421, letterSpacing: 2, fontStyle: 'italic',
      },
    });
    txtEn.anchor.set(0.5, 0.5);
    txtEn.x = btnW / 2;
    txtEn.y = btnH / 2 + 14;
    txtEn.eventMode = 'none';                     // chore #213 belt-and-suspenders
    btn.addChild(txtEn);

    // chore #213: hit-test on wrapper Container (atomic target), not on bg sibling
    btn.hitArea   = new Rectangle(0, 0, btnW, btnH);
    btn.eventMode = 'static';
    btn.cursor    = 'pointer';
    btn.on('pointertap', () => this.onReturn());

    this.container.addChild(btn);
  }
}
