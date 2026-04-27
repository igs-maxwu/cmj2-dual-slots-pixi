# Sprint 6 · j-02 — Jackpot pool 數據結構 + localStorage 持久化 + 1% accrual per bet

## 1. Context

PR: **新建 `src/systems/JackpotPool.ts` 模組（pure TS，零 Pixi dependency），定義 3-tier pool 數據結構（minor/major/grand）+ localStorage 持久化 API + 每 spin 1% bet 累積函式。BattleScreen.loop() 接 accrual hook。本 PR 不做 UI 顯示（j-05 工作）、不做 trigger draw（j-03 工作）。**

Why: SPEC §15.8 M12「1% of every bet → JP pool accrual」+「localStorage 持久化（cross-match + cross-session）」。j-01 已加 JP symbol，本 PR 接 pool 機制。j-03 才會在 5-of-a-kind 觸發時讀取 + 重置 pool。

設計選擇：

### Pool 數據結構（3-tier 獨立 progressive pool）

```
JackpotPools = {
  minor: number,    // 人獎，seed 50,000 NTD（at bet=100）
  major: number,    // 地獎，seed 500,000 NTD
  grand: number,    // 天獎，seed 5,000,000 NTD
}
```

### Accrual 機制（pure function，BattleScreen 觸發）

每 spin 雙方各扣 bet → **總 bet 的 1%** 流入 pool fund，按 50% / 30% / 20% 分配到 minor / major / grand。

```
total_accrual = 0.01 × (betA + betB)
  minor pool += total_accrual × 0.50
  major pool += total_accrual × 0.30
  grand pool += total_accrual × 0.20
```

例：bet=100 雙方 → 每 spin 累積 2 NTD：minor +1.0, major +0.6, grand +0.4。1000 spins 後：minor 51k, major 500.6k, grand 5,000,400 — 慢累積，符合 progressive 期望。

### localStorage 持久化

- Key: `dualslot.jackpot.v1`（v1 為版本碼，未來 schema 改動可 migrate）
- Value: JSON-stringified `JackpotPools`
- Read 時 fallback chain：parse 失敗 / 版本不符 / key 不存在 → 回傳 SEED 值
- Write 時 try/catch — quota error 不 crash（log warning + skip 該次寫）
- **Free Spin 期間 bet=0**，故 free spin 不累積 pool（正確行為，不需特判）

### 安全考量（防修改）

- **不防 localStorage 直接 edit**（demo 性質，玩家自己改自己 fool — SPEC §17 paper-only IAP）
- **防壞資料**：parse 後驗證 minor/major/grand 都是 finite number 且 >= seed，否則 fallback 到 seed
- **不加 hash/checksum**（過度工程，KISS）

---

## Skills suggested for this PR

- **`api-and-interface-design`** — JackpotPool.ts 是新 module，要定下乾淨 contract：純函數（loadPools / savePools / accrueOnBet / resetPool），caller-managed state（不在 module 內持有 mutable singleton）。export 介面要 stable，便於 j-03 / j-05 呼叫。
- **`security-and-hardening`** — localStorage 寫入要 try/catch（quota / SecurityError），讀取要驗證 schema（cleanly fall back to seeds on bad data），版本碼為 forward-compat。**不加 hash 防作弊**（明確列為「SPEC paper-only IAP」範疇）。
- **`incremental-implementation`** — 兩個 commit：(1) JackpotPool.ts new module + unit-style smoke check via dev script（選配）, (2) BattleScreen integration。每個都先 build 過再 push。
- **`source-driven-development`** — `localStorage.getItem` / `setItem` API 對照 MDN docs，不憑記憶寫；尤其 SecurityError 在 incognito mode 的 throw 行為要正確處理。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Jackpot pool localStorage 1% accrual M12 progressive"`
2. 確認 SPEC §15.8 「1% of every bet → JP pool accrual」確切字眼（**確認是「總 bet 的 1%」還是「per-side 1%」**）
3. 確認 j-01 PR #126 已 merge 且 `isJackpot` flag 在 SymbolsConfig.ts
4. 確認沒有既存 `JackpotPool.ts` 或類似命名（防重複）
5. 確認 BattleScreen.ts 既有 hardcoded JP marquee（PR #75/#76 加的）— 我們**不動 marquee 顯示**，只在背景累積 pool

## 3. Task

### 3a. 新檔案 `src/systems/JackpotPool.ts`

```ts
/**
 * Jackpot Pool — SPEC §15.8 M12 Progressive Jackpot
 *
 * 3-tier independent progressive pools (minor / major / grand).
 * Pure TypeScript, zero Pixi dependency — caller manages state.
 *
 * Design:
 * - Each spin contributes 1% of total bet (both sides) to the combined fund.
 * - Fund splits 50/30/20 to minor/major/grand pools.
 * - localStorage persists across match + session (key: dualslot.jackpot.v1).
 * - On bad data / quota error / first-time use: fall back to seed values.
 */

export interface JackpotPools {
  minor: number;
  major: number;
  grand: number;
}

/** Seed values per SPEC §15.8 (NT$ at bet=100 base payouts) */
export const JACKPOT_SEEDS: Readonly<JackpotPools> = Object.freeze({
  minor:   50_000,
  major:  500_000,
  grand: 5_000_000,
});

export const JACKPOT_ACCRUAL_RATE = 0.01;   // 1% of every bet

export const JACKPOT_POOL_WEIGHTS = Object.freeze({
  minor: 0.50,
  major: 0.30,
  grand: 0.20,
});

const STORAGE_KEY = 'dualslot.jackpot.v1';

/**
 * Load pools from localStorage.
 * Falls back to JACKPOT_SEEDS on:
 *   - key not found (first-time use)
 *   - JSON parse error
 *   - schema mismatch (missing field, NaN, < seed)
 *   - SecurityError (incognito)
 */
export function loadPools(): JackpotPools {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...JACKPOT_SEEDS };
    const parsed = JSON.parse(raw) as Partial<JackpotPools>;
    const isValid =
      typeof parsed.minor === 'number' && Number.isFinite(parsed.minor) && parsed.minor >= JACKPOT_SEEDS.minor &&
      typeof parsed.major === 'number' && Number.isFinite(parsed.major) && parsed.major >= JACKPOT_SEEDS.major &&
      typeof parsed.grand === 'number' && Number.isFinite(parsed.grand) && parsed.grand >= JACKPOT_SEEDS.grand;
    if (!isValid) return { ...JACKPOT_SEEDS };
    return { minor: parsed.minor!, major: parsed.major!, grand: parsed.grand! };
  } catch {
    return { ...JACKPOT_SEEDS };
  }
}

/**
 * Save pools to localStorage. Silently skips on quota / SecurityError.
 */
export function savePools(pools: JackpotPools): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pools));
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[JackpotPool] save skipped:', e);
  }
}

/**
 * Pure accrual: returns new pools (does NOT mutate input, does NOT save).
 * Caller decides when to persist (typically after each spin).
 */
export function accrueOnBet(pools: JackpotPools, totalBet: number): JackpotPools {
  if (totalBet <= 0) return pools;
  const fund = totalBet * JACKPOT_ACCRUAL_RATE;
  return {
    minor: pools.minor + fund * JACKPOT_POOL_WEIGHTS.minor,
    major: pools.major + fund * JACKPOT_POOL_WEIGHTS.major,
    grand: pools.grand + fund * JACKPOT_POOL_WEIGHTS.grand,
  };
}

/**
 * Reset one pool to its seed value. Used by j-03 when JP triggered.
 * Returns new pools (does NOT mutate, does NOT save).
 */
export function resetPool(pools: JackpotPools, tier: keyof JackpotPools): JackpotPools {
  return { ...pools, [tier]: JACKPOT_SEEDS[tier] };
}
```

**測試**（執行階段不需要 unit test 框架，**用 import.meta.env.DEV gate 寫個 smoke check 在 BattleScreen.onMount**，類似 r-04 banner 的 fire-and-forget 風格）：

```ts
// In BattleScreen.onMount, after this.jackpotPools = loadPools():
if (import.meta.env.DEV) {
  const test = accrueOnBet({ minor: 100, major: 100, grand: 100 }, 200);
  console.assert(Math.abs(test.minor - 101) < 0.001, 'JackpotPool accrueOnBet minor');
  console.assert(Math.abs(test.major - 100.6) < 0.001, 'JackpotPool accrueOnBet major');
  console.assert(Math.abs(test.grand - 100.4) < 0.001, 'JackpotPool accrueOnBet grand');
  console.log('[JackpotPool] smoke check passed');
}
```

### 3b. BattleScreen.ts integration

**Class field** （near other state fields, e.g. line ~113 curse stuff）：

```ts
import {
  loadPools,
  savePools,
  accrueOnBet,
  type JackpotPools,
} from '@/systems/JackpotPool';

// ...

/** Jackpot pools (j-02) — loaded from localStorage on mount */
private jackpotPools!: JackpotPools;
```

**onMount** — 在 drawJackpotMarquee() 之前載入：

```ts
this.jackpotPools = loadPools();
if (import.meta.env.DEV) {
  console.log('[JackpotPool] loaded:', this.jackpotPools);
  // smoke check (見 §3a 末段)
}
```

**loop() — 1% accrual hook**：在既有 `this.walletA = this.walletA - betA + coinA` block **之前**或**之後**加：

```ts
// ── M12 JP pool accrual (j-02): 1% of total bet → progressive pools ──
// Free Spin 期間 betA/betB 已是 0，自然不累積（正確）
const totalBetThisSpin = betA + betB;
if (totalBetThisSpin > 0) {
  this.jackpotPools = accrueOnBet(this.jackpotPools, totalBetThisSpin);
  savePools(this.jackpotPools);   // persist every spin
}
```

**注意**：每 spin 寫一次 localStorage 性能影響可忽略（每場 ~10-30 spin，每次 <1ms）。不需 batch optimization。

### 3c. 檔案範圍（嚴格）

**新增**：
- `src/systems/JackpotPool.ts`（new file，~80 lines pure TS）

**修改**：
- `src/screens/BattleScreen.ts`（+import + field + onMount load + loop accrual ~6 行）

**禁止**：
- SymbolsConfig / SlotEngine / GemMapping
- DraftScreen / LoadingScreen
- 任何 5-of-a-kind 偵測或 trigger draw（j-03 工作）
- JP marquee UI 改動（j-05 工作）
- JP ceremony FX（j-04 工作）
- scripts/sim-rtp.mjs（sim 不需要 JP pool — 觸發在 j-03 加，且 sim 是純計算不持久化）
- SPEC.md
- 改 j-01 / f-track 任何邏輯

## 4. DoD

1. `npm run build` 過
2. 兩個 commit：(1) JackpotPool.ts new module，(2) BattleScreen integration
3. push + PR URL
4. **Preview 驗證**：
   - 進 Battle，console 看 `[JackpotPool] loaded:` 印出 seed 值（首次）
   - 跑 5 spin，console `[JackpotPool] smoke check passed`（DEV smoke check 過）
   - 開 DevTools → Application → Local Storage → 看 `dualslot.jackpot.v1` key 存在，value 隨 spin 慢慢漲
   - **重整 page** → 進 Battle → console 印出的 minor/major/grand 應該 > seed（持久化生效）
   - **手動清掉 localStorage key** → 重整 → 應該回到 seed 值（fallback 生效）
5. 截圖 DevTools localStorage 內容（before / after spin），證明累積到位

## 5. Handoff

- PR URL
- 1 行摘要
- 2 張截圖（localStorage seed 狀態 + 跑 ~10 spin 後狀態）
- 是否實測過 reload + 持久化（一句話）
- 是否實測過 incognito mode（fallback 到 seed 不 crash） — 如不便測，note skip 即可
- 任何 localStorage API 對 MDN docs 不一致的觀察（source-driven-development skill）
- Spec deviations：預期 0；若 SPEC §15.8 字眼是「per-side 1%」而非「總 bet 1%」，flag 並照 SPEC 修正
