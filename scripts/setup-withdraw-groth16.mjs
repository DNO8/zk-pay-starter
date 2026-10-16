#!/usr/bin/env node
// Single-machine TESTNET development setup. Not an audited multiparty ceremony.
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { powersOfTau, zKey } from 'snarkjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'artifacts/circom/withdraw');
mkdirSync(out,{recursive:true});
const final=join(out,'withdraw-final.zkey');
function exportBinaryVk() {
  execFileSync('bun', ['-e', 'import {encodeGroth16Vk} from "@zk-pay/shared"; const d="artifacts/circom/withdraw/"; await Bun.write(d+"vk-final.bin",encodeGroth16Vk(await Bun.file(d+"verification_key_final.json").json()));'], {cwd:root,stdio:'ignore'});
}
if(existsSync(final)) { exportBinaryVk(); console.log('Existing withdrawal setup preserved.'); process.exit(0); }
const dir=join(root,'circuits/circom/withdraw');
execFileSync('circom',['withdraw.circom','--r1cs','--wasm','--sym','-o',out],{cwd:dir,stdio:'ignore'});
const cli=join(root,'node_modules/snarkjs/build/cli.cjs');
const zero=join(out,'pot12-zero.ptau'), contributed=join(out,'pot12-random.ptau'), prepared=join(out,'pot12-prepared.ptau');
execFileSync(process.execPath,[cli,'powersoftau','new','bn128','12',zero],{stdio:'ignore'});
// Entropy never enters command arguments, files, or logs. JS cannot guarantee memory erasure.
await powersOfTau.contribute(zero,contributed,'local testnet phase 1',randomBytes(64).toString('hex'));
await powersOfTau.preparePhase2(contributed,prepared);
const initial=join(out,'withdraw-initial.zkey'), pending=join(out,'withdraw-final.pending.zkey');
await zKey.newZKey(join(out,'withdraw.r1cs'),prepared,initial);
await zKey.contribute(initial,pending,'local testnet phase 2',randomBytes(64).toString('hex'));
const vk=await zKey.exportVerificationKey(pending);
writeFileSync(join(out,'verification_key_final.json'),JSON.stringify(vk,null,2));
writeFileSync(join(out,'setup-manifest.json'),JSON.stringify({
  kind:'single-party random development setup; not audited; testnet only',
  r1csSha256:createHash('sha256').update(readFileSync(join(out,'withdraw.r1cs'))).digest('hex'),
  zkeySha256:createHash('sha256').update(readFileSync(pending)).digest('hex'),
},null,2));
exportBinaryVk();
renameSync(pending,final);
console.log('Withdrawal Groth16 setup ready; immutable zkey retained.');
process.exit(0);
