# Sprint 12 — UI Asset Decommission（廢除所有 Gemini webp UI 框，全 Pixi.Graphics 程式化）

## 總目標

Owner Sprint 11 + chore #150-#152 試玩後反映「**遊戲中還是很多舊的圖耶 ... 之前用 gemini 產的邊框都不要了**」。

**全面 audit 結果**：13 個 Gemini-produced UI webp asset 中：
- 4 個已 orphan（沒人 import）→ 直接刪
- 9 個還在用 → 全部用 Pixi.Graphics 程式化重做

**保留**：
- `public/assets/spirits/*.webp`（8 chibi 立繪 — owner 確認保留）
- `public/assets/symbols/gems/*.webp`（5 gem shape — p11-vA-03 已棄用，可順手清）
- `public/assets/audio/*`（Suno BGM/SFX）
- `public/assets/fx/sos2-*`（SOS2 atlas — 機制 FX 用）
- `public/assets/ui/pwa-icon-*.png`（PWA 安裝圖示）

Sprint 12 結束後：`public/assets/ui/` 只剩 PWA icon 兩個，所有 Gemini border / frame / button / decoration 都沒了。

---

## 工作項目（6 PRs + closure）

| # | Track | 範圍 | Files |
|---|---|---|---|
| **s12-ui-01** | Orphan + Decorations | 刪 4 orphan webp + corner-ornament 改 programmatic L-bracket + dragon-corner 移除 webp 路徑（既有 fallback 永久走）| `Decorations.ts`, `SlotReel.ts`, `UiAssets.ts`, public/assets/ui/ delete 4 |
| **s12-ui-02** | LoadingScreen | logo-mark + divider 兩 webp → 純 goldText + Graphics 線 | `LoadingScreen.ts`, `BattleScreen.ts` (divider 用), delete 2 |
| **s12-ui-03** | UiButton rewrite | btn-normal + btn-ornate → Graphics gradient + border + Text，preserve normal/ornate variants | `components/UiButton.ts`, delete 2 |
| **s12-ui-04** | SpiritPortrait rewrite | portrait-ring → Graphics clan-color ring 風格 mockup SpiritToken | `components/SpiritPortrait.ts`, delete 1 |
| **s12-ui-05** | SlotReel + win-burst | slot-frame → programmatic + win-burst → Graphics burst | `SlotReel.ts`, `BattleScreen.ts`, delete 2 |
| **s12-ui-06** | Final cleanup | UI_ASSET_KEYS empty (或只剩 pwa icons) + LoadingScreen drop UI preload + 清 orphan gem-shape webp | `UiAssets.ts`, `LoadingScreen.ts`, delete remaining gems |
| closure | Meta | Sprint 12 closure | inline |

---

## 依賴鏈

```
s12-ui-01 (orphan + corner) ──→ s12-ui-02 (Loading) ──→ s12-ui-03 (UiButton) ──→ s12-ui-04 (Portrait)
                                                                                          ↓
                                         s12-ui-05 (SlotReel + win-burst) ←─────────────┘
                                                       ↓
                                         s12-ui-06 (final cleanup) ──→ closure
```

每 PR sequential — 確保每個刪除動作後 build 仍 pass + visual 仍 OK。

---

## 驗收標準（Sprint 12 exit gate）

- [ ] `public/assets/ui/` 只剩 `pwa-icon-192.png` + `pwa-icon-512.png`
- [ ] `UiAssets.ts` UI_ASSET_KEYS 為空 array（或只剩 pwa icons）
- [ ] LoadingScreen UI preload 整段移除（pwa icon vite-plugin-pwa 自處理）
- [ ] 視覺對齊 mockup variant-a.jsx — 所有 border / frame / button / decoration 純 Graphics
- [ ] `npm run build` 過
- [ ] sim coin_rtp 維持 95-110%（純視覺 sprint）

---

## 暫不動清單

- 8 chibi spirit `.webp` — IP 視覺命脈
- SOS2 atlas — 機制 FX 用
- Audio assets
- PWA icon

---

## Sprint 11 → Sprint 12 銜接 fact

- Sprint 11 closure: drawer `c29e8b0b444501f8`
- Audit 結果在本 ROADMAP §Audit
- Mockup 視覺 reference: `download_picture/Dual Slot Pixi/battle-shared.jsx` (PrimaryCTA / GhostBtn / SpiritToken / CornerOrnament 4 component as Graphics translation source)
