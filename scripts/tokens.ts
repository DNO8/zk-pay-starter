#!/usr/bin/env bun
/**
 * Read-only OpenRouter key balance. Needs OPENROUTER_API_KEY.
 * Uses GET https://openrouter.ai/api/v1/key (the key's own metadata).
 */
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("OPENROUTER_API_KEY is not set. The shared pool key lives in the facilitator .env.");
  process.exit(1);
}

const res = await fetch("https://openrouter.ai/api/v1/key", {
  headers: { Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`OpenRouter key endpoint ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const body = (await res.json()) as {
  data?: { limit?: number; limit_remaining?: number; usage?: number };
};
const d = body.data ?? {};
console.log("OpenRouter key (read-only):");
console.log(`  usage:           ${d.usage ?? "?"}`);
console.log(`  limit:           ${d.limit ?? "none"}`);
console.log(`  limit_remaining: ${d.limit_remaining ?? "?"}`);
