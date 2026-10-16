/** Server-only, bounded educational call. Never accepts payment data or prompts. */
export type ChatResult = {
  id: string;
  model: string;
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
export const EDUCATIONAL_PROMPT =
  "Explain in Spanish in at most three short sentences why a Groth16 membership proof for a fixed-denomination Stellar testnet payment does not guarantee anonymity. Mention that the educational setup is not a production trusted ceremony. Mention timing, small anonymity sets, and independent recipient funding. This is a synthetic educational example, not a real payment or legal settlement.";
let calls = 0;
const limit = () =>
  Math.min(
    10,
    Math.max(0, Number(process.env.OPENROUTER_MAX_CALLS ?? "0") || 0),
  );
export function aiStatus() {
  return {
    enabled: Boolean(process.env.OPENROUTER_API_KEY) && calls < limit(),
    callsUsed: calls,
    maxCalls: limit(),
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-nano",
  };
}
export async function chat(): Promise<ChatResult> {
  const status = aiStatus();
  if (!status.enabled)
    throw new Error(
      "OpenRouter disabled: configure server key and OPENROUTER_MAX_CALLS (1–10). No AI response was generated.",
    );
  calls++; // Reserve before await; failures also consume the per-process allowance.
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: status.model,
        max_tokens: 180,
        messages: [{ role: "user", content: EDUCATIONAL_PROMPT }],
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      `OpenRouter request failed (${response.status}); no payment data was sent.`,
    );
  const result = (await response.json()) as {
    id?: string;
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: ChatResult["usage"];
  };
  const text = result.choices?.[0]?.message?.content;
  if (!result.id || !text)
    throw new Error("OpenRouter returned no usable response.");
  console.info(
    JSON.stringify({
      event: "payment.openrouter.completed",
      id: result.id,
      model: result.model ?? status.model,
      usage: result.usage,
    }),
  );
  return {
    id: result.id,
    model: result.model ?? status.model,
    text,
    usage: result.usage,
  };
}
