# Accent Palette + Settings Gear — Design Spec

**Date:** 2026-06-09
**Branch:** `feat/dark-mode` (extends the theming system; PR #15)
**Status:** Approved (design), implementation in progress

## Goal

Let visitors pick an **accent color** for the site, and house theme + accent behind a single **settings gear** in the top-right corner. Accent is orthogonal to the light/dark theme: it recolors the interactive/link color only; paper and ink stay driven by `data-theme`. Builds on the dark-mode token system ([2026-06-09-dark-mode-design.md](2026-06-09-dark-mode-design.md)).

## Decisions (locked)

- **Scope: accent only**, not whole palettes. The accent is `--link` / `--link-hover` (used in just 2 CSS rules + focus rings). Paper/ink/lines stay theme-driven. Keeps the beige/black identity; trivial and low-risk.
- **6 earthy hues**, sourced from the existing `--cat-*` palette for cohesion: **green (default), teal, amber, coral, violet, olive.**
- **Single settings gear** → opens a compact panel containing the theme toggle + accent swatches (reuses the writing tool's `#settings-toggle`/`#settings-panel` pattern).

## Architecture

### A. Accent tokens (`assets/css/style.css`)
- New `data-accent` attribute on `<html>`. Default (absent, or `green`) = current `:root` `--link`/`--link-hover` — **no override**, so existing behavior is unchanged for anyone who never picks.
- For each non-default hue, two override blocks:
  ```css
  html[data-accent="teal"]                    { --link:<L>; --link-hover:<Lh>; }
  html[data-theme="dark"][data-accent="teal"] { --link:<D>; --link-hover:<Dh>; }
  ```
- **Hue mapping** (cohesive with category palette): light value ≈ the existing `--cat-*-deep` tone (dark enough for AA on beige); dark value ≈ the existing lightened `--cat-*` dark value (already AA-checked on `#16150F`). Hover = link darkened (light) / lightened (dark).
- **Contrast requirement:** every accent's `--link` must be **≥ 4.5:1** against its paper (`#f2f2e4` light / `#16150F` dark) — link text is body-size. Exact hexes are **computed and AA-verified** by `tools/accent_palette.py`, not hand-guessed; values failing AA are auto-darkened/lightened until they pass.
- The `--cat-*` semantic category colors are **untouched** by accent.

### B. No-flash init (`assets/js/theme-init.js`)
Extend the existing pre-paint IIFE to also read `localStorage.accent` and set `data-accent` on `<html>` before first paint (same FOUC-free guarantee as theme). Invalid/absent → no attribute (default green).

### C. Settings gear + panel (`assets/js/theme-toggle.js`)
- The current bare top-right button becomes a **gear `<button>`** (`aria-haspopup`, `aria-expanded`, aria-label "Settings"). Clicking toggles a **panel** (the existing `theme-dissolve`/8-bit styling extended).
- Panel contents:
  - **Theme** row — the light/dark toggle; flipping still runs the **pixel-dissolve**.
  - **Accent** row — 6 pixel-style swatch `<button>`s (hard border, blocky shadow), each `aria-pressed` reflecting the active accent, accessible name = hue. Click sets `data-accent`, persists `localStorage.accent`, updates pressed state.
- Panel behavior (mirror writing tool): hidden by default; open on gear click; close on Esc, on click outside, and on second gear click; move focus to the first control on open and restore focus to the gear on close.
- Accent change recolors links **instantly** with a subtle ~200ms tint (no dissolve — the dissolve is reserved for the theme flip). Add `transition: color .2s ease` to links if not already smooth.

### D. Rollout
`theme-init.js` and `theme-toggle.js` are already included on all 31 pages and in `build.py`'s template, so **no per-page HTML edits**. Work = accent CSS + the two JS files + the demo.

### E. Demo (`dev/theme-demo.html`)
Add the gear + panel + 6 accent swatches so the real colors can be seen and picked in both themes; keep the dissolve replay controls.

## Acceptance criteria
1. 6 accents selectable; each `--link` ≥ 4.5:1 on its paper in **both** light and dark.
2. Accent persists across pages and reloads; no flash on load.
3. Gear opens/closes the panel via click, second click, Esc, and click-outside; keyboard accessible; focus managed; swatches + toggle have correct ARIA.
4. Theme toggle still fires the pixel-dissolve from inside the panel.
5. Default (no accent chosen) renders exactly as today (green).
6. Category `--cat-*` colors unchanged.
7. All JS passes `node --check`; no CSP violations (scripts stay external).

## Out of scope
- Whole coordinated palettes (different paper/ink) — explicitly deferred.
- Re-hueing the semantic category colors.
- Per-page HTML changes.
