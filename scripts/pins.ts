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
    "curl -L https://github.com/stellar/stellar-cli/releases/download/v28.1.0/stellar-cli-28.1.0-x86_64-unknown-linux-gnu.tar.gz | tar -xz && mv stellar ~/.local/bin/",
  nargo:
    "curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash && noirup -v 1.0.0-beta.9",
  bb: "curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/installation/install | bash && bbup -v 0.87.0",
  circom:
    "curl -L -o ~/.local/bin/circom https://github.com/iden3/circom/releases/download/v2.1.9/circom-linux-amd64 && chmod +x ~/.local/bin/circom",
  bun: "curl -fsSL https://bun.sh/install | bash",
};
