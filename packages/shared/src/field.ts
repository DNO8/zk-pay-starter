import params from "../poseidon.params.json";

export const FIELD_MODULUS = BigInt(params.field_modulus);

/** Reduce a bigint into BN254 Fr. */
export function Fr(x: bigint): bigint {
  let r = x % FIELD_MODULUS;
  if (r < 0n) r += FIELD_MODULUS;
  return r;
}

export function assertInField(x: bigint, label = "value"): void {
  if (x < 0n || x >= FIELD_MODULUS) {
    throw new RangeError(`${label} is not a canonical BN254 Fr element`);
  }
}

export function fieldFromHex(hex: string): bigint {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Fr(BigInt("0x" + h));
}

export function fieldToBe32(x: bigint): Uint8Array {
  const v = Fr(x);
  const out = new Uint8Array(32);
  let n = v;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

export function fieldFromBe32(bytes: Uint8Array): bigint {
  if (bytes.length !== 32) throw new Error("expected 32 bytes");
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return Fr(n);
}

export function fieldToHex(x: bigint): string {
  return "0x" + Fr(x).toString(16).padStart(64, "0");
}

export function parseField(s: string | number | bigint): bigint {
  if (typeof s === "bigint") return Fr(s);
  if (typeof s === "number") return Fr(BigInt(s));
  const t = s.trim();
  if (t.startsWith("0x") || t.startsWith("0X")) return Fr(BigInt(t));
  return Fr(BigInt(t));
}
