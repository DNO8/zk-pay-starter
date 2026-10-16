import { describe, expect, test } from "bun:test";
import { encodeG16PublicSignals, encodeG1, encodeUhPublicInputs } from "./encode";
import { fieldToBe32 } from "./field";

describe("GIVEN encoders", () => {
  test("UltraHonk public inputs are N×32 BE", () => {
    const b = encodeUhPublicInputs([9n]);
    expect(b.length).toBe(32);
    expect(b[31]).toBe(9);
  });

  test("Groth16 public signals have 4-byte length prefix", () => {
    const b = encodeG16PublicSignals([9n]);
    expect(b.length).toBe(36);
    expect(b[3]).toBe(1);
    expect(b[35]).toBe(9);
  });

  test("G1 is 64 bytes", () => {
    expect(encodeG1("1", "2").length).toBe(64);
    expect(fieldToBe32(1n)[31]).toBe(1);
  });
});


test("BN254 point coordinates preserve Fq values above Fr", async () => {
  const { BN254_BASE_MODULUS, encodeG2 } = await import("./encode");
  const scalarModulus = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  const point = encodeG1(String(scalarModulus), String(BN254_BASE_MODULUS - 1n));
  expect(BigInt("0x" + Buffer.from(point.slice(0,32)).toString("hex"))).toBe(scalarModulus);
  expect(BigInt("0x" + Buffer.from(point.slice(32)).toString("hex"))).toBe(BN254_BASE_MODULUS - 1n);
  const g2 = encodeG2(["1",String(scalarModulus)], ["2","3"]);
  expect(BigInt("0x" + Buffer.from(g2.slice(0,32)).toString("hex"))).toBe(scalarModulus);
  expect(() => encodeG1(String(BN254_BASE_MODULUS), "1")).toThrow("Noncanonical");
  expect(() => encodeG1("-1", "1")).toThrow("Noncanonical");
});
