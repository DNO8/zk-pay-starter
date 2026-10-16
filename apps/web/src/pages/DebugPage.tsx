import { useState } from "react";

const API = "/api";

export function DebugPage() {
  const [log, setLog] = useState<string>("GIVEN pipeline. Unstyled on purpose.\n");
  const append = (s: string) => setLog((x) => x + s + "\n");

  async function call(path: string, body?: unknown) {
    append(`→ POST ${path}`);
    try {
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const text = await res.text();
      append(`← ${res.status} ${text.slice(0, 4000)}`);
    } catch (e) {
      append(`← error ${e}`);
    }
  }

  return (
    <main className="p-4 max-w-3xl">
      <h1 className="text-xl text-amber mb-2">Debug pipeline</h1>
      <p className="text-graphite mb-4 text-sm">
        Fund a testnet key, prove the hello circuit, verify it on-chain. Use this to confirm M0+M1
        before touching the gaps.
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        <button className="border px-3 py-1" onClick={() => call("/fund")}>
          fund
        </button>
        <button className="border px-3 py-1" onClick={() => call("/prove/hello", { path: "noir" })}>
          prove hello (noir)
        </button>
        <button className="border px-3 py-1" onClick={() => call("/verify/hello", { path: "noir" })}>
          verify hello (noir)
        </button>
        <button className="border px-3 py-1" onClick={() => call("/prove/hello", { path: "circom" })}>
          prove hello (circom)
        </button>
        <button className="border px-3 py-1" onClick={() => call("/verify/hello", { path: "circom" })}>
          verify hello (circom)
        </button>
        <button className="border px-3 py-1" onClick={() => call("/ai/complete", { prompt: "One word: ping" })}>
          openrouter stub
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-xs border border-graphite p-3 min-h-[16rem] overflow-auto">
        {log}
      </pre>
    </main>
  );
}
