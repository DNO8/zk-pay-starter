import { describe, expect, test } from "bun:test";
import { validNote, transactionUrl } from "../pages/AppPage";
import { serializeProof } from "./browser-payment";
import { FIELD_MODULUS, encodeGroth16Proof } from "@zk-pay/shared";
describe("payment browser invariants", () => {
  test("canonical note validation prevents deposit/prover mismatch", () => {
    expect(validNote("0".repeat(128))).toBe(true);
    expect(validNote("f".repeat(128))).toBe(false);
    expect(
      validNote(FIELD_MODULUS.toString(16).padStart(64, "0") + "0".repeat(64)),
    ).toBe(false);
    expect(validNote("x".repeat(128))).toBe(false);
    expect(validNote("0".repeat(127))).toBe(false);
  });
  test("full hash links are exact testnet Stellar Expert anchors", () => {
    const hash = "abcdef01".repeat(8);
    expect(transactionUrl(hash)).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
    expect(() => transactionUrl("short")).toThrow();
    expect(() => transactionUrl("javascript:alert(1)")).toThrow();
  });
  test("browser Groth16 serialization matches canonical SDK encoding", () => {
    const proof = {
      pi_a: ["1", "2"],
      pi_b: [
        ["3", "4"],
        ["5", "6"],
      ],
      pi_c: ["7", "8"],
    };
    expect(Array.from(serializeProof(proof))).toEqual(
      Array.from(encodeGroth16Proof(proof)),
    );
    expect(serializeProof(proof).length).toBe(256);
  });
  test("browser proof rejects noncanonical coordinates", () => {
    expect(() =>
      serializeProof({
        pi_a: ["-1", "2"],
        pi_b: [
          ["3", "4"],
          ["5", "6"],
        ],
        pi_c: ["7", "8"],
      }),
    ).toThrow();
  });
});
