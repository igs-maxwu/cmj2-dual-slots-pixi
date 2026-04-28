# Sprint 12 · s12-ui-06 — Final Cleanup（刪剩 webp + UI_ASSET_KEYS empty + LoadingScreen drop UI/gems preload + GemMapping dead code 清）

## 1. Context

PR: **Sprint 12 收尾 PR — 刪所有剩餘 Gemini-produced UI / gem webp + LoadingScreen 廢 UI/gems preload + GemMapping.ts 整檔刪。完工後 `public/assets/` 下只剩 spirits + audio + fx + PWA icon。**

Why: Sprint 12 第 6 步收官。前 5 個 PR 把所有 webp 路徑都改成 programmatic Pixi.Graphics — 本 PR 純清 dead asset + dead code。

範圍：

### 1. 刪 2 個 UI webp（s12-ui-05 留下的）
- `slot-frame.webp` (s12-ui-05 改 programmatic 後 orphan)
- `win-burst.webp` (s12-ui-05 改 programmatic 後 orphan)

### 2. 刪 5 個 gem-shape webp（p11-vA-03 後 orphan）
p11-vA-03 把 gem 視覺從 PNG sprite 改成 glossy ball + 中文字後，這 5 個 gem-shape webp 已不再被 import：
- `gem-diamond.webp`
- `gem-hexagon.webp`
- `gem-pentagon.webp`
- `gem-square.webp`
- `gem-triangle.webp`

### 3. UI_ASSET_KEYS 清空 + 廢 preload

`UI_ASSET_KEYS` 廢 2 entries → empty array。

`LoadingScreen` 廢 `preloadUi()` + `preloadGems()` method + 從 onMount 移除呼叫。

### 4. 廢 GemMapping.ts 整檔
p11-vA-03 之後沒人 import `gemForSymbol`。本檔為 dead code，整檔刪除。

### 5. 廢 UiAssets.ts 整檔（**或保留 empty array**）
若 UI_ASSET_KEYS 是 empty array，整檔可刪 — 但保留 empty array 也安全（避免 import 鏈斷）。**建議刪整檔**，import 從 LoadingScreen 拿掉。

完工後狀態：
```
public/assets/
├── spirits/        (8 webp — chibi 立繪，IP 命脈)
├── audio/          (Suno BGM/SFX)
├── fx/             (SOS2 atlas — 機制 FX 用)
└── ui/
    ├── pwa-icon-192.png
    └── pwa-icon-512.png
```

---

## Skills suggested for this PR

- **`code-simplification`** — 大量 dead code/asset 清除，**不寫新 logic**，只 delete + 移除 import 鏈。
- **`incremental-implementation`** — 3 atomic commits：(1) 2 UI webp + UI_ASSET_KEYS empty + LoadingScreen drop preloadUi，(2) 5 gem webp + LoadingScreen drop preloadGems，(3) GemMapping.ts + UiAssets.ts dead file 刪除。
- **`source-driven-development`** — Verify nothing imports deleted symbols 後再 delete（grep first）。

---

## 2. Spec drift check (P6)

1. `mempalace_search "Sprint 12 final cleanup gem webp UiAssets empty LoadingScreen"`
2. 確認 `public/assets/ui/` 還剩 2 webp（slot-frame + win-burst）+ 2 PWA png
3. 確認 `public/assets/symbols/gems/` 仍有 5 webp
4. 確認 `LoadingScreen.ts` 仍有 `preloadUi()` + `preloadGems()` + `onMount` 呼叫
5. 確認 `src/config/UiAssets.ts` 內 UI_ASSET_KEYS = ['slot-frame', 'win-burst']（length 2）
6. 確認 `src/config/GemMapping.ts` 沒人 import（grep `from '@/config/GemMapping'`）
7. 確認 `src/config/UiAssets.ts` 只在 LoadingScreen import

## 3. Task

### 3a. Commit 1 — UI cleanup

刪檔：
```bash
rm public/assets/ui/slot-frame.webp
rm public/assets/ui/win-burst.webp
```

`src/screens/LoadingScreen.ts`：
- 移除 import `import { UI_ASSET_KEYS } from '@/config/UiAssets'`
- 整段移除 `preloadUi()` method（line ~146-158）
- 從 `onMount` 移除 `await this.preloadUi()` 呼叫（line ~31）
- 同時移除 `upgradeToDecoratedLoadingScreen()` 呼叫如果僅依賴 UI preload 完成（**verify** — 既有可能僅靠 corner-ornament，但 s12-ui-01 已 programmatic，可保留 upgradeToDecoratedLoadingScreen 不動）

`src/config/UiAssets.ts`：
```ts
export const UI_ASSET_KEYS = [] as const;
```
**或**整檔刪除（同時更新所有 import 鏈）。

**選 empty array** — 安全 path，未來想加新 UI key 時直接 add 即可。

**Commit 1**: `chore(s12-ui-06a): delete slot-frame + win-burst webp; UI_ASSET_KEYS empty; LoadingScreen drop preloadUi`

### 3b. Commit 2 — Gem webp cleanup

刪檔：
```bash
rm public/assets/symbols/gems/gem-diamond.webp
rm public/assets/symbols/gems/gem-hexagon.webp
rm public/assets/symbols/gems/gem-pentagon.webp
rm public/assets/symbols/gems/gem-square.webp
rm public/assets/symbols/gems/gem-triangle.webp
```

刪空目錄：
```bash
rmdir public/assets/symbols/gems
rmdir public/assets/symbols   # 若空
```

`src/screens/LoadingScreen.ts`：
- 整段移除 `preloadGems()` method
- 從 `onMount` 移除 `this.preloadGems()` 呼叫（在 Promise.all 內）

**Commit 2**: `chore(s12-ui-06b): delete 5 gem-shape webp + LoadingScreen drop preloadGems`

### 3c. Commit 3 — Dead file cleanup

`src/config/GemMapping.ts`：

先 verify 無 import:
```bash
grep -r "from '@/config/GemMapping'" src/
```

若無 import：
```bash
rm src/config/GemMapping.ts
```

`src/config/UiAssets.ts`：
- Empty array 已存在；保留 file 為 future-proof OR 整檔刪
- **建議保留** — 防未來想加新 UI key 時又要重建

**Commit 3**: `chore(s12-ui-06c): delete GemMapping.ts dead file`

### 3d. 檔案範圍（嚴格）

**修改**：
- `src/screens/LoadingScreen.ts`（移 preloadUi + preloadGems + UI_ASSET_KEYS import）
- `src/config/UiAssets.ts`（empty array）

**刪除（檔案）**：
- `public/assets/ui/slot-frame.webp`
- `public/assets/ui/win-burst.webp`
- `public/assets/symbols/gems/gem-diamond.webp`
- `public/assets/symbols/gems/gem-hexagon.webp`
- `public/assets/symbols/gems/gem-pentagon.webp`
- `public/assets/symbols/gems/gem-square.webp`
- `public/assets/symbols/gems/gem-triangle.webp`
- `public/assets/symbols/gems/`（空目錄）
- `public/assets/symbols/`（若空）
- `src/config/GemMapping.ts`

**禁止**：
- 改其他 components / screens 邏輯（純 cleanup）
- 改 SymbolsConfig / SlotEngine / etc 機制
- 加新 asset
- 改 Spirit / FX / Audio preload（保留）
- DesignTokens
- scripts/sim-rtp.mjs
- SPEC.md
- 整檔刪 UiAssets.ts（保 future-proof empty array）

## 4. DoD

1. `npm run build` 過
2. **3 atomic commits**
3. push + PR URL
4. **Preview 驗證**：
   - LoadingScreen 跑：「Loading spirits N/8」進度條（no longer 「Loading UI N/2」）
   - 進 DraftScreen：8 spirit tile + UiButton 全 programmatic 正常 render
   - 進 BattleScreen：reel frame + spirit clan ring + glossy ball + win-burst 全 programmatic 正常 render
   - 點 SPIN：完整 spin 流程正常
   - 無 console warning（特別 `gem-*` / `slot-frame` / `win-burst` / `UI_ASSET_KEYS` 相關）
5. `ls public/assets/ui/` 預期只剩 `pwa-icon-192.png` + `pwa-icon-512.png`
6. 截圖 1 張（任意完整 BattleScreen 證實視覺仍正常）

## 5. Handoff

- PR URL
- 1 行摘要
- 1 張截圖
- 7 個 webp + GemMapping.ts 確實刪除（`git status` 顯示 7 deletions）
- LoadingScreen 是否仍有任何 console warning
- `public/assets/ui/` 最終 ls（預期 2 PWA png）
- `public/assets/symbols/` 是否整目錄刪除（若空）
- Bundle size 變化（PWA precache entries 預期 -7 webp = ~133 entries）
- Spec deviations：預期 0
- **Sprint 12 closure 確認**：PR body / Handoff 兩處標記「Sprint 12 UI Asset Decommission COMPLETE — all Gemini-produced borders/frames/buttons retired; only spirits + audio + fx + PWA icons remain in public/assets/」
