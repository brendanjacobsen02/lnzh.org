# Block caret (editor-foundation rebuild) — design spec

**Date:** 2026-06-09
**Status:** Proposed (not yet implemented)
**Motivation:** A reliable, accent-colored, terminal-style **block caret** — reusable
site-wide — plus a foundation that makes blackout and sentence review robust.

## Why a rebuild

We tried four ways to put a block caret on the writing editor's `contenteditable`:

1. `caret-shape: block` — browser support is inconsistent; rendered thin in empty
   fields and flickered thin/block.
2. A faux block measured from the **collapsed Range rect** — a collapsed Range has
   no measurable rectangle on an empty field, an empty line, or right after a
   newline, so the block jumped or vanished.
3. A faux block measured from a **marker at the end** of the input — wrong whenever
   the caret wasn't at the end.
4. A faux block measured from a **marker at the caret** (restored by character
   offset) — worked, but it *mutated the live editable* (insert marker → normalize →
   reselect) on every caret move, which destabilized typing (lost spaces, stray
   line breaks, caret/text divergence).

**Root cause:** a `contenteditable` gives us neither a reliable caret rectangle nor
a DOM we can safely measure without disturbing editing. The fix is to stop measuring
the live editable and instead own the rendering.

The current shipped caret is the **native caret tinted to the accent color** — fully
reliable, just not a block. This spec is the path to a real block.

## Approach — input + mirror ("overlay editor")

The standard architecture used by code editors (CodeMirror, Draft.js, the
`textarea-caret-position` technique):

- **Input layer:** a real, focusable element that owns the text + native selection
  and handles ALL input (typing, IME, paste, undo, selection). It is visually
  invisible (transparent text, `caret-color: transparent`) but receives focus and
  keystrokes. A `<textarea>` is the most robust choice — newlines, wrapping,
  selection, and undo are all native and bug-free.
- **Presentation layer ("mirror"):** a read-only `<div>` rendered behind/over the
  input with **identical metrics** (same font, size, line-height, padding, width,
  wrapping). We rebuild it from the input's value on every change. Because *we* build
  this DOM, we can:
  - wrap each sentence in a span (kept / pending / cut styling, blackout redaction),
  - place a **caret marker span** at the exact caret index and measure *that* span
    for a pixel-perfect block — no mutation of the input, no selection disturbance.

The block caret element is positioned (fixed/absolute) at the marker's rect.

```
.writing-editor (position: relative)
├── .editor-mirror   (the styled, read-only render — sentences, blackout, caret marker)
├── <textarea>       (transparent text + caret, on top, captures all input/selection)
└── .block-caret     (absolutely positioned block at the measured marker rect)
```

### Why this fixes everything

- **Caret position is always exact** — measured from a span we render, not a flaky
  Range. Works on empty fields, empty lines, after newlines, mid-text.
- **No editing instability** — the input is a native `<textarea>`; we never mutate it
  to measure. Whitespace, newlines, undo, selection all behave natively.
- **Blackout, sentence highlighting, kept/pending/cut** become trivial — they're just
  classes on mirror spans we already rebuild.
- **Reusable** — `OverlayEditor.create(container, { onChange, render })` can back any
  text field on the site; the block caret comes for free.

## Block caret details

- **Color:** solid `var(--link)` (the accent), so it follows the accent picker and
  dark mode. (Requested.)
- **Readability over text:** since the caret can sit on a character, render that one
  character in the mirror with an inverted/paper color while the caret covers it
  (terminal style), OR keep the block at the insertion point between characters. Pick
  during build; the inverted-char version reads best.
- **Blink:** CSS `steps(1)` animation; solid (no blink) while actively typing;
  respects `prefers-reduced-motion` (no blink, stays solid).
- **Shape:** width ≈ next character's cell (measured) or `0.55ch` at line end; height
  = line box.

## Sync requirements (the hard part)

The mirror must match the textarea exactly or the caret drifts:

- identical `font`, `font-size`, `line-height`, `letter-spacing`, `padding`,
  `border`, `box-sizing`, `width`, `white-space: pre-wrap`, `overflow-wrap`.
- mirror scrolls in lockstep with the textarea (`scrollTop`/`scrollLeft`).
- recompute on input, scroll, resize, font load, and theme/accent change.
- handle the trailing-newline case (textarea needs a trailing space/marker in the
  mirror so the last empty line has height).

## Scope & reuse

- **Phase 1:** build `OverlayEditor` + block caret; port the writing editor onto it,
  re-implementing sentence review (keep/cut/gating), blackout, HUD, drafts, summary
  against the new model. Sentence "cut" = splice from the textarea value.
- **Phase 2:** extract a tiny `block-caret`/`OverlayEditor` API and apply to other
  site text fields (comment boxes, etc.) so the block caret is truly everywhere.

The existing `assets/js/block-caret.js` (the contenteditable overlay) is kept as a
reference but is superseded by this approach.

## Risks / tradeoffs

- **Complexity & verification:** this is a real component; it needs careful
  cross-browser testing (IME, mobile, RTL, wrapping). Build behind the current
  reliable native-accent caret so we can fall back.
- **Metric drift:** any CSS mismatch between textarea and mirror misaligns the caret;
  the sync list above must be exhaustive and covered by manual checks in light/dark,
  each accent, and at multiple widths.
- **Accessibility:** the real `<textarea>` keeps the page accessible; the mirror is
  `aria-hidden`.

## Decision needed before building

- Confirm the input layer = `<textarea>` (recommended) vs a hidden contenteditable.
- Confirm caret = inverted-char terminal block vs insertion-point block.
- Confirm this is worth the rebuild now vs. keeping the native accent caret.
