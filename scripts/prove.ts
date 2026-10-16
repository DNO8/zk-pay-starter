#!/usr/bin/env bun
/**
 * bun run prove:hello --path noir|circom
 * bun run prove:withdraw --path noir|circom
 */
import { $ } from "bun";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { encodeG16PublicSignals, encodeGroth16Proof, splitUhProof, toHex } from "@zk-pay/shared";
import { assertNotMainnet } from "./network";

assertNotMainnet(process.env.STELLAR_NETWORK ?? "testnet", "prove");

const ROOT = join(import.meta.dir, "..");
const circuit = process.argv[2] ?? "hello";
const pathIdx = process.argv.findIndex((a) => a === "--path");
const provingPath = (pathIdx >= 0 ? process.argv[pathIdx + 1] : process.env.PROVING_PATH) ?? "noir";

if (circuit !== "hello" && circuit !== "withdraw") {
  console.error("usage: bun run prove:<hello|withdraw> --path noir|circom");
  process.exit(1);
}
if (provingPath !== "noir" && provingPath !== "circom") {
  console.error("--path must be noir or circom");
  process.exit(1);
}

const artifacts = join(ROOT, "artifacts", provingPath, circuit);
mkdirSync(artifacts, { recursive: true });

if (provingPath === "noir") {
  const dir = join(ROOT, "circuits/noir", circuit);
  await $`nargo compile`.cwd(dir);
  await $`nargo execute`.cwd(dir);
  const json = join(dir, "target", `${circuit}.json`);
  const gz = join(dir, "target", `${circuit}.gz`);
  await $`bb prove --scheme ultra_honk --oracle_hash keccak --bytecode_path ${json} --witness_path ${gz} --output_path ${dir}/target --output_format bytes_and_fields`;
  await $`bb write_vk --scheme ultra_honk --oracle_hash keccak --bytecode_path ${json} --output_path ${dir}/target --output_format bytes_and_fields`;

  // bb 0.87 may write target/vk/vk or target/vk
  let vkPath = join(dir, "target/vk");
  if (existsSync(join(dir, "target/vk/vk"))) vkPath = join(dir, "target/vk/vk");
  let proofPath = join(dir, "target/proof");
  if (existsSync(join(dir, "target/proof/proof"))) proofPath = join(dir, "target/proof/proof");

  const pubCount = circuit === "hello" ? 1 : 4;
  if (existsSync(join(dir, "target/proof_with_public_inputs"))) {
    const bundle = new Uint8Array(await Bun.file(join(dir, "target/proof_with_public_inputs")).arrayBuffer());
    const split = splitUhProof(bundle, pubCount);
    await Bun.write(join(artifacts, "public_inputs"), split.publicInputs);
    await Bun.write(join(artifacts, "proof"), split.proof);
  } else if (existsSync(join(dir, "target/public_inputs")) && existsSync(proofPath)) {
    await $`cp ${join(dir, "target/public_inputs")} ${join(artifacts, "public_inputs")}`;
    await $`cp ${proofPath} ${join(artifacts, "proof")}`;
  } else {
    // Some bb builds write proof as the bundle. Split it.
    const bundle = new Uint8Array(await Bun.file(proofPath).arrayBuffer());
    const split = splitUhProof(bundle, pubCount);
    if (split.proof.length > 0 && existsSync(join(dir, "target/public_inputs")) === false) {
      await Bun.write(join(artifacts, "public_inputs"), split.publicInputs);
      await Bun.write(join(artifacts, "proof"), split.proof);
    } else {
      await $`cp ${proofPath} ${join(artifacts, "proof")}`;
      if (existsSync(join(dir, "target/public_inputs"))) {
        await $`cp ${join(dir, "target/public_inputs")} ${join(artifacts, "public_inputs")}`;
      }
    }
  }
  await $`cp ${vkPath} ${join(artifacts, "vk")}`;
  console.log(`✅ Noir ${circuit} proof written to ${artifacts}`);
  process.exit(0);
}

// Circom / Groth16
const dir = join(ROOT, "circuits/circom", circuit);
const ptauDir = join(ROOT, "circuits/circom/ptau");
mkdirSync(ptauDir, { recursive: true });
const ptau = join(ptauDir, "pot12_final.ptau");
if (!existsSync(ptau)) {
  console.log("Generating a toy Powers of Tau (insecure, learning only)...");
  await $`bunx snarkjs@0.7.5 powersoftau new bn128 12 ${join(ptauDir, "pot12_0000.ptau")} -v`;
  await $`bunx snarkjs@0.7.5 powersoftau contribute ${join(ptauDir, "pot12_0000.ptau")} ${join(ptauDir, "pot12_0001.ptau")} --name="zk-pay-starter" -e="zk-pay-starter-dev-entropy-not-secure"`;
  await $`bunx snarkjs@0.7.5 powersoftau prepare phase2 ${join(ptauDir, "pot12_0001.ptau")} ${ptau}`;
}

const circomFile = circuit === "hello" ? "hello.circom" : "withdraw.circom";
await $`circom ${circomFile} --r1cs --wasm --sym -o ${dir}`.cwd(dir);
const r1cs = join(dir, `${circuit}.r1cs`);
const wasm = join(dir, `${circuit}_js`, `${circuit}.wasm`);
// Withdrawal uses a stable, randomly contributed development setup.
// Never regenerate a deployed circuit's verification key while producing a proof.
if (circuit === "withdraw" && !existsSync(join(artifacts, "withdraw-final.zkey"))) {
  await $`node scripts/setup-withdraw-groth16.mjs`.cwd(ROOT);
}
const zkey = join(artifacts, circuit === "withdraw" ? "withdraw-final.zkey" : `${circuit}.zkey`);
const input = join(dir, "input.json");
if (!existsSync(input)) {
  await Bun.write(input, circuit === "hello" ? `{"x":"3"}\n` : "{}\n");
}
const wtns = join(artifacts, "witness.wtns");
if (circuit === "hello") await $`bunx snarkjs@0.7.5 groth16 setup ${r1cs} ${ptau} ${zkey}`;
await $`bunx snarkjs@0.7.5 wtns calculate ${wasm} ${input} ${wtns}`;
const proofPath = join(artifacts, "proof.json");
const publicPath = join(artifacts, "public.json");
await $`bunx snarkjs@0.7.5 groth16 prove ${zkey} ${wtns} ${proofPath} ${publicPath}`;
const vkJsonPath = join(artifacts, "verification_key.json");
await $`bunx snarkjs@0.7.5 zkey export verificationkey ${zkey} ${vkJsonPath}`;
await $`bunx snarkjs@0.7.5 groth16 verify ${vkJsonPath} ${publicPath} ${proofPath}`;

const proof = await Bun.file(proofPath).json();
const publics: string[] = await Bun.file(publicPath).json();
const vk = await Bun.file(vkJsonPath).json();
const { encodeGroth16Vk } = await import("@zk-pay/shared");
await Bun.write(join(artifacts, "proof.bin"), encodeGroth16Proof(proof));
await Bun.write(join(artifacts, "public.bin"), encodeG16PublicSignals(publics));
await Bun.write(join(artifacts, "vk.bin"), encodeGroth16Vk(vk));
console.log(`✅ Circom ${circuit} proof written to ${artifacts}`);
console.log(`   proof.bin ${toHex(encodeGroth16Proof(proof)).slice(0, 32)}…`);
