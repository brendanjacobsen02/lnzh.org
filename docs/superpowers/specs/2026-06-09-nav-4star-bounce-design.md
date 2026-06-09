# Nav 4-star toggle — "Bouncy Wave" motion redesign

**Date:** 2026-06-09
**Branch:** `feat/nav-4star-bounce` (off `origin/main`)
**Status:** Design — pending review

## Problem

The left sidebar's dropdown toggle is `assets/images/ui/4star.png` — four little hand-drawn
asterisk-stars in a row (`※※※※`). Today, opening the menu rotates the whole strip
`rotate(180deg) scale(1.1)` (style.css `.dropdown-trigger.active .nav-dropdown-toggle`).

Two issues, confirmed in the codebase:

1. **Clipping.** `nav { overflow-y: auto }` (style.css ~line 132). Per CSS spec, when one axis is
   `auto`/`scroll` and the other is `visible`, the `visible` axis is **forced to `auto`** — so the
   nav silently clips on **both** axes. A wide strip rotating 180° stands vertical at the midpoint
   of the spin (its bounding box grows tall), and `scale(1.1)` pushes past the edges → the star and
   nearby nav elements get cut off. This is a clipping bug, independent of which animation we use.
2. **Generic motion.** A 180° spin + scale is a stock "dropdown caret" gesture. It doesn't read as
   cute / hand-drawn / maximalist — the site's theme.

## Goals

- Replace the spin with a motion that fits the cute / maximalist / hand-designed theme.
- Stop the clipping.
- Keep it asset-driven and swappable (per the ongoing hand-drawn migration).
- Respect `prefers-reduced-motion`.
- Apply site-wide with minimal surface area.

## Non-goals

- No redesign of the dropdown open/close height logic, the cursor sprite, `nav-glow`, the list-page
  or coffee dropdowns. Leave them as-is.
- No new image assets in this change (the existing PNG is reused).
- No edits to per-page nav markup (see "Approach").

## Chosen design — "Bouncy Wave (Springy)"

Decided interactively via a motion playground. Final combo:

| Dimension | Decision |
|---|---|
| Flavour | **Springy** — squash-and-stretch hop (medium intensity) |
| Wave direction | **Left → right**, ~70 ms star-to-star stagger |
| Menu reveal | **Bounce-in** — menu words drop in with a small bounce, echoing the stars |
| Idle hint | **On** — soft periodic wave at rest, inviting the click |
| Hover preview | **On** — quick one-hop across the row on hover |
| Dark mode | **Leave star coloring as-is** (no invert filter; reads fine today) |

## Approach — progressive enhancement in JS, zero HTML churn

The nav is **not** a shared partial. Its markup is hardcoded in every page's `index.html`, and
`build.py` (gitignored, local-only) holds a separate, slightly different copy for generated blog
posts. Editing the toggle markup in dozens of files would be brittle and is already inconsistent.

Instead, **enhance at runtime**. `assets/js/nav-dropdown.js` already loads on every page. On init it
will transform the existing `<img class="nav-dropdown-toggle" src=".../4star.png">` into a 4-slice
structure. Result: the feature is **two files** — `nav-dropdown.js` + `style.css` — applied
site-wide automatically, including future `build.py` output, with no HTML edits.

Graceful degradation: with JS off, the dropdown already does nothing (its logic is JS-only), so the
plain `<img>` simply shows static — no regression.

### The 4-slice technique

The four stars are evenly distributed across the 278×124 strip (aspect ≈ 2.2419). JS replaces the
`<img>` with:

```html
<span class="nav-dropdown-toggle fourstar" role="img" aria-label="more"
      style="--star-src:url(<src>); --star-aspect:<naturalW/naturalH>">
  <span class="nav-star" style="--i:0"></span>
  <span class="nav-star" style="--i:1"></span>
  <span class="nav-star" style="--i:2"></span>
  <span class="nav-star" style="--i:3"></span>
</span>
```

CSS:

```css
.fourstar { height: 1.25rem; width: calc(1.25rem * var(--star-aspect)); display: flex; }
.nav-star {
  flex: 1; height: 100%;
  background-image: var(--star-src);
  background-repeat: no-repeat;
  background-size: 400% 100%;                          /* strip is 4× one slice */
  background-position-x: calc(var(--i) * 33.3333%);    /* 0 / 33.33 / 66.67 / 100% */
  background-position-y: center;
  transform-origin: bottom center;
}
```

- `--star-aspect` is read from the image's `naturalWidth/naturalHeight` at runtime, so if the asset
  is later redrawn at a different ratio, sizing stays correct. Fallback `2.2419` if unread.
- Built so a future swap to **four separate hand-drawn star PNGs** is a small change (replace the
  four background slices with four `src`s) — keeps it asset-driven.

### Animations (concrete values, from the approved playground)

All target `.nav-star`; the trigger already toggles `.active` on open/close, which drives them.

**Open — Bouncy Wave (Springy):**
```css
@keyframes navStarBounce {
  0%   { transform: translateY(0)    scaleY(1); }
  28%  { transform: translateY(-10px) scaleY(1.18); }
  52%  { transform: translateY(0)    scaleY(.8); }
  72%  { transform: translateY(-3px) scaleY(1.07); }
  100% { transform: translateY(0)    scaleY(1); }
}
.dropdown-trigger.active .nav-star {
  animation: navStarBounce .56s cubic-bezier(.3,1.2,.5,1) backwards;
  animation-delay: calc(var(--i) * 70ms);   /* L→R wave */
}
```

**Menu reveal — Bounce-in** (replaces the current slide on `.dropdown-item`):
```css
@keyframes navItemBounce {
  0%   { opacity: 0; transform: translateY(-10px) scale(.96); }
  60%  { opacity: 1; transform: translateY(3px)   scale(1.02); }
  100% { opacity: 1; transform: translateY(0)     scale(1); }
}
.dropdown-content.active .dropdown-item {
  animation: navItemBounce .42s cubic-bezier(.3,1.3,.5,1) forwards;
}
/* stagger via existing :nth-child delays, ~70ms apart starting ~.12s */
```
The existing `.dropdown-item { opacity:0; transform:translateX(-10px) }` slide and its
`transition`/`:nth-child` delays are replaced by this keyframe + animation-delays.

**Idle hint — at rest, when closed:**
```css
@keyframes navStarIdle {
  0%,70%,100% { transform: translateY(0); }
  78% { transform: translateY(-4px) scaleY(1.07); }
  85% { transform: translateY(0)    scaleY(.98); }
  92% { transform: translateY(-1.5px); }
}
.dropdown-trigger:not(.active) .nav-star {
  animation: navStarIdle 3.8s ease-in-out infinite;
  animation-delay: calc(var(--i) * .07s);
}
```
Note: the desktop dropdown is open by default, so the idle hint mainly appears once the visitor has
collapsed it — exactly when a nudge to reopen is useful.

**Hover preview — when closed:**
```css
@keyframes navStarHop { 0%{transform:translateY(0)} 40%{transform:translateY(-8px) scaleY(1.14)} 100%{transform:translateY(0)} }
.dropdown-trigger:not(.active):hover .nav-star {
  animation: navStarHop .45s ease;
  animation-delay: calc(var(--i) * .05s);
}
```

**Suppress auto-play on restore:** when the page loads with the dropdown expanded-by-default, JS
restores `.active` with transitions disabled (existing pattern, nav-dropdown.js ~lines 50–70). Extend
that suppression to **animations** (e.g. add a transient `.no-anim` class that sets
`animation: none !important` on `.nav-star`, removed after the same 10 ms tick) so the bounce does
**not** fire on initial load — only on real user clicks.

**Remove:** the old `.dropdown-trigger.active .nav-dropdown-toggle { transform: rotate(180deg) scale(1.1) }`
rule and its `transition`.

### Clipping fix

Change `nav { overflow-y: auto }` → `nav { overflow: visible }`.

- The Bouncy Wave is vertical-only and the toggle sits well below the top edge, so it stays in
  bounds — but the fix also removes the forced `overflow-x: auto` that clipped the old spin, and
  future-proofs the hover hop.
- Risk: `nav` is `position:fixed; height:100vh`; with `overflow:visible` it can't scroll if its
  content ever exceeds the viewport (very short screens + many expanded items). Mitigate with a
  guard that restores scrolling only when cramped:
  ```css
  @media (max-height: 640px) { nav { overflow-y: auto; } }
  ```

### Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  .nav-star { animation: none !important; }
  .dropdown-content.active .dropdown-item { animation: none !important; opacity: 1; transform: none; }
}
```
The slice container carries `role="img"` + `aria-label` (from the original `alt`), preserving the
"more" label the `<img alt>` provided. Keyboard/click behaviour is unchanged (handler stays on the
trigger).

## Files touched

- `assets/js/nav-dropdown.js` — build the 4-slice toggle; extend restore-suppression to animations.
- `assets/css/style.css` — slice styles; bounce/idle/hover/menu keyframes; reduced-motion; remove
  the rotate rule; `overflow` fix.

No HTML, no new assets, no `build.py` change required.

## Verification

- Manual: homepage + a blog post (deeper relative paths) in Chrome + Safari, light **and** dark.
  Open/close repeatedly (bounce re-fires), confirm the menu bounces in, the idle hint loops when
  collapsed, hover hops, and **nothing clips** at the sidebar edge.
- Initial load with the dropdown expanded-by-default does **not** auto-play the bounce.
- `prefers-reduced-motion: reduce` (macOS: Reduce Motion) → no animation, menu fully visible.
- Reduced-motion / mobile path still skips the cursor sprite (untouched).

## Future (out of scope)

- Swap the sliced strip for four separate hand-drawn star PNGs (asset-driven; small change).
- Optional: reconcile the divergent nav markup between pages / `build.py` into one source.
