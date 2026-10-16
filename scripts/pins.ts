/** Version pins. PRD listed several as [VERIFY]; these are the versions this repo was built against. */
export const PINS = {
  rust: "1.92.0",
  stellarCli: "28.1.0",
  sorobanSdk: "28.0.0",
  nargo: "1.0.0-beta.9",
  bb: "0.87.0",
  circom: "2.1.9",
  snarkjs: "0.7.5",
  bunMajor: 1,
  protocolMin: 28,
} as const;

export const TOOL_INSTALL = {
  rust: "rustup toolchain install 1.92.0 && rustup default 1.92.0 && rustup target add wasm32v1-none",
  stellar:
    "See ./scripts/install-tools.sh (picks macOS/Linux + arch). Or: https://github.com/stellar/stellar-cli/releases/tag/v28.1.0",
  nargo:
    "curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash && noirup -v 1.0.0-beta.9",
  bb: "curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/installation/install | bash && bbup -v 0.87.0",
  circom: "See ./scripts/install-tools.sh (circom 2.1.9 binary for macOS/Linux).",
  bun: "curl -fsSL https://bun.sh/install | bash",
};
