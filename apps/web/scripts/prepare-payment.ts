/** Publish only public proving artifacts and verified deployment metadata. Never copy witnesses or notes. */
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { encodeGroth16Vk } from "@zk-pay/shared";
const root = new URL("../../../", import.meta.url).pathname;
const target = new URL("../public/payment/", import.meta.url).pathname;
const receipt = JSON.parse(
  await readFile(root + "docs/evidence/private-payment.json", "utf8"),
);
if (
  receipt.network !== "testnet" ||
  receipt.provingPath !== "circom-groth16" ||
  !receipt.completedAt
)
  throw new Error("A completed Groth16 testnet receipt is required");
const vk = await readFile(root + "artifacts/circom/withdraw/vk-final.bin");
const verificationKey = JSON.parse(await readFile(root + "artifacts/circom/withdraw/verification_key_final.json", "utf8"));
if(!Buffer.from(encodeGroth16Vk(verificationKey)).equals(vk)) throw new Error("Published verification key differs from pinned binary VK");
const vkHash = createHash("sha256").update(vk).digest("hex");
if(vkHash !== receipt.artifactSha256?.vk) throw new Error("Frozen VK does not match the confirmed deployment receipt");
await mkdir(target, { recursive: true });
const files = {
  "withdraw.wasm": "artifacts/circom/withdraw/withdraw_js/withdraw.wasm",
  "withdraw.zkey": "artifacts/circom/withdraw/withdraw-final.zkey",
  "verification_key.json":
    "artifacts/circom/withdraw/verification_key_final.json",
};
const hashes: Record<string, string> = {};
for (const [name, path] of Object.entries(files)) {
  const bytes = await readFile(root + path);
  hashes[name] = createHash("sha256").update(bytes).digest("hex");
  await copyFile(root + path, target + name);
}
await writeFile(
  target + "deployment.json",
  JSON.stringify(
    {
      network: "testnet",
      pool: receipt.contracts.pool,
      reader: receipt.wallets.alice,
      verifier: receipt.contracts.withdrawVerifier,
      hashes,
    },
    null,
    2,
  ),
);
console.log(
  "Prepared public Groth16 artifacts only; no notes, witnesses, or keys.",
);
