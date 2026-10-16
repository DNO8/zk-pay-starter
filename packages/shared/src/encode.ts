import { fieldToBe32, parseField } from "./field";

/** Concatenate N public fields as 32-byte big-endian (UltraHonk / bb.js). */
export function encodeUhPublicInputs(fields: Array<string | bigint | number>): Uint8Array {
  const out = new Uint8Array(fields.length * 32);
  fields.forEach((f, i) => out.set(fieldToBe32(parseField(f)), i * 32));
  return out;
}

/**
 * CircomStellar/snarkjs public-signal blob for the BN254 Groth16 verifier:
 * 4-byte big-endian length || N × 32-byte big-endian fields.
 */
export function encodeG16PublicSignals(fields: Array<string | bigint | number>): Uint8Array {
  const n = fields.length;
  const out = new Uint8Array(4 + n * 32);
  out[0] = (n >>> 24) & 0xff;
  out[1] = (n >>> 16) & 0xff;
  out[2] = (n >>> 8) & 0xff;
  out[3] = n & 0xff;
  fields.forEach((f, i) => out.set(fieldToBe32(parseField(f)), 4 + i * 32));
  return out;
}

function pad32(n: bigint): Uint8Array {
  return fieldToBe32(n);
}

function parseDecOrHex(s: string): bigint {
  const t = s.trim();
  if (t.startsWith("0x") || t.startsWith("0X")) return BigInt(t);
  return BigInt(t);
}

/** G1: concat(be(X), be(Y)) = 64 bytes. CAP-0074. */
export function encodeG1(x: string, y: string): Uint8Array {
  const out = new Uint8Array(64);
  out.set(pad32(parseDecOrHex(x)), 0);
  out.set(pad32(parseDecOrHex(y)), 32);
  return out;
}

/**
 * G2: be(X_c1) || be(X_c0) || be(Y_c1) || be(Y_c0) = 128 bytes. CAP-0074.
 * snarkjs stores each Fq2 as [c0, c1], so we swap to Stellar's c1||c0 order.
 */
export function encodeG2(x: [string, string], y: [string, string]): Uint8Array {
  const out = new Uint8Array(128);
  out.set(pad32(parseDecOrHex(x[1])), 0); // X_c1
  out.set(pad32(parseDecOrHex(x[0])), 32); // X_c0
  out.set(pad32(parseDecOrHex(y[1])), 64); // Y_c1
  out.set(pad32(parseDecOrHex(y[0])), 96); // Y_c0
  return out;
}

export type SnarkjsVk = {
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  IC: string[][];
  nPublic: number;
};

export type SnarkjsProof = {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
};

/** Binary VK for contracts/verifier-groth16 (alpha|beta|gamma|delta|ic_len|IC...). */
export function encodeGroth16Vk(vk: SnarkjsVk): Uint8Array {
  const ic = vk.IC;
  const parts: Uint8Array[] = [
    encodeG1(vk.vk_alpha_1[0], vk.vk_alpha_1[1]),
    encodeG2(vk.vk_beta_2[0] as [string, string], vk.vk_beta_2[1] as [string, string]),
    encodeG2(vk.vk_gamma_2[0] as [string, string], vk.vk_gamma_2[1] as [string, string]),
    encodeG2(vk.vk_delta_2[0] as [string, string], vk.vk_delta_2[1] as [string, string]),
  ];
  const icLen = new Uint8Array(4);
  const n = ic.length;
  icLen[0] = (n >>> 24) & 0xff;
  icLen[1] = (n >>> 16) & 0xff;
  icLen[2] = (n >>> 8) & 0xff;
  icLen[3] = n & 0xff;
  parts.push(icLen);
  for (const p of ic) parts.push(encodeG1(p[0], p[1]));
  const total = parts.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function encodeGroth16Proof(proof: SnarkjsProof): Uint8Array {
  const a = encodeG1(proof.pi_a[0], proof.pi_a[1]);
  const b = encodeG2(proof.pi_b[0] as [string, string], proof.pi_b[1] as [string, string]);
  const c = encodeG1(proof.pi_c[0], proof.pi_c[1]);
  const out = new Uint8Array(a.length + b.length + c.length);
  out.set(a, 0);
  out.set(b, a.length);
  out.set(c, a.length + b.length);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/**
 * bb.js UltraHonk proof-with-public-inputs: first N*32 bytes are public inputs
 * (big-endian fields), the rest is the proof the on-chain verifier expects.
 */
export function splitUhProof(bundle: Uint8Array, publicCount: number): {
  publicInputs: Uint8Array;
  proof: Uint8Array;
} {
  const pubBytes = publicCount * 32;
  if (bundle.length < pubBytes) {
    throw new Error(`proof bundle shorter than ${pubBytes} public-input bytes`);
  }
  return {
    publicInputs: bundle.slice(0, pubBytes),
    proof: bundle.slice(pubBytes),
  };
}

/** Public-input order for the withdraw circuit. See docs/lessons/04.md. */
export const WITHDRAW_PUBLIC_ORDER = ["root", "nullifierHash", "recipient", "fee"] as const;
