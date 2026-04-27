// Sprint 8 p-03 — Generate IGS RD5 pitch deck .pptx
// Source: docs/pitch/sprint8-deck-outline.md
// Run:    node generate-deck.js
const pptxgen = require("pptxgenjs");

// ─── Color palette (4-Beast theme + ink-wash) ──────────────────────────────
const C = {
  // Backgrounds
  inkDark:    "0D1421",   // hero / closing (deep ink-wash)
  cream:      "F5EDE0",   // body slides
  white:      "FFFFFF",

  // Text
  inkText:    "1A1F2E",   // primary on cream
  inkSub:     "5A6378",   // secondary on cream
  creamText:  "F5EDE0",   // primary on dark
  creamSub:   "B8AC92",   // secondary on dark

  // Accents
  gold:       "C9A961",   // muted premium gold (vertical edge bar + key text)
  goldDark:   "8A6F30",
  vermilion:  "C73E1D",   // 朱雀 — also used for warning / CTA
  azure:      "4A90E2",   // 青龍
  ivory:      "E8E4D8",   // 白虎
  ebony:      "2C2C2C",   // 玄武

  // Chart colors
  band:       "8FBF7F",   // SPEC band green
  dot:        "C9A961",   // metric dot gold
};

const F = {
  header: "Cambria",
  body:   "Calibri",
};

// ─── Setup ────────────────────────────────────────────────────────────────
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';   // 10" × 5.625"
pres.author = "IGS RD5 / maxwu";
pres.title  = "Dual Slots Battle — IGS RD5 Pitch";

const W = 10, H = 5.625;

// Helper: gold left-edge bar (visual motif on every slide)
function goldBar(slide) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: H,
    fill: { color: C.gold }, line: { type: 'none' },
  });
}

// Helper: footer credit
function footer(slide, dark = false) {
  slide.addText("Dual Slots Battle  ·  IGS RD5  ·  2026", {
    x: 0.4, y: H - 0.32, w: W - 0.8, h: 0.22,
    fontSize: 8, fontFace: F.body, color: dark ? C.creamSub : C.inkSub,
    align: "left", margin: 0,
  });
  slide.addText("14 PRs / Single Session / Zero Spec Drift", {
    x: 0.4, y: H - 0.32, w: W - 0.8, h: 0.22,
    fontSize: 8, fontFace: F.body, color: dark ? C.creamSub : C.inkSub,
    align: "right", italic: true, margin: 0,
  });
}

// ─── Slide 1 — Cover / Hook ────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.inkDark };
  goldBar(s);

  // Subtitle EN (top)
  s.addText("PITCH  ·  IGS RD5", {
    x: 0.5, y: 0.5, w: W - 1, h: 0.3,
    fontSize: 11, fontFace: F.body, color: C.gold, charSpacing: 8, bold: true,
  });

  // Main title 中
  s.addText("東方四聖獸 × Vegas 1v1 對戰老虎機", {
    x: 0.5, y: 1.5, w: W - 1, h: 0.9,
    fontSize: 38, fontFace: F.header, color: C.creamText, bold: true,
    align: "left",
  });

  // EN subtitle
  s.addText('"4 Beasts of the East meets 1v1 Vegas-style PvP slots"', {
    x: 0.5, y: 2.5, w: W - 1, h: 0.5,
    fontSize: 16, fontFace: F.header, color: C.gold, italic: true,
  });

  // Three pillar bullets
  const pillars = [
    { 中: "IGS 第一款 1v1 PvP slot",          en: "IGS's first 1v1 PvP slot battle" },
    { 中: "8 spirits × 7 SPEC meta 機制",     en: "8 spirits across 7 locked meta mechanics" },
    { 中: "Live PWA · 500k spin sim 已驗證",  en: "Live PWA · 500k-spin sim verified" },
  ];
  pillars.forEach((p, i) => {
    s.addShape(pres.shapes.OVAL, {
      x: 0.6, y: 3.5 + i * 0.45, w: 0.12, h: 0.12, fill: { color: C.gold }, line: { type: 'none' },
    });
    s.addText(p.中 + "  /  " + p.en, {
      x: 0.85, y: 3.4 + i * 0.45, w: W - 2.5, h: 0.4,
      fontSize: 13, fontFace: F.body, color: C.creamText, margin: 0,
    });
  });

  // QR code stand-in (placeholder square + URL)
  s.addShape(pres.shapes.RECTANGLE, {
    x: W - 1.6, y: 3.4, w: 1.1, h: 1.1,
    fill: { color: C.creamText }, line: { color: C.gold, width: 2 },
  });
  s.addText("QR\n→ Live", {
    x: W - 1.6, y: 3.4, w: 1.1, h: 1.1,
    fontSize: 11, fontFace: F.body, color: C.inkText, align: "center", valign: "middle",
  });
  s.addText("igs-maxwu.github.io/cmj2-dual-slots-pixi", {
    x: W - 2.5, y: 4.6, w: 2.4, h: 0.22,
    fontSize: 7, fontFace: F.body, color: C.creamSub, align: "right",
  });

  footer(s, true);
}

// ─── Slide 2 — Why Now / Market Context ────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("為什麼是現在 / Why Now", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("亞洲 1v1 PvP slot 市場仍空白", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 14, fontFace: F.body, color: C.vermilion, italic: true,
  });

  // Left col: competitor matrix
  const competitors = [
    { name: "IGS 既有 slot",      tag: "PvE / RNG" },
    { name: "Coin Master",       tag: "PvE Social Layer" },
    { name: "Slotomania",        tag: "PvE / Tournament" },
  ];
  s.addText("競品定位 / Competitor positioning", {
    x: 0.5, y: 1.7, w: 4.2, h: 0.3,
    fontSize: 11, fontFace: F.body, color: C.inkSub, bold: true,
  });
  competitors.forEach((c, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y: 2.1 + i * 0.55, w: 4.2, h: 0.45,
      fill: { color: C.white }, line: { color: C.inkSub, width: 0.5 },
    });
    s.addText(c.name, {
      x: 0.7, y: 2.1 + i * 0.55, w: 2.5, h: 0.45,
      fontSize: 12, fontFace: F.body, color: C.inkText, valign: "middle", bold: true, margin: 0,
    });
    s.addText(c.tag, {
      x: 3.0, y: 2.1 + i * 0.55, w: 1.6, h: 0.45,
      fontSize: 10, fontFace: F.body, color: C.inkSub, valign: "middle", align: "right", margin: 0,
    });
  });

  // Right col: our position
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.3, y: 1.7, w: 4.2, h: 2.65,
    fill: { color: C.inkDark }, line: { type: 'none' },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.3, y: 1.7, w: 0.1, h: 2.65,
    fill: { color: C.gold }, line: { type: 'none' },
  });
  s.addText("我們在這 / We are here", {
    x: 5.5, y: 1.85, w: 3.9, h: 0.3,
    fontSize: 11, fontFace: F.body, color: C.gold, charSpacing: 6, bold: true, margin: 0,
  });
  s.addText("1v1 PvP\nSlot Battle", {
    x: 5.5, y: 2.3, w: 3.9, h: 1.2,
    fontSize: 28, fontFace: F.header, color: C.creamText, bold: true, margin: 0,
  });
  s.addText("打彼此，不打 RNG\nPlayers fight each other,\nnot the random number generator.", {
    x: 5.5, y: 3.55, w: 3.9, h: 0.8,
    fontSize: 11, fontFace: F.body, color: C.creamSub, italic: true, margin: 0,
  });

  // Bottom takeaway
  s.addText("→ 這個 niche 還沒有 dominant player；本專案 prove 出 design + tech foundation", {
    x: 0.5, y: 4.7, w: W - 1, h: 0.35,
    fontSize: 11, fontFace: F.body, color: C.inkText, italic: true,
  });

  footer(s);
}

// ─── Slide 3 — Core Gameplay Loop ──────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("核心玩法 / Core Gameplay Loop", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("一場 ~3-5 分鐘 · 平均 8.46 round 分勝負", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 13, fontFace: F.body, color: C.inkSub, italic: true,
  });

  // 4-step horizontal flow
  const steps = [
    { num: "1", 中: "5-pick Draft",    en: "Pick 5 from 8 spirits",  detail: "1000 HP × 5 = 5000 team HP" },
    { num: "2", 中: "共享 5×3 Reel",   en: "Shared 5×3 reel",        detail: "雙方同時看同一個 grid" },
    { num: "3", 中: "雙效 Spin",       en: "Dual-outcome spin",      detail: "Own coin + Opponent HP" },
    { num: "4", 中: "結算 / Resolve",  en: "Match resolves",         detail: "~8.46 rounds avg" },
  ];
  const stepW = 2.05, stepX0 = 0.6, stepY = 1.85;
  steps.forEach((st, i) => {
    const x = stepX0 + i * (stepW + 0.2);
    // Card
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: stepY, w: stepW, h: 2.4,
      fill: { color: C.white }, line: { color: C.inkSub, width: 0.5 },
    });
    // Top accent bar (gold)
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: stepY, w: stepW, h: 0.08,
      fill: { color: C.gold }, line: { type: 'none' },
    });
    // Number circle
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.2, y: stepY + 0.3, w: 0.5, h: 0.5,
      fill: { color: C.inkDark }, line: { type: 'none' },
    });
    s.addText(st.num, {
      x: x + 0.2, y: stepY + 0.3, w: 0.5, h: 0.5,
      fontSize: 18, fontFace: F.header, color: C.gold, bold: true, align: "center", valign: "middle", margin: 0,
    });
    // Title
    s.addText(st.中, {
      x: x + 0.2, y: stepY + 0.95, w: stepW - 0.4, h: 0.35,
      fontSize: 14, fontFace: F.header, color: C.inkText, bold: true, margin: 0,
    });
    s.addText(st.en, {
      x: x + 0.2, y: stepY + 1.3, w: stepW - 0.4, h: 0.3,
      fontSize: 10, fontFace: F.body, color: C.inkSub, italic: true, margin: 0,
    });
    // Detail
    s.addText(st.detail, {
      x: x + 0.2, y: stepY + 1.7, w: stepW - 0.4, h: 0.55,
      fontSize: 10, fontFace: F.body, color: C.inkText, margin: 0,
    });
  });

  // Bottom note
  s.addText("關鍵設計：A 從 col 0、B 從 col 4 獨立 ways evaluation — 共享視覺、獨立計算", {
    x: 0.5, y: 4.5, w: W - 1, h: 0.35,
    fontSize: 11, fontFace: F.body, color: C.inkText, italic: true, align: "center",
  });

  footer(s);
}

// ─── Slide 4 — 4-Beast Clan System ─────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("四聖獸系統 / 4-Beast Clan System", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("8 spirits across 4 clans · 每 clan 獨特 passive · 水墨 ink-wash 視覺主題", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 12, fontFace: F.body, color: C.inkSub, italic: true,
  });

  const clans = [
    { 中: "青龍 Azure",    en: "Dragon",   color: C.azure,     passive: "+20% dmg on 4+ way", textColor: C.white },
    { 中: "白虎 White",    en: "Tiger",    color: C.ivory,     passive: "-10% damage taken",   textColor: C.inkText },
    { 中: "朱雀 Vermilion", en: "Phoenix",  color: C.vermilion, passive: "Coin-on-kill bonus",  textColor: C.white },
    { 中: "玄武 Black",    en: "Tortoise", color: C.ebony,     passive: "Last-alive shield",   textColor: C.creamText },
  ];

  const cardW = 2.05, cardH = 1.5, x0 = 0.6, y0 = 1.85;
  clans.forEach((c, i) => {
    const col = i % 4, x = x0 + col * (cardW + 0.2), y = y0;
    // Card
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: c.color }, line: { type: 'none' },
    });
    // 中文 name
    s.addText(c.中, {
      x: x + 0.15, y: y + 0.15, w: cardW - 0.3, h: 0.45,
      fontSize: 18, fontFace: F.header, color: c.textColor, bold: true, margin: 0,
    });
    // EN
    s.addText(c.en, {
      x: x + 0.15, y: y + 0.6, w: cardW - 0.3, h: 0.3,
      fontSize: 12, fontFace: F.body, color: c.textColor, italic: true, margin: 0,
    });
    // Passive
    s.addText(c.passive, {
      x: x + 0.15, y: y + cardH - 0.55, w: cardW - 0.3, h: 0.4,
      fontSize: 10, fontFace: F.body, color: c.textColor, margin: 0,
    });
  });

  // Below: 8 spirit subtitle
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 3.55, w: W - 1.2, h: 1.0,
    fill: { color: C.white }, line: { color: C.inkSub, width: 0.5 },
  });
  s.addText("策略深度 / Strategic Depth", {
    x: 0.8, y: 3.65, w: W - 1.6, h: 0.3,
    fontSize: 11, fontFace: F.body, color: C.gold, charSpacing: 6, bold: true, margin: 0,
  });
  s.addText([
    { text: "Draft 階段思考組隊 → ", options: { bold: true } },
    { text: "Dragon stack 爆發大 / Tiger 全隊耐打 / Phoenix coin 流派 / Tortoise carry 扛 / 兩 clan 共鳴觸發 ×1.5 Resonance" },
  ], {
    x: 0.8, y: 4.0, w: W - 1.6, h: 0.55,
    fontSize: 11, fontFace: F.body, color: C.inkText, margin: 0,
  });

  footer(s);
}

// ─── Slide 5 — 7 SPEC §15 Meta Mechanics ──────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("7 種 Meta 機制 / 7 SPEC §15 Mechanics", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("業界級 slot engine · 14 PRs in single session · zero spec drift", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 12, fontFace: F.body, color: C.inkSub, italic: true,
  });

  const mechanics = [
    { id: "M1",  名: "Wild",       d: "替代任意 + ×2 mult",   tier: "base" },
    { id: "M2",  名: "Scatter",    d: "3+ 觸發 Free Spin",     tier: "base" },
    { id: "M3",  名: "Streak",     d: "連勝 mult 1→2×",         tier: "base" },
    { id: "M5",  名: "Resonance",  d: "同 clan 共鳴 ×1.5",     tier: "diff" },
    { id: "M6",  名: "Curse",      d: "紫魂 stack 3+ proc 500HP", tier: "diff" },
    { id: "M10", 名: "Free Spin",  d: "5 spins ×2 bet=0",       tier: "flag" },
    { id: "M12", 名: "Jackpot",    d: "3-tier NT$5M/500k/50k 持久", tier: "flag" },
  ];
  const tierColor = { base: C.inkSub, diff: C.azure, flag: C.gold };
  const tileW = 1.27, tileH = 1.5, gap = 0.1;
  mechanics.forEach((m, i) => {
    const col = i % 7;
    const x = 0.55 + col * (tileW + gap), y = 1.85;
    // Card
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: tileW, h: tileH,
      fill: { color: C.white }, line: { color: C.inkSub, width: 0.5 },
    });
    // Top accent
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: tileW, h: 0.06,
      fill: { color: tierColor[m.tier] }, line: { type: 'none' },
    });
    // ID
    s.addText(m.id, {
      x: x + 0.1, y: y + 0.15, w: tileW - 0.2, h: 0.3,
      fontSize: 11, fontFace: F.body, color: tierColor[m.tier], bold: true, charSpacing: 2, margin: 0,
    });
    // Name 中
    s.addText(m.名, {
      x: x + 0.1, y: y + 0.45, w: tileW - 0.2, h: 0.35,
      fontSize: 14, fontFace: F.header, color: C.inkText, bold: true, margin: 0,
    });
    // Description
    s.addText(m.d, {
      x: x + 0.1, y: y + 0.85, w: tileW - 0.2, h: 0.6,
      fontSize: 8.5, fontFace: F.body, color: C.inkSub, margin: 0,
    });
  });

  // Legend
  const legend = [
    { color: C.inkSub, label: "Base · 基礎" },
    { color: C.azure,  label: "Differentiation · 差異化" },
    { color: C.gold,   label: "Flagship · 旗艦" },
  ];
  legend.forEach((l, i) => {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.55 + i * 3.0, y: 3.7, w: 0.2, h: 0.15,
      fill: { color: l.color }, line: { type: 'none' },
    });
    s.addText(l.label, {
      x: 0.8 + i * 3.0, y: 3.6, w: 2.5, h: 0.3,
      fontSize: 10, fontFace: F.body, color: C.inkText, margin: 0,
    });
  });

  // Bottom credit
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 4.3, w: W - 1.1, h: 0.7,
    fill: { color: C.inkDark }, line: { type: 'none' },
  });
  s.addText("✓ All 7 mechanics shipped in PRs #121–#134 · Single session · 2026-04-27 · Zero spec drift", {
    x: 0.7, y: 4.3, w: W - 1.4, h: 0.7,
    fontSize: 12, fontFace: F.body, color: C.gold, valign: "middle", italic: true, margin: 0,
  });

  footer(s);
}

// ─── Slide 6 — Numbers ────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("數據驗證 / Sim Validation", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("Mulberry32 PRNG · 10k rounds × 50 runs = 500k spins · 全 metric 命中 SPEC", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 12, fontFace: F.body, color: C.inkSub, italic: true,
  });

  // 4 big stat callouts
  const stats = [
    { value: "108.74%",    label: "Coin RTP",        target: "SPEC 95-110%", pass: true },
    { value: "0.2152",     label: "Free Spin / match", target: "SPEC 0.15-0.30", pass: true },
    { value: "0.00024",    label: "JP / match",      target: "SPEC < 0.01",  pass: true },
    { value: "8.46",       label: "Round / match",   target: "Target ~8",    pass: true },
  ];
  const cardW = 2.18, cardH = 2.2, x0 = 0.55, y0 = 1.85;
  stats.forEach((st, i) => {
    const x = x0 + i * (cardW + 0.1);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: y0, w: cardW, h: cardH,
      fill: { color: C.white }, line: { color: C.inkSub, width: 0.5 },
    });
    // Pass mark (top-right corner)
    s.addShape(pres.shapes.OVAL, {
      x: x + cardW - 0.5, y: y0 + 0.15, w: 0.35, h: 0.35,
      fill: { color: C.band }, line: { type: 'none' },
    });
    s.addText("✓", {
      x: x + cardW - 0.5, y: y0 + 0.15, w: 0.35, h: 0.35,
      fontSize: 16, fontFace: F.header, color: C.white, bold: true, align: "center", valign: "middle", margin: 0,
    });
    // Big value
    s.addText(st.value, {
      x: x + 0.15, y: y0 + 0.55, w: cardW - 0.3, h: 0.85,
      fontSize: 36, fontFace: F.header, color: C.gold, bold: true, margin: 0,
    });
    // Label
    s.addText(st.label, {
      x: x + 0.15, y: y0 + 1.45, w: cardW - 0.3, h: 0.3,
      fontSize: 13, fontFace: F.body, color: C.inkText, bold: true, margin: 0,
    });
    // Target
    s.addText(st.target, {
      x: x + 0.15, y: y0 + 1.75, w: cardW - 0.3, h: 0.3,
      fontSize: 9, fontFace: F.body, color: C.inkSub, italic: true, margin: 0,
    });
  });

  // Bottom takeaway
  s.addText("→ 3 場關鍵 metric 都在 SPEC band 中段，不需 retune；JP RTP contribution 只 0.84%（progressive 慢累積）", {
    x: 0.5, y: 4.5, w: W - 1, h: 0.35,
    fontSize: 11, fontFace: F.body, color: C.inkText, italic: true, align: "center",
  });

  footer(s);
}

// ─── Slide 7 — Visual Quality Showcase ────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.inkDark };
  goldBar(s);

  s.addText("視覺品質 / Visual Quality", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.creamText, bold: true,
  });
  s.addText("SOS2 atlas FX + Pixi.js 8 GlowFilter + 300+ asset frames", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 12, fontFace: F.body, color: C.gold, italic: true,
  });

  // 6-tile mosaic placeholder grid (2 rows × 3 cols)
  const tiles = [
    { 中: "青龍 Dragon",   en: "Fire-wave dual slash"        },
    { 中: "白虎 Tiger",    en: "Triple radial flash"         },
    { 中: "玄武 Tortoise", en: "Smoke-stomp impact"          },
    { 中: "朱雀 Phoenix",  en: "Flame-arrow trail"           },
    { 中: "JP Ceremony",   en: "天/地/人 3-tier full-screen" },
    { 中: "BigWin / NearWin", en: "Non-JP overlay + teaser"   },
  ];
  const tw = 2.85, th = 1.4, tx0 = 0.55, ty0 = 1.85, tgap = 0.15;
  tiles.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = tx0 + col * (tw + tgap), y = ty0 + row * (th + tgap);
    // Tile bg
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: tw, h: th,
      fill: { color: C.creamText, transparency: 90 }, line: { color: C.gold, width: 0.5 },
    });
    // Placeholder icon area (60% of tile)
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.1, y: y + 0.1, w: tw - 0.2, h: th * 0.6,
      fill: { color: C.gold, transparency: 70 }, line: { type: 'none' },
    });
    s.addText("[ ?demo=1 截圖 ]", {
      x: x + 0.1, y: y + 0.1, w: tw - 0.2, h: th * 0.6,
      fontSize: 9, fontFace: F.body, color: C.creamSub, italic: true, align: "center", valign: "middle", margin: 0,
    });
    // Title
    s.addText(t.中, {
      x: x + 0.15, y: y + th * 0.62, w: tw - 0.3, h: 0.25,
      fontSize: 11, fontFace: F.header, color: C.creamText, bold: true, margin: 0,
    });
    // Subtitle
    s.addText(t.en, {
      x: x + 0.15, y: y + th * 0.85, w: tw - 0.3, h: 0.25,
      fontSize: 8, fontFace: F.body, color: C.creamSub, italic: true, margin: 0,
    });
  });

  s.addText("替換截圖：node 跑 puppeteer 訪問 ?demo=1 → 自動 capture 6 張", {
    x: 0.5, y: 4.85, w: W - 1, h: 0.3,
    fontSize: 9, fontFace: F.body, color: C.creamSub, italic: true, align: "center",
  });

  footer(s, true);
}

// ─── Slide 8 — Tech Foundation ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("技術交付 / Tech Foundation", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("不是 wireframe，是真實可玩 PWA · 掃 QR code 30 秒體驗", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 12, fontFace: F.body, color: C.inkSub, italic: true,
  });

  // Left: tech stack list
  s.addText("技術棧 / Tech Stack", {
    x: 0.55, y: 1.85, w: 5.5, h: 0.3,
    fontSize: 11, fontFace: F.body, color: C.gold, bold: true, charSpacing: 6,
  });

  const techList = [
    "Pixi.js 8 + TypeScript + Vite",
    "PWA installable · workbox 162 entry precache",
    "Asset 壓縮 13MB → 5.9MB (webp Q82 + mp3 48kbps CBR)",
    "GitHub Pages auto-deploy · GitHub Actions",
    "Mulberry32 seeded PRNG · ScaleCalculator 解析公式",
  ];
  techList.forEach((t, i) => {
    s.addShape(pres.shapes.OVAL, {
      x: 0.65, y: 2.35 + i * 0.42, w: 0.12, h: 0.12, fill: { color: C.gold }, line: { type: 'none' },
    });
    s.addText(t, {
      x: 0.9, y: 2.27 + i * 0.42, w: 5.0, h: 0.32,
      fontSize: 11, fontFace: F.body, color: C.inkText, margin: 0, valign: "middle",
    });
  });

  // Right: large QR placeholder
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.4, y: 1.85, w: 3.05, h: 3.05,
    fill: { color: C.inkDark }, line: { color: C.gold, width: 2 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.6, y: 2.05, w: 2.65, h: 2.65,
    fill: { color: C.creamText }, line: { type: 'none' },
  });
  s.addText("QR\n→ Live Demo", {
    x: 6.6, y: 2.05, w: 2.65, h: 2.65,
    fontSize: 18, fontFace: F.header, color: C.inkText, align: "center", valign: "middle", bold: true, margin: 0,
  });
  s.addText("igs-maxwu.github.io/cmj2-dual-slots-pixi", {
    x: 6.4, y: 4.95, w: 3.05, h: 0.22,
    fontSize: 9, fontFace: F.body, color: C.inkSub, align: "center",
  });

  footer(s);
}

// ─── Slide 9 — Business Case ──────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("商業可行性 / Business Case", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("Target / Monetization / LiveOps", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 12, fontFace: F.body, color: C.inkSub, italic: true,
  });

  // 2x2 grid
  const cells = [
    { title: "Target Audience",       中: "30-45 男 · 亞洲市場",          en: "30-45 male, Asian market — IGS extension" },
    { title: "Monetization",          中: "Bet 100/500/2000 + IAP gem packs", en: "Tiered bets + JP pool + IAP" },
    { title: "IAP Wireframe",         中: "6 SKU · NT$30 ~ 1990",          en: "6-pack ladder vs MyCard" },
    { title: "LiveOps",               中: "Season pass + new clan + 共鳴 tournament", en: "Content engine extensible" },
  ];
  const cw = 4.3, ch = 1.4, cx0 = 0.55, cy0 = 1.85;
  cells.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = cx0 + col * (cw + 0.3), y = cy0 + row * (ch + 0.2);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cw, h: ch,
      fill: { color: C.white }, line: { color: C.inkSub, width: 0.5 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h: ch,
      fill: { color: C.vermilion }, line: { type: 'none' },
    });
    s.addText(c.title, {
      x: x + 0.2, y: y + 0.15, w: cw - 0.4, h: 0.3,
      fontSize: 10, fontFace: F.body, color: C.gold, bold: true, charSpacing: 4, margin: 0,
    });
    s.addText(c.中, {
      x: x + 0.2, y: y + 0.5, w: cw - 0.4, h: 0.4,
      fontSize: 14, fontFace: F.header, color: C.inkText, bold: true, margin: 0,
    });
    s.addText(c.en, {
      x: x + 0.2, y: y + 0.95, w: cw - 0.4, h: 0.35,
      fontSize: 9, fontFace: F.body, color: C.inkSub, italic: true, margin: 0,
    });
  });

  // Owner-data flag
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 4.7, w: W - 1.1, h: 0.5,
    fill: { color: C.vermilion, transparency: 85 }, line: { color: C.vermilion, width: 1 },
  });
  s.addText("⚠ Owner 待補：競品月流水比較資料（Marketing team）", {
    x: 0.7, y: 4.7, w: W - 1.4, h: 0.5,
    fontSize: 10, fontFace: F.body, color: C.vermilion, bold: true, valign: "middle", italic: true, margin: 0,
  });

  footer(s);
}

// ─── Slide 10 — Roadmap ────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("Roadmap · Phase 1 → 2 → 3", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("Phase 1 已完成 · Phase 2 預估 4-6 月人月", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 12, fontFace: F.body, color: C.inkSub, italic: true,
  });

  const phases = [
    { 階: "Phase 1", state: "DONE",     color: C.inkSub,    items: ["Core mechanics 7/7", "Visual polish 4/4", "Sim 平衡 RTP 95-110%"] },
    { 階: "Phase 2", state: "NEXT",     color: C.gold,      items: ["Backend + IAP", "Matchmaking server", "Live ops infra"] },
    { 階: "Phase 3", state: "FUTURE",   color: C.creamSub,  items: ["LiveOps content engine", "海外市場開拓", "Season pass / new clan"] },
  ];
  const pw = 2.95, ph = 2.7, px0 = 0.55, py0 = 1.85;
  phases.forEach((p, i) => {
    const x = px0 + i * (pw + 0.1);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: py0, w: pw, h: ph,
      fill: { color: C.white }, line: { color: p.color, width: 1.5 },
    });
    // Top color bar
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: py0, w: pw, h: 0.5,
      fill: { color: p.color }, line: { type: 'none' },
    });
    s.addText(p.階, {
      x: x + 0.15, y: py0 + 0.05, w: pw - 0.3, h: 0.4,
      fontSize: 14, fontFace: F.header, color: i === 1 ? C.inkDark : C.white, bold: true, valign: "middle", margin: 0,
    });
    s.addText(p.state, {
      x: x + 0.15, y: py0 + 0.05, w: pw - 0.3, h: 0.4,
      fontSize: 11, fontFace: F.body, color: i === 1 ? C.inkDark : C.white, charSpacing: 6, bold: true, align: "right", valign: "middle", margin: 0,
    });
    // Items
    p.items.forEach((it, j) => {
      s.addShape(pres.shapes.OVAL, {
        x: x + 0.2, y: py0 + 0.85 + j * 0.5, w: 0.12, h: 0.12,
        fill: { color: p.color }, line: { type: 'none' },
      });
      s.addText(it, {
        x: x + 0.45, y: py0 + 0.78 + j * 0.5, w: pw - 0.6, h: 0.4,
        fontSize: 11, fontFace: F.body, color: C.inkText, valign: "middle", margin: 0,
      });
    });
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 4.75, w: W - 1.1, h: 0.4,
    fill: { color: C.vermilion, transparency: 85 }, line: { color: C.vermilion, width: 1 },
  });
  s.addText("⚠ Owner 待補：Phase 2 詳細 budget + team 配置（BE 工程師人數 / 開工時程）", {
    x: 0.7, y: 4.75, w: W - 1.4, h: 0.4,
    fontSize: 10, fontFace: F.body, color: C.vermilion, bold: true, valign: "middle", italic: true, margin: 0,
  });

  footer(s);
}

// ─── Slide 11 — Closing / CTA ─────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.inkDark };
  goldBar(s);

  s.addText("掃 QR · 玩 30 秒", {
    x: 0.5, y: 0.5, w: W - 1, h: 0.7,
    fontSize: 32, fontFace: F.header, color: C.gold, bold: true, align: "center",
  });
  s.addText("Scan to play 30 seconds", {
    x: 0.5, y: 1.2, w: W - 1, h: 0.4,
    fontSize: 14, fontFace: F.body, color: C.creamSub, italic: true, align: "center",
  });

  // Large QR placeholder centered
  s.addShape(pres.shapes.RECTANGLE, {
    x: 3.8, y: 1.85, w: 2.4, h: 2.4,
    fill: { color: C.creamText }, line: { color: C.gold, width: 3 },
  });
  s.addText("QR\n[ live demo URL ]", {
    x: 3.8, y: 1.85, w: 2.4, h: 2.4,
    fontSize: 16, fontFace: F.header, color: C.inkText, align: "center", valign: "middle", bold: true, margin: 0,
  });

  // Two question prompts below
  const questions = [
    { 中: "最有感的機制？", en: "Most engaging mechanic?" },
    { 中: "最大顧慮？",     en: "Biggest concern?" },
  ];
  questions.forEach((q, i) => {
    const x = 0.8 + i * 4.4, y = 4.45;
    s.addText(q.中, {
      x, y, w: 4.0, h: 0.3,
      fontSize: 14, fontFace: F.header, color: C.creamText, bold: true, align: "center", margin: 0,
    });
    s.addText(q.en, {
      x, y: y + 0.32, w: 4.0, h: 0.25,
      fontSize: 9, fontFace: F.body, color: C.creamSub, italic: true, align: "center", margin: 0,
    });
  });

  s.addText("Contact: maxwu / IGS RD5", {
    x: 0.4, y: H - 0.32, w: W - 0.8, h: 0.22,
    fontSize: 9, fontFace: F.body, color: C.creamSub, align: "center", italic: true, margin: 0,
  });
}

// ─── Slide 12 — Appendix / FAQ ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  goldBar(s);

  s.addText("Appendix / FAQ", {
    x: 0.5, y: 0.4, w: W - 1, h: 0.6,
    fontSize: 28, fontFace: F.header, color: C.inkText, bold: true,
  });
  s.addText("Backup material for technical / business deep-dive", {
    x: 0.5, y: 1.0, w: W - 1, h: 0.35,
    fontSize: 12, fontFace: F.body, color: C.inkSub, italic: true,
  });

  const sections = [
    { title: "Sim Raw Data",   items: ["500k spin JSON 完整輸出", "All metrics in target band", "MemPalace drawer e2bd3099c7999bbf"] },
    { title: "Tech Details",   items: ["Mulberry32 seeded PRNG", "243-Ways evaluation", "ScaleCalculator analytical EV", "JackpotPool localStorage v1"] },
    { title: "License",        items: ["SOS2 atlas: licensed art set", "Noto Sans CJK: open source", "4 Beasts IP: public domain"] },
    { title: "Source Canon",   items: ["MemPalace drawer e2bd3099c7999bbf (Sprint 6)", "MemPalace drawer 49bb64972c81b328 (Sprint 7)", "PRs #121-#134 git log"] },
  ];
  const sw = 4.3, sh = 1.4, sx0 = 0.55, sy0 = 1.85;
  sections.forEach((sec, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = sx0 + col * (sw + 0.3), y = sy0 + row * (sh + 0.2);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: sw, h: sh,
      fill: { color: C.white }, line: { color: C.inkSub, width: 0.5 },
    });
    s.addText(sec.title, {
      x: x + 0.15, y: y + 0.1, w: sw - 0.3, h: 0.3,
      fontSize: 11, fontFace: F.body, color: C.gold, bold: true, charSpacing: 4, margin: 0,
    });
    sec.items.forEach((it, j) => {
      s.addText("· " + it, {
        x: x + 0.15, y: y + 0.42 + j * 0.22, w: sw - 0.3, h: 0.22,
        fontSize: 9, fontFace: F.body, color: C.inkText, margin: 0,
      });
    });
  });

  footer(s);
}

// ─── Write file ────────────────────────────────────────────────────────────
pres.writeFile({ fileName: __dirname + "/sprint8-pitch-deck.pptx" })
  .then(fileName => console.log("Generated:", fileName));
