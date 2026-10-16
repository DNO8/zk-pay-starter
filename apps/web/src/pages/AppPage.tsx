import { useEffect, useState } from "react";
import {
  browserConfig,
  browserDeposit,
  browserProve,
  browserWithdraw,
  browserTransaction,
  createBrowserRecipient,
  downloadRecipientBackup,
} from "../lib/browser-payment";
import { commitment, FIELD_MODULUS } from "@zk-pay/shared";

type Receipt = { hash: string; status: string };
type Config = {
  ready: boolean;
  pool?: string;
  denomination?: string;
  depositors?: { id: string; address: string }[];
  recipient?: string;
  error?: string;
};
export function transactionUrl(hash: string) {
  if (!/^[a-f0-9]{64}$/i.test(hash))
    throw new Error("Invalid transaction hash");
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
function Tx({ receipt }: { receipt: Receipt | null }) {
  return receipt ? (
    <p className="receipt">
      <strong>{receipt.status}</strong>
      <a href={transactionUrl(receipt.hash)} target="_blank" rel="noreferrer">
        {receipt.hash}
      </a>
    </p>
  ) : null;
}
function randomField() {
  const bytes = new Uint8Array(32);
  let value: bigint;
  do {
    crypto.getRandomValues(bytes);
    bytes[0] &= 0x3f;
    value = BigInt(
      "0x" + Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join(""),
    );
  } while (value >= FIELD_MODULUS);
  return value;
}
export function validNote(note: string) {
  return (
    /^[a-f0-9]{128}$/i.test(note) &&
    BigInt("0x" + note.slice(0, 64)) < FIELD_MODULUS &&
    BigInt("0x" + note.slice(64)) < FIELD_MODULUS
  );
}
export function AppPage() {
  const [browserMode, setBrowserMode] = useState(true);
  const [aiAccessToken, setAiAccessToken] = useState("");
  const [config, setConfig] = useState<Config>({ ready: false });
  const [token, setToken] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [depositor, setDepositor] = useState("");
  const [recipient, setRecipient] = useState("");
  const [consent, setConsent] = useState(false);
  const [depositReceipt, setDepositReceipt] = useState<Receipt | null>(null);
  const [withdrawReceipt, setWithdrawReceipt] = useState<Receipt | null>(null);
  const [proofId, setProofId] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [ai, setAi] = useState("");
  useEffect(() => {
    (async () => {
      const local = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PAYMENT_MODE === "local";
      try {
        if (local) {
          const response = await fetch("/api/health");
          if (!response.ok) throw new Error("Local backend unavailable");
          const health = await response.json();
          if (health.mode !== "trusted-local") throw new Error("No configured local backend");
          setBrowserMode(false);
          setToken(health.sessionToken);
          setAiEnabled(health.ai.enabled);
          const responseConfig = await fetch("/api/pay/config");
          if (!responseConfig.ok) throw new Error("Local payment configuration unavailable");
          const cfg = await responseConfig.json();
          setConfig(cfg);
          setDepositor(cfg.depositors?.[0]?.id ?? "");
          setRecipient(cfg.recipient ?? "");
        } else {
          const cfg = await browserConfig();
          setConfig(cfg);
          setDepositor("browser");
          setBrowserMode(true);
        }
      } catch (error) {
        setMessage(local
          ? "Local payment backend unavailable. Start the Bun API; no payment has been submitted."
          : `Browser payment could not initialize: ${error instanceof Error ? error.message : "unknown error"}. Check the published artifacts and Stellar testnet connection. No payment has been submitted.`);
      }
    })();
  }, []);
  async function call(path: string, body: any) {
    if (browserMode) {
      if (path === "/pay/deposit") return browserDeposit(body.commitment);
      if (path === "/pay/prove") return browserProve(body.note, body.recipient);
      if (path === "/pay/withdraw") return browserWithdraw(body.proofId);
      if (path === "/pay/ai-step") {
        const r = await fetch("/api/ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${aiAccessToken}`,
          },
          body: "{}",
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "AI unavailable");
        return data;
      }
    }
    const response = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Session": token },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Request failed");
    return result;
  }
  async function run(label: string, work: () => Promise<void>) {
    setBusy(label);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy("");
    }
  }
  function generateNote() {
    const n = randomField(),
      s = randomField();
    setNote(
      n.toString(16).padStart(64, "0") + s.toString(16).padStart(64, "0"),
    );
    setSaved(false);
    setProofId("");
    setDepositReceipt(null);
    setWithdrawReceipt(null);
  }
  function saveNote() {
    const blob = new Blob(
      [
        JSON.stringify(
          { network: "testnet", pool: config.pool, note },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zk-pay-testnet-note.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function confirm(receipt: Receipt, setter: (r: Receipt) => void) {
    const result = browserMode
      ? await browserTransaction(receipt.hash)
      : await fetch(`/api/pay/transaction?hash=${receipt.hash}`).then(
          async (r) => {
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            return data;
          },
        );
    setter(result);
    setMessage(
      result.status === "SUCCESS"
        ? "Transaction confirmed on Stellar Testnet."
        : `Chain status: ${result.status}. No confirmed success yet.`,
    );
  }
  return (
    <main className="payment-app">
      <header>
        <span className="eyebrow">STELLAR TESTNET</span>
        <h1>Private payment pipeline</h1>
        <p>
          Deposit 1 test XLM, keep your note, then prove a withdrawal to a fresh
          account.
        </p>
        <span className="badge">Testnet only · Groth16 demo</span>
      </header>
      <aside className="notice">
        {browserMode
          ? "Notes, test account keys, and Groth16 proving stay in this browser. Closing the page loses in-memory keys: save the note and recipient backup. "
          : "Trusted-local mode: the local backend signs with workshop test accounts and receives your note to generate the proof. "}
        Use throwaway testnet funds only. This educational Groth16 setup is not
        a production trusted ceremony; timing, funding and a small anonymity set
        can link activity. It is not legal settlement of a Pacta obligation.
      </aside>
      {!config.ready && (
        <p role="status" className="notice">
          {config.error ?? "Waiting for testnet payment configuration…"}
        </p>
      )}
      <div className="flow-grid">
        <section>
          <span className="step">01 / PREPARE</span>
          <h2>Keep the withdrawal note</h2>
          <p>
            Your note controls the deposit. Losing it means losing access. It is
            held in this page's memory, never localStorage.
          </p>
          <button disabled={!!busy || !!depositReceipt} onClick={generateNote}>
            Generate a test note
          </button>
          <label>
            Note (128 hex characters)
            <textarea
              value={note}
              spellCheck={false}
              placeholder="Generate a note or paste a saved testnet note"
              onChange={(e) => {
                setNote(e.target.value.trim());
                setSaved(false);
                setProofId("");
              }}
              disabled={!!busy || !!depositReceipt}
            />
          </label>
          <button disabled={!validNote(note) || !!busy} onClick={saveNote}>
            Download note backup
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
            />
            I saved this note somewhere private.
          </label>
        </section>
        <section id="deposit">
          <span className="step">02 / DEPOSIT</span>
          <h2>Deposit exactly 1 XLM</h2>
          <p>
            Only the commitment goes to the pool. A disposable browser account
            is independently funded through Friendbot; local mode uses a
            workshop account.
          </p>
          <label>
            Depositor
            <select
              value={depositor}
              onChange={(e) => setDepositor(e.target.value)}
            >
              {config.depositors?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id}: {d.address}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={
              !!busy ||
              !config.ready ||
              !saved ||
              !!depositReceipt ||
              !validNote(note)
            }
            onClick={() =>
              run("Submitting deposit", async () => {
                const c = commitment({
                  nullifier: BigInt("0x" + note.slice(0, 64)),
                  secret: BigInt("0x" + note.slice(64)),
                });
                const result = await call("/pay/deposit", {
                  commitment: c.toString(),
                  depositor,
                });
                setDepositReceipt(result);
                setMessage(
                  result.status === "SUCCESS"
                    ? "Deposit confirmed. Keep your note safe."
                    : "Deposit submitted. Check confirmation before retrying.",
                );
              })
            }
          >
            Deposit 1 test XLM
          </button>
          <Tx receipt={depositReceipt} />
          {depositReceipt && (
            <button
              disabled={!!busy}
              onClick={() =>
                run("Checking deposit", () =>
                  confirm(depositReceipt, setDepositReceipt),
                )
              }
            >
              Check deposit confirmation
            </button>
          )}
        </section>
        <section>
          <span className="step">03 / PROVE</span>
          <h2>Prove your membership</h2>
          <p>
            Use a fresh independently funded testnet address. Timing and a small
            deposit set can still link activity.
          </p>
          {browserMode && (
            <>
              <button
                disabled={!!busy || !!recipient}
                onClick={() =>
                  run(
                    "Creating and independently funding recipient",
                    async () => {
                      setRecipient(await createBrowserRecipient());
                      setProofId("");
                    },
                  )
                }
              >
                Create fresh recipient with Friendbot
              </button>
              <button
                disabled={!!busy || !recipient}
                onClick={() =>
                  run("Saving recipient backup", async () =>
                    downloadRecipientBackup(),
                  )
                }
              >
                Download recipient key backup
              </button>
            </>
          )}
          <label>
            Recipient B public address
            <input
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value.trim());
                setProofId("");
              }}
              placeholder="Create a fresh recipient first"
              disabled={true}
            />
          </label>
          {!browserMode && (
            <label className="check">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I trust this local backend with my test note for proving.
            </label>
          )}
          <button
            disabled={
              !!busy ||
              !config.ready ||
              (!browserMode && !consent) ||
              !validNote(note) ||
              !/^G[A-Z2-7]{55}$/.test(recipient)
            }
            onClick={() =>
              run(
                "Generating Groth16 proof; this can take a few minutes",
                async () => {
                  const result = await call("/pay/prove", {
                    note,
                    recipient,
                    trustedLocal: true,
                  });
                  setProofId(result.proofId);
                  setMessage(
                    "Groth16 proof generated locally. No withdrawal has been sent yet.",
                  );
                },
              )
            }
          >
            Generate withdrawal proof
          </button>
          {proofId && (
            <p className="good">Proof ready · relayer fee 0 XLM; Stellar network fee still applies</p>
          )}
        </section>
        <section>
          <span className="step">04 / WITHDRAW</span>
          <h2>Submit and confirm</h2>
          <p>
            A proof or simulation is not a payment. Success appears only after
            the transaction is confirmed. Gross payout is 1 XLM; the recipient signs and pays the Stellar network fee, so its net balance increase is lower.
          </p>
          <button
            disabled={!!busy || !proofId || !!withdrawReceipt}
            onClick={() =>
              run("Submitting withdrawal", async () => {
                const result = await call("/pay/withdraw", { proofId });
                setWithdrawReceipt(result);
                setMessage(
                  result.status === "SUCCESS"
                    ? "Withdrawal confirmed on Stellar Testnet."
                    : "Withdrawal submitted; confirmation is pending.",
                );
              })
            }
          >
            Withdraw to recipient B
          </button>
          <Tx receipt={withdrawReceipt} />
          {withdrawReceipt && (
            <button
              disabled={!!busy}
              onClick={() =>
                run("Checking withdrawal", () =>
                  confirm(withdrawReceipt, setWithdrawReceipt),
                )
              }
            >
              Check withdrawal confirmation
            </button>
          )}
          <div className="ai-panel" id="ai">
            <h3>Required contest AI step: explain privacy limits</h3>
            <p>
              The contest requires one successful real OpenRouter request. Payments can run while AI setup is pending. Uses a fixed synthetic
              explanation prompt. No note, address, document, or transaction is
              sent. Uses the configured server allowance.
            </p>
            {browserMode && (
              <label>
                AI access token (memory only)
                <input
                  type="password"
                  autoComplete="off"
                  value={aiAccessToken}
                  onChange={(e) => setAiAccessToken(e.target.value)}
                  placeholder="Configured deployment token"
                />
              </label>
            )}
            <button
              disabled={!!busy || (browserMode ? !aiAccessToken : !aiEnabled)}
              onClick={() =>
                run("Requesting educational AI explanation", async () => {
                  const result = await call("/pay/ai-step", {});
                  setAi(
                    `${result.text}\n\nModel: ${result.model} · Request: ${result.id}`,
                  );
                  setAiEnabled(false);
                })
              }
            >
              Ask AI to explain
            </button>
            {!aiEnabled && !ai && (
              <p>AI pending: server key and explicit call limit required.</p>
            )}
            {ai && <p className="ai-result">{ai}</p>}
          </div>
        </section>
      </div>
      <div role="status" aria-live="polite" className="status">
        {busy ? `${busy}…` : message}
      </div>
      <footer>
        Pool: <span>{config.pool ?? "not configured"}</span>
        <br />
        Never paste a Stellar secret key. This page never asks for one.
        Recipient signing is required; arbitrary external recipients are not
        supported in this demo.
      </footer>
    </main>
  );
}
