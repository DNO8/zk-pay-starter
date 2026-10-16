#!/usr/bin/env bun
/** Real local proof regression for both backends. No network transactions. */
import { $ } from "bun";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import golden from "../packages/shared/vectors/golden.json";
import { fieldToBe32 } from "@zk-pay/shared";
import { proveWithdraw } from "./prove-withdraw";

const root = join(import.meta.dir, "..");
const noir = join(root, "artifacts/noir/withdraw");
const circom = join(root, "artifacts/circom/withdraw");
const p = golden.merkle.path_leaf0_after_2;
const n = golden.notes[0];
const witness = {
  note: {nullifier: BigInt(n.nullifier), secret: BigInt(n.secret)},
  merkleProof: {root: BigInt(golden.merkle.root_after_2), index: 0, pathElements:p.elements.map(BigInt), pathIndices:p.indices},
  recipient: 7n, fee: 0n,
};
await mkdir(noir, {recursive:true});
const result = await proveWithdraw(witness);
await Bun.write(join(noir,"proof"), result.proof);
await Bun.write(join(noir,"public_inputs"), result.publicInputs);
await Bun.write(join(noir,"vk"), result.vk);
const checks: string[] = ["Noir valid proof accepted"];
for (let i=0; i<4; i++) {
  const changed = result.publicInputs.slice();
  const value = BigInt("0x"+Buffer.from(changed.slice(i*32,i*32+32)).toString("hex"));
  changed.set(fieldToBe32(value+1n),i*32);
  const pub = join(noir, `tampered-public-${i}`);
  await Bun.write(pub,changed);
  const verify = await $`bb verify --scheme ultra_honk --oracle_hash keccak --proof_path ${join(noir,"proof")} --public_inputs_path ${pub} --vk_path ${join(noir,"vk")}`.quiet().nothrow();
  if (verify.exitCode===0) throw new Error(`Noir accepted tampered input ${i}`);
  checks.push(`Noir public input ${i} tamper rejected`);
}
await Bun.write(join(root,"circuits/circom/withdraw/input.json"),JSON.stringify({
  root:String(witness.merkleProof.root), nullifierHash:n.nullifierHash, recipient:"7", fee:"0",
  nullifier:n.nullifier,secret:n.secret,pathElements:p.elements,pathIndices:p.indices,
}));
await $`bun run scripts/prove.ts withdraw --path circom`.cwd(root).quiet();
const vk=await Bun.file(join(circom,"verification_key.json")).json();
const proof=await Bun.file(join(circom,"proof.json")).json();
const publics:string[]=await Bun.file(join(circom,"public.json")).json();
const cli = join(root,"node_modules/snarkjs/build/cli.cjs");
async function verifyGroth16(values: string[]): Promise<boolean> {
  const file=join(circom,"test-public.json");
  await Bun.write(file,JSON.stringify(values));
  const result=await $`node ${cli} groth16 verify ${join(circom,"verification_key.json")} ${file} ${join(circom,"proof.json")}`.quiet().nothrow();
  return result.exitCode===0 && result.text().includes("OK!");
}
if (!await verifyGroth16(publics)) throw new Error("Circom valid proof rejected");
if (publics.map(BigInt).map(String).join(",")!==[witness.merkleProof.root,BigInt(n.nullifierHash),7n,0n].map(String).join(",")) throw new Error("Circom public input order mismatch");
checks.push("Circom valid proof accepted");
for(let i=0;i<4;i++) {
  const changed=[...publics]; changed[i]=String(BigInt(changed[i])+1n);
  if (await verifyGroth16(changed)) throw new Error(`Circom accepted tampered input ${i}`);
  checks.push(`Circom public input ${i} tamper rejected`);
}
const report={checkedAt:new Date().toISOString(),checks,limitations:["Groth16 uses a random single-party development setup, not an audited multiparty ceremony.","Noir protected UltraKeccak verifier is NON-zero-knowledge: membership correctness only. Use Groth16 for payment privacy.","Privacy depends on funding, timing, anonymity set, and local note secrecy."]};
await Bun.write(join(noir,"test-report.json"),JSON.stringify(report,null,2));
console.log(checks.join("\n"));
process.exit(0);
