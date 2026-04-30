# Chore — Attack clash 雙側 facing 方向反轉（背對背 → 面對面）

## 1. Context

Owner 試玩 chore #178 後反映：雙側 attack clash 時兩 spirit **背對背**（互相面向外），不是預期的**面對面**。

### Root cause

chore #177 SpiritAttackChoreographer line 171：
```ts
const faceDir = side === 'A' ? 1 : -1;
```

當前邏輯**假設 spirit webp native 朝右**：
- A 在 centerX-70（左）→ scale.x = +1（保持原向 = 朝右）→ 看向 B ✓ (理想)
- B 在 centerX+70（右）→ scale.x = -1（鏡射）→ 朝左 → 看向 A ✓ (理想)

但實際 spirit webp 是**朝左 native**（chibi 角色設計常見方向）：
- A scale.x = +1 → 朝左 → 看向畫面左外（背對 B）❌
- B scale.x = -1 → flip 朝右 → 看向畫面右外（背對 A）❌
- → **背對背**（owner 看到的）

### Fix：1 行符號反轉

純視覺位向修正 — 不動其他 chore #177/#178 設計。

---

## Skills suggested

- **`incremental-implementation`** — 1 commit, 1-line change

---

## 2. Spec drift check (P6)

1. 確認 chore #177 faceDir 邏輯仍存在 line 171 + 套到 5 phase scale.set
2. 確認 chore #178 Container wrap pattern（不影響 facing 邏輯，scale.x sign 仍生效）

---

## 3. Task

### Single commit — Invert faceDir

`src/screens/SpiritAttackChoreographer.ts` line 171：

當前：
```ts
const faceDir = side === 'A' ? 1 : -1;
```

改成：
```ts
// chore: spirit webp native facing left → invert clash facing
// A on left needs flip to face right (toward B); B on right keeps native (face left toward A)
const faceDir = side === 'A' ? -1 : 1;
```

> **就 1 行變號**。其他 5 phase tween 內 `avatar.scale.set(faceDir * s, s)` 邏輯保留，自動跟新 sign。

### 驗證

`npm run build` + 試玩：
- 雙側 clash：A 朝右（看向 B）+ B 朝左（看向 A）→ **面對面對打**
- 單側 attack：A 在 centerX-70 朝右（朝對方方向）/ B 在 centerX+70 朝左
- 8 signature fx 仍從 avatar 正面射出（特效軌跡不變，只是 sprite mirror）

**Commit**: `fix(chore): attack clash facing — invert faceDir for native-left-facing spirit webp (#177 hotfix r2)`

---

### 檔案範圍（嚴格）

**修改**：
- `src/screens/SpiritAttackChoreographer.ts`（line 171 一行 sign 反轉 + comment 更新）

**禁止**：
- 動 chore #177/#178 其他結構（Container wrap / 5 phase / clash offset / Sprite 120px size）
- 動 PERSONALITIES / 8 個 _sigXxx
- 動 BattleScreen
- 改 SPEC.md / DesignTokens

---

## 4. DoD

1. `npm run build` 過
2. **1 atomic commit**
3. push + PR URL
4. **Preview 驗證 critical**：
   - 雙側 attack：A 跟 B **面對面**（非背對背）
   - 單側 attack：avatar 朝對方方向（A 朝右 / B 朝左）
   - 8 signature fx 仍正常射出
5. 截圖：雙側 clash 中 face-to-face

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖（雙側 clash face-to-face 證明）
- 確認 8 signature fx 起點仍對（特效從 avatar 正面射出，不是後方）
- Spec deviations：預期 0
- Audit note：spirit webp native facing direction 應該寫進 docs（避免未來再 confused）
