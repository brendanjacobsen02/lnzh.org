# CLAUDE.md — working in this repo

General conventions (structure, coding style, the JS syntax check, local serving)
live in [AGENTS.md](AGENTS.md). This file is specifically about how concurrent
Claude sessions stay out of each other's way and ship changes here.

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
python3 -m http.server 8000                                     # serve + eyeball / screenshot affected pages
```

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
