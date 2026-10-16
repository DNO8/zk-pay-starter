import { randomBytes } from "node:crypto";
import { aiStatus, chat } from "./openrouter";
import {
  paymentConfig,
  deposit,
  prove,
  withdraw,
  transaction,
} from "./payment-service";

const PORT = Number(process.env.API_PORT ?? "43122");
const sessionToken = randomBytes(32).toString("hex");
const allowedOrigins = new Set([
  "http://localhost:43121",
  "http://127.0.0.1:43121",
]);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
let paymentBusy = false;
export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // This is a trusted-local workshop backend, never a publicly hosted signer.
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    return json({ error: "Local backend only" }, 403);
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin))
    return json({ error: "Origin not allowed" }, 403);
  if (req.method === "GET" && url.pathname === "/health")
    return json({
      ok: true,
      network: "testnet",
      mode: "trusted-local",
      sessionToken,
      ai: aiStatus(),
    });
  if (req.method === "GET" && url.pathname === "/pay/config") {
    try {
      return json(await paymentConfig());
    } catch {
      return json(
        {
          ready: false,
          error:
            "Payment service is not configured. Run local testnet setup first.",
        },
        503,
      );
    }
  }
  if (req.method === "GET" && url.pathname === "/pay/transaction") {
    const hash = url.searchParams.get("hash") ?? "";
    if (!/^[a-f0-9]{64}$/i.test(hash))
      return json({ error: "Invalid transaction hash" }, 400);
    try {
      return json(await transaction(hash));
    } catch {
      return json({ error: "Could not query testnet transaction" }, 502);
    }
  }
  if (req.method !== "POST") return json({ error: "Not found" }, 404);
  if (req.headers.get("x-local-session") !== sessionToken)
    return json({ error: "Local session required. Reload the page." }, 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "JSON required" }, 415);
  if (Number(req.headers.get("content-length") ?? 0) > 16384)
    return json({ error: "Request too large" }, 413);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 16384) return json({ error: "Request too large" }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (url.pathname === "/pay/ai-step") {
    if (Object.keys(body).length)
      return json(
        { error: "This route accepts no payment data or custom prompt" },
        400,
      );
    if (!aiStatus().enabled)
      return json(
        {
          error:
            "AI pending: configure a server key and explicit call limit. No AI response generated.",
        },
        503,
      );
    try {
      return json(await chat());
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "AI call failed" },
        502,
      );
    }
  }
  if (!["/pay/deposit", "/pay/prove", "/pay/withdraw"].includes(url.pathname))
    return json({ error: "Not found" }, 404);
  if (paymentBusy)
    return json({ error: "A payment operation is already running" }, 409);
  paymentBusy = true;
  try {
    if (url.pathname === "/pay/deposit") {
      if (
        typeof body.commitment !== "string" ||
        !/^(0x[0-9a-f]{1,64}|[0-9]{1,78})$/i.test(body.commitment) ||
        typeof body.depositor !== "string"
      )
        return json({ error: "Invalid commitment or depositor" }, 400);
      return json(
        await deposit({
          commitment: body.commitment,
          depositor: body.depositor,
        }),
      );
    }
    if (url.pathname === "/pay/prove") {
      if (
        typeof body.note !== "string" ||
        !/^[0-9a-f]{128}$/i.test(body.note) ||
        typeof body.recipient !== "string" ||
        !/^G[A-Z2-7]{55}$/.test(body.recipient) ||
        body.trustedLocal !== true
      )
        return json(
          {
            error: "Valid note, recipient, and trusted-local consent required",
          },
          400,
        );
      return json(await prove({ note: body.note, recipient: body.recipient }));
    }
    if (
      typeof body.proofId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(body.proofId)
    )
      return json({ error: "Invalid proof id" }, 400);
    return json(await withdraw({ proofId: body.proofId }));
  } catch {
    // Never return subprocess stderr or witnesses: those may contain notes or keys.
    return json(
      {
        error:
          "Payment operation failed. Check local configuration and chain state; no success is assumed. Do not repeat a deposit until checking its status.",
      },
      502,
    );
  } finally {
    paymentBusy = false;
  }
}
if (import.meta.main) {
  Bun.serve({ port: PORT, hostname: "127.0.0.1", fetch: handleRequest });
  console.info(
    `Trusted-local testnet API listening on http://127.0.0.1:${PORT}`,
  );
}
