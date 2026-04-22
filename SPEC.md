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
| Azure Dragon | **Canlan** 燦瀾 (female) | `canlan.png` | ⭐ Sprint 1 (female batch) |
| Azure Dragon | Meng 孟辰璋 (male) | `mengchenzhang.png` | Sprint 3 (generic placeholder for now) |
| White Tiger | **Luoluo** 落落 (female) | `luoluo.png` | ⭐ Sprint 1 (female batch) |
| White Tiger | Yin 殷 (male) | `yin.png` | Sprint 3 |
| Vermilion Phoenix | **Zhuluan** 朱鸞 (female) | `zhuluan.png` | ⭐ Sprint 1 (female batch) |
| Vermilion Phoenix | Lingyu 凌羽 (male) | `lingyu.png` | Sprint 3 |
| Black Tortoise | **Zhaoyu** 照宇 (female) | `zhaoyu.png` | ⭐ Sprint 1 (female batch) |
| Black Tortoise | Xuanmo 玄沫 (male) | `xuanmo.png` | Sprint 3 |

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
| **Sprint 4** | Meta math foundation: Wild + Scatter + Streak Multiplier + Actuarial calibration (10 k sims, RTP ≈ 100 %, hit freq ≈ 60 %) | Texture/lighting QA, chromatic aberration on Mega Win, mobile performance profiling | ⏸ pending |
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
- "DualSlot-Pixi CORE DESIGN LOCK (2026-04-22)" — 5 pillars + blind spots

Related knowledge-graph facts:

- DualSlot-Pixi → reel_stop_timing → 0.6 / 1.1 / 1.6 s
- DualSlot-Pixi-non-drafted-spirit → pays_mercenary_rate → 30 %
- DualSlot-Pixi-Sprint-1 → T0_scope → Canlan + Luoluo + Zhuluan + Zhaoyu
- DualSlot-Pixi-base-ways → rtp_allocation → 60 percent (meta absorbs 40)
- DualSlot-Pixi-meta-mechanics → locked_count → 7 (Wild / Scatter / Streak / Resonance / Curse / Free Spin / JP)
- DualSlot-Pixi-resonance → 4_of_a_kind_multiplier → 2.0x
- DualSlot-Pixi-curse → 3_stack_effect → flat 500 HP damage next round

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
