#!/usr/bin/env bash
# Install the pinned toolchain for zk-pay-starter (macOS or Linux).
# Safe to re-run. Does not touch mainnet. Requires a network connection.
set -euo pipefail

OS="$(uname -s)"
ARCH="$(uname -m)"
BIN="${HOME}/.local/bin"
mkdir -p "$BIN"
case ":$PATH:" in
  *":$BIN:"*) ;;
  *) export PATH="$BIN:$PATH"
     echo "export PATH=\"$BIN:\$PATH\"" >> "${HOME}/.bashrc" 2>/dev/null || true
     echo "export PATH=\"$BIN:\$PATH\"" >> "${HOME}/.zshrc" 2>/dev/null || true
     ;;
esac

echo "zk-pay-starter tool install  os=$OS arch=$ARCH"
echo

if ! command -v bun >/dev/null 2>&1; then
  echo "→ bun"
  curl -fsSL https://bun.sh/install | bash
else
  echo "✓ bun $(bun --version)"
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "→ rustup"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck disable=SC1091
  source "${HOME}/.cargo/env"
fi
echo "→ rustc 1.92.0 + wasm32v1-none"
rustup toolchain install 1.92.0
rustup default 1.92.0
rustup target add wasm32v1-none

if ! command -v stellar >/dev/null 2>&1 || ! stellar --version 2>/dev/null | grep -q 28.1.0; then
  echo "→ stellar-cli 28.1.0"
  case "$OS-$ARCH" in
    Darwin-arm64)  ASSET="stellar-cli-28.1.0-aarch64-apple-darwin.tar.gz" ;;
    Darwin-x86_64) ASSET="stellar-cli-28.1.0-x86_64-apple-darwin.tar.gz" ;;
    Linux-aarch64) ASSET="stellar-cli-28.1.0-aarch64-unknown-linux-gnu.tar.gz" ;;
    Linux-x86_64)  ASSET="stellar-cli-28.1.0-x86_64-unknown-linux-gnu.tar.gz" ;;
    *) echo "unsupported platform $OS $ARCH"; exit 1 ;;
  esac
  TMP="$(mktemp -d)"
  curl -fsSL "https://github.com/stellar/stellar-cli/releases/download/v28.1.0/${ASSET}" -o "$TMP/stellar.tgz"
  tar -xzf "$TMP/stellar.tgz" -C "$TMP"
  install -m 0755 "$TMP/stellar" "$BIN/stellar"
  rm -rf "$TMP"
fi
echo "✓ $(stellar --version | head -1)"

if ! command -v nargo >/dev/null 2>&1 || ! nargo --version 2>/dev/null | grep -q '1.0.0-beta.9'; then
  echo "→ nargo 1.0.0-beta.9"
  curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
  export PATH="${HOME}/.nargo/bin:$PATH"
  noirup -v 1.0.0-beta.9
fi
echo "✓ $(nargo --version | head -1)"

if ! command -v bb >/dev/null 2>&1 || ! bb --version 2>/dev/null | grep -q 0.87.0; then
  echo "→ bb 0.87.0"
  curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/installation/install | bash
  export PATH="${HOME}/.bb:$PATH"
  bbup -v 0.87.0
fi
echo "✓ $(bb --version | head -1)"

if ! command -v circom >/dev/null 2>&1 || ! circom --version 2>/dev/null | grep -q 2.1.9; then
  echo "→ circom 2.1.9"
  case "$OS-$ARCH" in
    Darwin-arm64|Darwin-x86_64) CBIN="circom-macos-amd64" ;; # official macOS build
    Linux-x86_64)               CBIN="circom-linux-amd64" ;;
    *) echo "download circom 2.1.9 for $OS $ARCH from https://github.com/iden3/circom/releases"; exit 1 ;;
  esac
  curl -fsSL "https://github.com/iden3/circom/releases/download/v2.1.9/${CBIN}" -o "$BIN/circom"
  chmod +x "$BIN/circom"
fi
echo "✓ $(circom --version | head -1)"

echo
echo "Done. Open a new shell (so PATH updates) and run:"
echo "  bun run doctor"
echo "  bun install && bun run setup"
