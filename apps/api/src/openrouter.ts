/**
 * OpenRouter client stub. Defaults to a small model and max_tokens=300.
 * Never put the key in the frontend. Logs every request (no secrets).
 */
export type ChatResult = {
  id: string;
  model: string;
  text: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-nano";
const DEFAULT_MAX = Number(process.env.OPENROUTER_MAX_TOKENS ?? "300");

export async function chat(prompt: string, opts?: { model?: string; maxTokens?: number }): Promise<ChatResult> {
  const key = process.env.OPENROUTER_API_KEY;
  const model = opts?.model ?? DEFAULT_MODEL;
  const max_tokens = opts?.maxTokens ?? DEFAULT_MAX;
  console.log(`[openrouter] request model=${model} max_tokens=${max_tokens} prompt_chars=${prompt.length}`);

  if (!key) {
    console.log("[openrouter] no OPENROUTER_API_KEY; returning stub");
    return {
      id: "stub",
      model,
      text: `(stub) no OPENROUTER_API_KEY. Prompt was ${prompt.length} chars.`,
    };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    id: string;
    model: string;
    choices?: { message?: { content?: string } }[];
    usage?: ChatResult["usage"];
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  console.log(`[openrouter] response id=${json.id} chars=${text.length}`);
  return { id: json.id, model: json.model, text, usage: json.usage };
}
