import { expect, test } from "bun:test";
import { assertNotMainnet } from "./network";

test("GIVEN scripts refuse mainnet", () => {
  expect(() => assertNotMainnet("mainnet")).toThrow(/Refusing mainnet/);
  expect(() => assertNotMainnet("Public Global Stellar Network ; September 2015")).toThrow(
    /Refusing mainnet/,
  );
  expect(() => assertNotMainnet("pubnet")).toThrow(/Refusing mainnet/);
  expect(assertNotMainnet("testnet")).toBe("testnet");
  expect(assertNotMainnet("local")).toBe("local");
});
