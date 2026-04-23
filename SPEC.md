# DualSlot-Pixi · Game Specification v1.0

**Locked date**: 2026-04-22
**Engine**: Pixi.js 8 + Vite + TypeScript
**Orientation**: Portrait 720 × 1280 (mobile-first)
**Status**: Sprint 0 + early Sprint 1 (T0/T2) merged to master on 2026-04-22.

---

## 1. One-Liner

Two players share one 5 × 3 **Ways-to-Win** slot machine. Each symbol win triggers the
matching spirit to leap out of its formation and execute a centre-stage attack animation
against the opponent's formation. First side to zero HP loses; simultaneous death is
resolved by overkill tiebreaker.

---

## 2. Core Loop (target 8–12 s / round)

| Step | Player A (left) | Shared system | Player B (right) |
|---|---|---|---|
| 1 | Wallet − bet | — | Wallet − bet |
| 2 | — | Shared reel SPIN | — |
| 3 | — | Stop sequence: **R1+R5 at 0.6 s → R2+R4 at 1.1 s → R3 at 1.6 s** | — |
| 4 | A-side Ways eval (L→R, 243 ways) | grid evaluated simultaneously | B-side Ways eval (R→L, 243 ways) |
| 5 | A's spirits leap-attack (parallel) | — | B's spirits leap-attack (parallel) |
| 6 | Wallet += win × coinScale | damage applied to opponent HP | Wallet += win × coinScale |
| 7 | HP ≤ 0 → lose; double-death → overkill tiebreaker | | |

---

## 3. Layout (720 × 1280 portrait, final post-rebalance)

| y | Section | Height | Purpose |
|---|---|---|---|
| 14 | Header | 60 px | `雀靈戰記 · BATTLE` + round counter |
| 90 | HP bars + VS badge | 40 px | Player A / Player B team HP |
| 138 | **JP placeholder area** | 200 px | Jackpot/Grand/Major counters (design-pending) |
| 360 | Formation A / B | 216 px | 3 × 3 grids, cell 68 px |
| 610 | **Slot reel (primary)** | 498 px | 5 × 3 grid, cell 128 × 150, REEL_W 692 |
| 1150 | Log | 60 px | Last 3 round results |
| 1230 | Back button | 50 px | Return to draft |

Safe zones: 60 px top + bottom for mobile notch.

---

## 4. Spirits × Symbols (1:1 binding)

8 spirits = 8 symbols, spanning 4 mythological beasts (2 spirits per beast):

| Beast | Spirit (gender) | Symbol asset | Sprint 1 T0 priority |
|---|---|---|---|
| Azure Dragon | **Canlan** 蒼嵐 (female) | `canlan.png` | ⭐ Sprint 1 (female batch) |
| Azure Dragon | Meng 孟辰璋 (male) | `mengchenzhang.png` | Sprint 3 (generic placeholder for now) |
| White Tiger | **Luoluo** 珞洛 (female) | `luoluo.png` | ⭐ Sprint 1 (female batch) |
| White Tiger | Yin 寅 (male) | `yin.png` | Sprint 3 |
| Vermilion Phoenix | **Zhuluan** 朱鸞 (female) | `zhuluan.png` | ⭐ Sprint 1 (female batch) |
| Vermilion Phoenix | Lingyu 凌羽 (male) | `lingyu.png` | Sprint 3 |
| Black Tortoise | **Zhaoyu** 朝雨 (female) | `zhaoyu.png` | ⭐ Sprint 1 (female batch) |
| Black Tortoise | Xuanmo 玄墨 (male) | `xuanmo.png` | Sprint 3 |

**Draft rules**: each player picks **4 spirits** to their formation. All 8 symbol types
always appear on the reel (RTP stability). Non-drafted spirit hits pay at **30 %**
(mercenary mode) with weaker visual FX (see §7).

---

## 5. Reel

### 5.1 Grid

- 5 columns × 3 rows = 15 visible cells
- 243 ways/side = 3⁵; min 3-reel consecutive from the anchor column
  - Player A anchor = col 0 (L→R)
  - Player B anchor = col 4 (R→L)
- All ways pay; visual highlights cap at top 12 ways per spin, then Mega Win overlay

### 5.2 Stop sequence (locked)

| Beat | Columns | Lock time | Notes |
|---|---|---|---|
| 1 | R1 + R5 | **t = 0.6 s** | Outer pair, start at t=0 |
| 2 | R2 + R4 | **t = 1.1 s** | Inner pair, start at t=0.5 s |
| 3 | R3 | **t = 1.6 s** | Centre reel, gold pre-flash + slow-mo anticipation |

Each beat separated by 500 ms. Centre reel has an extra 200 ms gold anticipation
flash before its spin starts.

**Conditional extension**: when B4 teaser triggers (see §11), R3 pre-flash extends from 200 ms → 400 ms and R3 lock shifts to ~1.8 s.

### 5.3 Settle animation (T2)

After lock, each reel runs: compress scale (0.90 outer / 0.85 centre) → `backOut`
overshoot (240 ms outer / 300 ms centre) → stop-flash.

---

## 6. Win Tiers

| Ways hit | Tier | Visual |
|---|---|---|
| 0 | — | fast skip to next round |
| 1 – 3 | Small Win | cell flash + subtle ping |
| 4 – 10 | Nice Win | individual way highlights + spirit leap-out (drafted only) |
| 11 – 30 | Big Win | sequenced leaps + screen accents |
| 30 + | Mega / Jackpot | full-screen ceremony, spirit rain, slow-mo (Sprint 2) |

---

## 7. Spirit Attack Choreography (T0 Signature)

**Framework** (implemented 2026-04-22): `src/screens/SpiritAttackChoreographer.ts`

Phases (1.2 s total for drafted spirits):

| Phase | Duration | Effect |
|---|---|---|
| Prepare | 0.13 s | Scale-up pulse at formation slot |
| Leap | 0.30 s | Parabolic arc to centre-stage |
| Hold | 0.18 s | Charge pose + particle swirl |
| Fire | 0.27 s | Signature attack animation (per spirit) |
| Return | 0.24 s | Arc back to formation |

### 7.1 Drafted spirit FX (full ceremony)

- Leap-out + ink-brush trail
- Signature animation (per spirit, see §7.2)
- Screen flash + camera shake + 60 ms hitstop
- Damage number popup with bitmap text

### 7.2 Signatures (Sprint 1 female batch)

| Spirit | Element | Signature (0.6–0.9 s) |
|---|---|---|
| **Canlan** | Lightning | X-cross twin-blade slash, electric explosion at cross |
| **Luoluo** | Wind/claw | 3 × dash-punch @ 130 ms each + tiger-claw qi-blade finisher |
| **Zhuluan** | Fire | Dual fireball projectiles → bezier paths → dual explosion |
| **Zhaoyu** | Water/venom | Giant python summoned from enemy ground, entwines targets |

### 7.3 Non-drafted mercenary FX (weak version, 0.3 s)

Cell flash + small damage number bubble only. **No leap-out, no centre stage, no
hitstop, no screen flash.** Preserves T0 as drafted-spirit exclusive.

### 7.4 Male spirits interim

Meng / Yin / Xuanmo / Lingyu use `genericT0Template()` during Sprint 1: basic
leap + generic particle burst + return, 0.8 s. Full signatures delivered Sprint 3.

---

## 8. Win → Coin & Damage (dual-scale, locked)

```
win_coin = Σ(ways_payout × bet/100 × coinScale)   // own wallet
win_dmg  = Σ(ways_payout × bet/100 × dmgScale)    // opponent HP
```

- `coinScale` and `dmgScale` are **independent** (never collapsed to a single value)
- Non-drafted contribution: `× 0.30` on both coin and damage
- Spirit passives (Sprint 3): tiger –10 % damage taken, tortoise shield when last alive,
  dragon +20 % on 4+ match, phoenix coin-on-kill

Actuarial calibration (target RTP ≈ 95 %) deferred to Sprint 4 simulation pass.

---

## 9. HP / Victory Conditions

### 9.1 Unit HP

- Each drafted spirit has **1000 HP** → total formation HP = **4000**
- Damage distributed front-row first (A targets B's col 0,1,2; B targets A's col 2,1,0;
  within column, top-to-bottom by slot index)
- Each spirit's HP bar shown in formation UI

### 9.2 Underdog buff

When `formationHP / maxFormationHP < 0.30` → next round damage × **1.3**

### 9.3 Chip damage floor

3 consecutive 0-way spins → forced 1 way on 4th spin (anti-boredom)

### 9.4 Victory priority

1. One side HP > 0, other ≤ 0 → HP-positive side wins
2. Both sides HP ≤ 0 same round → **overkill tiebreaker**
   - `overkillA = max(0, lastDmgA − preHpB)`
   - `overkillB = max(0, lastDmgB − preHpA)`
   - Larger overkill wins; equal = **DRAW**
3. Further tie → higher total wallet wins
4. Everything equal → DRAW (rare)

---

## 10. Economy (provisional, pending Sprint 4 calibration)

| Parameter | Value | Notes |
|---|---|---|
| Starting wallet | **10 000 NTD** | both sides |
| Bet per spin | **100 NTD** | both sides |
| Baseline spins to bust | ~100 | before RTP recovery |
| Target RTP | ~95 % | to be calibrated Sprint 4 |
| Target winrate (mirror) | 50 % ± 1 % | via `fairnessExp` binary search |

---

## 11. Sprint Roadmap

Each sprint interleaves **gameplay work** with **visual polish** — visual upgrade
items (V-tier A/B/C) are distributed across phases so the build always advances
in both dimensions, preventing an "all-function-no-art" prototype cliff.

| Sprint | Gameplay Focus | Visual Polish (V-items) | Status |
|---|---|---|---|
| **Sprint 0** | Core loop (5×3 Ways, 243 ways/side, portrait, dual-scale, overkill) | UI rebalance (JP placeholder, 128×150 reel cells) | ✅ **Merged 2026-04-22** |
| **Sprint 1** | T0 attack choreography (4 females) + T1 particle-emitter + T2 reel anticipation + T3 pixi-filters + T5 hitstop | **A3** formation breathing glow · **A4** spirit-HP pulse bar (< 30 % red edge) · **B4 enhancement** R3 anticipation teaser when R1+R2 pre-match | 🟡 T0 framework + T2 + UI merged; remainder in progress |
| **Sprint 1.5** | *(interleave week, no new gameplay)* | **A2** reel symbols → spirit portrait art (replace text labels) · symbol-spirit 1:1 visible on reel | ⏸ pending |
| **Sprint 2** | T6 Big/Mega/Jackpot ceremony + T10 ink-brush transitions | **A1** 3-layer ink-wash parallax bg · **A5** ambient petal/qi particle layer · **A6** BACK button ornate redesign · **B1** bitmap gold numeric font (HP / round / win) · **B2** VS badge live (rotate + particle shed) · **B3** reel frame ornate (dragon-head corners + water ripple edge) · **B5** wallet cascade count-up · **B6** JP area real design (3-tier marquee + particle halo) · **C1** BGM (battle / big-win / victory, 3 tracks) · **C2** SFX pack (~30 cues: stop / win / skill / impact / UI) | ⏸ pending |
| **Sprint 3** | T7 4-beast theme depth + 4 male spirit signatures + trailer | **C4** 4 male spirit signature animations (Meng/Yin/Xuanmo/Lingyu) · theme-consistency audit across all art · cinematic trailer (30 s) | ⏸ pending |
| **Sprint 4** | Meta math foundation: Wild + Scatter + Streak Multiplier + Actuarial calibration (10 k sims, RTP ≈ 100 %, hit freq ≈ 60 %) **+ Lightweight optimization pass (L1–L10, target ≤ 5 MB bundle, PWA scaffolding)** | Texture/lighting QA, chromatic aberration on Mega Win, mobile performance profiling | ⏸ pending |
| **Sprint 5** | PvP differentiation: Spirit Resonance (4-beast ×2.0 open) + Curse stacking (500 HP proc) | PvP-specific HUD indicators (resonance config + curse-stack visuals) | ⏸ pending |
| **Sprint 6** | Climax + F2P: Free Spin "靈氣爆發" (~1/5 match target) + 3-tier Progressive Jackpot | JP marquee replaces placeholder; Free Spin mode gold overlay + BGM swap | ⏸ pending |
| **Sprint 7** | Launch prep: PvE AI tuning (60 % player winrate) + PvP matchmaking + seasonal system | Cosmetic seasonal spirit skins, rating badges | ⏸ pending |

### V-Tier Definitions

**Tier A (high C/P, no external resource)** — 5 days total when concentrated, distributed across Sprint 1 / 1.5 / 2:
- A1 · 3-layer ink-wash parallax background
- A2 · Reel symbols become spirit portrait art (not text labels)
- A3 · Formation cell breathing glow (alive) + greyscale cross (dead)
- A4 · Living HP bar ("靈力槽") with gradient + pulse at low HP
- A5 · Full-screen ambient particles (petals / qi / drifting motes)
- A6 · Ornate button redesign (gold rim, gem centre, hover glow)

**Tier B (medium C/P, craftsmanship polish)** — 7 days, concentrated in Sprint 2:
- B1 · Bitmap gold numeric font with shadow + gradient
- B2 · VS badge animated (slow rotate + gold particle shed + per-round pulse)
- B3 · Reel frame ornate (corner dragon-heads + flowing water ripple edge)
- B4 · R3 anticipation teaser (when R1+R2 pre-match ≥ 2 symbols)
- B5 · Wallet number cascade count-up (ka-ching digit-by-digit)
- B6 · JP area real design (placeholder → real 3-tier marquee + particle halo)

**Tier C (resource-dependent, outsourced or specialist)** — Sprint 2–3:
- C1 · BGM (3 tracks: battle / big-win / victory, 古箏 + 電音)
- C2 · SFX pack (~30 cues: stop, win, skill launches, impact, UI)
- C3 · Mega Win full-screen ceremony (Sweet Bonanza tier)
- C4 · 4 male spirit signature animations (replace genericT0Template)

### Visual Direction (locked for all sprints)

**Primary aesthetic: (a) 傳統水墨仙俠** — ink-wash ambient backgrounds + flowing
brush trails on attacks + gold/jade accent palette.

**Secondary (character assets): (b) 神獸華麗玄幻** — spirit portraits use
bright saturated 3D-chibi style for readability.

These two styles are **deliberately paired**: ink-wash world + saturated heroes
matches modern Chinese mobile game conventions (e.g. Honkai Star Rail, 陰陽師).
All new art must pass consistency check against this combined direction.

---

## 12. Reference Games

- **Mahjong Ways 2** (PG Soft) — direct competitor, same theme family
- **Sweet Bonanza** (Pragmatic) — big-win ceremony textbook
- **God of Tower** (CN market) — 4-beast art direction
- **Clash Royale** — 1v1 symmetric HUD
- **Hollow Knight** — particle + hitstop mastery

---

## 13. Change Log

| Date | Change | Source |
|---|---|---|
| 2026-04-22 | Spec v1.0 locked; merged to master as `b5ad1a8` | Owner approval |
| 2026-04-22 | Reversed decision #1: non-drafted → 30 % mercenary (was "fully ignored") | Owner |
| 2026-04-22 | Stop timing locked at 0.6 / 1.1 / 1.6 s (fast variant) | Owner |
| 2026-04-22 | UI layout rebalanced: JP placeholder + enlarged reel (128×150 cells) | Owner |
| 2026-04-22 | Sprint 1 T0 scope limited to 4 female spirits (Canlan/Luoluo/Zhuluan/Zhaoyu) | Owner |
| 2026-04-22 | V-tier visual polish plan added; roadmap restructured to interleave gameplay + visual each sprint. Direction locked: (a) 水墨仙俠 world + (b) 華麗 3D-chibi characters | Owner |
| 2026-04-22 | Math Model v1.0 locked: 7 meta mechanics (M1/M2/M3/M5/M6/M10/M12), Base Ways RTP 60 %, Sprints 5–7 added. See §15. | Owner |
| 2026-04-22 | Lightweight Strategy v1.0 locked: PWA delivery, ≤ 5 MB total session bundle, Sprint 4 concentrated optimization (L1–L10). See §16. | Owner |
| 2026-04-23 | B4 R3 anticipation teaser: R3 lock extended 1.6s→1.8s when R1+R2 or R4+R5 pre-match ≥1 symbol | Owner |
| 2026-04-23 | Spirit name canonicalization (owner decision): 燦瀾→蒼嵐, 殷→寅, 落落→珞洛, 照宇→朝雨, 玄沫→玄墨. Pinyin identifiers unchanged. Clan data fix: luoluo vermilion→white, zhaoyu white→black (aligns with SPEC §4 beast groupings). | Owner |

---

## 14. MemPalace Cross-Reference

Canonical source-of-truth drawers (Wing: GameEconomy, Room: DualSlot-engine):

- `drawer_GameEconomy_DualSlot-engine_f5c3fc3837a65de4` — SPEC v1.0 full
- `drawer_GameEconomy_DualSlot-engine_32bb76dc95c002db` — OPEN ISSUES rev1
- `drawer_GameEconomy_DualSlot-engine_7b5e30361209c686` — OPEN ISSUES rev2 (mercenary reversal)
- `drawer_GameEconomy_DualSlot-engine_6d3dd53b1b3534be` — Sprint 1 T0 storyboard + UI rebalance
- `drawer_GameEconomy_DualSlot-engine_e211526164c50a94` — CONFIRMED-SPRINT0 post-merge status
- `drawer_GameEconomy_DualSlot-engine_ce84e19b8c6d53f1` — V-Tier visual polish plan
- `drawer_GameEconomy_DualSlot-engine_fb9e15b3a631c968` — **Math Model v1.0 meta mechanics (§15 source)**
- `drawer_GameEconomy_DualSlot-engine_355b7ce2bccf855f` — **Lightweight Strategy v1.0 (§16 source)**
- "DualSlot-Pixi CORE DESIGN LOCK (2026-04-22)" — 5 pillars + blind spots

Related knowledge-graph facts:

- DualSlot-Pixi → reel_stop_timing → 0.6 / 1.1 / 1.6 s
- DualSlot-Pixi-non-drafted-spirit → pays_mercenary_rate → 30 %
- DualSlot-Pixi-Sprint-1 → T0_scope → Canlan + Luoluo + Zhuluan + Zhaoyu
- DualSlot-Pixi-base-ways → rtp_allocation → 60 percent (meta absorbs 40)
- DualSlot-Pixi-meta-mechanics → locked_count → 7 (Wild / Scatter / Streak / Resonance / Curse / Free Spin / JP)
- DualSlot-Pixi-resonance → 4_of_a_kind_multiplier → 2.0x
- DualSlot-Pixi-curse → 3_stack_effect → flat 500 HP damage next round
- DualSlot-Pixi-delivery → form → H5 PWA (Pixi.js 8, Service Worker, installable)
- DualSlot-Pixi-bundle → target_ceiling → 5 MB total session load

---

## 16. Lightweight Delivery Constraints (Strategy v1.0)

Locked 2026-04-22. Full operational checklist in MemPalace drawer `drawer_GameEconomy_DualSlot-engine_355b7ce2bccf855f`.

### 16.1 Delivery form

**Form**: HTML5 Progressive Web App (PWA)
**Engine**: Pixi.js 8 + Vite + TypeScript (already chosen, unchanged)
**No native wrapper** (no Capacitor / Cordova / Electron).

Rationale: instant-play via URL share, zero app-store friction, PWA provides second-visit offline cache, fits F2P retention model locked in §15.1.

### 16.2 Bundle budget (owner-locked ≤ 5 MB)

Target ceiling **5.0 MB total session load**, hard fail at 5.5 MB.

| Milestone | Budget | Cumulative |
|---|---|---|
| HTML + critical JS + CSS | 400 KB | 400 KB |
| Logo + UI frames + draft tiles (first paint) | 1.1 MB | 1.5 MB |
| Battle assets (spirits atlas + reel frame) | 2.0 MB | 3.5 MB |
| Free Spin overlay + first BGM track | 0.8 MB | 4.3 MB |
| Mega Win ceremony art | 0.5 MB | 4.8 MB |
| JP marquee | 0.3 MB | 5.1 MB |

### 16.3 L-tier optimization toolkit (Sprint 4 execution)

**High-impact (must do)**:

| ID | Tactic | Expected saving | Effort |
|---|---|---|---|
| L1 | PNG → WebP pass for all assets | −7 MB (60–70 %) | 0.5 day |
| L2 | Sprite atlas for 8 spirits (1 sheet) | −1 MB + 8→1 HTTP req | 0.5 day |
| L3 | Lazy loading per scene | first-load 11 MB → 1.5 MB | 1 day |
| L4 | BGM streaming (not bundled) | −3–6 MB | 1 day |

**Medium impact**:

| ID | Tactic | Expected saving |
|---|---|---|
| L5 | pixi-filters tree-shaking | −0.1 MB |
| L6 | Chinese font subsetting | −3 MB (if custom font) |
| L7 | Brotli server compression | network −30–40 % |
| L8 | Service Worker cache (PWA core) | 2nd-visit 0 network |

**Low-effort polish**:

| ID | Tactic | Purpose |
|---|---|---|
| L9 | Vite code-splitting per route | parallel download |
| L10 | Object pools (particles, damage numbers) | runtime memory |

### 16.4 PWA architecture

**manifest.json**: name `雀靈戰記 Dual Slots Battle`, short_name `雀靈戰記`, display `standalone`, theme_color `#D4AF37`, 9-size icon set + maskable variants.

**Service Worker (`sw.js`)**:
- Cache-first for assets, network-first for API
- Critical precache: HTML + JS bundles + critical CSS + logo + UI frames + first-spirit atlas
- Background precache: remaining spirits, BGM, ceremony art
- Update detection: prompt user refresh on new deploy

**Install prompt**: appear after 2nd visit (respects user autonomy); iOS uses manual instruction (no beforeinstallprompt API).

### 16.5 Browser compatibility target

- iOS Safari 14+
- Android Chrome 90+
- Desktop Chrome / Edge / Firefox / Safari current-1

WebP support universal in target set — no PNG fallback needed.

### 16.6 Sprint 4 lightweight checklist (embedded in Sprint 4 execution)

Week 1 — Asset optimization: L1 + L2 + L5 + L6
Week 2 — Architecture: L3 + L9 + L10
Week 3 — PWA integration: manifest + Service Worker + install UX + icons
Week 4 — Audit: Vite bundle analyzer + L7 Brotli + L4 BGM streaming verify + final ≤ 5 MB audit

### 16.7 Locked vs adjustable

**LOCKED** (no change without owner re-approval):
- Delivery form = H5 PWA (no native wrapper)
- Ceiling = ≤ 5 MB total session
- Sprint 4 = concentrated optimization phase
- Pixi.js 8 engine (no replacement)

**Adjustable during Sprint 4 audit**:
- Individual asset budgets
- Extension to 6 MB if one critical asset (e.g. high-quality BGM) conflicts
- Specific L-tactic prioritization per measured bottleneck

---

## 15. Meta Mechanics (Math Model v1.0)

Locked 2026-04-22. Full numeric specification and Actuary provisions in MemPalace drawer `drawer_GameEconomy_DualSlot-engine_fb9e15b3a631c968`.

### 15.1 Design pillars

| Pillar | Choice | Implication |
|---|---|---|
| Volatility | Medium | Hit frequency ≈ 60 %, balanced small-frequent + occasional big |
| Strategy weight | 40 % skill / 60 % luck | Draft decisions carry real math weight (Resonance §15.5) |
| Match length | ~2 minutes (≈ 10 rounds) | 400 HP damage/round average target |
| Payment | Pay-in-App + dual win/loss | Coin RTP ≈ 100 % + battle RTP independent |
| Modes | PvE AI + PvP | Same math core, AI tuned for 60 % player winrate |

### 15.2 Symbol pool expansion (8 → 12)

| Type | Symbol | Weight | Rate | Effect |
|---|---|---|---|---|
| Core | 8 spirits | 8–12 each | ~75 % | Ways-to-Win main body |
| Wild | 神獸化身 | 3 | ~3.4 % | Substitutes any spirit + way × 2 |
| Scatter | 靈脈晶 | 2 | ~2.3 % | Does not score; 3+ triggers Free Spin |
| Curse | 咒符 | 3 | ~3.4 % | Landing on your side → opponent +1 stack |
| Jackpot | 天地人獎 | 1 | ~1.1 % | 5-of-a-kind triggers JP draw |

Reel grid unchanged (5 × 3 = 15 cells).

### 15.3 Coin RTP allocation (owner-locked)

```
Base Ways                60 %   ← lowered from 85 % per owner directive
Wild × 2 contribution    10 %
Streak Multiplier         8 %
Resonance Bonus           8 %
Free Spin mode           14 %
─────────────────────
Total Coin RTP         ~100 %   (mild positive EV, F2P friendly)
```

JP pool is **separate** (not in base RTP): 1 % of every bet accumulates to the 3-tier pool (5 % Grand / 12 % Major / 83 % Minor contribution split).

### 15.4 Streak Multiplier (M3 · "氣勢連擊")

| Consecutive wins | Multiplier |
|---|---|
| 0 (miss) | resets to × 1.0 |
| 1 | × 1.0 |
| 2 | × 1.2 |
| 3 | × 1.5 |
| 4+ | **× 2.0 (cap)** |

Applies to both coin and damage. HUD shows "氣勢 LV.N".

### 15.5 Spirit Resonance (M5 · core strategy layer)

| Draft pattern | Effect |
|---|---|
| 4 different beasts (1-1-1-1) | baseline × 1.0 |
| 1 pair + 2 singles (2-1-1) | paired spirit wins × 1.5 |
| 2 pairs (2-2) | each pair's wins × 1.5 |
| 4 same beast (4-of-a-kind) | **× 2.0 (owner opened)** |

4-of-a-kind deliberately narrow (currently unlockable by full-female draft once male portraits land Sprint 3). Rewards deep draft planning — this is the 40 % strategy weight.

### 15.6 Curse stacking (M6 · PvP differentiator)

- Each curse symbol landing on **your** grid → opponent gains **+1 stack**
- Stacks 1–2: visual warning only (purple skull icon on opponent HP bar)
- At **3 stacks**: opponent takes **flat 500 HP** at start of next round, stacks reset to 0
- Curse does not pay coin (weapon, not prize)

### 15.7 Free Spin "靈氣爆發" (M10)

- Trigger: 3+ scatters same spin
- Duration: **5 free spins**
- Bet: **0** (free)
- Win multiplier: **× 2**
- Opponent: continues normal spins, **can still damage you**
- Target frequency: **~1 per 5 matches** (expectation, Sprint 4 Actuary tunes — not hard-locked)

### 15.8 3-tier Progressive Jackpot (M12)

| Tier | Payout (at bet = 100) | Draw prob on trigger |
|---|---|---|
| Minor 人獎 | ~500 × bet = 50,000 NTD | 85 % |
| Major 地獎 | ~5,000 × bet = 500,000 NTD | 12 % |
| Grand 天獎 | ~50,000 × bet = 5,000,000 NTD | 3 % |

Trigger: JP symbol 5-of-a-kind (Wild assists). Pool persists cross-match and cross-session.

### 15.9 Calibration provisions

**Actuary (Sprint 4) tunes**:
- Symbol weights
- `fairnessExp` (damage RTP curve)
- Streak multiplier cap (if × 2.0 proves OP)
- Free Spin trigger rate (target ~20 % per match)
- JP draw probabilities

**LOCKED** (no change without owner re-approval):
- 7-mechanic list (no adds, no drops)
- Base Ways RTP 60 %
- Curse flat 500 HP (not percentage)
- Resonance 4-of-a-kind × 2.0 (open, not capped)
- Dual-scale coin/damage independence

---

## 17. Demo Scope Pivot (Proposal Mode)

Locked 2026-04-22. Drawer `drawer_GameEconomy_DualSlot-engine_c67bab9ae8f8ed9d`.

**Project purpose**: This project is a **proposal demo**, not a production launch candidate. Front-end reaches commercial polish (to impress stakeholders during pitch); back-end only needs **design documentation** (no code).

### 17.1 Scope matrix

| Capability | REAL (implemented) | MOCK (UI/fake data) | PLAN (paper only) |
|---|---|---|---|
| Core loop (§2-9) | ✅ | — | — |
| 7 meta mechanics (§15) | ✅ | — | — |
| T0 attack choreography (§7) | ✅ | — | — |
| Visual polish V-tier A/B (§11) | ✅ | — | — |
| Lightweight PWA (§16) | ✅ | — | — |
| PvP opponent | — | ✅ scripted demo-AI | Matchmaking algorithm |
| PvE AI | — | ✅ scripted behaviours | Difficulty-tier system |
| JP pool persistence | — | ✅ localStorage ticker | Server pool + cross-user accumulation |
| Leaderboard | — | ✅ hardcoded fake entries | Backend persistence + ranking |
| Shop / IAP | — | ✅ UI + "coming soon" toast | Payment integration |
| Account / cloud save | — | ✅ localStorage only | Auth + cloud sync |
| Analytics | — | ✅ console.log events | Real Firebase / GA pipeline |
| Anti-cheat | — | — | Server-side validation plan |

### 17.2 Sprint roadmap impact

| Sprint | Original | Demo-mode |
|---|---|---|
| 0-3 | unchanged | unchanged (all REAL) |
| 4 | Meta math + 10 k sim + L1-L10 | Meta math + **1 k sim** + L1-L10 |
| 5 | Resonance + Curse (client + server) | Resonance + Curse (**client only**) |
| 6 | Free Spin + JP (real pool + IAP) | Free Spin + JP **animation** + IAP **mock** |
| 7 | PvE tuning + matchmaking + seasonal | **Demo Polish + Pitch Prep** (see §21) |

### 17.3 Timeline advantage

- Original plan: ~6 months / 2 devs
- Demo-mode plan: **~3 months / 1.5 devs**
- Saves: backend implementation, real IAP, real matchmaking

---

## 18. Backend Architecture Plan (Paper Spec)

Locked 2026-04-22. Pitch-deck use only — **not implemented**.

### 18.1 Topology

```
H5 Client (Pixi PWA)
  │ HTTPS + WSS
  ├── CDN + Static Hosts (WebP atlases, BGM)
  └── API Gateway (REST)
        ├── Auth Service (OAuth)
        ├── Match Service (WS)
        ├── Wallet / IAP Service
        ├── JP Pool Service
        ├── Leaderboard Service
        └── Analytics Ingest
              │
              └── Postgres (primary) + Redis (realtime) + S3 (replays)
```

### 18.2 Recommended stack

| Layer | BaaS path | Self-hosted |
|---|---|---|
| Backend | **Supabase** | Node.js + Fastify + Postgres |
| Realtime | **Nakama** | Colyseus / Socket.io |
| Payments | Google Play / Apple IAP | Stripe (web) |
| Analytics | Firebase Analytics | GA4 / Mixpanel |
| CDN | Cloudflare | CloudFront |

### 18.3 API surface (~18 endpoints)

| Category | Endpoint | Method | Purpose |
|---|---|---|---|
| Auth | `/auth/{google,apple,guest}` | POST | OAuth / anonymous login |
| Profile | `/me` | GET / PATCH | Player info |
| Match | `/match/find`, `/match/{id}/ws` | POST / WSS | Matchmaking + realtime |
| Spin | `/match/{id}/spin` | POST | Server-authoritative spin |
| Wallet | `/wallet` | GET | Balance + history |
| IAP | `/iap/catalog`, `/iap/verify` | GET / POST | Catalog + receipt validation |
| JP | `/jp/pool`, `/jp/winners` | GET | Pool + winner feed |
| Leaderboard | `/leaderboard/{global,friends}` | GET | Rankings |
| Season | `/season/current`, `/season/claim` | GET / POST | Season state + rewards |
| Analytics | `/analytics/event` | POST | Batched event ingest |

### 18.4 Data models

```
players(id, name, avatar, created_at, coin, gem, vip_tier, rating)
matches(id, player_a, player_b, winner, coin_delta, duration, replay_key)
spins(id, match_id, round, grid, eval_a, eval_b, dmg_a, dmg_b)
jp_pool(tier, amount, updated_at)
jp_wins(id, player_id, tier, amount, won_at)
iap_receipts(id, player_id, sku, receipt, verified, granted_at)
leaderboard(season_id, player_id, rating, wins)
events(id, player_id, type, payload, ts)
```

### 18.5 PvP flow (server-authoritative)

1. `/match/find` → server pairs via MMR
2. Both clients open WSS `/match/{id}/ws`
3. Every spin: server generates grid, evaluates both sides, returns `SpinResult`
4. Client renders from server result (no client RNG)
5. Match end: server records + updates wallet + leaderboard

### 18.6 Cost projection

| MAU | Supabase + Cloudflare | Self-hosted AWS |
|---|---|---|
| 1 000 | ~USD 25 / mo | ~USD 120 / mo |
| 10 000 | ~USD 150 / mo | ~USD 350 / mo |
| 100 000 | ~USD 900 / mo | ~USD 1 800 / mo |
| 1 000 000 | ~USD 4 500 / mo | ~USD 9 000 / mo |

### 18.7 Phasing (post-pitch, if approved)

- M+1: Auth + profile + wallet (BaaS bootstrap)
- M+2: IAP + JP pool
- M+3: PvP realtime match
- M+4: Seasonal + leaderboard
- M+5: Analytics + anti-cheat + soft launch

---

## 19. IAP Catalog Mock (Shop UI Spec)

Locked 2026-04-22. UI-only in demo.

### 19.1 Currency model

- **Coin 金幣**: slot winnings, IAP top-up, consumed in bets
- **Gem 靈玉**: premium, IAP only, cosmetics + Free Spin tickets
- **Free Spin Ticket 靈氣券**: triggers M10 on demand

### 19.2 Price catalog (NT$)

| SKU | Price | Content | Target |
|---|---|---|---|
| Gem Pack 1 | 30 | 60 gems | Low spender |
| Gem Pack 2 | 150 | 350 gems + 10 % | Casual |
| Gem Pack 3 | 990 | 2 600 gems + 30 % | Regular |
| Gem Pack 4 | 3 000 | 8 500 gems + 50 % + 5× tickets | Whale |
| Starter Pack (7 d) | 90 | 200 gems + 50 000 coin + skin | New player |
| VIP Monthly | 330 | 1 500 gems + 30 daily tickets | Mid |
| VIP Annual | 3 600 | 18 000 gems + 2× daily tickets | Whale |
| Battle Pass (60 d) | 270 | 50 tier rewards + skin | Engaged |
| Gacha single | 60 | 1 random skin | Collector |
| Gacha 10-pull | 540 | 10 pulls + 1 guaranteed rare | Collector |

### 19.3 Shop UI sections

- **推薦 Featured** (carousel, 3 hardcoded items)
- **寶石 Gems** (4 SKUs)
- **通行證 Pass** (VIP + Battle Pass)
- **造型 Cosmetics** (gacha + direct)
- **限時 Limited** (fake countdown for urgency)

### 19.4 Revenue assumptions

| Metric | Assumption | Source |
|---|---|---|
| ARPDAU | NT$ 9.5 | CMJ2 monthly KPI trend |
| Conversion | 4 % payer | F2P mobile industry |
| Whale ratio | 2 % of payers | industry standard |
| Expected MAU launch | 5 000 (internal test) | conservative |

---

## 20. Operations Plan (Live-Ops Readiness)

Locked 2026-04-22. 8 pillars.

### 20.1 Analytics

| Metric | Target | Event |
|---|---|---|
| DAU | tracked | `session_start` |
| ARPDAU | > NT$ 6 | `iap_purchase` |
| D1 retention | > 40 % | `retention_day_1` |
| D7 retention | > 18 % | `retention_day_7` |
| D30 retention | > 10 % | `retention_day_30` |
| Tutorial completion | > 80 % | `tutorial_complete` |
| First-purchase rate | > 3 % | `first_purchase` |
| JP trigger rate | observe | `jp_trigger` |

### 20.2 QA strategy

| Layer | Tool | Coverage |
|---|---|---|
| Unit | Vitest | SlotEngine / Formation / Distributor ≥ 95 % |
| Simulation | Node script | 10 k spins RTP ± 1 % |
| E2E | Playwright | Draft→Battle→Shop, 3 browsers |
| Performance | Lighthouse | FCP<2s, TTI<3.5s, CLS<0.1 |
| Load | k6 | 500 concurrent match API |

### 20.3 Legal & compliance

- Game rating: **ISG Taiwan PG-12**
- Virtual currency, no cash-out → no gambling disclaimer required
- ToS + Privacy Policy: draft Sprint 7, legal review pre-launch
- GDPR / CCPA: data minimization + delete-account flow
- Apple / Google store: IAP compliance (no external routing)

### 20.4 Localization roadmap

| Priority | Language | Market | Sprint |
|---|---|---|---|
| P0 | **繁中 zh-TW** | Taiwan primary | from Sprint 1 |
| P1 | 簡中 zh-CN | China / SEA | Sprint 6 |
| P2 | English en-US | Global fallback | Sprint 7 |
| P3 | 日文 ja-JP | Japan | Sprint 8+ |
| P3 | 韓文 ko-KR | Korea | Sprint 8+ |

Tool: i18next + JSON, lazy-load per language.

### 20.5 Accessibility

- Colorblind mode: alt palettes
- Reduced motion toggle: disables shake + hitstop + big flashes
- BGM subtitles
- Text scaling up to 200 %
- Screen reader: ARIA labels on menus

### 20.6 Anti-cheat (plan only)

- Server-authoritative spin results (§18.5)
- Rate limiting: max 30 spins / min / player
- Wallet delta validation against ledger
- IAP receipt double-verify (server-side)
- Replay flagging: outlier RTP → shadow-ban review

### 20.7 Seasonal content

| Element | Cadence | Example |
|---|---|---|
| Season | 60 days | 春龍賽季 |
| Battle Pass | 50 tiers | gems + coin + skin + emotes |
| Skin drop | 1 / season | Meng spring armour |
| Leaderboard | seasonal reset | top 10 unique badge |
| Limited events | bi-weekly | double-XP weekend, lunar new year |

### 20.8 Social features (viral potential)

| Feature | Priority | Viral |
|---|---|---|
| Friend list (invite code) | P0 | ⭐⭐ |
| Match replay + share | P0 | ⭐⭐⭐⭐ |
| Leaderboards | P0 | ⭐⭐⭐ |
| Chat (emotes only) | P1 | ⭐⭐ |
| Big-win / JP share to FB / IG / LINE | P0 | ⭐⭐⭐⭐⭐ (primary hook) |

---

## 21. Demo Mode Features (Force-Trigger Orchestrator)

Locked 2026-04-22. Gated by `DEMO_MODE=true` flag.

### 21.1 Purpose

Presenter reliably showcases hero moments during live pitch — don't rely on RNG.

### 21.2 Hidden dev panel (`Ctrl+Shift+D`)

| Button | Effect |
|---|---|
| Trigger Small Win | next spin = 3-way Canlan |
| Trigger Big Win | next spin = 15-way Zhuluan |
| Trigger Mega Win | next spin = 40-way grand ceremony |
| Trigger Free Spin | next spin = 3 scatters |
| Trigger JP | 5-of-a-kind + tier select (Minor / Major / Grand) |
| Trigger Curse Proc | opponent stack→2, next Curse procs 500 HP |
| Trigger Comeback | self HP→10 %, underdog ×1.3 |
| Set Opponent Name | custom string for fake opponent |
| Jump to Shop | instant scene transition |
| Reset Demo | full state restore |

### 21.3 Scripted sequences (1-click, 30-60 s)

- **"Elegant Demo" (5 min)**: Draft → 3 rounds → Free Spin → Big Win → Curse proc → Mega Win → JP Minor → end
- **"Comeback Story" (4 min)**: Draft → opponent leads → underdog activates → comeback → Grand JP → victory
- **"Tech Showcase" (3 min)**: skip gameplay, showcase T0 choreography × 4 + Mega Win + bundle loader

### 21.4 Faux opponent library

8 hardcoded: 朱雀之影 / 白虎山神 / 青龍少女 / 玄武老叟 + 4 more (name, avatar, fake MMR, behaviour).

### 21.5 Production exclusion

`DEMO_MODE` false in prod → tree-shake removes panel + scripts.

---

## 22. Pitch Demonstration Script (5-10 min)

Locked 2026-04-22. Audience: **IGS internal execs** (Q1a), length **5-10 min** (Q2b), **triple wow** (Q3abc), **繁中** (Q4a).

### 22.1 8-minute beat sheet

| Time | Beat | Presenter line | Demo action |
|---|---|---|---|
| 0:00-0:30 | **Hook** | 「今天給各位看一款我們用 AI 加速、3 個月可上線的 slot PvP 遊戲」 | Logo + VS badge anim |
| 0:30-1:30 | **Concept** | 「兩玩家共用一台老虎機，符號中獎 = 雀靈出擊」 | Draft screen, pick 4 females |
| 1:30-3:00 | **Fun 1** | 「5×3 Ways 同時算 243 路，雙方互扁」 | 2 normal rounds → Free Spin trigger |
| 3:00-4:30 | **Fun 2** | 「Big Win，再看 Mega Win 的儀式感」 | Force Big Win → Mega Win |
| 4:30-5:30 | **Monetization** | 「IAP 商店、三層 JP 跨場累積，ARPDAU 預估 NT$ 9.5」 | Shop UI + JP marquee tick |
| 5:30-6:30 | **Comeback** | 「下風加成 + 咒符堆疊 = 戲劇逆轉」 | Comeback scripted demo |
| 6:30-7:30 | **AI Acceleration** | 「這是今天一天做出來的 spec + commit history」 | Terminal: git log, SPEC.md, MemPalace |
| 7:30-8:00 | **Close** | 「資源：3 個月 / 1.5 人 / 後端架構已規劃完」 | §18 slide |

### 22.2 Key talking points

| Dimension | Line | Evidence |
|---|---|---|
| Differentiation | 全球第一款 PvP slot 結合咒符 + 共鳴 | §15.5 + §15.6 |
| Monetization | Base RTP 60 %，meta 吃 40 %，ARPDAU ~NT$ 9.5 | §15.3 + §20.1 |
| Tech maturity | 16 commits, SPEC 23 章 | GitHub + SPEC |
| Lightweight | H5 PWA, < 5 MB, 秒開 | §16 |
| AI velocity | 一天 0 → 16 章規格 + 16 commits | §23 |

### 22.3 Q&A anticipation

| Q | A |
|---|---|
| 為什麼 slot 不是 card？ | Slot 玩家基數大 + PvP 為市場空缺 + 麻將 2 DNA |
| Pay-in-App 違反博奕法？ | 虛擬幣不可兌現，ISG PG-12，無需賭博免責 |
| 3 個月做得完？ | Sprint 1-6 規劃完成 + Sprint 7 pitch polish；後端 Sprint 8+ |
| 競品 Mahjong Ways 2？ | 他們沒 PvP + 咒符 + 共鳴；我們差異化 3 樣 |
| 何時看真機？ | 現在可切 live build |

### 22.4 Fallback plans

- PWA 不載入：90 s 預錄影片
- Demo Mode 失靈：截圖 deck + 口述
- 網路斷：localStorage 全離線可跑

---

## 23. AI-Assisted Development (Key Differentiator)

Locked 2026-04-22. **核心 pitch 賣點**，per Q2 強調。

### 23.1 Thesis

以 **Claude Code + Claude Agent SDK + MemPalace** 為基建，此 project 作為 AI 加速遊戲開發案例。傳統團隊 6-12 個月才能產出等量 spec + prototype；目標 **3 個月 pitch-ready / 5 個月可上線**。

### 23.2 Real velocity data (2026-04-22 單日)

| 產出 | 數量 | 傳統估時 |
|---|---|---|
| Master git commits | 16 | 1-2 週 |
| SPEC.md 章節 | 23 | 2-3 週 |
| MemPalace drawers | 10+ | N/A（新流程） |
| KG facts | 15+ | N/A |
| 鎖定設計決策 | 13+ | 多次會議 |
| Sprint 0 refactor (P0.1-P0.8) | 1 天 | 1-2 週 |
| Round 1-4 code reviews | 4 輪 | 各 1 天 |
| 跨機 MemPalace sync 建置 | 1 session | 2-3 天 |

### 23.3 Division of labor

| 角色 | 傳統 | 本 project |
|---|---|---|
| Executor | 1-2 devs | **Claude Code Sonnet 4.6** |
| Reporter / reviewer | 1 senior dev | **Claude Code Opus 4.7 1M** |
| Design architect | 1 designer | **Owner + AI dialog** |
| Art | 2-4 artists × 月 | **Gemini AI**（8 雀靈分鐘級） |
| QA | 1-2 QA | Claude 生成 Vitest + Playwright 計畫 |

### 23.4 Tool stack

- **Claude Code CLI** — executor + reporter agents
- **MemPalace MCP** — cross-session persistent memory
- **Gemini AI** — character art + UI asset generation
- **GitHub + Vite + Pixi.js 8** — frontend stack
- **PWA + Service Worker** — delivery layer

### 23.5 Process highlights

- **SPEC-first discipline**: 所有決策文件化先於 code
- **Dual-session pattern**: executor 寫碼，reporter 審稿決策
- **Stacked PR chain merged in one commit**: Sprint 0 八 commit 一次 mega-merge
- **Code review as conversation**: 4 輪 reviews 抓出 rev-2 drift + mercenary-30% miss
- **Owner-in-the-loop**: 13 鎖定決策皆 owner 親自點頭

### 23.6 Replicability claim

此 **SPEC + MemPalace + dual-session + Claude Code** 工作流可複製。pitch 通過後：

- 新遊戲 project 小時級啟動（複製 workflow、seed MemPalace）
- Owner 全權控制（AI 建議，人類鎖定）
- 所有決策跨 session 保留
- 新成員透過 SPEC.md 接手（零 tribal knowledge）

### 23.7 Demo moment (pitch 6:30-7:30 slot)

Presenter 切到 terminal / browser 展示：

1. `git log --oneline` on master — 「16 個 commit，全部今天做的」
2. 打開 `SPEC.md` 閱讀器 — 「23 章規格書，AI 輔助起草、owner 拍板」
3. `mempalace_search("Resonance")` — 「決策跨 session 可查」
4. `mempalace_kg_query("DualSlot-Pixi")` — 「知識圖譜追鎖定事實」

**Key line**: 「這套工作流已實戰過，後續新遊戲能複製、非實驗性質。」
