# Chore — Reel ball → 五角寶石（programmatic pentagon + 8 unique colors）

## 1. Context

Owner 試玩 chore #197 後反映想換成 gem 寶石樣式（提供 reference 圖：紅/紫/橘/藍 pentagon gems）。

當前 chore p11-vA-03 + chore #173 是**圓球 + 中文字**（programmatic glossy ball with shadow + main + highlight + char）。

### 升級方案
- **Pentagon shape**（5-sided）取代 circle ball
- **8 unique 寶石色**（4 clan × 2 sibling 色）— 玩家可區分 8 個 spirits
- 角色字（chore #173 末字）保留 overlay 在寶石中央
- 1/2/3 ⭐ pip indicators (chore #197) 保留在底
- W / S / JP 特殊符號改 unique gem 色

純視覺重設計 — 不動 SlotEngine / SymbolsConfig / 任何 mechanic / 連連看 / hit reaction。

---

## Skills suggested

- **`incremental-implementation`** — 2 atomic commits（pentagon shape / 8-spirit color map）
- **`source-driven-development`** — 用既有 setCellSymbol structure，只換 ball drawing → pentagon
- **`debugging-and-error-recovery`** — 確認 pentagon polygon + 高光 + dark stroke 視覺合理（trial 後 owner 給 feedback）

---

## 2. Spec drift check (P6)

1. 確認 `setCellSymbol` 既有 ball drawing 在 SlotReel.ts (chore p11-vA-03 之後 + chore #173 末字 + 深色 fill)
2. 確認 `SYMBOL_VISUAL` map (chore #173 last-char + clan glow color)
3. 確認 chore #197 5-point star pip 在 cell.pipsContainer (不影響 gemBall)

---

## 3. Task

### 3a. Commit 1 — Pentagon shape replaces circle ball

`src/screens/SlotReel.ts` `setCellSymbol` 內畫 ball 處（既有 shadow / main / highlight 三段 Graphics）：

當前 ball 結構（簡化）：
```ts
// shadow circle
cellShadow.circle(0, 4, r).fill({ color: 0x000, alpha: 0.4 });
// main circle (gradient)
cellMain.circle(0, 0, r).fill({ ... gradient ... });
// highlight ellipse
cellHighlight.ellipse(0, -r/3, r*0.5, r*0.3).fill({ ... light ... });
```

改成 Pentagon：
```ts
// chore #198: pentagon gem shape replaces circle ball

// Helper: build 5-vertex pentagon points (point-up)
function pentagonPoints(cx: number, cy: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i / 5) * Math.PI * 2;   // start at top
    pts.push(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  return pts;
}

// Shadow pentagon (slight Y offset)
const shadowPts = pentagonPoints(0, 4, r);
cellShadow.poly(shadowPts).fill({ color: 0x000000, alpha: 0.4 });

// Main pentagon (gradient)
const mainPts = pentagonPoints(0, 0, r);
cellMain.poly(mainPts).fill({ ... gradient using gemColor ... });
cellMain.poly(mainPts).stroke({ width: 1.5, color: 0x000000, alpha: 0.5 });   // dark outline

// Highlight (small upper-left polygon for gloss)
// Optional: simpler — small ellipse OR triangle in upper-left of pentagon
cellHighlight.ellipse(-r * 0.2, -r * 0.4, r * 0.3, r * 0.15)
  .fill({ color: 0xffffff, alpha: 0.5 });
```

> **點數方向**：top-up pentagon（頂角向上）— 像獎勵感的「✦」。
> **大小**：保留既有 r 不變（balls 半徑同等位置）。
> **Highlight**：小白色 ellipse 偏左上，模擬光點。

> **Spiritual char**：既有 charText 仍 addChild 到 gemBall，浮在 pentagon 中央 — 不動。

**Commit 1**: `feat(chore): SlotReel pentagon gem shape replaces circle ball — programmatic 5-sided polygon + dark stroke`

---

### 3b. Commit 2 — 8 spirit unique gem colors + special map

`SlotReel.ts` 上方 `SYMBOL_VISUAL` map (chore #173)：

當前：
```ts
const SYMBOL_VISUAL: Record<number, { char: string; color: number }> = {
  0: { char: '寅',  color: T.CLAN.whiteGlow     },
  1: { char: '鸞',  color: T.CLAN.vermilionGlow },
  2: { char: '雨',  color: T.CLAN.blackGlow     },
  3: { char: '璋',  color: T.CLAN.azureGlow     },
  4: { char: '嵐',  color: T.CLAN.azureGlow     },
  5: { char: '洛',  color: T.CLAN.whiteGlow     },
  6: { char: '羽',  color: T.CLAN.vermilionGlow },
  7: { char: '墨',  color: T.CLAN.blackGlow     },
  // ... specials ...
};
```

改成（chore #198 — 8 unique colors）：
```ts
// chore #198: 8 unique gem colors per spirit (was 4 clan colors shared by 2 siblings)
// Same clan = sibling color (slight hue shift); player can distinguish all 8 spirits
const SYMBOL_VISUAL: Record<number, { char: string; color: number }> = {
  0: { char: '寅',  color: 0xfff0b3 },   // 白虎 1: 米黃
  1: { char: '鸞',  color: 0xff5050 },   // 朱雀 1: 朱紅
  2: { char: '雨',  color: 0x4adb8e },   // 玄武 1: 翠綠
  3: { char: '璋',  color: 0x4a90e2 },   // 青龍 1: 深藍
  4: { char: '嵐',  color: 0x7ae8ff },   // 青龍 2: 亮天藍
  5: { char: '洛',  color: 0xffd980 },   // 白虎 2: 淺金
  6: { char: '羽',  color: 0xff8a3a },   // 朱雀 2: 橘紅
  7: { char: '墨',  color: 0x9a4adb },   // 玄武 2: 紫晶
  // Specials unchanged or refined:
  8:  { char: 'W',  color: T.GOLD.glow          },   // Wild
  9:  { char: '咒', color: 0xc77fe0             },   // Curse (weight=0)
  10: { char: 'S',  color: 0xff3b6b             },   // Scatter
  11: { char: 'JP', color: T.GOLD.base          },   // Jackpot
};
```

> **Trade-off**：失去「同 clan 同色」owner 之前要求（chore #173），但**換來 8 unique 寶石可區分**。Chore #198 與 chore #173 spec 衝突 — 以最新 owner 需求為準。

> **Resonance 視覺**：clan-shared color 是 chore #173 的 visual cue 給 resonance "X 龍共鳴" 玩家認 clan。chore #198 之後 clan 仍用 spritName/spiritKey 系統判定（不靠 ball color）— resonance 機制不受影響，但**視覺上 clan 認同感較弱**。Owner 需確認接受 trade-off。

**Commit 2**: `feat(chore): SYMBOL_VISUAL 8 unique gem colors per spirit (replaces chore #173 same-clan-same-color)`

---

### 3c. 檔案範圍（嚴格）

**修改**：
- `src/screens/SlotReel.ts`（pentagon shape in setCellSymbol + SYMBOL_VISUAL 8 colors）

**禁止**：
- 動 SlotEngine / SymbolsConfig / Resonance / detectResonance
- 動 chore #197 5-point star pip
- 動 chore #170/#172/#174 BlurFilter / mask / ghost fix
- 動 chore #171/172 連連看 trace / win ring
- 動 charText style (chore #173 isMultiChar fontSize 仍用)
- 改 SPEC.md / DesignTokens / sim-rtp / main.ts

---

## 4. DoD

1. `npm run build` 過
2. **2 atomic commits**
3. push + commit URL（PR or direct master + verify origin/master）
4. **Pre-merge audit**：
   - `grep "pentagonPoints\|poly.*pentagonPts" src/screens/SlotReel.ts` — 確認 polygon helper
   - `grep "SYMBOL_VISUAL" src/screens/SlotReel.ts | head -3` — 確認 8 unique colors
5. **Preview 驗證**：
   - 進 BattleScreen → 看 reel 8 隻 spirit 各 unique 寶石色（米黃/朱紅/翠綠/深藍/天藍/淺金/橘紅/紫晶）
   - Pentagon 形狀清楚（不再圓球）
   - 角色字（chore #173 末字）仍清晰在寶石中央
   - ⭐ pip (chore #197) 仍在底部正常
   - W / S / JP 特殊 gem 仍 unique 色
   - 連連看 + ring + 攻擊動畫 (chore #170-185 一系列) 仍正常

## 5. Handoff

- PR / commit URL
- 1 行摘要
- 1-2 張截圖（reel 8 spirits + 特殊 gems mix）
- Pentagon 大小 r 是否合適 / 高光位置 OK / dark stroke 0.5 太重？
- 8 unique 色辨識度（玩家能否分辨同 clan 兩 sibling）
- chore #173 「同 clan 同色」spec 改變 — 是否仍想保留 clan family 視覺感（or 完全 unique OK）
- Spec deviations：1（chore #173 SYMBOL_VISUAL 同 clan 同色 → unique 8 colors，owner-approved trade-off 2026-05-05）
- Process check：cherry-pick 後 `git log --oneline origin/master | head -3` 確認 source on master
