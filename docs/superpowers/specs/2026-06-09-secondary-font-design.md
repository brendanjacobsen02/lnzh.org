# Secondary font — Spectral for prose

**Date:** 2026-06-09
**Status:** implemented (branch `feat/secondary-font`)

## Goal

The site read in a single voice (Newsreader for everything via `body`
inheritance). Introduce a **secondary font** with character — "playful but
elegant" — to carry the long-form reading work, and demote Newsreader to a
header/display role.

## Decision

Chosen via a wide → narrow visual comparison (8 candidates spanning serif,
grotesque, and rounded). The pick: **Spectral**, Regular **400**, **prose-only**.

## Font roles (CSS variables in `:root`)

| Variable   | Family     | Role |
|------------|-----------|------|
| `--header` | Newsreader | headers / wordmarks (`h1`–`h4`) |
| `--body`   | Spectral   | body text, subtitles, lists, prose |
| `--mono`   | Archivo    | functional UI chrome — unchanged |

Fallback for both serifs: `Georgia, serif`.

## Scope

**Switched to Spectral (`--body`):** `body` default; `.filter-btn`;
`.blog-card`; the `.thoughts-controls` text inputs / `select`; the
`#coffee-comment-form` textarea.

**Set explicitly to Newsreader (`--header`):** `h1, h2, h3, h4` (they
previously only inherited it; now that `body` is Spectral they must be pinned).

**Deliberately left unchanged:**
- All `--mono` / Archivo chrome — the writing-page HUD (tabular `words 00 /
  sentences 00`), its buttons, small labels. Archivo's tabular figures keep the
  counter tidy; Spectral would wobble there.
- `Caveat` on the temporary hand-drawn nav placeholders.
- The writing editor's own typed text (`.editor-text`) and its keep/cut popover
  (`.skp-*`) — that tool is under active redesign on another branch; left for
  that session to opt into Spectral if/when it wants.

## Implementation notes

- Single file: `assets/css/style.css` (`@import` adds Spectral 400/500/600 +
  italic 400; `:root` gains `--header`/`--body`; the swaps above).
- Built on a branch off `origin/main` (not the shared `feat/writing-page-redesign`
  working tree) and shipped via PR, since it is a site-wide change independent of
  the writing redesign.
- Verified with headless-Chrome screenshots of `about`, `blog/tomato`, `list`,
  and `writing` — headers Newsreader, prose Spectral, chrome Archivo, editor
  untouched.
