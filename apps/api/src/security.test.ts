import { describe, expect, test } from "bun:test";
import { handleRequest } from "./index";
import { aiStatus, EDUCATIONAL_PROMPT } from "./openrouter";
const get = (path: string, headers: Record<string, string> = {}) =>
  handleRequest(new Request(`http://127.0.0.1:43122${path}`, { headers }));
async function post(path: string, body: unknown, token?: string) {
  return handleRequest(
    new Request(`http://127.0.0.1:43122${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Local-Session": token } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}
async function token() {
  return (await (await get("/health")).json()).sessionToken;
}
describe("trusted-local payment API security (no network or paid calls)", () => {
  test("rejects cross-origin requests and nonlocal host", async () => {
    expect(
      (await get("/health", { origin: "https://evil.example" })).status,
    ).toBe(403);
    expect(
      (await handleRequest(new Request("https://public.example/health")))
        .status,
    ).toBe(403);
  });
  test("does not expose key generation, arbitrary signer, or logs", async () => {
    const t = await token();
    for (const path of [
      "/fund",
      "/verify/hello",
      "/prove/hello",
      "/ai/complete",
      "/logs",
    ]) {
      expect((await post(path, {}, t)).status).toBe(404);
    }
    expect((await get("/logs")).status).toBe(404);
  });
  test("requires session for mutations", async () => {
    expect(
      (await post("/pay/deposit", { commitment: "1", depositor: "alice" }))
        .status,
    ).toBe(403);
  });
  test("rejects arbitrary AI data before any outbound request", async () => {
    expect(
      (
        await post(
          "/pay/ai-step",
          { prompt: "secret payment details" },
          await token(),
        )
      ).status,
    ).toBe(400);
    expect(EDUCATIONAL_PROMPT).toContain("synthetic");
  });
  test("rejects malformed proof and recipient before service access", async () => {
    const t = await token();
    expect(
      (await post("/pay/prove", { note: "abc", recipient: "G" }, t)).status,
    ).toBe(400);
    expect(
      (await post("/pay/withdraw", { proofId: "../secret" }, t)).status,
    ).toBe(400);
    expect((await get("/pay/transaction?hash=secret")).status).toBe(400);
  });
  test("disabled AI never fabricates response", async () => {
    if (!aiStatus().enabled) {
      const result = await post("/pay/ai-step", {}, await token());
      expect(result.status).toBe(503);
      expect((await result.json()).error).toContain("No AI response generated");
    }
  });
});
