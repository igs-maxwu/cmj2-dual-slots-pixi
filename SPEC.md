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

| Sprint | Focus | Status |
|---|---|---|
| **Sprint 0** | Core loop (5×3 Ways, 243 ways/side, portrait, dual-scale, overkill) | ✅ **Merged 2026-04-22** |
| **Sprint 1** | T0 spirit attack choreography (4 females + male generic) + T1 particle-emitter + T2 reel anticipation + T3 pixi-filters + T5 hitstop | 🟡 **T0 framework + T2 merged; rest in progress** |
| **Sprint 2** | T4 parallax bg + T6 Mega/Jackpot ceremony + T8 UI microinteractions + T9 sound/BGM + T10 ink-brush transitions | ⏸ pending |
| **Sprint 3** | T7 4-beast theme depth + 4 male spirit signatures + trailer | ⏸ pending |
| **Sprint 4** | Actuarial calibration (10 k simulations, RTP pass) + rebalance | ⏸ pending |

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

---

## 14. MemPalace Cross-Reference

Canonical source-of-truth drawers (Wing: GameEconomy, Room: DualSlot-engine):

- `drawer_GameEconomy_DualSlot-engine_f5c3fc3837a65de4` — SPEC v1.0 full
- `drawer_GameEconomy_DualSlot-engine_32bb76dc95c002db` — OPEN ISSUES rev1
- `drawer_GameEconomy_DualSlot-engine_7b5e30361209c686` — OPEN ISSUES rev2 (mercenary reversal)
- `drawer_GameEconomy_DualSlot-engine_6d3dd53b1b3534be` — Sprint 1 T0 storyboard + UI rebalance
- "DualSlot-Pixi CORE DESIGN LOCK (2026-04-22)" — 5 pillars + blind spots

Related knowledge-graph facts:

- DualSlot-Pixi → reel_stop_timing → 0.6 / 1.1 / 1.6 s
- DualSlot-Pixi-non-drafted-spirit → pays_mercenary_rate → 30 %
- DualSlot-Pixi-Sprint-1 → T0_scope → Canlan + Luoluo + Zhuluan + Zhaoyu
