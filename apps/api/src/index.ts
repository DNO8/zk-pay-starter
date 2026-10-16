import { Keypair, Horizon } from "@stellar/stellar-sdk";
import { chat } from "./openrouter";

const PORT = Number(process.env.API_PORT ?? "43122");
const logs: string[] = [];
function log(msg: string) {
  const line = `${new Date().toISOString()} ${msg}`;
  logs.push(line);
  if (logs.length > 200) logs.shift();
  console.log(line);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/health") return json({ ok: true, logs: logs.slice(-20) });
    if (url.pathname === "/logs") return json({ logs });

    if (url.pathname === "/fund" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { address?: string };
      let address = body.address;
      let secret: string | undefined;
      if (!address) {
        const kp = Keypair.random();
        address = kp.publicKey();
        secret = kp.secret();
      }
      const res = await fetch(`https://friendbot.stellar.org?addr=${address}`);
      log(`friendbot ${address} status=${res.status}`);
      return json({ address, secret, funded: res.ok, status: res.status });
    }

    if (url.pathname === "/ai/complete" && req.method === "POST") {
      const body = (await req.json()) as { prompt?: string };
      const result = await chat(body.prompt ?? "Say hello in one sentence.");
      log(`openrouter stub model=${result.model} chars=${result.text.length}`);
      return json(result);
    }

    if (url.pathname === "/prove/hello" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { path?: string };
      const provingPath = body.path === "circom" ? "circom" : "noir";
      log(`prove hello path=${provingPath}`);
      const proc = Bun.spawn(["bun", "run", "prove:hello", "--path", provingPath], {
        cwd: joinRepo(),
        stdout: "pipe",
        stderr: "pipe",
      });
      const out = await new Response(proc.stdout).text();
      const err = await new Response(proc.stderr).text();
      const code = await proc.exited;
      log(`prove hello exit=${code}`);
      return json({ ok: code === 0, out, err, path: provingPath });
    }

    if (url.pathname === "/verify/hello" && req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as { path?: string };
      const provingPath = body.path === "circom" ? "circom" : "noir";
      log(`verify hello path=${provingPath}`);
      const proc = Bun.spawn(
        ["bun", "run", "verify:hello", "--path", provingPath, "--network", "testnet"],
        { cwd: joinRepo(), stdout: "pipe", stderr: "pipe" },
      );
      const out = await new Response(proc.stdout).text();
      const err = await new Response(proc.stderr).text();
      const code = await proc.exited;
      log(`verify hello exit=${code}`);
      return json({ ok: code === 0, out, err, path: provingPath });
    }

    // TODO(GAP-7): the AI step in the payment flow (e.g. parse a payment request / check a memo / explain result), visible in logs
    //   → docs/lessons/07.md#hints
    if (url.pathname === "/pay/ai-step" && req.method === "POST") {
      return json(
        {
          error: "TODO(GAP-7): wire chat() into the deposit/withdraw flow and log it. See docs/lessons/07.md#hints",
        },
        501,
      );
    }

    return json({ error: "not found" }, 404);
  },
});

function joinRepo() {
  return new URL("../../..", import.meta.url).pathname;
}

log(`api listening on http://127.0.0.1:${PORT}`);
void Horizon;
