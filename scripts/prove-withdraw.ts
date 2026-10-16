/** Local-only proving. Notes never leave the machine; isolated witness files are removed. */
import { $ } from "bun";
import { cp, mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Note, type MerkleProof, encodeUhPublicInputs } from "@zk-pay/shared";

export type WithdrawWitness = { note: Note; merkleProof: MerkleProof; recipient: bigint; fee: bigint };
export async function proveWithdraw({note, merkleProof, recipient, fee}: WithdrawWitness): Promise<{
  proof: Uint8Array; publicInputs: Uint8Array; vk: Uint8Array;
}> {
  if (merkleProof.pathElements.length !== 8 || merkleProof.pathIndices.length !== 8 ||
      merkleProof.pathIndices.some(i => i !== 0 && i !== 1)) throw new Error("Invalid depth-8 Merkle path");
  if (fee < 0n || fee > 10_000_000n) throw new Error("Fee must be within the fixed denomination");
  const { nullifierHash } = await import("@zk-pay/shared");
  const base = await mkdtemp(join(tmpdir(), "zk-pay-withdraw-"));
  const circuit = join(base, "withdraw");
  const source = join(import.meta.dir, "../circuits/noir");
  try {
    await mkdir(circuit);
    await cp(join(source, "lib"), join(base, "lib"), { recursive: true, filter: p => !p.includes("/target") });
    await cp(join(source, "withdraw/src"), join(circuit, "src"), { recursive: true });
    await cp(join(source, "withdraw/Nargo.toml"), join(circuit, "Nargo.toml"));
    const input = {
      root: String(merkleProof.root), nullifier_hash: String(nullifierHash(note.nullifier)),
      recipient: String(recipient), fee: String(fee), nullifier: String(note.nullifier), secret: String(note.secret),
      path_elements: merkleProof.pathElements.map(String), path_indices: merkleProof.pathIndices,
    };
    await writeFile(join(circuit, "Prover.toml"), Object.entries(input).map(([k,v])=>`${k} = ${JSON.stringify(v)}`).join("\n"), { mode: 0o600 });
    // Keep all subprocess output private, including errors that might contain witness values.
    const execute = await $`nargo execute`.cwd(circuit).quiet().nothrow();
    if (execute.exitCode !== 0) throw new Error("Withdraw witness failed circuit constraints");
    const target = join(circuit, "target"), bytecode = join(target, "withdraw.json"), witness = join(target, "withdraw.gz");
    const prove = await $`bb prove --scheme ultra_honk --oracle_hash keccak --bytecode_path ${bytecode} --witness_path ${witness} --output_path ${target} --output_format bytes_and_fields`.quiet().nothrow();
    if (prove.exitCode !== 0) throw new Error("Withdraw proof generation failed");
    const key = await $`bb write_vk --scheme ultra_honk --oracle_hash keccak --bytecode_path ${bytecode} --output_path ${target} --output_format bytes_and_fields`.quiet().nothrow();
    if (key.exitCode !== 0) throw new Error("Withdraw verification key generation failed");
    const proof = new Uint8Array(await readFile(join(target, "proof")));
    const publicInputs = new Uint8Array(await readFile(join(target, "public_inputs")));
    const vk = new Uint8Array(await readFile(join(target, "vk")));
    const expected = encodeUhPublicInputs([merkleProof.root, nullifierHash(note.nullifier), recipient, fee]);
    if (!Buffer.from(expected).equals(Buffer.from(publicInputs))) throw new Error("Prover public input ordering mismatch");
    const verify = await $`bb verify --scheme ultra_honk --oracle_hash keccak --proof_path ${join(target,"proof")} --public_inputs_path ${join(target,"public_inputs")} --vk_path ${join(target,"vk")}`.quiet().nothrow();
    if (verify.exitCode !== 0) throw new Error("Generated proof failed local verification");
    return { proof, publicInputs, vk };
  } finally { await rm(base, { recursive: true, force: true }); }
}

/** Actual zero-knowledge backend used by the payment flow. Setup is explicit and stable. */
export async function proveWithdrawGroth16({note,merkleProof,recipient,fee}: WithdrawWitness): Promise<{
  proof:Uint8Array; publicInputs:Uint8Array; vk:Uint8Array;
}> {
  const { nullifierHash, encodeGroth16Proof, encodeGroth16Vk, encodeG16PublicSignals } = await import("@zk-pay/shared");
  const artifacts=join(import.meta.dir,"../artifacts/circom/withdraw");
  const zkey=join(artifacts,"withdraw-final.zkey"), vkPath=join(artifacts,"verification_key_final.json");
  if(!await Bun.file(zkey).exists()) throw new Error("Run node scripts/setup-withdraw-groth16.mjs before proving");
  if(merkleProof.pathElements.length!==8 || merkleProof.pathIndices.length!==8 || merkleProof.pathIndices.some(i=>i!==0&&i!==1)) throw new Error("Invalid depth-8 Merkle path");
  if(fee<0n || fee>10_000_000n) throw new Error("Fee out of range");
  const temp=await mkdtemp(join(tmpdir(),"zk-pay-groth16-"));
  try {
    const input=join(temp,"input.json"), witness=join(temp,"witness.wtns"), proofPath=join(temp,"proof.json"), publicPath=join(temp,"public.json");
    await writeFile(input,JSON.stringify({root:String(merkleProof.root),nullifierHash:String(nullifierHash(note.nullifier)),recipient:String(recipient),fee:String(fee),nullifier:String(note.nullifier),secret:String(note.secret),pathElements:merkleProof.pathElements.map(String),pathIndices:merkleProof.pathIndices}),{mode:0o600});
    const cli=join(import.meta.dir,"../node_modules/snarkjs/build/cli.cjs");
    const wasm=join(artifacts,"withdraw_js/withdraw.wasm");
    const calculate=await $`node ${cli} wtns calculate ${wasm} ${input} ${witness}`.quiet().nothrow();
    if(calculate.exitCode!==0) throw new Error("Withdraw witness failed circuit constraints");
    const run=await $`node ${cli} groth16 prove ${zkey} ${witness} ${proofPath} ${publicPath}`.quiet().nothrow();
    if(run.exitCode!==0) throw new Error("Groth16 proving failed");
    const verify=await $`node ${cli} groth16 verify ${vkPath} ${publicPath} ${proofPath}`.quiet().nothrow();
    if(verify.exitCode!==0 || !verify.text().includes("OK!")) throw new Error("Generated Groth16 proof failed verification");
    const publics:string[]=await Bun.file(publicPath).json();
    const expected=[merkleProof.root,nullifierHash(note.nullifier),recipient,fee].map(String);
    if(publics.map(v=>String(BigInt(v))).join(',')!==expected.join(',')) throw new Error("Groth16 public input order mismatch");
    return {proof:encodeGroth16Proof(await Bun.file(proofPath).json()),publicInputs:encodeG16PublicSignals(publics),vk:encodeGroth16Vk(await Bun.file(vkPath).json())};
  } finally { await rm(temp,{recursive:true,force:true}); }
}
