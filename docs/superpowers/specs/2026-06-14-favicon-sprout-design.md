# Favicon — the one-eyed sprout

**Date:** 2026-06-14
**Branch:** `feat/favicon-sprout` (off `origin/main`)
**Status:** Designed (awaiting spec review → plan)

## Problem

The site icon (`assets/images/content/favicon.png`, referenced by `<link rel="icon">`
on all 30 pages) is currently the hand-drawn **"lnzh" cursive wordmark**. Four
letters of script collapse into an unreadable blob at 16px — the one size a favicon
must survive. It also can't reflect the site's identity beyond "some text," and it's
static: it ignores the light / dark / nebula themes the rest of the site honors.

We want a real **mark** — small, legible at tab size, unmistakably hand-drawn-ours,
and alive to the theme system (including the cosmic/nebula palette).

## Goals

- A favicon that reads cleanly at **16px** and scales up gracefully.
- **Unmistakably the site's voice** — warm, imperfect, idiosyncratic, hand-drawn.
- **Tracks the theme:** black on light, cream on dark, lavender in nebula — matching
  the site's `--ink`/`--paper` tokens.
- Works with **no JS** (OS light/dark) and **better with JS** (follows the in-page
  toggle, including nebula, which the OS can't see).
- Survive on **both light and dark browser chrome** (a bare black mark fades on a
  dark tab bar; the recolor is what saves it).
- Lean: one tiny art definition, one small script, a per-page `<link>` swap. No bloat.

## Non-goals

- **No homepage mascot.** This is a self-contained favicon only; the homepage
  `drawn-slot data-guide="a little creature"` stays a separate, future problem
  (decided interactively).
- **No chip / tile / border.** The mark is bare (the recolor makes a chip
  unnecessary). Exception: `apple-touch-icon` only — see Edge cases.
- No redesign of `theme-toggle.js`'s theme logic; the favicon observes state, it
  doesn't own it.
- No change to the `/writing/`, `/about/` etc. URLs or nav.

## The creature

Decided interactively via the brainstorming visual companion: **favicon → creature →
the one-eye → "the sprout" → bare → theme-synced.**

A squat one-eyed ink sprite standing on two little foot-nubs, eye glancing sidelong —
caught mid-shuffle, curious. One solid silhouette + a single big eye = legible at
16px; the sidelong gaze + feet give it life. Two tones only: **body = `--ink`,
eye-white = `--paper`** (so it literally wears the site's ink-on-paper at every theme).

### Canonical geometry (`viewBox="0 0 64 64"`) — single source of truth

```
feet    <ellipse cx="26" cy="52" rx="3.4" ry="2.2"/>   fill: INK
        <ellipse cx="38" cy="52" rx="3.4" ry="2.2"/>   fill: INK
body    <path d="M17 28 C19 17 45 17 47 28 C50 40 45 50 32 50.5 C19 50 14 40 17 28 Z"/>  fill: INK
eyeball <circle cx="31" cy="30" r="9.3"/>              fill: PAPER
pupil   <circle cx="34.3" cy="30" r="4.2"/>            fill: INK
glint   <circle cx="32.6" cy="28.4" r="1.1"/>          fill: PAPER   (decorative; may vanish <20px — fine)
```

### Theme colors (from `assets/css/style.css` tokens)

| Theme  | INK (body, pupil) | PAPER (eye-white, glint) |
|--------|-------------------|--------------------------|
| light  | `#000000`         | `#f4f1e1`                |
| dark   | `#f4f1e1`         | `#100e0a`                |
| nebula | `#ece7fa`         | `#06040f`                |

The eye inverts with the body, so on dark/nebula the pupil reads as a glowing
cream/lavender dot inside a dark eye — intentional, not a bug.

## Architecture

Three layers, degrading gracefully:

1. **`favicon.svg`** (the static `<link>` target) — bare sprout with an internal
   `<style>` carrying a `@media (prefers-color-scheme: dark)` rule that swaps INK/PAPER
   between the light and dark values. This alone gives every modern browser a correct
   **OS-level** light/dark icon with **zero JS**.
2. **`favicon.png`** — a rasterized **light** sprout (~48×48), the `type="image/png"`
   fallback for browsers that don't render SVG favicons (older Safari). Replaces the
   current wordmark PNG at the same path.
3. **`assets/js/favicon.js`** (deferred, external — CSP `script-src 'self'`) — the part
   that makes it follow the **site's own** toggle, including nebula:
   - On load and whenever `<html>`'s `data-theme` / `data-palette` change, compute the
     mode (`data-palette="cosmic"` → nebula; else `data-theme` → dark/light), build the
     sprite SVG string with that theme's INK/PAPER, and set the `<link rel="icon">`
     href to a `data:image/svg+xml,…` URI. (CSP site-wide allows `img-src 'self' data:`,
     verified.)
   - Watch via a `MutationObserver` on `document.documentElement` (attributes
     `data-theme`, `data-palette`) — fully decoupled, so it picks up the existing
     theme-toggle and the nebula supernova unlock without editing `theme-toggle.js`.
   - The sprite path data lives as one JS constant = the same geometry above, so JS,
     `favicon.svg`, and `favicon.png` never drift (a small `tools/make_favicon.py` or
     equivalent renders `.svg`/`.png` from that one definition).

**Data flow:** `theme-init.js` sets `data-theme`/`data-palette` pre-paint → browser
fetches `favicon.svg` (OS-correct) → `favicon.js` runs, overrides the href to match the
actual site state → user toggles theme/unlocks nebula → MutationObserver fires →
href rebuilt. No flash matters here: the tab icon updates asynchronously regardless.

## Files

- **New:** `assets/images/content/favicon.svg` (self-inverting art).
- **New:** `assets/js/favicon.js` (theme-sync, ~40–60 lines).
- **New (optional, build):** `tools/make_favicon.py` — emits `favicon.svg` + `favicon.png`
  from the canonical geometry, so all three layers share one source.
- **Replace:** `assets/images/content/favicon.png` (wordmark → light sprout, ~48px).
- **Edit (30 HTML files):** alongside the existing
  `<link rel="icon" type="image/png" href="<prefix>/assets/images/content/favicon.png">`,
  add an SVG-first link **before** it and the script:
  ```html
  <link rel="icon" type="image/svg+xml" href="<prefix>/assets/images/content/favicon.svg">
  <link rel="icon" type="image/png"     href="<prefix>/assets/images/content/favicon.png">
  ...
  <script src="<prefix>/assets/js/favicon.js" defer></script>
  ```
  `<prefix>` is each page's existing depth-relative path (reuse what the current PNG
  link already encodes — the link set varies `assets/…` → `../../../assets/…` by depth;
  do **not** hardcode one prefix). The SVG link must come first so capable browsers
  prefer it. JS-driven href is set absolute via `new URL(...)`, sidestepping depth.

## Edge cases

- **Dark browser chrome:** solved by the recolor — dark/nebula ink is cream/lavender,
  which reads on a dark tab bar. This is the whole reason the bare mark is viable.
- **`apple-touch-icon` (iOS home screen):** iOS ignores transparency and composites on
  black, which would swallow the light (black) sprout. So the **only** place a
  background survives: ship one `apple-touch-icon.png` (180×180) with an **opaque cream
  `#f4f1e1` field + black sprout**. Minor, optional, but prevents an invisible/ugly
  home-screen icon. (Not a "chip" on the tab — purely an iOS necessity.)
- **`prefers-reduced-motion`:** N/A — the icon doesn't animate.
- **Nebula reachability:** OS `@media` can't see cosmic mode; only `favicon.js` can.
  Without JS, nebula users see the dark icon — an acceptable graceful degrade.

## Consistency note

The repo already has `critters.js` / `critters-home.js`. Before finalizing the art,
glance at their drawing style so the sprout reads as kin to the existing critters, not
a stylistic outlier (the "unmistakably mine, never homogenize" bar). Adjust stroke/
proportion only if needed; geometry above is the starting point.

## Verification

- `node dev/verify-matrix.mjs` — depth × theme matrix + Lighthouse a11y must stay green
  (favicon `<link>`/asset must fetch 200 at every depth; this is exactly the kind of
  per-depth path that has bitten us before).
- High-DPI screenshots of a real tab at 16px in **light, dark, nebula** + on **light
  and dark browser chrome** (headless Chrome, both `prefers-color-scheme`).
- Toggle the theme and trip the nebula unlock live; confirm the tab icon recolors.
- `node --check assets/js/favicon.js`.

## Open questions

1. Include the optional `apple-touch-icon.png` now, or skip until wanted? (Lean default:
   include — it's one small file and prevents a broken iOS icon.)
2. Keep `favicon.png` fallback at 48px, or also emit 32px/16px PNGs? (Default: a single
   48px PNG is plenty for the fallback path.)
