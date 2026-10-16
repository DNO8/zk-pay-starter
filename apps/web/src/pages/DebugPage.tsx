import { useEffect, useState } from "react";
import { browserConfig } from "../lib/browser-payment";
export function DebugPage() {
  const [status, setStatus] = useState("Checking testnet payment configuration…");
  useEffect(() => {
    const local = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PAYMENT_MODE === "local";
    if (!local) {
      browserConfig()
        .then((config) => setStatus(`Browser Groth16 mode. Testnet pool: ${config.pool}. No local backend required. OpenRouter requires separate server configuration.`))
        .catch((error) => setStatus(`Browser configuration unavailable: ${error instanceof Error ? error.message : "unknown error"}. Check public artifacts and testnet RPC.`));
      return;
    }
    fetch("/api/health")
      .then((r) => { if (!r.ok) throw new Error("Local backend unavailable"); return r.json(); })
      .then((r) => setStatus(`Network: ${r.network}. Mode: ${r.mode}. AI ${r.ai.enabled ? "enabled with bounded calls" : "pending configuration"}.`))
      .catch(() => setStatus("Explicit local mode requires bun run dev and the Bun API."));
  }, []);
  return (
    <main className="payment-app">
      <h1>Testnet diagnostics</h1>
      <p>{status}</p>
      <p>
        The public page does not expose funding secrets, server logs, or
        arbitrary signing helpers.
      </p>
      <p>
        For the GIVEN hello pipeline, run the repository's prove:hello and
        verify:hello commands locally. Use /app for the private-payment flow.
      </p>
    </main>
  );
}
