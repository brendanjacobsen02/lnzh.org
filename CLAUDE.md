# CLAUDE.md — working in this repo

General conventions (structure, coding style, the JS syntax check, local serving)
live in [AGENTS.md](AGENTS.md). This file is specifically about how concurrent
Claude sessions stay out of each other's way and ship changes here.

## Reach for the right tool

There's no build step and no framework — but skills and MCP servers are installed.
Use them instead of hand-rolling:

| Task | Reach for |
| --- | --- |
| Plan a feature, redesign, or anything non-trivial | `superpowers:brainstorming` first, then `superpowers:writing-plans` |
| Build or restyle UI / a page | `frontend-design` skill; round-trip to design with the `figma` MCP |
| Verify a change in a real browser | `playwright` + `chrome-devtools` MCPs — see [Shipping](#shipping) below |
| Hand-drawn / photo / video assets | `adobe-for-creativity` skills |

MCP servers (`playwright`, `chrome-devtools`, `figma`) are configured at **user
scope**, so they're available in every session — but their tools load at session
**start**. If you just added one, it's live in the *next* session, not the current one.

## Isolation: one worktree per session

`main` auto-deploys to **lnzh.org**, and several agents may run at once against the
same clone. A `git checkout` in any session moves **every** session's working tree,
and uncommitted edits bleed across branches. So:

- **Never edit the shared/primary checkout** (`/Users/lz/Documents/lnzh`). Give each
  session its own worktree:

  ```bash
  dir=$(scripts/worktree-up.sh feat/my-thing) && cd "$dir"
  ```

  Worktrees are created off **`origin/main`** (local `main` goes stale — always
  fetch first; `worktree-up.sh` does). They live as siblings: `../lnzh-<name>`.
- Never run a tree-moving git op (`checkout` / `switch` / `reset` / `stash` /
  `clean` / `rebase`) in a tree that holds changes you didn't author. Stop and ask.

## Shipping

**Verify before shipping** (no test suite — these are the checks):

```bash
for f in assets/js/*.js; do node --check "$f" || exit 1; done   # JS syntax
python3 -m http.server 8000                                     # serve, then check affected pages
```

For anything touching the **nav, a shared component, or an asset reference**, eyeballing
one page is NOT enough — verify the **page-depth × theme matrix**, because the nav is
copied into every page and each page sits at a different path depth:

- **Depth:** check the homepage (`/`, depth 0) **and** a deep page (e.g. `/blog/tomato/`,
  depth 2). A path that resolves at one depth can 404 at another.
- **Theme:** check **light and dark** (assets swap by theme).
- **Confirm the asset actually loads (HTTP 200)** — not just that the element exists. A
  `background-image` / `--*-src` 404 paints nothing and logs no error, so it looks fine
  in the DOM while being invisible. `playwright`'s `browser_network_requests` lists every
  request with its status — a 404'd `--*-src` shows up there even when the DOM looks fine.

> Why this matrix exists: we shipped it wrong once — an invisible nav star that 404'd on
> every page except depth-2 ones, in both themes. It was verified only on a deep page, so
> the homepage break went live. The tell-tale "works at depth 2, breaks elsewhere" is the
> signature of the gotcha below.

**Run the matrix with the browser MCPs** (preferred over hand-rolled `dev/` probes — no
script to author each time). With the site served (`./serve`), in a session where the MCP
tools are loaded:

- **`playwright`** — `browser_navigate` to each depth (`/`, `/blog/<post>/`), then for
  **each theme**: flip it with `browser_localstorage_set` on the theme key (or
  `browser_evaluate` to invoke the page's toggle) and reload. Per page: `browser_take_screenshot`
  (inspect at full resolution — never grade a downscaled thumbnail) and read
  `browser_network_requests` to confirm every asset is 200. Launch with a Retina
  `--device`/`--viewport-size` so captures aren't soft.
- **`chrome-devtools`** — run `lighthouse_audit` on changed pages for an accessibility /
  best-practices / SEO pass, and `performance_start_trace` (LCP/CLS/FCP) if you touched
  anything render-affecting. `list_network_requests` is a second 404 check.

The `dev/*.html` + `*.mjs` harnesses still work for quick local loops; the MCPs are the
rigorous path.

### Small, self-contained change → ship it without asking

If the change is one concern, the user asked for it, and **no other active session
is editing those files**, land it in one command — no approval needed:

```bash
scripts/ship.sh        # push → open PR → squash-merge → delete branch → remove worktree
```

A PR still lands in history (audit trail + one-click rollback); there are just no
manual steps. `ship.sh` aborts and keeps your worktree if the merge can't apply
cleanly (e.g. `main` moved and now conflicts) — resolve and re-run.

Always **report what you shipped** afterward (the PR link + what changed), even
though it merged automatically.

### Large / in-progress branch → open a PR and let the user review

Do **not** auto-merge when the branch is a big or unfinished feature, or touches
files another session is actively editing. Open the PR and present it for review
before it goes live. The writing-page redesign is the canonical example: merging it
wholesale would deploy half-finished work, and its nav can conflict with the
hand-drawn redesign already on `main`.

When unsure whether a change counts as "small," lean toward presenting it.

## Gotchas that have bitten us — don't repeat

- **`--*-src` custom properties must hold ABSOLUTE URLs.** A relative `url()` inside a CSS
  custom property (`--star-src`, `--frame-src`, `--slot-src`, …) resolves against the
  **stylesheet** that consumes it (`/assets/css/`), **not** the page — so a page-relative
  value becomes `/assets/css/assets/...` and 404s on every depth but the stylesheet's. When
  setting one in JS, resolve first: `new URL(src, document.baseURI).href`. (This is what
  made the nav star invisible; fixed in #28.)
- **Themed non-`<img>` elements need an explicit dark swap.** `theme-toggle.js`'s
  `swapImages()` only walks `<img>`. An asset painted via a `--*-src` property on a
  `<span>`/`<div>` keeps its light asset in dark mode (→ invisible on a dark background)
  unless you add it to `swapImages()`. Whenever you convert an `<img>` into a non-`<img>`,
  re-check the dark swap.
