import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { DebugPage, helloCommand } from "./DebugPage";
import { AppPage } from "./AppPage";
import { readFileSync } from "node:fs";

describe("original button-panel interface", () => {
  test("keeps every original control and explicitly describes local-only hello", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <DebugPage />
      </MemoryRouter>,
    );
    for (const label of [
      "fund",
      "prove hello (noir) · local",
      "verify hello (noir) · local",
      "prove hello (circom) · local",
      "verify hello (circom) · local",
      "openrouter stub",
    ])
      expect(html).toContain(`>${label}</button>`);
    expect(html).toContain('role="log"');
    expect(html).toContain("no hello API is hosted");
    expect(html).toContain(
      "they do not run proofs or submit transactions here",
    );
  });
  test("hello helpers use the original CLI with explicit testnet verification", () => {
    for (const path of ["noir", "circom"] as const) {
      expect(helloCommand("prove", path)).toBe(
        `bun run prove:hello --path ${path}`,
      );
      expect(helloCommand("verify", path)).toBe(
        `bun run verify:hello --path ${path} --network testnet`,
      );
    }
  });
  test("does not reintroduce absent hosted signing/proving endpoints", () => {
    const source = readFileSync(
      new URL("./DebugPage.tsx", import.meta.url),
      "utf8",
    );
    for (const endpoint of [
      "/fund",
      "/prove/hello",
      "/verify/hello",
      "/ai/complete",
    ])
      expect(source).not.toContain(`"${endpoint}"`);
  });
  test("payment flow retains note, proof, confirmation and AI safeguards", () => {
    const html = renderToStaticMarkup(<AppPage />);
    for (const text of [
      "Generate a test note",
      "Download note backup",
      "Deposit 1 test XLM",
      "Generate withdrawal proof",
      "Withdraw to recipient B",
      "Ask AI to explain",
      "Testnet only",
      "AI access token (memory only)",
    ])
      expect(html).toContain(text);
    expect(html).toContain('id="deposit"');
    expect(html).toContain('id="ai"');
    expect(html).not.toContain("A membership proof,");
  });
});
