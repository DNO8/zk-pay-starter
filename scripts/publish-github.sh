#!/usr/bin/env bash
# Create (or reuse) a PRIVATE GitHub repo and push ONLY `main`.
# Never pushes `solutions`. Run from a checkout of main.
#
#   gh auth login
#   ./scripts/publish-github.sh              # → <you>/zk-pay-starter (private)
#   ./scripts/publish-github.sh you/other    # custom name
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/"
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run:  gh auth login"
  exit 1
fi

BRANCH="$(git symbolic-ref --short HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "Refuse: you are on '$BRANCH'. Checkout main (the starter), not solutions."
  exit 1
fi

if git rev-parse --verify solutions >/dev/null 2>&1; then
  echo "Note: local branch 'solutions' exists and will NOT be pushed."
fi

ME="$(gh api user --jq .login)"
DEST="${1:-${ME}/zk-pay-starter}"
if [[ "$DEST" != */* ]]; then
  DEST="${ME}/${DEST}"
fi

echo "Publishing main → git@github.com:${DEST}.git  (private)"
if gh repo view "$DEST" >/dev/null 2>&1; then
  echo "Repo already exists: https://github.com/${DEST}"
else
  gh repo create "$DEST" --private --description "Tutorial starter: land a hello ZK proof on Stellar testnet, then build a private payment." --disable-wiki --disable-issues=false
fi

if git remote get-url github >/dev/null 2>&1; then
  git remote set-url github "git@github.com:${DEST}.git"
else
  git remote add github "git@github.com:${DEST}.git"
fi

# Belt and braces: refuse to push solutions even if someone types it later.
git config --local "remote.github.push" "refs/heads/main:refs/heads/main"
if git rev-parse --verify solutions >/dev/null 2>&1; then
  git config --local "branch.solutions.remote" ""
  git config --local --unset-all "branch.solutions.merge" 2>/dev/null || true
fi

git push -u github main

echo
echo "✅ https://github.com/${DEST}  (private, main only)"
echo
echo "Invite hackers (they cannot fork a private repo they cannot see):"
echo "  gh api -X PUT repos/${DEST}/collaborators/THEIR_LOGIN -f permission=push"
echo
echo "Hacker path: fork → clone THEIR fork → ./scripts/install-tools.sh → bun run setup → bun run verify:hello --path noir --network testnet"
echo
echo "Keep solutions on this laptop only. Never: git push github solutions"
