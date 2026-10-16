// GIVEN-only testnet fallback. Uses existing hello artifacts; never sends mainnet transactions.
import {
  rpc,
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Address,
  Contract,
  Asset,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import { readEnvFile, writeEnv } from "./env";
import { fund } from "./keys";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { $ } from "bun";
import { assertNotMainnet } from "./network";
const ROOT = join(import.meta.dir, "..");
const require = createRequire(import.meta.url);
// Use the SDK's bundled fetch transport when native CLI/Axios proxy handling fails.
const { create: createFetchClient } = require(
  join(
    dirname(require.resolve("@stellar/stellar-sdk")),
    "http-client/fetch-client.js",
  ),
);
async function main() {
  process.chdir(ROOT);
  assertNotMainnet(process.env.STELLAR_NETWORK ?? "testnet", "setup:sdk");
  await $`bun run doctor`;
  await $`bun run build`;
  for (const path of ["noir", "circom"]) {
    const required =
      path === "noir"
        ? ["vk", "proof", "public_inputs"]
        : ["vk.bin", "proof.bin", "public.bin"];
    if (
      required.some(
        (name) => !existsSync(join(ROOT, "artifacts", path, "hello", name)),
      )
    )
      await $`bun run prove:hello --path ${path}`;
  }
  const server = new rpc.Server("https://soroban-testnet.stellar.org", {
    timeout: 30000,
  });
  (server as any).httpClient = createFetchClient();
  if ((await server.getNetwork()).passphrase !== Networks.TESTNET)
    throw Error("Wrong network");
  console.log("SDK connected to verified Stellar testnet");
  const env = await readEnvFile();
  if (env.STELLAR_NETWORK && env.STELLAR_NETWORK !== "testnet")
    throw Error("SDK setup requires testnet");
  if (
    env.STELLAR_RPC_URL &&
    env.STELLAR_RPC_URL !== "https://soroban-testnet.stellar.org"
  )
    throw Error("SDK setup uses the official Stellar testnet RPC only");
  if (
    env.STELLAR_NETWORK_PASSPHRASE &&
    env.STELLAR_NETWORK_PASSPHRASE !== Networks.TESTNET
  )
    throw Error("Wrong configured network passphrase");
  for (const name of ["DEPLOYER", "ALICE", "BOB", "FRESH_1", "FRESH_2"]) {
    const key = env[name + "_SECRET"]
      ? Keypair.fromSecret(env[name + "_SECRET"])
      : Keypair.random();
    env[name + "_SECRET"] = key.secret();
    env[name + "_ADDRESS"] = key.publicKey();
  }
  env.STELLAR_NETWORK = "testnet";
  env.STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
  env.STELLAR_NETWORK_PASSPHRASE = Networks.TESTNET;
  await writeEnv(env); // Persist before any network work, never log secrets.
  await chmod(join(ROOT, ".env"), 0o600);
  for (const name of ["DEPLOYER", "ALICE", "BOB", "FRESH_1", "FRESH_2"])
    await fund(env[name + "_ADDRESS"]);
  const key = Keypair.fromSecret(env.DEPLOYER_SECRET),
    addr = (s: string) => new Address(s).toScVal(),
    bytes = async (p: string) => nativeToScVal(await readFile(ROOT + "/" + p));
  const reportPath = join(ROOT, "docs/evidence/hello-testnet.json");
  await mkdir(dirname(reportPath), { recursive: true });
  const artifactPaths = [
    ...["verifier_ultrahonk", "verifier_groth16", "hello_gate", "pool"].map(
      (name) => `target/wasm32v1-none/release/${name}.wasm`,
    ),
    ...["vk", "proof", "public_inputs"].map(
      (name) => `artifacts/noir/hello/${name}`,
    ),
    ...["vk.bin", "proof.bin", "public.bin"].map(
      (name) => `artifacts/circom/hello/${name}`,
    ),
  ];
  const artifactSha256: Record<string, string> = {};
  for (const path of artifactPaths)
    artifactSha256[path] = createHash("sha256")
      .update(await readFile(join(ROOT, path)))
      .digest("hex");
  let report: any = {
    network: "testnet",
    artifactSha256,
    deployer: key.publicKey(),
    transactions: [],
    contracts: {},
  };
  if (existsSync(reportPath)) {
    const previous = JSON.parse(await readFile(reportPath, "utf8"));
    if (previous.deployer === key.publicKey()) {
      if (
        JSON.stringify(previous.artifactSha256) !==
        JSON.stringify(artifactSha256)
      )
        throw Error(
          "Artifacts differ from the saved deployment evidence. Refusing to reuse contracts or transactions.",
        );
      report = previous;
    }
  }
  async function tx(op: any, label: string, requireTrue = false) {
    let entry = report.transactions.find((x: any) => x.label === label);
    if (!entry) {
      console.log("Submitting", label);
      const account = await server.getAccount(key.publicKey());
      const raw = new TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(op)
        .setTimeout(180)
        .build();
      const sim = await server.simulateTransaction(raw);
      if (!rpc.Api.isSimulationSuccess(sim))
        throw Error("Simulation " + label + ": " + JSON.stringify(sim));
      const ready = rpc.assembleTransaction(raw, sim).build();
      ready.sign(key);
      const hash = ready.hash().toString("hex");
      entry = {
        label,
        hash,
        url: "https://stellar.expert/explorer/testnet/tx/" + hash,
        status: "SUBMITTING",
      };
      report.transactions.push(entry);
      // Persist the public hash before submission so even an uncertain network response cannot cause a duplicate send.
      await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
      const sent = await server.sendTransaction(ready);
      if (!["PENDING", "DUPLICATE"].includes(sent.status))
        throw Error("Send " + label + ": " + JSON.stringify(sent));
      entry.status = "PENDING";
      await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    }
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      const result = await server.getTransaction(entry.hash);
      if (result.status === "SUCCESS") {
        if (
          requireTrue &&
          (!result.returnValue || scValToNative(result.returnValue) !== true)
        )
          throw Error(
            "Confirmed transaction returned false instead of verified true: " +
              label +
              " " +
              entry.hash,
          );
        entry.status = "SUCCESS";
        if (requireTrue) entry.returnValueVerified = true;
        await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
        console.log(
          "Confirmed",
          label,
          entry.hash,
          requireTrue ? "return=true" : "",
        );
        return result;
      }
      if (result.status === "FAILED") {
        entry.status = "FAILED";
        await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
        throw Error("Transaction failed " + label + " " + entry.hash);
      }
      if (entry.status === "SUCCESS")
        throw Error(
          "Previously confirmed transaction is no longer available from RPC history; refusing to resubmit: " +
            entry.hash,
        );
      await Bun.sleep(1500);
    }
    throw Error(
      "Still pending or unavailable after 240 seconds: " +
        label +
        " " +
        entry.hash +
        ". Saved hash retained; rerun to check it without submitting again.",
    );
  }
  async function deploy(name: string, crate: string, args: any[] = []) {
    if (report.contracts[name]) return report.contracts[name];
    const wasm = await readFile(
      `${ROOT}/target/wasm32v1-none/release/${crate}.wasm`,
    );
    const upload = await tx(
      Operation.uploadContractWasm({ wasm }),
      "upload " + name,
    );
    const d = await tx(
      Operation.createCustomContract({
        address: new Address(key.publicKey()),
        wasmHash: scValToNative(upload.returnValue!),
        constructorArgs: args,
      }),
      "deploy " + name,
    );
    const id = scValToNative(d.returnValue!);
    report.contracts[name] = id;
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    return id;
  }
  const uh = await deploy("verifier-ultrahonk", "verifier_ultrahonk", [
    await bytes("artifacts/noir/hello/vk"),
  ]);
  const g16 = await deploy("verifier-groth16", "verifier_groth16");
  await tx(
    new Contract(g16).call(
      "set_vk",
      await bytes("artifacts/circom/hello/vk.bin"),
    ),
    "set Groth16 VK",
  );
  const gate = await deploy("hello-gate", "hello_gate", [addr(uh), addr(g16)]);
  const token = Asset.native().contractId(Networks.TESTNET);
  const pool = await deploy("pool", "pool", [
    addr(key.publicKey()),
    addr(token),
    nativeToScVal(100000000n, { type: "i128" }),
    addr(uh),
  ]);
  const values = {
    VERIFIER_ULTRAHONK_ID: uh,
    VERIFIER_GROTH16_ID: g16,
    HELLO_UH_VERIFIER_ID: uh,
    HELLO_G16_VERIFIER_ID: g16,
    HELLO_GATE_ID: gate,
    POOL_ID: pool,
    NATIVE_TOKEN_ID: token,
    VITE_SOROBAN_RPC_URL: env.STELLAR_RPC_URL,
    VITE_NETWORK_PASSPHRASE: Networks.TESTNET,
    VITE_HELLO_GATE_ID: gate,
    VITE_POOL_ID: pool,
    VITE_VERIFIER_UH_ID: uh,
    VITE_VERIFIER_G16_ID: g16,
  };
  await writeEnv(values);
  await chmod(join(ROOT, ".env"), 0o600);
  await writeFile(
    ROOT + "/deployment.json",
    JSON.stringify(
      {
        network: "testnet",
        rpcUrl: env.STELLAR_RPC_URL,
        networkPassphrase: Networks.TESTNET,
        contracts: { ...report.contracts, nativeToken: token },
        wallets: Object.fromEntries(
          ["DEPLOYER", "ALICE", "BOB", "FRESH_1", "FRESH_2"].map((n) => [
            n.toLowerCase().replaceAll("_", "-"),
            env[n + "_ADDRESS"],
          ]),
        ),
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await tx(
    new Contract(uh).call(
      "verify_proof",
      await bytes("artifacts/noir/hello/public_inputs"),
      await bytes("artifacts/noir/hello/proof"),
    ),
    "hello Noir verify",
  );
  await tx(
    new Contract(g16).call(
      "verify",
      await bytes("artifacts/circom/hello/proof.bin"),
      await bytes("artifacts/circom/hello/public.bin"),
    ),
    "hello Groth16 verify",
    true,
  );
  await tx(
    new Contract(gate).call(
      "verify_hello_uh",
      await bytes("artifacts/noir/hello/public_inputs"),
      await bytes("artifacts/noir/hello/proof"),
    ),
    "hello gate Noir flag",
    true,
  );
  for (const [name, crate] of [
    ["verifier-ultrahonk", "verifier_ultrahonk"],
    ["verifier-groth16", "verifier_groth16"],
    ["hello-gate", "hello_gate"],
    ["pool", "pool"],
  ]) {
    await $`stellar contract bindings typescript --wasm ${join(ROOT, "target/wasm32v1-none/release", crate + ".wasm")} --output-dir ${join(ROOT, "bindings", name)} --overwrite`;
  }
  await $`bun run test:given`;
  report.completedAt = new Date().toISOString();
  report.scope =
    "GIVEN hello proofs only. No private withdrawal or GAP completion.";
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "M0 contracts + M1 hello verification complete; no GAP withdrawal performed.",
  );
}
try {
  await main();
} catch (error) {
  console.error(String(error).replace(/S[A-Z2-7]{55}/g, "[REDACTED_SECRET]"));
  process.exitCode = 1;
}
