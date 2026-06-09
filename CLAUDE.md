# CLAUDE.md — working in this repo

General conventions (structure, coding style, the JS syntax check, local serving)
live in [AGENTS.md](AGENTS.md). This file is **how to work with me** — what I care
about — and how concurrent Claude sessions stay out of each other's way and ship here.

## How to work with me (read first)

**Default to action — just go.** Be as autonomous as possible: make the call, do the
work, merge it, tell me after. I'd rather react to real work than approve plans. Everything
below is context so your own calls land where I'd want them — fuel for judgment, not a
rulebook. The better you hold this, the fewer rules either of us needs.

**What this is.** lnzh.org is *my* personal site — my writing and ideas, first. Not a
portfolio, not for anyone's approval. A home.

**The taste is the whole point.** Every visual is hand-made and being hand-redrawn — the
nav, the 8-bit theme toggle, the bespoke iris transition. The feel is warm, imperfect,
idiosyncratic, a little playful, unmistakably human. The single failure state is *looks
like AI made it*: generic components, default type, safe spacing, stock polish. When you
touch anything visual, extend **this**, in my voice — never homogenize it.

**The live site is the source of truth — not this file.** When you're unsure how something
should look or behave, match what's already shipped and the hand-drawn assets; they're the
real spec. This doc is the *why*. If they ever disagree, the site wins.

**The bar, when I'm not watching:**

- **Unmistakably mine** — never generic.
- **Genuinely right** — the craft holds up; considered, not just working.
- **Creative calls that are *aligned*.** I *want* you making design decisions — the thing I
  can't stand is one that's misaligned with where I'd have gone. Alignment comes from
  knowing my taste (this doc + the living site), not from asking permission.
- **Lean** — does the thing and stops. No bloat, no unrequested features.
- **No babysitting** — ships clean; I don't tidy up after you.

**See the whole board.** Several branches/worktrees are usually live at once. Before
changing something, know what *else* is touching it; a nav or style edit can collide with
another branch's in-progress work. Factor the other work in. (Mechanics below.)

**One genuine exception to "just go":** if you can't tell *what* I'm asking — which task,
which direction — ask. For *how* to execute a clear ask, don't check in: just nail it.

**Hold onto decisions.** When we settle a preference or direction, keep it (here or in
memory) so I never have to say it twice.

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

### Working across branches

Several worktrees run at once. **Commit your own scoped work promptly, in small commits on
your own branch — don't wait to be asked;** uncommitted work is what another session
clobbers. Never commit a mixed tree or another session's files, never `git add -A` / `.`
blindly (stage what *you* authored), and before any commit confirm `git branch
--show-current` and that `git status` shows only your files. The per-page nav,
`assets/css/style.css`, and the theme JS are what branches collide on — check what else is
in flight and pick a merge order.

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
  in the DOM while being invisible. Verify the computed `background-image` resolves to a
  real URL (the `dev/` headless-Chrome probe pattern does exactly this).

> Why this matrix exists: we shipped it wrong once — an invisible nav star that 404'd on
> every page except depth-2 ones, in both themes. It was verified only on a deep page, so
> the homepage break went live. The tell-tale "works at depth 2, breaks elsewhere" is the
> signature of the gotcha below.

### Merge straight to main — no PR

Finished, verified work goes **directly to `main`** — no PR, no waiting for review. From
your worktree branch:

```bash
git push origin HEAD:main      # main auto-deploys to lnzh.org; no PR ceremony
# then, from the primary checkout, tidy up:
git worktree remove ../lnzh-<name> && git branch -D <branch>
```

If the push is rejected because `main` moved, rebase your branch on the new `origin/main`
and push again. Always **report what you merged** afterward — the commit + what changed.

The one judgment call left to you: **don't push half-finished work to the live site.** If
something genuinely isn't ready, leave it on its branch and tell me — that's about
readiness, not permission.

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
