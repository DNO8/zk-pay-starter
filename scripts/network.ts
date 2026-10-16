export const TESTNET_RPC = "https://soroban-testnet.stellar.org";
export const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const FRIENDBOT = "https://friendbot.stellar.org";

const MAINNET_MARKERS = [
  "mainnet",
  "pubnet",
  "public global stellar network",
  "public global",
];

/** Hard-coded mainnet refusal. Never deploy, fund, or verify on pubnet. */
export function assertNotMainnet(network: string | undefined | null, extra = ""): string {
  const n = (network ?? "testnet").trim();
  const lower = n.toLowerCase();
  if (MAINNET_MARKERS.some((m) => lower.includes(m))) {
    throw new Error(
      `Refusing mainnet${extra ? " (" + extra + ")" : ""}. zk-pay-starter is testnet and local only.`,
    );
  }
  if (lower !== "testnet" && lower !== "local" && lower !== "localnet" && lower !== "standalone") {
    throw new Error(
      `Unknown network "${n}". Allowed: testnet, local. Mainnet is refused.`,
    );
  }
  return lower === "standalone" ? "local" : lower;
}

export function parseNetworkFlag(argv = process.argv): string {
  const idx = argv.findIndex((a) => a === "--network" || a === "-n");
  if (idx >= 0 && argv[idx + 1]) return assertNotMainnet(argv[idx + 1]);
  const eq = argv.find((a) => a.startsWith("--network="));
  if (eq) return assertNotMainnet(eq.split("=")[1]);
  return assertNotMainnet(process.env.STELLAR_NETWORK ?? process.env.NETWORK ?? "testnet");
}
