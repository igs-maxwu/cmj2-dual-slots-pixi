# Sprint 3 C · 02 polish — 修正雀靈 mirror 方向（A 側要 flip，不是 B 側）

## 1. Context

PR: **Fix A/B spirit facing direction — mirror should be on A side, not B side**

Why: Owner preview 2026-04-24 發現兩側雀靈**都面向左**。根因：原始 spirit webp 素材由 Midjourney 產出規格 `facing-left`（參考 the-sculptor subagent spec），所以預設面向左。

- **A 側（畫面左）** → 應該面向**右**（朝向中央 VS）→ 需要 `scale.x *= -1` flip
- **B 側（畫面右）** → 應該面向**左**（朝向中央 VS）→ **保持原樣，不 flip**

現有 c-02（PR #69 merged）寫反了：

```ts
// 現狀（錯）：
if (side === 'B') sprite.scale.x *= -1;
```

Base: master HEAD（c-02 merged）
Target: `fix/sprint3c-02-flip-direction`

## 2. Spec drift check (P6)

略 — 這只是 1-char fix。

## 3. Task

改 `src/screens/BattleScreen.ts` 裡 `drawFormation()` 內的鏡像邏輯：

```ts
// BEFORE:
if (side === 'B') sprite.scale.x *= -1;

// AFTER:
if (side === 'A') sprite.scale.x *= -1;
```

**唯一改動：B → A**。其他完全不動。

## 4. DoD

1. `npm run build` 過
2. commit + push 到 `fix/sprint3c-02-flip-direction`
3. PR URL

## 5. Handoff

PR URL + 1 行摘要。預期 diff 就 1 行。
