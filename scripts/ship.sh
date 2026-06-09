#!/usr/bin/env bash
# ship.sh
#
# Run from INSIDE a feature worktree. One command to land a SMALL, self-contained
# change: push the branch, open a PR, squash-merge it to main, delete the branch, and
# remove this worktree. main auto-deploys to lnzh.org, so this ships live.
#
# Use only for small changes the user asked for, where no other active session is
# editing the same files. For large / in-progress branches, open a PR and let the
# user review instead — see CLAUDE.md.
#
# Aborts (leaving your worktree intact) if the merge can't go through cleanly, e.g.
# main moved and now conflicts — resolve, then re-run.
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" = "main" ]; then
  echo "ship: refusing — you're on main, not a feature branch." >&2
  exit 1
fi
wt="$(git rev-parse --show-toplevel)"
main_wt="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"

echo "ship: pushing ${branch}..."
git push -u origin "$branch"

echo "ship: opening PR..."
gh pr create --base main --head "$branch" --fill >/dev/null 2>&1 \
  || echo "ship: a PR already exists for ${branch}; reusing it."

echo "ship: squash-merging to main..."
# Merge purely via the API (run from /tmp with GH_REPO) so gh never tries to switch
# THIS clone's checkout over to main -- that fails when main is checked out in another
# worktree. The subshell's non-zero exit still trips set -e if the PR isn't mergeable.
repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
( cd /tmp && GH_REPO="$repo" gh pr merge "$branch" --squash --delete-branch )

# Success: the change is live. Tidy up this worktree from the primary checkout.
cd "$main_wt"
git worktree remove --force "$wt" 2>/dev/null || true
git branch -D "$branch" 2>/dev/null || true
git fetch origin --prune --quiet || true
echo "ship: done: '${branch}' merged to main (deploying). Worktree removed; cwd is now ${main_wt}."
