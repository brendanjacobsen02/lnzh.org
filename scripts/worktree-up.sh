#!/usr/bin/env bash
# worktree-up.sh <branch>
#
# Create (or reuse) an isolated git worktree off origin/main for <branch>, so this
# agent session never shares a working tree with another running session. Prints the
# worktree path on stdout — cd there and work.
#
#   dir=$(scripts/worktree-up.sh feat/my-thing) && cd "$dir"
set -euo pipefail

branch="${1:?usage: worktree-up.sh <branch>}"

# The primary checkout is the first entry in `git worktree list`.
main_wt="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
parent="$(dirname "$main_wt")"
dir="$parent/lnzh-${branch##*/}"        # feat/foo -> ../lnzh-foo (matches existing naming)

git -C "$main_wt" fetch origin --quiet

# Already checked out in some worktree? Reuse it instead of erroring.
existing="$(git -C "$main_wt" worktree list --porcelain | awk -v b="refs/heads/$branch" '
  /^worktree /{w=$2} /^branch /{ if ($2 == b) print w }')"
if [ -n "$existing" ]; then echo "$existing"; exit 0; fi

if git -C "$main_wt" show-ref --verify --quiet "refs/heads/$branch"; then
  git -C "$main_wt" worktree add "$dir" "$branch" >/dev/null      # existing branch
else
  git -C "$main_wt" worktree add -b "$branch" "$dir" origin/main >/dev/null  # new branch off origin/main
fi
echo "$dir"
