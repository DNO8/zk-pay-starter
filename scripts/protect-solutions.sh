#!/usr/bin/env bash
# Install a local pre-push hook that refuses to publish `solutions`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/.git/hooks"
cp "$ROOT/scripts/hooks/pre-push" "$ROOT/.git/hooks/pre-push"
chmod +x "$ROOT/.git/hooks/pre-push"
echo "Installed .git/hooks/pre-push — git push of 'solutions' will be refused."
