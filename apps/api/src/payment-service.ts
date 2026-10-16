/** Trusted-local adapter. Never deploy this module as a public signing service. */
import {
  Address,
  Contract,
  Keypair,
  StrKey,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import {
  commitment,
  nullifierHash,
  MerkleTree,
  FIELD_MODULUS,
  assertInField,
} from "@zk-pay/shared";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createPaymentRpc } from "../../../scripts/payment-rpc";
import { proveWithdrawGroth16 } from "../../../scripts/prove-withdraw";
import { readEnvFile } from "../../../scripts/env";
const ROOT = new URL("../../../", import.meta.url).pathname;
const address = (s: string) => new Address(s).toScVal();
const uint = (n: bigint) => nativeToScVal(n, { type: "u256" });
const proofs = new Map<
  string,
  {
    proof: Uint8Array;
    root: bigint;
    nullifierHash: bigint;
    recipient: string;
    pool: string;
    created: number;
  }
>();
async function context() {
  const env = await readEnvFile(join(ROOT, ".env"));
  if ((env.STELLAR_NETWORK ?? "testnet") !== "testnet")
    throw new Error("Testnet only");
  const receipt = JSON.parse(
    await readFile(join(ROOT, "docs/evidence/private-payment.json"), "utf8"),
  );
  const privateState = JSON.parse(
    await readFile(
      join(ROOT, "artifacts/circom/withdraw/payment.secret"),
      "utf8",
    ),
  );
  if (
    receipt.network !== "testnet" ||
    !receipt.contracts?.pool ||
    !receipt.transactions?.some(
      (t: any) => t.label === "withdraw" && t.status === "SUCCESS",
    )
  )
    throw new Error("Complete the isolated testnet payment setup first");
  const keys = {
    alice: Keypair.fromSecret(privateState.keys.alice),
    charlie: Keypair.fromSecret(privateState.keys.charlie),
  };
  const signer = Keypair.fromSecret(privateState.keys.recipient);
  const rpc = await createPaymentRpc(
    join(ROOT, "artifacts/ui-payment-receipts.json"),
    signer,
  );
  return {
    receipt,
    keys,
    signer,
    rpc,
    pool: new Contract(receipt.contracts.pool),
  };
}
export async function paymentConfig() {
  const c = await context();
  return {
    ready: true,
    network: "testnet",
    pool: c.pool.contractId(),
    denomination: "1 XLM",
    recipient: c.receipt.wallets.recipient,
    depositors: Object.entries(c.keys).map(([id, k]) => ({
      id,
      address: k.publicKey(),
    })),
  };
}
async function receiptFor(
  c: Awaited<ReturnType<typeof context>>,
  label: string,
) {
  const entry = c.rpc.report.transactions.find((e: any) => e.label === label);
  if (!entry) throw new Error("No transaction receipt");
  return { hash: entry.hash, status: entry.status };
}
export async function deposit({
  commitment: encoded,
  depositor,
}: {
  commitment: string;
  depositor: string;
}) {
  const c = await context(),
    value = BigInt(encoded);
  assertInField(value);
  if (depositor !== "alice" && depositor !== "charlie")
    throw new Error("Unknown local account");
  const key = c.keys[depositor],
    label = `ui-deposit-${c.pool.contractId()}-${value}`;
  try {
    await c.rpc.tx(
      c.pool.call("deposit", address(key.publicKey()), uint(value)),
      label,
      key,
    );
  } catch (error) {
    if (!c.rpc.report.transactions.some((t: any) => t.label === label))
      throw error;
  }
  return receiptFor(c, label);
}
export async function prove({
  note,
  recipient,
}: {
  note: string;
  recipient: string;
}) {
  const c = await context();
  const parsed = {
    nullifier: BigInt("0x" + note.slice(0, 64)),
    secret: BigInt("0x" + note.slice(64)),
  };
  assertInField(parsed.nullifier);
  assertInField(parsed.secret);
  if (recipient !== c.signer.publicKey())
    throw new Error("Recipient must be the configured local recipient signer");
  const recipientField =
    BigInt(
      "0x" +
        Buffer.from(StrKey.decodeEd25519PublicKey(recipient)).toString("hex"),
    ) % FIELD_MODULUS;
  const leaf = commitment(parsed),
    tree = new MerkleTree();
  let index = -1;
  const count = Number(await c.rpc.read(c.pool.call("next_index")));
  if (count < 1 || count > 256) throw new Error("Invalid tree size");
  for (let i = 0; i < count; i++) {
    const value = BigInt(
      await c.rpc.read(
        c.pool.call("commitment_at", nativeToScVal(i, { type: "u32" })),
      ),
    );
    tree.insert(value);
    if (value === leaf) index = i;
  }
  if (index < 0) throw new Error("Note is not deposited in this pool");
  const merkleProof = tree.proof(index);
  if (!(await c.rpc.read(c.pool.call("is_known_root", uint(merkleProof.root)))))
    throw new Error("Merkle root is not known to pool");
  const nh = nullifierHash(parsed.nullifier);
  if (await c.rpc.read(c.pool.call("is_spent", uint(nh))))
    throw new Error("Note already spent");
  const result = await proveWithdrawGroth16({
    note: parsed,
    merkleProof,
    recipient: recipientField,
    fee: 0n,
  });
  const expected = await readFile(
    join(ROOT, "artifacts/circom/withdraw/vk-final.bin"),
  );
  if (!Buffer.from(result.vk).equals(expected))
    throw new Error("Wrong verifier key");
  for (const [id, p] of proofs)
    if (Date.now() - p.created > 30 * 60_000) proofs.delete(id);
  if (proofs.size >= 8)
    throw new Error("Too many pending proofs; restart local backend");
  const proofId = randomUUID();
  proofs.set(proofId, {
    proof: result.proof,
    root: merkleProof.root,
    nullifierHash: nh,
    recipient,
    pool: c.pool.contractId(),
    created: Date.now(),
  });
  return { proofId, root: merkleProof.root.toString(), status: "PROOF_READY" };
}
export async function withdraw({ proofId }: { proofId: string }) {
  const p = proofs.get(proofId);
  if (!p || Date.now() - p.created > 30 * 60_000)
    throw new Error("Proof missing or expired");
  const c = await context();
  if (p.pool !== c.pool.contractId()) throw new Error("Pool changed");
  const label = `ui-withdraw-${p.pool}-${p.nullifierHash}`;
  try {
    await c.rpc.tx(
      c.pool.call(
        "withdraw",
        nativeToScVal(Buffer.from(p.proof)),
        uint(p.root),
        uint(p.nullifierHash),
        address(p.recipient),
        nativeToScVal(0n, { type: "i128" }),
        address(c.signer.publicKey()),
      ),
      label,
    );
  } catch (error) {
    if (!c.rpc.report.transactions.some((t: any) => t.label === label))
      throw error;
  }
  const receipt = await receiptFor(c, label);
  if (receipt.status === "SUCCESS") proofs.delete(proofId);
  return receipt;
}
export async function transaction(hash: string) {
  const c = await context();
  const result = await c.rpc.server.getTransaction(hash);
  return { hash, status: result.status };
}
