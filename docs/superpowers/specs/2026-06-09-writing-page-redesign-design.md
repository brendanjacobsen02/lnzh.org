# Writing page redesign — design spec

**Date:** 2026-06-09
**Branch:** `feat/writing-page-redesign` (off `origin/main`)
**Page:** `writing/index.html` + `assets/js/writing-tool.js` + `assets/css/style.css`

## Summary

Redesign the `/writing/` page (UI **and** UX) so it fits the blog's cutesy,
papery, hand-drawn theme. The page keeps its signature **sentence-by-sentence
writing tool** — type, each finished sentence becomes a reviewable fragment you
accept or reject — but it is restyled and extended into something genuinely
usable.

Visual direction, settled through live mockups:

> **Quiet papery base (Direction A), refined toward _tech-minimalist_ with a
> _light retro-Japanese-arcade_ accent layer — cohesive with the existing
> cream/Newsreader theme, dark mode, accent picker, and pixel-dissolve.**

## Goals

- Make the page feel like part of the blog, not a utilitarian outlier.
- Keep the sentence ritual (accept/reject) as the signature interaction.
- Make it a real drafting tool: drafts persist and can leave the page.
- Add quiet, ambient stats and tasteful whimsy.
- Stay theme-aware (light/dark) and accent-aware automatically.
- Keep every decorative element **swappable** for Leon's in-progress
  hand-drawn assets (see memory: hand-drawn asset migration).

## Non-goals (explicitly out of scope)

- Editing already-saved drafts (drafts are create / export / delete only).
- A hand-drawn `writing` nav-title PNG — Leon will draw that; the nav link
  stays the current `nav-temp-link` text for now.
- Any change to other pages or shared components beyond the additive
  `style.css` rules + one font import.
- A backend or cross-device sync (persistence is local only).

## Decisions (locked with the user)

| Question | Decision |
|---|---|
| Scope | Open redesign — UI + UX; core tool must still work |
| Core purpose | "A bit of everything": ritual + calm space + playful toy + real tool |
| Extra features | Persistent drafts, export, gentle stats, whimsical touches — **all in** |
| Visual base | Direction A (quiet paper) |
| Personality | Tech-minimalist + a *little* retro arcade ("Dial 2"), kept classy |
| Fonts | **2 site-wide**: Newsreader (writing/body) + **IBM Plex Mono** (chrome only). Hard cap: 3–4 fonts site-wide, ever |
| Accent | Reuse existing `--link` so the accent picker + dark mode drive it |
| New image assets | None — CSS / unicode / existing PNGs only |

## Visual system

- **Typography**
  - Newsreader carries _all real writing_: the live sentence stream, kept/
    pending fragments, and saved draft text.
  - IBM Plex Mono is used **only** for small chrome: the header tag, the HUD
    counters, button labels, draft numbers, and section labels. Added to the
    Google Fonts `@import` at the top of `style.css`
    (`IBM+Plex+Mono:wght@400;500;600`). Allowed by the page CSP
    (`font-src`/`style-src` already permit Google Fonts).
- **Color** — a single accent equal to the existing `--link` variable, so the
  accent picker (`data-accent`) and dark mode recolor it for free. No new
  palette tokens.
- **Arcade / tech ingredients** (the "Dial 2" set the user picked):
  - Faint **pixel-grid** texture inside the writing box, drawn with
    `rgba(var(--text-rgb), ~0.03)` repeating gradients so it adapts to light
    and dark paper.
  - Blinking **block cursor** in the accent color (see "Block cursor" caveat).
  - **✦ sparkle pop** animation when a sentence is accepted/kept.
  - Leading-zero **scoreboard** counters: `words 008 · sentences 02 · kept 01`,
    tabular mono, accent numerals.
  - Tasteful arcade microcopy (e.g. an "insert coin"-style idle hint, an
    encouraging toast on save). Kept classy, not loud.
  - Crisp **boxy controls**: hairline border + a 2px offset shadow.
  - **Star dividers** reuse the existing `assets/images/ui/3starbig.png` /
    `4star.png` (and `-dark` variants) so a future redraw propagates.

## Layout & components

The page shell (nav, `.intro` header, content-divider star, footer, CSP, theme
scripts) is unchanged. The redesign is the `.writing-tool` section.

1. **Header** — `writing` (Newsreader `h1`) + a small IBM Plex Mono tag line;
   existing star `content-divider` retained.
2. **Writing box** (`.sentence-stream`) — hairline border + inset highlight
   (existing) + faint pixel grid. Kept sentences render full-ink; pending
   fragments stay faded (existing). Blackout/redaction mode retained.
3. **Accept/reject popover** — restyled to feel classy; **accept** fires the ✦
   sparkle and increments the "kept" counter; **reject** removes the fragment
   (existing behavior).
4. **HUD stats** (new) — a live line below the box:
   `words 008 · sentences 02 · kept 01`. Tabular IBM Plex Mono, accent numerals,
   muted labels. Ambient, not gamified.
5. **Controls row** — settings toggle + actions: `complete draft` · `copy` ·
   **`download`** (new). Boxy hairline buttons with the offset shadow.
6. **Settings panel** — keeps the two existing toggles (blackout,
   confirm-sentence). No new toggles; whimsy auto-disables under
   `prefers-reduced-motion`.
7. **Drafts (now persistent)** — saved drafts list. Each row: a mono `01`
   number + Newsreader draft text + per-draft **copy / download / delete**.
   Rendered newest-first using DOM nodes (`textContent` / `append` /
   `document.createElement`) — **never `innerHTML`**, per AGENTS.md.

## Behavior & data

- **Stats.** Recompute on every input / accept / reject / draft change. Words =
  whitespace-split non-empty tokens of the full current draft text; sentences =
  count of reviewed fragments + any in-progress sentence; kept = fragments
  flagged `keep`. Counters are zero-padded to 2 digits for the scoreboard look.
- **Persistence.** `localStorage` key **`lnzh.writing.drafts`** holding a JSON
  array of `{ id, text, createdAt }`.
  - Load + render on init; on "complete draft", push and persist; on per-draft
    delete, splice and persist.
  - `id`/`createdAt` are stamped at write time (`Date.now()` is fine in the
    browser).
  - All reads/writes wrapped in `try/catch`; if `localStorage` is unavailable
    (private mode, quota), the tool degrades to in-memory only and still works.
- **Export.**
  - `copy` — existing clipboard write (current draft) + per-draft copy.
  - `download` — build a `Blob([text], {type:'text/plain'})`, create an object
    URL, click a temporary `<a download="...">`, then revoke the URL. Filename
    like `draft-01.txt` / `writing-draft.txt`.
- **Block cursor caveat.** A `contenteditable` caret cannot be reshaped into a
  true block while editing mid-text. We therefore:
  - tint the live caret via `caret-color: var(--link)`, and
  - render a decorative blinking block (▮) **only in the empty/idle state** as a
    "ready" prompt. This is honest about the limitation and avoids fighting
    caret positioning. Documented so it isn't mistaken for a bug.

## Theming, motion, accessibility

- All new colors reference existing CSS variables → light/dark + accent picker
  work with no extra code. The pixel grid uses `--text-rgb` low-alpha so it
  inverts correctly per theme.
- Sparkle, cursor blink, and any fragment "twinkle" are covered by the existing
  `@media (prefers-reduced-motion: reduce)` block (which already neutralizes
  transitions/animations site-wide). Verify the new animations are caught.
- Keep existing `aria-live` regions (`.writing-tool`, toast, drafts) and
  `aria-label`s. New buttons get clear labels. HUD is supplementary, not the
  only signal.

## Files touched

- `writing/index.html` — restructured `.writing-tool` markup: header tag, HUD
  element, `download` button, per-draft action buttons. Shell unchanged.
- `assets/js/writing-tool.js` — add: stats computation, `localStorage` load/
  save, download/export (page + per-draft), sparkle trigger, idle block cursor,
  per-draft delete/copy. Refactor into small named functions; preserve current
  accept/reject/blackout/confirm logic. No `innerHTML` for draft data.
- `assets/css/style.css` — add IBM Plex Mono to the font `@import`; restyle the
  `.writing-*` rules (pixel grid, HUD, block cursor, boxy buttons, drafts list +
  actions) using CSS variables only.
- **No new image files.**

## Build / pipeline notes

- The writing page is hand-authored HTML; `build.py` only generates blog posts
  from `blog/_drafts/*.md` and does not touch this page.
- Theme scripts are already wired into `writing/index.html`; `inject_theme.py`
  is idempotent and need not run.
- No new dependencies; plain browser APIs only (AGENTS.md).

## Verification

- `for f in assets/js/*.js; do node --check "$f" || exit 1; done` — JS syntax.
- `python3 -m http.server 8000`, open `/writing/`, and exercise:
  - type → sentences become fragments; accept/reject works; sparkle fires.
  - HUD counts update live and zero-pad.
  - complete draft → appears in drafts; **reload → drafts persist**.
  - copy + download produce the right text; per-draft delete works.
  - toggle dark mode + each accent → cursor/sparkle/grid/HUD recolor correctly.
  - `prefers-reduced-motion` → animations quiet down.
- Confirm no asset 404s; confirm no `innerHTML` used for draft data.

## Work hygiene

- Branch `feat/writing-page-redesign` off `origin/main`; small focused commits.
- Do not commit to `main`; open a PR per repo rules.
