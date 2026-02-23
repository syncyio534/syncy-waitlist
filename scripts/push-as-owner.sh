#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
MSG="${2:-chore: waitlist update}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository"
  exit 1
fi

# Set local repo identity to match Vercel-linked owner account.
git config user.name "syncyio534"
git config user.email "syncy.io.534@gmail.com"

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "$MSG"
fi

git push -u origin "$BRANCH"
