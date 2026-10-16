import {
  Account,
  Address,
  Contract,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk";
import {
  commitment,
  nullifierHash,
  MerkleTree,
  FIELD_MODULUS,
  assertInField,
  BN254_BASE_MODULUS,
} from "@zk-pay/shared";
const server = new rpc.Server("https://soroban-testnet.stellar.org");
type Deployment = {
  network: string;
  pool: string;
  reader: string;
  hashes: Record<string, string>;
};
let deployment: Deployment;
const wallets = new Map<string, Keypair>();
const proofs = new Map<
  string,
  { bytes: Uint8Array; root: bigint; nh: bigint; recipient: string }
>();
const pending = new Map<string, string>();
const uint = (n: bigint) => nativeToScVal(n, { type: "u256" });
const address = (s: string) => new Address(s).toScVal();
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
async function checkNetwork() {
  if ((await server.getNetwork()).passphrase !== Networks.TESTNET)
    throw new Error("Wrong network; testnet only");
}
export async function browserConfig() {
  const response = await fetch("/payment/deployment.json");
  if (!response.ok)
    throw new Error("Public payment artifacts have not been prepared");
  deployment = await response.json();
  if (
    deployment.network !== "testnet" ||
    !StrKey.isValidContract(deployment.pool)
  )
    throw new Error("Invalid testnet deployment");
  await checkNetwork();
  return {
    ready: true,
    pool: deployment.pool,
    denomination: "1 XLM",
    depositors: [
      {
        id: "browser",
        address: "New disposable testnet account, generated in this browser",
      },
    ],
  };
}
async function fundKey() {
  await checkNetwork();
  const key = Keypair.random();
  const response = await fetch(
    `https://friendbot.stellar.org/?addr=${encodeURIComponent(key.publicKey())}`,
    { signal: AbortSignal.timeout(45_000) },
  );
  if (!response.ok) throw new Error("Friendbot funding failed; try later");
  return key;
}
export async function createBrowserRecipient() {
  const key = await fundKey();
  wallets.set("recipient", key);
  return key.publicKey();
}
export function downloadRecipientBackup() {
  const key = wallets.get("recipient");
  if (!key) throw new Error("No browser recipient created");
  const blob = new Blob(
    [
      JSON.stringify(
        { network: "testnet", address: key.publicKey(), secret: key.secret() },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "testnet-recipient-key-KEEP-PRIVATE.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function read(method: string, ...args: xdr.ScVal[]) {
  const raw = new TransactionBuilder(new Account(deployment.reader, "0"), {
    fee: "100000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(new Contract(deployment.pool).call(method, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(raw);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result)
    throw new Error("Pool read failed");
  return scValToNative(sim.result.retval);
}
async function send(key: Keypair, operation: xdr.Operation, id: string) {
  await checkNetwork();
  let hash = pending.get(id);
  if (!hash) {
    const raw = new TransactionBuilder(
      await server.getAccount(key.publicKey()),
      { fee: "100000", networkPassphrase: Networks.TESTNET },
    )
      .addOperation(operation)
      .setTimeout(180)
      .build();
    const tx = await server.prepareTransaction(raw);
    if (BigInt(tx.fee) > 2000000000n)
      throw new Error("Testnet fee exceeds safety limit");
    tx.sign(key);
    hash = tx.hash().toString("hex");
    pending.set(id, hash);
    try {
      const sent = await server.sendTransaction(tx);
      if (!["PENDING", "DUPLICATE"].includes(sent.status))
        return { hash, status: sent.status };
    } catch {
      return { hash, status: "UNKNOWN: check confirmation before retrying" };
    }
  }
  for (let i = 0; i < 40; i++) {
    const result = await server.getTransaction(hash);
    if (result.status === "SUCCESS" || result.status === "FAILED")
      return { hash, status: result.status };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { hash, status: "PENDING" };
}
export async function browserTransaction(hash: string) {
  const result = await server.getTransaction(hash);
  return { hash, status: result.status };
}
export async function browserDeposit(encoded: string) {
  const value = BigInt(encoded);
  assertInField(value);
  let key = wallets.get("depositor");
  if (!key) {
    key = await fundKey();
    wallets.set("depositor", key);
  }
  return send(
    key,
    new Contract(deployment.pool).call(
      "deposit",
      address(key.publicKey()),
      uint(value),
    ),
    `deposit-${value}`,
  );
}
async function artifact(name: string) {
  const response = await fetch(`/payment/${name}`);
  if (!response.ok) throw new Error("Missing proving artifact");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 32 * 1024 * 1024) throw new Error("Artifact too large");
  const digest = hex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  );
  if (digest !== deployment.hashes[name])
    throw new Error("Artifact hash mismatch");
  return bytes;
}
export function serializeProof(p: {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}) {
  const values = [
    p.pi_a[0],
    p.pi_a[1],
    p.pi_b[0][1],
    p.pi_b[0][0],
    p.pi_b[1][1],
    p.pi_b[1][0],
    p.pi_c[0],
    p.pi_c[1],
  ];
  return Uint8Array.from(
    values.flatMap((v) => {
      const n = BigInt(v);
      if (n < 0 || n >= BN254_BASE_MODULUS)
        throw new Error("Invalid proof coordinate");
      return n
        .toString(16)
        .padStart(64, "0")
        .match(/../g)!
        .map((v) => parseInt(v, 16));
    }),
  );
}
export async function browserProve(note: string, recipient: string) {
  if (
    !/^[0-9a-f]{128}$/i.test(note) ||
    !StrKey.isValidEd25519PublicKey(recipient)
  )
    throw new Error("Invalid note or recipient");
  const n = {
    nullifier: BigInt("0x" + note.slice(0, 64)),
    secret: BigInt("0x" + note.slice(64)),
  };
  assertInField(n.nullifier);
  assertInField(n.secret);
  const tree = new MerkleTree(),
    leaf = commitment(n);
  let index = -1;
  const count = Number(await read("next_index"));
  if (count > 256 || count < 1) throw new Error("Invalid tree size");
  for (let i = 0; i < count; i++) {
    const value = BigInt(
      await read("commitment_at", nativeToScVal(i, { type: "u32" })),
    );
    tree.insert(value);
    if (value === leaf) index = i;
  }
  if (index < 0) throw new Error("Note has no deposit in this pool");
  const path = tree.proof(index),
    nh = nullifierHash(n.nullifier);
  if (await read("is_spent", uint(nh))) throw new Error("Note already spent");
  if (!(await read("is_known_root", uint(path.root))))
    throw new Error("Root no longer valid");
  const recipientField =
    BigInt("0x" + hex(StrKey.decodeEd25519PublicKey(recipient))) %
    FIELD_MODULUS;
  const expected = [path.root, nh, recipientField, 0n].map(String);
  const [wasm, zkey, vkey] = await Promise.all([
    artifact("withdraw.wasm"),
    artifact("withdraw.zkey"),
    artifact("verification_key.json"),
  ]);
  const { groth16 } = await import("snarkjs");
  const { proof, publicSignals } = await groth16.fullProve(
    {
      root: expected[0],
      nullifierHash: expected[1],
      recipient: expected[2],
      fee: "0",
      nullifier: String(n.nullifier),
      secret: String(n.secret),
      pathElements: path.pathElements.map(String),
      pathIndices: path.pathIndices,
    },
    wasm,
    zkey,
    undefined,
    undefined,
    { singleThread: true },
  );
  if (
    JSON.stringify(expected) !== JSON.stringify(publicSignals) ||
    !(await groth16.verify(
      JSON.parse(new TextDecoder().decode(vkey)),
      publicSignals,
      proof,
    ))
  )
    throw new Error("Local proof validation failed");
  const proofId = crypto.randomUUID();
  proofs.set(proofId, {
    bytes: serializeProof(proof),
    root: path.root,
    nh,
    recipient,
  });
  return { proofId };
}
export async function browserWithdraw(proofId: string) {
  const p = proofs.get(proofId);
  if (!p) throw new Error("Generate proof again");
  const relayer = wallets.get("recipient");
  if (!relayer || relayer.publicKey() !== p.recipient)
    throw new Error(
      "Recipient signing key is unavailable; keep this browser session open",
    );
  return send(
    relayer,
    new Contract(deployment.pool).call(
      "withdraw",
      nativeToScVal(p.bytes),
      uint(p.root),
      uint(p.nh),
      address(p.recipient),
      nativeToScVal(0n, { type: "i128" }),
      address(relayer.publicKey()),
    ),
    `withdraw-${p.nh}`,
  );
}
