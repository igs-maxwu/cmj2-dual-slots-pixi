# Chore · FX Preview Harness

## 1. Context

PR: **chore · FX preview via URL param + console hook**

Why: Signature animations are currently locked inside `attackTimeline()` Phase 4 — you only see each one if that spirit's symbol wins a way during normal gameplay. Sprint 3 A has 4 male signatures to build (Meng + Yin done, Xuanmo + Lingyu pending); iterating on them without a preview harness wastes time on the RNG. This PR adds a **URL param** and a **console hook** to play any signature on demand.

Goal:
- `http://localhost:5173/cmj2-dual-slots-pixi/?fx=dragon-dual-slash` → loads straight into a minimal FX preview scene, plays that signature on loop
- In any running game, `window.__DEV_FX.play('tiger-fist-combo')` in the browser console triggers that signature on top of current screen
- `window.__DEV_FX.list()` returns the array of available signature names
- Both paths tree-shake out of production builds (`if (import.meta.env.DEV)` gate)

Source: SPEC §21 (demo-mode precedent for dev hotkeys), existing `attackTimeline()` structure in `src/screens/SpiritAttackChoreographer.ts`.

Base: `master` (HEAD `da40ae7` or later)
Target: `feat/chore-fx-preview-harness`

## 2. Spec drift check (P6 — mandatory)

`mempalace_search "FX preview signature dev harness"` + `"SPEC §21 demo mode dev panel"`.

Known:
- SPEC §21 already allows dev hotkeys (`Ctrl+Shift+D`) — this PR is analogous but for FX preview
- `DEMO_MODE` flag is a future concept (per SPEC §21.5 tree-shake in prod). For this PR, use `import.meta.env.DEV` as the gate since Vite already provides it.

## 3. Task

### 3a. New file `src/screens/FXPreviewScreen.ts`

Implements `Screen` interface. A minimal preview environment:
- Dark background (reuse `T.SEA.abyss` rect fill like AmbientBackground)
- Center-screen "stage" at `CANVAS_WIDTH/2, CANVAS_HEIGHT/2`
- A dummy "avatar" Sprite (use any spiritKey's texture, default `canlan`) so `ctx.avatar` has something real
- A stub "targets" array of 3 positions spaced horizontally around the stage (simulate enemy formation cells)
- Header text at top: `FX PREVIEW · <signature-name>` in goldText
- Footer hint: "Press <space> to replay · Press <esc> to return to DraftScreen"
- Constructor takes the signature name to preview:
  ```ts
  constructor(private signatureName: string, private onExit: () => void)
  ```
- `onMount()` — builds the scene, then calls `playSignatureLoop()`
- `playSignatureLoop()` — calls `attackTimeline()` with a ctx targeting the signature, awaits completion, waits 800 ms, repeats
- Keyboard: space bar immediately replays, esc calls `onExit()`
- `onUnmount()` — destroys container + removes keyboard listener

**Implementation detail**: `attackTimeline()` takes an `AttackOptions` with the spirit's `symbolId`. Build a reverse lookup: for each `SpiritSignature` enum value, find which `PERSONALITIES[key].signature` matches and use that key's symbolId.

### 3b. New file `src/systems/FXDevHook.ts`

Exports a function `installFxDevHook(app: Application)` that:
- Only runs if `import.meta.env.DEV` is true (tree-shake in prod)
- Attaches `window.__DEV_FX = { play, list }` to the global window
- `play(name: string)` — looks up the signature, builds a minimal ctx at centre of current stage, calls `_sigXxx` via the signature dispatcher — does NOT transition screens, just overlays the FX on whatever is currently showing
- `list()` — returns the `SpiritSignature` enum values as a string array

**Implementation detail**: `play()` needs access to a shared Pixi `app` + current `stage`. Pass the `Application` as parameter; use `app.stage` as the FX layer.

### 3c. Wire URL param into `src/main.ts`

Near the top of `main()`, after `Application.init(...)`:

```ts
const fxParam = new URLSearchParams(location.search).get('fx');
if (fxParam && import.meta.env.DEV) {
  sm.show(new FXPreviewScreen(fxParam, () => {
    // On exit: go to Draft as normal
    sm.show(new DraftScreen((cfg) => sm.show(new BattleScreen(cfg, goToDraft))));
  }));
  return; // Skip LoadingScreen for preview mode
}
```

Also install the dev hook unconditionally (it self-gates on `import.meta.env.DEV`):

```ts
installFxDevHook(app);
```

Place after `initTweenTicker(app.ticker)`.

**Note**: `FXPreviewScreen` still needs assets loaded (spirit textures for the avatar). Lazy-load just the canlan texture inline before mounting, or inline-call `Assets.load` for the single required asset. Keep it minimal.

### 3d. Signature-name validation

`FXPreviewScreen` and `FXDevHook.play()` should both:
- Accept any string from the `SpiritSignature` union
- If the name is invalid, display an error in the preview screen (or console.warn in dev hook) and return without crashing

### 3e. Files touched

**New**:
- `src/screens/FXPreviewScreen.ts`
- `src/systems/FXDevHook.ts`

**Modified**:
- `src/main.ts` (URL param branch + dev hook install, ~8 lines)

**Forbidden**:
- `SpiritAttackChoreographer.ts` stays UNTOUCHED. The preview harness consumes `attackTimeline()` and `PERSONALITIES` as read-only; do NOT add an "internal dispatch" helper to the Choreographer file.
- `SPEC.md` stays untouched (dev tool, not a game feature).
- No changes to DraftScreen / BattleScreen / SlotReel / any other screen.

**If you find bugs in forbidden files, STOP and report — do not fix.**

## 4. DoD (P1 — verbatim)

1. TypeScript compiles (`npm run build` succeeds)
2. No new `console.log` / `debugger` / temporary timing helpers in `src/`
3. `git commit` + `git push` to feature branch
4. Report PR URL

Additional reminders:
- The `if (import.meta.env.DEV)` gate must tree-shake cleanly — verify that `npm run build` production bundle does NOT contain the string `__DEV_FX`. Quick check: `grep "__DEV_FX" dist/assets/*.js` should return zero matches.
- Do NOT add a Back button inside `FXPreviewScreen` UI if you can't figure out interaction cleanly — keyboard esc is sufficient.
- `FXPreviewScreen.ts` / `FXDevHook.ts` editing loop: ≥ 3 edits without converge → STOP report.

## 5. Handoff

- PR URL
- 1-line summary
- Spec deviations: expected 0
- Dependencies: existing `attackTimeline()`, `PERSONALITIES`, `SYMBOLS`
- Did the production bundle contain `__DEV_FX`? (should be no)
- Demo URL to test: `?fx=dragon-dual-slash` / `?fx=tiger-fist-combo` / `?fx=lightning-xcross`
