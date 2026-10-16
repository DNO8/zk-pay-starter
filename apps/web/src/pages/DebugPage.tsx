import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { browserConfig } from "../lib/browser-payment";

export function helloCommand(
  action: "prove" | "verify",
  path: "noir" | "circom",
) {
  return `bun run ${action}:hello --path ${path}${action === "verify" ? " --network testnet" : ""}`;
}

export function DebugPage() {
  const navigate = useNavigate();
  const [log, setLog] = useState(
    "GIVEN pipeline. Unstyled on purpose.\nHello buttons show local terminal commands; they do not run proofs or submit transactions here.\nFor a browser payment, open /app.\n",
  );
  const [busy, setBusy] = useState(false);
  const append = (s: string) => setLog((x) => x + s + "\n");

  function hello(action: "prove" | "verify", path: "noir" | "circom") {
    append(
      `→ ${action} hello (${path}) — local terminal only\n${helloCommand(action, path)}\nRun from your configured repository checkout. No browser request was sent. Hello is a circuit check, not a private payment.`,
    );
  }

  async function checkConfiguration() {
    setBusy(true);
    append("→ check testnet configuration (read-only)");
    try {
      const local = import.meta.env.VITE_PAYMENT_MODE === "local";
      if (local) {
        const response = await fetch("/api/health");
        if (!response.ok)
          throw new Error("Start the local Bun API with bun run dev");
        const health = await response.json();
        if (health.network !== "testnet" || health.mode !== "trusted-local")
          throw new Error("Expected trusted-local testnet backend");
        append(
          `← Testnet local backend available. AI: ${health.ai?.enabled ? "enabled" : "pending configuration"}.`,
        );
      } else {
        const config = await browserConfig();
        append(
          `← Browser Groth16 mode. Testnet pool: ${config.pool}.\nNo local backend required. AI requires separate server configuration.`,
        );
      }
    } catch (error) {
      append(
        `← ${error instanceof Error ? error.message : "Configuration unavailable"}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 max-w-3xl">
      <h1 className="text-xl text-amber mb-2">Debug pipeline</h1>
      <p className="text-graphite mb-4 text-sm">
        Fund a testnet account and make a private payment in /app. The original
        hello controls below show commands to run locally; no hello API is
        hosted.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className="border px-3 py-1"
          onClick={() => navigate("/app#deposit")}
          title="Open the payment flow; funding happens when you submit a deposit"
        >
          fund
        </button>
        <button
          className="border px-3 py-1"
          onClick={() => hello("prove", "noir")}
        >
          prove hello (noir) · local
        </button>
        <button
          className="border px-3 py-1"
          onClick={() => hello("verify", "noir")}
        >
          verify hello (noir) · local
        </button>
        <button
          className="border px-3 py-1"
          onClick={() => hello("prove", "circom")}
        >
          prove hello (circom) · local
        </button>
        <button
          className="border px-3 py-1"
          onClick={() => hello("verify", "circom")}
        >
          verify hello (circom) · local
        </button>
        <button
          className="border px-3 py-1"
          onClick={() => navigate("/app#ai")}
          title="Open the configured AI step; no request is sent until you click Ask AI to explain"
        >
          openrouter stub
        </button>
      </div>
      <p className="text-sm mb-4">
        fund opens the deposit flow; openrouter stub opens the bounded AI step.
        Neither sends a request on this page. Hello proving and verification run
        only from your local terminal.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className="border px-3 py-1"
          disabled={busy}
          onClick={checkConfiguration}
        >
          {busy ? "checking…" : "check testnet config"}
        </button>
        <button className="border px-3 py-1" onClick={() => navigate("/app")}>
          open private payment
        </button>
      </div>
      <pre
        role="log"
        aria-live="polite"
        className="whitespace-pre-wrap break-words text-xs border border-graphite p-3 min-h-[16rem] overflow-auto"
      >
        {log}
      </pre>
    </main>
  );
}
